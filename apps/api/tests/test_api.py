from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock
from uuid import uuid4
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from owl.main import app
from owl.security import limiter

ORIGIN={'Origin':'http://localhost:3000'}
USER={'id':str(uuid4()),'email':'synthetic@example.com','email_confirmed_at':'2026-10-28T00:00:00Z'}


@pytest.fixture
def client():
    limiter.windows.clear()
    with TestClient(app) as client:
        yield client


@pytest.fixture
def provider(monkeypatch):
    mock=AsyncMock()
    monkeypatch.setattr('owl.main.supabase',mock)
    monkeypatch.setattr('owl.security.supabase',mock)
    return mock


def test_health_does_not_claim_integrations_work(client):
    data=client.get('/health').json()
    assert data['gmail_configured'] is False
    assert data['bank_parsers_verified'] is False


@pytest.mark.parametrize('origin',[None,'https://evil.example','null'])
def test_mutations_require_trusted_origin(client,provider,origin):
    response=client.post('/auth/login',headers={'Origin':origin} if origin else {},json={})
    assert response.status_code==403
    provider.assert_not_called()


def test_registration_requires_terms_and_safe_validation(client):
    response=client.post('/auth/register',headers=ORIGIN,json={'email':'wrong','password':'VERY_PRIVATE','accepted_terms':False})
    assert response.status_code==422
    assert 'VERY_PRIVATE' not in response.text
    assert 'input' not in response.json()


def test_registration_sends_profile_metadata_and_never_returns_tokens(client,provider):
    provider.return_value={'access_token':'hidden'}
    response=client.post('/auth/register',headers=ORIGIN,json={'email':'synthetic@example.com','password':'test-password-long','first_name':'Persona','last_name':'Sintética','accepted_terms':True})
    assert response.status_code==202
    assert 'hidden' not in response.text
    assert provider.call_args.kwargs['body']['data']['accepted_terms'] is True


def test_login_uses_httponly_cookies_and_does_not_expose_tokens(client,provider):
    provider.return_value={'access_token':'access-secret','refresh_token':'refresh-secret','expires_in':3600}
    response=client.post('/auth/login',headers=ORIGIN,json={'email':'synthetic@example.com','password':'test-password-long'})
    assert response.status_code==200
    cookies=response.headers.get_list('set-cookie')
    assert len(cookies)==2
    assert all('HttpOnly' in value and 'SameSite=lax' in value for value in cookies)
    assert 'secret' not in response.text


def test_verification_ends_temporary_session_and_requires_login(client,provider):
    provider.side_effect=[{'access_token':'verified-token','refresh_token':'refresh'},None]
    response=client.post('/auth/verify',headers=ORIGIN,json={'email':'synthetic@example.com','code':'123456'})
    assert response.status_code==200
    assert provider.call_args_list[0].kwargs['body']['type']=='signup'
    assert provider.call_args_list[1].args[1]=='/auth/v1/logout'
    assert all('Max-Age=0' in c for c in response.headers.get_list('set-cookie'))


def test_otp_attempt_limit_is_per_email_even_across_ips(client,provider):
    provider.side_effect=HTTPException(400,'Código inválido')
    body={'email':'synthetic@example.com','code':'123456'}
    for _ in range(5):
        assert client.post('/auth/verify',headers=ORIGIN,json=body).status_code==400
    assert client.post('/auth/verify',headers=ORIGIN,json=body).status_code==429
    assert provider.call_count==5


def test_recovery_verification_creates_cookie_session(client,provider):
    provider.return_value={'access_token':'secret','refresh_token':'refresh'}
    response=client.post('/auth/verify',headers=ORIGIN,json={'email':'synthetic@example.com','code':'123456','kind':'recovery'})
    assert response.status_code==200
    assert len(response.headers.get_list('set-cookie'))==2


def test_logout_expires_cookies(client,provider):
    client.cookies.set('owl_access','access')
    provider.return_value=None
    response=client.post('/auth/logout',headers=ORIGIN,json={})
    assert response.status_code==200
    assert all('Max-Age=0' in cookie for cookie in response.headers.get_list('set-cookie'))


