import os
from pathlib import Path

from dotenv import load_dotenv


_CONFIG_DIR = Path(__file__).resolve().parent
_BACKEND_ROOT = _CONFIG_DIR.parents[1]

load_dotenv(_BACKEND_ROOT / ".env.local")
load_dotenv(_BACKEND_ROOT / ".env")


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


DATABASE_URL = _env("DATABASE_URL") or _env("SUPABASE_DB_URL")

AI_PROVIDER = _env("AI_PROVIDER", "anthropic").lower()

ANTHROPIC_BASE_URL = _env("ANTHROPIC_BASE_URL")
ANTHROPIC_AUTH_TOKEN = _env("ANTHROPIC_AUTH_TOKEN")
ANTHROPIC_API_KEY = _env("ANTHROPIC_API_KEY") or _env("ILMU_API_KEY")
ANTHROPIC_MODEL = _env("ANTHROPIC_MODEL")
ANTHROPIC_VERSION = _env("ANTHROPIC_VERSION", "2023-06-01")

GEMINI_BASE_URL = _env("GEMINI_BASE_URL", "https://generativelanguage.googleapis.com/v1beta/openai/")
GEMINI_API_KEY = _env("GEMINI_API_KEY")
GEMINI_MODEL = _env("GEMINI_MODEL", "gemini-2.5-flash")

CURRENT_AI_BASE_URL = GEMINI_BASE_URL if AI_PROVIDER == "gemini" else ANTHROPIC_BASE_URL
CURRENT_AI_MODEL = GEMINI_MODEL if AI_PROVIDER == "gemini" else ANTHROPIC_MODEL

AI_MAX_TOKENS = int(_env("AI_MAX_TOKENS", "1200"))
AI_TEMPERATURE = float(_env("AI_TEMPERATURE", "0.2"))
AI_TIMEOUT_SECONDS = float(_env("AI_TIMEOUT_SECONDS", "60"))
