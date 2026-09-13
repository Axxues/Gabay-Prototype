# Automatic Foldering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uploads auto-file into per-course area folders (`Announcements / Modules / Syllabus`, with per-module subfolders only under Modules), so the Files view stays organized with zero manual filing.

**Architecture:** Local-first incremental (Approach A). Pure filing rules live in `src/utils/autoFolder.ts` (vitest-covered, no React). Types gain `CourseFile.sourceArea/sourceId` and `CourseFolder.autoKey` for stable find-or-create. The store gains `fileUploadToArea` (ensure folders → dedupe name → create record → return it) plus folder-rename on module rename; upload call sites (announcement composer, module-item create/edit, syllabus apply) file through it. Files keep rendering through the existing `useCourseFiles` aggregation, which learns source labels plus the "source deleted" tag. Filed real records shadow their virtual counterparts via the existing name+url dedupe (direct files sort first), so no aggregation rewrite is needed.

**Tech Stack:** React 19 + TypeScript + Vite + Tailwind; vitest (already a devDependency). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-09-13-lms-extensions-design.md` (§5)

## Global Constraints

- No backend; all state in `LMSContext` + localStorage key `gabay_lms_db_v6`.
- Per-course area folders: `Announcements / Modules / Syllabus`; per-item subfolders ONLY under Modules (`Modules > <Module title>`).
- Files gain `sourceArea` + `sourceId` ("Announcement: X" / "Module: Y" labels, survive renames via live lookup).
- Composer/module/syllabus uploads auto-create-or-reuse the target folder and file there; the filer returns the file reference.
- Deleting the source announcement/module leaves the filed copy in place with a "source deleted" tag (no cascade — `deleteAnnouncement`/`deleteModule` already only remove their own records and stay untouched).
- Duplicate names get `name (2)` suffixing, never overwrite.
- Renaming a module renames its folder (matched by stable `autoKey`, not by name).
- Empty auto-folders are hidden from students but visible to faculty.
- Legacy files without `sourceArea` stay at course root until touched.
- **User override (binds every task): do NOT commit. Leave all work uncommitted in the working tree. Steps saying "verify" end the task; no `git add`, no `git commit`.**
- Shell is Windows PowerShell 5.1: never use `&&` to chain commands.

---

## File structure

- `src/utils/autoFolder.ts` (new) — pure rules: area names/keys, folder lookup, name dedupe, source labels, recursive emptiness. No React, no localStorage.
- `src/utils/autoFolder.test.ts` (new) — vitest units (12 tests).
- `src/types/lms.ts` (modify) — add `FileSourceArea`, `FileAreaInput`; extend `CourseFile` (`sourceArea?`, `sourceId?`) and `CourseFolder` (`autoKey?`).
- `src/context/LMSContext.tsx` (modify) — `createCourseFolder` accepts `autoKey?`; `uploadCourseFile` persists `sourceArea`/`sourceId`/`fileUrl`; new `ensureAreaFolder`, `ensureModuleFolder`, `fileUploadToArea`; `updateModule` renames the module folder on title change; `addModuleItem`/`updateModuleItem` file newly-attached files.
- `src/pages/CreateAnnouncementPage.tsx` (modify) — file the attachment after `createAnnouncement` returns.
- `src/hooks/useCourseFiles.ts` (modify) — `source` + `sourceLabel` derived from `sourceArea` with live title lookup and the deleted tag.
- `src/pages/SyllabusView.tsx` (modify) — file the scanned document in `handleApplySyllabus` with name-reuse.
- `src/pages/FilesView.tsx` (modify) — hide empty auto-folders from non-managing viewers.
- `src/pages/AddModuleItemPage.tsx` — NOT modified (it already passes file fields through `addModuleItem`/`updateModuleItem`, which file at the store layer and cover all callers).

---

### Task 1: Pure filing rules + tests

**Files:**
- Create: `src/utils/autoFolder.ts`
- Create: `src/utils/autoFolder.test.ts`

**Interfaces:**
- Consumes: `FileSourceArea` from `src/types/lms.ts` (import type only; if the type does not exist yet because Task 2 runs later, define `export type FileSourceArea = 'announcements' | 'modules' | 'syllabus'` locally in this file instead — either way the name and members must match exactly)
- Produces: `areaFolderName`, `areaFolderAutoKey`, `moduleFolderAutoKey`, `findFolderByAutoKey`, `dedupeFileName`, `resolveFiledSourceLabel`, `isFolderEmptyRecursive` used by Tasks 3–5. Keep exact names and signatures.

- [ ] **Step 1: Write the failing test**

```ts
// src/utils/autoFolder.test.ts
import { describe, expect, it } from 'vitest';
import {
  areaFolderAutoKey,
  areaFolderName,
  dedupeFileName,
  findFolderByAutoKey,
  isFolderEmptyRecursive,
  moduleFolderAutoKey,
  resolveFiledSourceLabel,
} from './autoFolder';

