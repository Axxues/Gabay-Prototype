# Quiz Upload + Scan Auto-Fill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Instructors upload a PDF/DOCX quiz document on CreateQuizPage and get editable draft question cards via a mandatory review step, with nothing saved until they confirm.

**Architecture:** Local-first incremental (Approach A). Pure parsing/guards live in `src/utils/quizImport.ts` (vitest-covered, no React, no DOM). Binary text extraction lives in `src/utils/quizExtract.ts` (pdfjs-dist for PDF, mammoth for DOCX, thin wrappers only). `CreateQuizPage` keeps its existing review panel (per-item remove, Append/Replace) as the mandatory gate; the existing save/publish path is untouched. New dependencies: `pdfjs-dist`, `mammoth` (runtime), `@types/mammoth` (dev, only if needed).

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind; vitest (already a devDependency); pdfjs-dist v4 + mammoth (new).

**Spec:** `docs/superpowers/specs/2026-09-13-lms-extensions-design.md` (§4)

## Global Constraints

- No backend; all state in `LMSContext` + localStorage key `gabay_lms_db_v6`.
- Client-side only: `pdfjs-dist` extracts PDF text, `mammoth` extracts DOCX text — nothing leaves the browser.
- Upload cap: PDF/DOCX/TXT/MD/JSON/CSV, 10 MB max.
- Heuristic parse: numbered prompts, `A)` options, True/False markers, points hints; unparseable lines become identification drafts rather than being dropped.
- Mandatory instructor review: drafts render in the existing review panel (edit-by-Append/Replace, per-item delete); nothing saves until confirmed; existing save/publish path unchanged.
- Scanned-image PDFs (no text layer) show a "no extractable text" message with a paste-text fallback.
- Password-protected or corrupt files fail with a plain error and never leave a partial quiz.
- Large documents are truncated with a warning to protect localStorage.
- **User override (binds every task): do NOT commit. Leave all work uncommitted in the working tree. Steps saying "verify" end the task; no `git add`, no `git commit`.**
- Shell is Windows PowerShell 5.1: never use `&&` to chain commands.

---

## File structure

- `src/utils/quizImport.ts` (new) — pure rules: `QuizImportDraft`, `parseQuizText`, `classifyQuizImportFile`, `isQuizImportTooLarge`, `applyQuizTextLimit`, limits. No React, no DOM, no File API.
- `src/utils/quizImport.test.ts` (new) — vitest units for the above (13 tests).
- `src/utils/quizExtract.ts` (new) — `extractPdfText`, `extractDocxText` returning `ExtractedQuizText`; exact user-facing error strings. DOM File API only, no React.
- `src/vite-env.d.ts` (new) — `/// <reference types="vite/client" />` so the pdfjs `?url` worker import typechecks.
- `package.json` (modify) — add `pdfjs-dist@^4`, `mammoth` (+ `@types/mammoth` dev only if the probe in Task 2 requires it).
- `src/pages/CreateQuizPage.tsx` (modify) — async upload handler with cap + kind routing + paste fallback; `parseQuizText`/`finalizeQuestion` locals removed or kept per usage check; review panel and save path untouched.

---

### Task 1: Pure quiz parser + guards + tests

**Files:**
- Create: `src/utils/quizImport.ts`
- Create: `src/utils/quizImport.test.ts`

**Interfaces:**
- Consumes: `QuizItemType` from `src/types/lms.ts` (import type only)
- Produces: `QuizImportDraft`, `parseQuizText(text: string) => QuizImportDraft[]`, `classifyQuizImportFile(fileName: string) => 'pdf' | 'docx' | 'text' | 'unsupported'`, `isQuizImportTooLarge(sizeBytes: number) => boolean`, `applyQuizTextLimit(text: string) => ExtractedQuizText`, `QUIZ_IMPORT_MAX_BYTES`, `QUIZ_IMPORT_TEXT_LIMIT`, `ExtractedQuizText` used by Tasks 2–3. Keep exact names and signatures.

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/quizImport.test.ts
import { describe, expect, it } from 'vitest';
import {
  applyQuizTextLimit,
  classifyQuizImportFile,
  isQuizImportTooLarge,
  parseQuizText,
  QUIZ_IMPORT_MAX_BYTES,
  QUIZ_IMPORT_TEXT_LIMIT,
} from './quizImport';

