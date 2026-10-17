"""Unit and integration tests for Likha ERP syllabus ingestion and vector upsert."""

import json
from unittest.mock import MagicMock, patch
import httpx
import pytest

from ingest import (
    fetch_likha_data,
    parse_syllabus_to_sections,
    run_ingestion,
)
from app.core.config import Settings


# ---------------------------------------------------------------------------
# Unit Tests: parse_syllabus_to_sections
# ---------------------------------------------------------------------------

def test_parse_syllabus_sections():
    """Verify basic syllabus section parsing from task brief requirements."""
    sample_syllabus_data = {
        "courseInfo": {
            "description": "Intro to Computing.",
            "prerequisite": "None",
        },
        "gradingSystem": {
            "passingGrade": "2.50",
            "termFormula": "60% Class Standing + 40% Exam",
        },
        "courseOutcomes": [
            {"number": 1, "statement": "Understand basic algorithms."}
        ],
    }
    sections = parse_syllabus_to_sections("CMSC101", "Introduction to Computing", sample_syllabus_data)
    assert len(sections) >= 3
    assert any("2.50" in s["text"] for s in sections)
    assert any(s["metadata"]["section_key"] == "grading" for s in sections)


def test_parse_syllabus_all_six_sections():
    """Verify all 6 semantic sections are extracted when full syllabus data is provided."""
    full_syllabus = {
        "courseInfo": {
            "description": "Comprehensive study of object-oriented concepts.",
            "prerequisite": "CMSC 11",
            "credit": "3",
            "lectureHours": "2",
            "labHours": "3",
        },
        "courseOutcomes": [
            {"number": 1, "statement": "Design object-oriented models."},
            {"number": 2, "statement": "Implement modular programs in Java."},
        ],
        "gradingSystem": {
            "passingGrade": "3.00",
            "termFormula": "40% Quizzes + 30% Projects + 30% Final Exam",
            "finalFormula": "50% Midterm + 50% Tentative Final",
            "classStandingComponents": ["Quizzes", "Assignments", "Recitation"],
        },
        "courseOutline": [
            {
                "timeFrame": "Weeks 1-3",
                "title": "Encapsulation and Classes",
                "topics": ["Classes", "Methods", "Constructors"],
            },
            {
                "timeFrame": "Weeks 4-6",
                "title": "Inheritance and Polymorphism",
                "topics": ["Subclasses", "Method Overriding", "Interfaces"],
            },
        ],
        "classroomPolicies": [
            "Attendance is mandatory for all lab and lecture sessions.",
            "Late submissions incur a 10% penalty per day up to 3 days.",
            "Plagiarism will result in an immediate grade of 5.0.",
        ],
    }

    sections = parse_syllabus_to_sections("CMSC131", "Object-Oriented Programming", full_syllabus)
    assert len(sections) == 6

    section_keys = [s["metadata"]["section_key"] for s in sections]
    assert set(section_keys) == {
        "description",
        "prerequisites",
        "outcomes",
        "grading",
        "outline",
        "policies",
    }

    # Verify ID structure
    assert any(s["id"] == "CMSC131_description" for s in sections)
    assert any(s["id"] == "CMSC131_prerequisites" for s in sections)
    assert any(s["id"] == "CMSC131_outcomes" for s in sections)
    assert any(s["id"] == "CMSC131_grading" for s in sections)
    assert any(s["id"] == "CMSC131_outline" for s in sections)
    assert any(s["id"] == "CMSC131_policies" for s in sections)

    # Verify metadata formatting
    for s in sections:
        assert s["metadata"]["course_code"] == "CMSC131"
        assert s["metadata"]["course_title"] == "Object-Oriented Programming"
        assert s["metadata"]["source"] == "CMSC131 Syllabus"
        assert s["metadata"]["category"] == "curriculum_and_instruction"
        assert "Course: CMSC131 - Object-Oriented Programming" in s["text"]
        assert "Section: " in s["text"]


