import httpx
from fastapi import HTTPException
from .config import settings


async def supabase(method: str, path: str, token: str | None = None, body=None):
    cfg = settings()
    if not cfg.supabase_anon_key:
        raise HTTPException(503, "Configura Supabase para habilitar esta función.")
    headers = {"apikey": cfg.supabase_anon_key, "Prefer": "return=representation"}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.request(method, cfg.supabase_url.rstrip("/") + path, headers=headers, json=body)
    except httpx.RequestError:
        raise HTTPException(503, "No se pudo conectar con Supabase.") from None
    if response.is_error:
        # Never forward provider internals, SQL, tokens or personal data.
        detail = "No se pudo completar la operación. Revisa los datos y tus permisos."
        if path.startswith("/auth/"):
            detail = "Solicitud de autenticación rechazada o código vencido."
        code = response.status_code if response.status_code in (400, 401, 403, 409, 422, 429) else 502
        raise HTTPException(code, detail)
    # Preserve PostgreSQL NUMERIC JSON values before any binary float conversion.
    return response.json(parse_float=str) if response.content else None
