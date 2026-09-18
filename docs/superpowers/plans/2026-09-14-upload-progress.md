# System-Wide Upload Progress Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every file upload shows the approved percentage + bar indicator via one shared hook and component.

**Architecture:** Add `useSimulatedUpload` hook and `UploadProgress` component, then retrofit each upload caller to wrap its existing awaited upload with `start`/`complete`/`fail`. No server or upload-utility changes.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind; `lucide-react` `Loader2`; existing `uploadFileToPublic` and `uploadCourseFile` unchanged.

**Spec:** `docs/superpowers/specs/2026-09-14-upload-progress-design.md`

## Global Constraints

- No changes to `client/src/utils/fileUploader.ts` upload logic or any server upload endpoint.
- Simulated percentage only: eased 0 to 90% on interval, jump to 100% on success, auto-reset after ~400ms.
- Reuse existing visual tokens only: `bg-muted/40`, `border-border`, `bg-primary`, `text-primary`, `rounded-xl`.
- Block submit/save while `isUploading`; validation failures never start progress.
- `npx tsc -b` in `client/` must pass after every task.

---

## File structure

- `client/src/hooks/useSimulatedUpload.ts` (new): owns `isUploading`, `progress`, `fileName`, `start`, `complete`, `fail`, `reset` with timer cleanup on unmount.
- `client/src/components/common/UploadProgress.tsx` (new): presentational bar; props `{ fileName: string; progress: number; hint?: string }`.
- `client/src/pages/CreateAnnouncementPage.tsx` (modify): `processFile`, dropzone UI, submit guard.
- `client/src/pages/AddModuleItemPage.tsx` (modify): `handleProcessFile`, file section UI, save guard.
- `client/src/components/forms/ActivityFormFields.tsx` (modify): `handleFileUpload`, attachment UI.
- `client/src/pages/FilesView.tsx` (modify): input-change and drop upload paths, per-file progress row.
- `client/src/pages/SyllabusView.tsx` (modify): only the final `uploadCourseFile` save step; existing `scanSyllabusDocument` progress callback stays untouched.
- `client/src/components/forms/QuizBuilderFields.tsx` (modify): `handleUploadQuizFile` wrapper.
- `client/src/pages/CreateExamPage.tsx` (modify): `handleUploadExamFile` wrapper.
- `client/src/pages/CreateCoursePage.tsx` (modify): refactor bespoke timer to reuse the hook, no visual change.

---

### Task 1: Shared hook + progress component

**Files:**
- Create: `client/src/hooks/useSimulatedUpload.ts`
- Create: `client/src/components/common/UploadProgress.tsx`

**Interfaces:**
- Consumes: nothing (React only).
- Produces: `useSimulatedUpload()` returning `{ isUploading: boolean; progress: number; fileName: string | null; start: (name: string) => void; complete: () => void; fail: () => void; reset: () => void }`; `<UploadProgress fileName progress hint? />`.

- [ ] **Step 1: Create the hook**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

export function useSimulatedUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const start = useCallback((name: string) => {
    clearTimers();
    setIsUploading(true);
    setProgress(0);
    setFileName(name);
    timerRef.current = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) return prev;
        const remaining = 90 - prev;
        const step = Math.max(2, remaining * 0.12);
        return Math.min(90, Math.round(prev + step));
      });
    }, 90);
  }, [clearTimers]);

  const complete = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setProgress(100);
    resetTimerRef.current = window.setTimeout(() => {
      setIsUploading(false);
      setFileName(null);
    }, 400);
  }, []);

  const fail = useCallback(() => {
    clearTimers();
    setIsUploading(false);
    setProgress(0);
    setFileName(null);
  }, [clearTimers]);

  const reset = useCallback(() => {
    clearTimers();
    setIsUploading(false);
    setProgress(0);
    setFileName(null);
  }, [clearTimers]);

  return { isUploading, progress, fileName, start, complete, fail, reset };
}
```

- [ ] **Step 2: Create the component**

```tsx
import { Loader2 } from 'lucide-react';

interface UploadProgressProps {
  fileName: string;
  progress: number;
  hint?: string;
}

