"""Direct Likha ERP syllabus ingestion and Upstash Vector upsert pipeline.

This module connects to Likha ERP (Directus REST API) in a strictly READ-ONLY manner
(per AGENTS.md constraints), extracts published course syllabi, normalizes syllabus
sections into semantic chunks, and upserts them into Upstash Vector with 768-dimensional
embeddings generated via Google text-embedding-004.
"""

from __future__ import annotations

import json
import logging
import sys
from pathlib import Path
from typing import Any, Optional

# Ensure rag-service root is in sys.path for CLI execution
_service_root = Path(__file__).resolve().parent
if str(_service_root) not in sys.path:
    sys.path.insert(0, str(_service_root))

import httpx
from upstash_vector import Index

from app.core.config import Settings, get_settings
from app.services.vector_store import upsert_vector_document

logger = logging.getLogger("gabay-rag.ingest")


# ---------------------------------------------------------------------------
# Section Normalization & Chunking
# ---------------------------------------------------------------------------

def _extract_description_content(course_info: dict, syllabus: dict) -> str:
    """Extract course description and overview content."""
    lines: list[str] = []

    # Overview details
    credits_val = course_info.get("credit") or course_info.get("credits")
    lec = course_info.get("lectureHours") or course_info.get("lecture_hours")
    lab = course_info.get("labHours") or course_info.get("lab_hours")
    sem = course_info.get("semester")
    ay = course_info.get("academicYear") or course_info.get("academic_year")

    overview_parts = []
    if credits_val:
        overview_parts.append(f"Credits: {credits_val}")
    if lec is not None and lab is not None:
        overview_parts.append(f"Lecture Hours: {lec} | Lab Hours: {lab}")
    if sem or ay:
        sem_ay = " ".join(filter(None, [str(sem) if sem else "", str(ay) if ay else ""]))
        if sem_ay:
            overview_parts.append(f"Term: {sem_ay}")

    if overview_parts:
        lines.append(" | ".join(overview_parts))

    # Description body
    desc = (
        course_info.get("description")
        or course_info.get("courseDescription")
        or course_info.get("rationale_description")
        or syllabus.get("description")
    )
    if desc and str(desc).strip():
        lines.append(f"Course Description: {str(desc).strip()}")

    return "\n".join(lines).strip()


def _extract_prerequisites_content(course_info: dict, syllabus: dict) -> str:
    """Extract course prerequisites, co-requisites, and course requirements."""
    lines: list[str] = []

    prereq = (
        course_info.get("prerequisite")
        or course_info.get("prerequisites")
        or syllabus.get("prerequisites")
        or syllabus.get("prerequisite")
    )
    if prereq is not None and str(prereq).strip():
        lines.append(f"Prerequisite(s): {str(prereq).strip()}")

    coreq = course_info.get("corequisite") or course_info.get("corequisites")
    if coreq is not None and str(coreq).strip():
        lines.append(f"Corequisite(s): {str(coreq).strip()}")

    reqs = syllabus.get("courseRequirements") or syllabus.get("course_requirements")
    if isinstance(reqs, dict):
        major_reqs = reqs.get("major")
        other_reqs = reqs.get("other")
        if major_reqs and isinstance(major_reqs, list):
            lines.append("Major Requirements: " + ", ".join(str(r) for r in major_reqs))
        if other_reqs and isinstance(other_reqs, list):
            lines.append("Other Requirements: " + ", ".join(str(r) for r in other_reqs))

    return "\n".join(lines).strip()


def _extract_outcomes_content(syllabus: dict) -> str:
    """Extract course learning outcomes (CLOs)."""
    outcomes = (
        syllabus.get("courseOutcomes")
        or syllabus.get("course_outcomes")
        or syllabus.get("outcomes")
        or syllabus.get("programOutcomes")
    )
    if not outcomes:
        return ""

    if isinstance(outcomes, list):
        formatted_list = []
        for idx, item in enumerate(outcomes):
            if isinstance(item, dict):
                num = item.get("number") or item.get("co_number") or (idx + 1)
                stmt = item.get("statement") or item.get("outcome") or item.get("description") or ""
                if stmt:
                    formatted_list.append(f"CO {num}: {str(stmt).strip()}")
            elif isinstance(item, str) and item.strip():
                formatted_list.append(f"{idx + 1}. {item.strip()}")
        return "\n".join(formatted_list)
    elif isinstance(outcomes, str) and outcomes.strip():
        return outcomes.strip()

    return ""


def _extract_grading_content(syllabus: dict) -> str:
    """Extract grading system, formulas, and passing grade."""
    grading = (
        syllabus.get("gradingSystem")
        or syllabus.get("grading_system")
        or syllabus.get("grading")
    )
    if not grading:
        return ""

    if isinstance(grading, dict):
        lines: list[str] = []
        passing = grading.get("passingGrade") or grading.get("passing_grade")
        if passing is not None:
            lines.append(f"Passing Grade: {passing}")

        term_formula = grading.get("termFormula") or grading.get("term_formula")
        if term_formula:
            lines.append(f"Term Grade Formula: {term_formula}")

        final_formula = grading.get("finalFormula") or grading.get("final_formula")
        if final_formula:
            lines.append(f"Final Grade Formula: {final_formula}")

        components = grading.get("classStandingComponents") or grading.get("class_standing_components") or grading.get("components")
        if components:
            if isinstance(components, list):
                lines.append("Class Standing Components: " + ", ".join(str(c) for c in components))
            else:
                lines.append(f"Class Standing Components: {components}")

        exam_weight = grading.get("examWeight") or grading.get("exam_weight")
        if exam_weight:
            lines.append(f"Exam Weight: {exam_weight}")

        return "\n".join(lines).strip()
    elif isinstance(grading, str) and grading.strip():
        return grading.strip()

    return ""


