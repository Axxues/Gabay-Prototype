"""Domain Configuration Registry for Gabay Hierarchical Multi-Agent RAG.

Defines the 7 thesis subagents (3 ACTIVE, 4 UNDER_DEVELOPMENT) and provides
routing and under-development notice helpers.
"""

from typing import Any, Literal, Optional
from pydantic import BaseModel, ConfigDict

DomainStatus = Literal["ACTIVE", "UNDER_DEVELOPMENT"]


class DomainConfig(BaseModel):
    """Configuration model for a Gabay knowledge domain subagent."""

    model_config = ConfigDict(extra="ignore")

    title: str
    status: DomainStatus
    description: str
    vector_prefix: Optional[str] = None
    notice: Optional[str] = None

    def __getitem__(self, item: str) -> Any:
        return getattr(self, item)

    def get(self, item: str, default: Any = None) -> Any:
        return getattr(self, item, default)


DOMAINS_REGISTRY: dict[str, DomainConfig] = {
    "curriculum_and_instruction": DomainConfig(
        title="Curriculum and Instruction",
        status="ACTIVE",
        description="Course syllabi, lecture topics, course outcomes, prerequisites, and grading systems.",
        vector_prefix="curriculum",
    ),
    "faculty": DomainConfig(
        title="Faculty",
        status="ACTIVE",
        description="Faculty members, instructor directories, departments, and course assignments.",
        vector_prefix="faculty",
    ),
    "student_support": DomainConfig(
        title="Student Support",
        status="ACTIVE",
        description="Student policies, announcements, calendar events, grading formula, and general student welfare.",
        vector_prefix="student_support",
    ),
    "research": DomainConfig(
        title="Research",
        status="UNDER_DEVELOPMENT",
        description="University research projects, publications, funding, ethics clearance, and student theses.",
        notice="The Research module is currently under development in the Gabay System. Information regarding university research and theses will be available once this module is integrated with Likha ERP.",
    ),
    "extension": DomainConfig(
        title="Extension",
        status="UNDER_DEVELOPMENT",
        description="Community outreach programs, university extension services, and civic partnerships.",
        notice="The Extension module is currently under development in the Gabay System. Information regarding community extension services will be available once this module is integrated with Likha ERP.",
    ),
    "quality_assurance": DomainConfig(
        title="Quality Assurance",
        status="UNDER_DEVELOPMENT",
        description="Institutional accreditation, QA standards, audit rubrics, and compliance evaluations.",
        notice="The Quality Assurance module is currently under development in the Gabay System. Institutional QA and accreditation data will be available once this module is integrated with Likha ERP.",
    ),
    "facilities": DomainConfig(
        title="Facilities",
        status="UNDER_DEVELOPMENT",
        description="Campus buildings, computer laboratories, library guidelines, and room reservations.",
        notice="The Facilities module is currently under development in the Gabay System. Information regarding campus facilities and room schedules will be available once this module is integrated with Likha ERP.",
    ),
}


def is_domain_active(domain: str) -> bool:
    """Check if a domain exists in the registry and is marked as ACTIVE."""
    config = DOMAINS_REGISTRY.get(domain)
    return config is not None and config.status == "ACTIVE"


def get_under_development_notice(domain: str) -> str:
    """Get the under-development notice for a domain, or a standardized fallback."""
    config = DOMAINS_REGISTRY.get(domain)
    if config and config.notice:
        return config.notice

    title = config.title if config else domain.replace("_", " ").title()
    return (
        f"The {title} module is currently under development in the Gabay System. "
        "Information will be available once this module is integrated with Likha ERP."
    )


def get_domain_config(domain: str) -> Optional[DomainConfig]:
    """Retrieve the domain configuration if present in registry."""
    return DOMAINS_REGISTRY.get(domain)
