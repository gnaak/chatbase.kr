import httpx
from bs4 import BeautifulSoup

from app.core.utils.response import fail, success
from app.module.api_key.api_key import Provider
from app.module.api_key.api_key_service import ApiKeyService
from app.module.bot.bot import Bot
from app.module.bot.bot_file import BotFile
from app.module.bot.bot_repository import BotRepository
from app.module.infra.llm.llm_service import resolve_provider
from app.module.infra.openai.vector_store_service import VectorStoreService

_MAX_CRAWL_CHARS = 20_000
_STRIP_TAGS = ["script", "style", "nav", "footer", "header", "aside", "iframe", "noscript"]


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


class BotService:
    def __init__(
        self,
        bot_repo: BotRepository,
        api_key_service: ApiKeyService,
        vector_store_service: VectorStoreService,
    ):
        self.bot_repo = bot_repo
        self.api_key_service = api_key_service
        self.vector_store_service = vector_store_service

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
        response = success(
            data={
                "id": bot.slug,
                "name": bot.name,
                "logo": bot.logo,
                "widget_icon": bot.widget_icon,
                "greeting": bot.greeting,
                "active": bot.active,
                "faqs": bot.faqs or [],
            }
        )
        response.headers["Access-Control-Allow-Origin"] = "*"
        return response

    async def list_bots(self, request):
        user_id = request.user_id
        bots = await self.bot_repo.find_by_user(user_id)
        return success(data=[_bot_to_dict(b) for b in bots])

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

        # API 키가 등록되지 않은 provider의 모델로는 챗봇을 만들 수 없음
        provider = resolve_provider(model)
        api_key = await self.api_key_service.get_decrypted_key(user_id, provider)
        if not api_key:
            fail(
                "챗봇을 만들려면 먼저 해당 모델의 API 키를 등록해야 합니다.",
                "API_KEY_REQUIRED",
                424,
            )

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
            active=body.get("active", True),
        )
        await self.bot_repo.add(bot)
        await self.bot_repo.db.commit()
        await self.bot_repo.db.refresh(bot)
        return success(data=_bot_to_dict(bot))

    async def update_bot(self, request):
        user_id = request.user_id
        slug = request.path_params.get("slug")
        bot = await self._ensure_owner(slug, user_id)

        body = await request.json()
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
            "active",
        ):
            if field in body:
                if field == "model":
                    _validate_model(body[field])
                if field == "name" and not (body[field] or "").strip():
                    fail("이름이 비어있습니다.", "NAME_REQUIRED")
                if field == "training_type":
                    setattr(bot, field, _normalize_training_type(body[field]))
                    continue
                setattr(bot, field, body[field])

        await self.bot_repo.db.commit()
        await self.bot_repo.db.refresh(bot)
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
