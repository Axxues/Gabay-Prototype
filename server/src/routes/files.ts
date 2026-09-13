import path from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../db.js';
import { asyncHandler, ApiError } from '../utils/errors.js';
import { authenticateToken } from '../middleware/auth.js';
import type { AuthPayload } from '../middleware/auth.js';
import { dedupeFileName } from '../utils/names.js';
import { VISIBILITIES } from '../utils/allowed.js';

export const filesRouter = Router();

// Memory storage: the handler persists the buffer with node:fs so tests can
// mock the filesystem while exercising the real multer parse.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function isPersonalScope(courseId: string): boolean {
  return courseId.startsWith('user-');
}

interface CourseRow {
  id: string;
  instructorId: string;
}

// Personal scope (`user-<id>`) has no Course row: ownership is the check.
// Course scope loads the row or 404s.
async function loadScopeOr404(courseId: string, auth: AuthPayload) {
  if (isPersonalScope(courseId)) {
    if (courseId !== `user-${auth.sub}`) {
      throw new ApiError(403, 'forbidden', 'You can only access your own personal files.');
    }
    return null;
  }
  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course) throw new ApiError(404, 'not_found', 'Course not found.');
  return course;
}

async function assertScopeAccess(course: CourseRow | null, auth: AuthPayload): Promise<void> {
  if (!course) return;
  if (auth.role === 'faculty' || auth.role === 'admin') return;
  if (course.instructorId === auth.sub) return;
  const membership = await prisma.enrollmentRequest.findFirst({
    where: { courseId: course.id, studentId: auth.sub, status: 'approved' },
  });
  if (!membership) throw new ApiError(403, 'forbidden', 'You are not a member of this course.');
}

// POST /api/courses/:id/folders + DELETE /api/folders/:folderId are faculty
// work in course scope; any role may manage its own personal scope.
function assertCanManageScope(
  course: CourseRow | null,
  scopeId: string,
  auth: AuthPayload
): void {
  if (auth.role === 'faculty' || auth.role === 'admin') return;
  if (!course && scopeId === `user-${auth.sub}`) return;
  throw new ApiError(403, 'forbidden', 'Only faculty can manage course folders.');
}

// Port of the client's detectFileType (src/hooks/useCourseFiles.ts) verbatim:
// extension suffixes map to the CourseFile type union, else 'document'.
function detectFileType(nameOrUrl: string): string {
  const lower = (nameOrUrl || '').toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (
    lower.endsWith('.png') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.svg')
  )
    return 'image';
  if (
    lower.endsWith('.zip') ||
    lower.endsWith('.tar') ||
    lower.endsWith('.gz') ||
    lower.endsWith('.rar') ||
    lower.endsWith('.7z')
  )
    return 'archive';
  if (
    lower.endsWith('.ts') ||
    lower.endsWith('.tsx') ||
    lower.endsWith('.js') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.py') ||
    lower.endsWith('.json') ||
    lower.endsWith('.html') ||
    lower.endsWith('.css')
  )
    return 'code';
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'slide';
  return 'document';
}

// Port of the client's uploadCourseFile size label verbatim.
function formatSize(size: number): string {
  return size > 1048576 ? `${(size / 1048576).toFixed(1)} MB` : `${Math.round(size / 1024)} KB`;
}

// Same cwd-relative resolution as the /uploads static mount in index.ts.
function uploadsRoot(): string {
  return process.cwd().endsWith('server')
    ? path.resolve('uploads')
    : path.resolve('server/uploads');
}

const AREA_FOLDER_NAMES = {
  announcements: 'Announcements',
  modules: 'Modules',
  syllabus: 'Syllabus',
} as const;

type FileArea = keyof typeof AREA_FOLDER_NAMES;

function isFileArea(value: unknown): value is FileArea {
  return (
    value === 'announcements' || value === 'modules' || value === 'syllabus'
  );
}

