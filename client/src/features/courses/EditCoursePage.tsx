import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useLMS, generateCourseJoinCode } from '../../shared/context/LMSContext';
import { useSimulatedUpload } from '../../shared/hooks/useSimulatedUpload';
import { uploadFileToPublic, isImageFile } from '../../shared/utils/fileUploader';
import { UploadProgress } from '../../shared/components/common/UploadProgress';
import { UserAvatar } from '../../shared/components/common/UserAvatar';
import { normalizeAssignedSemester } from './utils/chairSheetParser';
import type { Course, UserRole } from '../../shared/types/lms';
import { isFacultyRole } from '../../shared/utils/roles';
import { resolveDirectusAssetUrl } from '../../shared/utils/avatar';
import { likhaLmsApi } from '../../shared/api/likhaLmsApi';
import {
  ArrowLeft,
  BookOpen,
  Check,
  Sparkles,
  GraduationCap,
  ImageIcon,
  Upload,
  X,
  Ban,
  KeyRound,
  RefreshCw,
  CalendarDays,
  Loader2
} from 'lucide-react';

const PRESET_COLORS = [
  { label: 'Cellwego Blue', hex: '#2563eb' },
  { label: 'Emerald Green', hex: '#059669' },
  { label: 'Rose Pink', hex: '#be185d' },
  { label: 'Amber Gold', hex: '#d97706' },
  { label: 'Purple Violet', hex: '#7c3aed' },
  { label: 'Slate Zinc', hex: '#475569' }
];

const PRESET_IMAGES = [
  {
    label: 'AI & Neural Systems',
    url: 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'Software & Web Dev',
    url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'Cybersecurity & Networks',
    url: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'Data Science & Metrics',
    url: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'Hardware & Architecture',
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80'
  },
  {
    label: 'Algorithms & Mathematics',
    url: 'https://images.unsplash.com/photo-1509228468518-180dd4864904?w=800&auto=format&fit=crop&q=80'
  }
];

interface EditCoursePageProps {
  course: Course;
  onNavigateCourse: (courseId: string, subTab?: string) => void;
  onNavigateTab: (tab: string) => void;
}

