from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://agent:agent_secret@db:5432/patient_agent"
    ACCESS_FEE_AMOUNT: float = 25.00
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost"]
    BASE_URL: str = "http://localhost:8000"
    AI_LAYER_URL: str = "http://ai-layer:8100"
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "LaunchFlow <onboarding@resend.dev>"
    # Shared passcode gating the researcher dashboard + data-export endpoints.
    # Empty disables researcher access (fail-closed). Set per-environment.
    RESEARCH_ADMIN_PASSCODE: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
