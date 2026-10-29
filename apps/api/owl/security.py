from collections import defaultdict, deque
from time import monotonic
from fastapi import Depends, HTTPException, Request
from .gateway import supabase


class RateLimiter:
    """Single-process development limiter; deploy behind a shared gateway limiter."""
    def __init__(self):
        self.windows = defaultdict(deque)

    def check(self, key, limit, seconds):
        now = monotonic()
        if len(self.windows) > 10000:
            for item in list(self.windows):
                if not self.windows[item] or self.windows[item][-1] <= now - 3600:
                    del self.windows[item]
            if len(self.windows) > 10000 and key not in self.windows:
                raise HTTPException(429, 'Demasiadas solicitudes. Intenta más tarde.')
        queue = self.windows[key]
        while queue and queue[0] <= now - seconds:
            queue.popleft()
        if len(queue) >= limit:
            raise HTTPException(429, 'Demasiados intentos. Intenta más tarde.')
        queue.append(now)


limiter = RateLimiter()


async def current_user(request: Request):
    token = request.cookies.get('owl_access')
    if not token:
        raise HTTPException(401, 'Inicia sesión para continuar.')
    user = await supabase('GET', '/auth/v1/user', token)
    if not user.get('email_confirmed_at'):
        raise HTTPException(403, 'Verifica tu correo para continuar.')
    return {'id': user['id'], 'email': user.get('email'), 'token': token}


async def administrator(user=Depends(current_user)):
    roles = await supabase('GET', '/rest/v1/admin_roles?select=role', user['token'])
    if not roles:
        raise HTTPException(403, 'Se requiere un rol administrativo.')
    return {**user, 'role': roles[0]['role']}
