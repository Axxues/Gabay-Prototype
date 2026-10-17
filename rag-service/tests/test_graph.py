"""Unit and integration tests for LangGraph state machine and synthesizer."""

import pytest
from unittest.mock import MagicMock, patch

from app.agents.coordinator import OUT_OF_SCOPE_REPLY
from app.agents.graph import RagState, build_rag_graph
from app.agents.synthesizer import (
    SYNTHESIZER_SYSTEM_PROMPT,
    format_context_docs,
    format_sources,
)


@pytest.mark.asyncio
@patch("app.agents.graph.classify_intent")
@patch("app.agents.graph.query_vector_store")
@patch("app.agents.graph.get_gemini_synthesizer")
async def test_full_graph_active_domain(mock_llm, mock_vector, mock_router):
    """Verify active domain routes through vector store retrieval and Gemini synthesizer."""
    mock_router.return_value = {
        "category": "curriculum_and_instruction",
        "direct_reply": None,
        "student_name": "Alex",
        "active_course": "CMSC131",
    }
    mock_vector.return_value = [
        {
            "text": "The passing grade is 2.50.",
            "source": "CMSC131 Syllabus",
            "metadata": {"title": "Grading Breakdown", "source": "CMSC131 Syllabus"},
            "score": 0.95,
        }
    ]
    mock_llm.return_value.ainvoke.return_value.content = (
        "Hello Alex, the passing grade for CMSC131 is 2.50. [CMSC131 Syllabus / Grading Breakdown]"
    )

    graph = build_rag_graph()
    result = await graph.ainvoke({
        "message": "What is the passing grade?",
        "student_name": "Alex",
        "active_course": "CMSC131",
        "history": [],
    })

    assert result["category"] == "curriculum_and_instruction"
    assert "Alex" in result["reply"]
    assert "2.50" in result["reply"]
    assert len(result["sources"]) == 1
    assert result["sources"][0]["source"] == "CMSC131 Syllabus"
    assert result["sources"][0]["title"] == "Grading Breakdown"

    # Verify vector store was called with curriculum and active course filter
    mock_vector.assert_called_once()
    called_filter = mock_vector.call_args.kwargs.get("filter_str") or mock_vector.call_args[1].get("filter_str")
    assert "category = 'curriculum_and_instruction'" in called_filter
    assert "course_code = 'CMSC131'" in called_filter


@pytest.mark.asyncio
@patch("app.agents.graph.classify_intent")
@patch("app.agents.graph.query_vector_store")
@patch("app.agents.graph.get_gemini_synthesizer")
async def test_full_graph_under_development_stub(mock_llm, mock_vector, mock_router):
    """Verify under-development domain routes directly to direct_reply_node bypassing retrieval."""
    mock_router.return_value = {
        "category": "facilities",
        "direct_reply": None,
    }

    graph = build_rag_graph()
    result = await graph.ainvoke({
        "message": "Where is the computer lab located?",
        "student_name": "Alex",
        "active_course": None,
        "history": [],
    })

    assert result["category"] == "facilities"
    assert "Facilities module is currently under development" in result["reply"]
    assert result["sources"] == []

    # Vector store and LLM synthesizer must NOT be invoked
    mock_vector.assert_not_called()
    mock_llm.assert_not_called()


@pytest.mark.asyncio
@patch("app.agents.graph.classify_intent")
@patch("app.agents.graph.query_vector_store")
@patch("app.agents.graph.get_gemini_synthesizer")
async def test_full_graph_out_of_scope(mock_llm, mock_vector, mock_router):
    """Verify out-of-scope query routes to direct_reply_node and returns standard refusal."""
    mock_router.return_value = {
        "category": "OUT_OF_SCOPE",
        "direct_reply": OUT_OF_SCOPE_REPLY,
    }

    graph = build_rag_graph()
    result = await graph.ainvoke({
        "message": "How do I bake a strawberry cheesecake?",
        "student_name": "Maria",
        "active_course": None,
        "history": [],
    })

    assert result["category"] == "OUT_OF_SCOPE"
    assert result["reply"] == OUT_OF_SCOPE_REPLY
    assert result["sources"] == []

    mock_vector.assert_not_called()
    mock_llm.assert_not_called()


@pytest.mark.asyncio
@patch("app.agents.graph.classify_intent")
@patch("app.agents.graph.query_vector_store")
@patch("app.agents.graph.get_gemini_synthesizer")
async def test_full_graph_active_domain_faculty(mock_llm, mock_vector, mock_router):
    """Verify faculty domain applies category filter without requiring active_course."""
    mock_router.return_value = {
        "category": "faculty",
        "direct_reply": None,
    }
    mock_vector.return_value = [
        {
            "text": "Dr. Santos is the Department Chair of Computer Science.",
            "source": "Faculty Directory",
            "metadata": {"title": "Faculty Directory - CS", "source": "Faculty Directory"},
            "score": 0.91,
        }
    ]
    mock_llm.return_value.ainvoke.return_value.content = (
        "Dr. Santos is the Department Chair of Computer Science. [Faculty Directory - CS]"
    )

    graph = build_rag_graph()
    result = await graph.ainvoke({
        "message": "Who is the chair of CS?",
        "student_name": None,
        "active_course": None,
        "history": [],
    })

    assert result["category"] == "faculty"
    assert "Dr. Santos" in result["reply"]
    assert len(result["sources"]) == 1

    called_filter = mock_vector.call_args.kwargs.get("filter_str") or mock_vector.call_args[1].get("filter_str")
    assert called_filter == "category = 'faculty'"


def test_format_sources_deduplication():
    """Verify format_sources deduplicates documents by (title, source) and extracts metadata."""
    docs = [
        {
            "text": "Doc 1 text",
            "source": "Handbook",
            "metadata": {"title": "Student Code", "source": "Handbook"},
        },
        {
            "text": "Doc 2 text duplicate",
            "source": "Handbook",
            "metadata": {"title": "Student Code", "source": "Handbook"},
        },
        {
            "text": "Doc 3 text unique",
            "source": "Calendar",
            "metadata": {"title": "AY 2026-2027", "source": "Calendar"},
        },
    ]

    sources = format_sources(docs)
    assert len(sources) == 2
    assert sources[0] == {"title": "Student Code", "source": "Handbook"}
    assert sources[1] == {"title": "AY 2026-2027", "source": "Calendar"}


def test_format_context_docs_empty():
    """Verify format_context_docs handles empty retrieved documents gracefully."""
    res = format_context_docs([])
    assert "No reference documents found" in res


@patch("app.agents.graph.query_vector_store")
def test_retriever_node_sanitizes_course_code(mock_vector):
    """Verify retriever_node strips dangerous characters or quotes from active_course."""
    from app.agents.graph import retriever_node

    state = {
        "message": "When is exam?",
        "category": "curriculum_and_instruction",
        "active_course": "CMSC'131; SELECT *",
    }
    retriever_node(state)
    mock_vector.assert_called_once()
    called_filter = mock_vector.call_args.kwargs.get("filter_str") or mock_vector.call_args[1].get("filter_str")
    assert "course_code = 'CMSC131 SELECT'" in called_filter
    assert "'" not in called_filter.split("course_code = '")[1][:-1]
