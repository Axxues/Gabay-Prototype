# Hierarchical Multi-Agent RAG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and deploy a standalone Python FastAPI + LangGraph Hierarchical Multi-Agent RAG service for Gabay LMS supporting the 7 thesis domains, direct Likha ERP document ingestion, Upstash Vector retrieval, and direct React frontend integration, while completely decommissioning the legacy Express server.

**Architecture:** A lightweight FastAPI service exposes `/api/chat` and `/health`. A central Coordinator Agent (powered by Groq Llama 3.3 / Gemini 2.0 Flash) injects student context, filters out-of-scope non-university questions, and routes to 1 of 7 domain subagents. Active domains (Curriculum & Instruction, Faculty, Student Support) query Upstash Vector and synthesize citation-backed answers; unimplemented domains (Research, Extension, Quality Assurance, Facilities) return standardized under-development notices.

**Tech Stack:** Python 3.12, FastAPI, Uvicorn, LangGraph, Upstash Vector (`upstash-vector`), Google GenAI (`google-genai` / `langchain-google-genai`), Groq SDK (`groq`), React 18, TypeScript, Vite.

**Spec:** `docs/superpowers/specs/2026-10-17-gabay-rag-design.md`

## Global Constraints

* Total out-of-pocket budget: $0.00 / month. Strictly zero credit card required.
* Compute deployment: Render Free Web Service (512 MB RAM, Python 3.12, 24/7 uptime via GitHub Actions cron).
* Vector storage: Upstash Vector (768 dimensions, Cosine metric, 10,000 queries/day read quota, 10,000 updates/day write quota).
* LLM endpoints: Google AI Studio (`gemini-2.0-flash` + `text-embedding-004`) and Groq Cloud (`llama-3.3-70b-versatile`).
* Decommissioning: Express microservice (`server/`) and legacy n8n proxy code must be completely removed.
* Directus Rule (`AGENTS.md`): Strictly read-only operations on Likha ERP (`/items/*`); zero DDL or schema alterations via API.

## Review Focus

1. **Out-of-Scope Injection:** Questions unrelated to the university must be immediately intercepted without making vector queries or leaking internal system prompts.
2. **Under-Development Domain Routing:** Queries concerning Research, Extension, QA, or Facilities must return the exact standardized notice without throwing unhandled exceptions or querying empty vector namespaces.
3. **Memory Ceiling on Render:** In-memory operations must stay well below 512 MB RAM (no local embedding model binaries; embeddings offloaded to Google API).
4. **Active Course Scoping:** When `active_course` (e.g., `CMSC131`) is provided in the request, the Curriculum & Instruction agent must filter vector search to that course before falling back to general courses.
5. **Direct Client Contract Match:** The response JSON payload must strictly match `{ reply: str, category: str, sources: list[dict] }` to ensure zero breakages in the React frontend.

---

### Task 1: Scaffolding `rag-service/` and Base FastAPI Server

**Files:**
* Create: `rag-service/requirements.txt`
* Create: `rag-service/.env.example`
* Create: `rag-service/app/__init__.py`
* Create: `rag-service/app/main.py`
* Create: `rag-service/tests/__init__.py`
* Create: `rag-service/tests/test_health.py`

**Interfaces:**
* Produces: `app: FastAPI` with `GET /health` returning `{"status": "ok", "service": "gabay-rag-service"}` and CORS enabled.

- [ ] **Step 1: Write the failing test for `/health`**

```python
# rag-service/tests/test_health.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_check_returns_200():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "gabay-rag-service"}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest rag-service/tests/test_health.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app'`

- [ ] **Step 3: Implement dependencies and `app/main.py`**

Create `rag-service/requirements.txt`:
```txt
fastapi>=0.115.0
uvicorn>=0.32.0
langgraph>=0.2.35
langchain-core>=0.3.0
langchain-google-genai>=2.0.0
groq>=0.11.0
upstash-vector>=0.6.0
python-dotenv>=1.0.0
pydantic>=2.9.0
httpx>=0.27.0
pytest>=8.0.0
```

Create `rag-service/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Gabay Hierarchical Multi-Agent RAG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "gabay-rag-service"}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest rag-service/tests/test_health.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rag-service/
git commit -m "feat(rag): scaffold rag-service with health check endpoint"
```

---

### Task 2: Domain Registry & Under-Development Stubs

**Files:**
* Create: `rag-service/app/core/domains.py`
* Create: `rag-service/tests/test_domains.py`

**Interfaces:**
* Produces: `DOMAINS_REGISTRY: dict[str, DomainConfig]`, `is_domain_active(domain: str) -> bool`, `get_under_development_notice(domain: str) -> str`.