export const UploadProgress: React.FC<UploadProgressProps> = ({ fileName, progress, hint }) => {
  return (
    <div className="p-2.5 bg-muted/40 border border-border rounded-xl space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center space-x-2.5 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center border border-border shrink-0">
            <Loader2 className="w-4 h-4 animate-spin" />
          </span>
          <div className="truncate">
            <span className="text-xs font-bold text-foreground block truncate">{fileName}</span>
            <span className="text-[10px] text-muted-foreground font-sans">{hint ?? 'Uploading...'}</span>
          </div>
        </div>
        <span className="text-xs font-bold text-primary tabular-nums shrink-0">{progress}%</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
        aria-label={`Uploading ${fileName}`}
        className="h-1.5 w-full bg-muted rounded-full overflow-hidden"
      >
        <div
          className="h-full bg-primary rounded-full transition-[width] duration-150 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b --pretty false` from `client/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add client/src/hooks/useSimulatedUpload.ts client/src/components/common/UploadProgress.tsx
git commit -m "feat: add shared upload progress hook and bar"
```

### Task 2: Announcements + module items + activities

**Files:**
- Modify: `client/src/pages/CreateAnnouncementPage.tsx:61-87` (`processFile`, `handleFileChange`, `handleDrop`), dropzone at `~287-310`, submit at `~103-112`
- Modify: `client/src/pages/AddModuleItemPage.tsx:330-371` (`handleProcessFile`, input, drop)
- Modify: `client/src/components/forms/ActivityFormFields.tsx:96-143` (`handleFileUpload`, input, drop)

**Interfaces:**
- Consumes: `useSimulatedUpload`, `UploadProgress` from Task 1; existing `uploadFileToPublic` unchanged.
- Produces: same upload results as today plus progress UI; no new exports.

- [ ] **Step 1: Wire announcements `processFile`**

```tsx
import { useSimulatedUpload } from '../hooks/useSimulatedUpload';

const upload = useSimulatedUpload();

const processFile = async (file: File) => {
  if (upload.isUploading) return;
  upload.start(file.name);
  try {
    const result = await uploadFileToPublic(file);
    setAttachedFile({ name: result.name, size: result.size, url: result.url });
    upload.complete();
  } catch (err) {
    console.error('Failed to upload file:', err);
    upload.fail();
  }
};
```

Remove the local `isUploadingFile` boolean in favor of `upload.isUploading`; reset `e.target.value = ''` after pick in `handleFileChange`.

- [ ] **Step 2: Show bar under the announcement dropzone**

```tsx
{upload.isUploading && upload.fileName && (
  <UploadProgress fileName={upload.fileName} progress={upload.progress} hint="Saving file to /public/uploads/..." />
)}
```

Dim the dropzone while uploading with `aria-disabled={upload.isUploading}` plus `opacity-60 cursor-wait pointer-events-none`, and guard `handleDrop` with `if (upload.isUploading) return;`. Block announcement submit with `if (upload.isUploading) return;`.

- [ ] **Step 3: Apply the same wrapper to module items and activities**

`AddModuleItemPage.tsx` `handleProcessFile`: validate size as today, then `upload.start(file.name)`, `await uploadFileToPublic(file)`, `upload.complete()` on success, `upload.fail()` on catch. `ActivityFormFields.tsx` `handleFileUpload`: same wrapper around its existing `uploadFileToPublic` call. Render `<UploadProgress>` under each file section and disable drop/click while uploading.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b --pretty false` from `client/`
Expected: PASS

- [ ] **Step 5: Manual check announcements + module item + activity**

Browse, drag-drop, and Change paths each show climbing % then success; submit/save blocked mid-upload.

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/CreateAnnouncementPage.tsx client/src/pages/AddModuleItemPage.tsx client/src/components/forms/ActivityFormFields.tsx
git commit -m "feat: add upload progress to announcements, module items, activities"
```

### Task 3: Files page + syllabus save step

**Files:**
- Modify: `client/src/pages/FilesView.tsx:171-214` (`handleFileUpload`), `216-260` (drop path), file input at `~404-405`, dropzone at `~503`
- Modify: `client/src/pages/SyllabusView.tsx:381` (`uploadCourseFile` save only)

**Interfaces:**
- Consumes: `useSimulatedUpload`, `UploadProgress`; existing `uploadCourseFile` unchanged.
- Produces: same files as today plus progress UI.

- [ ] **Step 1: Wire FilesView input path**

```tsx
const upload = useSimulatedUpload();

const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file || upload.isUploading) return;
  upload.start(file.name);
  try {
    await uploadCourseFile({ courseId: effectiveScopeId, folderId: currentFolderId, name: file.name, rawFile: file, size: file.size, type, visibility: 'published' });
    upload.complete();
    showAlert({ title: 'File Uploaded', message: `File "${file.name}" has been uploaded.`, type: 'success' });
  } catch (err) {
    console.error('Failed to upload file in FilesView:', err);
    upload.fail();
  } finally {
    if (e.target) e.target.value = '';
  }
};
```

- [ ] **Step 2: Wire FilesView drop path with the same instance**

Wrap the existing async drop IIFE with `upload.start(file.name)` before `uploadCourseFile` and `upload.complete()` / `upload.fail()` after. Render `<UploadProgress fileName={upload.fileName ?? ''} progress={upload.progress} />` above the file list when `upload.isUploading`.

- [ ] **Step 3: Wire syllabus save only**

In `SyllabusView.tsx`, leave `processFile` / `scanSyllabusDocument` progress (`setScanProgress`, `setScanStepText`) untouched. Wrap only the final `await uploadCourseFile({...})` at `~381` with `upload.start(scannedFile.name)` / `upload.complete()` / `upload.fail()`, and render `<UploadProgress>` in the apply section while uploading.

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b --pretty false` from `client/`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/FilesView.tsx client/src/pages/SyllabusView.tsx
git commit -m "feat: add upload progress to files and syllabus save"
```

### Task 4: Quiz import + exam import + CreateCourse refactor

**Files:**
- Modify: `client/src/components/forms/QuizBuilderFields.tsx:499-560` (`handleUploadQuizFile`)
- Modify: `client/src/pages/CreateExamPage.tsx:483-545` (`handleUploadExamFile`)
- Modify: `client/src/pages/CreateCoursePage.tsx:145-230` (`processImageFile`, timer refs, dropzone, submit guard)

**Interfaces:**
- Consumes: `useSimulatedUpload`, `UploadProgress`.
- Produces: identical parse results plus progress UI; CreateCourse visuals unchanged.

- [ ] **Step 1: Wrap quiz and exam parses**

```tsx
const upload = useSimulatedUpload();

