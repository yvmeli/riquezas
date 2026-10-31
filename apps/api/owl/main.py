from datetime import date, datetime, timezone
from typing import Literal
from uuid import UUID
from urllib.parse import urlencode

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .config import settings
from .finance import summarize
from .gateway import supabase
from .models import (Account, Appointment, AppointmentUpdate, Budget, Contribution, Credentials,
                     Email, Goal, Login, Onboarding, Password, Reclassify, Registration,
                     TrialExtension, Verify)
from .models import Transaction
from .models import InvitationCreate, InvitationAccept, InvitationSession, LinkSession, UserAccess
from .security import administrator, current_user, limiter

app = FastAPI(title='OWL API', version='0.1.0', docs_url='/docs', redoc_url=None)


@app.middleware('http')
async def secure_requests(request: Request, call_next):
    if request.method not in ('GET', 'HEAD', 'OPTIONS'):
        if request.headers.get('origin') not in settings().trusted_origins():
            return JSONResponse({'detail': 'Origen no autorizado.'}, status_code=403)
        body = bytearray()
        async for chunk in request.stream():
            body.extend(chunk)
            if len(body) > 32768:
                return JSONResponse({'detail': 'Solicitud demasiado grande.'}, status_code=413)
        request._body = bytes(body)
        try:
            limiter.check((request.client.host if request.client else '', request.url.path), 60, 60)
        except HTTPException as exc:
            return JSONResponse({'detail': exc.detail}, status_code=exc.status_code)
    response = await call_next(request)
    response.headers['Cache-Control'] = 'no-store'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['Referrer-Policy'] = 'no-referrer'
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Pydantic includes original input (possibly passwords) by default. Omit it.
    return JSONResponse({'detail': 'Revisa los campos del formulario.', 'fields': [list(e['loc']) for e in exc.errors()]}, status_code=422)


def json_data(model):
    return model.model_dump(mode='json')


def set_session(response, result):
    for name, value, seconds in [('owl_access', result['access_token'], result.get('expires_in', 3600)),
                                 ('owl_refresh', result['refresh_token'], 30 * 86400)]:
        response.set_cookie(name, value, max_age=seconds, httponly=True, secure=settings().cookie_secure,
                            samesite='lax', path='/')


def clear_session(response):
    for name in ('owl_access', 'owl_refresh'):
        response.delete_cookie(name, path='/', httponly=True, secure=settings().cookie_secure, samesite='lax')


@app.get('/health')
async def health():
    return {'status': 'ok', 'supabase_configured': bool(settings().supabase_anon_key),
            'gmail_configured': False, 'bank_parsers_verified': False}


@app.post('/auth/register', status_code=202)
async def register(data: Registration):
    limiter.check(('signup', str(data.email).lower()), 3, 3600)
    await supabase('POST', '/auth/v1/signup', body={'email': str(data.email), 'password': data.password,
                   'data': {'first_name': data.first_name, 'last_name': data.last_name, 'phone': data.phone,
                            'terms_version': 'mvp-2026-10', 'accepted_terms': True}})
    return {'message': 'Revisa tu correo para verificar la cuenta si corresponde.'}


@app.post('/auth/verify')
async def verify(data: Verify, response: Response):
    limiter.check(('verify', str(data.email).lower()), 5, 600)
    result = await supabase('POST', '/auth/v1/verify', body={'email': str(data.email), 'token': data.code, 'type': data.kind})
    if data.kind in ('recovery', 'email'):
        set_session(response, result)
    else:
        # Verification initializes the trial in Postgres; require explicit password login next.
        await supabase('POST', '/auth/v1/logout?scope=local', result['access_token'], {})
        clear_session(response)
    return {'message': 'Sesión iniciada.' if data.kind == 'email' else 'Correo verificado.' if data.kind == 'signup' else 'Introduce tu nueva contraseña.'}


@app.post('/auth/code', status_code=202)
async def login_code(data: Email, request: Request):
    limiter.check(('login-code', str(data.email).lower()), 1, 60)
    limiter.check(('login-code-hour', str(data.email).lower()), 5, 3600)
    try:
        redirect = request.headers.get('origin', settings().frontend_origin) + '/auth'
        await supabase('POST', '/auth/v1/otp?' + urlencode({'redirect_to': redirect}), body={'email': str(data.email), 'create_user': False})
    except HTTPException as exc:
        if exc.status_code not in (400, 404):
            raise
    return {'message': 'Si tu cuenta existe, recibirás un código. Espera 60 segundos para reenviar.'}


@app.post('/auth/login')
async def login(data: Login, response: Response):
    limiter.check(('login', str(data.email).lower()), 10, 600)
    result = await supabase('POST', '/auth/v1/token?grant_type=password', body=json_data(data))
    set_session(response, result)
    return {'message': 'Sesión iniciada.'}


