# Fresh Full Benchmark, RAGAS, DCR, and Results Refresh Design

## Goal

Replace the stale September 22 benchmark evidence with a fresh, internally consistent v2 evaluation covering deterministic benchmark scoring, RAGAS Faithfulness and Answer Relevancy, cell-by-cell Data Consistency Rate, and `Results-and-discussions.docx`.

## Scope

- Fresh 140-query × 2-system benchmark from `Gabay-RAG-140-Benchmark-Queries-v2.xlsx`.
- Deterministic scoring: success, refusal correctness, routing match, tool hit, schema validity, latency, tokens.
- RAGAS Faithfulness and Answer Relevancy for all benchmark answers.
- SQL-comparator DCR for Report queries.
- Refresh of results prose and tables in `Results-and-discussions.docx`.

## Benchmark execution and data integrity

- Point benchmark execution at the existing v2 workbook.
- Archive current canonical artifacts before overwriting them; preserve dated backups.
- Run queries sequentially with the existing retry/timeout behavior.
- Do not repair failed rows post hoc; preserve REA-13-style or other genuine failures.
- Keep authentication tokens, API keys, JWTs, and n8n credentials out of the repository.
- Store intermediate scoring evidence outside committed artifacts where required by existing constraints.

## Deterministic scoring

- Recalculate all deterministic metrics only from the fresh run log.
- Preserve raw replies, task labels, latency, token counts, errors, and refusal behavior.
- Report success, refusal-template behavior, routing accuracy, tool-call hit rate, schema adherence, latency, and tokens separately by Retrieval, Response, Reasoning, and Report dimensions.
- Preserve baseline failures without re-running them into success.

## RAGAS scoring

- Use the existing NVIDIA n8n scorer as the single judge for consistency.
- Mine retrieved contexts read-only from n8n execution data.
- Complete all missing and previously error-flagged Faithfulness and Answer Relevancy cases.
- Never fabricate scores: preserve null/error outcomes and distinguish retrieval failures from scorer failures.
- Record judge identity, errors, retries, and coverage gaps.

## Data Consistency Rate

- Run the existing SQL comparator against live Likha ERP data only after snapshot-integrity checks pass.
- Report per-query DCR, micro-DCR over expected cells, and macro-DCR as the mean of query rates.
- Keep refused, empty-ground-truth, and ill-posed Report queries separate from pooled DCR means.
- Preserve ground-truth SQL, bindings, matched/expected cell counts, verdicts, and notes.

## Results document refresh

- Create a fresh timestamped backup of `Results-and-discussions.docx` before editing.
- Replace outdated prose, numbers, and tables with recalculated values.
- Preserve existing citations unless new evidence changes an interpretation.
- Verify the edited document reopens with intact headings, paragraphs, and tables.
- Do not commit the thesis binary without explicit user approval.

## Verification

- Fresh run log contains 280 uniquely ordered rows.
- Deterministic results reconcile exactly with the run log.
- RAGAS coverage is complete or has explicitly documented gaps.
- DCR workbook reconciles with ground-truth bindings and run replies.
- The refreshed Results document reconciles with all generated artifacts.
- No secrets are committed.
