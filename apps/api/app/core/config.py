from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    APP_NAME: str = "ApplyFlow API"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # Web app origin — used for CORS and any server-side redirects
    WEB_APP_URL: str = "http://localhost:3000"

    # CORS — comma-separated list of allowed origins, or parsed from WEB_APP_URL
    # In production set CORS_ORIGINS="https://app.yourdomain.com,https://yourdomain.com"
    CORS_ORIGINS: list[str] = []

    @property
    def allowed_origins(self) -> list[str]:
        """Merge CORS_ORIGINS list with WEB_APP_URL so you never forget to add it."""
        origins = set(self.CORS_ORIGINS)
        origins.add(self.WEB_APP_URL)
        return list(origins)

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/applyflow"

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # Auth
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # AI
    ANTHROPIC_API_KEY: str = ""
    OPENAI_API_KEY: str = ""
    DEFAULT_AI_MODEL: str = "claude-sonnet-4-6"
    FAST_AI_MODEL: str = "claude-haiku-4-5-20251001"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = "whsec_placeholder"
    STRIPE_MONTHLY_PRICE_ID: str = ""
    STRIPE_ANNUAL_PRICE_ID: str = ""


settings = Settings()
