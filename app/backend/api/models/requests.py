"""
Pydantic request/response models for the HTTP API layer.
These are strictly API shapes — they never leak into the domain.
"""
from __future__ import annotations

from pydantic import BaseModel, Field, field_validator, model_validator


# ---------------------------------------------------------------------------
# Requests
# ---------------------------------------------------------------------------

BUILT_IN_TEMPLATES = {"arc42", "c4-adr", "rfc-design-doc"}


class GenerateHLDRequest(BaseModel):
    spec_text: str = Field(..., min_length=50)
    template: str = Field(..., description="arc42 | c4-adr | rfc-design-doc | custom")
    # For section-list custom templates (user-defined names)
    custom_sections: list[str] | None = Field(None, min_length=1, max_length=20)
    # For file-upload custom templates (raw file content — .md / .docx / .txt)
    custom_template_text: str | None = Field(None, description="Raw text of user-uploaded template file")

    @field_validator("template")
    @classmethod
    def valid_template(cls, v: str) -> str:
        allowed = BUILT_IN_TEMPLATES | {"custom"}
        if v not in allowed:
            raise ValueError(f"template must be one of {allowed}")
        return v

    @model_validator(mode="after")
    def custom_requires_content(self) -> "GenerateHLDRequest":
        if self.template == "custom" and not self.custom_sections and not self.custom_template_text:
            raise ValueError("Either custom_sections or custom_template_text is required when template is 'custom'")
        return self

    model_config = {"extra": "forbid"}


class ChatRequest(BaseModel):
    hld_json: dict = Field(..., description="Serialized HLDDocument from a prior /generate call")
    history: list[dict] = Field(default_factory=list, description="[{role, content}, ...]")
    message: str = Field(..., min_length=1, max_length=2000)

    model_config = {"extra": "forbid"}
