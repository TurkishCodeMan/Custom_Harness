from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    MODEL_NAME: str = "google/siglip2-base-patch16-224"
    POSTGRES_HOST: str = "ecp-postgres"
    POSTGRES_PORT: str = "5432"
    POSTGRES_DB: str = "ecp_db"
    POSTGRES_USER: str = "ecp_user"
    POSTGRES_PASSWORD: str = "ecp_pass"

    model_config = SettingsConfigDict(extra="ignore")

config = Settings()
