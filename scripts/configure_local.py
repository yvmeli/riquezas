"""Populate known local settings without printing or overwriting credentials."""
from pathlib import Path
import secrets
import base64
import re

ROOT = Path(__file__).resolve().parents[1]
API_ENV = ROOT / 'apps/api/.env'
WEB_ENV = ROOT / 'apps/web/.env.local'


def update(path, values, *, only_missing=()):
    text = path.read_text(encoding='utf-8-sig') if path.exists() else ''
    changed = []
    for key, value in values.items():
        match = re.search(rf'^{re.escape(key)}=(.*)$', text, flags=re.M)
        if match and key in only_missing and match.group(1).strip().strip('\"\''):
            continue
        if match:
            text = text[:match.start()] + f'{key}={value}' + text[match.end():]
        else:
            text = text.rstrip() + f'\n{key}={value}\n'
        changed.append(key)
    path.write_text(text.lstrip(), encoding='utf-8')
    print(f'{path.relative_to(ROOT)}: campos configurados: {", ".join(changed) or "sin cambios"}. Valores sensibles ocultos.')


if __name__ == '__main__':
    update(API_ENV, {
        'SUPABASE_URL': 'https://lwhpwbyfyrxojpbcuyex.supabase.co',
        'FRONTEND_ORIGIN': 'http://localhost:3000',
        'ADMIN_ORIGIN': 'http://localhost:3001',
        'COOKIE_SECURE': 'false',
        'GOOGLE_REDIRECT_URI': 'http://localhost:8000/gmail/callback',
        'TOKEN_ENCRYPTION_KEY': base64.urlsafe_b64encode(secrets.token_bytes(32)).decode(),
    }, only_missing=('TOKEN_ENCRYPTION_KEY',))
    update(WEB_ENV, {'API_URL': 'http://127.0.0.1:8000', 'PUBLIC_ORIGIN': 'http://localhost:3000', 'PORTAL_MODE': 'client'})
