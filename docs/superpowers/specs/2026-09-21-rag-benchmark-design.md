# Gabay RAG 140-Query Benchmark Design

Date: 2026-09-21
Status: Approved sections 1-3, pending user spec review
Approach: Institutional-grounded + literature-structured (Approach 1)

## 1. Objective

Evaluate technical performance of the LIKHA RAG Retrieval Workflow (Gabay Webhook) on n8n connected to Gabay Prototype, using 140 standardized benchmark queries across 4 sub-objectives and 4 complexity levels. Update THESIS-GABAY-v5.docx Table 3 from 155 to 140 to reflect 4-agent prototype scope.

## 2. Verified Prototype Scope

Workflow: LIKHA RAG - Retrieval Workflow (Gabay Webhook), id AtgiSrVPbqjgdZ9x, active, 25 nodes, verified via n8n API on 2026-09-21.

- Coordinator_Agent: strict scope refusal verbatim, greetings/identity direct without tools, delegates in-scope LMS queries only, no emojis, no internal names leaked.
- Courses_Agent: course, course_section, enrollment_request, course_summary. Qdrant gabay_prototype_rag domain=courses topK 30.
- Learning_Agent: module, module_item, activity, quiz, exam, announcement, learning_summary. Domain=learning topK 30.
- People_Agent: user_directory, calendar_event, message_meta metadata-only, people_summary. Domain=people topK 25.
- Progress: Coordinator calls RAG Progress scoped workflow directly with student_id copied exactly from (My student ID is <id>.) suffix. Per-requester privacy.
- Analytical Count: exact totals via full scroll, required for counts/graphs/reports. Analytics workflow for count/sum/avg/min/max/rows.

Thesis assumes 7 domain agents. Prototype implements 4. Reasoning reduced accordingly.

## 3. Distribution (Section 1 approved)

| Sub-Objective | L1 Easy | L2 Moderate | L3 Complex | L4 Out-of-Scope | Total |
|---|---|---|---|---|---|
| Retrieval Accuracy | 12 | 16 | 12 | 10 | 50 |
| Response Quality | 12 | 16 | 12 | 10 | 50 |
| Reasoning Capability | 4 | 7 | 6 | 3 | 20 |
| Report Generation | 4 | 6 | 6 | 4 | 20 |
| Total | 32 | 45 | 36 | 27 | 140 |

Reasoning tiers test routine single-hop routing (L1), 2-step same-domain orchestration (L2), cross-agent coordination (L3), negative refusal governance (L4).

## 4. Excel Schema + Reasoning Breakdown (Section 2 approved)

Workbook: docs-other-outputs/Gabay-RAG-140-Benchmark-Queries.xlsx, 4 sheets.

Columns: QueryID, QueryText, Complexity, ExpectedAgent, ExpectedTool, GroundTruthSource, PrimaryMetric, LiteratureBasis.

- ExpectedAgent: Courses, Learning, People, Progress, Coordinator-direct.
- ExpectedTool: RAG Courses, RAG Learning, RAG People, RAG Progress, Analytical Count, Analytics, None.
- PrimaryMetric: Routing Accuracy all Reasoning, plus Multi-Step Pass Rate L2/L3.

Reasoning 20:
- L1 (4): 1x Courses catalog, 1x Learning module, 1x People directory, 1x Progress own-grade.
- L2 (7): 2x Courses, 2x Learning, 2x People, 1x Progress, each 2-step same domain.
- L3 (6): Courses+People, Learning+Progress, Courses+Learning, People+Progress, Courses+Progress, Learning+People.
- L4 (3): trivia, coding, sports, expect Coordinator refusal verbatim: I am sorry, but I can only answer questions related to the Gabay LMS prototype. My scope is strictly limited to LMS matters such as courses and enrollment, learning content and assessments, people and calendar, grades and progress. How can I assist you with the LMS today? Zero sub-agent calls.

## 5. Generation Rules + Thesis Update (Section 3 approved)

Rules:
- Executable via POST /webhook/gabay-rag. Progress queries include student_id suffix. Never invent IDs.
- Counts from summary docs + Analytical Count. Never count top-K chunks.
- People message queries metadata-only. Progress per-requester only.
- L4 expects refusal text exactly, no tools.
- Literature tags: Es et al. 2024 for 50-item stability, Chen et al. 2024 for benchmarking, Park and Kwon 2026 for swarm routing, Asai et al. 2024 for gating, Data Privacy Act 2012 for L4.

Thesis edits:
- Table 3 Reasoning row 8/12/10/5/35 to 4/7/6/3/20. Total row 36/50/40/29/155 to 32/45/36/27/140.
- Paragraphs 277, 278, 303, 312, 317, 324: 155 to 140 with footnote on 4-agent prototype vs 7-agent full architecture.

## 6. Out of Scope

- No execution of queries against live n8n in this spec phase.
- No changes to workflow prompts or Qdrant collections.
- No TAM survey changes.

## 7. Next Step

Invoke writing-plans skill to create implementation plan for generating the Excel workbook, after user approves this spec.
