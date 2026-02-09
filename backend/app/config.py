from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "FamilyVault"
    DEBUG: bool = False

    # Database
    DATABASE_URL: str = "postgresql://familyvault:familyvault@localhost:5432/familyvault"

    # Auth
    SECRET_KEY: str = "change-me-in-production"
    SESSION_EXPIRY_HOURS: int = 72

    # S3 / MinIO
    S3_ENDPOINT_URL: str = "http://localhost:9000"
    S3_ACCESS_KEY: str = "minioadmin"
    S3_SECRET_KEY: str = "minioadmin"
    S3_BUCKET: str = "familyvault"
    S3_REGION: str = "us-east-1"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # SMTP (leave SMTP_HOST empty to disable email)
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "noreply@familyvault.local"
    SMTP_USE_TLS: bool = True

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
