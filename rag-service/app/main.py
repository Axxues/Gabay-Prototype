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
    """Verify application client key. Fails closed (503) if RAG_CLIENT_KEY is unconfigured."""
    current_settings = get_settings()
    expected_key = current_settings.rag_client_key
    if not expected_key:
        raise HTTPException(
            status_code=503,
            detail="Service unavailable: RAG client authentication key is not configured.",
        )

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
trusted_origins = _configured_origins if _configured_origins else [
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "https://gabay.zyberlab.com",
    "https://gabay-prototype.vercel.app",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=trusted_origins,
    allow_credentials=False,
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


from app.services.email_service import (
    send_activation_email,
    send_leadership_code_email,
    send_course_invitation_email,
)


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
async def send_activation_email_endpoint(
    request: ActivationEmailRequest,
    _auth: None = Depends(verify_client_key),
) -> ActivationEmailResponse:
    """Send an account activation link to user's institutional email address."""
    if "@" not in request.email:
        raise HTTPException(status_code=422, detail="Invalid email address.")

    current_settings = get_settings()
    if current_settings.allowed_email_domains:
        allowed_domains = [d.strip().lower() for d in current_settings.allowed_email_domains.split(",") if d.strip()]
        email_domain = request.email.split("@")[-1].strip().lower()
        if allowed_domains and email_domain not in allowed_domains:
            raise HTTPException(status_code=422, detail="Email domain not allowed.")

    if current_settings.allowed_activation_origins:
        allowed_origins = [o.strip().lower() for o in current_settings.allowed_activation_origins.split(",") if o.strip()]
        if not any(request.activation_url.lower().startswith(o) for o in allowed_origins):
            raise HTTPException(status_code=422, detail="Activation URL origin is not allowed.")

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
    role_type: str = Field("dean", max_length=50)
    unit_name: Optional[str] = Field("", max_length=200)


class LeadershipCodeEmailResponse(BaseModel):
    """Response returned when a leadership code email is dispatched."""

    success: bool
    delivered: Optional[bool] = False
    simulated: Optional[bool] = False
    message: Optional[str] = None
    recipient: Optional[str] = None
    error: Optional[str] = None


@app.post("/api/auth/send-leadership-code", response_model=LeadershipCodeEmailResponse)
async def send_leadership_code_endpoint(
    request: LeadershipCodeEmailRequest,
    _auth: None = Depends(verify_client_key),
) -> LeadershipCodeEmailResponse:
    """Generate and send 6-digit verification code to incoming Dean/Chairperson institutional email."""
    if "@" not in request.email:
        raise HTTPException(status_code=422, detail="Invalid email address.")

    from app.services.verification_service import verification_service
    code = verification_service.issue_code(
        email=request.email,
        role_type=request.role_type,
        unit_name=request.unit_name or "",
    )

    result = send_leadership_code_email(
        to_email=request.email,
        recipient_name=request.recipient_name or "",
        code=code,
        role_type=request.role_type,
        unit_name=request.unit_name or "",
    )
    return LeadershipCodeEmailResponse(
        success=result.get("success", False),
        delivered=result.get("delivered", False),
        simulated=result.get("simulated", False),
        message=result.get("message"),
        recipient=request.email,
        error=result.get("error"),
    )


class VerifyLeadershipCodeRequest(BaseModel):
    """Payload to verify an incoming leadership verification code."""

    email: str = Field(..., min_length=3, max_length=254)
    code: str = Field(..., min_length=6, max_length=6)


class VerifyLeadershipCodeResponse(BaseModel):
    """Response returned when a verification code is validated."""

    success: bool
    message: str


@app.post("/api/auth/verify-leadership-code", response_model=VerifyLeadershipCodeResponse)
async def verify_leadership_code_endpoint(
    request: VerifyLeadershipCodeRequest,
    _auth: None = Depends(verify_client_key),
) -> VerifyLeadershipCodeResponse:
    """Validate 6-digit verification code for Dean/Chairperson appointment."""
    from app.services.verification_service import verification_service
    is_valid = verification_service.verify_code(email=request.email, code=request.code)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")
    return VerifyLeadershipCodeResponse(
        success=True,
        message="Leadership verification code confirmed successfully.",
    )


class CourseInvitationItem(BaseModel):
    recipient_email: str = Field(..., min_length=3, max_length=254)
    recipient_name: Optional[str] = Field(None, max_length=150)
    instructor_name: Optional[str] = Field("Your Instructor", max_length=150)
    course_code: str = Field(..., max_length=50)
    course_title: str = Field(..., max_length=200)
    section: Optional[str] = Field("", max_length=50)
    term: Optional[str] = Field("", max_length=100)
    join_url: str = Field(..., min_length=1)
    request_id: Optional[str] = None


class CourseInvitationBatchRequest(BaseModel):
    invitations: List[CourseInvitationItem]


class CourseInvitationBatchResponse(BaseModel):
    success: bool
    total: int
    sent: int
    simulated: bool = False
    message: str


@app.post("/api/courses/send-course-invitations", response_model=CourseInvitationBatchResponse)
async def send_course_invitations_endpoint(
    request: CourseInvitationBatchRequest,
    _auth: None = Depends(verify_client_key),
) -> CourseInvitationBatchResponse:
    """Send batch of course invitation emails to invited students."""
    total = len(request.invitations)
    sent = 0
    simulated = False

    for item in request.invitations:
        if "@" not in item.recipient_email:
            continue
        res = send_course_invitation_email(
            to_email=item.recipient_email,
            recipient_name=item.recipient_name or "",
            instructor_name=item.instructor_name or "Your Instructor",
            course_code=item.course_code,
            course_title=item.course_title,
            section=item.section or "",
            term=item.term or "",
            join_url=item.join_url,
        )
        if res.get("success"):
            sent += 1
        if res.get("simulated"):
            simulated = True

    return CourseInvitationBatchResponse(
        success=True,
        total=total,
        sent=sent,
        simulated=simulated,
        message=f"Dispatched {sent} of {total} course invitation emails.",
    )


