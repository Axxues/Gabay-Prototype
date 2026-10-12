# Gabay RAG 140-Query Benchmark Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate Excel workbook with 140 literature-grounded benchmark queries for LIKHA RAG webhook evaluation.

**Architecture:** Single Python generator script writes 4-sheet workbook with frozen headers and validation. Queries grounded in verified n8n agent scopes and prototype ERP collections, tiered per Es 2024, Chen 2024, Park and Kwon 2026.

**Tech Stack:** Python 3, openpyxl 3.1.5, n8n API verified workflow AtgiSrVPbqjgdZ9x, Qdrant gabay_prototype_rag.

**Spec:** docs/superpowers/specs/2026-09-21-rag-benchmark-design.md

## Global Constraints

- Reasoning total is 20 with split L1=4 L2=7 L3=6 L4=3, workbook total 140.
- Agents allowed only: Courses, Learning, People, Progress, Coordinator-direct.
- Qdrant collection is gabay_prototype_rag with domain filters courses, learning, people.
- Progress queries require per-requester student_id privacy, never reveal other students.
- L4 refusal text verbatim: I am sorry, but I can only answer questions related to the Gabay LMS prototype. My scope is strictly limited to LMS matters such as courses and enrollment, learning content and assessments, people and calendar, grades and progress. How can I assist you with the LMS today?
- No emojis in queries or workbook content.

---

### Task 1: Scaffold generator and workbook skeleton

**Files:**
- Create: `scripts/gen-rag-benchmark.py`
- Create: `docs-other-outputs/Gabay-RAG-140-Benchmark-Queries.xlsx`
- Test: `scripts/gen-rag-benchmark.py` self-check function

**Interfaces:**
- Consumes: Spec distribution table and n8n scopes.
- Produces: `HEADER = ["QueryID","QueryText","Complexity","ExpectedAgent","ExpectedTool","GroundTruthSource","PrimaryMetric","LiteratureBasis"]` and `write_sheet(wb, name, rows)` used by Tasks 2-5.

- [ ] **Step 1: Write failing validation**

```python
def validate_counts(sheets):
    expected = {"Retrieval": 50, "Response": 50, "Reasoning": 20, "Report": 20}
    for name, want in expected.items():
        got = len(sheets.get(name, []))
        assert got == want, f"{name}: got {got} want {want}"
```

- [ ] **Step 2: Run validation to verify it fails**

Run: `python scripts/gen-rag-benchmark.py --check`
Expected: FAIL with Retrieval: got 0 want 50

- [ ] **Step 3: Write minimal scaffold**

```python
import openpyxl
HEADER = ["QueryID","QueryText","Complexity","ExpectedAgent","ExpectedTool","GroundTruthSource","PrimaryMetric","LiteratureBasis"]
def write_sheet(wb, name, rows):
    ws = wb.create_sheet(name) if name not in wb.sheetnames else wb[name]
    ws.delete_rows(1, ws.max_row)
    ws.append(HEADER)
    for r in rows:
        ws.append([r[h] for h in HEADER])
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions
def load_sheet(name):
    import openpyxl
    wb = openpyxl.load_workbook("docs-other-outputs/Gabay-RAG-140-Benchmark-Queries.xlsx")
    ws = wb[name]
    keys = [c.value for c in ws[1]]
    return [dict(zip(keys, [c.value for c in row])) for row in list(ws.rows)[1:]]
if __name__ == "__main__":
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for s in ["Retrieval","Response","Reasoning","Report"]:
        write_sheet(wb, s, [])
    wb.save("docs-other-outputs/Gabay-RAG-140-Benchmark-Queries.xlsx")
```

- [ ] **Step 4: Run to verify skeleton builds**