describe('parseQuizText JSON', () => {
  it('parses a JSON array of questions', () => {
    const drafts = parseQuizText(
      JSON.stringify([
        { text: 'Capital of France?', type: 'identification', correctAnswer: 'Paris', points: 5 },
      ])
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].text).toBe('Capital of France?');
    expect(drafts[0].type).toBe('identification');
    expect(drafts[0].correctAnswer).toBe('Paris');
  });
  it('parses a { questions } wrapper object', () => {
    const drafts = parseQuizText(
      JSON.stringify({ questions: [{ text: '2+2?', type: 'identification', correctAnswer: '4', points: 2 }] })
    );
    expect(drafts).toHaveLength(1);
    expect(drafts[0].correctAnswer).toBe('4');
  });
});

describe('parseQuizText line parser', () => {
  it('parses a numbered MC block with options and answer key', () => {
    const drafts = parseQuizText('1. What is 2+2?\nA) 3\nB) 4\nC) 5\nAnswer: B');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe('multiple_choice');
    expect(drafts[0].text).toBe('What is 2+2?');
    expect(drafts[0].options).toEqual(['3', '4', '5']);
    expect(drafts[0].correctAnswer).toBe('B');
  });
  it('detects true/false via an Answer key', () => {
    const drafts = parseQuizText('1. The sky is blue\nAnswer: True');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe('true_false');
    expect(drafts[0].correctAnswer).toBe('True');
    expect(drafts[0].options).toEqual(['True', 'False']);
  });
  it('reads points hints', () => {
    const drafts = parseQuizText('1. Define gravity (10 pts)\nA) Force\nB) Energy\nAnswer: A');
    expect(drafts[0].points).toBe(10);
  });
  it('maps a lone prompt with no options or key to identification', () => {
    const drafts = parseQuizText('What is the capital of France?');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe('identification');
    expect(drafts[0].options).toEqual([]);
  });
  it('maps numbered prompts without options to identifications', () => {
    const drafts = parseQuizText('1. Capital of France?\n2. Largest planet?');
    expect(drafts).toHaveLength(2);
    expect(drafts.every(d => d.type === 'identification')).toBe(true);
  });
  it('merges continuation lines into the prompt', () => {
    const drafts = parseQuizText('1. Explain photosynthesis\nin green plants');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].text).toContain('green plants');
  });
  it('maps garbage input to a single identification fallback', () => {
    const drafts = parseQuizText('asdf jkl');
    expect(drafts).toHaveLength(1);
    expect(drafts[0].type).toBe('identification');
  });
  it('returns no drafts for empty input', () => {
    expect(parseQuizText('   \n  ')).toEqual([]);
  });
});

