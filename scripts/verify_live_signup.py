"""Resume an interrupted test through a real OTP; all secrets stay in memory.

The verified signup session rotates the synthetic account password so a new
runner can log in without recovering the former runner's in-memory password.
No admin credentials, email bypass, or database writes outside Auth are used.
"""
import asyncio
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'apps/api'))
from owl.gateway import supabase
from owl.config import settings


async def main():
    if settings().supabase_url.rstrip('/') != 'https://lwhpwbyfyrxojpbcuyex.supabase.co':
        return 1
    data = json.loads(sys.stdin.read())
    if not isinstance(data.get('code'), str) or not data['code'].isdigit():
        return 1
    result = await supabase('POST', '/auth/v1/verify', body={
        'email': data['email'], 'token': data['code'], 'type': 'signup',
    })
    user = result.get('user', {})
    if (user.get('email', '').lower() != data['email'].lower() or
            not user.get('email_confirmed_at')):
        return 1
    await supabase('PUT', '/auth/v1/user', result['access_token'],
                   {'password': data['password']})
    await supabase('POST', '/auth/v1/logout?scope=local', result['access_token'], {})
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(asyncio.run(main()))
    except Exception:
        # Never print exception context, provider responses, or input values.
        raise SystemExit(1) from None