const handleUploadQuizFile = async (file: File) => {
  if (isQuizImportTooLarge(file.size)) { /* existing alert */ return; }
  if (classifyQuizImportFile(file.name) === 'unsupported') { /* existing alert */ return; }
  if (upload.isUploading) return;
  upload.start(file.name);
  setUploadFile(file);
  try {
    // existing extractPdfText / extractDocxText / file.text() branches unchanged
    setExtractedQuestions(parseQuizText(raw).map(toQuestionDraft));
    upload.complete();
  } catch (err) {
    // existing error handling unchanged
    upload.fail();
  }
};
```

Mirror for `handleUploadExamFile`. Render `<UploadProgress>` under each import dropzone while uploading.

- [ ] **Step 2: Refactor CreateCoursePage to the hook**

Replace `isUploading` / `uploadProgress` / `uploadingFileName` / `uploadTimerRef` / `cancelSimulatedUpload` with `const upload = useSimulatedUpload();`. Map `isUploading` to `upload.isUploading`, `uploadProgress` to `upload.progress`, `uploadingFileName` to `upload.fileName`. Replace the manual interval with `upload.start(file.name)` and `finishUpload` with `upload.complete()` / `upload.fail()`. Replace the bespoke progress card with `<UploadProgress>`. Keep all validation, `switchImageMode` cancel (now `upload.reset()`), and submit-guard behavior identical.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b --pretty false` from `client/`
Expected: PASS

- [ ] **Step 4: Manual matrix**

Per surface (announcements, module item, activity, Files, syllabus save, quiz import, exam import, course cover): browse + drop + Change show climbing %; same-file reselect works; failure keeps old file; submit blocked mid-upload.

- [ ] **Step 5: Commit**

```bash
git add client/src/components/forms/QuizBuilderFields.tsx client/src/pages/CreateExamPage.tsx client/src/pages/CreateCoursePage.tsx
git commit -m "feat: add upload progress to quiz, exam, and unify course cover"
```

## Self-Review

- Spec coverage: shared units (Task 1), all 7 retrofit surfaces plus CreateCourse refactor (Tasks 2-4), error/submit guards (each task), verification (tsc + manual matrix). `syllabusParser.ts` needs no UI task per spec (inherits caller progress).
- Placeholder scan: no TBD/TODO; every code step shows exact wrapper code; no deferred edge cases.
- Type consistency: hook API (`start`, `complete`, `fail`, `reset`, `isUploading`, `progress`, `fileName`) and `<UploadProgress fileName progress hint? />` used identically in Tasks 2-4.
