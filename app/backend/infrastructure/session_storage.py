"""
File-based storage for per-session artefacts.

Each session gets its own folder:
  data/sessions/{session_id}/
    input.md               ← Docling-converted (or verbatim copy if already .md)
    characteristics.json   ← Detected architectural characteristics with priorities
    questions.json         ← Claude-generated interview questions (without answers)
    answers.json           ← user's decisions, one object per answered question
    hld.json               ← generated HLD document (written after generation)
"""
from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any


class SessionStorage:
    def __init__(self, base_dir: str | Path = "./data") -> None:
        self.base = Path(base_dir) / "sessions"
        self.base.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _dir(self, session_id: str, *, create: bool = False) -> Path:
        d = self.base / session_id
        if create:
            d.mkdir(parents=True, exist_ok=True)
        return d

    def _path(self, session_id: str, filename: str, *, create_dir: bool = False) -> Path:
        return self._dir(session_id, create=create_dir) / filename

    def _read_json(self, path: Path) -> Any:
        if not path.exists():
            return None
        return json.loads(path.read_text(encoding="utf-8"))

    def _write_json(self, path: Path, data: Any) -> None:
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    # ------------------------------------------------------------------
    # input.md
    # ------------------------------------------------------------------

    def write_input_md(self, session_id: str, content: str) -> None:
        p = self._path(session_id, "input.md", create_dir=True)
        p.write_text(content, encoding="utf-8")

    def read_input_md(self, session_id: str) -> str:
        p = self._path(session_id, "input.md")
        return p.read_text(encoding="utf-8") if p.exists() else ""

    # ------------------------------------------------------------------
    # characteristics.json — detected and prioritized characteristics
    # ------------------------------------------------------------------

    def write_characteristics(self, session_id: str, data: dict[str, Any]) -> None:
        """Write characteristics data (includes metadata like detected_at)."""
        p = self._path(session_id, "characteristics.json", create_dir=True)
        self._write_json(p, data)

    def read_characteristics(self, session_id: str) -> dict[str, Any]:
        """Read characteristics data. Returns empty dict if not exists."""
        p = self._path(session_id, "characteristics.json")
        result = self._read_json(p)
        return result if isinstance(result, dict) else {}

    # ------------------------------------------------------------------
    # questions.json — full question objects (without embedded answers)
    # ------------------------------------------------------------------

    def write_questions(self, session_id: str, questions: list[dict[str, Any]]) -> None:
        p = self._path(session_id, "questions.json", create_dir=True)
        self._write_json(p, questions)

    def read_questions(self, session_id: str) -> list[dict[str, Any]]:
        p = self._path(session_id, "questions.json")
        result = self._read_json(p)
        return result if isinstance(result, list) else []

    # ------------------------------------------------------------------
    # answers.json — one record per answered/skipped question
    # ------------------------------------------------------------------

    def write_answers(self, session_id: str, answers: list[dict[str, Any]]) -> None:
        p = self._path(session_id, "answers.json", create_dir=True)
        self._write_json(p, answers)

    def read_answers(self, session_id: str) -> list[dict[str, Any]]:
        p = self._path(session_id, "answers.json")
        result = self._read_json(p)
        return result if isinstance(result, list) else []

    def upsert_answer(self, session_id: str, answer: dict[str, Any]) -> list[dict[str, Any]]:
        """Add or replace the answer for a given question_id."""
        answers = self.read_answers(session_id)
        idx = next((i for i, a in enumerate(answers) if a["question_id"] == answer["question_id"]), None)
        if idx is not None:
            answers[idx] = answer
        else:
            answers.append(answer)
        self.write_answers(session_id, answers)
        return answers

    # ------------------------------------------------------------------
    # hld.json — generated HLD (JSON string → written as-is)
    # ------------------------------------------------------------------

    def write_hld(self, session_id: str, hld_json: str) -> None:
        p = self._path(session_id, "hld.json", create_dir=True)
        p.write_text(hld_json, encoding="utf-8")

    def read_hld(self, session_id: str) -> str:
        p = self._path(session_id, "hld.json")
        return p.read_text(encoding="utf-8") if p.exists() else "{}"

    def delete_hld(self, session_id: str) -> None:
        p = self._path(session_id, "hld.json")
        if p.exists():
            p.unlink()

    # ------------------------------------------------------------------
    # Session lifecycle
    # ------------------------------------------------------------------

    def session_exists(self, session_id: str) -> bool:
        return self._path(session_id, "input.md").exists()

    def delete_session(self, session_id: str) -> None:
        d = self._dir(session_id)
        if d.exists():
            shutil.rmtree(d)


# Module-level singleton — routes import this
_storage: SessionStorage | None = None


def get_storage() -> SessionStorage:
    global _storage
    if _storage is None:
        from config import get_settings
        _storage = SessionStorage(get_settings().data_dir)
    return _storage
