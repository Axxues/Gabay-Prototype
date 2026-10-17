"""Tests for CORS origin hardening."""

import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_cors_allows_trusted_origin(client):
    """Verify CORS headers are returned for configured trusted origins."""
    headers = {
        "Origin": "http://localhost:5173",
        "Access-Control-Request-Method": "GET",
    }
    response = client.options("/health", headers=headers)
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_rejects_untrusted_origin(client):
    """Verify CORS headers are omitted for unauthorized external origins."""
    headers = {
        "Origin": "https://malicious-attacker.com",
        "Access-Control-Request-Method": "GET",
    }
    response = client.options("/health", headers=headers)
    # When untrusted, Access-Control-Allow-Origin must not reflect the malicious origin
    allow_origin = response.headers.get("access-control-allow-origin")
    assert allow_origin != "https://malicious-attacker.com"
    assert allow_origin != "*"
