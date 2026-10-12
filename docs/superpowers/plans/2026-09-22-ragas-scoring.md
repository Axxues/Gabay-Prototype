# Ragas Faithfulness + Answer Relevancy Scoring Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Score Faithfulness and Answer Relevancy for all 280 benchmark answers inside n8n (reusing stored LLM credentials) and merge results into Results.xlsx + thesis Chapter 3.

**Architecture:** Python mines retrieved contexts from the n8n SQLite execution store; a new n8n scoring workflow runs the LLM-as-a-Judge chains (statement decomposition + verdicts for Faithfulness; 3-question generation + embedding cosine for Answer Relevancy); Python merges scores and updates deliverables.

**Tech Stack:** n8n API + Groq/Gemini credentialed nodes, Python (sqlite3, urllib, openpyxl), python-docx for thesis update.

**Spec:** Thesis Data Analysis section in `THESIS-GABAY-v5.docx` (Faithfulness = supported claims / total claims; Answer Relevancy = mean cosine(original query, 3 generated questions)); benchmark log `docs-other-outputs/Gabay-RAG-140-run-log.jsonl` (280 rows); `docs-other-outputs/Gabay-RAG-140-Results.xlsx`.

## Global Constraints

- Never write API keys, JWTs, or tokens into the repo; intermediates live in `C:\Users\JV\AppData\Local\Temp\opencode\` only.
- Never commit `server/.env`, `scripts/.baseline-id`, or thesis docx binaries without explicit user approval.
- Do NOT modify `Gabay-RAG-140-run-log.jsonl` row order or existing deterministic scores; scores append as new files/sheets.
- Baseline REA-13 failure row stays untouched.
- n8n API key is read at runtime from `C:\Users\JV\AppData\Local\Temp\opencode\n8nkey.txt`, never printed or committed.
- Thesis edits require a fresh timestamped backup copy first.

---

### Task 1: Verify judge credentials work in n8n

**Files:**
- Create: `C:\Users\JV\AppData\Local\Temp\opencode\probe-judge.py` (outside repo)
- Uses: n8n API `POST /api/v1/workflows` (import), `POST /api/v1/executions` trigger via webhook

**Interfaces:**
- Consumes: n8n API key file (path above)
- Produces: probe execution result `ok=true` with non-empty LLM text (gates Task 3)

- [ ] **Step 1: Create minimal probe workflow JSON (manual trigger -> Groq gpt-oss-20b chain -> Set output)**

```python
wf = {
  "name": "PROBE ragas judge - DELETE ME",
  "nodes": [
    {"parameters": {}, "name": "Manual", "type": "n8n-nodes-base.manualTrigger", "typeVersion": 1, "position": [0, 0]},
    {"parameters": {"messages": {"values": [{"content": "Reply with exactly: JUDGE_OK"}]},
                    "options": {}},
     "name": "Groq probe", "type": "@n8n/n8n-nodes-langchain.lmChatGroq", "typeVersion": 1,
     "position": [200, 0],
     "credentials": {"groqApi": {"id": None, "name": None}}},  # fill id from existing Coordinator Groq Model node
  ],
  "connections": {"Manual": {"main": [[{"node": "Groq probe", "type": "main", "index": 0}]]}},
}
```

- [ ] **Step 2: Fill credential id by copying it from the existing `Coordinator Groq Model (120B)` node**

Run: `py -3 C:\Users\JV\AppData\Local\Temp\opencode\check-models.py` (already exists) to confirm node names; fetch workflow `AtgiSrVPbqjgdZ9x` via API and copy the exact `credentials.groqApi` object into the probe node.

Expected: exact credential object copied, no guessing.

- [ ] **Step 3: Import probe, execute once, verify output contains JUDGE_OK**

Run: script imports workflow, triggers manual execution via API, polls execution status, prints final output.
Expected: PASS with JUDGE_OK text. If FAIL (auth/quota), stop and report to user before Task 3.

- [ ] **Step 4: Delete probe workflow via API**

Run: `DELETE /api/v1/workflows/<probeId>`
Expected: 200, probe gone.

### Task 2: Prove contexts are minable from execution_data

**Files:**
- Create: `C:\Users\JV\AppData\Local\Temp\opencode\mine-contexts-probe.py`

**Interfaces:**
- Consumes: `C:/Users/JV/n8n_data/database.sqlite` (read-only URI mode)
- Produces: printed chunk counts for 3 sample sessions (gates Task 3 file format)

- [ ] **Step 1: Write probe that finds executions for sessions `bench-RET-01-gabay`, `bench-RET-01-baseline`, `bench-RES-01-gabay`**

```python
import sqlite3, json
db = sqlite3.connect('file:C:/Users/JV/n8n_data/database.sqlite?mode=ro', uri=True)
for sess in ('bench-RET-01-gabay', 'bench-RET-01-baseline', 'bench-RES-01-gabay'):
    row = db.execute(
      "SELECT e.id, d.data FROM execution_data d JOIN execution_entity e ON e.id=d.executionId "
      "WHERE d.data LIKE ? ORDER BY e.id DESC LIMIT 1", ('%'+sess+'%',)).fetchone()
    print(sess, '-> execution', row[0] if row else None)