def _extract_outline_content(syllabus: dict) -> str:
    """Extract course topics, weekly modules, and schedule."""
    outline = (
        syllabus.get("courseOutline")
        or syllabus.get("course_outline")
        or syllabus.get("outline")
        or syllabus.get("learningPlan")
        or syllabus.get("learning_plans")
        or syllabus.get("learning_plan")
    )
    if not outline:
        return ""

    if isinstance(outline, list):
        formatted_blocks = []
        for item in outline:
            if isinstance(item, dict):
                block_lines = []
                time_frame = item.get("timeFrame") or item.get("time_frame") or item.get("week")
                title = item.get("title") or item.get("topic")
                header_parts = [p for p in [time_frame, title] if p]
                if header_parts:
                    block_lines.append(" - ".join(str(p) for p in header_parts) + ":")

                topics = item.get("topics")
                if topics:
                    if isinstance(topics, list):
                        block_lines.append("  Topics: " + ", ".join(str(t) for t in topics))
                    else:
                        block_lines.append(f"  Topics: {topics}")

                learning_outcomes = item.get("learningOutcomes") or item.get("learning_outcomes")
                if learning_outcomes:
                    if isinstance(learning_outcomes, list):
                        block_lines.append("  Outcomes: " + ", ".join(str(o) for o in learning_outcomes))
                    else:
                        block_lines.append(f"  Outcomes: {learning_outcomes}")

                if block_lines:
                    formatted_blocks.append("\n".join(block_lines))
            elif isinstance(item, str) and item.strip():
                formatted_blocks.append(f"- {item.strip()}")

        return "\n\n".join(formatted_blocks)
    elif isinstance(outline, str) and outline.strip():
        return outline.strip()

    return ""


def _extract_policies_content(syllabus: dict) -> str:
    """Extract attendance, late submission, and academic integrity policies."""
    policies = (
        syllabus.get("classroomPolicies")
        or syllabus.get("classroom_policies")
        or syllabus.get("policies")
    )
    if not policies:
        return ""

    if isinstance(policies, list):
        formatted = []
        for item in policies:
            if isinstance(item, str) and item.strip():
                formatted.append(f"- {item.strip()}")
            elif isinstance(item, dict):
                policy_text = item.get("policy") or item.get("statement") or item.get("description")
                if policy_text:
                    title = item.get("title")
                    prefix = f"{title}: " if title else "- "
                    formatted.append(f"{prefix}{policy_text.strip()}")
        return "\n".join(formatted)
    elif isinstance(policies, dict):
        lines = [f"{k.capitalize()}: {v}" for k, v in policies.items() if v]
        return "\n".join(lines)
    elif isinstance(policies, str) and policies.strip():
        return policies.strip()

    return ""


def parse_syllabus_to_sections(
    course_code: str,
    course_title: str,
    syllabus_data: Any,
) -> list[dict]:
    """Break syllabus data into 6 semantic sections for vector upsert.

    Args:
        course_code: Unique course identifier (e.g. 'CMSC101').
        course_title: Official course title (e.g. 'Introduction to Computing').
        syllabus_data: Dictionary or JSON string containing syllabus contents.

    Returns:
        List of section dictionaries matching:
        {
            "id": f"{course_code}_{section_key}",
            "text": f"Course: {course_code} - {course_title}\nSection: {section_title}\n{content}",
            "metadata": {
                "source": f"{course_code} Syllabus",
                "course_code": course_code,
                "course_title": course_title,
                "section_key": section_key,
                "category": "curriculum_and_instruction",
            }
        }
    """
    clean_code = str(course_code or "").strip()
    clean_title = str(course_title or "").strip()

    if isinstance(syllabus_data, str):
        try:
            syllabus = json.loads(syllabus_data)
        except (json.JSONDecodeError, TypeError):
            return []
    elif isinstance(syllabus_data, dict):
        syllabus = syllabus_data
    else:
        return []

    if not isinstance(syllabus, dict):
        return []

    course_info = syllabus.get("courseInfo") or syllabus.get("course_info") or {}
    if not isinstance(course_info, dict):
        course_info = {}

    sections: list[dict] = []

    # Map of 6 semantic sections to their extractors and human-readable titles
    extractors = [
        ("description", "Course Description & Overview", _extract_description_content(course_info, syllabus)),
        ("prerequisites", "Prerequisites & Corequisites", _extract_prerequisites_content(course_info, syllabus)),
        ("outcomes", "Course Learning Outcomes (CLOs)", _extract_outcomes_content(syllabus)),
        ("grading", "Grading System & Standard", _extract_grading_content(syllabus)),
        ("outline", "Course Outline & Schedule", _extract_outline_content(syllabus)),
        ("policies", "Course Policies & Academic Guidelines", _extract_policies_content(syllabus)),
    ]

    for section_key, section_title, content in extractors:
        if content and content.strip():
            section_id = f"{clean_code}_{section_key}"
            text_payload = (
                f"Course: {clean_code} - {clean_title}\n"
                f"Section: {section_title}\n"
                f"{content.strip()}"
            )
            metadata = {
                "source": f"{clean_code} Syllabus",
                "course_code": clean_code,
                "course_title": clean_title,
                "section_key": section_key,
                "category": "curriculum_and_instruction",
            }
            sections.append({
                "id": section_id,
                "text": text_payload,
                "metadata": metadata,
            })

    return sections


