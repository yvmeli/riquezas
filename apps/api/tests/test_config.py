import base64
import json
import pytest
from pydantic import ValidationError
from owl.config import Settings


def test_secret_key_is_rejected_without_leaking_its_value():
    secret='sb_'+'secret_'+'SYNTHETIC'*4
    with pytest.raises(ValidationError) as error:
        Settings(supabase_anon_key=secret)
    assert secret not in str(error.value)
    assert 'input_value' not in str(error.value)


def test_legacy_service_role_key_is_rejected():
    payload=base64.urlsafe_b64encode(json.dumps({'role':'service_role'}).encode()).decode().rstrip('=')
    secret='.'.join(['synthetic-header',payload,'synthetic-signature'])
    with pytest.raises(ValidationError) as error:
        Settings(supabase_anon_key=secret)
    assert secret not in str(error.value)


def test_publishable_and_legacy_anon_keys_are_compatible():
    assert Settings(supabase_anon_key=' synthetic-public-key ').supabase_anon_key=='synthetic-public-key'
    payload=base64.urlsafe_b64encode(json.dumps({'role':'anon'}).encode()).decode().rstrip('=')
    value='.'.join(['synthetic-header',payload,'synthetic-signature'])
    assert Settings(supabase_anon_key=value).supabase_anon_key==value


@pytest.mark.parametrize('origin', ['*', 'https://*.example.test', 'https://example.test/path', 'http://example.test', 'https://user:password@example.test'])
def test_extra_origins_reject_wildcards_paths_and_insecure_domains(origin):
    with pytest.raises(ValidationError):
        Settings(extra_trusted_origins=origin)


def test_extra_origin_keeps_local_origins_without_accepting_other_hosts():
    config=Settings(extra_trusted_origins='https://synthetic.ngrok-free.app')
    assert 'http://localhost:3000' in config.trusted_origins()
    assert 'https://synthetic.ngrok-free.app' in config.trusted_origins()
    assert 'https://other.ngrok-free.app' not in config.trusted_origins()