Run: `python scripts/gen-rag-benchmark.py`
Expected: PASS, xlsx exists with 4 empty sheets plus header.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-rag-benchmark.py docs-other-outputs/Gabay-RAG-140-Benchmark-Queries.xlsx
git commit -m "feat: scaffold rag benchmark workbook"
```

### Task 2: Retrieval 50 plus Response 50

**Files:**
- Modify: `scripts/gen-rag-benchmark.py:40-120`
- Modify: `docs-other-outputs/Gabay-RAG-140-Benchmark-Queries.xlsx` sheets Retrieval, Response
- Test: count check Retrieval 50 Response 50

**Interfaces:**
- Consumes: HEADER, write_sheet from Task 1.
- Produces: RETRIEVAL_ROWS (50 dicts), RESPONSE_ROWS (50 dicts) with IDs RET-01..50, RES-01..50.

- [ ] **Step 1: Write failing test**

```python
rows = load_sheet("Retrieval")
assert len(rows) == 50
assert sum(1 for r in rows if r["Complexity"]=="L1")==12
assert sum(1 for r in rows if r["Complexity"]=="L2")==16
assert sum(1 for r in rows if r["Complexity"]=="L3")==12
assert sum(1 for r in rows if r["Complexity"]=="L4")==10
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python scripts/gen-rag-benchmark.py --check`
Expected: FAIL Retrieval count.

- [ ] **Step 3: Write minimal rows**

```python
RETRIEVAL_ROWS = [
  {"QueryID":"RET-01","QueryText":"List all published courses with codes and titles.","Complexity":"L1","ExpectedAgent":"Courses","ExpectedTool":"RAG Courses","GroundTruthSource":"course","PrimaryMetric":"Context Recall","LiteratureBasis":"Es et al. 2024"},
  # ... add remaining to reach 12 L1, 16 L2, 12 L3, 10 L4 using course, module, user_directory, submission collections
]
RESPONSE_ROWS = [
  {"QueryID":"RES-01","QueryText":"Summarize the published modules for CMSC 131 without adding facts.","Complexity":"L1","ExpectedAgent":"Learning","ExpectedTool":"RAG Learning","GroundTruthSource":"module","PrimaryMetric":"Faithfulness","LiteratureBasis":"Es et al. 2024"},
  # ... add remaining to reach 12 L1, 16 L2, 12 L3, 10 L4, each answerable from retrieved context
]
```

Full 100 rows must use institutional collections: course, course_section, enrollment_request, module, activity, quiz, exam, announcement, user_directory, calendar_event, submission, course_grade. L4 rows expect refusal with ExpectedTool None.

- [ ] **Step 4: Run test to verify it passes**

Run: `python scripts/gen-rag-benchmark.py --check`
Expected: PASS Retrieval 50 and Response 50 with correct tier splits.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-rag-benchmark.py docs-other-outputs/Gabay-RAG-140-Benchmark-Queries.xlsx
git commit -m "feat: add retrieval and response benchmark queries"
```

### Task 3: Reasoning 20 core

**Files:**
- Modify: `scripts/gen-rag-benchmark.py:120-160`
- Modify: `docs-other-outputs/Gabay-RAG-140-Benchmark-Queries.xlsx` sheet Reasoning
- Test: Reasoning tier split 4/7/6/3 and agent routing

**Interfaces:**
- Consumes: HEADER, write_sheet.
- Produces: REASONING_ROWS (20 dicts) IDs REA-01..20.

- [ ] **Step 1: Write failing test**

```python
rows = load_sheet("Reasoning")
assert len(rows)==20
assert sum(1 for r in rows if r["Complexity"]=="L1")==4
assert sum(1 for r in rows if r["Complexity"]=="L2")==7
assert sum(1 for r in rows if r["Complexity"]=="L3")==6
assert sum(1 for r in rows if r["Complexity"]=="L4")==3
agents = {r["ExpectedAgent"] for r in rows if r["Complexity"]!="L4"}
assert {"Courses","Learning","People","Progress"} <= agents
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python scripts/gen-rag-benchmark.py --check`
Expected: FAIL Reasoning count.

- [ ] **Step 3: Write minimal rows**

```python
REASONING_ROWS = [
  {"QueryID":"REA-01","QueryText":"What is the course code and title for the published programming course?","Complexity":"L1","ExpectedAgent":"Courses","ExpectedTool":"RAG Courses","GroundTruthSource":"course","PrimaryMetric":"Agent Routing Accuracy","LiteratureBasis":"Park & Kwon 2026"},
  {"QueryID":"REA-02","QueryText":"List published modules for my enrolled course.","Complexity":"L1","ExpectedAgent":"Learning","ExpectedTool":"RAG Learning","GroundTruthSource":"module","PrimaryMetric":"Agent Routing Accuracy","LiteratureBasis":"Park & Kwon 2026"},
  {"QueryID":"REA-03","QueryText":"Find the faculty member for Computer Science department.","Complexity":"L1","ExpectedAgent":"People","ExpectedTool":"RAG People","GroundTruthSource":"user_directory","PrimaryMetric":"Agent Routing Accuracy","LiteratureBasis":"Park & Kwon 2026"},
  {"QueryID":"REA-04","QueryText":"Show my submission grades for this term.","Complexity":"L1","ExpectedAgent":"Progress","ExpectedTool":"RAG Progress","GroundTruthSource":"submission","PrimaryMetric":"Agent Routing Accuracy","LiteratureBasis":"Park & Kwon 2026"},
  # L2 REA-05..11: 2 Courses, 2 Learning, 2 People, 1 Progress two-step same-domain
  # L3 REA-12..17: Courses+People, Learning+Progress, Courses+Learning, People+Progress, Courses+Progress, Learning+People
  # L4 REA-18..20: out-of-scope trivia/coding/sports with ExpectedAgent Coordinator-direct ExpectedTool None
]
```