@app.post('/auth/resend', status_code=202)
async def resend(data: Email):
    limiter.check(('resend', str(data.email).lower()), 1, 60)
    await supabase('POST', '/auth/v1/resend', body={'email': str(data.email), 'type': 'signup'})
    return {'message': 'Si corresponde, recibirás un nuevo código.'}


@app.post('/auth/recover', status_code=202)
async def recover(data: Email):
    limiter.check(('recover', str(data.email).lower()), 1, 60)
    await supabase('POST', '/auth/v1/recover', body=json_data(data))
    return {'message': 'Si corresponde, recibirás un código de recuperación.'}


@app.post('/auth/password')
async def password(data: Password, response: Response, user=Depends(current_user)):
    await supabase('PUT', '/auth/v1/user', user['token'], json_data(data))
    await supabase('POST', '/auth/v1/logout?scope=global', user['token'], {})
    clear_session(response)
    return {'message': 'Contraseña actualizada. Inicia sesión de nuevo.'}


@app.post('/auth/refresh')
async def refresh(request: Request, response: Response):
    token = request.cookies.get('owl_refresh')
    if not token:
        raise HTTPException(401, 'Inicia sesión de nuevo.')
    result = await supabase('POST', '/auth/v1/token?grant_type=refresh_token', body={'refresh_token': token})
    set_session(response, result)
    return {'message': 'Sesión renovada.'}


@app.post('/auth/logout')
async def logout(request: Request, response: Response):
    token = request.cookies.get('owl_access')
    if token:
        try:
            await supabase('POST', '/auth/v1/logout?scope=local', token, {})
        except HTTPException as exc:
            if exc.status_code != 401:
                raise
    clear_session(response)
    return {'message': 'Sesión cerrada.'}


@app.post('/appointments', status_code=201)
async def request_appointment(data: Appointment):
    if data.preferred_at.tzinfo is None or data.preferred_at <= datetime.now(timezone.utc):
        raise HTTPException(422, 'Selecciona un horario futuro con zona horaria.')
    identifier = await supabase('POST', '/rest/v1/rpc/request_appointment', body={'p': json_data(data)})
    return {'id': identifier, 'status': 'requested', 'message': 'Solicitud recibida. El horario está pendiente de confirmación.'}


@app.get('/me')
async def me(user=Depends(current_user)):
    if await supabase('POST', '/rest/v1/rpc/user_is_active', user['token'], {}) is False:
        raise HTTPException(403, 'Tu acceso está desactivado. Contacta con OWL.')
    profile = await supabase('GET', '/rest/v1/profiles?select=*', user['token'])
    trials = await supabase('GET', '/rest/v1/trials?' + urlencode({'select':'*','user_id':'eq.'+user['id']}), user['token'])
    # An admin can read many trials under RLS. Select only their own here.
    trial = next((t for t in trials if t['user_id'] == user['id']), None)
    return {'id': user['id'], 'email': user['email'], 'profile': profile[0] if profile else None, 'trial': trial}


@app.put('/onboarding')
async def onboarding(data: Onboarding, user=Depends(current_user)):
    return await supabase('PATCH', '/rest/v1/profiles?' + urlencode({'id': 'eq.' + user['id']}), user['token'],
                          {**json_data(data), 'onboarding_completed': True})


async def all_rows(table, token):
    rows = []
    offset = 0
    order = 'user_id' if table == 'trials' else 'id'
    while True:
        batch = await supabase('GET', f'/rest/v1/{table}?select=*&order={order}&limit=500&offset={offset}', token)
        rows.extend(batch)
        if len(batch) < 500:
            return rows
        offset += 500


@app.get('/accounts')
async def accounts(user=Depends(current_user)):
    return await all_rows('accounts', user['token'])


@app.post('/accounts', status_code=201)
async def create_account(data: Account, user=Depends(current_user)):
    return await supabase('POST', '/rest/v1/accounts', user['token'], {**json_data(data), 'user_id': user['id']})


@app.get('/transactions')
async def transactions(user=Depends(current_user)):
    return await all_rows('transactions', user['token'])


@app.post('/transactions', status_code=201)
async def create_transaction(data: Transaction, user=Depends(current_user)):
    return await supabase('POST', '/rest/v1/rpc/create_transaction', user['token'], {'p': json_data(data)})


@app.put('/transactions/{identifier}')
async def edit_transaction(identifier: UUID, data: Transaction, user=Depends(current_user)):
    return await supabase('POST', '/rest/v1/rpc/edit_manual', user['token'], {'p_id': str(identifier), 'p': json_data(data)})