# ---------------------------------------------------------------------------
# Direct Likha ERP Client (Strictly Read-Only)
# ---------------------------------------------------------------------------

def fetch_likha_data(
    settings: Optional[Settings] = None,
    client: Optional[httpx.Client] = None,
) -> list[dict]:
    """Fetch published course records and syllabi from Likha ERP via Directus REST API.

    Strictly READ-ONLY: Authenticates with POST /auth/login and reads published courses
    via GET /items/courses. Never executes mutations or schema modifications.

    Args:
        settings: Application settings containing Likha URL and service credentials.
        client: Optional HTTP client (instantiated if not provided).

    Returns:
        List of course dictionaries with parsed syllabus data.
    """
    settings = settings or get_settings()
    base_url = (settings.likha_url or "https://gabay.zyberlab.com").rstrip("/")

    close_client = False
    if client is None:
        client = httpx.Client(timeout=30.0)
        close_client = True

    try:
        token: Optional[str] = None
        # Authenticate with Likha ERP if service credentials are provided
        if settings.likha_admin_email and settings.likha_admin_password:
            login_url = f"{base_url}/auth/login"
            login_payload = {
                "email": settings.likha_admin_email,
                "password": settings.likha_admin_password,
            }
            login_resp = client.post(
                login_url,
                json=login_payload,
                headers={"Content-Type": "application/json"},
            )
            login_resp.raise_for_status()
            token = login_resp.json().get("data", {}).get("access_token")

        headers: dict[str, str] = {}
        if token:
            headers["Authorization"] = f"Bearer {token}"

        # Fetch published courses (limit=-1 to retrieve complete catalog)
        courses_url = f"{base_url}/items/courses?filter[status][_eq]=published&limit=-1"
        courses_resp = client.get(courses_url, headers=headers)
        courses_resp.raise_for_status()

        resp_data = courses_resp.json()
        courses: list[dict] = resp_data.get("data", []) if isinstance(resp_data, dict) else resp_data

        # Normalize syllabus field for each course
        for course in courses:
            syllabus_raw = course.get("syllabus")
            if isinstance(syllabus_raw, str):
                try:
                    course["syllabus"] = json.loads(syllabus_raw)
                except (json.JSONDecodeError, TypeError):
                    course["syllabus"] = {}

        return courses

    finally:
        if close_client:
            client.close()


# ---------------------------------------------------------------------------
# Vector Upsert Ingestion Pipeline
# ---------------------------------------------------------------------------

def run_ingestion(
    courses: Optional[list[dict]] = None,
    settings: Optional[Settings] = None,
    index: Optional[Index] = None,
    client: Optional[httpx.Client] = None,
) -> dict:
    """Run full syllabus extraction and vector upsert pipeline into Upstash Vector.

    Args:
        courses: Optional pre-fetched courses. If None, fetches from Likha ERP.
        settings: Application settings.
        index: Optional Upstash Vector Index instance.
        client: Optional HTTP client for Likha API calls.

    Returns:
        Summary dict containing execution statistics:
        {"status": "success", "courses_processed": int, "sections_upserted": int}
    """
    settings = settings or get_settings()

    if courses is None:
        logger.info("Fetching published courses from Likha ERP...")
        courses = fetch_likha_data(settings=settings, client=client)

    sections_upserted = 0

    for course in courses:
        code = course.get("code") or course.get("course_code") or str(course.get("id", ""))
        title = course.get("title") or course.get("course_title") or course.get("name") or ""
        syllabus_data = course.get("syllabus") or {}

        sections = parse_syllabus_to_sections(code, title, syllabus_data)
        for section in sections:
            try:
                upsert_vector_document(
                    doc_id=section["id"],
                    text=section["text"],
                    metadata=section["metadata"],
                    index=index,
                )
                sections_upserted += 1
            except Exception as exc:
                logger.warning("Failed to upsert section %s for course %s: %s", section.get("id"), code, exc)

    summary = {
        "status": "success",
        "courses_processed": len(courses),
        "sections_upserted": sections_upserted,
    }
    logger.info("Ingestion completed: %s", summary)
    return summary


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    print("Starting Likha ERP syllabus ingestion...")
    result = run_ingestion()
    print(f"Ingestion result: {result}")
