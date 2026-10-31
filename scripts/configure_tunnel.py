"""Configure an explicitly authorized HTTPS development origin; never print secrets."""
import argparse
from pathlib import Path
from urllib.parse import urlsplit
from dotenv import dotenv_values, set_key

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--origin', required=True)
args = parser.parse_args()
url = urlsplit(args.origin)
if (url.scheme != 'https' or not url.hostname or url.path or url.query or url.fragment
        or url.username or url.password or '*' in args.origin or ',' in args.origin):
    raise SystemExit('Se requiere un origen HTTPS exacto autorizado, sin rutas ni comodines.')

for relative, key in [('apps/api/.env', 'EXTRA_TRUSTED_ORIGINS'),
                      ('apps/web/.env.local', 'ADDITIONAL_PUBLIC_ORIGINS')]:
    path = root / relative
    config = dotenv_values(path)
    existing = [s.strip() for s in config.get(key, '').split(',') if s.strip()]
    # Remove previous temporary ngrok origins, which can later belong to someone else.
    existing = [s for s in existing if not (urlsplit(s).hostname or '').endswith('.ngrok-free.app')]
    set_key(str(path), key, ','.join(dict.fromkeys([*existing, args.origin])))
set_key(str(root / 'apps/api/.env'), 'PUBLIC_CLIENT_ORIGIN', args.origin)
print('Origen HTTPS explícito configurado localmente. Reiniciar servidores y actualizar redirects exactos en Supabase/Google según documentación.')
