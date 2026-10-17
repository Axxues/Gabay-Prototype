# Design Document: Gabay LMS Hierarchical Multi-Agent RAG

**File:** `docs/superpowers/specs/2026-10-17-gabay-rag-design.md`  
**Date:** October 17, 2026  
**Status:** Approved Architecture (Revision 2: Express Fully Removed)  
**Project:** Gabay LMS (`d:\4thesis\GabaySystem\Gabay-Prototype`)  

---

## 1. Intent and Why

The Gabay Learning Management System (LMS) requires a scalable, grounded, and cost-effective AI assistant to serve university students and faculty across seven core institutional domains defined in the thesis.

In this updated architecture, **the legacy Express microservice (`server/`) and all prior n8n webhook integrations are completely removed.** Likha ERP (Directus at `https://gabay.zyberlab.com`) handles all core LMS entities and authentication directly, while the new **Python FastAPI service (`rag-service/`) becomes the direct, standalone multi-agent RAG backend**.

The entire architecture operates at **$0 out-of-pocket cost** with **zero credit card requirements**, deployable to Render and Upstash Vector.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
* **Standalone Python Backend:** A unified, lightweight FastAPI service running the 7-domain LangGraph multi-agent engine.
* **Direct Frontend Integration:** The React client (`client/`) communicates directly with the FastAPI backend over HTTP/SSE.
* **Coordinator Agent:** Routes queries across the 7 thesis domains, addressing students by name and contextualizing responses with their active course.
* **Extensible & Customizable Stubs:** 3 active domains (Curriculum & Instruction, Faculty, Student Support) backed by Likha ERP; 4 stubbed domains (Research, Extension, Quality Assurance, Facilities) returning standardized "under development" notices.
* **Direct Likha ERP Ingestion:** A nightly scheduled cron job queries Likha ERP (Directus REST API) directly, chunks syllabi and course records, and updates Upstash Vector.
* **Strict Out-of-Scope Guardrails:** Refuses questions outside university and academic concerns.

### Non-Goals
* No Express intermediary server (Express and legacy n8n proxy routes are completely decommissioned).
* No legacy SQL analytical aggregations or chart specs (focus is purely on the 7-domain semantic RAG).
* No direct database schema modifications to Likha ERP (strictly read-only ingestion per `AGENTS.md`).

### Anti-Goals
* No paywalled services (no Oracle Cloud with credit card traps, no Hugging Face Pro $9/mo).
* No heavy local models that breach Render's 512 MB free RAM ceiling.
* No hallucinated citations: all responses must cite source documents enclosed in brackets (`[Source / Section]`).

---

## 3. Constraints & Tech Stack Specifications

* **Compute:** Render Free Web Service (Python 3.12, 512 MB RAM, kept alive 24/7 via GitHub Actions cron).
* **Vector Database:** Upstash Vector (768 dimensions, Cosine metric, 10,000 queries/day read quota, 10,000 updates/day write quota).
* **LLM Engine:** Google AI Studio (Gemini 2.0 Flash) for subagent synthesis + Groq Cloud (Llama 3.3 70B) for instant Coordinator routing.
* **Embeddings:** Google `text-embedding-004` (768 dimensions, free tier via Google AI Studio).
* **LMS Backend:** Likha ERP / Directus (`https://gabay.zyberlab.com`) accessed directly by the client for user auth and by the ingestion script for document sync.

---

## 4. End-to-End System Architecture