@app.delete('/transactions/{identifier}')
async def delete_transaction(identifier: UUID, user=Depends(current_user)):
    await supabase('POST', '/rest/v1/rpc/delete_manual', user['token'], {'p_id': str(identifier)})
    return {'deleted': True}


@app.patch('/transactions/{identifier}/category')
async def reclassify(identifier: UUID, data: Reclassify, user=Depends(current_user)):
    await supabase('POST', '/rest/v1/rpc/reclassify', user['token'], {'p_id': str(identifier), 'p_category': data.category})
    return {'updated': True}


@app.get('/dashboard')
async def dashboard(start: date, end: date, currency: Literal['DOP', 'USD'] = 'DOP',
                    account_id: UUID | None = None, institution: Literal['qik', 'popular', 'other'] | None = None,
                    category: str | None = Query(default=None, max_length=60), user=Depends(current_user)):
    if start > end:
        raise HTTPException(422, 'El inicio debe ser anterior al final.')
    account_rows = await all_rows('accounts', user['token'])
    tx = await all_rows('transactions', user['token'])
    return summarize(account_rows, tx, start.isoformat(), end.isoformat(), currency,
                     str(account_id) if account_id else None, institution, category)


@app.get('/budgets')
async def budgets(user=Depends(current_user)):
    return await all_rows('budgets', user['token'])


@app.post('/budgets', status_code=201)
async def create_budget(data: Budget, user=Depends(current_user)):
    return await supabase('POST', '/rest/v1/budgets', user['token'], {**json_data(data), 'user_id': user['id']})


@app.get('/goals')
async def goals(user=Depends(current_user)):
    return {'goals': await all_rows('goals', user['token']), 'contributions': await all_rows('contributions', user['token'])}


@app.post('/goals', status_code=201)
async def create_goal(data: Goal, user=Depends(current_user)):
    return await supabase('POST', '/rest/v1/goals', user['token'], {**json_data(data), 'user_id': user['id']})


@app.post('/goals/{identifier}/contributions', status_code=201)
async def contribute(identifier: UUID, data: Contribution, user=Depends(current_user)):
    return await supabase('POST', '/rest/v1/contributions', user['token'],
                          {**json_data(data), 'user_id': user['id'], 'goal_id': str(identifier)})


@app.get('/export')
async def export(user=Depends(current_user)):
    result = {table: await all_rows(table, user['token']) for table in ('accounts','transactions','budgets','goals','contributions')}
    return JSONResponse(result, headers={'Content-Disposition': 'attachment; filename="owl-datos.json"'})


@app.delete('/data')
async def delete_data(confirmation: str, user=Depends(current_user)):
    if confirmation != 'ELIMINAR MIS DATOS':
        raise HTTPException(422, 'Escribe ELIMINAR MIS DATOS para confirmar.')
    await supabase('POST', '/rest/v1/rpc/delete_my_data', user['token'], {})
    return {'deleted': True, 'message': 'Se eliminaron los datos financieros. La cuenta y el historial del trial se conservan.'}


@app.get('/integrations')
async def integrations(user=Depends(current_user)):
    return {'gmail': {'enabled': False, 'reason': 'Pendiente de credenciales OAuth y validación de formatos bancarios.'},
            'pdf': {'enabled': False, 'reason': 'No se encontraron muestras de estados Qik o Popular en el contexto.'}}


@app.get('/admin/overview')
async def admin_overview(user=Depends(administrator)):
    return {'role': user['role'], 'trials': await all_rows('trials', user['token']),
            'appointments': await all_rows('appointments', user['token']),
            'audit': await supabase('GET', '/rest/v1/audit_events?select=*&order=id.desc&limit=100', user['token']),
            'settings': await supabase('GET', '/rest/v1/system_settings?select=*', user['token'])}


@app.post('/admin/trials/extend')
async def extend_trial(data: TrialExtension, user=Depends(administrator)):
    await supabase('POST', '/rest/v1/rpc/extend_trial', user['token'],
                   {'p_user_id': str(data.user_id), 'p_days': data.days, 'p_reason': data.reason})
    return {'updated': True}


@app.patch('/admin/appointments/{identifier}')
async def update_appointment(identifier: UUID, data: AppointmentUpdate, user=Depends(administrator)):
    return await supabase('PATCH', f'/rest/v1/appointments?id=eq.{identifier}', user['token'], json_data(data))


@app.put('/admin/trial-duration')
async def trial_duration(days: int = Query(ge=1, le=90), user=Depends(administrator)):
    return await supabase('PATCH', '/rest/v1/system_settings?id=eq.true', user['token'], {'trial_days': days})


