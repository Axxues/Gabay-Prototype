import logging
from typing import Any, Dict, List, Optional
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from app.agents.graph import rag_graph
from app.core.config import get_settings

logger = logging.getLogger(__name__)


async def verify_client_key(
    x_gabay_client_key: Optional[str] = Header(None, alias="X-Gabay-Client-Key"),
    authorization: Optional[str] = Header(None),
):
    """Verify application client key if RAG_CLIENT_KEY is configured in settings."""
    current_settings = get_settings()
    expected_key = current_settings.rag_client_key
    if not expected_key:
        return

    bearer_token = (
        authorization.replace("Bearer ", "").strip()
        if authorization and authorization.startswith("Bearer ")
        else None
    )
    supplied_key = x_gabay_client_key or bearer_token

    if not supplied_key or supplied_key != expected_key:
        raise HTTPException(
            status_code=401,
            detail="Unauthorized: Invalid or missing client access key.",
        )

app = FastAPI(
    title="Gabay Hierarchical Multi-Agent RAG API",
    description="Multi-agent academic assistant service powered by LangGraph, Groq Llama 3.3, and Gemini 2.0 Flash.",
    version="1.0.0",
)

# Parse configured trusted CORS origins
settings = get_settings()
_configured_origins = [
    origin.strip()
    for origin in (settings.cors_allowed_origins or "").split(",")
    if origin.strip()
]
trusted_origins = _configured_origins if _configured_origins else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=trusted_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

from app.core.rate_limit import RateLimiterMiddleware, rate_limiter

app.add_middleware(RateLimiterMiddleware, limiter=rate_limiter)


class ChatRequest(BaseModel):
    """Payload for chat inquiry submitted by student."""

    message: str = Field(..., min_length=1, max_length=2000)
    student_name: Optional[str] = Field(None, max_length=100)
    active_course: Optional[str] = Field(None, max_length=50)
    history: List[Dict[str, Any]] = Field(default_factory=list, max_length=20)


class ChatResponse(BaseModel):
    """Response returned by Gabay RAG service."""

    reply: str
    category: str
    sources: List[Dict[str, Any]] = Field(default_factory=list)


@app.get("/health")
def health_check():
    """Service health check endpoint."""
    return {"status": "ok", "service": "gabay-rag-service"}


@app.post("/api/chat", response_model=ChatResponse, dependencies=[Depends(verify_client_key)])
async def chat_endpoint(request: ChatRequest) -> ChatResponse:
    """Process incoming chat query through hierarchical LangGraph pipeline."""
    try:
        result = await rag_graph.ainvoke({
            "message": request.message,
            "student_name": request.student_name,
            "active_course": request.active_course,
            "history": request.history,
        })
    except Exception as exc:
        logger.error("Error executing RAG graph pipeline: %s", exc, exc_info=True)
        return ChatResponse(
            reply="I apologize, but I am currently experiencing technical difficulties accessing university records. Please try again in a few moments or contact your academic advisor.",
            category="student_support",
            sources=[],
        )

    return ChatResponse(
        reply=result.get("reply", ""),
        category=result.get("category", "student_support"),
        sources=result.get("sources", []),
    )


from app.services.email_service import send_activation_email, send_leadership_code_email


class ActivationEmailRequest(BaseModel):
    """Payload to send an account activation link to a registered user."""

    email: str = Field(..., min_length=3, max_length=254)
    recipient_name: Optional[str] = Field(None, max_length=150)
    activation_url: str = Field(..., min_length=1, max_length=2000)


class ActivationEmailResponse(BaseModel):
    """Response returned when an activation email is requested."""

    success: bool
    delivered: Optional[bool] = False
    simulated: Optional[bool] = False
    message: Optional[str] = None
    recipient: Optional[str] = None
    error: Optional[str] = None


@app.post("/api/auth/send-activation-email", response_model=ActivationEmailResponse)
async def send_activation_email_endpoint(request: ActivationEmailRequest) -> ActivationEmailResponse:
    """Send an account activation link to user's institutional email address."""
    if "@" not in request.email:
        raise HTTPException(status_code=422, detail="Invalid email address.")
    result = send_activation_email(
        to_email=request.email,
        recipient_name=request.recipient_name or "",
        activation_url=request.activation_url,
    )
    return ActivationEmailResponse(**result)


class LeadershipCodeEmailRequest(BaseModel):
    """Payload to send a 6-digit leadership appointment verification code."""

    email: str = Field(..., min_length=3, max_length=254)
    recipient_name: Optional[str] = Field(None, max_length=150)
    code: str = Field(..., min_length=6, max_length=6)
    role_type: str = Field("dean", max_length=50)
    unit_name: Optional[str] = Field("", max_length=200)


class LeadershipCodeEmailResponse(BaseModel):
    """Response returned when a leadership code email is dispatched."""

    success: bool
    delivered: Optional[bool] = False
    simulated: Optional[bool] = False
    message: Optional[str] = None
    recipient: Optional[str] = None
    code: Optional[str] = None
    error: Optional[str] = None


@app.post("/api/auth/send-leadership-code", response_model=LeadershipCodeEmailResponse)
async def send_leadership_code_endpoint(request: LeadershipCodeEmailRequest) -> LeadershipCodeEmailResponse:
    """Send 6-digit verification code to incoming Dean/Chairperson institutional email."""
    if "@" not in request.email:
        raise HTTPException(status_code=422, detail="Invalid email address.")
    result = send_leadership_code_email(
        to_email=request.email,
        recipient_name=request.recipient_name or "",
        code=request.code,
        role_type=request.role_type,
        unit_name=request.unit_name or "",
    )
    return LeadershipCodeEmailResponse(**result)

