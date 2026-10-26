"""Tests for client key authentication verification and endpoint security."""

from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_auth_fails_closed_when_no_key_configured(client):
    """When RAG_CLIENT_KEY is empty/unset, requests fail closed with 503 Service Unavailable."""
    with patch("app.main.get_settings") as mock_settings:
        mock_settings.return_value = Settings(rag_client_key=None)
        response = client.post("/api/chat", json={"message": "Hi"})
        assert response.status_code == 503
        assert "Service unavailable" in response.json().get("detail", "")


def test_auth_rejects_missing_key_when_configured(client):
    """When RAG_CLIENT_KEY is configured, requests lacking the key are rejected with 401."""
    with patch("app.main.get_settings") as mock_settings:
        mock_settings.return_value = Settings(rag_client_key="super-secret-gabay-key")
        response = client.post("/api/chat", json={"message": "Hi"})
        assert response.status_code == 401
        assert "Unauthorized" in response.json().get("detail", "")


def test_auth_rejects_invalid_key_when_configured(client):
    """When RAG_CLIENT_KEY is configured, requests with wrong key are rejected with 401."""
    with patch("app.main.get_settings") as mock_settings:
        mock_settings.return_value = Settings(rag_client_key="super-secret-gabay-key")
        response = client.post(
            "/api/chat",
            json={"message": "Hi"},
            headers={"X-Gabay-Client-Key": "wrong-key"},
        )
        assert response.status_code == 401


def test_auth_accepts_valid_header_key(client):
    """When RAG_CLIENT_KEY is configured, requests with matching X-Gabay-Client-Key pass."""
    with patch("app.main.get_settings") as mock_settings:
        mock_settings.return_value = Settings(rag_client_key="super-secret-gabay-key")
        with patch("app.main.rag_graph.ainvoke") as mock_ainvoke:
            mock_ainvoke.return_value = {"reply": "Authorized", "category": "student_support", "sources": []}
            response = client.post(
                "/api/chat",
                json={"message": "Hi"},
                headers={"X-Gabay-Client-Key": "super-secret-gabay-key"},
            )
            assert response.status_code == 200
            assert response.json()["reply"] == "Authorized"


def test_auth_accepts_valid_bearer_token(client):
    """When RAG_CLIENT_KEY is configured, requests with matching Authorization: Bearer pass."""
    with patch("app.main.get_settings") as mock_settings:
        mock_settings.return_value = Settings(rag_client_key="super-secret-gabay-key")
        with patch("app.main.rag_graph.ainvoke") as mock_ainvoke:
            mock_ainvoke.return_value = {"reply": "Authorized", "category": "student_support", "sources": []}
            response = client.post(
                "/api/chat",
                json={"message": "Hi"},
                headers={"Authorization": "Bearer super-secret-gabay-key"},
            )
            assert response.status_code == 200


def test_activation_email_requires_auth(client):
    """POST /api/auth/send-activation-email rejects unauthenticated requests."""
    with patch("app.main.get_settings") as mock_settings:
        mock_settings.return_value = Settings(rag_client_key="super-secret-gabay-key")
        response = client.post(
            "/api/auth/send-activation-email",
            json={"email": "student@dmmmsu.edu.ph", "activation_url": "http://localhost:5173/activate"},
        )
        assert response.status_code == 401


def test_leadership_code_requires_auth(client):
    """POST /api/auth/send-leadership-code rejects unauthenticated requests."""
    with patch("app.main.get_settings") as mock_settings:
        mock_settings.return_value = Settings(rag_client_key="super-secret-gabay-key")
        response = client.post(
            "/api/auth/send-leadership-code",
            json={"email": "dean@dmmmsu.edu.ph", "role_type": "dean"},
        )
        assert response.status_code == 401


def test_leadership_code_send_and_verify_flow(client):
    """Authenticated flow: sending generates server code and verify accepts it."""
    with patch("app.main.get_settings") as mock_settings:
        mock_settings.return_value = Settings(rag_client_key="super-secret-gabay-key")
        with patch("app.main.send_leadership_code_email") as mock_email:
            mock_email.return_value = {"success": True, "delivered": False, "simulated": True}
            
            # Send leadership code
            headers = {"X-Gabay-Client-Key": "super-secret-gabay-key"}
            send_res = client.post(
                "/api/auth/send-leadership-code",
                json={"email": "dean.test@dmmmsu.edu.ph", "role_type": "dean", "unit_name": "CCS"},
                headers=headers,
            )
            assert send_res.status_code == 200
            assert "code" not in send_res.json() or send_res.json()["code"] is None
            
            # Email function was called with generated 6-digit code
            assert mock_email.called
            generated_code = mock_email.call_args[1]["code"]
            assert len(generated_code) == 6
            
            # Verify code endpoint
            verify_res = client.post(
                "/api/auth/verify-leadership-code",
                json={"email": "dean.test@dmmmsu.edu.ph", "code": generated_code},
                headers=headers,
            )
            assert verify_res.status_code == 200
            assert verify_res.json()["success"] is True
