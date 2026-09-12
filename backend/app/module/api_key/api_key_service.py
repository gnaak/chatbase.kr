from app.core.logging.logger import get_logger
from app.core.utils.encryption import decrypt, encrypt
from app.core.utils.response import fail, success
from app.core.config.settings import settings
from app.module.api_key.api_key import Provider
from app.module.api_key.api_key_repository import ApiKeyRepository

logger = get_logger(__name__)

PROVIDER_PREFIX_HINT = {
    Provider.OPENAI: "sk-",
    Provider.ANTHROPIC: "sk-ant-",
    Provider.GOOGLE: "AIza",
}


#: 우리가 제공하는 키로 돌 때 고정하는 모델.
#:
#: 사용자가 고른 모델을 무시하고 이걸 쓴다. 원가가 우리한테 오는 경로라
#: 모델 선택권을 주는 순간 상한이 사라진다. FAQ 응답은 추론이 필요 없어 충분하다.
#: 카탈로그 실측: luna $0.20/$1.20 vs mini $0.75/$4.50 — 3.7배 차이.
SERVICE_MODEL = "gpt-5.6-luna"

#: 제공 키가 커버하는 provider. OpenAI 하나만 우리가 낸다.
#: Anthropic·Google 은 쓰려면 본인 키를 등록해야 한다.
SERVICE_PROVIDER = Provider.OPENAI


def service_llm_key() -> str:
    """우리가 제공하는 LLM 키. 미설정이면 빈 문자열.

    빈 문자열이면 제공 경로 자체가 없는 것으로 취급한다 — 빈 키로 호출하면
    SDK 가 raise 하고 그게 방문자 화면에 나간다.
    """
    return (getattr(settings, "openai_api_key", None) or "").strip()


async def prefers_service_key(db, user_id: int) -> bool:
    """이 계정이 OpenAI 를 **제공 키**로 쓰기로 했는가.

    키 화면에서 고르는 값이다(`tb_users.use_service_key`). 본인 키가 등록돼
    있어도 이게 켜져 있으면 제공 키를 쓴다 — 넣어는 뒀지만 평소엔 무료로 두고
    싶은 경우가 있고, 그 선택권을 뺏을 이유가 없다.

    PK 단일 컬럼 조회라 대화 경로에 붙여도 부담이 없다. 읽기 실패나 미설정은
    **True(제공 키)** 로 떨어진다 — 못 읽었다고 본인 키로 붙이면 남의 카드로
    과금된다. 모르면 우리가 내는 쪽이 안전하다.

    실패를 삼키는 이유가 하나 더 있다: 마이그레이션이 아직 안 올라간 서버에서는
    이 컬럼이 없어서 조회가 터진다. 그대로 두면 키 화면과 **대화 경로 전체**가
    500 이 된다. 이 값 하나 못 읽은 것이 서비스를 멈출 일은 아니다.
    """
    from sqlalchemy import select

    from app.module.user.user import User

    try:
        result = await db.execute(
            select(User.use_service_key).where(User.id == user_id)
        )
        value = result.scalar_one_or_none()
    except Exception:
        logger.warning("use_service_key 조회 실패 user=%s — 제공 키로 간주", user_id)
        return True
    return True if value is None else bool(value)


async def has_usable_key(api_key_service, user_id: int, provider) -> bool:
    """이 provider 로 **지금 호출할 수단이 있는가.** 본인 키든 제공 키든.

    봇 생성 같은 사전 검증에 쓴다. `resolve_llm_route` 와 달리 어느 쪽을 쓸지는
    따지지 않는다 — 저장 시점에 고른 것과 대화 시점에 쓰는 것이 달라질 수 있고
    (키 화면에서 언제든 바꾼다), 그걸 이유로 저장을 막으면 안 되기 때문이다.
    """
    if await api_key_service.get_decrypted_key(user_id, provider):
        return True
    return provider == SERVICE_PROVIDER and bool(service_llm_key())


async def bills_us(db, api_key_service, user_id: int, model: str) -> bool:
    """이 모델로 도는 대화의 **사용료가 우리한테 오는가.**

    월 대화 한도를 걸지 말지가 여기서 갈린다. 내 키로 도는 대화는 우리 원가가
    0이라 건수를 조일 이유가 없다 — 조이면 "돈은 내가 내는데 왜 막냐"가 된다.

    `resolve_llm_route` 의 `is_ours` 와 같은 판정을 **키 복호화 없이** 한다.
    대화마다 도는 경로라 가능하면 조회를 줄인다(제공 키 선호면 본인 키는 아예
    안 본다).

    파일 학습 봇은 여기서 따지지 않는다. 그 조합은 애초에 제공 키로 안 돌고
    (`resolve_llm_route` 가 거절한다) 대화 자체가 없어서 원가도 없다.
    """
    from app.module.infra.llm.llm_service import resolve_provider

    try:
        provider = resolve_provider(model)
    except ValueError:
        # 모델 문자열이 깨졌다. 대화가 성립 안 하므로 한도를 걸 것도 없다.
        return False
    if provider != SERVICE_PROVIDER or not service_llm_key():
        return False
    if await prefers_service_key(db, user_id):
        return True
    # 내 키를 고른 계정인데 정작 등록이 없으면 라우터가 제공 키로 떨어뜨린다.
    return not await api_key_service.get_decrypted_key(user_id, provider)


