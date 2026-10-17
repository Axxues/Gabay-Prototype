"""Tests for in-memory client IP rate limiting."""

from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient

from app.core.rate_limit import RateLimiterMiddleware
from app.main import app


@pytest.fixture
def client():
    return TestClient(app)


def test_health_check_bypasses_rate_limiting(client):
    """Verify keep-alive /health endpoint is never blocked by rate limiting."""
    for _ in range(50):
        response = client.get("/health")
        assert response.status_code == 200


def test_rate_limiter_blocks_burst_traffic(client):
    """Verify client sending excessive requests is rate limited with HTTP 429."""
    from app.core.rate_limit import rate_limiter

    rate_limiter.reset()

    with patch("app.main.rag_graph.ainvoke") as mock_ainvoke:
        mock_ainvoke.return_value = {
            "reply": "Ok",
            "category": "student_support",
            "sources": [],
        }

        # Send up to limit (e.g., 30 requests should succeed)
        for _ in range(30):
            res = client.post("/api/chat", json={"message": "Ping"})
            assert res.status_code == 200

        # Request 31 should be rejected with 429 Too Many Requests
        rejected_res = client.post("/api/chat", json={"message": "Burst query"})
        assert rejected_res.status_code == 429
        assert "Rate limit exceeded" in rejected_res.json().get("detail", "")
        assert "retry-after" in rejected_res.headers
