"""Unit and mock tests for vector store and config services."""

import pytest
from unittest.mock import MagicMock, patch
from upstash_vector.types import QueryResult

from app.core.config import Settings, get_settings
from app.services.vector_store import (
    embed_text,
    get_upstash_index,
    query_vector_store,
    upsert_vector_document,
)


class TestConfig:
    """Test suite for application configuration management."""

    def test_settings_load_fields_and_defaults(self):
        """Verify Settings contains all required fields and default values."""
        settings = Settings(
            gemini_api_key="test-gemini-key",
            upstash_vector_rest_url="https://test-index.upstash.io",
            upstash_vector_rest_token="test-token",
        )
        assert settings.gemini_api_key == "test-gemini-key"
        assert settings.upstash_vector_rest_url == "https://test-index.upstash.io"
        assert settings.upstash_vector_rest_token == "test-token"
        assert settings.port == 8000
        assert settings.groq_api_key is None or isinstance(settings.groq_api_key, str)

    def test_get_settings_caching(self):
        """Verify get_settings returns consistent cached settings instance."""
        s1 = get_settings()
        s2 = get_settings()
        assert s1 is s2


class TestVectorStore:
    """Test suite for Upstash vector store operations and Google Gemini embeddings."""

    @patch("app.services.vector_store.get_embeddings_client")
    def test_embed_text_dimensions(self, mock_get_client):
        """Verify embed_text returns a 768-dimensional float list."""
        mock_client = MagicMock()
        mock_embedding = [0.0123] * 768
        mock_client.embed_query.return_value = mock_embedding
        mock_get_client.return_value = mock_client

        result = embed_text("Gabay LMS Grade Computation Policy")
        assert isinstance(result, list)
        assert len(result) == 768
        assert all(isinstance(v, float) for v in result)
        mock_client.embed_query.assert_called_once_with("Gabay LMS Grade Computation Policy")

    @patch("app.services.vector_store.get_settings")
    @patch("app.services.vector_store.Index")
    def test_get_upstash_index(self, mock_index_cls, mock_get_settings):
        """Verify get_upstash_index initializes Upstash Index with config credentials."""
        mock_get_settings.return_value = Settings(
            gemini_api_key="gem-key",
            upstash_vector_rest_url="https://vector-example.upstash.io",
            upstash_vector_rest_token="sec-token",
        )
        mock_instance = MagicMock()
        mock_index_cls.return_value = mock_instance

        idx = get_upstash_index()
        mock_index_cls.assert_called_once_with(
            url="https://vector-example.upstash.io",
            token="sec-token",
        )
        assert idx == mock_instance

    @patch("app.services.vector_store.embed_text")
    def test_query_vector_store_parses_results(self, mock_embed_text):
        """Verify query_vector_store embeds query and parses Upstash query response."""
        mock_embed_text.return_value = [0.1] * 768
        mock_index = MagicMock()
        mock_index.query.return_value = [
            QueryResult(
                id="doc_1",
                score=0.925,
                metadata={"source": "student_handbook", "title": "Grading System"},
                data="Passing grade requirement is 75%.",
            ),
            QueryResult(
                id="doc_2",
                score=0.840,
                metadata={"source": "student_handbook", "title": "Incomplete Grades"},
                data="Incomplete grades must be resolved within 1 year.",
            ),
        ]

        results = query_vector_store(
            query_text="What is the passing grade?",
            top_k=2,
            index=mock_index,
        )

        mock_embed_text.assert_called_once_with("What is the passing grade?")
        mock_index.query.assert_called_once_with(
            vector=[0.1] * 768,
            top_k=2,
            include_metadata=True,
            include_data=True,
            filter="",
        )

        assert len(results) == 2
        assert results[0] == {
            "text": "Passing grade requirement is 75%.",
            "source": "student_handbook",
            "metadata": {"source": "student_handbook", "title": "Grading System"},
            "score": 0.925,
        }
        assert results[1] == {
            "text": "Incomplete grades must be resolved within 1 year.",
            "source": "student_handbook",
            "metadata": {"source": "student_handbook", "title": "Incomplete Grades"},
            "score": 0.840,
        }

    @patch("app.services.vector_store.embed_text")
    def test_query_vector_store_with_filter(self, mock_embed_text):
        """Verify query_vector_store passes filter string to index query."""
        mock_embed_text.return_value = [0.2] * 768
        mock_index = MagicMock()
        mock_index.query.return_value = []

        results = query_vector_store(
            query_text="Announcements today",
            top_k=5,
            filter_str="source = 'gabay_announcements'",
            index=mock_index,
        )

        mock_index.query.assert_called_once_with(
            vector=[0.2] * 768,
            top_k=5,
            include_metadata=True,
            include_data=True,
            filter="source = 'gabay_announcements'",
        )
        assert results == []

    @patch("app.services.vector_store.embed_text")
    def test_query_vector_store_filters_low_score(self, mock_embed_text):
        """Verify query_vector_store filters out chunks below min_score threshold."""
        mock_embed_text.return_value = [0.1] * 768
        mock_index = MagicMock()
        mock_index.query.return_value = [
            QueryResult(id="doc_1", score=0.85, metadata={"source": "faq"}, data="High relevance text."),
            QueryResult(id="doc_2", score=0.15, metadata={"source": "faq"}, data="Low relevance noise."),
        ]

        results = query_vector_store(
            query_text="Exam schedule",
            top_k=2,
            index=mock_index,
            min_score=0.25,
        )

        assert len(results) == 1
        assert results[0]["score"] == 0.85

    @patch("app.services.vector_store.embed_text")
    def test_query_vector_store_data_fallback_to_metadata(self, mock_embed_text):
        """Verify query_vector_store falls back to metadata['text'] if data is None."""
        mock_embed_text.return_value = [0.3] * 768
        mock_index = MagicMock()
        mock_index.query.return_value = [
            QueryResult(
                id="doc_fallback",
                score=0.88,
                metadata={"source": "faq", "text": "Library hours are 8am to 5pm"},
                data=None,
            )
        ]

        results = query_vector_store("library hours", index=mock_index)
        assert len(results) == 1
        assert results[0]["text"] == "Library hours are 8am to 5pm"
        assert results[0]["source"] == "faq"

    @patch("app.services.vector_store.embed_text")
    def test_upsert_vector_document(self, mock_embed_text):
        """Verify upsert_vector_document embeds text and upserts Vector to index."""
        mock_embed_text.return_value = [0.5] * 768
        mock_index = MagicMock()

        upsert_vector_document(
            doc_id="rule_42",
            text="Academic honesty policy: Plagiarism leads to disciplinary action.",
            metadata={"source": "discipline_code", "section": "4.2"},
            index=mock_index,
        )

        mock_embed_text.assert_called_once_with(
            "Academic honesty policy: Plagiarism leads to disciplinary action."
        )
        mock_index.upsert.assert_called_once()
        call_args, call_kwargs = mock_index.upsert.call_args
        vectors = call_kwargs.get("vectors") or call_args[0]
        assert len(vectors) == 1
        vec = vectors[0]
        # Check either Vector object or dict
        if isinstance(vec, dict):
            assert vec["id"] == "rule_42"
            assert vec["vector"] == [0.5] * 768
            assert vec["metadata"] == {"source": "discipline_code", "section": "4.2"}
            assert vec["data"] == "Academic honesty policy: Plagiarism leads to disciplinary action."
        else:
            assert vec.id == "rule_42"
            assert vec.vector == [0.5] * 768
            assert vec.metadata == {"source": "discipline_code", "section": "4.2"}
            assert vec.data == "Academic honesty policy: Plagiarism leads to disciplinary action."