class ApiKeyService:
    """BYOK 사용자 API 키 등록/조회/삭제.

    - 평문 키는 절대 DB에 저장하지 않으며, Fernet 암호화 후 LargeBinary로 저장.
    - 마지막 4자리(last4)만 노출용으로 별도 저장.
    """

    def __init__(self, api_key_repo: ApiKeyRepository):
        self.api_key_repo = api_key_repo

    @staticmethod
    def _parse_provider(value: str | None) -> Provider:
        if not value:
            fail("provider가 필요합니다.", "PROVIDER_REQUIRED")
        try:
            return Provider(value)
        except ValueError:
            fail(f"지원하지 않는 provider: {value}", "INVALID_PROVIDER")

    async def list_keys(self, request):
        """등록된 키 + **우리가 제공 중인 키**.

        제공 키는 DB 에 없다. 여기서 합성해 내려보낸다 — 사용자마다 우리 키를
        암호화 저장하면 중복이고 유출면만 늘며, 키를 교체할 때 전 계정 row 를
        갱신해야 한다. '삭제' 버튼의 의미도 애매해진다.

        화면이 `source` 로 갈라 그린다:
          own      사용자가 등록한 키. 모델 선택·파일 학습·웹 검색이 열린다
          service  우리가 내주는 키. `SERVICE_MODEL` 고정

        OpenAI 는 둘이 **동시에** 나갈 수 있다. 키를 넣어뒀어도 평소엔 무료로
        두고 싶을 수 있어서, 숨기지 않고 둘 다 보여주고 고르게 한다. 어느 쪽이
        지금 쓰이는지는 `selected` 로 알린다(`resolve_llm_route` 와 같은 판정).
        """
        user_id = request.user_id
        keys = await self.api_key_repo.find_all_by_user(user_id)
        # 화면이 체크를 그리려면 "지금 어느 쪽이 쓰이는지"를 알아야 한다.
        prefers = await prefers_service_key(self.api_key_repo.db, user_id)
        data = [
            {
                "provider": k.provider.value,
                "last4": k.last4,
                "registered_at": k.created_at.isoformat() if k.created_at else None,
                "updated_at": k.updated_at.isoformat() if k.updated_at else None,
                "source": "own",
                "model": None,
                # OpenAI 만 제공 키와 경쟁한다. 나머지는 본인 키뿐이라 항상 선택됨.
                "selected": (
                    not prefers if k.provider == SERVICE_PROVIDER else True
                ),
            }
            for k in keys
        ]

        # 본인 키가 있어도 제공 키를 숨기지 않는다. 둘 다 보여주고 고르게 한다.
        if service_llm_key():
            data.append(
                {
                    "provider": SERVICE_PROVIDER.value,
                    # 우리 키의 뒷자리를 노출하지 않는다. 알 필요도 없고,
                    # 여러 계정에 같은 값이 보이면 같은 키라는 것만 알려준다.
                    "last4": None,
                    "registered_at": None,
                    "updated_at": None,
                    "source": "service",
                    "model": SERVICE_MODEL,
                    "selected": prefers,
                }
            )
        return success(data=data)

    async def upsert(self, request):
        user_id = request.user_id
        body = await request.json()
        provider = self._parse_provider(body.get("provider"))
        plain = (body.get("key") or "").strip()

        if not plain:
            fail("key가 비어있습니다.", "KEY_REQUIRED")
        if len(plain) < 16:
            fail("API 키 형식이 올바르지 않습니다.", "INVALID_KEY")

        encrypted = encrypt(plain)
        last4 = plain[-4:]

        record = await self.api_key_repo.upsert(
            user_id=user_id,
            provider=provider,
            encrypted_key=encrypted,
            last4=last4,
        )
        await self.api_key_repo.db.commit()

        return success(
            data={
                "provider": record.provider.value,
                "source": "own",
                "last4": record.last4,
                "registered_at": (
                    record.created_at.isoformat() if record.created_at else None
                ),
            }
        )

    async def delete(self, request):
        user_id = request.user_id
        body = await request.json()
        provider = self._parse_provider(body.get("provider"))

        record = await self.api_key_repo.find(user_id, provider)
        if not record:
            fail("등록된 키가 없습니다.", "KEY_NOT_FOUND", 404)

        await self.api_key_repo.delete(record)
        await self.api_key_repo.db.commit()
        return success(message="deleted")

    # ── chat 도메인에서 사용 ────────────────────
    async def get_decrypted_key(self, user_id: int, provider: Provider) -> str | None:
        record = await self.api_key_repo.find(user_id, provider)
        if not record:
            return None
        return decrypt(record.encrypted_key)
