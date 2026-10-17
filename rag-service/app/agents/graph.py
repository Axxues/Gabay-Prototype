"""Hierarchical LangGraph State Machine for Gabay LMS Multi-Agent RAG.

Coordinates intent classification, subagent routing across 7 university domains,
stub fallback for under-development modules, vector retrieval, and Gemini 2.0 Flash
response synthesis.
"""

import logging
import re
from typing import Any, Dict, List, Optional, TypedDict
from langgraph.graph import END, START, StateGraph
from langgraph.graph.state import CompiledStateGraph

from app.agents.coordinator import OUT_OF_SCOPE_REPLY, classify_intent
from app.agents.synthesizer import (
    format_sources,
    get_gemini_synthesizer,
    synthesize_answer,
)
from app.core.domains import get_under_development_notice, is_domain_active
from app.services.vector_store import query_vector_store

logger = logging.getLogger(__name__)


class RagState(TypedDict, total=False):
    """LangGraph state representation for the Gabay RAG pipeline."""

    message: str
    student_name: Optional[str]
    active_course: Optional[str]
    history: List[Dict[str, Any]]
    category: Optional[str]
    direct_reply: Optional[str]
    retrieved_docs: List[Dict[str, Any]]
    reply: Optional[str]
    sources: List[Dict[str, Any]]


def coordinator_node(state: RagState) -> Dict[str, Any]:
    """Classify user intent into one of 7 domains or OUT_OF_SCOPE.

    Determines if direct reply is applicable (out of scope or under development).
    """
    message = state.get("message", "")
    student_name = state.get("student_name")
    active_course = state.get("active_course")

    intent_res = classify_intent(
        message=message,
        student_name=student_name,
        active_course=active_course,
    )

    category = intent_res.get("category", "student_support")
    direct_reply = intent_res.get("direct_reply")

    # Guardrails if direct_reply was not populated by router
    if category == "OUT_OF_SCOPE" and not direct_reply:
        direct_reply = OUT_OF_SCOPE_REPLY
    elif not is_domain_active(category) and not direct_reply:
        direct_reply = get_under_development_notice(category)

    return {
        "category": category,
        "direct_reply": direct_reply,
        "student_name": student_name,
        "active_course": active_course,
    }


def route_coordinator(state: RagState) -> str:
    """Determine next node based on classification and domain status.

    Returns:
        'direct_reply_node' for out-of-scope or under-development queries.
        'retriever_node' for active university domains.
    """
    category = state.get("category", "")
    direct_reply = state.get("direct_reply")

    if category == "OUT_OF_SCOPE" or not is_domain_active(category) or direct_reply is not None:
        return "direct_reply_node"
    return "retriever_node"


def direct_reply_node(state: RagState) -> Dict[str, Any]:
    """Terminal node for out-of-scope refusals and under-development stubs."""
    category = state.get("category", "")
    reply = state.get("direct_reply")

    if not reply:
        if category == "OUT_OF_SCOPE":
            reply = OUT_OF_SCOPE_REPLY
        elif not is_domain_active(category):
            reply = get_under_development_notice(category)
        else:
            reply = "I cannot answer this inquiry at the moment."

    return {
        "reply": reply,
        "sources": [],
    }


def retriever_node(state: RagState) -> Dict[str, Any]:
    """Retrieve relevant domain documents from Upstash Vector store."""
    query = state.get("message", "")
    category = state.get("category", "")
    active_course = state.get("active_course")

    # Build SQL-like filter for Upstash Vector
    filter_clauses = []
    if category:
        filter_clauses.append(f"category = '{category}'")
    if category == "curriculum_and_instruction" and active_course:
        clean_course = re.sub(r"[^a-zA-Z0-9_\-\s]", "", str(active_course)).strip()
        if clean_course:
            filter_clauses.append(f"course_code = '{clean_course}'")

    filter_str = " AND ".join(filter_clauses) if filter_clauses else None

    logger.debug("Querying vector store with filter: %s", filter_str)
    docs = query_vector_store(query_text=query, top_k=3, filter_str=filter_str)

    return {
        "retrieved_docs": docs,
    }


async def synthesizer_node(state: RagState) -> Dict[str, Any]:
    """Synthesize response using Gemini 2.0 Flash based on retrieved documents."""
    llm = get_gemini_synthesizer()
    docs = state.get("retrieved_docs") or []
    message = state.get("message", "")
    student_name = state.get("student_name")
    active_course = state.get("active_course")
    history = state.get("history") or []

    reply = await synthesize_answer(
        docs=docs,
        message=message,
        student_name=student_name,
        active_course=active_course,
        history=history,
        llm=llm,
    )
    sources = format_sources(docs)

    return {
        "reply": reply,
        "sources": sources,
    }


def build_rag_graph() -> CompiledStateGraph:
    """Build and compile the LangGraph StateGraph pipeline."""
    workflow = StateGraph(RagState)

    # Register nodes
    workflow.add_node("coordinator_node", coordinator_node)
    workflow.add_node("direct_reply_node", direct_reply_node)
    workflow.add_node("retriever_node", retriever_node)
    workflow.add_node("synthesizer_node", synthesizer_node)

    # Add edges
    workflow.add_edge(START, "coordinator_node")
    workflow.add_conditional_edges(
        "coordinator_node",
        route_coordinator,
        {
            "direct_reply_node": "direct_reply_node",
            "retriever_node": "retriever_node",
        },
    )
    workflow.add_edge("direct_reply_node", END)
    workflow.add_edge("retriever_node", "synthesizer_node")
    workflow.add_edge("synthesizer_node", END)

    return workflow.compile()


# Default singleton compiled graph instance
rag_graph = build_rag_graph()