describe('area folders', () => {
  it('names the three area folders', () => {
    expect(areaFolderName('announcements')).toBe('Announcements');
    expect(areaFolderName('modules')).toBe('Modules');
    expect(areaFolderName('syllabus')).toBe('Syllabus');
  });
  it('builds stable auto keys', () => {
    expect(areaFolderAutoKey('announcements')).toBe('area:announcements');
    expect(moduleFolderAutoKey('mod-1')).toBe('module:mod-1');
  });
  it('finds folders by auto key within a course', () => {
    const folders = [
      { id: 'f1', courseId: 'c1', autoKey: 'area:announcements' },
      { id: 'f2', courseId: 'c2', autoKey: 'area:announcements' },
    ];
    expect(findFolderByAutoKey(folders, 'c1', 'area:announcements')?.id).toBe('f1');
    expect(findFolderByAutoKey(folders, 'c1', 'area:modules')).toBeUndefined();
  });
});

describe('dedupeFileName', () => {
  it('keeps names with no conflict', () => {
    expect(dedupeFileName('report.pdf', [])).toBe('report.pdf');
  });
  it('suffixes the first duplicate before the extension', () => {
    expect(dedupeFileName('report.pdf', ['report.pdf'])).toBe('report (2).pdf');
  });
  it('increments past taken suffixes', () => {
    expect(dedupeFileName('report.pdf', ['report.pdf', 'report (2).pdf'])).toBe('report (3).pdf');
  });
  it('suffixes extensionless names at the end', () => {
    expect(dedupeFileName('notes', ['notes'])).toBe('notes (2)');
  });
});

describe('resolveFiledSourceLabel', () => {
  it('labels live announcements and survives renames', () => {
    expect(
      resolveFiledSourceLabel({ sourceArea: 'announcements', sourceId: 'a1' }, [{ id: 'a1', title: 'Week 3 Memo' }], [])
    ).toBe('Announcement: Week 3 Memo');
  });
  it('tags deleted announcements', () => {
    expect(resolveFiledSourceLabel({ sourceArea: 'announcements', sourceId: 'gone' }, [], [])).toBe('Source deleted');
  });
  it('labels modules via the contained item and tags removed items', () => {
    const mods = [{ title: 'Unit 1', items: [{ id: 'item-9' }] }];
    expect(resolveFiledSourceLabel({ sourceArea: 'modules', sourceId: 'item-9' }, [], mods)).toBe('Module: Unit 1');
    expect(resolveFiledSourceLabel({ sourceArea: 'modules', sourceId: 'missing' }, [], mods)).toBe('Source deleted');
  });
  it('labels syllabus and direct uploads', () => {
    expect(resolveFiledSourceLabel({ sourceArea: 'syllabus', sourceId: 'c1' }, [], [])).toBe('Syllabus');
    expect(resolveFiledSourceLabel({}, [], [])).toBe('Direct Upload');
  });
});

