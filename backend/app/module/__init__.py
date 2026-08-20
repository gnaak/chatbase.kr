# app/module/__init__.py
from fastapi import FastAPI

# --- 라우터 import ---
from app.module.admin import admin_router
from app.module.auth import auth_router
from app.module.user import user_router
from app.module.bot import bot_router
from app.module.api_key import api_key_router
from app.module.chat import chat_router
from app.module.kakao_skill import kakao_skill_router
from app.module.llm_model import llm_model_router

# --- 모델 등록 (SQLAlchemy 관계 인식용) ---
from app.module.admin.admin import Admin
from app.module.user.user import User
from app.module.bot.bot import Bot
from app.module.bot.bot_file import BotFile
from app.module.api_key.api_key import ApiKey
from app.module.chat.chat_session import ChatSession
from app.module.chat.chat_message import ChatMessage
from app.module.llm_model.llm_model import LLMModel


def setup_routers(app: FastAPI):
    """모든 도메인 라우터를 FastAPI 인스턴스에 등록"""
    app.include_router(auth_router.router, prefix="/api/auth")
    app.include_router(admin_router.router, prefix="/api/admin")
    app.include_router(user_router.router, prefix="/api/user")
    app.include_router(bot_router.router, prefix="/api/bot")
    app.include_router(api_key_router.router, prefix="/api/api-key")
    app.include_router(chat_router.router, prefix="/api/chat")
    app.include_router(kakao_skill_router.router, prefix="/api/kakao")
    app.include_router(llm_model_router.router, prefix="/api/model")
