"""
Global error handler — converts domain/app exceptions to RFC 7807 Problem Details.
"""
from __future__ import annotations

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from pydantic import ValidationError


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
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "type": "https://vishwakarma.ai/errors/validation",
                "title": "Request validation failed",
                "status": 422,
                "detail": "One or more fields failed validation",
                "errors": exc.errors(),
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
