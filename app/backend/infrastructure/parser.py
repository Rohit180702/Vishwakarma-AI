"""
Document parser with source metadata tracking.
Uses Docling for robust parsing of multiple formats (.md, .txt, .docx, .pdf)
"""
from __future__ import annotations

import os
import tempfile
import shutil
from pathlib import Path
from typing import List, Tuple

from docling.document_converter import DocumentConverter


class ParsedDocument:
    """Represents a parsed document with metadata."""

    def __init__(self, filename: str, content: str, size_bytes: int, file_type: str):
        self.filename = filename
        self.content = content
        self.size_bytes = size_bytes
        self.file_type = file_type
        self.line_count = len(content.splitlines())

    def get_preview(self, chars: int = 200) -> str:
        """Get preview of content."""
        preview = self.content[:chars]
        if len(self.content) > chars:
            preview += "..."
        return preview

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "filename": self.filename,
            "size_bytes": self.size_bytes,
            "file_type": self.file_type,
            "content_preview": self.get_preview(),
            "line_count": self.line_count,
        }


class DocumentParser:
    """Enhanced document parser with source tracking."""

    def __init__(self):
        self.converter = DocumentConverter()

    def parse_file(self, file_path: str) -> ParsedDocument:
        """
        Parse a single file and return content with metadata.

        Args:
            file_path: Path to the document file

        Returns:
            ParsedDocument with content and metadata
        """
        try:
            # Get file info
            path = Path(file_path)
            filename = path.name
            size_bytes = path.stat().st_size
            file_type = path.suffix.lstrip(".")

            # Parse with Docling
            result = self.converter.convert(file_path)
            content = result.document.export_to_markdown()

            return ParsedDocument(
                filename=filename,
                content=content,
                size_bytes=size_bytes,
                file_type=file_type,
            )
        except Exception as e:
            raise ValueError(f"Failed to parse {file_path}: {str(e)}")

    def parse_uploaded_files(self, files: List[Tuple[str, bytes]]) -> List[ParsedDocument]:
        """
        Parse multiple uploaded files.

        Args:
            files: List of tuples (filename, content_bytes)

        Returns:
            List of ParsedDocument objects
        """
        parsed_docs = []
        temp_dir = tempfile.mkdtemp()

        try:
            for filename, content_bytes in files:
                # Save to temp file
                temp_path = os.path.join(temp_dir, filename)
                with open(temp_path, "wb") as f:
                    f.write(content_bytes)

                # Parse
                parsed_doc = self.parse_file(temp_path)
                parsed_docs.append(parsed_doc)
        finally:
            # Cleanup temp files
            shutil.rmtree(temp_dir, ignore_errors=True)

        return parsed_docs

    def create_unified_context(self, parsed_docs: List[ParsedDocument]) -> str:
        """
        Create unified context from multiple documents with source attribution.

        Args:
            parsed_docs: List of parsed documents

        Returns:
            Unified markdown content with source headers
        """
        sections = []

        for doc in parsed_docs:
            section = f"""
# Document: {doc.filename}
---

{doc.content}

---
"""
            sections.append(section)

        unified = "\n\n".join(sections)

        # Add header
        header = f"""# Unified Specification Context
Total Documents: {len(parsed_docs)}
Total Size: {sum(d.size_bytes for d in parsed_docs)} bytes

---

"""
        return header + unified
