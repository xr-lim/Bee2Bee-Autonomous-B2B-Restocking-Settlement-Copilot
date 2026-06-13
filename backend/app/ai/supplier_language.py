from __future__ import annotations

from typing import Final


DEFAULT_SUPPLIER_LANGUAGE: Final[str] = "en"
SUPPLIER_LANGUAGE_LABELS: Final[dict[str, str]] = {
    "en": "English",
    "ms": "Malay",
    "zh-CN": "Chinese (Simplified)",
    "zh-TW": "Chinese (Traditional)",
    "ta": "Tamil",
    "id": "Indonesian",
    "th": "Thai",
    "vi": "Vietnamese",
    "fil": "Filipino",
    "ja": "Japanese",
    "ko": "Korean",
    "hi": "Hindi",
    "bn": "Bengali",
    "ur": "Urdu",
    "ar": "Arabic",
    "tr": "Turkish",
    "fr": "French",
    "de": "German",
    "es": "Spanish",
    "pt": "Portuguese",
    "pt-BR": "Portuguese (Brazil)",
    "it": "Italian",
    "nl": "Dutch",
    "pl": "Polish",
    "ru": "Russian",
    "uk": "Ukrainian",
    "cs": "Czech",
    "ro": "Romanian",
    "el": "Greek",
    "he": "Hebrew",
    "fa": "Persian",
    "sw": "Swahili",
    "af": "Afrikaans",
    "my": "Burmese",
    "km": "Khmer",
    "lo": "Lao",
    "ne": "Nepali",
    "si": "Sinhala",
    "te": "Telugu",
    "ml": "Malayalam",
    "kn": "Kannada",
    "gu": "Gujarati",
    "pa": "Punjabi",
    "mr": "Marathi",
    "no": "Norwegian",
    "sv": "Swedish",
    "da": "Danish",
    "fi": "Finnish",
}

CANONICAL_LANGUAGE_CODES: Final[dict[str, str]] = {
    code.lower(): code for code in SUPPLIER_LANGUAGE_LABELS
}


def normalize_supplier_language(value: str | None) -> str:
    code = (value or "").strip()
    if not code:
        return DEFAULT_SUPPLIER_LANGUAGE

    return CANONICAL_LANGUAGE_CODES.get(code.lower(), DEFAULT_SUPPLIER_LANGUAGE)


def supplier_language_label(value: str | None) -> str:
    return SUPPLIER_LANGUAGE_LABELS[normalize_supplier_language(value)]
