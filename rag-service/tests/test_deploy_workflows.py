"""Tests for Render deployment specification and GitHub Actions workflows."""

from pathlib import Path
import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
RAG_SERVICE_ROOT = REPO_ROOT / "rag-service"
GITHUB_WORKFLOWS_ROOT = REPO_ROOT / ".github" / "workflows"


def test_render_yaml_specification():
    """Verify rag-service/render.yaml adheres to Render free-tier deployment requirements."""
    render_file = RAG_SERVICE_ROOT / "render.yaml"
    assert render_file.exists(), "rag-service/render.yaml must exist"

    with open(render_file, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    assert "services" in config, "render.yaml must define a 'services' list"
    assert len(config["services"]) >= 1

    svc = config["services"][0]
    assert svc.get("type") == "web"
    assert svc.get("name") == "gabay-rag-service"
    assert svc.get("rootDir") == "rag-service"
    assert svc.get("runtime") == "python"
    assert svc.get("plan") == "free"
    assert svc.get("buildCommand") == "pip install -r requirements.txt"
    assert svc.get("startCommand") == "uvicorn app.main:app --host 0.0.0.0 --port $PORT"

    expected_env_keys = {
        "GEMINI_API_KEY",
        "GROQ_API_KEY",
        "UPSTASH_VECTOR_REST_URL",
        "UPSTASH_VECTOR_REST_TOKEN",
        "LIKHA_URL",
        "LIKHA_TOKEN",
    }
    declared_env_vars = {item["key"]: item.get("sync") for item in svc.get("envVars", [])}

    for key in expected_env_keys:
        assert key in declared_env_vars, f"Environment variable {key} must be declared in render.yaml"
        assert declared_env_vars[key] is False, f"Environment variable {key} must have sync: false"


def test_keep_alive_workflow_specification():
    """Verify .github/workflows/keep-alive.yml adheres to 10-minute cron keep-alive specifications."""
    workflow_file = GITHUB_WORKFLOWS_ROOT / "keep-alive.yml"
    assert workflow_file.exists(), ".github/workflows/keep-alive.yml must exist"

    with open(workflow_file, "r", encoding="utf-8") as f:
        content_str = f.read()
        config = yaml.safe_load(content_str)

    # Validate triggers
    triggers = config.get("on") or config.get(True)  # YAML 'on' can parse as True if unquoted in some parsers
    assert "schedule" in triggers, "keep-alive.yml must configure a schedule trigger"
    cron_list = [entry.get("cron") for entry in triggers["schedule"]]
    assert "*/10 * * * *" in cron_list, "keep-alive.yml schedule must be '*/10 * * * *'"
    assert "workflow_dispatch" in triggers, "keep-alive.yml must configure workflow_dispatch"

    # Validate curl and health check target
    assert "RAG_SERVICE_URL" in content_str
    assert "/health" in content_str
    assert "curl" in content_str
    assert "--max-time" in content_str


def test_sync_cron_workflow_specification():
    """Verify .github/workflows/sync-cron.yml adheres to nightly syllabus ingestion specifications."""
    workflow_file = GITHUB_WORKFLOWS_ROOT / "sync-cron.yml"
    assert workflow_file.exists(), ".github/workflows/sync-cron.yml must exist"

    with open(workflow_file, "r", encoding="utf-8") as f:
        content_str = f.read()
        config = yaml.safe_load(content_str)

    # Validate triggers
    triggers = config.get("on") or config.get(True)
    assert "schedule" in triggers, "sync-cron.yml must configure a schedule trigger"
    cron_list = [entry.get("cron") for entry in triggers["schedule"]]
    assert "0 18 * * *" in cron_list, "sync-cron.yml schedule must be '0 18 * * *' (2:00 AM PHT)"
    assert "workflow_dispatch" in triggers, "sync-cron.yml must configure workflow_dispatch"

    # Validate job steps
    jobs = config.get("jobs", {})
    assert len(jobs) >= 1
    job_key = list(jobs.keys())[0]
    steps = jobs[job_key].get("steps", [])

    step_actions = [s.get("uses", "") for s in steps]
    assert any("actions/checkout" in a for a in step_actions)
    assert any("actions/setup-python" in a for a in step_actions)

    python_step = next(s for s in steps if "actions/setup-python" in s.get("uses", ""))
    assert str(python_step.get("with", {}).get("python-version")) == "3.12"

    ingest_step = next(s for s in steps if "python ingest.py" in s.get("run", ""))
    assert ingest_step.get("working-directory") == "rag-service"

    required_secrets = {
        "GEMINI_API_KEY",
        "GROQ_API_KEY",
        "UPSTASH_VECTOR_REST_URL",
        "UPSTASH_VECTOR_REST_TOKEN",
        "LIKHA_URL",
        "LIKHA_TOKEN",
    }
    step_env = ingest_step.get("env", {})
    for secret in required_secrets:
        assert secret in step_env, f"Secret {secret} must be passed to python ingest.py step"