async def owner(user=Depends(administrator)):
    if user['role'] != 'owner':
        raise HTTPException(403, 'Se requiere el rol principal.')
    return user


@app.get('/admin/users')
async def managed_users(user=Depends(owner)):
    return await supabase('POST', '/rest/v1/rpc/list_managed_users', user['token'], {})


@app.patch('/admin/users/{identifier}/access')
async def user_access(identifier: UUID, data: UserAccess, user=Depends(owner)):
    await supabase('POST', '/rest/v1/rpc/set_user_access', user['token'],
                   {'p_user_id': str(identifier), 'p_disabled': data.disabled})
    return {'updated': True}


@app.get('/admin/invitations')
async def invitations(user=Depends(owner)):
    return await supabase('GET', '/rest/v1/user_invitations?select=*&order=created_at.desc', user['token'])


async def deliver_invitation(row, token):
    # Auth issues and delivers the one-use proof. OWL never creates/stores that token.
    redirect = (settings().public_client_origin or settings().frontend_origin) + '/invitacion?id=' + row['id']
    try:
        await supabase('POST', '/auth/v1/otp?' + urlencode({'redirect_to': redirect}),
                       body={'email': row['email'], 'create_user': True, 'data': {'owl_invitation': True}})
    except HTTPException:
        await supabase('POST', '/rest/v1/rpc/manage_invitation', token,
                       {'p_id': row['id'], 'p_action': 'failed'})
        return {'id': row['id'], 'delivery_status': 'failed'}
    await supabase('POST', '/rest/v1/rpc/manage_invitation', token,
                   {'p_id': row['id'], 'p_action': 'sent'})
    return {'id': row['id'], 'delivery_status': 'sent'}


@app.post('/admin/invitations', status_code=201)
async def invite(data: InvitationCreate, user=Depends(owner)):
    limiter.check(('invitation', user['id']), 10, 3600)
    row = await supabase('POST', '/rest/v1/rpc/manage_invitation', user['token'],
                         {'p_email': str(data.email).lower(), 'p_role': data.role})
    return await deliver_invitation(row, user['token'])


@app.post('/admin/invitations/{identifier}/resend')
async def resend_invitation(identifier: UUID, user=Depends(owner)):
    limiter.check(('invitation-resend', str(identifier)), 1, 60)
    row = await supabase('POST', '/rest/v1/rpc/manage_invitation', user['token'],
                         {'p_id': str(identifier), 'p_action': 'resend'})
    return await deliver_invitation(row, user['token'])


@app.post('/admin/invitations/{identifier}/revoke')
async def revoke_invitation(identifier: UUID, user=Depends(owner)):
    await supabase('POST', '/rest/v1/rpc/manage_invitation', user['token'],
                   {'p_id': str(identifier), 'p_action': 'revoke'})
    return {'revoked': True}


@app.post('/auth/invitation-session')
async def invitation_session(data: InvitationSession, response: Response):
    limiter.check(('invitation-proof', str(data.invitation_id)), 5, 600)
    result = await supabase('POST', '/auth/v1/verify', body={'token_hash': data.token_hash, 'type': 'email'})
    try:
        await supabase('POST', '/rest/v1/rpc/my_invitation', result['access_token'], {'p_id': str(data.invitation_id)})
    except HTTPException:
        await supabase('POST', '/auth/v1/logout?scope=local', result['access_token'], {})
        raise HTTPException(403, 'La invitación no corresponde a esta cuenta.') from None
    set_session(response, result)
    return {'verified': True}


@app.post('/auth/link-session')
async def link_session(data: LinkSession, response: Response, request: Request):
    limiter.check(('login-link', request.client.host if request.client else ''), 5, 600)
    result = await supabase('POST', '/auth/v1/verify', body={'token_hash': data.token_hash, 'type': 'email'})
    if not await supabase('POST', '/rest/v1/rpc/user_is_active', result['access_token'], {}):
        raise HTTPException(403, 'Acceso desactivado.')
    set_session(response, result)
    return {'verified': True}


@app.get('/invitations/{identifier}')
async def my_invitation(identifier: UUID, user=Depends(current_user)):
    return await supabase('POST', '/rest/v1/rpc/my_invitation', user['token'], {'p_id': str(identifier)})


@app.post('/invitations/{identifier}/accept')
async def accept_invitation(identifier: UUID, data: InvitationAccept, user=Depends(current_user)):
    destination = await supabase('POST', '/rest/v1/rpc/accept_invitation', user['token'],
                                  {'p_id': str(identifier), 'p_terms': data.accepted_terms})
    return {'redirect_to': settings().admin_origin + '/admin' if destination == 'admin' else (settings().public_client_origin or settings().frontend_origin) + '/portal'}
