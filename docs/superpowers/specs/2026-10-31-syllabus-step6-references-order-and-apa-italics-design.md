# Syllabus Studio Section 6 — References: Alphabetical Order & APA Italics

Date: 2026-10-31
Status: awaiting approval

## Intent and why

Syllabus Studio Step 6 ("References") stores references in the order the faculty
member types them, and renders each one as a flat, unformatted string. Two problems
follow:

1. The printed/saved syllabus is not in APA 7 order — reference lists must be
   alphabetized.
2. APA 7 requires italics (book/page titles, journal names and volume numbers), and
   today the citation is a single plain string, so italics are impossible. The
   printed document's "Part V: References" is additionally hardcoded sample text
   (`SyllabusDocumentPreview.tsx` lines ~1410–1443) and ignores the user's real
   references entirely.

## Goals

- References added/updated in Studio Step 6 are stored alphabetically (APA key).
- Reference text is rendered with correct APA italics in Studio Step 6 and the saved
  syllabus view.
- The printed/PDF document preview renders the real, alphabetized, italicized
  references instead of sample text.
- Ordering survives to the backend and every read surface without schema changes.

## Non-goals

- No change to the Directus/Likha schema or the `references` JSON payload shape.
- No automatic sentence-case/title-case rewriting of user-entered titles.
- No new server-side Word/PDF export pipeline.
- No re-ordering of already-published syllabi at read time.

## Anti-goals (would count as failure)

- Storing HTML (`<em>`) inside the `citation` string — breaks plain-text export, RAG
  ingestion, and opens an injection path.
- Sorting the display list only while storage stays unsorted (print stays unordered).
- Sorting in place (mutating `data.references`) or re-sorting while a user is typing.
- Breaking index-based edit/remove handlers in Step 6 by re-ordering mid-edit.

## Constraints

- `formatApa7Reference()` lives in `client/src/shared/data/syllabusData.ts` and is the
  single formatter used by Step 6; `citation` is persisted as a flat string.
- Step 6's list uses `editingIndex` and `removeReference(index)`; the array order must
  stay stable while an edit is open.
- The saved-syllabus inline editor (`SyllabusView.tsx` ~3705–3770) edits by index and
  appends with `push`, so it can produce unsorted order unless sorted on commit.
- Print CSS must not override `font-style`.

## Approaches considered

### Ordering

| # | Approach | Trade-off |
|---|---|---|
| A | Sort the stored array on save with an APA key (authors → year → title → citation). | Array order changes on save (nothing depends on insertion order); every downstream view/export is alphabetical. **Chosen.** |
| B | Sort on save by the formatted citation string. | Nearly identical output, but ignores surname semantics and leading articles. |
| C | Sort only the Step 6 display list. | Saved/printed syllabus stays unordered — does not meet the goal. |

### Italics

| # | Approach | Trade-off |
|---|---|---|
| A | Segments (`[{text, italic}]`) rendered in-app only. | Printed document still shows sample references. |
| B | Segments **+** wire real references into the printed preview's Part V. | Italics land where the deliverable is printed; touches the preview's sheet builders. **Chosen.** |
| C | Embed `<em>` in the stored citation string. | Injection risk, breaks plain-text consumers. Rejected. |

## The how (decided)

1. **`sortReferences(refs)`** in `shared/data/syllabusData.ts` — non-mutating, returns a
   new array. Key: normalized authors (trimmed, accents stripped, case-insensitive;
   leading "The/A/An" ignored), then year, then title, then citation; refs without
   authors fall back to their citation text. Stable for exact ties.
2. **`formatApa7ReferenceSegments(ref)`** in the same module returns
   `Array<{ text: string; italic?: boolean }>`:
   - book → authors. (year). *title* (edition). publisher. url
   - journal → authors. (year). title. *journal*, *volume*(issue), pages. doi/url
   - website → authors. (year). *title*. site name. url
   `formatApa7Reference()` is refactored to join those segments, so there is one
   source of truth and no drift between string and styled output.
3. **`ApaReferenceText`** component in `features/syllabus/components/` renders segments
   with `<em>`; used by Step 6's saved-reference list and the saved syllabus view
   (`SyllabusView.tsx` ~3885). References carrying only a legacy `citation` string and
   no structured fields render as plain text.
4. **Sorting application points:** Step 6 `saveReference` (add and update paths) before
   `onChange`; and the saved-syllabus inline references editor on commit. Mid-edit state
   is never re-ordered, so index handlers stay correct.
5. **Printed preview Part V:** replace the hardcoded sample lists on sheets 16–17 with
   dedicated Part V sheet(s) generated from `references` in alphabetical order, chunked
   to fit a fixed-height landscape sheet; signatories sheet stays last; total page count
   recomputes automatically. No references → no Part V sheets.
6. **Tests:** unit tests for `sortReferences` (accents, case, missing authors, year ties)
   and for the segments formatter (book/journal/website italics); one render assertion
   that the Step 6 list and preview emit `<em>`.

## Builder's remaining calls

- Exact chunk size for Part V pagination (target ~12 references per sheet).
- Whether a "no references" placeholder line appears on the printout.
- Existing saved syllabi whose refs hold only a flat `citation` stay plain-text until
  edited in Studio (no retroactive italics).
