import asyncio
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

SPEC = importlib.util.spec_from_file_location(
    'live_signup', Path(__file__).resolve().parents[3] / 'scripts/verify_live_signup.py')
live = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(live)


def configure(monkeypatch, response):
    monkeypatch.setattr(live, 'settings', lambda: SimpleNamespace(
        supabase_url='https://lwhpwbyfyrxojpbcuyex.supabase.co'))
    monkeypatch.setattr(live.sys, 'stdin', io.StringIO(json.dumps({
        'email': 'synthetic@example.test', 'code': '11112222',
        'password': 'synthetic-test-password',
    })))
    provider = AsyncMock(return_value=response)
    monkeypatch.setattr(live, 'supabase', provider)
    return provider


@pytest.mark.parametrize('user', [
    {'email': 'other@example.test', 'email_confirmed_at': 'synthetic'},
    {'email': 'synthetic@example.test', 'email_confirmed_at': None},
])
def test_resume_does_not_rotate_password_for_unverified_or_different_user(monkeypatch, user):
    provider = configure(monkeypatch, {'user': user})
    assert asyncio.run(live.main()) == 1
    assert provider.await_count == 1


def test_resume_rotates_only_real_verified_session_and_logs_nothing(monkeypatch, capsys):
    provider = configure(monkeypatch, {
        'access_token': 'synthetic-user-token',
        'user': {'email': 'synthetic@example.test', 'email_confirmed_at': 'synthetic'},
    })
    assert asyncio.run(live.main()) == 0
    assert [call.args[1] for call in provider.await_args_list] == [
        '/auth/v1/verify', '/auth/v1/user', '/auth/v1/logout?scope=local',
    ]
    assert provider.await_args_list[1].args[2] == 'synthetic-user-token'
    captured = capsys.readouterr()
    assert captured.out == captured.err == ''


def test_resume_refuses_different_project_before_auth_request(monkeypatch):
    provider = configure(monkeypatch, {})
    monkeypatch.setattr(live, 'settings', lambda: SimpleNamespace(
        supabase_url='https://different-project.example.test'))
    assert asyncio.run(live.main()) == 1
    provider.assert_not_awaited()
