from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    supabase_url: str = "http://127.0.0.1:54321"
    supabase_anon_key: str = ""
    frontend_origin: str = "http://localhost:3000"
    admin_origin: str = "http://localhost:3001"
    cookie_secure: bool = False
    token_encryption_key: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/gmail/callback"


@lru_cache
def settings() -> Settings:
    return Settings()
