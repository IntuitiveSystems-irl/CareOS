"""Configuration loaded from environment variables."""
from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # BigQuery dataset reference (e.g. "fc-aou-cdr-prod-ct.C2022Q4R9")
    WORKSPACE_CDR: str = ""

    # API security
    MED_ACCESS_API_KEY: str = "change-me-to-a-strong-random-key"
    MED_ACCESS_JWT_SECRET: str = "change-me-jwt-secret-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60

    # Query safety
    MAX_SEARCH_LIMIT: int = 100
    DEFAULT_SEARCH_LIMIT: int = 25

    # Logging
    LOG_LEVEL: str = "INFO"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