Expand comments into full dicts following the same 8-column shape. L2/L3 PrimaryMetric is Agent Routing Accuracy + Multi-Step Pass Rate.

- [ ] **Step 4: Run test to verify it passes**

Run: `python scripts/gen-rag-benchmark.py --check`
Expected: PASS Reasoning 20 with 4/7/6/3.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-rag-benchmark.py docs-other-outputs/Gabay-RAG-140-Benchmark-Queries.xlsx
git commit -m "feat: add reasoning benchmark queries"
```

### Task 4: Report 20 and final validation

**Files:**
- Modify: `scripts/gen-rag-benchmark.py:160-200`
- Modify: `docs-other-outputs/Gabay-RAG-140-Benchmark-Queries.xlsx` sheet Report
- Test: full 140 validation and thesis note

**Interfaces:**
- Consumes: All row lists from Tasks 1-3.
- Produces: REPORT_ROWS (20 dicts) IDs REP-01..20, final workbook validated.

- [ ] **Step 1: Write failing test**

```python
rows = load_sheet("Report")
assert len(rows)==20
assert sum(1 for r in rows if r["Complexity"]=="L1")==4
assert sum(1 for r in rows if r["Complexity"]=="L2")==6
assert sum(1 for r in rows if r["Complexity"]=="L3")==6
assert sum(1 for r in rows if r["Complexity"]=="L4")==4
total = sum(len(load_sheet(s)) for s in ["Retrieval","Response","Reasoning","Report"])
assert total==140
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python scripts/gen-rag-benchmark.py --check`
Expected: FAIL Report count.

- [ ] **Step 3: Write minimal rows**

```python
REPORT_ROWS = [
  {"QueryID":"REP-01","QueryText":"Generate a table of all courses with enrolled counts.","Complexity":"L1","ExpectedAgent":"Courses","ExpectedTool":"Analytical Count","GroundTruthSource":"course","PrimaryMetric":"Data Consistency Rate","LiteratureBasis":"Tiwari et al. 2026"},
  # ... add to reach 4 L1, 6 L2, 6 L3, 4 L4 using Analytical Count and Analytics tools, schema-adherent tables
]
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python scripts/gen-rag-benchmark.py --check`
Expected: PASS total 140.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-rag-benchmark.py docs-other-outputs/Gabay-RAG-140-Benchmark-Queries.xlsx
git commit -m "feat: add report queries complete 140 benchmark"
```

### Task 5: Update thesis Table 3 to 140

**Files:**
- Modify: `THESIS-GABAY-v5.docx` Table 6 (Table 3 in text) and paragraphs 277, 278, 303, 312, 317, 324
- Test: `scripts/check-thesis.py`

**Interfaces:**
- Consumes: Validated workbook totals from Task 4.
- Produces: Thesis table Reasoning row 4/7/6/3 total 20, Total row 32/45/36/27 total 140.

- [ ] **Step 1: Write failing check**

```python
from docx import Document
doc = Document("THESIS-GABAY-v5.docx")
t = doc.tables[6]
vals = [[c.text.strip() for c in row.cells] for row in t.rows]
assert vals[3] == ["Reasoning Capability", "4", "7", "6", "3", "20"]
assert vals[5] == ["Total", "32", "45", "36", "27", "140"]
```

- [ ] **Step 2: Run check to verify it fails**

Run: `python scripts/check-thesis.py`
Expected: FAIL with current 8/12/10/5/35 values.

- [ ] **Step 3: Apply thesis edit**

```python
from docx import Document
doc = Document("THESIS-GABAY-v5.docx")
t = doc.tables[6]
t.rows[3].cells[1].text = "4"
t.rows[3].cells[2].text = "7"
t.rows[3].cells[3].text = "6"
t.rows[3].cells[4].text = "3"
t.rows[3].cells[5].text = "20"
t.rows[5].cells[1].text = "32"
t.rows[5].cells[2].text = "45"
t.rows[5].cells[3].text = "36"
t.rows[5].cells[4].text = "27"
t.rows[5].cells[5].text = "140"
for p in doc.paragraphs:
    if "one hundred fifty-five (155)" in p.text.lower():
        p.text = p.text.replace("155", "140").replace("One hundred fifty-five", "One hundred forty")
doc.save("THESIS-GABAY-v5.docx")
```

- [ ] **Step 4: Run check to verify it passes**

Run: `python scripts/check-thesis.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add THESIS-GABAY-v5.docx scripts/check-thesis.py
git commit -m "docs: update benchmark table to 140 queries"
```
