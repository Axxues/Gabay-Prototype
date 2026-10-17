"""Tests for optional client key authentication verification."""

from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_auth_permits_when_no_key_configured(client):
    """When RAG_CLIENT_KEY is empty/unset, requests pass through freely without 401."""
    with patch("app.main.get_settings") as mock_settings:
        mock_settings.return_value = Settings(rag_client_key=None)
        with patch("app.main.rag_graph.ainvoke") as mock_ainvoke:
            mock_ainvoke.return_value = {"reply": "Hello", "category": "student_support", "sources": []}
            response = client.post("/api/chat", json={"message": "Hi"})
            assert response.status_code == 200


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
