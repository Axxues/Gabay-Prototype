import pytest
from app.core.domains import (
    DOMAINS_REGISTRY,
    DomainConfig,
    is_domain_active,
    get_under_development_notice,
)

EXPECTED_DOMAINS = {
    "curriculum_and_instruction",
    "faculty",
    "student_support",
    "research",
    "extension",
    "quality_assurance",
    "facilities",
}

def test_registry_contains_all_seven_domains():
    assert set(DOMAINS_REGISTRY.keys()) == EXPECTED_DOMAINS
    assert len(DOMAINS_REGISTRY) == 7

def test_active_domains():
    assert is_domain_active("curriculum_and_instruction") is True
    assert is_domain_active("faculty") is True
    assert is_domain_active("student_support") is True

def test_under_development_domains():
    assert is_domain_active("research") is False
    assert is_domain_active("extension") is False
    assert is_domain_active("quality_assurance") is False
    assert is_domain_active("facilities") is False
    assert is_domain_active("non_existent_domain") is False
    assert is_domain_active("") is False

def test_active_domains_vector_prefixes():
    assert DOMAINS_REGISTRY["curriculum_and_instruction"].vector_prefix == "curriculum"
    assert DOMAINS_REGISTRY["faculty"].vector_prefix == "faculty"
    assert DOMAINS_REGISTRY["student_support"].vector_prefix == "student_support"

def test_under_development_notices():
    for domain in ["research", "extension", "quality_assurance", "facilities"]:
        config = DOMAINS_REGISTRY[domain]
        notice = get_under_development_notice(domain)
        assert notice is not None
        assert config.notice == notice
        assert f"{config.title} module is currently under development" in notice

def test_under_development_notice_fallback_for_unknown_domain():
    fallback = get_under_development_notice("unknown_future_domain")
    assert "Unknown Future Domain module is currently under development" in fallback

def test_domain_config_dict_like_access():
    item = DOMAINS_REGISTRY["curriculum_and_instruction"]
    assert item["status"] == "ACTIVE"
    assert item["title"] == "Curriculum and Instruction"
    assert item.get("vector_prefix") == "curriculum"
    assert item.get("notice") is None
