# System-Wide Upload Progress Design

Date: 2026-09-14
Status: Approved (approach A, design sections approved 2026-09-14)
Scope: All file-upload surfaces in `client/src`

## 1. Goal

Every file upload in the system shows the same upload indicator the user approved on Create Course: live percentage text plus a thin progress bar, with the triggering control dimmed/disabled while uploading. No server-contract changes.

## 2. Background

- Create Course cover upload (`client/src/pages/CreateCoursePage.tsx`) already implements simulated eased progress (0 to 90% on an interval, jump to 100% on `FileReader` load) with a progress card.
- Other surfaces only show a boolean busy state (`isUploadingFile`, `isUploading`, spinner, or nothing):
  - `client/src/pages/CreateAnnouncementPage.tsx` (`processFile` via `uploadFileToPublic`)
  - `client/src/pages/AddModuleItemPage.tsx` (via `uploadFileToPublic`)
  - `client/src/components/forms/ActivityFormFields.tsx` (via `uploadFileToPublic`)
  - `client/src/pages/FilesView.tsx` (via `uploadCourseFile`)
  - `client/src/pages/SyllabusView.tsx` (`processFile` + `uploadCourseFile`)
  - `client/src/components/forms/QuizBuilderFields.tsx` (`handleUploadQuizFile`, local parse)
  - `client/src/pages/CreateExamPage.tsx` (`handleUploadExamFile`, local parse)
  - `client/src/utils/syllabusParser.ts` (via `uploadFileToPublic`, no UI of its own)
- `uploadFileToPublic` (`client/src/utils/fileUploader.ts`) uses `FileReader` plus `fetch POST /api/upload`; `fetch` exposes no upload-progress events, so true bytes-on-wire percentage is out of scope. Local quiz/exam parses are also local-only.

## 3. Architecture

Add two shared units; keep all existing upload functions untouched:

- `client/src/hooks/useSimulatedUpload.ts`: owns `isUploading`, `progress (0-100)`, `fileName`, plus `start(fileName)`, `complete()`, `fail()`, `reset()`. Internally a single `window.setInterval` (~90ms) easing toward 90%; `complete()` clears the timer, sets 100%, and auto-resets after ~400ms so 100% is perceptible. Cleans up on unmount. No React context, no localStorage.
- `client/src/components/common/UploadProgress.tsx`: presentational only. Props: `{ fileName, progress, hint? }`. Renders filename row, tabular-nums percentage, and `role="progressbar"` track/fill using existing `bg-muted` / `bg-primary` tokens, `rounded-full`, `transition-[width]`. No business logic.

Data flow per surface: user picks file -> caller validates as today -> `start(file.name)` -> `await` existing upload function unchanged -> `complete()` on success (then set URL/preview as today) or `fail()` on error (then existing alert). Progress never drives control flow; it only mirrors the awaited promise.

## 4. Components

### useSimulatedUpload

```ts
const { isUploading, progress, fileName, start, complete, fail, reset } = useSimulatedUpload();
```

- `start(name: string)`: cancels any prior timer, sets `isUploading=true`, `progress=0`, `fileName=name`.
- `complete()`: clears timer, sets `progress=100`, schedules `reset()` after 400ms.
- `fail()`: clears timer, sets `isUploading=false`, `progress=0`, `fileName=null`.
- Guards: callers check `isUploading` to ignore duplicate drops/submits during upload.

### UploadProgress

- Same visual language as the approved Create Course card: `p-2.5 bg-muted/40 border border-border rounded-xl`, `Loader2 animate-spin` icon slot, filename truncated, `%` right-aligned, `h-1.5` track.
- Accessibility: `role="progressbar"`, `aria-valuemin/max/now`, `aria-label="Uploading <name>"`. Reduced-motion respected via existing Tailwind setup (no custom keyframes).

## 5. Retrofit list

1. `CreateAnnouncementPage.tsx`: wire `processFile` to hook; show `UploadProgress` under dropzone; block announcement submit while uploading.
2. `AddModuleItemPage.tsx`: same for its file section; block save while uploading.
3. `ActivityFormFields.tsx`: same for attachment field.
4. `FilesView.tsx`: wire both input-change and drop paths; single shared hook instance per view; per-file row shows progress when its filename matches.
5. `SyllabusView.tsx`: wire `processFile`; block syllabus apply while uploading.
6. `QuizBuilderFields.tsx` + `CreateExamPage.tsx`: wrap local parse in `start`/`complete` so large quiz/exam files show identical feedback.
7. `CreateCoursePage.tsx`: refactor existing bespoke timer to reuse the hook (no visual change).
8. `syllabusParser.ts`: no UI change; inherits progress from its caller.

Out of scope: server upload endpoint changes, XHR true-progress, resumable/chunked uploads, multi-file queues, drag-over overlays.

## 6. Error handling

- Validation failures (type/size) alert instantly as today; never start progress.
- Upload/parse failure calls `fail()`, keeps the previous file/preview, surfaces the existing alert; no stuck 90% bar.
- Mode switches and unmount cancel the timer via `reset()`.
- File inputs reset `e.target.value = ''` after pick so the same file can be re-chosen.

## 7. Testing

- `npx tsc -b` in `client/` must pass.
- Manual matrix per surface: pick via browse, via drag-drop, via Change/replace; large file (~5MB) shows climbing %; failure path (if inducible) resets; submit/save blocked while `isUploading`.
- No new automated tests (no test runner for hooks in tree); visual consistency checked against Create Course.

## 8. Risks

- Simulated % is an estimate, not bytes-on-wire; accepted by user (matches Create Course decision).
- `FilesView` drop path currently lacks a busy guard; retrofit adds one, minor behavior change (duplicate drops ignored) which is the desired fix.