def test_parse_syllabus_json_string_input():
    """Verify that syllabus data passed as a serialized JSON string is parsed gracefully."""
    syllabus_dict = {
        "courseInfo": {"description": "Operating systems concepts."},
        "gradingSystem": {"passingGrade": "2.75"},
    }
    json_str = json.dumps(syllabus_dict)
    sections = parse_syllabus_to_sections("CMSC125", "Operating Systems", json_str)
    assert len(sections) == 2
    assert any(s["metadata"]["section_key"] == "description" for s in sections)
    assert any("2.75" in s["text"] for s in sections)


def test_parse_syllabus_empty_or_invalid():
    """Verify graceful handling of empty or invalid syllabus inputs."""
    assert parse_syllabus_to_sections("TEST", "Test Course", {}) == []
    assert parse_syllabus_to_sections("TEST", "Test Course", "invalid json {") == []
    assert parse_syllabus_to_sections("TEST", "Test Course", None) == []


def test_parse_syllabus_snake_case_keys():
    """Verify syllabus extraction with snake_case keys (relational or alternative schema)."""
    snake_syllabus = {
        "course_info": {
            "description": "Database systems architecture.",
            "prerequisite": "CMSC 11",
        },
        "course_outcomes": [
            {"statement": "Write relational SQL queries."}
        ],
        "grading_system": {
            "passing_grade": "3.00",
            "term_formula": "50% Quizzes + 50% Exams",
        },
        "policies": [
            "Academic integrity is strictly enforced."
        ],
        "learning_plans": [
            {"week": "Week 1", "topics": ["ER Modeling"]}
        ],
    }
    sections = parse_syllabus_to_sections("CMSC127", "Database Systems", snake_syllabus)
    assert len(sections) == 6
    assert any("ER Modeling" in s["text"] for s in sections)
    assert any("Database systems architecture" in s["text"] for s in sections)


# ---------------------------------------------------------------------------
# Unit Tests: fetch_likha_data (Mocked Directus Client)
# ---------------------------------------------------------------------------

def test_fetch_likha_data_authenticated():
    """Verify login authentication and published course retrieval via Directus REST API."""
    settings = Settings(
        likha_url="https://gabay.zyberlab.com",
        likha_admin_email="admin@likha.test",
        likha_admin_password="secretpassword",
    )

    mock_login_resp = MagicMock(spec=httpx.Response)
    mock_login_resp.status_code = 200
    mock_login_resp.json.return_value = {
        "data": {
            "access_token": "mock_token_abc123",
            "expires": 900000,
        }
    }

    mock_courses_resp = MagicMock(spec=httpx.Response)
    mock_courses_resp.status_code = 200
    mock_courses_resp.json.return_value = {
        "data": [
            {
                "id": "c1",
                "code": "CMSC101",
                "title": "Intro to Computing",
                "status": "published",
                "syllabus": json.dumps({"courseInfo": {"description": "Computing 101."}}),
            },
            {
                "id": "c2",
                "code": "CMSC131",
                "title": "OOP",
                "status": "published",
                "syllabus": {"courseInfo": {"description": "OOP in Java."}},
            },
        ]
    }

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.return_value = mock_login_resp
    mock_client.get.return_value = mock_courses_resp

    courses = fetch_likha_data(settings=settings, client=mock_client)

    # Verify login call
    mock_client.post.assert_called_once_with(
        "https://gabay.zyberlab.com/auth/login",
        json={"email": "admin@likha.test", "password": "secretpassword"},
        headers={"Content-Type": "application/json"},
    )

    # Verify courses GET call
    mock_client.get.assert_called_once_with(
        "https://gabay.zyberlab.com/items/courses?filter[status][_eq]=published",
        headers={"Authorization": "Bearer mock_token_abc123"},
    )

    assert len(courses) == 2
    # Verify JSON string syllabus was deserialized
    assert isinstance(courses[0]["syllabus"], dict)
    assert courses[0]["syllabus"]["courseInfo"]["description"] == "Computing 101."
    assert isinstance(courses[1]["syllabus"], dict)


