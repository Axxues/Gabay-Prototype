"""Generator for the Gabay RAG 140-query benchmark workbook.

Task 1 scaffold: defines the shared HEADER, write_sheet / load_sheet helpers,
and empty per-sheet row lists to be filled by Tasks 2-4.

Usage:
    python scripts/gen-rag-benchmark.py          # build workbook skeleton
    python scripts/gen-rag-benchmark.py --check  # validate sheet counts
"""

import sys

import openpyxl

HEADER = [
    "QueryID",
    "QueryText",
    "Complexity",
    "ExpectedAgent",
    "ExpectedTool",
    "GroundTruthSource",
    "PrimaryMetric",
    "LiteratureBasis",
]

WORKBOOK_PATH = "docs-other-outputs/Gabay-RAG-140-Benchmark-Queries.xlsx"

SHEET_NAMES = ["Retrieval", "Response", "Reasoning", "Report"]

ALLOWED_AGENTS = (
    "Courses",
    "Learning",
    "People",
    "Progress",
    "Coordinator-direct",
)

L4_REFUSAL_TEXT = (
    "I am sorry, but I can only answer questions related to the Gabay LMS "
    "prototype. My scope is strictly limited to LMS matters such as courses "
    "and enrollment, learning content and assessments, people and calendar, "
    "grades and progress. How can I assist you with the LMS today?"
)

# Row lists filled in by later tasks. Task 2: RETRIEVAL_ROWS + RESPONSE_ROWS.
# Task 3: REASONING_ROWS. Task 4: REPORT_ROWS.
RETRIEVAL_ROWS = []
RESPONSE_ROWS = []
REASONING_ROWS = []
REPORT_ROWS = []

ROWS_BY_SHEET = {
    "Retrieval": RETRIEVAL_ROWS,
    "Response": RESPONSE_ROWS,
    "Reasoning": REASONING_ROWS,
    "Report": REPORT_ROWS,
}


def write_sheet(wb, name, rows):
    ws = wb.create_sheet(name) if name not in wb.sheetnames else wb[name]
    ws.delete_rows(1, ws.max_row)
    ws.append(HEADER)
    for r in rows:
        ws.append([r[h] for h in HEADER])
    ws.freeze_panes = "A2"
    ws.auto_filter.ref = ws.dimensions


def load_sheet(name, path=WORKBOOK_PATH):
    wb = openpyxl.load_workbook(path)
    ws = wb[name]
    keys = [c.value for c in ws[1]]
    return [dict(zip(keys, [c.value for c in row])) for row in list(ws.rows)[1:]]


def validate_counts(sheets):
    expected = {"Retrieval": 50, "Response": 50, "Reasoning": 20, "Report": 20}
    for name, want in expected.items():
        got = len(sheets.get(name, []))
        assert got == want, f"{name}: got {got} want {want}"


def check_workbook(path=WORKBOOK_PATH):
    try:
        sheets = {name: load_sheet(name, path) for name in SHEET_NAMES}
    except (FileNotFoundError, KeyError) as exc:
        return [f"workbook unreadable: {exc}"]
    try:
        validate_counts(sheets)
    except AssertionError as exc:
        return [f"FAIL {exc}"]
    return []


def build_workbook(path=WORKBOOK_PATH):
    wb = openpyxl.Workbook()
    wb.remove(wb.active)
    for name in SHEET_NAMES:
        write_sheet(wb, name, ROWS_BY_SHEET[name])
    wb.save(path)


def main(argv):
    if "--check" in argv:
        errors = check_workbook()
        if errors:
            for line in errors:
                print(line)
            return 1
        print("PASS all sheet counts valid")
        return 0
    build_workbook()
    print(f"PASS skeleton builds: {WORKBOOK_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
