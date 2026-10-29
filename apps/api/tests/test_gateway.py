from unittest.mock import patch
import httpx
import pytest
from fastapi import HTTPException
from owl.config import Settings
from owl.gateway import supabase
import asyncio


def run_with_response(response, token=None):
    async_client=httpx.AsyncClient
    transport=httpx.MockTransport(lambda request: response)
    with patch('owl.gateway.settings',return_value=Settings(supabase_anon_key='synthetic-public-key')):
        with patch('owl.gateway.httpx.AsyncClient',side_effect=lambda **kwargs: async_client(transport=transport,**kwargs)):
            return asyncio.run(supabase('GET','/rest/v1/accounts',token))


def test_postgres_numeric_is_preserved_without_float_rounding():
    response=httpx.Response(200,content=b'[{"amount":99999999999999.99}]')
    assert run_with_response(response)[0]['amount']=='99999999999999.99'


def test_provider_internals_are_not_exposed():
    with pytest.raises(HTTPException) as error:
        run_with_response(httpx.Response(500,json={'detail':'SENSITIVE DATABASE INTERNALS'}))
    assert error.value.status_code==502
    assert 'SENSITIVE' not in error.value.detail


def test_anonymous_key_is_not_sent_as_bearer_token():
    seen=[]
    async_client=httpx.AsyncClient
    def respond(request):
        seen.append(request.headers)
        return httpx.Response(200,json=[])
    with patch('owl.gateway.settings',return_value=Settings(supabase_anon_key='synthetic-public-key')):
        with patch('owl.gateway.httpx.AsyncClient',side_effect=lambda **kwargs: async_client(transport=httpx.MockTransport(respond),**kwargs)):
            asyncio.run(supabase('GET','/rest/v1/accounts'))
            asyncio.run(supabase('GET','/rest/v1/accounts','user-jwt'))
    assert 'authorization' not in seen[0]
    assert seen[1]['authorization']=='Bearer user-jwt'
