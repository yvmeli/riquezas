from functools import lru_cache
from pathlib import Path
import base64
import json
from urllib.parse import urlsplit
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=Path(__file__).resolve().parents[1] / ".env", extra="ignore", hide_input_in_errors=True)
    supabase_url: str = "http://127.0.0.1:54321"
    supabase_anon_key: str = ""
    frontend_origin: str = "http://localhost:3000"
    admin_origin: str = "http://localhost:3001"
    extra_trusted_origins: str = ""
    public_client_origin: str = ""
    cookie_secure: bool = False
    token_encryption_key: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/gmail/callback"

    @field_validator('extra_trusted_origins', 'public_client_origin')
    @classmethod
    def exact_https_origins(cls, value):
        for item in filter(None, (part.strip() for part in value.split(','))):
            parsed = urlsplit(item)
            if (parsed.scheme != 'https' or not parsed.hostname or parsed.username or
                    parsed.password or parsed.path or parsed.query or parsed.fragment or '*' in item):
                raise ValueError('Solo se admiten orígenes HTTPS exactos, sin rutas ni comodines.')
        return value

    def trusted_origins(self):
        return {self.frontend_origin, self.admin_origin, *filter(None, (p.strip() for p in self.extra_trusted_origins.split(',')))}

    @field_validator('supabase_anon_key')
    @classmethod
    def public_key_only(cls, value):
        value=value.strip()
        privileged=value.startswith('sb_secret_')
        if value.count('.')==2:
            try:
                payload=value.split('.')[1]
                claims=json.loads(base64.urlsafe_b64decode(payload+'='*(-len(payload)%4)))
                privileged=privileged or (isinstance(claims,dict) and claims.get('role')=='service_role')
            except (ValueError,UnicodeError):
                pass
        if privileged:
            raise ValueError('Configura una clave pública o publishable; OWL no requiere service-role para estas operaciones.')
        return value


@lru_cache
def settings() -> Settings:
    return Settings()
