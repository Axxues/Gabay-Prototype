import React, { useState, useRef, useEffect } from 'react';
import { useLMS } from '../context/LMSContext';
import type { ModuleItem } from '../types/lms';
import {
  ArrowLeft,
  FileText,
  File,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Upload,
  Paperclip,
  Check,
  Plus,
  X,
  Layers,
  ChevronDown,
  FileCheck2,
  HelpCircle,
  Globe,
  BookOpen,
  FolderOpen
} from 'lucide-react';

import { uploadFileToPublic } from '../utils/fileUploader';
import { FilePickerModal } from '../components/common/FilePickerModal';
import type { AggregatedCourseFile } from '../hooks/useCourseFiles';

interface AddModuleItemPageProps {
  courseId: string;
  moduleId: string;
  editingItem?: ModuleItem;
  onBack: () => void;
}

const RESOURCE_TYPES: Array<{
  type: ModuleItem['type'];
  label: string;
  badge: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  badgeColor: string;
}> = [
    {
      type: 'page',
      label: 'Lecture Note / Reading Page',
      badge: 'Page',
      description: 'Syllabus reading, lecture note, or markdown document',
      icon: FileText,
      iconBg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
      badgeColor: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30'
    },
    {
      type: 'file',
      label: 'Course Document / Handout File',
      badge: 'Handout',
      description: 'PDF document, slide deck, syllabus, or course asset file',
      icon: File,
      iconBg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
      badgeColor: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/30'
    },
    {
      type: 'assignment',
      label: 'Activity Milestone',
      badge: 'Activity',
      description: 'Graded student submission with deadline, instructions & rubric',
      icon: FileCheck2,
      iconBg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      badgeColor: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
    },
    {
      type: 'quiz',
      label: 'Assessment Quiz',
      badge: 'Assessment',
      description: 'Timed assessment, exam, or knowledge evaluation milestone',
      icon: HelpCircle,
      iconBg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      badgeColor: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30'
    },
    {
      type: 'external_url',
      label: 'External Reference Link',
      badge: 'Web Link',
      description: 'Online repository, scientific publication, or digital tool',
      icon: Globe,
      iconBg: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
      badgeColor: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
    }
  ];