// Mirrors the client's ensureAreaFolder/ensureModuleFolder filing rules with
// the verbatim autoKey conventions (`area:<area>`, `module:<id>`).
async function ensureAreaFolder(
  courseId: string,
  area: FileArea,
  moduleId?: string,
  moduleTitle?: string
) {
  const autoKey = `area:${area}`;
  let folder = await prisma.courseFolder.findFirst({ where: { courseId, autoKey } });
  if (!folder) {
    folder = await prisma.courseFolder.create({
      data: {
        id: newId('fld'),
        courseId,
        parentId: null,
        name: AREA_FOLDER_NAMES[area],
        autoKey,
      },
    });
  }
  if (area === 'modules' && moduleId) {
    const moduleAutoKey = `module:${moduleId}`;
    let child = await prisma.courseFolder.findFirst({
      where: { courseId, autoKey: moduleAutoKey },
    });
    if (!child) {
      child = await prisma.courseFolder.create({
        data: {
          id: newId('fld'),
          courseId,
          parentId: folder.id,
          name: moduleTitle || 'Module',
          autoKey: moduleAutoKey,
        },
      });
    }
    return child;
  }
  return folder;
}

// GET /api/courses/:id/folders (all folders in scope)
filesRouter.get(
  '/courses/:id/folders',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadScopeOr404(req.params.id, auth);
    await assertScopeAccess(course, auth);
    const folders = await prisma.courseFolder.findMany({ where: { courseId: req.params.id } });
    res.json({ folders });
  })
);

// POST /api/courses/:id/folders (faculty or personal scope only)
filesRouter.post(
  '/courses/:id/folders',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const scopeId = req.params.id;
    const course = await loadScopeOr404(scopeId, auth);
    assertCanManageScope(course, scopeId, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { name, parentId } = body;
    if (typeof name !== 'string' || !name.trim()) {
      throw new ApiError(400, 'bad_request', 'Field name is required.');
    }
    let parent: string | null = null;
    if (parentId !== undefined && parentId !== null && parentId !== '') {
      if (typeof parentId !== 'string') {
        throw new ApiError(400, 'bad_request', "Field 'parentId' must be a string.");
      }
      const parentFolder = await prisma.courseFolder.findUnique({ where: { id: parentId } });
      if (!parentFolder || parentFolder.courseId !== scopeId) {
        throw new ApiError(404, 'not_found', 'Parent folder not found.');
      }
      parent = parentFolder.id;
    }
    const folder = await prisma.courseFolder.create({
      data: { id: newId('fld'), courseId: scopeId, parentId: parent, name: name.trim() },
    });
    res.status(201).json({ folder });
  })
);

// DELETE /api/folders/:folderId — mirrors the client's deleteCourseFolder
// exactly: the folder plus direct children (parentId one level), and files
// filed directly in the folder. Nothing deeper, no other cascades.
filesRouter.delete(
  '/folders/:folderId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const folder = await prisma.courseFolder.findUnique({
      where: { id: req.params.folderId },
    });
    if (!folder) throw new ApiError(404, 'not_found', 'Folder not found.');
    if (
      auth.role !== 'faculty' &&
      auth.role !== 'admin' &&
      folder.courseId !== `user-${auth.sub}`
    ) {
      throw new ApiError(403, 'forbidden', 'Only faculty can manage course folders.');
    }
    await prisma.courseFolder.deleteMany({
      where: { OR: [{ id: folder.id }, { parentId: folder.id }] },
    });
    await prisma.courseFile.deleteMany({ where: { folderId: folder.id } });
    res.json({ ok: true });
  })
);

// GET /api/courses/:id/files (direct CourseFile rows; virtual aggregation
// stays client-side)
filesRouter.get(
  '/courses/:id/files',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const course = await loadScopeOr404(req.params.id, auth);
    await assertScopeAccess(course, auth);
    const files = await prisma.courseFile.findMany({ where: { courseId: req.params.id } });
    res.json({ files });
  })
);

