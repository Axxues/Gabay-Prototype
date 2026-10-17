"""Main FastAPI application for Gabay Hierarchical Multi-Agent RAG service."""

from typing import Any, Dict, List, Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.agents.graph import rag_graph

app = FastAPI(
    title="Gabay Hierarchical Multi-Agent RAG API",
    description="Multi-agent academic assistant service powered by LangGraph, Groq Llama 3.3, and Gemini 2.0 Flash.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ChatRequest(BaseModel):
    """Payload for chat inquiry submitted by student."""

    message: str
    student_name: Optional[str] = None
    active_course: Optional[str] = None
    history: List[Dict[str, Any]] = Field(default_factory=list)


class ChatResponse(BaseModel):
    """Response returned by Gabay RAG service."""

    reply: str
    category: str
    sources: List[Dict[str, Any]] = Field(default_factory=list)


@app.get("/health")
def health_check():
    """Service health check endpoint."""
    return {"status": "ok", "service": "gabay-rag-service"}


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """Process incoming chat query through hierarchical LangGraph pipeline."""
    result = await rag_graph.ainvoke({
        "message": request.message,
        "student_name": request.student_name,
        "active_course": request.active_course,
        "history": request.history,
    })

    return ChatResponse(
        reply=result.get("reply", ""),
        category=result.get("category", "student_support"),
        sources=result.get("sources", []),
    )
