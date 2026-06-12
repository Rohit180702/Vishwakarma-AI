"""
FastAPI application entry point.
"""
from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.encoders import jsonable_encoder
from fastapi.staticfiles import StaticFiles

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

    # ── Static frontend serving (production / Replit) ──────────────────────
    # Serves the built React app from app/frontend/dist/ when it exists.
    # In local dev the Vite dev server handles the frontend instead.
    frontend_dist = Path(__file__).parent.parent / "frontend" / "dist"
    if frontend_dist.exists():
        assets_dir = frontend_dist / "assets"
        if assets_dir.exists():
            app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

        # Serve any other static files at root level (favicon, robots.txt, etc.)
        @app.get("/favicon.ico", include_in_schema=False)
        async def favicon() -> FileResponse:
            return FileResponse(str(frontend_dist / "favicon.ico"))

        # SPA catch-all: return index.html for every non-API path so that
        # React Router client-side routes (e.g. /dashboard, /review/123) work.
        @app.get("/{full_path:path}", include_in_schema=False)
        async def serve_spa(full_path: str) -> FileResponse:
            index = frontend_dist / "index.html"
            return FileResponse(str(index))

        logger.info("Serving frontend static files from %s", frontend_dist)
    else:
        logger.info(
            "Frontend dist not found at %s — run 'npm run build' in app/frontend/ "
            "or use the Vite dev server for local development.",
            frontend_dist,
        )

    return app


app = create_app()
