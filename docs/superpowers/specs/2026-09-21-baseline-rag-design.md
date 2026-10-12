# Baseline Single-Agent RAG Design

Date: 2026-09-21
Status: Sections 1-2 approved, pending user spec review
Approach: Clone active GABAY workflow, strip to single agent (quickest)

## 1. Objective

Provide a fair single-agent comparator for the 140-query benchmark so evaluation becomes 280 runs and Relative Performance Improvement is computable, per thesis comparative design.

## 2. Baseline Workflow (Section 1 approved)

- New n8n workflow `Baseline Single-Agent RAG (Gabay Webhook)`, cloned from active `LIKHA RAG - Retrieval Workflow (Gabay Webhook)` (id AtgiSrVPbqjgdZ9x) via API copy. Inactive during build, activated after verification.
- Webhook path `/webhook/gabay-baseline-rag` (distinct from `/webhook/gabay-rag`).
- Single Baseline agent replaces Coordinator + Courses/Learning/People/Progress sub-agents. Same model as the live RAG: mimo-v2.5 via the OpenCode OpenAI-compatible node (verified: OpenCode backs Coordinator and all sub-agents; Groq nodes exist but are unwired), same memory node, same Normalize Input code.
- All tools attached directly: RAG Courses, RAG Learning, RAG People (Qdrant gabay_prototype_rag, same topK/filters), RAG Progress scoped workflow (same student_id rule), Analytical Count, RAG Analytics.
- System prompt: same LMS scope + verbatim refusal text, answer-from-tools-only, no delegation language. Routing Accuracy for baseline = correct tool choice.
- Credentials, embeddings, sub-workflows reused from clone; no Qdrant or ERP changes.

## 3. Server Wiring + Evaluation Use (Section 2 approved)

- New env `N8N_BASELINE_WEBHOOK_URL`, documented in server/.env.example alongside existing webhook var.
- New routes `POST /api/rag-baseline/chat` and `GET /api/rag-baseline/progress/:sessionId`, mirroring existing rag routes including auth, validation, student suffix, telemetry.
- GABAY path untouched. Runner takes `--system gabay|baseline` with identical queries; results workbook gains System column; comparison sheet computes Relative Performance Improvement per metric.
- Safeguards: sequential runs, pauses, stop on repeated 5xx/auth failure; Progress only STU-2024-001; L4 prompts never trigger writes; keys server-side.

## 4. Out of Scope

- Qdrant collections, ERP schemas, ingestion changes.
- Prompt tuning beyond parity with GABAY scope text.
- TAM survey, full 140 LLM-judge scoring in this phase.

## 5. Next Step

Invoke writing-plans skill to create implementation plan for baseline build + 280-run evaluation, after user approves this spec.