- [ ] **Step 1: Write failing test for domain registry & stubs**

```python
# rag-service/tests/test_domains.py
from app.core.domains import DOMAINS_REGISTRY, is_domain_active, get_under_development_notice

def test_active_domains():
    assert is_domain_active("curriculum_and_instruction") is True
    assert is_domain_active("faculty") is True
    assert is_domain_active("student_support") is True

def test_under_development_domains():
    assert is_domain_active("research") is False
    assert is_domain_active("extension") is False
    assert is_domain_active("quality_assurance") is False
    assert is_domain_active("facilities") is False
    notice = get_under_development_notice("facilities")
    assert "Facilities module is currently under development" in notice
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest rag-service/tests/test_domains.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.core.domains'`

- [ ] **Step 3: Implement `app/core/domains.py`**

Implement `DOMAINS_REGISTRY` with the exact 7 domains, statuses (`ACTIVE` vs `UNDER_DEVELOPMENT`), and helper functions as specified in Section 5 of the design document.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest rag-service/tests/test_domains.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rag-service/app/core/domains.py rag-service/tests/test_domains.py
git commit -m "feat(rag): add 7-domain registry and under-development stubs"
```

---

### Task 3: Upstash Vector & Google Embedding Client

**Files:**
* Create: `rag-service/app/core/config.py`
* Create: `rag-service/app/services/vector_store.py`
* Create: `rag-service/tests/test_vector_store.py`

**Interfaces:**
* Consumes: `UPSTASH_VECTOR_REST_URL`, `UPSTASH_VECTOR_REST_TOKEN`, `GEMINI_API_KEY`.
* Produces: `embed_text(text: str) -> list[float]` (768 dimensions), `query_vector_store(query_text: str, top_k: int, filter_metadata: dict) -> list[dict]`.

- [ ] **Step 1: Write failing test for vector search and embedding helper**

```python
# rag-service/tests/test_vector_store.py
from unittest.mock import patch, MagicMock
from app.services.vector_store import query_vector_store

@patch("app.services.vector_store.get_upstash_index")
@patch("app.services.vector_store.embed_text")
def test_query_vector_store_returns_snippets(mock_embed, mock_index_getter):
    mock_embed.return_value = [0.1] * 768
    mock_index = MagicMock()
    mock_result = MagicMock()
    mock_result.data = "The passing grade is 2.50."
    mock_result.metadata = {"source": "CS Handbook", "category": "curriculum_and_instruction"}
    mock_index.query.return_value = [mock_result]
    mock_index_getter.return_value = mock_index

    results = query_vector_store("passing grade", top_k=1)
    assert len(results) == 1
    assert results[0]["text"] == "The passing grade is 2.50."
    assert results[0]["source"] == "CS Handbook"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest rag-service/tests/test_vector_store.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.services.vector_store'`

- [ ] **Step 3: Implement `app/core/config.py` and `app/services/vector_store.py`**

Read environment variables with `pydantic-settings` or `os.getenv`. Implement `embed_text` using `google.genai` / `langchain_google_genai` with `model="text-embedding-004"` outputting 768 dimensions. Implement `query_vector_store` using `upstash_vector.Index`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest rag-service/tests/test_vector_store.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rag-service/app/core/config.py rag-service/app/services/vector_store.py rag-service/tests/test_vector_store.py
git commit -m "feat(rag): add Upstash vector client and text-embedding-004 integration"
```

---

### Task 4: Coordinator Agent & Out-of-Scope Guardrails

**Files:**
* Create: `rag-service/app/agents/coordinator.py`
* Create: `rag-service/tests/test_coordinator.py`

**Interfaces:**
* Produces: `CoordinatorRouter`: Classifies query into one of the 7 domains or `OUT_OF_SCOPE`. Injects `student_name` and `active_course`.

- [ ] **Step 1: Write failing test for Coordinator routing and guardrail**

```python
# rag-service/tests/test_coordinator.py
from unittest.mock import patch, MagicMock
from app.agents.coordinator import classify_intent

@patch("app.agents.coordinator.get_groq_router")
def test_out_of_scope_query(mock_groq):
    mock_groq.return_value.invoke.return_value.content = '{"category": "OUT_OF_SCOPE"}'
    res = classify_intent("How do I bake a chocolate cake?")
    assert res["category"] == "OUT_OF_SCOPE"
    assert "official university academic assistant" in res["direct_reply"]