@pytest.mark.parametrize('route',['/me','/accounts','/transactions','/export','/admin/overview'])
def test_financial_endpoints_require_authentication(client,provider,route):
    assert client.get(route).status_code==401
    provider.assert_not_called()


def test_expired_or_unverified_user_is_denied(client,provider):
    client.cookies.set('owl_access','token')
    provider.return_value={**USER,'email_confirmed_at':None}
    assert client.get('/accounts').status_code==403


def test_customer_cannot_access_admin(client,provider):
    client.cookies.set('owl_access','token')
    provider.side_effect=[USER,[]]
    assert client.get('/admin/overview').status_code==403


def test_transaction_uses_user_token_not_privileged_key(client,provider):
    client.cookies.set('owl_access','user-jwt')
    provider.side_effect=[USER,{'id':str(uuid4())}]
    body={'account_id':str(uuid4()),'kind':'expense','amount':'0.10','occurred_on':'2026-10-28','description':'Prueba sintética','idempotency_key':str(uuid4())}
    response=client.post('/transactions',headers=ORIGIN,json=body)
    assert response.status_code==201
    assert provider.call_args.args[2]=='user-jwt'
    assert provider.call_args.args[3]['p']['amount']=='0.10'


def test_appointment_remains_requested_and_does_not_create_user(client,provider):
    provider.return_value=str(uuid4())
    body={'name':'Persona Sintética','email':'synthetic@example.com','phone':'0000000000','modality':'video',
          'preferred_at':(datetime.now(timezone.utc)+timedelta(days=1)).isoformat(),'consent':True}
    response=client.post('/appointments',headers=ORIGIN,json=body)
    assert response.status_code==201
    assert response.json()['status']=='requested'
    assert provider.call_count==1
    assert provider.call_args.args[1]=='/rest/v1/rpc/request_appointment'


def test_appointment_rejects_past_and_naive_times(client,provider):
    base={'name':'Persona Sintética','email':'synthetic@example.com','phone':'0000000000','modality':'video','consent':True}
    for value in ['2020-01-01T10:00:00Z','2030-01-01T10:00:00']:
        assert client.post('/appointments',headers=ORIGIN,json={**base,'preferred_at':value}).status_code==422
    provider.assert_not_called()


def test_onboarding_keeps_same_profile_and_records_choice(client,provider):
    client.cookies.set('owl_access','token')
    provider.side_effect=[USER,[]]
    assert client.put('/onboarding',headers=ORIGIN,json={'template':'budget','methods':['manual']}).status_code==200
    assert provider.call_args.args[3]['onboarding_completed'] is True
    assert USER['id'] in provider.call_args.args[1]


def test_trial_is_not_reset_when_profile_is_loaded(client,provider):
    client.cookies.set('owl_access','token')
    trial={'user_id':USER['id'],'expires_at':'2026-11-01T00:00:00Z'}
    provider.side_effect=[USER,[{'id':USER['id']}],[{'user_id':str(uuid4())},trial]]
    response=client.get('/me')
    assert response.status_code==200
    assert response.json()['trial']==trial
    assert all(call.args[0]=='GET' for call in provider.call_args_list)


def test_delete_requires_explicit_phrase(client,provider):
    client.cookies.set('owl_access','token')
    provider.return_value=USER
    assert client.delete('/data?confirmation=no',headers=ORIGIN).status_code==422
    assert provider.call_count==1


def test_bad_period_is_rejected(client,provider):
    client.cookies.set('owl_access','token')
    provider.return_value=USER
    assert client.get('/dashboard?start=2026-11-01&end=2026-10-01').status_code==422


def test_sensitive_responses_are_not_cached(client):
    response=client.get('/me')
    assert response.headers['cache-control']=='no-store'


def test_account_cannot_inject_user_id(client,provider):
    client.cookies.set('owl_access','token')
    provider.return_value=USER
    response=client.post('/accounts',headers=ORIGIN,json={'name':'Otra','kind':'debit','currency':'DOP','user_id':str(uuid4())})
    assert response.status_code==422


def test_oversized_body_rejected_before_authentication(client,provider):
    response=client.post('/auth/login',headers=ORIGIN,content='x'*33000)
    assert response.status_code==413
    provider.assert_not_called()
