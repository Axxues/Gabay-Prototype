"""Configuration settings for Gabay LMS RAG service."""

import os
from functools import lru_cache
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv
from pydantic import BaseModel, Field

# Load .env file if available in the rag-service root or repo root
_env_file = Path(__file__).resolve().parent.parent.parent / ".env"
if _env_file.exists():
    load_dotenv(dotenv_path=_env_file, override=False)
else:
    load_dotenv(override=False)


class Settings(BaseModel):
    """Application settings loaded from environment variables or .env file."""

    gemini_api_key: str = Field(
        default_factory=lambda: os.getenv("GEMINI_API_KEY", "")
    )
    groq_api_key: Optional[str] = Field(
        default_factory=lambda: os.getenv("GROQ_API_KEY")
    )
    upstash_vector_rest_url: str = Field(
        default_factory=lambda: os.getenv("UPSTASH_VECTOR_REST_URL", "")
    )
    upstash_vector_rest_token: str = Field(
        default_factory=lambda: os.getenv("UPSTASH_VECTOR_REST_TOKEN", "")
    )
    likha_url: Optional[str] = Field(
        default_factory=lambda: os.getenv("LIKHA_URL", "https://gabay.zyberlab.com")
    )
    likha_admin_email: Optional[str] = Field(
        default_factory=lambda: os.getenv("LIKHA_ADMIN_EMAIL")
    )
    likha_admin_password: Optional[str] = Field(
        default_factory=lambda: os.getenv("LIKHA_ADMIN_PASSWORD")
    )
    port: int = Field(
        default_factory=lambda: int(os.getenv("PORT", "8000"))
    )

    model_config = {
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Return a cached singleton instance of Settings."""
    return Settings()
