import asyncio
import hashlib
import json
import logging

import httpx
from bs4 import BeautifulSoup

from app.module.payment.plan_lookup import limits_of
from app.core.utils.response import fail, success
from app.module.api_key.api_key import Provider
from app.module.api_key.api_key_service import ApiKeyService
from app.module.bot.bot import Bot
from app.module.bot.bot_file import BotFile
from app.module.bot.bot_translation import TRANSLATION_LANGS
from app.module.bot.bot_repository import BotRepository
from app.module.infra.llm.llm_service import resolve_provider
from app.module.infra.openai.vector_store_service import VectorStoreService

_MAX_CRAWL_CHARS = 20_000
_STRIP_TAGS = ["script", "style", "nav", "footer", "header", "aside", "iframe", "noscript"]

#: logo / widget_icon(base64 data URL) 문자 수 상한 — 약 220KB 이미지.
#: 프론트가 256px로 줄여 보내므로 정상 경로에서는 40KB 안쪽이다.
#: 이 검증이 없으면 큰 이미지가 DB까지 내려가 DataError(1406) 500으로 터진다.
_MAX_IMAGE_DATA_CHARS = 300_000
_IMAGE_FIELD_LABEL = {"logo": "로고", "widget_icon": "위젯 아이콘"}


def _validate_image_field(field: str, value) -> None:
    if isinstance(value, str) and len(value) > _MAX_IMAGE_DATA_CHARS:
        fail(
            f"{_IMAGE_FIELD_LABEL.get(field, field)} 이미지가 너무 큽니다. "
            "더 작은 이미지를 사용해주세요.",
            "IMAGE_TOO_LARGE",
            413,
        )


def _validate_model(model: str) -> None:
    """provider prefix(gpt-/claude-/gemini-)만 검증. 모델 카탈로그는 DB SOT."""
    try:
        resolve_provider(model)
    except ValueError:
        fail(f"지원하지 않는 모델: {model}", "INVALID_MODEL")


def _bot_to_dict(bot: Bot) -> dict:
    return {
        "id": bot.slug,
        "name": bot.name,
        "logo": bot.logo,
        "widget_icon": bot.widget_icon,
        "greeting": bot.greeting,
        "system_prompt": bot.system_prompt,
        "training_text": bot.training_text,
        "training_type": bot.training_type or "text",
        "fallback": bot.fallback,
        "model": bot.model,
        "active": bot.active,
        "has_vector_store": bool(bot.vector_store_id),
        "faqs": bot.faqs or [],
        "multilingual": bool(bot.multilingual),
        "created_at": bot.created_at.isoformat() if bot.created_at else None,
        "updated_at": bot.updated_at.isoformat() if bot.updated_at else None,
    }


def _bot_to_summary(bot: Bot) -> dict:
    """목록 응답. 상세(_bot_to_dict)와 달리 무거운 필드를 싣지 않는다.

    빠진 것: logo · widget_icon(둘 다 base64 MEDIUMTEXT) · training_text ·
    faqs · fallback · training_type · has_vector_store.
    목록을 쓰는 화면(홈·대화로그·카카오·통계) 중 이 필드를 읽는 곳은 없다.
    봇을 눌러 들어가면 botEdit이 GET /api/bot/{slug}로 전체를 따로 받는다.

    ⚠️ 필드를 늘리려면 bot_repository.find_by_user_summary의 load_only에도
    같이 넣어야 한다. 한쪽만 늘리면 async 지연 로딩으로 요청이 터진다.
    """
    return {
        "id": bot.slug,
        "name": bot.name,
        "model": bot.model,
        "system_prompt": bot.system_prompt,
        "greeting": bot.greeting,
        "active": bot.active,
        "created_at": bot.created_at.isoformat() if bot.created_at else None,
        "updated_at": bot.updated_at.isoformat() if bot.updated_at else None,
    }


def _normalize_training_type(value: str | None) -> str:
    return "file" if value == "file" else "text"


def _file_to_dict(f: BotFile) -> dict:
    return {
        "id": f.id,
        "filename": f.filename,
        "size": f.size,
        "mime_type": f.mime_type,
        "uploaded_at": f.created_at.isoformat() if f.created_at else None,
    }


logger = logging.getLogger(__name__)


