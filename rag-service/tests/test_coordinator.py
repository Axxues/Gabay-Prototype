"""Unit and mock tests for Coordinator Agent intent classification and routing."""

import json
import pytest
from unittest.mock import MagicMock, patch

from app.core.domains import DOMAINS_REGISTRY, get_under_development_notice
from app.agents.coordinator import (
    OUT_OF_SCOPE_REPLY,
    classify_intent,
    get_groq_router,
)


def _mock_groq_completion(category: str, reasoning: str = "Test routing") -> MagicMock:
    """Helper creating a mock Groq ChatCompletion returning a JSON string."""
    mock_resp = MagicMock()
    content = json.dumps({"category": category, "reasoning": reasoning})
    mock_resp.choices = [
        MagicMock(message=MagicMock(content=content))
    ]
    return mock_resp


class TestCoordinatorAgent:
    """Test suite for Coordinator Agent intent classification and guardrails."""

    @patch("app.agents.coordinator.get_groq_router")
    def test_out_of_scope_query_rejection(self, mock_get_router):
        """Verify out-of-scope queries (e.g., cooking recipes) return OUT_OF_SCOPE and rejection message."""
        mock_router = MagicMock()
        mock_router.chat.completions.create.return_value = _mock_groq_completion("OUT_OF_SCOPE")
        mock_get_router.return_value = mock_router

        result = classify_intent(
            message="How do I bake a chocolate cake from scratch?",
            student_name="Alice",
            active_course="CS101",
        )

        assert result["category"] == "OUT_OF_SCOPE"
        assert result["direct_reply"] == OUT_OF_SCOPE_REPLY
        assert "academic" in result["direct_reply"].lower()
        assert result["student_name"] == "Alice"
        assert result["active_course"] == "CS101"

    @patch("app.agents.coordinator.get_groq_router")
    def test_active_domain_curriculum_and_instruction(self, mock_get_router):
        """Verify active curriculum query routes properly with direct_reply=None."""
        mock_router = MagicMock()
        mock_router.chat.completions.create.return_value = _mock_groq_completion("curriculum_and_instruction")
        mock_get_router.return_value = mock_router

        result = classify_intent(
            message="What topics are covered in Week 4 of Data Structures?",
            student_name="Bob",
            active_course="CS201",
        )

        assert result["category"] == "curriculum_and_instruction"
        assert result["direct_reply"] is None
        assert result["student_name"] == "Bob"
        assert result["active_course"] == "CS201"

    @patch("app.agents.coordinator.get_groq_router")
    def test_active_domain_faculty(self, mock_get_router):
        """Verify faculty query routes to faculty domain with direct_reply=None."""
        mock_router = MagicMock()
        mock_router.chat.completions.create.return_value = _mock_groq_completion("faculty")
        mock_get_router.return_value = mock_router

        result = classify_intent(
            message="Who teaches Software Engineering this semester?",
        )

        assert result["category"] == "faculty"
        assert result["direct_reply"] is None
        assert result["student_name"] is None
        assert result["active_course"] is None

    @patch("app.agents.coordinator.get_groq_router")
    def test_active_domain_student_support(self, mock_get_router):
        """Verify student support queries route to student_support with direct_reply=None."""
        mock_router = MagicMock()
        mock_router.chat.completions.create.return_value = _mock_groq_completion("student_support")
        mock_get_router.return_value = mock_router

        result = classify_intent(
            message="What is the policy for dropping a subject after midterm?",
            student_name="Charlie",
        )

        assert result["category"] == "student_support"
        assert result["direct_reply"] is None
        assert result["student_name"] == "Charlie"
        assert result["active_course"] is None

    @patch("app.agents.coordinator.get_groq_router")
    def test_under_development_research(self, mock_get_router):
        """Verify under-development research domain returns official notice."""
        mock_router = MagicMock()
        mock_router.chat.completions.create.return_value = _mock_groq_completion("research")
        mock_get_router.return_value = mock_router

        result = classify_intent(
            message="Where can I find published research papers and faculty theses?",
        )

        assert result["category"] == "research"
        assert result["direct_reply"] == get_under_development_notice("research")
        assert "research module is currently under development" in result["direct_reply"].lower()

    @patch("app.agents.coordinator.get_groq_router")
    def test_under_development_extension(self, mock_get_router):
        """Verify under-development extension domain returns official notice."""
        mock_router = MagicMock()
        mock_router.chat.completions.create.return_value = _mock_groq_completion("extension")
        mock_get_router.return_value = mock_router

        result = classify_intent(
            message="Are there any community outreach or extension programs available?",
        )

        assert result["category"] == "extension"
        assert result["direct_reply"] == get_under_development_notice("extension")
        assert "extension module is currently under development" in result["direct_reply"].lower()

    @patch("app.agents.coordinator.get_groq_router")
    def test_under_development_quality_assurance(self, mock_get_router):
        """Verify under-development QA domain returns official notice."""
        mock_router = MagicMock()
        mock_router.chat.completions.create.return_value = _mock_groq_completion("quality_assurance")
        mock_get_router.return_value = mock_router

        result = classify_intent(
            message="What are the university QA accreditation metrics for this year?",
        )

        assert result["category"] == "quality_assurance"
        assert result["direct_reply"] == get_under_development_notice("quality_assurance")
        assert "quality assurance module is currently under development" in result["direct_reply"].lower()

    @patch("app.agents.coordinator.get_groq_router")
    def test_under_development_facilities(self, mock_get_router):
        """Verify under-development facilities domain returns official notice."""
        mock_router = MagicMock()
        mock_router.chat.completions.create.return_value = _mock_groq_completion("facilities")
        mock_get_router.return_value = mock_router

        result = classify_intent(
            message="How do I book Computer Lab 4 for student study sessions?",
        )

        assert result["category"] == "facilities"
        assert result["direct_reply"] == get_under_development_notice("facilities")
        assert "facilities module is currently under development" in result["direct_reply"].lower()

    @patch("app.agents.coordinator.get_groq_router")
    def test_groq_router_call_parameters(self, mock_get_router):
        """Verify classify_intent calls Groq with expected model, json mode, and temperature."""
        mock_router = MagicMock()
        mock_router.chat.completions.create.return_value = _mock_groq_completion("curriculum_and_instruction")
        mock_get_router.return_value = mock_router

        classify_intent(
            message="What is the prerequisite for CS 301?",
            student_name="Dan",
            active_course="CS301",
        )

        mock_router.chat.completions.create.assert_called_once()
        _, call_kwargs = mock_router.chat.completions.create.call_args
        assert call_kwargs["model"] == "qwen/qwen3.8-27b"
        assert call_kwargs["temperature"] == 0.0
        assert call_kwargs["response_format"] == {"type": "json_object"}
        assert len(call_kwargs["messages"]) >= 2
        user_msg = call_kwargs["messages"][-1]["content"]
        assert "CS 301" in user_msg
        assert "Dan" in user_msg

    @patch("app.agents.coordinator.get_settings")
    @patch("app.agents.coordinator.Groq")
    def test_get_groq_router_initialization(self, mock_groq_cls, mock_get_settings):
        """Verify get_groq_router initializes Groq client with configured API key."""
        mock_settings = MagicMock()
        mock_settings.groq_api_key = "gsk_test_secret_123"
        mock_get_settings.return_value = mock_settings

        router = get_groq_router()
        mock_groq_cls.assert_called_once_with(api_key="gsk_test_secret_123")
        assert router == mock_groq_cls.return_value

    @patch("app.agents.coordinator.get_groq_router")
    def test_fallback_on_invalid_or_unknown_category(self, mock_get_router):
        """Verify safe fallback when LLM outputs unrecognized category."""
        mock_router = MagicMock()
        mock_router.chat.completions.create.return_value = _mock_groq_completion("quantum_computing_dept")
        mock_get_router.return_value = mock_router

        result = classify_intent(message="Tell me about quantum computing")
        # Should fallback gracefully to student_support or OUT_OF_SCOPE
        assert result["category"] in DOMAINS_REGISTRY or result["category"] == "OUT_OF_SCOPE"

    @patch("app.agents.coordinator.get_groq_router")
    def test_empty_category_response_fallback(self, mock_get_router):
        """Verify fallback to student_support when LLM returns empty category string."""
        mock_router = MagicMock()
        mock_router.chat.completions.create.return_value = _mock_groq_completion("")
        mock_get_router.return_value = mock_router

        result = classify_intent(message="What is the schedule?")
        assert result["category"] == "student_support"

    @patch("app.agents.coordinator.get_groq_router")
    def test_api_exception_fallback(self, mock_get_router):
        """Verify graceful fallback to student_support when Groq API raises an exception."""
        mock_router = MagicMock()
        mock_router.chat.completions.create.side_effect = RuntimeError("Groq rate limit or network error")
        mock_get_router.return_value = mock_router

        result = classify_intent(message=None)
        assert result["category"] == "student_support"
        assert result["direct_reply"] is None

