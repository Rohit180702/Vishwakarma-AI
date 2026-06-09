"""
FastAPI application entry point.
"""
from __future__ import annotations

import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api.middleware import register_exception_handlers
from api.routes import chat, hld, sessions, interview
from config import get_settings
from infrastructure.database import init_db

logging.basicConfig(level=get_settings().log_level)
logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Vishwakarma AI",
        description="HLD generation from product specifications",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.on_event("startup")
    async def on_startup() -> None:
        await init_db(settings.mongodb_url, settings.mongodb_db_name)
        logger.info("Database initialised")

    app.include_router(hld.router, prefix="/api/v1")
    app.include_router(chat.router, prefix="/api/v1")
    app.include_router(sessions.router, prefix="/api/v1")
    app.include_router(interview.router, prefix="/api/v1")

    register_exception_handlers(app)

    @app.get("/healthz", tags=["ops"])
    async def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
