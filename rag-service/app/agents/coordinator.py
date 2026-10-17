"""Coordinator Agent for Gabay Hierarchical Multi-Agent RAG.

Utilizes Groq Llama 3.3 70B (llama-3.3-70b-versatile) for low-latency,
high-precision intent classification, subagent routing across 7 university
domains, and out-of-scope non-academic query rejection.
"""

import json
import logging
import os
from typing import Any, Optional
from groq import Groq

from app.core.config import get_settings
from app.core.domains import (
    DOMAINS_REGISTRY,
    get_under_development_notice,
    is_domain_active,
)

logger = logging.getLogger(__name__)

OUT_OF_SCOPE_REPLY = (
    "I am Gabay, your official university academic assistant. "
    "I can only assist with academic and institutional matters such as course syllabi, "
    "faculty directories, student policies, and university programs."
)

COORDINATOR_SYSTEM_PROMPT = """You are the Coordinator Agent for Gabay, the official university academic assistant.
Your responsibility is to analyze incoming user queries and route them to the appropriate domain, or identify out-of-scope questions.

UNIVERSITY DOMAIN CATEGORIES:
1. curriculum_and_instruction: Course syllabi, lecture topics, course learning outcomes, prerequisites, grading systems, course materials, assignments.
2. faculty: Faculty members, instructor directories, department contacts, consultation schedules, and teaching assignments.
3. student_support: Student handbook, grading formulas, academic calendar, campus announcements, student welfare, enrollment, academic policies.
4. research: University research projects, scholarly publications, research grants/funding, ethics clearance, and student theses.
5. extension: Community outreach programs, university extension services, civic partnerships, and community engagement.
6. quality_assurance: Institutional accreditation, quality assurance standards, university audit rubrics, compliance evaluations.
7. facilities: Campus buildings, computer laboratories, library rules and hours, room reservations, campus amenities.
8. OUT_OF_SCOPE: Any query that is NOT related to university academics, courses, faculty, student policies, facilities, or campus life. Examples include cooking recipes, movies, celebrity gossip, professional sports, unrelated programming help, general trivia, weather, and casual chit-chat.

ROUTING RULES:
- If the query is completely unrelated to university academic or institutional matters, classify as "OUT_OF_SCOPE".
- If the query is university or academic related, choose the single best matching category from the 7 domains above.
- Return ONLY a valid JSON object matching this schema:
  {"category": "<category_name>", "reasoning": "<short explanation>"}
"""


def get_groq_router() -> Groq:
    """Initialize and return a Groq client for intent classification.

    Uses the configured GROQ_API_KEY from environment or settings.
    """
    settings = get_settings()
    api_key = settings.groq_api_key or os.getenv("GROQ_API_KEY") or "gsk_placeholder"
    return Groq(api_key=api_key)


def classify_intent(
    message: str,
    student_name: Optional[str] = None,
    active_course: Optional[str] = None,
    client: Optional[Any] = None,
) -> dict:
    """Classify user intent into one of 7 university domains or OUT_OF_SCOPE.

    Args:
        message: The user's query or message string.
        student_name: Optional name of the student for personalization context.
        active_course: Optional course code or title providing context.
        client: Optional Groq client instance (defaults to get_groq_router()).

    Returns:
        dict containing:
            - category (str): The classified domain or 'OUT_OF_SCOPE'.
            - direct_reply (Optional[str]): Rejection text or under-development notice,
              or None if the domain is ACTIVE.
            - student_name (Optional[str]): Preserved student name.
            - active_course (Optional[str]): Preserved active course context.
    """
    router = client if client is not None else get_groq_router()

    user_content = f"User Query: {(message or '').strip()}"
    if active_course:
        user_content += f"\nActive Course Context: {active_course.strip()}"
    if student_name:
        user_content += f"\nStudent Name: {student_name.strip()}"

    try:
        completion = router.chat.completions.create(
            model="qwen/qwen3.8-27b",
            messages=[
                {"role": "system", "content": COORDINATOR_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.0,
            response_format={"type": "json_object"},
            max_tokens=250,
            timeout=8.0,
        )
        response_text = completion.choices[0].message.content or "{}"
        parsed = json.loads(response_text)
        raw_category = str(parsed.get("category", "")).strip().lower()
    except Exception as exc:
        logger.warning("Failed to classify intent via Groq router: %s", exc)
        raw_category = "student_support"

    # Normalize category
    clean_cat = raw_category.replace(" ", "_").replace("-", "_")
    if clean_cat in ("out_of_scope", "outofscope"):
        category = "OUT_OF_SCOPE"
    elif clean_cat in DOMAINS_REGISTRY:
        category = clean_cat
    else:
        # Check partial match against registry keys (safeguarded against empty string)
        matched = next((d for d in DOMAINS_REGISTRY if clean_cat and (d in clean_cat or clean_cat in d)), None)
        category = matched if matched else "student_support"

    # Determine direct_reply based on domain status or out of scope
    if category == "OUT_OF_SCOPE":
        direct_reply: Optional[str] = OUT_OF_SCOPE_REPLY
    elif is_domain_active(category):
        direct_reply = None
    else:
        direct_reply = get_under_development_notice(category)

    return {
        "category": category,
        "direct_reply": direct_reply,
        "student_name": student_name,
        "active_course": active_course,
    }
