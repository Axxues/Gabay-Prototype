import os
import pytest
from fastapi.testclient import TestClient

os.environ["RAG_CLIENT_KEY"] = "test-client-key"


@pytest.fixture(autouse=True)
def setup_test_env(monkeypatch):
    monkeypatch.setenv("RAG_CLIENT_KEY", "test-client-key")
    from app.core.config import get_settings
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def client():
    from app.main import app
    return TestClient(app, headers={"X-Gabay-Client-Key": "test-client-key"})
