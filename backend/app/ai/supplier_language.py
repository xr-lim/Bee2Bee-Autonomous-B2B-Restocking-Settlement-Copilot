from __future__ import annotations

from typing import Final


DEFAULT_SUPPLIER_LANGUAGE: Final[str] = "en"
SUPPORTED_SUPPLIER_LANGUAGES: Final[tuple[str, ...]] = ("en", "ms", "zh")
SUPPLIER_LANGUAGE_LABELS: Final[dict[str, str]] = {
    "en": "English",
    "ms": "Malay",
    "zh": "Chinese",
}


def normalize_supplier_language(value: str | None) -> str:
    code = (value or "").strip().lower()
    if code not in SUPPORTED_SUPPLIER_LANGUAGES:
        return DEFAULT_SUPPLIER_LANGUAGE
    return code


def supplier_language_label(value: str | None) -> str:
    return SUPPLIER_LANGUAGE_LABELS[normalize_supplier_language(value)]