def content_hash(greeting, faqs) -> str:
    """번역 원문(인사말 + FAQ)의 지문. 이게 그대로면 다시 번역하지 않는다.

    DeepL 무료는 월 50만 자다. 봇을 저장할 때마다 부르면 금방 태운다.
    정렬된 JSON으로 직렬화해 키 순서가 흔들려도 같은 값이 나오게 한다.

    둘을 **함께** 해싱한다. 하나만 바뀌어도 다시 번역해야 하기 때문이다.
    """
    payload = {"greeting": greeting or "", "faqs": faqs or []}
    return hashlib.sha256(
        json.dumps(payload, ensure_ascii=False, sort_keys=True).encode()
    ).hexdigest()


#: 실행 중인 번역 태스크. **참조를 들고 있어야 한다.**
#:
#: 이벤트 루프는 태스크를 약한 참조로만 잡는다. `asyncio.create_task(...)` 의
#: 반환값을 버리면 GC 가 실행 도중에 태스크를 수거할 수 있고, 그러면 번역이
#: 조용히 중간에 사라진다 — 로그도 안 남아서 "DeepL 이 안 돈다"로만 보인다.
_translation_tasks: set = set()


def schedule_faq_translation(bot_id: int) -> None:
    """FAQ 번역을 백그라운드로 띄운다. 참조를 보관해 GC 를 막는다."""
    task = asyncio.create_task(_translate_bot_faqs(bot_id))
    _translation_tasks.add(task)
    task.add_done_callback(_translation_tasks.discard)


async def _translate_bot_faqs(bot_id: int) -> None:
    """FAQ를 en/ja/zh로 번역해 저장한다. **백그라운드 전용.**

    요청 반환 뒤에 도는 작업이라 요청 스코프 세션을 못 쓴다. 자체 세션을 연다
    (`kakao_skill_service._answer_via_callback`와 같은 방식).

    번역이 실패해도 봇 저장을 되돌리지 않는다 — 번역이 없으면 원문(한국어) FAQ가
    그대로 나가므로 서비스는 산다. 다만 **왜 안 됐는지는 반드시 로그로 남긴다.**
    조용히 넘어가면 키가 없는 건지, 한도가 찬 건지, 봇이 다국어가 아닌 건지
    바깥에서 구분할 방법이 없다.
    """
    from app.core.database.base import SessionLocal
    from app.module.bot.bot_repository import BotRepository
    from app.module.infra.deepl import deepl_service

    if not deepl_service.is_configured():
        logger.info(
            "translation skipped bot_id=%s: DEEPL_API_KEY 미설정", bot_id
        )
        return

    try:
        async with SessionLocal() as db:
            repo = BotRepository(db)
            bot = await repo.find_by_id(bot_id)
            if not bot:
                logger.info("translation skipped bot_id=%s: 봇 없음", bot_id)
                return
            if not bot.multilingual:
                logger.info(
                    "translation skipped bot_id=%s: 다국어 꺼짐", bot_id
                )
                return

            greeting = (bot.greeting or "").strip()
            faqs = bot.faqs or []
            if not greeting and not faqs:
                logger.info(
                    "translation skipped bot_id=%s: 번역할 인사말·FAQ 없음", bot_id
                )
                return

            digest = content_hash(greeting, faqs)
            done, skipped, failed = [], [], []

            for lang in TRANSLATION_LANGS:
                existing = await repo.find_translation(bot_id, lang)
                if existing and existing.source_hash == digest:
                    skipped.append(lang)  # 원문 그대로 — 호출하지 않는다
                    continue

                # 인사말과 FAQ를 요청 하나로 합치지 않는다. FAQ 쪽은 q/a 를
                # 번갈아 담아 인덱스로 되꺼내는 구조라, 앞에 한 줄을 끼우면
                # 짝이 밀린다. 대신 인사말이 비어 있으면 아예 안 부른다.
                g_out = greeting
                if greeting:
                    got = await deepl_service.translate([greeting], lang)
                    if got is None:
                        failed.append(lang)
                        continue
                    g_out = got[0]

                f_out = await deepl_service.translate_faqs(faqs, lang)
                if f_out is None:
                    failed.append(lang)  # 한도 소진·오류. 다음 저장 때 재시도
                    continue

                await repo.upsert_translation(bot_id, lang, g_out, f_out, digest)
                done.append(lang)

            await db.commit()
            logger.info(
                "translation bot_id=%s greeting=%s faqs=%d 저장=%s 생략=%s 실패=%s",
                bot_id,
                "있음" if greeting else "없음",
                len(faqs),
                done or "-",
                skipped or "-",
                failed or "-",
            )
    except Exception as exc:  # noqa: BLE001
        logger.exception("translation failed bot_id=%s: %s", bot_id, exc)


