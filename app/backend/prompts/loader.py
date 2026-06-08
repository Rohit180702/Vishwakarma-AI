"""
PromptLoader — reads Markdown prompt templates and renders named placeholders.

Placeholder syntax:  {variable_name}  (single curly braces, valid identifier)

Only tokens matching the regex  {[a-zA-Z_][a-zA-Z0-9_]*}  whose name is
present in kwargs are substituted.  All other braces — including JSON schema
examples in the prompt body — are left completely untouched.

This means prompt authors never need to escape {{ or }} inside JSON examples.

Usage:
    from prompts import prompts
    text = prompts.render("hld/system.arc42", spec_text=raw)
"""
from __future__ import annotations

import re
from pathlib import Path
from typing import Any

_PROMPTS_DIR = Path(__file__).parent
_PLACEHOLDER = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


class PromptLoader:
    """Loads and caches prompt .md files; renders only declared placeholders."""

    def __init__(self, directory: Path = _PROMPTS_DIR) -> None:
        self._dir = directory
        self._cache: dict[str, str] = {}

    def load(self, name: str) -> str:
        """Return raw template string for *name* (file-cached after first read)."""
        if name not in self._cache:
            path = self._dir / f"{name}.md"
            if not path.exists():
                raise FileNotFoundError(
                    f"Prompt template '{name}.md' not found in {self._dir}"
                )
            self._cache[name] = path.read_text(encoding="utf-8")
        return self._cache[name]

    def render(self, name: str, **kwargs: Any) -> str:
        """
        Substitute {variable} tokens found in kwargs; leave everything else intact.
        Raises ValueError if a required placeholder is missing from kwargs.
        """
        template = self.load(name)
        missing: set[str] = set()

        def _replace(match: re.Match) -> str:
            key = match.group(1)
            if key in kwargs:
                return str(kwargs[key])
            missing.add(key)
            return match.group(0)

        result = _PLACEHOLDER.sub(_replace, template)

        if missing:
            raise ValueError(
                f"Prompt '{name}' contains unresolved placeholders: "
                + ", ".join(f"{{{k}}}" for k in sorted(missing))
            )
        return result


# Module-level singleton — import and use directly
prompts = PromptLoader()