@patch("app.agents.coordinator.get_groq_router")
def test_academic_routing(mock_groq):
    mock_groq.return_value.invoke.return_value.content = '{"category": "curriculum_and_instruction"}'
    res = classify_intent("What is the prerequisite for CS202?")
    assert res["category"] == "curriculum_and_instruction"
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest rag-service/tests/test_coordinator.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.agents.coordinator'`

- [ ] **Step 3: Implement `app/agents/coordinator.py`**

Configure Groq client (`llama-3.3-70b-versatile`) with structured JSON output schema matching `{ "category": str }`. Handle `OUT_OF_SCOPE` with the standardized refusal text.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest rag-service/tests/test_coordinator.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rag-service/app/agents/coordinator.py rag-service/tests/test_coordinator.py
git commit -m "feat(rag): implement Coordinator Agent routing and out-of-scope guardrail"
```

---

### Task 5: Hierarchical LangGraph State Machine & Synthesizer

**Files:**
* Create: `rag-service/app/agents/graph.py`
* Create: `rag-service/app/agents/synthesizer.py`
* Create: `rag-service/tests/test_graph.py`

**Interfaces:**
* Produces: `rag_graph: CompiledStateGraph` executed via `rag_graph.ainvoke({"message": str, "student_name": str, "active_course": str, "history": list})`. Returns `{ "reply": str, "category": str, "sources": list[dict] }`.

- [ ] **Step 1: Write failing test for full agent graph flow**

```python
# rag-service/tests/test_graph.py
import pytest
from unittest.mock import patch, MagicMock
from app.agents.graph import build_rag_graph

@pytest.mark.asyncio
@patch("app.agents.graph.classify_intent")
@patch("app.agents.graph.query_vector_store")
@patch("app.agents.graph.get_gemini_synthesizer")
async def test_full_graph_active_domain(mock_llm, mock_vector, mock_router):
    mock_router.return_value = {"category": "curriculum_and_instruction", "direct_reply": None}
    mock_vector.return_value = [{"text": "Passing grade is 2.50.", "source": "Syllabus Sec 3"}]
    mock_llm.return_value.ainvoke.return_value.content = "Hello Alex, the passing grade is 2.50. [Syllabus Sec 3]"

    graph = build_rag_graph()
    result = await graph.ainvoke({
        "message": "What is the passing grade?",
        "student_name": "Alex",
        "active_course": "CMSC131",
        "history": []
    })
    assert result["category"] == "curriculum_and_instruction"
    assert "Alex" in result["reply"]
    assert len(result["sources"]) == 1