```

- [ ] **Step 2: Dump node names in runData and search outputs for document-ish text (pageContent / text / content fields)**

Run: extend probe to dereference runData (same pattern as `server/src/utils/n8nTelemetry.ts:48-65`) and print, per node, the count of string fields longer than 200 chars.
Expected: at least one vectorStore/RAG/tool node per execution with >=1 long text chunk.

- [ ] **Step 3: Lock the extraction rule (exact node-name patterns + JSON paths) and print 2 sample chunks**

Expected: 2 readable institutional text chunks printed; these paths become the contract for Task 3.

### Task 3: Build full contexts dataset (280 items)

**Files:**
- Create: `C:\Users\JV\AppData\Local\Temp\opencode\mine-contexts.py`
- Produces: `C:\Users\JV\AppData\Local\Temp\opencode\ragas-items.jsonl` (one line per run: qid, system, sheet, question, answer, contexts[])

**Interfaces:**
- Consumes: extraction rule from Task 2; run log for (question, answer) pairs
- Produces: items file with exactly 280 lines (consumed by Task 5)

- [ ] **Step 1: Write miner that iterates all 280 log rows, finds matching execution by session `bench-<QID>-<system>`, extracts chunks**

```python
# for each log row: session = row['session']; find execution_data LIKE session;
# apply Task-2 extraction rule; record {'qid','system','sheet','question': row['query_text'],
# 'answer': row['reply'], 'contexts': [...]}
# L4 rows: contexts expected empty (refusals need no retrieval) -> record with contexts: [] and flag l4_refusal: true
```

- [ ] **Step 2: Run miner, verify 280 lines and report contexts coverage**

Run: `py -3 C:\Users\JV\AppData\Local\Temp\opencode\mine-contexts.py`
Expected: 280 lines; report `nonempty_contexts` count; every non-L4 gabay/baseline item has >=1 chunk. L4 items flagged.

- [ ] **Step 3: Handle gaps (missing execution or empty chunks on non-L4) by re-querying read-only retrieval (Qdrant via server export endpoints) — only for gap items, logged explicitly**

Expected: gap list printed; each gap either filled (source noted) or escalated to user.

### Task 4: Build n8n Ragas scoring workflow

**Files:**
- Create: `C:\Users\JV\AppData\Local\Temp\opencode\ragas-scorer-workflow.json` (workflow definition, importable)
- Uses: Webhook trigger (POST one item) -> Faithfulness chain -> Relevancy chain -> Respond with scores

**Interfaces:**
- Consumes: item JSON `{qid, system, question, answer, contexts[]}`
- Produces: `{qid, system, faithfulness, answer_relevancy, n_statements}` (consumed by Task 5)

- [ ] **Step 1: Faithfulness sub-chain (Code/LLM nodes)**

Chain A (decompose): Groq chat model prompt `Split the ANSWER into atomic factual statements, one per line. No commentary.` input: answer.
Chain B (loop over statements, verdict): for each statement, Groq prompt `Given CONTEXTS, is STATEMENT fully supported? Reply exactly SUPPORTED or UNSUPPORTED.` Faithfulness = supported/total. L4 refusals (contexts empty): score 1.0 if answer is a refusal, 0.0 otherwise (rule node, no LLM call).

- [ ] **Step 2: Relevancy sub-chain**

Chain C: Groq prompt `Generate exactly 3 distinct candidate questions that this ANSWER would answer. One per line.` Chain D: Embeddings HuggingFace Inference node embeds original question + 3 candidates; Code node computes mean cosine similarity -> answer_relevancy in [0,1].

- [ ] **Step 3: Pacing + robustness**

Add Wait 2s between items (caller-side pacing also in Task 5); on LLM 429/500, node retry (n8n retryOnFail: 2, wait 10s) then return error flag, never a fake score.

- [ ] **Step 4: Import workflow and test on 3 items (one L1, one L3, one L4)**

Run: import via API, POST 3 sample items, print scores.
Expected: all scores in [0,1]; L4 refusal faithfulness 1.0; latencies logged.

### Task 5: Score all 280 items

**Files:**
- Create: `C:\Users\JV\AppData\Local\Temp\opencode\run-ragas-scoring.py`
- Produces: `C:\Users\JV\AppData\Local\Temp\opencode\ragas-scores.jsonl`

**Interfaces:**
- Consumes: items file (Task 3), scoring webhook URL (Task 4)
- Produces: 280 score lines `{qid, system, faithfulness, answer_relevancy, n_statements}`

- [ ] **Step 1: Write sequential poster (3s pause, resume-from-QID support, retry once then mark error and continue)**

```python
# POST each item to scoring webhook (timeout 300); append result line immediately (crash-safe);
# --resume-from QID skips already-scored lines; errors recorded with error text, never fabricated
```

- [ ] **Step 2: Run to 280 scored lines (re-runner may take hours; process survives shell exit via Start-Process)**

Expected: 280 lines; error count reported; any error items investigated before merge.

### Task 6: Merge scores into Results.xlsx

**Files:**
- Modify: `docs-other-outputs/Gabay-RAG-140-Results.xlsx` (add sheets, extend Comparison)
- Test: rerun `workbook_check()` from `scripts/run-benchmark.py` (must still PASS 140)

**Interfaces:**
- Consumes: scores file (Task 5)
- Produces: new sheets `Faithfulness`, `AnswerRelevancy` (per-run rows) + 2 new Comparison rows with RPI

- [ ] **Step 1: Write merger (openpyxl): per-system means for both metrics, RPI rows, per-sheet breakdown columns**

```python
# Faithfulness sheet rows: System, Sheet, QueryID, Score, N_Statements
# Comparison append: Faithfulness (RPI), AnswerRelevancy (RPI) with same RPI formula
```

- [ ] **Step 2: Run merger + workbook check**

Run: merger script, then `workbook_check()` equivalent.
Expected: xlsx updated; workbook total still 140 PASS.

### Task 7: Update thesis Chapter 3 (Faithfulness + Answer Relevancy reported)

**Files:**
- Modify: `THESIS-GABAY-v5.docx` (backup first: `THESIS-GABAY-v5-preRagas-<date>.docx`)
- Add: 2 subsections under Chapter 3 + extend Table 5 with 2 rows; soften Delimitations item (a)

**Interfaces:**
- Consumes: merged means + RPI values from Task 6
- Produces: verifiable chapter text (reopen + spot-check paragraph/table counts)

- [ ] **Step 1: Backup docx, insert Faithfulness + Answer Relevancy subsections with exact computed numbers**

Expected: numbers match Task 6 output to 4 decimals; citations reuse existing reference list only.

- [ ] **Step 2: Reopen and verify (paragraph count increased, tables intact, no other chapters touched)**

Expected: verification script output confirming counts.

## Self-Review

- Spec coverage: Ch2 formulas for Faithfulness/Answer Relevancy -> Tasks 4-5; RPI extension -> Task 6; 140-query full coverage -> Tasks 3,5 (280 answers incl. both systems); deterministic methodology untouched -> Global Constraints.
- Context Precision / Recall and SQL Data Consistency are NOT in this plan (separate future work; delimitations text stays for those).
- No placeholders: every task names exact files, API endpoints, and expected outputs.