describe('isFolderEmptyRecursive', () => {
  const folders = [
    { id: 'area', parentId: null },
    { id: 'sub-empty', parentId: 'area' },
    { id: 'sub-full', parentId: 'area' },
  ];
  it('reports empty leaves and empty parents of empty children', () => {
    expect(isFolderEmptyRecursive(folders, [], 'sub-empty')).toBe(true);
    expect(isFolderEmptyRecursive(folders, [], 'area')).toBe(true);
  });
  it('reports parents of non-empty children as non-empty', () => {
    expect(isFolderEmptyRecursive(folders, [{ folderId: 'sub-full' }], 'area')).toBe(false);
    expect(isFolderEmptyRecursive(folders, [{ folderId: 'area' }], 'area')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/utils/autoFolder.test.ts`
Expected: FAIL with "Failed to resolve import ./autoFolder" (file does not exist yet).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/utils/autoFolder.ts
import type { FileSourceArea } from '../types/lms';

export function areaFolderName(area: FileSourceArea): string {
  if (area === 'announcements') return 'Announcements';
  if (area === 'modules') return 'Modules';
  return 'Syllabus';
}

export function areaFolderAutoKey(area: FileSourceArea): string {
  return `area:${area}`;
}

export function moduleFolderAutoKey(moduleId: string): string {
  return `module:${moduleId}`;
}

export function findFolderByAutoKey<T extends { courseId: string; autoKey?: string }>(
  folders: T[],
  courseId: string,
  autoKey: string
): T | undefined {
  return folders.find(f => f.courseId === courseId && f.autoKey === autoKey);
}

export function dedupeFileName(name: string, existingNames: string[]): string {
  if (!existingNames.includes(name)) return name;
  const dot = name.lastIndexOf('.');
  const hasExt = dot > 0;
  const base = hasExt ? name.slice(0, dot) : name;
  const ext = hasExt ? name.slice(dot) : '';
  let n = 2;
  let candidate = `${base} (${n})${ext}`;
  while (existingNames.includes(candidate)) {
    n += 1;
    candidate = `${base} (${n})${ext}`;
  }
  return candidate;
}

export function resolveFiledSourceLabel(
  file: { sourceArea?: string; sourceId?: string },
  announcements: { id: string; title: string }[],
  modules: { title: string; items: { id: string }[] }[]
): string {
  if (file.sourceArea === 'announcements') {
    const ann = announcements.find(a => a.id === file.sourceId);
    return ann ? `Announcement: ${ann.title}` : 'Source deleted';
  }
  if (file.sourceArea === 'modules') {
    const mod = modules.find(m => (m.items || []).some(i => i.id === file.sourceId));
    return mod ? `Module: ${mod.title}` : 'Source deleted';
  }
  if (file.sourceArea === 'syllabus') return 'Syllabus';
  return 'Direct Upload';
}

export function isFolderEmptyRecursive(
  folders: { id: string; parentId?: string | null }[],
  files: { folderId?: string | null }[],
  folderId: string
): boolean {
  const descendantIds = new Set<string>([folderId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const f of folders) {
      if (f.parentId && descendantIds.has(f.parentId) && !descendantIds.has(f.id)) {
        descendantIds.add(f.id);
        grew = true;
      }
    }
  }
  return !files.some(f => f.folderId && descendantIds.has(f.folderId));
}
```

Note: `FileSourceArea` is added to `src/types/lms.ts` in Task 2. If the type-only import fails at authoring time, define the union locally with the identical name/members — the Task 2 type must then match this file exactly (`'announcements' | 'modules' | 'syllabus'`).

- [ ] **Step 4: Run tests + typecheck to verify they pass**

Run: `npx vitest run src/utils/autoFolder.test.ts`
Expected: 13/13 PASS.
Run: `npx tsc -b`
Expected: PASS (no output).

- [ ] **Step 5: Leave uncommitted (user override — no commit)**

---

### Task 2: Filing types

**Files:**
- Modify: `src/types/lms.ts` (CourseFile interface ~line 398-413; CourseFolder interface ~line 415-421)

**Interfaces:**
- Consumes: none
- Produces: `FileSourceArea`, `FileAreaInput`, `CourseFile.sourceArea?`, `CourseFile.sourceId?`, `CourseFolder.autoKey?` used by Tasks 1 (import, if not locally defined) and 3–5. Keep exact names. If Task 1 defined `FileSourceArea` locally, this task's definition must use identical members and Task 1's file is left as-is (duplicate identical union across files is acceptable; do NOT refactor Task 1's file).

- [ ] **Step 1: Add the types**

After the `CourseFolder` interface closing brace, insert:

```ts
export type FileSourceArea = 'announcements' | 'modules' | 'syllabus';

export interface FileAreaInput {
  courseId: string;
  area: FileSourceArea;
  sourceId?: string;
  moduleId?: string;
  moduleTitle?: string;
  name: string;
  url?: string;
  fileUrl?: string;
  size?: number;
  formattedSize?: string;
  type?: CourseFile['type'];
  visibility?: CourseFile['visibility'];
  content?: string;
  reuseExistingName?: boolean;
}
```

In `CourseFile`, after the `fileUrl?: string;` line add:

```ts
  sourceArea?: FileSourceArea;
  sourceId?: string;
```

In `CourseFolder`, after the `updatedAt: string;` line add:

```ts
  autoKey?: string;
```

All additions are optional, so saved databases and existing literals keep compiling; every consumer guards with `|| []` / `|| {}` / optional chaining per existing patterns.

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 3: Leave uncommitted (user override — no commit)**

---

### Task 3: Store — filer, folder ensure, rename + item filing

**Files:**
- Modify: `src/context/LMSContext.tsx` (interface ~lines 160-163; `createCourseFolder` ~line 2193; `uploadCourseFile` ~line 2208; `updateModule` ~line 956; `addModuleItem` ~line 975; `updateModuleItem` ~line 1009; provider value ~lines 2939-2940 — line numbers may have shifted, locate by symbol names)

**Interfaces:**
- Consumes: `areaFolderName`, `areaFolderAutoKey`, `moduleFolderAutoKey`, `findFolderByAutoKey`, `dedupeFileName` (Task 1); `FileSourceArea`, `FileAreaInput`, `CourseFile`, `CourseFolder` (Task 2)
- Produces: `ensureAreaFolder(courseId, area) => CourseFolder`, `ensureModuleFolder(courseId, moduleId, moduleTitle) => CourseFolder`, `fileUploadToArea(input: FileAreaInput) => CourseFile` used by Tasks 4–5. Keep exact names and signatures.

- [ ] **Step 1: Extend `createCourseFolder` and `uploadCourseFile`**

Change the signature to accept and persist the stable key (existing 3-arg calls keep working):

```ts
const createCourseFolder = (courseId: string, name: string, parentId?: string | null, autoKey?: string): CourseFolder => {
  const newFolder: CourseFolder = {
    id: `fld-${Date.now().toString(36)}`,
    courseId,
    name,
    parentId: parentId || null,
    updatedAt: new Date().toISOString(),
    ...(autoKey ? { autoKey } : {})
  };
  setDb(prev => ({
    ...prev,
    courseFolders: [...(prev.courseFolders || []), newFolder]
  }));
  return newFolder;
};
```

In `uploadCourseFile`'s `newFile` literal, add three passthrough lines (after the `url: fileData.url` line):

```ts
    fileUrl: fileData.fileUrl,
    sourceArea: fileData.sourceArea,
    sourceId: fileData.sourceId,
```

Add the interface entries (next to the existing folder/file entries):

```ts
ensureAreaFolder: (courseId: string, area: FileSourceArea) => CourseFolder;
ensureModuleFolder: (courseId: string, moduleId: string, moduleTitle: string) => CourseFolder;
fileUploadToArea: (input: FileAreaInput) => CourseFile;
```

`FileSourceArea`, `FileAreaInput`, `CourseFile`, `CourseFolder` must be in the file's type imports (add any that are missing). Add the `autoFolder` util import:

```ts
import { areaFolderAutoKey, areaFolderName, dedupeFileName, findFolderByAutoKey, moduleFolderAutoKey } from '../utils/autoFolder';
```

- [ ] **Step 2: Add the three store functions after `uploadCourseFile`**

```ts
const ensureAreaFolder = (courseId: string, area: FileSourceArea): CourseFolder => {
  const autoKey = areaFolderAutoKey(area);
  const existing = findFolderByAutoKey(db.courseFolders || [], courseId, autoKey);
  if (existing) return existing;
  return createCourseFolder(courseId, areaFolderName(area), null, autoKey);
};

const ensureModuleFolder = (courseId: string, moduleId: string, moduleTitle: string): CourseFolder => {
  const autoKey = moduleFolderAutoKey(moduleId);
  const existing = findFolderByAutoKey(db.courseFolders || [], courseId, autoKey);
  if (existing) return existing;
  const parent = ensureAreaFolder(courseId, 'modules');
  return createCourseFolder(courseId, moduleTitle, parent.id, autoKey);
};

const fileUploadToArea = (input: FileAreaInput): CourseFile => {
  const areaFolder = ensureAreaFolder(input.courseId, input.area);
  let targetFolderId = areaFolder.id;
  if (input.area === 'modules' && input.moduleId) {
    targetFolderId = ensureModuleFolder(input.courseId, input.moduleId, input.moduleTitle || 'Module').id;
  }
  const siblings = (db.courseFiles || [])
    .filter(f => f.courseId === input.courseId && (f.folderId || null) === targetFolderId)
    .map(f => f.name);
  if (input.reuseExistingName) {
    const existing = (db.courseFiles || []).find(
      f => f.courseId === input.courseId && (f.folderId || null) === targetFolderId && f.name === input.name
    );
    if (existing) return existing;
  }
  return uploadCourseFile({
    courseId: input.courseId,
    folderId: targetFolderId,
    name: dedupeFileName(input.name, siblings),
    size: input.size,
    formattedSize: input.formattedSize,
    type: input.type || 'document',
    visibility: input.visibility || 'published',
    url: input.url,
    fileUrl: input.fileUrl,
    content: input.content || '',
    sourceArea: input.area,
    sourceId: input.sourceId,
  });
};
```

Wire all three names into the provider `value` object next to `createCourseFolder` / `uploadCourseFile`. (`db` reads outside `setDb` follow the existing precedent in this file, e.g. template/submission lookups.)

- [ ] **Step 3: Rename module folders in `updateModule`, file new attachments in `addModuleItem`/`updateModuleItem`**

Replace the `updateModule` body with:

```ts
const updateModule = (moduleId: string, updates: Partial<Module>) => {
  setDb(prev => {
    const mod = (prev.modules || []).find(m => m.id === moduleId);
    const newTitle = updates.title !== undefined && mod && updates.title !== mod.title ? updates.title : null;
    return {
      ...prev,
      modules: (prev.modules || []).map(m => (m.id === moduleId ? { ...m, ...updates } : m)),
      courseFolders: newTitle
        ? (prev.courseFolders || []).map(f =>
            f.autoKey === moduleFolderAutoKey(moduleId)
              ? { ...f, name: newTitle, updatedAt: new Date().toISOString() }
              : f
          )
        : prev.courseFolders
    };
  });
};
```

In `addModuleItem`, after the existing `setDb` block that appends `newItem`, append:

```ts
if (newItem.fileName || newItem.fileUrl) {
  const mod = db.modules.find(m => m.id === moduleId);
  fileUploadToArea({
    courseId: mod?.courseId || activeCourseId || 'crs-cmsc131',
    area: 'modules',
    sourceId: newItem.id,
    moduleId,
    moduleTitle: mod?.title || 'Module',
    name: newItem.fileName || newItem.title,
    url: newItem.fileUrl,
    fileUrl: newItem.fileUrl,
    formattedSize: newItem.fileSize,
    type: (['pdf', 'document', 'slide', 'code', 'archive', 'image'] as string[]).includes(newItem.fileType || '')
      ? (newItem.fileType as CourseFile['type'])
      : 'document',
  });
}
```

(The seed `addModuleItem` call passes no file fields, so no spurious seed filing; the gate is the `fileName || fileUrl` check.)

In `updateModuleItem`, before the existing `setDb`, capture:

```ts
const prevItem = db.modules.find(m => m.id === currentModuleId)?.items.find(i => i.id === itemId);
const hadFile = !!(prevItem?.fileName || prevItem?.fileUrl);
```

After the existing `setDb` block, append:

```ts
const willHaveFile = !!((updates.fileName ?? prevItem?.fileName) || (updates.fileUrl ?? prevItem?.fileUrl));
const alreadyFiled = (db.courseFiles || []).some(f => f.sourceId === itemId);
if (!hadFile && willHaveFile && !alreadyFiled) {
  const destId = targetModuleId || currentModuleId;
  const destMod = db.modules.find(m => m.id === destId);
  fileUploadToArea({
    courseId: destMod?.courseId || activeCourseId || 'crs-cmsc131',
    area: 'modules',
    sourceId: itemId,
    moduleId: destId,
    moduleTitle: destMod?.title || 'Module',
    name: updates.fileName || prevItem?.fileName || prevItem?.title || 'Module file',
    url: updates.fileUrl ?? prevItem?.fileUrl,
    fileUrl: updates.fileUrl ?? prevItem?.fileUrl,
    formattedSize: updates.fileSize ?? prevItem?.fileSize,
    type: (['pdf', 'document', 'slide', 'code', 'archive', 'image'] as string[]).includes((updates.fileType ?? prevItem?.fileType) || '')
      ? ((updates.fileType ?? prevItem?.fileType) as CourseFile['type'])
      : 'document',
  });
}
```

Edit-attach is covered (file appears where none was); cross-module moves keep the record with a live-resolving label (sourceId is the item id, resolved by containment in Task 4's label mapping).

- [ ] **Step 4: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 5: Leave uncommitted (user override — no commit)**

---

### Task 4: Announcement filing + aggregation labels

**Files:**
- Modify: `src/pages/CreateAnnouncementPage.tsx` (imports; `handleSubmit` ~lines 103-139 — locate by symbol names)
- Modify: `src/hooks/useCourseFiles.ts` (direct-files mapping ~lines 54-63)

**Interfaces:**
- Consumes: `fileUploadToArea` (Task 3); `resolveFiledSourceLabel` (Task 1); `detectFileType` (existing export of `useCourseFiles.ts` for the composer)
- Produces: filed announcement records + correct Files labels. No downstream consumers.

- [ ] **Step 1: File the attachment after the announcement is created**

In `CreateAnnouncementPage.tsx`, extend the `useLMS()` destructure with `fileUploadToArea` and add the import:

```tsx
import { detectFileType } from '../hooks/useCourseFiles';
```

(If an import from `'../hooks/useCourseFiles'` already exists for types, merge into it; duplicate module imports are legal but keep one.)

In `handleSubmit`, capture the created record and file its attachment:

```tsx
const ann = createAnnouncement({
  courseId,
  title: title.trim(),
  content: content.trim(),
  sectionId: sectionRestriction === 'all' ? 'all' : sectionRestriction,
  sectionRestriction: sectionRestriction === 'all' ? 'All Sections' : sectionRestriction,
  delayedUntil: delayPosting && delayedDate ? delayedDate : undefined,
  allowComments,
  usersMustPostBeforeReplies: false,
  allowLiking,
  pinned,
  attachments
});

if (attachedFile) {
  fileUploadToArea({
    courseId,
    area: 'announcements',
    sourceId: ann.id,
    name: attachedFile.name,
    url: attachedFile.url,
    fileUrl: attachedFile.url,
    formattedSize: attachedFile.size,
    type: detectFileType(attachedFile.name),
  });
}
```

Everything else in `handleSubmit` (validation, alert, `onAnnouncementCreated`) stays unchanged. Attachments chosen from existing files (`handleSelectExistingFile`) file a second reference copy the same way — intended (the announcement is a new source).

- [ ] **Step 2: Derive `source` + `sourceLabel` from `sourceArea` in the aggregation**

In `useCourseFiles.ts`, add the import:

```ts
import { resolveFiledSourceLabel } from '../utils/autoFolder';
```

Replace the direct-files `.map` (lines ~59-63) with:

```ts
.map(f => {
  const area = (f as CourseFile).sourceArea;
  return {
    ...f,
    source: area === 'announcements' ? 'announcements' : area === 'modules' ? 'modules' : 'uploads',
    sourceLabel: resolveFiledSourceLabel(f, db.announcements || [], db.modules || [])
  };
});
```

`db` is already in scope via `useLMS()` in the hook. Virtual module/announcement entries keep their existing labels; filed real records (same name+url) shadow them through the existing dedupe (direct files sort first), so each upload appears exactly once, inside its folder, with a live title or "Source deleted" tag.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 4: Leave uncommitted (user override — no commit)**

---

### Task 5: Syllabus filing + student folder hiding

**Files:**
- Modify: `src/pages/SyllabusView.tsx` (`handleApplySyllabus` ~line 256; extend the existing `useLMS()` destructure — locate by symbol names)
- Modify: `src/pages/FilesView.tsx` (folder list filter ~lines 87-93; `db` and `canManage` already in scope)

**Interfaces:**
- Consumes: `fileUploadToArea` (Task 3); `isFolderEmptyRecursive` (Task 1)
- Produces: filed syllabus records + student hiding. Terminal UI task.

- [ ] **Step 1: File the scanned document on syllabus apply**

In `SyllabusView.tsx`, add `fileUploadToArea` to the existing `useLMS()` destructure. In `handleApplySyllabus`, immediately after the `updateCourseSyllabus(courseId, boundSyllabus);` line, insert:

```tsx
fileUploadToArea({
  courseId,
  area: 'syllabus',
  sourceId: courseId,
  name: scanResult.fileName,
  formattedSize: scanResult.fileSize,
  type: scanResult.fileType === 'pdf' ? 'pdf' : 'document',
  reuseExistingName: true,
});
```

`reuseExistingName` makes re-applying the same scanned file idempotent (returns the existing record instead of piling `name (2)` copies). Nothing else in `handleApplySyllabus` changes.

- [ ] **Step 2: Hide empty auto-folders from non-managing viewers**

In `FilesView.tsx`, add the import:

```tsx
import { isFolderEmptyRecursive } from '../utils/autoFolder';
```

Restructure the `currentFolders` filter (lines ~87-93) to:

```tsx
const currentFolders = (sourceFilter === 'all' || sourceFilter === 'uploads')
  ? allFolders.filter(f => {
    if (searchQuery) return f.name.toLowerCase().includes(searchQuery.toLowerCase());
    const atLevel = currentFolderId ? f.parentId === currentFolderId : !f.parentId;
    if (!atLevel) return false;
    if (!canManage && f.autoKey && isFolderEmptyRecursive(allFolders, db.courseFiles || [], f.id)) return false;
    return true;
  })
  : [];
```

`canManage` (faculty/personal) still sees empty auto-folders; students only see auto-folders that contain files (directly or through subfolders). Manual folders and legacy root files are unaffected.

- [ ] **Step 3: Typecheck**

Run: `npx tsc -b`
Expected: PASS.

- [ ] **Step 4: Leave uncommitted (user override — no commit)**

---

### Task 6: Verification — filing suite, typecheck, manual matrix

**Files:**
- Test only: `src/utils/autoFolder.test.ts`; manual exercise of announcement/module/syllabus uploads + Files view
- No source changes in this task unless verification exposes a defect (if so, fix minimally in the owning file, re-run its covering tests, and record the fix in the report)

**Interfaces:**
- Consumes: all Tasks 1–5 outputs
- Produces: nothing (terminal task — verification evidence only)

- [ ] **Step 1: Run the automated suite**

Run: `npx vitest run src/utils/autoFolder.test.ts`
Expected: 13/13 PASS.
Run: `npx tsc -b`
Expected: PASS (no output).

- [ ] **Step 2: Manual verification matrix** (faculty role unless stated)

1. Announcement with file/image → course `Announcements` folder (auto-created) contains the record; Files view shows it inside the folder with label `Announcement: <title>`; editing the announcement title updates the label (rename survival).
2. Module file item → `Modules > <Module title>` subfolder (auto-created) contains it; rename the module → subfolder renamed; delete the module → record stays with `Source deleted` tag (no cascade).
3. Syllabus scan + Apply → `Syllabus` folder contains the record; re-apply the same file → no duplicate (name reuse).
4. Same filename uploaded twice to one announcement flow → second record named `name (2).ext`, never overwrite.
5. Legacy files (no `sourceArea`) stay at course root; manual Files uploads keep working as before.
6. Student view: empty auto-folders hidden; faculty view: visible. Filed records respect existing visibility rules.
7. Delete the announcement from scenario 1 → filed copy stays with `Source deleted` tag.

Record each scenario's PASS/FAIL with one-line evidence. Scenarios that cannot be clicked in the environment may be traced through the wired code with exact file:line references — label each CLICKED vs TRACED with why.

- [ ] **Step 3: Leave uncommitted (user override — no commit)**

---

## Self-Review

**1. Spec coverage (§5):** Per-course area folders + Modules-only subfolders → Tasks 1 (names/keys), 3 (ensure). Files gain `sourceArea`/`sourceId` → Task 2 (types) + 3 (persist). Composer/module/syllabus auto-file with returned reference → Tasks 3 (filer), 4 (announcement), 5 (syllabus); module items covered at the store layer for all creators (Task 3). Delete-source leaves tagged file, no cascade → existing delete actions untouched + Task 4 label mapping. Dupe `(2)` suffixing → Tasks 1 (pure) + 3 (apply). Module rename renames folder → Task 3 (`updateModule`). Empty auto-folders hidden from students, visible to faculty → Task 5 (FilesView). Legacy at root → default (no `sourceArea`, `folderId` null) + Task 6 scenario 5.

**2. Placeholder scan:** No TBD/TODO; every step has exact code or exact file:symbol anchors; no "similar to" without content (Task 1's `FileSourceArea` fallback names the exact local definition and the no-refactor rule); no undefined functions (produced/consumed names match across tasks: `areaFolderName`, `areaFolderAutoKey`, `moduleFolderAutoKey`, `findFolderByAutoKey`, `dedupeFileName`, `resolveFiledSourceLabel`, `isFolderEmptyRecursive`, `ensureAreaFolder`, `ensureModuleFolder`, `fileUploadToArea`, `FileAreaInput`, `FileSourceArea`).

**3. Type consistency:** `FileAreaInput.type`/`visibility` reuse `CourseFile` indexed access so the filer accepts exactly what `uploadCourseFile` stores; `sourceId` is stringly-typed in both (`ann.id`, item ids, courseId) and resolved structurally by the label mapper; `autoKey` is `string|undefined` on folders and compared with `===` against Task 1's `area:`/`module:` conventions in both store and tests; the Task 4 `source` override values (`announcements`/`modules`/`uploads`) are exactly the existing `sourceFilter` union members in FilesView.