// POST /api/courses/:id/files/upload (multer single `file`)
filesRouter.post(
  '/courses/:id/files/upload',
  authenticateToken,
  upload.single('file'),
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const scopeId = req.params.id;
    const course = await loadScopeOr404(scopeId, auth);
    await assertScopeAccess(course, auth);
    const data = (req.body ?? {}) as Record<string, unknown>;
    if (!req.file) {
      throw new ApiError(400, 'bad_request', 'Field file is required.');
    }
    const visibility = data.visibility === undefined ? 'published' : data.visibility;
    if (!(VISIBILITIES as readonly string[]).includes(visibility as string)) {
      throw new ApiError(400, 'bad_request', 'Field visibility is not a valid visibility.');
    }
    const rawFolderId = data.folderId;
    const folderId =
      typeof rawFolderId === 'string' && rawFolderId ? rawFolderId : null;
    let targetFolderId: string | null = null;
    let sourceArea: string | null = null;
    let sourceId: string | null = null;
    if (folderId) {
      const folder = await prisma.courseFolder.findUnique({ where: { id: folderId } });
      if (!folder || folder.courseId !== scopeId) {
        throw new ApiError(404, 'not_found', 'Folder not found.');
      }
      targetFolderId = folder.id;
    } else if (data.area !== undefined && data.area !== null && data.area !== '') {
      // Area filing mirrors the client's fileUploadToArea input shape.
      if (!isFileArea(data.area)) {
        throw new ApiError(400, 'bad_request', 'Field area is not a valid file area.');
      }
      const moduleId =
        typeof data.moduleId === 'string' && data.moduleId ? data.moduleId : undefined;
      const moduleTitle =
        typeof data.moduleTitle === 'string' && data.moduleTitle
          ? data.moduleTitle
          : undefined;
      const areaFolder = await ensureAreaFolder(scopeId, data.area, moduleId, moduleTitle);
      targetFolderId = areaFolder.id;
      sourceArea = data.area;
      sourceId = moduleId ?? null;
    }
    const siblings = await prisma.courseFile.findMany({
      where: { courseId: scopeId, folderId: targetFolderId },
      select: { name: true },
    });
    const storedName = dedupeFileName(
      req.file.originalname,
      siblings.map((f) => f.name)
    );
    const dir = path.join(uploadsRoot(), scopeId);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, path.basename(storedName)), req.file.buffer);
    const me = await prisma.user.findUnique({ where: { id: auth.sub } });
    const file = await prisma.courseFile.create({
      data: {
        id: newId('file'),
        courseId: scopeId,
        folderId: targetFolderId,
        name: storedName,
        size: req.file.size,
        formattedSize: formatSize(req.file.size),
        type: detectFileType(storedName),
        visibility: visibility as string,
        uploadedBy: auth.sub,
        uploadedByName: (me as { name?: string } | null)?.name ?? '',
        content: '',
        url: `/uploads/${scopeId}/${storedName}`,
        fileUrl: `/uploads/${scopeId}/${storedName}`,
        sourceArea,
        sourceId,
      },
    });
    res.status(201).json({ file });
  })
);

async function loadFileOr404(fileId: string) {
  const file = await prisma.courseFile.findUnique({ where: { id: fileId } });
  if (!file) throw new ApiError(404, 'not_found', 'File not found.');
  return file;
}

// Faculty or the uploader. Rows auto-filed by Task 4 stamp uploadedBy: ''
// (never equal to a user id), so those stay faculty-only under this exact
// check — deliberately NOT widened.
function assertCanWriteFile(file: { uploadedBy: string }, auth: AuthPayload): void {
  if (auth.role === 'faculty' || auth.role === 'admin') return;
  if (file.uploadedBy === auth.sub) return;
  throw new ApiError(403, 'forbidden', 'Only faculty or the uploader can modify this file.');
}

// PATCH /api/files/:fileId (rename name / visibility; faculty or uploader)
filesRouter.patch(
  '/files/:fileId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const file = await loadFileOr404(req.params.fileId);
    assertCanWriteFile(file, auth);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const data: Record<string, string> = {};
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || !body.name.trim()) {
        throw new ApiError(400, 'bad_request', "Field 'name' must be a non-empty string.");
      }
      data.name = body.name.trim();
    }
    if (body.visibility !== undefined) {
      if (!(VISIBILITIES as readonly string[]).includes(body.visibility as string)) {
        throw new ApiError(400, 'bad_request', 'Field visibility is not a valid visibility.');
      }
      data.visibility = body.visibility as string;
    }
    if (Object.keys(data).length === 0) {
      throw new ApiError(400, 'bad_request', 'Nothing to update.');
    }
    const updated = await prisma.courseFile.update({ where: { id: file.id }, data });
    res.json({ file: updated });
  })
);

// DELETE /api/files/:fileId (direct row only; faculty or uploader)
filesRouter.delete(
  '/files/:fileId',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const auth = req.auth!;
    const file = await loadFileOr404(req.params.fileId);
    assertCanWriteFile(file, auth);
    await prisma.courseFile.delete({ where: { id: file.id } });
    res.json({ ok: true });
  })
);
