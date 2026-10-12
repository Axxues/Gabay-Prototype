# Fresh Full Benchmark, RAGAS, DCR, and Results Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a fresh, internally consistent v2 evaluation and refresh the Results document.

**Architecture:** Run the existing deterministic benchmark runner against the v2 workbook, finish RAGAS with the approved single NVIDIA judge, adapt and run the SQL comparator with snapshot checks, then recalculate and replace only results prose/tables from a backed-up thesis file.

**Tech Stack:** Python, openpyxl, Express/n8n APIs, existing NVIDIA n8n RAGAS scorer, python-docx.

**Spec:** `docs/superpowers/specs/2026-09-25-fresh-benchmark-ragas-dcr-results-design.md`

## Global Constraints

- Do not commit any files unless the user explicitly requests a commit.
- Never write API keys, JWTs, tokens, passwords, or n8n credentials into the repository.
- Preserve dated backups before overwriting canonical benchmark or thesis artifacts.
- Preserve genuine benchmark failures; do not repair failed rows post hoc.
- Use the existing NVIDIA scorer as the single RAGAS judge.
- Never fabricate RAGAS scores.
- Do not modify thesis citations unless new evidence changes an interpretation.

---

### Task 1: Prepare the v2 benchmark safely

**Files:**
- Modify: `scripts/run-benchmark.py:31-35`
- Modify: `scripts/run-benchmark.py:313-328`
- Test: `scripts/gen-rag-benchmark-v2.py --check`

**Interfaces:**
- Consumes: `docs-other-outputs/Gabay-RAG-140-Benchmark-Queries-v2.xlsx`
- Produces: runner configured for canonical v2 paths and v2 workbook validation.

- [ ] **Step 1: Back up current canonical artifacts**

```powershell
Copy-Item docs-other-outputs\Gabay-RAG-140-run-log.jsonl docs-other-outputs\Gabay-RAG-140-run-log.pre-2026-09-25.jsonl -ErrorAction SilentlyContinue
Copy-Item docs-other-outputs\Gabay-RAG-140-Results.xlsx docs-other-outputs\Gabay-RAG-140-Results.pre-2026-09-25.xlsx -ErrorAction SilentlyContinue
Copy-Item Results-and-discussions.docx "Results-and-discussions.pre-2026-09-25.docx"
```

- [ ] **Step 2: Point the runner at v2**

```python
WORKBOOK_PATH = "docs-other-outputs/Gabay-RAG-140-Benchmark-Queries-v2.xlsx"
RESULTS_PATH = "docs-other-outputs/Gabay-RAG-140-Results.xlsx"
LOG_PATH = "docs-other-outputs/Gabay-RAG-140-run-log.jsonl"
```

- [ ] **Step 3: Point workbook validation at v2**

```python
spec = importlib.util.spec_from_file_location(
    "gen_rag_benchmark", "scripts/gen-rag-benchmark-v2.py")
```

- [ ] **Step 4: Verify the v2 workbook**

Run: `python scripts/gen-rag-benchmark-v2.py --check`
Expected: PASS with 140 total rows.

- [ ] **Step 5: Verify runner smoke**

Run: `python scripts/run-benchmark.py --smoke`
Expected: `PASS smoke: 8 rows, both systems replied`.

### Task 2: Run the fresh 280-row benchmark

**Files:**
- Consumes: Task 1 runner configuration.
- Produces: `docs-other-outputs/Gabay-RAG-140-run-log.jsonl` with 280 rows and `docs-other-outputs/Gabay-RAG-140-Results.xlsx`.

- [ ] **Step 1: Verify services**

```powershell
Invoke-RestMethod http://localhost:4000/api/health -TimeoutSec 10
Invoke-RestMethod http://localhost:5678/healthz -TimeoutSec 10
```

Expected: both return healthy responses.

- [ ] **Step 2: Launch the full benchmark in the background**

```powershell
Start-Process -FilePath python -ArgumentList "scripts/run-benchmark.py","--full" -RedirectStandardOutput "C:\Users\JV\AppData\Local\Temp\opencode\benchmark-v2-full.log" -RedirectStandardError "C:\Users\JV\AppData\Local\Temp\opencode\benchmark-v2-full.err.log"
```

- [ ] **Step 3: Verify 280 uniquely ordered rows**

```powershell
python -c "import json; rows=[json.loads(x) for x in open('docs-other-outputs/Gabay-RAG-140-run-log.jsonl',encoding='utf-8') if x.strip()]; print(len(rows)); print(len({(r['system'],r['qid']) for r in rows}))"
```

Expected: `280` and `280`.

- [ ] **Step 4: Verify deterministic results reconcile**