export const AddModuleItemPage: React.FC<AddModuleItemPageProps> = ({
  courseId,
  moduleId,
  editingItem,
  onBack
}) => {
  const { db, addModuleItem, updateModuleItem, showAlert } = useLMS();
  const isEditing = Boolean(editingItem);

  const course = db.courses.find(c => c.id === courseId);
  const courseModules = db.modules.filter(m => m.courseId === courseId);
  const sortedModules = [...courseModules].sort((a, b) => {
    if (b.order !== a.order) return b.order - a.order;
    return b.id.localeCompare(a.id);
  });
  // Form State
  const [targetModuleId, setTargetModuleId] = useState(moduleId || sortedModules[0]?.id || '');
  const [itemType, setItemType] = useState<ModuleItem['type']>(editingItem?.type || 'page');
  const [title, setTitle] = useState(editingItem?.title || '');
  const [content, setContent] = useState(editingItem?.content || '');

  // Custom Dropdown Open States
  const [isModuleDropdownOpen, setIsModuleDropdownOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);

  const moduleDropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (moduleDropdownRef.current && !moduleDropdownRef.current.contains(target)) {
        setIsModuleDropdownOpen(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(target)) {
        setIsTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Attachment State
  const [attachedFileName, setAttachedFileName] = useState(editingItem?.fileName || '');
  const [attachedFileSize, setAttachedFileSize] = useState(editingItem?.fileSize || '');
  const [attachedFileType, setAttachedFileType] = useState(editingItem?.fileType || '');
  const [attachedFileUrl, setAttachedFileUrl] = useState(editingItem?.fileUrl || '');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isFilePickerOpen, setIsFilePickerOpen] = useState(false);

  const selectedModule = courseModules.find(m => m.id === targetModuleId);
  const currentResourceType = RESOURCE_TYPES.find(r => r.type === itemType) || RESOURCE_TYPES[0];

  const handleProcessFile = async (file: globalThis.File) => {
    if (file.size > 50 * 1024 * 1024) {
      showAlert({
        title: 'File Too Large',
        message: 'Please attach a document or media file smaller than 50MB.',
        type: 'warning'
      });
      return;
    }

    try {
      const result = await uploadFileToPublic(file);
      setAttachedFileUrl(result.url);
      setAttachedFileName(result.name);
      setAttachedFileSize(result.size);
      setAttachedFileType(result.type || 'file');

      // Auto-populate title if empty
      if (!title.trim()) {
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setTitle(nameWithoutExt);
      }
    } catch (err) {
      console.error('Failed to upload module item file:', err);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleRemoveAttachment = () => {
    setAttachedFileName('');
    setAttachedFileSize('');
    setAttachedFileType('');
    setAttachedFileUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSelectExistingFile = (file: AggregatedCourseFile) => {
    const url = file.url || file.fileUrl || `/public/uploads/${file.name}`;
    setAttachedFileUrl(url);
    setAttachedFileName(file.name);
    setAttachedFileSize(file.formattedSize || '');
    setAttachedFileType(file.type || 'file');

    if (!title.trim()) {
      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
      setTitle(nameWithoutExt);
    }

    setIsFilePickerOpen(false);
    showAlert({
      title: 'File Attached',
      message: `"${file.name}" has been attached from your uploaded course files.`,
      type: 'success'
    });
  };

  const handleSave = async (addAnother: boolean = false) => {
    if (!title.trim()) {
      showAlert({
        title: 'Missing Resource Title',
        message: 'Please provide a title for this module item.',
        type: 'warning'
      });
      return;
    }

    const savedTitle = title.trim();

    if (isEditing && editingItem) {
      try {
        await updateModuleItem(
          moduleId,
          editingItem.id,
          {
            title: savedTitle,
            type: itemType,
            content: content.trim() || 'Unit resource instructions aligned with syllabus requirements.',
            fileName: attachedFileName || undefined,
            fileSize: attachedFileSize || undefined,
            fileType: attachedFileType || undefined,
            fileUrl: attachedFileUrl || undefined
          },
          targetModuleId
        );

        showAlert({
          title: 'Module Item Updated',
          message: `"${savedTitle}" has been updated successfully.`,
          type: 'success'
        });
        onBack();
      } catch {
        // Context already surfaced the failure alert.
      }
      return;
    }

    try {
      await addModuleItem(targetModuleId, {
        title: savedTitle,
        type: itemType,
        content: content.trim() || 'Unit resource instructions aligned with syllabus requirements.',
        published: true,
        required: false,
        completionCondition: 'view',
        fileName: attachedFileName || undefined,
        fileSize: attachedFileSize || undefined,
        fileType: attachedFileType || undefined,
        fileUrl: attachedFileUrl || undefined
      });
    } catch {
      // Context already surfaced the failure alert.
      return;
    }

    if (addAnother) {
      showAlert({
        title: 'Item Added to Module',
        message: `"${savedTitle}" has been added. You can add another item now.`,
        type: 'success'
      });
      setTitle('');
      setContent('');
      handleRemoveAttachment();
    } else {
      showAlert({
        title: 'Item Added to Module',
        message: `"${savedTitle}" has been added to ${selectedModule?.title || 'the module'}.`,
        type: 'success'
      });
      onBack();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSave(false);
  };

  const getFileIcon = (type: string, name: string) => {
    const lowerName = name.toLowerCase();
    if (type.includes('image') || /\.(jpg|jpeg|png|gif|svg|webp)$/.test(lowerName)) {
      return <ImageIcon className="w-5 h-5 text-emerald-500" />;
    }
    if (type.includes('pdf') || lowerName.endsWith('.pdf')) {
      return <FileText className="w-5 h-5 text-rose-500" />;
    }
    if (type.includes('code') || /\.(py|js|ts|jsx|tsx|html|css|json|java|c|cpp)$/.test(lowerName)) {
      return <FileCode className="w-5 h-5 text-amber-500" />;
    }
    if (type.includes('zip') || /\.(zip|rar|7z|tar|gz)$/.test(lowerName)) {
      return <FileArchive className="w-5 h-5 text-purple-500" />;
    }
    return <File className="w-5 h-5 text-primary" />;
  };

  return (
    <div className="space-y-8 animate-fade-in max-w-4xl mx-auto pt-6 sm:pt-8 pb-16 px-1">
      {/* Top Breadcrumb & Header */}
      <div className="pb-7 sm:pb-8 border-b border-border/80">
        <div className="space-y-3 sm:space-y-3.5">
          {/* Breadcrumb row */}
          <div className="flex items-center space-x-2 text-xs text-muted-foreground font-sans">
            <button
              type="button"
              onClick={onBack}
              className="hover:text-primary transition-colors cursor-pointer flex items-center space-x-1.5 font-medium group"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>Modules</span>
            </button>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-foreground font-semibold truncate max-w-[240px]">
              {selectedModule?.title || 'Unit Module'}
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-primary font-bold px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[11px]">
              {isEditing ? 'Edit Item' : 'Add Item'}
            </span>
          </div>

          {/* Heading and subtitle */}
          <div className="pt-1.5 space-y-1.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-foreground flex items-center space-x-3 font-sans">
              <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 shadow-xs">
                <Layers className="w-5 h-5" />
              </div>
              <span>{isEditing ? 'Edit Module Item' : 'Add Item to Module'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium pl-0.5">
              {course ? `${course.code} • ` : ''}
              {isEditing
                ? 'Update learning material, instructions, or attached files for this unit item.'
                : 'Publish reading materials, assignments, quizzes, and attach downloadable files.'}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Item Basic Info */}
        <div className="p-6 bg-card border border-border rounded-2xl shadow-subtle space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-border">
              <FileText className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider font-sans">
                Resource Information
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Target Module Custom Dropdown */}
              <div className="relative" ref={moduleDropdownRef}>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Target Module *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsModuleDropdownOpen(!isModuleDropdownOpen);
                    setIsTypeDropdownOpen(false);
                  }}
                  className={`w-full p-2.5 bg-background border rounded-xl text-xs font-bold text-foreground flex items-center justify-between shadow-subtle transition-all cursor-pointer group ${isModuleDropdownOpen
                    ? 'border-primary ring-2 ring-primary/20 shadow-primary-sm'
                    : 'border-border hover:border-primary/40'
                    }`}
                >
                  <div className="flex items-center space-x-2.5 truncate min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <BookOpen className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate text-left">
                      <span className="font-sans font-bold text-foreground block truncate">
                        {selectedModule?.title || 'Select a target module'}
                      </span>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors shrink-0 ml-1.5 ${isModuleDropdownOpen ? 'bg-primary/10 text-primary' : 'bg-muted/60 text-muted-foreground group-hover:text-foreground'
                    }`}>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${isModuleDropdownOpen ? 'rotate-180 text-primary' : 'rotate-0'
                        }`}
                    />
                  </div>
                </button>

                {isModuleDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 dropdown-panel p-2 z-50 animate-dropdown">
                    <div className="px-2.5 py-1.5 border-b border-border/60 mb-1.5">
                      <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground">
                        Select Module Unit
                      </span>
                    </div>
                    <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                      {sortedModules.map(mod => {
                        const isSelected = mod.id === targetModuleId;
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            onClick={() => {
                              setTargetModuleId(mod.id);
                              setIsModuleDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-left cursor-pointer group ${isSelected
                              ? 'bg-primary/15 text-primary font-bold border border-primary/30 shadow-xs'
                              : 'text-foreground hover:bg-muted/80 hover:translate-x-0.5 font-medium'
                              }`}
                          >
                            <div className="flex items-center space-x-2.5 truncate min-w-0">
                              <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                                }`}>
                                {mod.order}
                              </div>
                              <div className="truncate">
                                <span className="font-sans font-bold block truncate">{mod.title}</span>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 ml-1.5">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Resource Type Custom Dropdown */}
              <div className="relative" ref={typeDropdownRef}>
                <label className="block text-xs font-bold text-foreground mb-1.5">
                  Resource Type *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsTypeDropdownOpen(!isTypeDropdownOpen);
                    setIsModuleDropdownOpen(false);
                  }}
                  className={`w-full p-2.5 bg-background border rounded-xl text-xs font-bold text-foreground flex items-center justify-between shadow-subtle transition-all cursor-pointer group ${isTypeDropdownOpen
                    ? 'border-primary ring-2 ring-primary/20 shadow-primary-sm'
                    : 'border-border hover:border-primary/40'
                    }`}
                >
                  <div className="flex items-center space-x-2.5 truncate min-w-0">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${currentResourceType.iconBg}`}>
                      <currentResourceType.icon className="w-3.5 h-3.5" />
                    </div>
                    <div className="truncate text-left">
                      <div className="flex items-center space-x-2">
                        <span className="font-sans font-bold text-foreground truncate">
                          {currentResourceType.label}
                        </span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-sans font-bold rounded-md border shrink-0 ${currentResourceType.badgeColor}`}>
                          {currentResourceType.badge}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className={`w-5 h-5 rounded-lg flex items-center justify-center transition-colors shrink-0 ml-1.5 ${isTypeDropdownOpen ? 'bg-primary/10 text-primary' : 'bg-muted/60 text-muted-foreground group-hover:text-foreground'
                    }`}>
                    <ChevronDown
                      className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${isTypeDropdownOpen ? 'rotate-180 text-primary' : 'rotate-0'
                        }`}
                    />
                  </div>
                </button>

                {isTypeDropdownOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 dropdown-panel p-2 z-50 animate-dropdown">
                    <div className="px-2.5 py-1.5 border-b border-border/60 mb-1.5">
                      <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground">
                        Select Resource Type
                      </span>
                    </div>
                    <div className="space-y-1">
                      {RESOURCE_TYPES.map(res => {
                        const isSelected = res.type === itemType;
                        const Icon = res.icon;
                        return (
                          <button
                            key={res.type}
                            type="button"
                            onClick={() => {
                              setItemType(res.type);
                              setIsTypeDropdownOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all text-left cursor-pointer group ${isSelected
                              ? 'bg-primary/15 text-primary font-bold border border-primary/30 shadow-xs'
                              : 'text-foreground hover:bg-muted/80 hover:translate-x-0.5 font-medium'
                              }`}
                          >
                            <div className="flex items-center space-x-2.5 truncate min-w-0">
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${res.iconBg}`}>
                                <Icon className="w-3.5 h-3.5" />
                              </div>
                              <div className="truncate">
                                <div className="flex items-center space-x-1.5">
                                  <span className="font-sans font-bold block truncate">{res.label}</span>
                                  <span className={`px-1.5 py-0.2 text-[9px] font-sans font-bold rounded-md border shrink-0 ${res.badgeColor}`}>
                                    {res.badge}
                                  </span>
                                </div>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 ml-1.5">
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Resource Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Chapter 4: Neural Architectures & Heuristic Search"
                className="w-full p-2.5 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground text-xs outline-none font-sans"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-foreground mb-1.5">
                Content / Syllabus Instructions / URL
              </label>
              <textarea
                rows={5}
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Provide instructions, summary notes, reading objectives, or external URL links..."
                className="w-full p-2.5 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground text-xs font-sans placeholder:text-muted-foreground outline-none resize-y"
              />
            </div>
          </div>

          {/* Section 2: File Attachment (Faculty Can Attach a File) */}
          <div className="p-6 bg-card border border-border rounded-2xl shadow-subtle space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center space-x-2">
                <Paperclip className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-bold text-foreground uppercase tracking-wider font-sans">
                  File Attachment
                </h3>
              </div>
              {attachedFileName && (
                <button
                  type="button"
                  onClick={handleRemoveAttachment}
                  className="text-[11px] text-rose-600 hover:text-rose-700 dark:text-rose-400 font-sans flex items-center space-x-1 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Remove File</span>
                </button>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              Attach syllabus documents, lecture slides, code archives, or lab manuals. Students can download or preview attached files directly from this module item.
            </p>

            {/* Attached File Preview Card */}
            {attachedFileName ? (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-between gap-4">
                <div className="flex items-center space-x-3 truncate">
                  <div className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center shrink-0 shadow-subtle">
                    {getFileIcon(attachedFileType, attachedFileName)}
                  </div>
                  <div className="truncate">
                    <span className="font-bold text-xs text-foreground block truncate">
                      {attachedFileName}
                    </span>
                    <div className="flex items-center space-x-2 text-[10px] font-sans text-muted-foreground mt-0.5">
                      <span>{attachedFileSize || 'Document'}</span>
                      <span>•</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center space-x-1">
                        <Check className="w-3 h-3 inline" />
                        <span>Ready to attach</span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                  >
                    Change File
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFilePickerOpen(true)}
                    className="px-3 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer"
                  >
                    Browse Uploaded
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveAttachment}
                    className="p-1.5 text-muted-foreground hover:text-rose-600 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                    title="Remove attachment"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Drag and Drop Zone */}
                <div
                  onDragOver={e => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-6 border-2 border-dashed rounded-2xl text-center cursor-pointer transition-all ${isDragging
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-border hover:border-primary/50 hover:bg-muted/30'
                    }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileInputChange}
                    className="hidden"
                  />
                  <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-2.5">
                    <Upload className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-xs text-foreground">
                    Upload a file from your device
                  </h4>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Drag and drop file here, or click to browse (PDF, PPTX, DOCX, ZIP, Code, Media up to 50MB)
                  </p>
                </div>

                {/* Browse uploaded files */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setIsFilePickerOpen(true)}
                    className="px-3.5 py-1.5 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 border border-primary/30 bg-primary/5"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    <span>Browse Uploaded Files</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        {/* Bottom Actions */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2.5 pt-4 border-t border-border">
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-accent rounded-xl transition-colors cursor-pointer text-center"
          >
            Cancel
          </button>
          {!isEditing && (
            <button
              type="button"
              onClick={() => {
                void handleSave(true);
              }}
              className="px-5 py-2.5 text-xs font-bold bg-muted hover:bg-muted/80 text-foreground border border-border rounded-xl transition-all shadow-xs cursor-pointer active:scale-[0.98] flex items-center justify-center space-x-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-primary" />
              <span>Save & Add Another</span>
            </button>
          )}
          <button
            type="submit"
            className="px-6 py-2.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm cursor-pointer active:scale-[0.98] flex items-center justify-center space-x-2"
          >
            <Check className="w-4 h-4" />
            <span>{isEditing ? 'Save Changes' : 'Save & Add to Module'}</span>
          </button>
        </div>
      </form>

      {isFilePickerOpen && (
        <FilePickerModal
          courseId={courseId}
          onClose={() => setIsFilePickerOpen(false)}
          onSelect={handleSelectExistingFile}
        />
      )}
    </div>
  );
};
