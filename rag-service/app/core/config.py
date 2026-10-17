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

    gemini_api_key: str = ""
    groq_api_key: Optional[str] = None
    upstash_vector_rest_url: str = ""
    upstash_vector_rest_token: str = ""
    likha_url: Optional[str] = "https://gabay.zyberlab.com"
    likha_token: Optional[str] = None
    likha_admin_email: Optional[str] = None
    likha_admin_password: Optional[str] = None
    cors_allowed_origins: str = "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,https://gabay.zyberlab.com"
    rag_client_key: Optional[str] = None
    port: int = 8000
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 465
    smtp_user: Optional[str] = None
    smtp_password: Optional[str] = None
    smtp_from: Optional[str] = "GABAY LMS <no-reply@gabay.edu.ph>"

    model_config = {
        "extra": "ignore",
    }


@lru_cache()
def get_settings() -> Settings:
    """Return a cached singleton instance of Settings."""
    return Settings(
        gemini_api_key=os.getenv("GEMINI_API_KEY", ""),
        groq_api_key=os.getenv("GROQ_API_KEY"),
        upstash_vector_rest_url=os.getenv("UPSTASH_VECTOR_REST_URL", ""),
        upstash_vector_rest_token=os.getenv("UPSTASH_VECTOR_REST_TOKEN", ""),
        likha_url=os.getenv("LIKHA_URL", "https://gabay.zyberlab.com"),
        likha_token=os.getenv("LIKHA_TOKEN") or os.getenv("LIKHA_STATIC_TOKEN"),
        likha_admin_email=os.getenv("LIKHA_ADMIN_EMAIL"),
        likha_admin_password=os.getenv("LIKHA_ADMIN_PASSWORD"),
        cors_allowed_origins=os.getenv(
            "CORS_ALLOWED_ORIGINS",
            "http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173,https://gabay.zyberlab.com",
        ),
        rag_client_key=os.getenv("RAG_CLIENT_KEY"),
        port=int(os.getenv("PORT", "8000")),
        smtp_host=os.getenv("SMTP_HOST", "smtp.gmail.com"),
        smtp_port=int(os.getenv("SMTP_PORT", "465")),
        smtp_user=os.getenv("SMTP_USER") or os.getenv("GMAIL_USER"),
        smtp_password=os.getenv("SMTP_PASSWORD") or os.getenv("GMAIL_APP_PASSWORD"),
        smtp_from=os.getenv("SMTP_FROM", "GABAY LMS <no-reply@gabay.edu.ph>"),
    )

