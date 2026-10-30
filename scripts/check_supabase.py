"""Read-only connectivity probe. Output contains no credentials or user records."""
import asyncio
import json
from pathlib import Path
import sys
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'apps/api'))
import httpx
from owl.config import settings

ROOT = Path(__file__).resolve().parents[1]


async def main():
    cfg = settings()
    project = urlparse(cfg.supabase_url)
    if project.hostname != 'lwhpwbyfyrxojpbcuyex.supabase.co' or project.scheme != 'https':
        raise SystemExit('El diagnóstico remoto solo está autorizado para el proyecto indicado de OWL.')
    report = {'project_ref': 'lwhpwbyfyrxojpbcuyex', 'public_key_configured': bool(cfg.supabase_anon_key),
              'local_token_encryption_configured': bool(cfg.token_encryption_key), 'checks': {}}
    headers = {'apikey': cfg.supabase_anon_key} if cfg.supabase_anon_key else {}
    try:
        async with httpx.AsyncClient(timeout=12, follow_redirects=False) as client:
            response = await client.get(cfg.supabase_url + '/auth/v1/settings', headers=headers)
            report['checks']['auth_http_status'] = response.status_code
            report['network_reachable'] = True
            if response.status_code == 200:
                data = response.json()
                report['checks']['email_enabled'] = data.get('external', {}).get('email')
                report['checks']['signup_disabled'] = data.get('disable_signup')
                report['checks']['email_autoconfirm'] = data.get('mailer_autoconfirm')
            if cfg.supabase_anon_key:
                response = await client.get(cfg.supabase_url + '/rest/v1/profiles?select=id&limit=0', headers=headers)
                report['checks']['profiles_anonymous_http_status'] = response.status_code
    except httpx.RequestError:
        report['network_reachable'] = False
        report['blocker'] = 'network_access'
    if not cfg.supabase_anon_key:
        report['blocker'] = report.get('blocker', 'missing_public_key')
    path = ROOT / '.local/supabase-readiness.json'
    path.parent.mkdir(exist_ok=True)
    path.write_text(json.dumps(report, indent=2), encoding='utf-8')
    print(json.dumps(report, indent=2))
    return 1 if report.get('blocker') == 'network_access' else 0


if __name__ == '__main__':
    raise SystemExit(asyncio.run(main()))
