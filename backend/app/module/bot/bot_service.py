from app.core.utils.response import fail, success
from app.module.bot.bot import Bot
from app.module.bot.bot_repository import BotRepository

ALLOWED_MODELS = {
    "gpt-4o-mini",
    "gpt-4o",
    "claude-haiku",
    "claude-sonnet",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
}


def _bot_to_dict(bot: Bot) -> dict:
    """외부 응답에서 numeric id는 노출하지 않고 slug만 식별자로 사용."""
    return {
        "id": bot.slug,            # 외부 식별자
        "name": bot.name,
        "logo": bot.logo,
        "widget_icon": bot.widget_icon,
        "greeting": bot.greeting,
        "system_prompt": bot.system_prompt,
        "training_text": bot.training_text,
        "fallback": bot.fallback,
        "model": bot.model,
        "active": bot.active,
        "created_at": bot.created_at.isoformat() if bot.created_at else None,
        "updated_at": bot.updated_at.isoformat() if bot.updated_at else None,
    }


class BotService:
    def __init__(self, bot_repo: BotRepository):
        self.bot_repo = bot_repo

    async def _ensure_owner(self, slug: str, user_id: int) -> Bot:
        bot = await self.bot_repo.find_by_slug(slug)
        if not bot:
            fail("봇이 존재하지 않습니다.", "BOT_NOT_FOUND", 404)
        if bot.user_id != user_id:
            fail("권한이 없습니다.", "FORBIDDEN", 403)
        return bot

    async def get_public_bot(self, request):
        """임베드 위젯용 — 인증 없이 챗봇 헤더에 표시할 정보만 반환.

        widget.js가 외부 도메인에서 호출하므로 응답에 ACAO * 추가.
        """
        slug = request.path_params.get("slug")
        bot = await self.bot_repo.find_by_slug(slug)
        if not bot:
            fail("봇이 존재하지 않습니다.", "BOT_NOT_FOUND", 404)
        response = success(
            data={
                "id": bot.slug,
                "name": bot.name,
                "logo": bot.logo,
                "widget_icon": bot.widget_icon,
                "greeting": bot.greeting,
                "active": bot.active,
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

        model = body.get("model") or "gpt-4o-mini"
        if model not in ALLOWED_MODELS:
            fail(f"지원하지 않는 모델: {model}", "INVALID_MODEL")

        bot = Bot(
            user_id=user_id,
            name=name,
            logo=body.get("logo"),
            widget_icon=body.get("widget_icon"),
            greeting=body.get("greeting"),
            system_prompt=body.get("system_prompt"),
            training_text=body.get("training_text"),
            fallback=body.get("fallback"),
            model=model,
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
            "fallback",
            "model",
            "active",
        ):
            if field in body:
                if field == "model" and body[field] not in ALLOWED_MODELS:
                    fail(f"지원하지 않는 모델: {body[field]}", "INVALID_MODEL")
                if field == "name" and not (body[field] or "").strip():
                    fail("이름이 비어있습니다.", "NAME_REQUIRED")
                setattr(bot, field, body[field])

        await self.bot_repo.db.commit()
        await self.bot_repo.db.refresh(bot)
        return success(data=_bot_to_dict(bot))

    async def delete_bot(self, request):
        user_id = request.user_id
        slug = request.path_params.get("slug")
        bot = await self._ensure_owner(slug, user_id)

        await self.bot_repo.delete(bot)
        await self.bot_repo.db.commit()
        return success(message="deleted")