class BotService:
    def __init__(
        self,
        bot_repo: BotRepository,
        api_key_service: ApiKeyService,
        vector_store_service: VectorStoreService,
        user_repo=None,
    ):
        self.bot_repo = bot_repo
        self.api_key_service = api_key_service
        self.vector_store_service = vector_store_service
        self.user_repo = user_repo

    async def _ensure_bot_slot(self, user_id: int) -> None:
        """켜져 있는 봇을 한 자리 더 쓸 수 있는지 확인한다.

        비활성 봇은 세지 않으므로 안 쓰는 봇을 끄면 자리가 빈다.
        """
        limits = await self._plan_limits(user_id)
        if limits.bots is None:
            return
        active = await self.bot_repo.count_active_by_user(user_id)
        if active >= limits.bots:
            fail(
                f"현재 플랜에서는 챗봇을 {limits.bots}개까지 켜둘 수 있습니다. "
                "쓰지 않는 챗봇을 끄거나 플랜을 올려주세요.",
                "BOT_LIMIT_EXCEEDED",
                403,
            )

    async def _plan_limits(self, user_id: int):
        """챗봇 상품의 플랜 한도. 구독이 없으면 FREE로 떨어진다."""
        return await limits_of(self.bot_repo.db, user_id)

    async def _ensure_multilingual_allowed(self, user_id: int, requested) -> None:
        """다국어는 GLOBAL 플랜에서만 켤 수 있다.

        **끄는 건 언제나 허용한다** — 하향한 사람이 켜둔 봇을 정리하려는데 그것마저
        막으면 빠져나갈 길이 없다.

        플랜 이름으로 비교하지 않고 `multilingual` 값으로 본다. 이 기능을 포함하는
        플랜이 늘어나도 여기는 고칠 게 없어야 한다.
        """
        if not requested:
            return
        limits = await self._plan_limits(user_id)
        if not limits.multilingual:
            fail(
                "다국어 응대는 GLOBAL 플랜에서 사용할 수 있습니다.",
                "MULTILINGUAL_NOT_ALLOWED",
                403,
            )

    async def _ensure_owner(self, slug: str, user_id: int) -> Bot:
        bot = await self.bot_repo.find_by_slug(slug)
        if not bot:
            fail("봇이 존재하지 않습니다.", "BOT_NOT_FOUND", 404)
        if bot.user_id != user_id:
            fail("권한이 없습니다.", "FORBIDDEN", 403)
        return bot

    async def _require_openai_key(self, user_id: int) -> str:
        api_key = await self.api_key_service.get_decrypted_key(user_id, Provider.OPENAI)
        if not api_key:
            fail(
                "파일 학습은 OpenAI API 키 등록이 필요합니다.",
                "OPENAI_KEY_MISSING",
                424,
            )
        return api_key

    async def fetch_url(self, request):
        body = await request.json()
        url = (body.get("url") or "").strip()
        if not url:
            return fail("URL을 입력해주세요.")
        if not url.startswith(("http://", "https://")):
            url = "https://" + url

        try:
            async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
                resp = await client.get(url, headers={"User-Agent": "Mozilla/5.0"})
                resp.raise_for_status()
        except httpx.TimeoutException:
            return fail("요청 시간이 초과됐습니다.")
        except Exception as e:
            return fail(f"URL을 불러올 수 없습니다: {e}")

        soup = BeautifulSoup(resp.text, "html.parser")
        for tag in soup(_STRIP_TAGS):
            tag.decompose()

        lines = [l.strip() for l in soup.get_text(separator="\n").splitlines() if l.strip()]
        text = "\n".join(lines)[:_MAX_CRAWL_CHARS]

        return success({"text": text, "char_count": len(text)})

    async def get_public_bot(self, request):
        slug = request.path_params.get("slug")
        bot = await self.bot_repo.find_by_slug(slug)
        # 비활성 봇은 공개 위젯에서 조회 불가 (chat 엔드포인트와 동일 정책)
        if not bot or not bot.active:
            fail("봇이 존재하지 않습니다.", "BOT_NOT_FOUND", 404)
        # 인증 없이 열려 있고 CORS가 * 인 엔드포인트다. 플랜 이름을 그대로 내리면
        # 남의 봇 slug만 알아도 결제 상태가 노출되므로 불리언만 파생해서 준다.
        limits = await self._plan_limits(bot.user_id)

        # FAQ 번역본. 방문자가 언어를 고르면 프론트가 여기서 꺼내 쓴다.
        #
        # 언어별로 따로 부르지 않고 한 번에 내린다 — FAQ 몇 줄이라 크지 않고,
        # 언어를 바꿀 때마다 왕복하면 버튼이 늦게 바뀌어 티가 난다.
        # 다국어가 꺼져 있으면 빈 객체다(있어도 쓸 데가 없다).
        faqs_i18n: dict[str, list] = {}
        greeting_i18n: dict[str, str] = {}
        if bot.multilingual:
            for row in await self.bot_repo.find_translations(bot.id):
                if row.faqs:
                    faqs_i18n[row.lang] = row.faqs
                if row.greeting:
                    greeting_i18n[row.lang] = row.greeting

        response = success(
            data={
                "id": bot.slug,
                "name": bot.name,
                "logo": bot.logo,
                "widget_icon": bot.widget_icon,
                "greeting": bot.greeting,
                "active": bot.active,
                "faqs": bot.faqs or [],
                # 언어별 인사말을 통째로 내린다. 첫 화면은 방문자가 아직 아무 말도
                # 하기 전이라 서버가 언어를 알 수 없고, QR 의 `?lang=` 은 프론트에만
                # 있다. 몇 백 바이트라 왕복을 한 번 더 하는 것보다 싸다.
                "multilingual": bool(bot.multilingual),
                "faqs_i18n": faqs_i18n,
                "greeting_i18n": greeting_i18n,
                "show_badge": not limits.remove_badge,
            }
        )
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response

    async def list_bots(self, request):
        user_id = request.user_id
        bots = await self.bot_repo.find_by_user_summary(user_id)
        return success(data=[_bot_to_summary(b) for b in bots])

    async def get_bot(self, request):
        user_id = request.user_id
        slug = request.path_params.get("slug")
        bot = await self._ensure_owner(slug, user_id)
        return success(data=_bot_to_dict(bot))

    async def create_bot(self, request):
        user_id = request.user_id
        body = await request.json()

        name = (body.get("name") or "").strip()
        if not name:
            fail("이름이 필요합니다.", "NAME_REQUIRED")

        model = body.get("model") or "gpt-5.4-mini"
        _validate_model(model)

        # 플랜별 챗봇 개수 제한
        await self._ensure_bot_slot(user_id)
        await self._ensure_multilingual_allowed(user_id, body.get("multilingual"))

        # API 키가 등록되지 않은 provider의 모델로는 챗봇을 만들 수 없음
        provider = resolve_provider(model)
        api_key = await self.api_key_service.get_decrypted_key(user_id, provider)
        if not api_key:
            fail(
                "챗봇을 만들려면 먼저 해당 모델의 API 키를 등록해야 합니다.",
                "API_KEY_REQUIRED",
                424,
            )

        for image_field in ("logo", "widget_icon"):
            _validate_image_field(image_field, body.get(image_field))

        bot = Bot(
            user_id=user_id,
            name=name,
            logo=body.get("logo"),
            widget_icon=body.get("widget_icon"),
            greeting=body.get("greeting"),
            system_prompt=body.get("system_prompt"),
            training_text=body.get("training_text"),
            training_type=_normalize_training_type(body.get("training_type")),
            fallback=body.get("fallback"),
            model=model,
            faqs=body.get("faqs"),
            multilingual=bool(body.get("multilingual", False)),
            active=body.get("active", True),
        )
        await self.bot_repo.add(bot)
        await self.bot_repo.db.commit()
        await self.bot_repo.db.refresh(bot)
        # FAQ 번역은 커밋 뒤 백그라운드로 돌린다.
        #
        # 저장 응답을 붙잡아두면 안 된다 — DeepL 왕복이 언어 3개면 수 초다.
        # 원문이 안 바뀌었으면 `_translate_bot_faqs` 안에서 해시로 걸러 아예
        # 호출하지 않으므로, 매번 부르는 비용은 사실상 0이다.
        if bot.multilingual:
            schedule_faq_translation(bot.id)
        return success(data=_bot_to_dict(bot))

    async def update_bot(self, request):
        user_id = request.user_id
        slug = request.path_params.get("slug")
        bot = await self._ensure_owner(slug, user_id)

        body = await request.json()
        was_active = bool(bot.active)
        if "multilingual" in body:
            await self._ensure_multilingual_allowed(user_id, body["multilingual"])
        for field in (
            "name",
            "logo",
            "widget_icon",
            "greeting",
            "system_prompt",
            "training_text",
            "training_type",
            "fallback",
            "model",
            "faqs",
            "multilingual",
            "active",
        ):
            if field in body:
                if field == "model":
                    _validate_model(body[field])
                if field == "name" and not (body[field] or "").strip():
                    fail("이름이 비어있습니다.", "NAME_REQUIRED")
                if field in _IMAGE_FIELD_LABEL:
                    _validate_image_field(field, body[field])
                if field == "training_type":
                    setattr(bot, field, _normalize_training_type(body[field]))
                    continue
                setattr(bot, field, body[field])

        # 꺼져 있던 봇을 켤 때도 상한을 본다. 안 보면 "끄고 만들고 다시 켜기"로
        # 개수 제한을 그대로 우회할 수 있다.
        if bot.active and not was_active:
            await self._ensure_bot_slot(user_id)

        await self.bot_repo.db.commit()
        await self.bot_repo.db.refresh(bot)
        # FAQ 번역은 커밋 뒤 백그라운드로 돌린다.
        #
        # 저장 응답을 붙잡아두면 안 된다 — DeepL 왕복이 언어 3개면 수 초다.
        # 원문이 안 바뀌었으면 `_translate_bot_faqs` 안에서 해시로 걸러 아예
        # 호출하지 않으므로, 매번 부르는 비용은 사실상 0이다.
        if bot.multilingual:
            schedule_faq_translation(bot.id)
        return success(data=_bot_to_dict(bot))

    async def delete_bot(self, request):
        user_id = request.user_id
        slug = request.path_params.get("slug")
        bot = await self._ensure_owner(slug, user_id)

        # vector store best-effort cleanup (OpenAI 키 있는 경우만)
        if bot.vector_store_id:
            api_key = await self.api_key_service.get_decrypted_key(
                user_id, Provider.OPENAI
            )
            if api_key:
                await self.vector_store_service.delete_vector_store(
                    api_key, bot.vector_store_id
                )

        await self.bot_repo.delete(bot)
        await self.bot_repo.db.commit()
        return success(message="deleted")

    # ── 학습 파일 ───────────────────────────────
    async def list_files(self, request):
        user_id = request.user_id
        slug = request.path_params.get("slug")
        bot = await self._ensure_owner(slug, user_id)
        files = await self.bot_repo.find_files_by_bot(bot.id)
        return success(data=[_file_to_dict(f) for f in files])

    async def upload_files(self, request):
        user_id = request.user_id
        slug = request.path_params.get("slug")
        bot = await self._ensure_owner(slug, user_id)

        # 파일 학습은 유료 플랜 기능
        limits = await self._plan_limits(user_id)
        if not limits.file_learning:
            fail(
                "파일 학습은 유료 플랜에서 이용할 수 있습니다.",
                "PLAN_UPGRADE_REQUIRED",
                403,
            )

        # OpenAI 모델만 RAG 가능 (Phase 1: GPT 우선)
        if resolve_provider(bot.model) != Provider.OPENAI:
            fail(
                "파일 학습은 현재 OpenAI 모델에서만 사용할 수 있습니다.",
                "RAG_PROVIDER_UNSUPPORTED",
                400,
            )

        api_key = await self._require_openai_key(user_id)

        form = await request.form()
        uploads = [v for v in form.getlist("files") if hasattr(v, "read")]
        if not uploads:
            fail("업로드할 파일이 없습니다.", "FILES_REQUIRED")

        # vector store 없으면 자동 생성
        if not bot.vector_store_id:
            bot.vector_store_id = await self.vector_store_service.create_vector_store(
                api_key, bot.slug
            )

        records = await self.vector_store_service.add_files(
            api_key, bot.vector_store_id, uploads
        )

        created: list[BotFile] = []
        for r in records:
            entity = BotFile(
                bot_id=bot.id,
                filename=r["filename"],
                mime_type=r["mime_type"],
                size=r["size"],
                openai_file_id=r["openai_file_id"],
            )
            await self.bot_repo.add_file(entity)
            created.append(entity)

        await self.bot_repo.db.commit()
        for f in created:
            await self.bot_repo.db.refresh(f)

        return success(data=[_file_to_dict(f) for f in created])

    async def delete_file(self, request):
        user_id = request.user_id
        slug = request.path_params.get("slug")
        file_id = int(request.path_params.get("file_id"))

        bot = await self._ensure_owner(slug, user_id)
        f = await self.bot_repo.find_file_by_id(file_id)
        if not f or f.bot_id != bot.id:
            fail("파일을 찾을 수 없습니다.", "FILE_NOT_FOUND", 404)

        if bot.vector_store_id and f.openai_file_id:
            api_key = await self.api_key_service.get_decrypted_key(
                user_id, Provider.OPENAI
            )
            if api_key:
                await self.vector_store_service.remove_file(
                    api_key, bot.vector_store_id, f.openai_file_id
                )

        await self.bot_repo.delete_file(f)
        await self.bot_repo.db.commit()
        return success(message="deleted")