```
┌────────────────────────────────────────────────────────┐
│             Gabay LMS Frontend (React / Vite)          │
│  • Authenticates directly with Likha ERP (Directus)    │
│  • Captures student name & active course view          │
└───────────────────────────┬────────────────────────────┘
                            │
                            │ POST /api/chat
                            │ Payload: { message, student_name, active_course, history }
                            ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  FastAPI Standalone Service (`rag-service/` on Render)                               │
│                                                                                      │
│  ├── CORS Middleware (Allows requests from Gabay Frontend)                           │
│  ├── In-Memory Semantic Cache (Instant response for repetitive questions)            │
│  │                                                                                   │
│  └── Coordinator Agent (Supervisor Router)                                           │
│        ├── Injects student_name & active_course                                      │
│        ├── Out-of-Scope Guardrail (Rejects non-university questions)                 │
│        └── Domain Classifier (Groq Llama 3.3): Routes to 1 of 7 Subagents           │
└───────────────────────────────────┬──────────────────────────────────────────────────┘
                                    │
    ┌───────────────────────────────┴───────────────────────────────┐
    ▼                                                               ▼
┌─────────────────────────────────────────┐     ┌──────────────────────────────────────┐
│ ACTIVE SUBAGENTS (Likha ERP Backed)     │     │ STUB SUBAGENTS (Under Development)   │
├─────────────────────────────────────────┤     ├──────────────────────────────────────┤
│ 1. Curriculum & Instruction Agent       │     │ 4. Research Agent                    │
│    (Course syllabi, lecture topics,     │     │ 5. Extension Agent                   │
│     outcomes, grading, prerequisites)   │     │ 6. Quality Assurance Agent           │
│ 2. Faculty Agent                        │     │ 7. Facilities Agent                  │
│    (Instructor profiles, departments)   │     ├──────────────────────────────────────┤
│ 3. Student Support Agent                │     │ Returns standard notice:             │
│    (Announcements, student policies)    │     │ "The [Domain] module is currently    │
├─────────────────────────────────────────┤     │ under development in Gabay..."       │
│ Queries Upstash Vector (768-dim) and    │     └──────────────────────────────────────┘
│ retrieves ground-truth text snippets.   │
└───────────────────────────────────┬─────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────────────┐
│  Synthesizer Node (Gemini 2.0 Flash)                                                 │
│  • Compiles final answer addressed to student_name                                   │
│  • Enforces document citations [Document / Section]                                  │
│  • Returns: { reply: str, sources: list[dict], category: str }                      │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Domain Configuration Registry (`rag_config.py`)

Each domain is defined in a single, customizable registry:

```python
DOMAINS_REGISTRY = {
    "curriculum_and_instruction": {
        "status": "ACTIVE",
        "description": "Course syllabi, lecture topics, course outcomes, prerequisites, and grading systems.",
        "vector_prefix": "curriculum",
    },
    "faculty": {
        "status": "ACTIVE",
        "description": "Faculty members, instructor directories, departments, and course assignments.",
        "vector_prefix": "faculty",
    },
    "student_support": {
        "status": "ACTIVE",
        "description": "Student policies, announcements, calendar events, grading formula, and general student welfare.",
        "vector_prefix": "student_support",
    },
    "research": {
        "status": "UNDER_DEVELOPMENT",
        "description": "University research projects, publications, funding, ethics clearance, and student theses.",
        "notice": "The Research module is currently under development in the Gabay System. Information regarding university research and theses will be available once this module is integrated with Likha ERP.",
    },
    "extension": {
        "status": "UNDER_DEVELOPMENT",
        "description": "Community outreach programs, university extension services, and civic partnerships.",
        "notice": "The Extension module is currently under development in the Gabay System. Information regarding community extension services will be available once this module is integrated with Likha ERP.",
    },
    "quality_assurance": {
        "status": "UNDER_DEVELOPMENT",
        "description": "Institutional accreditation, QA standards, audit rubrics, and compliance evaluations.",
        "notice": "The Quality Assurance module is currently under development in the Gabay System. Institutional QA and accreditation data will be available once this module is integrated with Likha ERP.",
    },
    "facilities": {
        "status": "UNDER_DEVELOPMENT",
        "description": "Campus buildings, computer laboratories, library guidelines, and room reservations.",
        "notice": "The Facilities module is currently under development in the Gabay System. Information regarding campus facilities and room schedules will be available once this module is integrated with Likha ERP.",
    },
}
```

---

## 6. Nightly Data Ingestion from Likha ERP

* **Schedule:** Automated GitHub Actions cron running once every 24 hours (2:00 AM UTC/local).
* **Script:** `rag-service/ingest.py`.
* **Flow:**
  1. Authenticates with Likha ERP via Directus REST API using service credentials (`LIKHA_ADMIN_EMAIL` / `LIKHA_ADMIN_PASSWORD`).
  2. Fetches published courses, syllabi, modules, and faculty directory (`/items/courses`, `/items/modules`, `/items/directus_users`).
  3. Chunks course syllabi into normalized sections (Description, Outcomes, Grading, Policies, Outline).
  4. Generates 768-dimensional embeddings via Google `text-embedding-004`.
  5. Upserts records into Upstash Vector with metadata tags (`source`, `course_code`, `category`).
* **Quota Safety:** Uses ~300 to 500 writes of the **10,000 daily update quota**, leaving the **10,000 daily query quota** 100% available for students.

---

## 7. Client Integration Contract

The React frontend (`client/src/shared/api/rag.ts`) will be updated to call FastAPI directly:
* **Endpoint:** `POST https://gabay-rag.onrender.com/api/chat` (or `http://localhost:8000/api/chat` in development).
* **Request:**
  ```json
  {
    "message": "When is the midterm exam?",
    "student_name": "Alex",
    "active_course": "CMSC131",
    "history": [
      { "role": "user", "content": "Hi" },
      { "role": "assistant", "content": "Hello Alex! How can I help you today?" }
    ]
  }
  ```
* **Response:**
  ```json
  {
    "reply": "Hello Alex! According to the CMSC 131 Course Orientation, the midterm exam is scheduled for Week 9...",
    "category": "curriculum_and_instruction",
    "sources": [
      { "label": "CMSC 131 Course Orientation", "detail": "Week 9 Midterm Examination schedule" }
    ]
  }
  ```

---

## 8. What's Left to the Builder

* Decommissioning and removing the legacy `server/` directory and unlinking it from root `package.json`.
* Creating `rag-service/` with FastAPI, LangGraph, and Upstash Vector SDK.
* Implementing the Coordinator Agent, 3 active domain subagents, and 4 under-development stubs.
* Implementing `ingest.py` connecting directly to Likha ERP Directus API.
* Updating the React frontend API client (`client/src/shared/api/rag.ts`) to point to the new FastAPI endpoint.
* Adding `.github/workflows/keep-alive.yml` for 24/7 Render zero cold starts.