describe('file guards', () => {
  it('classifies quiz file kinds', () => {
    expect(classifyQuizImportFile('quiz.pdf')).toBe('pdf');
    expect(classifyQuizImportFile('Quiz.DOCX')).toBe('docx');
    expect(classifyQuizImportFile('q.txt')).toBe('text');
    expect(classifyQuizImportFile('q.md')).toBe('text');
    expect(classifyQuizImportFile('q.json')).toBe('text');
    expect(classifyQuizImportFile('q.csv')).toBe('text');
    expect(classifyQuizImportFile('legacy.doc')).toBe('unsupported');
    expect(classifyQuizImportFile('sheet.xls')).toBe('unsupported');
  });
  it('enforces the 10 MB cap', () => {
    expect(QUIZ_IMPORT_MAX_BYTES).toBe(10 * 1024 * 1024);
    expect(isQuizImportTooLarge(10 * 1024 * 1024 + 1)).toBe(true);
    expect(isQuizImportTooLarge(10 * 1024 * 1024)).toBe(false);
  });
  it('flags truncation at the text limit', () => {
    const big = 'x'.repeat(QUIZ_IMPORT_TEXT_LIMIT + 100);
    const out = applyQuizTextLimit(big);
    expect(out.truncated).toBe(true);
    expect(out.text).toHaveLength(QUIZ_IMPORT_TEXT_LIMIT);
    expect(applyQuizTextLimit('small').truncated).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/quizImport.test.ts`
Expected: FAIL with "Failed to resolve import ./quizImport" (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/quizImport.ts
import type { QuizItemType } from '../types/lms';

export interface QuizImportDraft {
  text: string;
  type: QuizItemType;
  options: string[];
  correctAnswer: string;
  points: number;
}

export interface ExtractedQuizText {
  text: string;
  truncated: boolean;
}

export const QUIZ_IMPORT_MAX_BYTES = 10 * 1024 * 1024;
export const QUIZ_IMPORT_TEXT_LIMIT = 200_000;

export function isQuizImportTooLarge(sizeBytes: number): boolean {
  return sizeBytes > QUIZ_IMPORT_MAX_BYTES;
}

export function applyQuizTextLimit(text: string): ExtractedQuizText {
  if (text.length <= QUIZ_IMPORT_TEXT_LIMIT) return { text, truncated: false };
  return { text: text.slice(0, QUIZ_IMPORT_TEXT_LIMIT), truncated: true };
}

export function classifyQuizImportFile(fileName: string): 'pdf' | 'docx' | 'text' | 'unsupported' {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.docx')) return 'docx';
  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.json') || lower.endsWith('.csv')) return 'text';
  return 'unsupported';
}

interface Builder {
  type: QuizItemType;
  text: string;
  options: string[];
  correctAnswer: string;
  points: number;
  sawOptions: boolean;
  sawKey: boolean;
}

function freshBuilder(): Builder {
  return { type: 'multiple_choice', text: '', options: [], correctAnswer: 'A', points: 5, sawOptions: false, sawKey: false };
}

function finalizeBuilder(b: Builder): QuizImportDraft {
  const cleanText = b.text.replace(/^(?:Q(?:uestion)?\s*\d+[:.]|\d+[\.\)])\s*/i, '').trim() || 'Untitled Question';
  if (b.type === 'multiple_choice' && !b.sawOptions && !b.sawKey) {
    return { text: cleanText, type: 'identification', options: [], correctAnswer: '', points: b.points };
  }
  if (b.type === 'multiple_choice') {
    const options = b.options.length > 0 ? b.options : ['Option A', 'Option B', 'Option C', 'Option D'];
    const correctAnswer = ['A', 'B', 'C', 'D', 'E', 'F'].includes(b.correctAnswer) ? b.correctAnswer : 'A';
    return { text: cleanText, type: 'multiple_choice', options, correctAnswer, points: b.points };
  }
  return { text: cleanText, type: 'true_false', options: ['True', 'False'], correctAnswer: b.correctAnswer === 'False' ? 'False' : 'True', points: b.points };
}

function tryParseJson(text: string): QuizImportDraft[] | null {
  try {
    const parsed: any = JSON.parse(text);
    const list = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.questions) ? parsed.questions : Array.isArray(parsed?.items) ? parsed.items : null;
    if (!list || list.length === 0) return null;
    return list.map((item: any) => {
      const type = (item.type as QuizItemType) || 'multiple_choice';
      return {
        text: String(item.text ?? item.question ?? item.prompt ?? 'Untitled Question').trim(),
        type,
        options: Array.isArray(item.options) ? item.options.map(String) : type === 'multiple_choice' ? ['Option A', 'Option B', 'Option C', 'Option D'] : type === 'true_false' ? ['True', 'False'] : [],
        correctAnswer: String(item.correctAnswer ?? (type === 'multiple_choice' ? 'A' : type === 'true_false' ? 'True' : '')),
        points: Number(item.points) || 5,
      } as QuizImportDraft;
    });
  } catch {
    return null;
  }
}

export function parseQuizText(text: string): QuizImportDraft[] {
  const fromJson = tryParseJson(text);
  if (fromJson) return fromJson;

  const drafts: QuizImportDraft[] = [];
  let cur = freshBuilder();
  const push = () => {
    if (!cur.text.trim()) return;
    drafts.push(finalizeBuilder(cur));
    cur = freshBuilder();
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (!trimmed) {
      if (cur.text.trim() && cur.options.length >= 2) push();
      continue;
    }
    const qNum = trimmed.match(/^(?:Q(?:uestion)?\s*\d+[:.]|\d+[\.\)])\s*(.*)/i);
    if (qNum) {
      push();
      cur.text = qNum[1].trim() || trimmed;
      continue;
    }
    if (/^(?:True\s*[\/\-]\s*False|T\s*\/\s*F)\b/i.test(trimmed)) {
      cur.type = 'true_false';
      cur.sawKey = true;
      cur.correctAnswer = /true/i.test(trimmed) ? 'True' : 'False';
      continue;
    }
    const opt = trimmed.match(/^(?:[\(\[]?([A-Fa-f])[\)\]\.\:]\s*)(.*)/);
    if (opt) {
      cur.type = 'multiple_choice';
      cur.sawOptions = true;
      cur.options.push(opt[2].trim());
      continue;
    }
    const ans = trimmed.match(/^(?:Answer|Ans|Key|Correct(?:\s*Answer)?)\s*[:=-]\s*(.*)/i);
    if (ans) {
      const val = ans[1].trim();
      cur.sawKey = true;
      if (/^(?:True|False)$/i.test(val)) {
        cur.type = 'true_false';
        cur.correctAnswer = val.toLowerCase() === 'false' ? 'False' : 'True';
      } else if (/^[A-Fa-f]$/.test(val)) {
        cur.correctAnswer = val.toUpperCase();
      } else {
        cur.correctAnswer = val;
      }
      continue;
    }
    const pts = trimmed.match(/(?:(?:Points?|Pts?)\s*[:=]\s*|[\(\[])\s*(\d+)\s*(?:pts|points?)?\s*[\)\]]?/i);
    if (pts) cur.points = parseInt(pts[1], 10) || 5;
    cur.text = cur.text ? `${cur.text} ${trimmed}` : trimmed;
  }
  push();

  if (drafts.length === 0 && text.trim()) {
    return [{ text: text.trim().slice(0, 150), type: 'identification', options: [], correctAnswer: '', points: 5 }];
  }
  return drafts;
}
```

Behavioral note (binds Task 3): the only deliberate change versus the current component parser is the `!sawOptions && !sawKey` identification rule, which implements the spec's "unparseable lines become identification drafts". All patterns (numbering, options, keys, points, JSON shapes, defaults) are ported verbatim.

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `npx vitest run src/utils/quizImport.test.ts`
Expected: 13/13 PASS.
Run: `npx tsc -b`
Expected: PASS (no output).

- [ ] **Step 5: Leave uncommitted (user override — no commit)**

---

### Task 2: Dependencies + binary text extraction

**Files:**
- Modify: `package.json` (add `pdfjs-dist@^4`, `mammoth`; dev `@types/mammoth` only if the Step 2 probe requires it)
- Create: `src/vite-env.d.ts`
- Create: `src/utils/quizExtract.ts`

**Interfaces:**
- Consumes: `ExtractedQuizText`, `applyQuizTextLimit` (Task 1)
- Produces: `extractPdfText(file: File) => Promise<ExtractedQuizText>`, `extractDocxText(file: File) => Promise<ExtractedQuizText>` used by Task 3. Keep exact names and signatures. Error contract: every failure throws `Error` whose message is the exact user-facing string Task 3 displays; messages containing the word "paste" trigger the paste-text fallback.

- [ ] **Step 1: Install runtime dependencies**

```bash
npm i -S pdfjs-dist@^4 mammoth
```

Pin: major v4 keeps the `build/pdf.worker.min.mjs` layout the Step 3 code imports. After install, verify the worker file exists:

```bash
node -e "const fs=require('fs'); const p=require.resolve('pdfjs-dist/build/pdf.worker.min.mjs'); console.log('worker ok:', fs.existsSync(p))"
```

Expected: `worker ok: true`. If the path does not exist in the installed version, use that version's documented Vite worker path in Step 3 instead and record the substitution in the report — do not downgrade or restructure.

- [ ] **Step 2: Probe whether `@types/mammoth` is needed**

Run: `npx tsc -b`
Expected: if the error `Could not find declaration file for module 'mammoth'` appears, run `npm i -D @types/mammoth` and re-run `npx tsc -b` (expect PASS). If no such error, skip the dev dependency (mammoth bundles its own types) and continue.

- [ ] **Step 3: Create `src/vite-env.d.ts` and `src/utils/quizExtract.ts`**

```ts
// src/vite-env.d.ts
/// <reference types="vite/client" />
```

```ts
// src/utils/quizExtract.ts
import * as pdfjsLib from 'pdfjs-dist';
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import mammoth from 'mammoth';
import { applyQuizTextLimit, type ExtractedQuizText } from './quizImport';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const MIN_TEXT_CHARS = 20;
const MAX_PDF_PAGES = 50;

function significantChars(text: string): number {
  return text.replace(/\s/g, '').length;
}

export async function extractPdfText(file: File): Promise<ExtractedQuizText> {
  const buffer = await file.arrayBuffer();
  let pdf;
  try {
    pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  } catch (err: any) {
    if (err?.name === 'PasswordException') {
      throw new Error('This PDF is password-protected. Please remove the password and try again.');
    }
    throw new Error('Could not read this PDF. The file may be corrupted.');
  }
  const pages: string[] = [];
  const count = Math.min(pdf.numPages, MAX_PDF_PAGES);
  for (let i = 1; i <= count; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    pages.push(content.items.map((it: any) => ('str' in it ? (it as { str: string }).str : '')).join(' '));
  }
  const text = pages.join('\n');
  if (significantChars(text) < MIN_TEXT_CHARS) {
    throw new Error('No extractable text found in this PDF. It may be a scanned image — paste the question text below instead.');
  }
  return applyQuizTextLimit(text);
}

export async function extractDocxText(file: File): Promise<ExtractedQuizText> {
  const arrayBuffer = await file.arrayBuffer();
  let value: string;
  try {
    const result = await mammoth.extractRawText({ arrayBuffer });
    value = result.value || '';
  } catch {
    throw new Error('Could not read this DOCX. The file may be corrupted.');
  }
  if (significantChars(value) < MIN_TEXT_CHARS) {
    throw new Error('No extractable text found in this document — paste the question text below instead.');
  }
  return applyQuizTextLimit(value);
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: PASS (no output). Binary extraction itself is verified manually in Task 4 with one sample PDF and one DOCX (no binary fixtures in unit tests — deliberate).

- [ ] **Step 5: Leave uncommitted (user override — no commit)**

---

### Task 3: CreateQuizPage upload integration + paste fallback

**Files:**
- Modify: `src/pages/CreateQuizPage.tsx` (upload handler ~lines 477-500, parser locals ~lines 502-672, upload panel ~lines 754-944; line numbers may have shifted — locate by symbol names)

**Interfaces:**
- Consumes: `parseQuizText`, `QuizImportDraft`, `classifyQuizImportFile`, `isQuizImportTooLarge`, `applyQuizTextLimit` (Task 1); `extractPdfText`, `extractDocxText` (Task 2)
- Produces: upload UX only, terminal for this surface. The existing review panel (per-item remove, Append/Replace) and `handleSaveQuiz` stay untouched.

- [ ] **Step 1: Replace the text-only upload path with binary-aware routing**

Delete the local `parseQuizText` (lines ~502-632). For `finalizeQuestion` (lines ~634-672): grep its usages — if only the deleted `parseQuizText` calls it, delete it too; if manual question-card flows call it, keep it unchanged.

Add imports at the top (after the existing `QuizQuestion, QuizItemType` import):

```tsx
import type { QuizImportDraft } from '../utils/quizImport';
import { applyQuizTextLimit, classifyQuizImportFile, isQuizImportTooLarge, parseQuizText } from '../utils/quizImport';
import { extractDocxText, extractPdfText } from '../utils/quizExtract';
```

Add the boundary mapper plus paste-fallback state near the existing upload state (lines ~137-140):

```tsx
const toQuestionDraft = (q: QuizImportDraft, idx: number): QuestionDraft => ({
  id: `item-${Date.now()}-${idx + 1}`,
  text: q.text,
  type: q.type,
  options: q.options,
  correctAnswer: q.correctAnswer,
  points: q.points,
  required: true,
});
const [showPasteFallback, setShowPasteFallback] = useState(false);
const [pastedText, setPastedText] = useState('');
```

Replace `handleUploadQuizFile` (lines ~477-500) with:

```tsx
const handleUploadQuizFile = async (file: File) => {
  if (isQuizImportTooLarge(file.size)) {
    showAlert({
      title: 'File too large',
      message: `"${file.name}" exceeds the 10 MB limit. Please split the document and try again.`,
      type: 'error'
    });
    return;
  }
  const kind = classifyQuizImportFile(file.name);
  if (kind === 'unsupported') {
    showAlert({
      title: 'Unsupported file type',
      message: 'Upload a PDF, DOCX, TXT, MD, JSON, or CSV file. Legacy .doc files must be re-saved as .docx first.',
      type: 'error'
    });
    return;
  }
  setIsUploading(true);
  setUploadFile(file);
  try {
    let raw: string;
    let truncated = false;
    if (kind === 'pdf') {
      const out = await extractPdfText(file);
      raw = out.text;
      truncated = out.truncated;
    } else if (kind === 'docx') {
      const out = await extractDocxText(file);
      raw = out.text;
      truncated = out.truncated;
    } else {
      const limited = applyQuizTextLimit(await file.text());
      raw = limited.text;
      truncated = limited.truncated;
    }
    setExtractedQuestions(parseQuizText(raw).map(toQuestionDraft));
    setShowPasteFallback(false);
    if (truncated) {
      showAlert({
        title: 'Large document truncated',
        message: 'Only the first portion was parsed to protect local storage. Review the drafts, then paste any remaining questions manually.',
        type: 'warning'
      });
    }
  } catch (err) {
    setExtractedQuestions([]);
    const message = err instanceof Error ? err.message : 'Could not read the uploaded file.';
    const needsPaste = /paste/i.test(message);
    if (needsPaste) setShowPasteFallback(true);
    showAlert({
      title: needsPaste ? 'No extractable text' : 'Error reading file',
      message,
      type: needsPaste ? 'warning' : 'error'
    });
  } finally {
    setIsUploading(false);
    setShowFileSelector(true);
  }
};
```

`FileReader.readAsText` is gone (replaced by `file.text()` for text kinds and array-buffer extraction for binaries). On any failure `extractedQuestions` is cleared, so a corrupt file never leaves a partial quiz.

- [ ] **Step 2: Add the paste-text fallback UI inside the upload panel**

Below the extraction-progress block (lines ~842-849), insert:

```tsx
{!isUploading && (showPasteFallback ? (
  <div className="p-3 bg-muted/30 rounded-xl border border-border/50 space-y-2">
    <p className="text-xs font-bold text-foreground">Paste question text instead</p>
    <textarea
      rows={6}
      value={pastedText}
      onChange={e => setPastedText(e.target.value)}
      placeholder={"1. What is 2+2?\nA) 3\nB) 4\nAnswer: B"}
      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-xl text-foreground placeholder:text-muted-foreground font-sans focus:outline-none focus:ring-2 focus:ring-primary/40"
    />
    <button
      type="button"
      disabled={!pastedText.trim()}
      onClick={() => {
        setExtractedQuestions(parseQuizText(pastedText).map(toQuestionDraft));
        setShowFileSelector(true);
      }}
      className="px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 text-xs font-bold rounded-lg transition-all cursor-pointer disabled:cursor-not-allowed"
    >
      Parse pasted text
    </button>
  </div>
) : (
  <button
    type="button"
    onClick={() => setShowPasteFallback(true)}
    className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
  >
    Or paste text instead
  </button>
))}
```

Pasted drafts flow into the same `extractedQuestions` review panel (per-item delete, Append/Replace gate saving). Dropzone `accept` attribute (line ~804) stays as-is.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 4: Leave uncommitted (user override — no commit)**

---

### Task 4: Verification — parser suite, typecheck, manual matrix

**Files:**
- Test only: `src/utils/quizImport.test.ts`; manual exercise of `CreateQuizPage` upload panel
- No source changes in this task unless verification exposes a defect (if so, fix minimally in the owning file, re-run its covering tests, and record the fix in the report)

**Interfaces:**
- Consumes: all Tasks 1–3 outputs
- Produces: nothing (terminal task — verification evidence only)

- [ ] **Step 1: Run the automated suite**

Run: `npx vitest run src/utils/quizImport.test.ts`
Expected: 13/13 PASS.
Run: `npx tsc -b`
Expected: PASS (no output).

- [ ] **Step 2: Manual verification matrix** (start `npm run dev`, faculty role, CreateQuizPage)

1. Sample PDF with one MC (A–D options + `Answer:` key), one T/F, one identification, one essay prompt → drafts appear with correct types/keys/points; Append adds them; saved quiz matches.
2. Sample DOCX with the same four types → same result.
3. Scanned-image PDF (no text layer) → "No extractable text" warning + paste fallback appears; pasting the text parses correctly.
4. Corrupt PDF (e.g. renamed `.txt` to `.pdf`) → "Could not read this PDF" error; `extractedQuestions` stays empty (no partials).
5. File over 10 MB → "File too large" error before any reading; panel state unchanged.
6. Legacy `.doc` → "Unsupported file type" error directing re-save as `.docx`.
7. Existing save/publish path: create a quiz manually (no upload) → saves exactly as before (no regression).

Record each scenario's PASS/FAIL with one-line evidence in the report. Browser-manual scenarios may be traced only if `npm run dev` cannot run in the environment — if so, say which scenarios were traced vs clicked, and why.

- [ ] **Step 3: Leave uncommitted (user override — no commit)**

---

## Self-Review

**1. Spec coverage (§4):** "Upload file" button on CreateQuizPage → pre-existing, kept (Task 3). PDF/DOCX 10 MB cap → Tasks 1 (guard) + 3 (enforcement). Client-side pdfjs/mammoth extraction, nothing leaves browser → Task 2. Heuristic `parseQuizText` (numbered prompts, `A)` options, T/F markers, points hints; unparseable → identification) → Task 1 (pure, 13 unit tests). Review panel (edit/delete/push, nothing saves until confirm) → pre-existing, reused by Tasks 3–4. Existing save/publish untouched → Task 3 constraint + Task 4 scenario 7. Scanned-image "no extractable text" + paste fallback → Tasks 2 (detection error) + 3 (fallback UI). Protected/corrupt clean errors, no partial quiz → Tasks 2 (error contract) + 3 (clear-on-failure). Large-file truncation warning → Tasks 1 (limit helper) + 2/3 (apply + warn).

**2. Placeholder scan:** No TBD/TODO; every step has exact code or exact file:symbol anchors; no "similar to" references without content (Task 3's `finalizeQuestion` check names the exact grep and both outcomes); no undefined functions (all produced/consumed names match: `parseQuizText`, `QuizImportDraft`, `classifyQuizImportFile`, `isQuizImportTooLarge`, `applyQuizTextLimit`, `ExtractedQuizText`, `QUIZ_IMPORT_MAX_BYTES`, `QUIZ_IMPORT_TEXT_LIMIT`, `extractPdfText`, `extractDocxText`, `toQuestionDraft` is Task-3-local).

**3. Type consistency:** `QuizImportDraft` fields are a subset of the component's `QuestionDraft` (minus `id`/`description`/`rubricNotes`/`required`, which `toQuestionDraft` supplies); `type` uses the shared `QuizItemType` union so Append/Replace/`handleSaveQuiz` accept the mapped drafts unchanged. `ExtractedQuizText` is produced by both extractors and consumed identically in Task 3's three branches. Error contract (`/paste/i` detection) matches the exact no-text strings in Task 2. Test count (13 `it` blocks) matches the Step 4 expectation.