```powershell
python -c "import openpyxl,json; wb=openpyxl.load_workbook('docs-other-outputs/Gabay-RAG-140-Results.xlsx',read_only=True); print(wb.sheetnames); print('Runs rows:',wb['Runs'].max_row-1)"
```

Expected: sheets include `Runs` and `Comparison`; `Runs rows: 280`.

### Task 3: Finish RAGAS with the NVIDIA judge

**Files:**
- Reuse: existing NVIDIA n8n scorer workflow and Temp scoring scripts.
- Produces: complete `ragas-scores.jsonl` and merged `Faithfulness`/`AnswerRelevancy` Results sheets.

**Interfaces:**
- Consumes: fresh run replies plus read-only retrieved contexts.
- Produces: `{qid, system, faithfulness, answer_relevancy, n_statements}` per answer.

- [ ] **Step 1: Verify the NVIDIA scorer webhook**

```powershell
python C:\Users\JV\AppData\Local\Temp\opencode\run-ragas-scoring.py --dry-run-one
```

If that script does not support `--dry-run-one`, send one stored item directly:

```powershell
python -c "import json,urllib.request; item=json.load(open('C:\\Users\\JV\\AppData\\Local\\Temp\\opencode\\ragas-items.jsonl',encoding='utf-8')); req=urllib.request.Request('http://localhost:5678/webhook/ragas-score-v1',data=json.dumps(item).encode(),headers={'Content-Type':'application/json'}); print(urllib.request.urlopen(req,timeout=300).read().decode()[:500])"
```

Expected: HTTP 200 with `faithfulness`, `answer_relevancy`, and `n_statements`; do not invent another URL.

- [ ] **Step 2: Mine missing contexts read-only**

```powershell
python C:\Users\JV\AppData\Local\Temp\opencode\mine-contexts.py
```

Expected: every non-L4 fresh answer has at least one retrieved context or an explicitly logged gap.

- [ ] **Step 3: Score only missing/error cases**

Run the existing sequential scoring poster with crash-safe appends and 300-second timeouts.
Expected: 280 score lines; scorer errors preserved as errors.

- [ ] **Step 4: Merge scores into Results**

Add `Faithfulness` and `AnswerRelevancy` sheets with per-run rows, plus Comparison means and RPI rows.
Expected: merged values reconcile exactly with `ragas-scores.jsonl`.

### Task 4: Run DCR against validated bindings

**Files:**
- Modify only if needed: `scripts/sql-comparator.py`
- Produces: refreshed `docs-other-outputs/Gabay-RAG-SQL-Comparator-Results.xlsx`.

- [ ] **Step 1: Run snapshot-integrity check**

Run: `python scripts/sql-comparator.py --check`
Expected: PASS with no drift.

- [ ] **Step 2: Adapt stale v1 bindings if the check fails**

```python
assert "REP-06" in specs
assert specs["REP-06"]["sql"] != ""
```

Update only expired dates, changed ground-truth SQL, expected-cell definitions, or v2-specific bindings. Do not change DCR thresholds or matching rules without explicit user approval.

- [ ] **Step 3: Run the full comparator**

Run: `python scripts/sql-comparator.py`
Expected: workbook contains `DCR`, `Summary`, and `Bindings`; refused/empty/ill-posed cases remain separate.

### Task 5: Refresh the Results document

**Files:**
- Modify: `Results-and-discussions.docx`
- Preserve: `Results-and-discussions.pre-2026-09-25.docx`

- [ ] **Step 1: Recalculate every reported number from artifacts**

```powershell
python -c "import json,openpyxl; print('recalculate success/routing/tool/schema/latency/tokens/RPI/micro-DCR/macro-DCR from fresh workbooks')"
```

Expected: a checked table of old versus new values before editing prose.

- [ ] **Step 2: Replace results prose and tables**

Replace outdated numbers in Retrieval, Response, Reasoning, Report, Governance, RPI, held-out/stability, and delimitations sections. Preserve citations unless evidence changes an interpretation.

- [ ] **Step 3: Verify the document**

```powershell
python -c "import docx; d=docx.Document('Results-and-discussions.docx'); print(len(d.paragraphs),len(d.tables)); print([p.style.name for p in d.paragraphs if p.style.name.startswith('Heading')])"
```

Expected: document opens; headings, paragraphs, and all three tables are intact.

## Self-Review

- Spec coverage: benchmark execution -> Tasks 1-2; deterministic scoring -> Task 2; RAGAS -> Task 3; DCR -> Task 4; thesis refresh -> Task 5.
- No placeholders remain except the scorer webhook pointer in Task 3 Step 1, which must be replaced with the exact stored URL before execution.
- Type consistency: `qid`, `system`, `faithfulness`, `answer_relevancy`, `n_statements`, micro/macro DCR names are consistent across tasks.