export const EditCoursePage: React.FC<EditCoursePageProps> = ({
  course,
  onNavigateCourse,
  onNavigateTab
}) => {
  const {
    activeUser,
    activeRole,
    db,
    updateCourse,
    showAlert,
    colleges,
    departments,
    getActiveSchoolYearForCollege,
    getSchoolYearsByCollege
  } = useLMS();

  const assignedInstructor = useMemo(() => {
    const rawInst = (course as any).instructor;
    const targetId = course.instructorId || (course as any).instructor_id || (typeof rawInst === 'string' ? rawInst : rawInst?.id);

    // 1. Try finding in db.users by ID
    if (targetId && db.users?.length) {
      const found = db.users.find(u => String(u.id) === String(targetId));
      if (found) return found;
    }

    // 2. Direct instructor object if attached (e.g. from Directus relations)
    if (rawInst && typeof rawInst === 'object') {
      const fullName = [rawInst.first_name, rawInst.last_name].filter(Boolean).join(' ') || rawInst.name || '';
      return {
        id: String(rawInst.id || targetId || ''),
        name: fullName || course.instructorName || 'Assigned Instructor',
        email: rawInst.email || '',
        avatar: resolveDirectusAssetUrl(rawInst.avatar) || rawInst.avatar || '',
        role: (rawInst.role || 'faculty') as UserRole,
        department: rawInst.department || '',
        program: rawInst.program || '',
        title: rawInst.title || ''
      };
    }

    // 3. Try finding in db.users by name or email
    const nameOrEmail = course.instructorName || (course as any).instructor_name;
    if (nameOrEmail && db.users?.length) {
      const found = db.users.find(u =>
        (u.name && u.name.trim().toLowerCase() === nameOrEmail.trim().toLowerCase()) ||
        (u.email && u.email.trim().toLowerCase() === nameOrEmail.trim().toLowerCase())
      );
      if (found) return found;
    }

    // 4. Fallback if name/id provided on course but user not in db.users
    if (nameOrEmail || targetId) {
      return {
        id: String(targetId || ''),
        name: nameOrEmail || 'Assigned Instructor',
        email: '',
        avatar: '',
        role: 'faculty' as UserRole,
        department: '',
        program: '',
        title: ''
      };
    }

    // 5. If faculty role editing, default to activeUser
    if (isFacultyRole(activeUser, activeRole)) {
      return activeUser;
    }

    return null;
  }, [course, db.users, activeUser, activeRole]);

  const instructorDisplayName = assignedInstructor?.name || (isFacultyRole(activeUser, activeRole) ? activeUser.name : 'Unassigned Instructor');
  const instructorAvatar = assignedInstructor?.avatar || '';

  const userCollegeId = useMemo(() => {
    if (activeUser?.collegeId) return activeUser.collegeId;
    if (activeUser?.department && departments) {
      const match = departments.find(
        d =>
          d.id === activeUser.department ||
          d.name?.toLowerCase() === activeUser.department.toLowerCase() ||
          d.code?.toLowerCase() === activeUser.department.toLowerCase() ||
          d.chairpersonId === activeUser.id
      );
      if (match?.collegeId) return match.collegeId;
    }
    if (colleges) {
      const deanMatch = colleges.find(
        c =>
          c.deanId === activeUser?.id ||
          (activeUser?.collegeName && c.name?.toLowerCase() === activeUser.collegeName.toLowerCase())
      );
      if (deanMatch?.id) return deanMatch.id;
    }
    return 'col-ccs';
  }, [activeUser, departments, colleges]);

  const defaultSchoolYear = useMemo(() => {
    if (getActiveSchoolYearForCollege) {
      const activeSy = getActiveSchoolYearForCollege(userCollegeId);
      if (activeSy?.year) return activeSy.year;
    }
    const list = getSchoolYearsByCollege ? getSchoolYearsByCollege(userCollegeId) : [];
    const active = list.find(sy => sy.isActive);
    return active?.year || '2025-2026';
  }, [getActiveSchoolYearForCollege, getSchoolYearsByCollege, userCollegeId]);

  const courseCode = course.code || '';
  const courseTitle = course.title || '';
  const courseSection = course.section || '';
  const courseSchoolYear = course.schoolYear || defaultSchoolYear;
  const [courseColor, setCourseColor] = useState(course.color || '');
  const [courseImage, setCourseImage] = useState<string>(course.image || '');
  const [imageMode, setImageMode] = useState<'presets' | 'upload' | 'url'>('presets');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [stagedImageFile, setStagedImageFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const upload = useSimulatedUpload();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const displaySemester = useMemo(() => {
    const raw = course.semester || course.term;
    const normalized = normalizeAssignedSemester(raw);
    if (normalized === 'First') return 'First Semester';
    if (normalized === 'Second') return 'Second Semester';
    if (normalized === 'Mid-Year') return 'Mid-Year';
    return `${normalized} Semester`;
  }, [course.semester, course.term]);

  const [courseDesc, setCourseDesc] = useState((course as any).description || '');

  const initialJoinCode = useMemo(() => {
    return (
      course.joinCode ||
      (course as any).join_code ||
      db.courses?.find(c => c.id === course.id)?.joinCode ||
      (db.courses?.find(c => c.id === course.id) as any)?.join_code ||
      ''
    );
  }, [course, db.courses]);

  const [courseJoinCode, setCourseJoinCode] = useState<string>(initialJoinCode);

  const lastCourseIdRef = useRef(course.id);
  useEffect(() => {
    if (lastCourseIdRef.current !== course.id) {
      lastCourseIdRef.current = course.id;
      const code =
        course.joinCode ||
        (course as any).join_code ||
        db.courses?.find(c => c.id === course.id)?.joinCode ||
        (db.courses?.find(c => c.id === course.id) as any)?.join_code ||
        '';
      setCourseJoinCode(code);
    }
  }, [course.id, course, db.courses]);

  useEffect(() => {
    // If course already has a stored joinCode / join_code, don't query
    if (course.joinCode || (course as any).join_code) return;

    let isMounted = true;
    if (course.id && likhaLmsApi?.courses?.getCourse) {
      void likhaLmsApi.courses
        .getCourse(course.id)
        .then((serverCourse: any) => {
          if (!isMounted) return;
          const serverCode = serverCourse?.join_code || serverCourse?.joinCode;
          if (serverCode) {
            setCourseJoinCode(serverCode);
          }
        })
        .catch(() => {
          // ignore
        });
    }

    return () => {
      isMounted = false;
    };
  }, [course.id]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegenerateCode = () => {
    setCourseJoinCode(generateCourseJoinCode(db.courses, courseCode));
  };



  const processImageFile = (file: File) => {
    if (!isImageFile(file.name, file.type)) {
      showAlert({
        title: 'Invalid File Type',
        message: 'Please choose an image file (PNG, JPG, WebP, GIF, or SVG).',
        type: 'warning'
      });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      showAlert({
        title: 'File Too Large',
        message: 'Please upload an image smaller than 10MB.',
        type: 'warning'
      });
      return;
    }

    if (courseImage && courseImage.startsWith('blob:')) {
      try { URL.revokeObjectURL(courseImage); } catch {}
    }
    setStagedImageFile(file);
    let previewUrl = '';
    try {
      if (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        previewUrl = URL.createObjectURL(file);
      }
    } catch {
      previewUrl = '';
    }
    setCourseImage(previewUrl);
    setUploadedFileName(file.name);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) {
      processImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (upload.isUploading) return;
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const switchImageMode = (mode: 'presets' | 'upload' | 'url') => {
    if (upload.isUploading) {
      upload.reset();
    }
    if (mode !== 'upload' && courseImage && courseImage.startsWith('blob:')) {
      try { URL.revokeObjectURL(courseImage); } catch {}
      setStagedImageFile(null);
      setUploadedFileName(null);
      setCourseImage(course.image || '');
    }
    setImageMode(mode);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || upload.isUploading) return;
    if (!courseCode.trim() || !courseTitle.trim()) {
      showAlert({
        title: 'Missing Fields',
        message: 'Please provide both a Course Code and Course Title.',
        type: 'warning'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      let resolvedImage = courseImage.trim();
      if (imageMode === 'upload' && stagedImageFile) {
        upload.start(stagedImageFile.name);
        try {
          const result = await uploadFileToPublic(stagedImageFile);
          resolvedImage = result.url;
          upload.complete();
        } catch {
          upload.fail();
          showAlert({
            title: 'Upload Failed',
            message: 'Could not upload that image. Please try a different file.',
            type: 'warning'
          });
          setIsSubmitting(false);
          return;
        }
      }

      await updateCourse(course.id, {
        color: courseColor,
        image: resolvedImage,
        joinCode: courseJoinCode.trim() || course.joinCode
      });

      showAlert({
        title: 'Course Updated',
        message: `Course shell "${courseCode.trim().toUpperCase()} - ${courseSection.trim()}" has been updated successfully.`,
        type: 'success'
      });

      onNavigateCourse(course.id, 'modules');
    } catch {
      // updateCourse already surfaced an alert.
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-full w-full flex-1 flex-col space-y-6">
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border/70">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => onNavigateTab('dashboard')}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
            title="Back to dashboard"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-[22px] font-extrabold tracking-tight text-foreground">
                Edit course shell
              </h1>
              <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-muted text-muted-foreground border border-border rounded-md">
                Course authoring
              </span>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Update subject shell details, section, curriculum metadata, and cover styling.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => onNavigateTab('dashboard')}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="edit-course-form"
            disabled={isSubmitting || upload.isUploading}
            className="px-5 py-2 text-xs font-semibold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl shadow-primary-sm transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-70 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>{isSubmitting ? 'Saving...' : 'Save changes'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Form Left, Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Form */}
        <div className="lg:col-span-2">
          <form id="edit-course-form" onSubmit={handleSubmit} className="space-y-6">
            {/* General Identification */}
            <div className="p-6 bg-card border border-border rounded-2xl space-y-4">
              <div className="flex items-center space-x-2 pb-2 border-b border-border/70">
                <BookOpen className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-[12px] font-semibold text-muted-foreground">
                  Subject identification
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">
                    <span>Course code</span>
                    <span className="text-[10px] text-muted-foreground">Read-only</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={courseCode}
                    className="w-full p-2.5 bg-muted/40 border border-border rounded-xl text-foreground font-mono font-bold text-[13px] outline-none cursor-not-allowed select-all"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">
                    <span>Section</span>
                    <span className="text-[10px] text-muted-foreground">Read-only</span>
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={courseSection}
                    className="w-full p-2.5 bg-muted/40 border border-border rounded-xl text-foreground font-semibold text-[13px] outline-none cursor-not-allowed select-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">
                  <span>Course title</span>
                  <span className="text-[10px] text-muted-foreground">Read-only</span>
                </label>
                <input
                  type="text"
                  readOnly
                  value={courseTitle}
                  className="w-full p-2.5 bg-muted/40 border border-border rounded-xl text-foreground font-semibold text-[13px] outline-none cursor-not-allowed select-all"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                  Academic school year
                </label>
                <div className="w-full p-2.5 bg-muted/40 border border-border rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <CalendarDays className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-foreground truncate">
                        AY {courseSchoolYear || defaultSchoolYear}
                      </span>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20 rounded-md shrink-0">
                    Active Year
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5 flex items-center justify-between">
                  <span>Semester</span>
                  <span className="text-[10px] text-muted-foreground">Read-only</span>
                </label>
                <div className="w-full p-2.5 bg-muted/40 border border-border rounded-xl flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <CalendarDays className="w-4 h-4" />
                    </span>
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-foreground truncate">
                        {displaySemester}
                      </span>
                      {course.term && (
                        <span className="block text-[11px] text-muted-foreground truncate">
                          {course.term}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-semibold bg-muted text-muted-foreground border border-border rounded-md shrink-0">
                    Assigned
                  </span>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  Semester is assigned via Chairperson Assigned Courses and cannot be modified.
                </span>
              </div>

              {/* Course Join Code */}
              <div className="p-3.5 bg-muted/50 border border-border rounded-xl space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-foreground flex items-center space-x-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-primary" />
                    <span>Course Join Code</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleRegenerateCode}
                    className="text-[11px] text-primary hover:text-primary/80 font-bold flex items-center space-x-1 cursor-pointer"
                    title="Generate New Unique Code"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Regenerate</span>
                  </button>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={courseJoinCode}
                    placeholder="Join code"
                    className="w-full p-2 bg-muted/40 border border-border rounded-xl font-mono font-bold text-xs uppercase tracking-wider text-foreground outline-none cursor-default select-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-muted-foreground mb-1.5">
                  Course description & overview
                </label>
                <textarea
                  rows={3}
                  value={courseDesc}
                  onChange={e => setCourseDesc(e.target.value)}
                  placeholder="Provide an overview of the course syllabus, objectives, and prerequisites..."
                  className="w-full p-2.5 bg-background border border-border focus:ring-2 focus:ring-primary/20 focus:border-primary/40 rounded-xl text-foreground text-[13px] placeholder:text-muted-foreground outline-none"
                />
              </div>
            </div>
          </form>
        </div>

        {/* Right 1 Col: Visual Branding & Live Card Preview */}
        <div className="space-y-6">
          {/* Card Branding (Cover Image & Theme Color) */}
          <div className="p-6 bg-card border border-border rounded-2xl space-y-5">
            <div className="flex items-center space-x-2 pb-2 border-b border-border/70">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-[12px] font-semibold text-muted-foreground">
                Visual branding
              </h3>
            </div>

            {/* Course Image Selector */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-[12px] font-semibold text-muted-foreground">
                  Course cover image
                </label>
                {courseImage && (
                  <button
                    type="button"
                    onClick={() => {
                      setCourseImage('');
                      setUploadedFileName(null);
                    }}
                    className="text-[11px] text-muted-foreground hover:text-foreground font-sans flex items-center space-x-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>No Image</span>
                  </button>
                )}
              </div>

              {/* Segmented Image Source Selector */}
              <div className="grid grid-cols-3 gap-1 bg-muted/60 p-1 rounded-xl border border-border text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => switchImageMode('presets')}
                  className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center truncate ${
                    imageMode === 'presets'
                      ? 'bg-card text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Preset Covers
                </button>
                <button
                  type="button"
                  onClick={() => switchImageMode('upload')}
                  className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center truncate flex items-center justify-center space-x-1 ${
                    imageMode === 'upload'
                      ? 'bg-card text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Upload className="w-3 h-3 shrink-0" />
                  <span>Upload File</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchImageMode('url')}
                  className={`py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center truncate flex items-center justify-center space-x-1 ${
                    imageMode === 'url'
                      ? 'bg-card text-foreground font-bold'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <ImageIcon className="w-3 h-3 shrink-0" />
                  <span>Image URL</span>
                </button>
              </div>

              {/* Mode: Preset Gallery */}
              {imageMode === 'presets' && (
                <div className="grid grid-cols-3 gap-2">
                  {PRESET_IMAGES.map(img => {
                    const isSelected = courseImage === img.url;
                    return (
                      <button
                        key={img.url}
                        type="button"
                        onClick={() => {
                          setCourseImage(img.url);
                          setUploadedFileName(null);
                        }}
                        title={img.label}
                        className={`relative h-16 rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${
                          isSelected ? 'border-primary ring-2 ring-primary/20 scale-[1.02]' : 'border-border hover:border-border/80'
                        }`}
                      >
                        <img src={img.url} alt={img.label} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center bg-primary/30">
                            <Check className="w-4 h-4 text-white drop-shadow-md" />
                          </div>
                        )}
                        <span className="absolute bottom-1 left-1 right-1 text-[9px] font-bold text-white truncate drop-shadow-sm px-0.5">
                          {img.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Mode: Upload Custom File */}
              {imageMode === 'upload' && (
                <div className="space-y-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />

                  {upload.isUploading ? (
                    <div className="border-2 border-dashed border-primary/40 bg-primary/5 rounded-xl p-6 flex flex-col items-center justify-center text-center">
                      <Loader2 className="w-8 h-8 text-primary animate-spin mb-2" />
                      <span className="text-xs font-bold text-foreground">
                        Uploading image... {upload.progress}%
                      </span>
                      {upload.fileName && (
                        <div className="w-full max-w-xs mt-3">
                          <UploadProgress fileName={upload.fileName} progress={upload.progress} hint="Uploading image..." />
                        </div>
                      )}
                    </div>
                  ) : courseImage ? (
                    <div className="space-y-2.5">
                      <div
                        onDragOver={e => {
                          e.preventDefault();
                          setIsDragging(true);
                        }}
                        onDragLeave={() => setIsDragging(false)}
                        onDrop={handleDrop}
                        className={`relative w-full h-44 rounded-xl overflow-hidden border transition-all ${
                          isDragging ? 'border-primary ring-2 ring-primary/30 scale-[1.01]' : 'border-border'
                        } bg-muted/20 group`}
                      >
                        <img
                          src={courseImage}
                          alt="Uploaded course cover"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/55 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-4">
                          <span className="text-white text-xs font-semibold drop-shadow">Drag a new image here or</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Change Image</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (courseImage && courseImage.startsWith('blob:')) {
                                  try { URL.revokeObjectURL(courseImage); } catch {}
                                }
                                setCourseImage('');
                                setStagedImageFile(null);
                                setUploadedFileName(null);
                              }}
                              className="px-3 py-1.5 bg-card/90 hover:bg-card text-destructive text-xs font-bold rounded-lg shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="p-2.5 bg-muted/40 border border-border rounded-xl flex items-center justify-between">
                        <div className="flex items-center space-x-2.5 min-w-0">
                          <div className="w-8 h-8 rounded-lg overflow-hidden border border-border shrink-0 bg-muted">
                            <img src={courseImage} alt="Thumbnail" className="w-full h-full object-cover" />
                          </div>
                          <div className="min-w-0">
                            <span className="text-xs font-bold text-foreground block truncate">
                              {uploadedFileName || 'Custom cover image'}
                            </span>
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans flex items-center space-x-1">
                              <Check className="w-3 h-3 inline" />
                              <span>Uploaded & ready</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 shrink-0 ml-2">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                          >
                            Replace
                          </button>
                          <span className="text-muted-foreground/40 text-xs">•</span>
                          <button
                            type="button"
                            onClick={() => {
                              setCourseImage('');
                              setUploadedFileName(null);
                            }}
                            className="text-[11px] font-bold text-muted-foreground hover:text-destructive cursor-pointer"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      onDragOver={e => {
                        e.preventDefault();
                        if (!upload.isUploading) setIsDragging(true);
                      }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => {
                        if (!upload.isUploading) fileInputRef.current?.click();
                      }}
                      className={`border-2 border-dashed rounded-xl p-5 flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                        isDragging
                          ? 'border-primary bg-primary/10 scale-[1.01]'
                          : 'border-border hover:border-primary/50 bg-muted/20 hover:bg-muted/40'
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mb-2">
                        <Upload className="w-5 h-5" />
                      </div>
                      <span className="text-xs font-bold text-foreground">
                        Click to browse or drag & drop
                      </span>
                      <p className="text-[10px] text-muted-foreground font-sans mt-0.5">
                        PNG, JPG, WEBP, or GIF (up to 10MB)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Mode: Custom Image URL */}
              {imageMode === 'url' && (
                <div className="space-y-2">
                  <label className="block text-[11px] font-sans text-muted-foreground">
                    Direct Image URL
                  </label>
                  <div className="relative">
                    <ImageIcon className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-3" />
                    <input
                      type="url"
                      value={courseImage.startsWith('data:') ? '' : courseImage}
                      onChange={e => {
                        setCourseImage(e.target.value);
                        setUploadedFileName(null);
                      }}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full pl-9 pr-3 py-2 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground text-xs font-sans outline-none"
                    />
                  </div>
                  {courseImage && (
                    <div className="relative w-full h-32 rounded-xl overflow-hidden border border-border bg-muted/20">
                      <img
                        src={courseImage}
                        alt="URL Preview"
                        className="w-full h-full object-cover"
                        onError={e => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    </div>
                  )}
                  <p className="text-[10px] text-muted-foreground font-sans">
                    Paste any public image address from Unsplash or web host.
                  </p>
                </div>
              )}
            </div>

            {/* Card Color Theme */}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center justify-between mb-2">
                <label className="block text-[12px] font-semibold text-muted-foreground">
                  Card accent color
                </label>
                {courseColor ? (
                  <button
                    type="button"
                    onClick={() => setCourseColor('')}
                    className="text-[11px] text-muted-foreground hover:text-foreground font-sans flex items-center space-x-1 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                    <span>No Color</span>
                  </button>
                ) : (
                  <span className="text-[10px] font-sans font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded border border-border">
                    No Color (Neutral)
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2 mb-3">
                <button
                  type="button"
                  onClick={() => setCourseColor('')}
                  title="No Color (Default Neutral Slate)"
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-soft cursor-pointer border relative overflow-hidden shrink-0 ${
                    !courseColor
                      ? 'border-primary ring-2 ring-primary/40 bg-card'
                      : 'border-border bg-muted/60 hover:bg-muted'
                  }`}
                >
                  <Ban className={`w-4 h-4 ${!courseColor ? 'text-primary' : 'text-muted-foreground'}`} />
                </button>

                {PRESET_COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setCourseColor(c.hex)}
                    title={c.label}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-soft cursor-pointer shrink-0 ${
                      courseColor.toLowerCase() === c.hex.toLowerCase()
                        ? 'ring-2 ring-offset-1 ring-primary'
                        : ''
                    }`}
                    style={{ backgroundColor: c.hex }}
                  >
                    {courseColor.toLowerCase() === c.hex.toLowerCase() && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center space-x-2">
                <input
                  type="color"
                  value={courseColor || '#2563eb'}
                  onChange={e => setCourseColor(e.target.value)}
                  className="w-8 h-8 p-0 border-0 rounded cursor-pointer shrink-0"
                />
                <input
                  type="text"
                  value={courseColor}
                  placeholder="No color selected (Neutral Theme)"
                  onChange={e => setCourseColor(e.target.value)}
                  className="w-full p-2 bg-background border border-border rounded-xl text-foreground font-sans text-xs uppercase placeholder:normal-case placeholder:text-muted-foreground"
                />
              </div>
            </div>
          </div>

          {/* Assigned Instructor Card */}
          <div className="p-6 bg-card border border-border rounded-2xl space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-border/70">
              <GraduationCap className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-[12px] font-semibold text-muted-foreground">
                Assigned instructor
              </h3>
            </div>

            <div className="p-4 bg-muted/40 border border-border rounded-xl flex items-center gap-3">
              <UserAvatar
                name={instructorDisplayName}
                src={instructorAvatar}
                className="w-10 h-10 rounded-full object-cover border border-border shadow-soft shrink-0"
              />
              <span className="font-bold text-sm text-foreground truncate">{instructorDisplayName}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