def test_fetch_likha_data_without_credentials():
    """Verify that fetch proceeds without login when credentials are omitted."""
    settings = Settings(
        likha_url="https://gabay.zyberlab.com",
        likha_admin_email="",
        likha_admin_password="",
    )

    mock_courses_resp = MagicMock(spec=httpx.Response)
    mock_courses_resp.status_code = 200
    mock_courses_resp.json.return_value = {"data": []}

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.get.return_value = mock_courses_resp

    courses = fetch_likha_data(settings=settings, client=mock_client)

    mock_client.post.assert_not_called()
    mock_client.get.assert_called_once()
    assert courses == []


def test_fetch_likha_data_login_failure():
    """Verify exception handling when Directus login returns 401."""
    settings = Settings(
        likha_url="https://gabay.zyberlab.com",
        likha_admin_email="bad@email.com",
        likha_admin_password="badpassword",
    )

    mock_login_resp = MagicMock(spec=httpx.Response)
    mock_login_resp.status_code = 401
    mock_login_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
        "Unauthorized", request=MagicMock(), response=mock_login_resp
    )

    mock_client = MagicMock(spec=httpx.Client)
    mock_client.post.return_value = mock_login_resp

    with pytest.raises(httpx.HTTPStatusError):
        fetch_likha_data(settings=settings, client=mock_client)


# ---------------------------------------------------------------------------
# Unit Tests: run_ingestion
# ---------------------------------------------------------------------------

@patch("ingest.fetch_likha_data")
@patch("ingest.upsert_vector_document")
def test_run_ingestion_with_fetched_data(mock_upsert, mock_fetch):
    """Verify full ingestion pipeline: fetching, parsing, and vector upserting."""
    mock_fetch.return_value = [
        {
            "id": "c1",
            "code": "CMSC101",
            "title": "Intro to Computing",
            "syllabus": {
                "courseInfo": {"description": "Computing 101."},
                "gradingSystem": {"passingGrade": "2.50"},
            },
        }
    ]

    mock_index = MagicMock()
    result = run_ingestion(index=mock_index)

    assert result["status"] == "success"
    assert result["courses_processed"] == 1
    assert result["sections_upserted"] == 2

    assert mock_upsert.call_count == 2
    first_call_kwargs = mock_upsert.call_args_list[0].kwargs
    assert first_call_kwargs["doc_id"] == "CMSC101_description"
    assert "Computing 101" in first_call_kwargs["text"]
    assert first_call_kwargs["metadata"]["section_key"] == "description"
    assert first_call_kwargs["index"] == mock_index


@patch("ingest.upsert_vector_document")
def test_run_ingestion_with_explicit_courses(mock_upsert):
    """Verify that explicitly passed courses bypass fetch_likha_data."""
    custom_courses = [
        {
            "code": "CMSC141",
            "title": "Automata and Language Theory",
            "syllabus": {
                "courseInfo": {"description": "Formal languages and automata."},
            },
        }
    ]

    result = run_ingestion(courses=custom_courses)

    assert result["status"] == "success"
    assert result["courses_processed"] == 1
    assert result["sections_upserted"] == 1
    assert mock_upsert.call_count == 1
    call_args = mock_upsert.call_args[1]
    assert call_args["doc_id"] == "CMSC141_description"


def test_likha_strictly_read_only():
    """Verify that ingest module never calls mutation methods (POST/PATCH/DELETE on items)."""
    import inspect
    import ingest

    source = inspect.getsource(ingest)
    # Check that there are no POST or PATCH or DELETE calls on /items/
    forbidden_patterns = [
        ".post(f\"{base_url}/items",
        ".patch(",
        ".delete(",
        "method=\"POST\"",
        "method='POST'",
        "method=\"PATCH\"",
        "method='PATCH'",
        "method=\"DELETE\"",
        "method='DELETE'",
    ]
    for pattern in forbidden_patterns:
        assert pattern not in source, f"Forbidden mutating call pattern found in ingest.py: {pattern}"
