"""Tests for request payload bounds and input validation hardening."""

from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_payload_rejects_oversized_message(client):
    """Verify API rejects messages exceeding 2000 characters with 422."""
    huge_message = "A" * 2001
    response = client.post("/api/chat", json={"message": huge_message})
    assert response.status_code == 422
    assert "message" in str(response.json())


def test_payload_rejects_excessive_history(client):
    """Verify API rejects history arrays exceeding 20 items with 422."""
    large_history = [{"role": "user", "content": f"Turn {i}"} for i in range(21)]
    response = client.post(
        "/api/chat",
        json={"message": "Valid question", "history": large_history},
    )
    assert response.status_code == 422
    assert "history" in str(response.json())


def test_payload_rejects_oversized_student_name(client):
    """Verify API rejects student_name exceeding 100 characters with 422."""
    huge_name = "N" * 101
    response = client.post(
        "/api/chat",
        json={"message": "Valid question", "student_name": huge_name},
    )
    assert response.status_code == 422
    assert "student_name" in str(response.json())


def test_payload_rejects_oversized_active_course(client):
    """Verify API rejects active_course exceeding 50 characters with 422."""
    huge_course = "C" * 51
    response = client.post(
        "/api/chat",
        json={"message": "Valid question", "active_course": huge_course},
    )
    assert response.status_code == 422
    assert "active_course" in str(response.json())


@patch("app.main.rag_graph.ainvoke")
def test_payload_accepts_valid_bounded_request(mock_ainvoke, client):
    """Verify API accepts compliant bounded payloads with 200."""
    mock_ainvoke.return_value = {
        "reply": "Valid response",
        "category": "student_support",
        "sources": [],
    }
    response = client.post(
        "/api/chat",
        json={
            "message": "Valid bounded question",
            "student_name": "Maria",
            "active_course": "CMSC131",
            "history": [{"role": "user", "content": "Hello"}],
        },
    )
    assert response.status_code == 200
