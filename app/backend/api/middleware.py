"""
Global error handler — converts domain/app exceptions to RFC 7807 Problem Details.
"""
from __future__ import annotations

import json
from datetime import date, datetime

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError


def _json_safe(obj: object) -> object:
    """Recursively make an object safe for json.dumps (handles datetime, date, etc.)."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_json_safe(i) for i in obj]
    return obj


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(ValueError)
    async def value_error_handler(request: Request, exc: ValueError) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "type": "https://vishwakarma.ai/errors/validation",
                "title": "Validation error",
                "status": 422,
                "detail": str(exc),
                "errors": [],
            },
        )

    @app.exception_handler(ValidationError)
    async def pydantic_error_handler(
        request: Request, exc: ValidationError
    ) -> JSONResponse:
        # exc.errors() may contain raw Python objects (e.g. datetime) from the
        # failed input — convert them to JSON-safe values before passing to JSONResponse.
        safe_errors = _json_safe(exc.errors(include_url=False))
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "type": "https://vishwakarma.ai/errors/validation",
                "title": "Request validation failed",
                "status": 422,
                "detail": "One or more fields failed validation",
                "errors": safe_errors,
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "type": "https://vishwakarma.ai/errors/internal",
                "title": "Internal server error",
                "status": 500,
                "detail": "An unexpected error occurred",
                "errors": [],
            },
        )
