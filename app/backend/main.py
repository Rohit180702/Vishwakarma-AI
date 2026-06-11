"""
FastAPI application entry point.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from api.middleware import register_exception_handlers
from api.routes import auth, chat, characteristics, framework, hld, impact, interview, reviews, sessions, users
from config import get_settings
from infrastructure.database import init_db


# Custom JSON encoder to handle datetime
class CustomJSONResponse(JSONResponse):
    def render(self, content: Any) -> bytes:
        return super().render(
            jsonable_encoder(
                content,
                custom_encoder={
                    datetime: lambda dt: dt.isoformat()
                }
            )
        )

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
        default_response_class=CustomJSONResponse,
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

    app.include_router(auth.router, prefix="/api/v1")
    app.include_router(users.router, prefix="/api/v1")
    app.include_router(reviews.router, prefix="/api/v1")
    app.include_router(hld.router, prefix="/api/v1")
    app.include_router(chat.router, prefix="/api/v1")
    app.include_router(sessions.router, prefix="/api/v1")
    app.include_router(characteristics.router, prefix="/api/v1")
    app.include_router(impact.router, prefix="/api/v1")
    app.include_router(interview.router, prefix="/api/v1")
    app.include_router(framework.router, prefix="/api/v1")

    register_exception_handlers(app)

    @app.get("/healthz", tags=["ops"])
    async def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
