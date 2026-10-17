"""Integration tests for the /api/chat endpoint in FastAPI."""

import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient

from app.core.domains import DOMAINS_REGISTRY
from app.main import app


@pytest.fixture
def client():
    """Create a FastAPI TestClient."""
    return TestClient(app)


def test_chat_endpoint_missing_message(client):
    """Verify endpoint rejects requests missing the required message field with 422."""
    response = client.post("/api/chat", json={})
    assert response.status_code == 422


@patch("app.main.rag_graph.ainvoke")
def test_chat_endpoint_active_query(mock_ainvoke, client):
    """Verify endpoint delegates to rag_graph and formats ChatResponse contract."""
    mock_ainvoke.return_value = {
        "reply": "Hello Maria, the prerequisite is CMSC 12. [Curriculum Guide]",
        "category": "curriculum_and_instruction",
        "sources": [{"title": "Curriculum Guide", "source": "Curriculum Guide"}],
    }

    payload = {
        "message": "What is the prerequisite for CMSC 21?",
        "student_name": "Maria",
        "active_course": "CMSC21",
        "history": [{"role": "user", "content": "Hi"}],
    }

    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "reply" in data
    assert "category" in data
    assert "sources" in data
    assert data["category"] == "curriculum_and_instruction"
    assert "Maria" in data["reply"]
    assert len(data["sources"]) == 1
    assert data["sources"][0]["title"] == "Curriculum Guide"

    mock_ainvoke.assert_called_once_with({
        "message": "What is the prerequisite for CMSC 21?",
        "student_name": "Maria",
        "active_course": "CMSC21",
        "history": [{"role": "user", "content": "Hi"}],
    })


@patch("app.main.rag_graph.ainvoke")
def test_chat_endpoint_out_of_scope(mock_ainvoke, client):
    """Verify endpoint returns rejection contract for out-of-scope non-academic query."""
    mock_ainvoke.return_value = {
        "reply": "I am Gabay, your official university academic assistant...",
        "category": "OUT_OF_SCOPE",
        "sources": [],
    }

    payload = {"message": "Tell me a joke about dogs"}
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["category"] == "OUT_OF_SCOPE"
    assert data["sources"] == []
    assert "official university academic assistant" in data["reply"]


@patch("app.main.rag_graph.ainvoke")
def test_chat_endpoint_under_development(mock_ainvoke, client):
    """Verify endpoint returns under-development notice for unintegrated domains."""
    notice = DOMAINS_REGISTRY["facilities"].notice
    mock_ainvoke.return_value = {
        "reply": notice,
        "category": "facilities",
        "sources": [],
    }

    payload = {"message": "Is the library open at night?"}
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["category"] == "facilities"
    assert "under development" in data["reply"]
    assert data["sources"] == []


@patch("app.agents.graph.classify_intent")
@patch("app.agents.graph.query_vector_store")
@patch("app.agents.graph.get_gemini_synthesizer")
def test_chat_endpoint_e2e_integration(mock_llm, mock_vector, mock_router, client):
    """Verify end-to-end flow through the actual compiled graph from the HTTP endpoint."""
    mock_router.return_value = {
        "category": "student_support",
        "direct_reply": None,
    }
    mock_vector.return_value = [
        {
            "text": "Academic probation applies if GPA falls below 2.0.",
            "source": "Student Handbook",
            "metadata": {"title": "Academic Standing", "source": "Student Handbook"},
            "score": 0.88,
        }
    ]
    mock_llm.return_value.ainvoke.return_value.content = (
        "Hello Carlos, academic probation applies if your GPA falls below 2.0. [Academic Standing / Student Handbook]"
    )

    response = client.post("/api/chat", json={
        "message": "What is the rule on academic probation?",
        "student_name": "Carlos",
    })

    assert response.status_code == 200
    data = response.json()
    assert data["category"] == "student_support"
    assert "Carlos" in data["reply"]
    assert len(data["sources"]) == 1
    assert data["sources"][0]["source"] == "Student Handbook"