@pytest.mark.asyncio
@patch("app.agents.graph.classify_intent")
async def test_full_graph_under_development_stub(mock_router):
    mock_router.return_value = {"category": "facilities", "direct_reply": None}
    graph = build_rag_graph()
    result = await graph.ainvoke({
        "message": "Where is the lab located?",
        "student_name": "Alex",
        "active_course": None,
        "history": []
    })
    assert result["category"] == "facilities"
    assert "Facilities module is currently under development" in result["reply"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest rag-service/tests/test_graph.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.agents.graph'`

- [ ] **Step 3: Implement LangGraph State Graph & Synthesizer**

Assemble LangGraph `StateGraph`:
1. `coordinator_node`: Intent classification + out-of-scope check.
2. Conditional edge: If `OUT_OF_SCOPE` or domain is `UNDER_DEVELOPMENT`, route directly to `output_node` with canned notice.
3. If `ACTIVE`: Route to `retriever_node` (filters by `active_course` if matching course query), then `synthesizer_node` (Gemini 2.0 Flash formatting response with student greeting and bracketed citations).

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest rag-service/tests/test_graph.py -v`
Expected: PASS

- [ ] **Step 5: Wire graph into `app/main.py` `/api/chat` endpoint and verify end-to-end**

Add `POST /api/chat` to `rag-service/app/main.py`.
Run full pytest suite: `python -m pytest rag-service/tests/ -v`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add rag-service/app/agents/ rag-service/app/main.py rag-service/tests/
git commit -m "feat(rag): assemble LangGraph state machine with synthesis and stub branching"
```

---

### Task 6: Direct Likha ERP Ingestion Script

**Files:**
* Create: `rag-service/ingest.py`
* Create: `rag-service/tests/test_ingest.py`

**Interfaces:**
* Consumes: Likha ERP Directus endpoints (`LIKHA_URL`, `LIKHA_ADMIN_EMAIL`, `LIKHA_ADMIN_PASSWORD`).
* Produces: Normalized vector payloads upserted into Upstash Vector.

- [ ] **Step 1: Write failing test for syllabus section parsing & normalization**

```python
# rag-service/tests/test_ingest.py
from ingest import parse_syllabus_to_sections

def test_parse_syllabus_sections():
    sample_syllabus_data = {
        "courseInfo": {"description": "Intro to Computing.", "prerequisite": "None"},
        "gradingSystem": {"passingGrade": "2.50", "termFormula": "60% Class Standing + 40% Exam"},
        "courseOutcomes": [{"number": 1, "statement": "Understand basic algorithms."}]
    }
    sections = parse_syllabus_to_sections("CMSC101", "Introduction to Computing", sample_syllabus_data)
    assert len(sections) >= 3
    assert any("2.50" in s["text"] for s in sections)
    assert any(s["metadata"]["section_key"] == "grading" for s in sections)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest rag-service/tests/test_ingest.py`
Expected: FAIL with `ModuleNotFoundError: No module named 'ingest'`

- [ ] **Step 3: Implement `rag-service/ingest.py`**

Implement Directus authentication (`POST /auth/login`), fetching courses and syllabi (`GET /items/courses`), section normalization (Description, Outcomes, Grading, Outline, Policies), and batch upserting into Upstash Vector with `embed_text`.

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest rag-service/tests/test_ingest.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add rag-service/ingest.py rag-service/tests/test_ingest.py
git commit -m "feat(rag): implement Likha ERP syllabus ingestion and vector upsert script"
```

---

### Task 7: Update React Frontend to Call FastAPI Directly

**Files:**
* Modify: `client/src/shared/api/rag.ts`
* Modify: `client/src/shared/context/GabayChatContext.tsx`
* Test: `client/src/features/chat/GabayChatModal.test.tsx`

**Interfaces:**
* Consumes: FastAPI `POST /api/chat`.
* Produces: Direct connection from React chat modal to Python RAG without Express.

- [ ] **Step 1: Check existing client tests to establish baseline**

Run: `npm --prefix client test`
Expected: Tests pass on existing baseline.

- [ ] **Step 2: Update `client/src/shared/api/rag.ts`**

Point the RAG API client to the FastAPI URL (configured via `VITE_RAG_API_URL` with default `http://localhost:8000/api/chat`).
Pass `{ message, student_name, active_course, history }` in the payload.
Parse response `{ reply, category, sources }`.

- [ ] **Step 3: Run client tests to verify compatibility**

Run: `npm --prefix client test`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/shared/api/rag.ts client/src/shared/context/GabayChatContext.tsx
git commit -m "feat(client): point chat widget directly to standalone FastAPI RAG service"
```

---

### Task 8: Decommission Legacy Express Microservice

**Files:**
* Delete: `server/` directory
* Modify: `package.json` (remove server scripts)

**Interfaces:**
* Outcome: The repo is streamlined to `client/` and `rag-service/`.

- [ ] **Step 1: Remove `server/` directory and update root `package.json`**

Remove the Express service. Remove `"server"` workspaces and scripts from `package.json`.

- [ ] **Step 2: Verify root dependencies and client build**

Run: `npm run build --prefix client`
Expected: Build passes with zero errors.

- [ ] **Step 3: Commit**

```bash
git add package.json
git rm -r server/
git commit -m "refactor: decommission legacy Express server in favor of standalone FastAPI RAG"
```

---

### Task 9: Render Deployment & Keep-Alive Workflow

**Files:**
* Create: `rag-service/render.yaml`
* Create: `.github/workflows/keep-alive.yml`
* Create: `.github/workflows/sync-cron.yml`

**Interfaces:**
* Produces: Automated Render infrastructure-as-code and 24/7 keep-alive ping.

- [ ] **Step 1: Create `rag-service/render.yaml`**

```yaml
services:
  - type: web
    name: gabay-rag-service
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    plan: free
    envVars:
      - key: GEMINI_API_KEY
        sync: false
      - key: GROQ_API_KEY
        sync: false
      - key: UPSTASH_VECTOR_REST_URL
        sync: false
      - key: UPSTASH_VECTOR_REST_TOKEN
        sync: false
      - key: LIKHA_URL
        sync: false
      - key: LIKHA_ADMIN_EMAIL
        sync: false
      - key: LIKHA_ADMIN_PASSWORD
        sync: false
```

- [ ] **Step 2: Create `.github/workflows/keep-alive.yml` & `sync-cron.yml`**

Configure keep-alive ping every 10 minutes to prevent Render spin-down.
Configure nightly ingestion workflow running `python ingest.py` at 2:00 AM UTC.

- [ ] **Step 3: Commit**

```bash
git add rag-service/render.yaml .github/workflows/
git commit -m "ci(deploy): add Render configuration and GitHub Actions keep-alive workflows"
```
