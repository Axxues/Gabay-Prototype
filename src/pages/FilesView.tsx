import React, { useState, useRef } from 'react';
import { useLMS } from '../context/LMSContext';
import type { CourseFile } from '../types/lms';
import {
  Folder,
  File,
  FileText,
  FileCode,
  FileArchive,
  Image as ImageIcon,
  Upload,
  Search,
  Download,
  Eye,
  Trash2,
  Edit2,
  ChevronRight,
  Archive,
  X,
  Check,
  FolderPlus
} from 'lucide-react';

interface FilesViewProps {
  courseId?: string; // If undefined or 'personal', loads account-level storage
}

export const FilesView: React.FC<FilesViewProps> = ({ courseId }) => {
  const {
    activeUser,
    activeRole,
    db,
    createCourseFolder,
    uploadCourseFile,
    deleteCourseFile,
    deleteCourseFolder,
    updateFileVisibility,
    renameCourseFile,
    showAlert,
    showConfirm
  } = useLMS();

  const isPersonal = !courseId || courseId === 'personal';
  const effectiveScopeId = isPersonal ? `user-${activeUser.id}` : courseId;
  const course = !isPersonal ? db.courses.find(c => c.id === courseId) : null;

  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [previewFile, setPreviewFile] = useState<CourseFile | null>(null);
  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  // File Upload Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const canManage = isPersonal || activeRole === 'faculty' || activeRole === 'admin';

  // Files and folders in this scope
  const allFolders = (db.courseFolders || []).filter(f => f.courseId === effectiveScopeId);
  const allFiles = (db.courseFiles || []).filter(f => f.courseId === effectiveScopeId);

  // Filter based on student permissions: students only see 'published' or 'restricted'
  const visibleFiles = allFiles.filter(file => {
    if (canManage) return true;
    return file.visibility === 'published' || file.visibility === 'restricted';
  });

  // Current folder's children
  const currentFolders = allFolders.filter(f => {
    if (searchQuery) return f.name.toLowerCase().includes(searchQuery.toLowerCase());
    return currentFolderId ? f.parentId === currentFolderId : !f.parentId;
  });

  const currentFiles = visibleFiles.filter(file => {
    if (searchQuery) return file.name.toLowerCase().includes(searchQuery.toLowerCase());
    return currentFolderId ? file.folderId === currentFolderId : !file.folderId;
  });

  // Breadcrumbs calculation
  const getBreadcrumbs = () => {
    const crumbs: { id: string | null; name: string }[] = [
      { id: null, name: isPersonal ? 'Personal Files' : `${course?.code || 'Course'} Files` }
    ];

    let curr = allFolders.find(f => f.id === currentFolderId);
    const trail: { id: string; name: string }[] = [];
    while (curr) {
      trail.unshift({ id: curr.id, name: curr.name });
      curr = allFolders.find(f => f.id === curr?.parentId);
    }
    return [...crumbs, ...trail];
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    createCourseFolder(effectiveScopeId, newFolderName.trim(), currentFolderId);
    setNewFolderName('');
    setIsCreateFolderOpen(false);
    showAlert({
      title: 'Folder Created',
      message: `Folder "${newFolderName.trim()}" has been added.`,
      type: 'success'
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let type: CourseFile['type'] = 'document';
    if (file.type.includes('pdf')) type = 'pdf';
    else if (file.type.includes('image')) type = 'image';
    else if (file.name.endsWith('.zip') || file.name.endsWith('.tar') || file.name.endsWith('.rar'))
      type = 'archive';
    else if (
      file.name.endsWith('.ts') ||
      file.name.endsWith('.tsx') ||
      file.name.endsWith('.js') ||
      file.name.endsWith('.py') ||
      file.name.endsWith('.json')
    )
      type = 'code';

    const reader = new FileReader();
    reader.onload = event => {
      const content = typeof event.target?.result === 'string' ? event.target.result : '';
      uploadCourseFile({
        courseId: effectiveScopeId,
        folderId: currentFolderId,
        name: file.name,
        size: file.size,
        type,
        visibility: 'published',
        content
      });

      showAlert({
        title: 'File Uploaded',
        message: `File "${file.name}" has been uploaded to the current folder.`,
        type: 'success'
      });
    };

    if (type === 'code' || type === 'document') {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    uploadCourseFile({
      courseId: effectiveScopeId,
      folderId: currentFolderId,
      name: file.name,
      size: file.size,
      type: file.name.endsWith('.pdf') ? 'pdf' : file.type.includes('image') ? 'image' : 'document',
      visibility: 'published'
    });

    showAlert({
      title: 'File Uploaded',
      message: `File "${file.name}" dropped and saved.`,
      type: 'success'
    });
  };

  const handleStartRename = (file: CourseFile) => {
    setRenamingFileId(file.id);
    setRenameValue(file.name);
  };

  const handleSaveRename = (fileId: string) => {
    if (renameValue.trim()) {
      renameCourseFile(fileId, renameValue.trim());
    }
    setRenamingFileId(null);
  };

  const handleDownloadFile = (file: CourseFile) => {
    // Generate simulated blob download or open content
    const blob = new Blob([file.content || `Simulation Content for ${file.name}`], {
      type: 'application/octet-stream'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAllZip = () => {
    showAlert({
      title: 'Archive Export Started',
      message: `Preparing "${getBreadcrumbs().pop()?.name}.zip" archive download with ${currentFiles.length} files.`,
      type: 'info'
    });
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-rose-500" />;
      case 'code':
        return <FileCode className="w-5 h-5 text-blue-500" />;
      case 'archive':
        return <FileArchive className="w-5 h-5 text-amber-500" />;
      case 'image':
        return <ImageIcon className="w-5 h-5 text-emerald-500" />;
      default:
        return <File className="w-5 h-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-border">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="heading-2 text-foreground flex items-center space-x-2.5">
              <Folder className="w-5 h-5 text-primary" />
              <span>{isPersonal ? 'Personal & Submission Files' : 'Course Files Repository'}</span>
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-sans font-bold rounded-md bg-muted text-foreground border border-border">
              {visibleFiles.length} Items
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isPersonal
              ? 'Personal cloud storage, uploaded drafts, and submitted coursework archives.'
              : `Curricular materials, lecture handouts, and laboratory assets for ${course?.code || 'Course'}.`}
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={handleDownloadAllZip}
            className="px-3.5 py-2 text-xs font-bold bg-card hover:bg-accent text-foreground border border-border rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
            title="Download folder as ZIP"
          >
            <Archive className="w-4 h-4 text-muted-foreground" />
            <span className="hidden sm:inline">Download Folder (.zip)</span>
          </button>

          {canManage && (
            <>
              <button
                type="button"
                onClick={() => setIsCreateFolderOpen(true)}
                className="px-3.5 py-2 text-xs font-bold bg-card hover:bg-accent text-foreground border border-border rounded-xl transition-all shadow-subtle flex items-center space-x-1.5 cursor-pointer"
              >
                <FolderPlus className="w-4 h-4 text-primary" />
                <span>+ Folder</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center space-x-1.5 cursor-pointer active:scale-[0.98]"
              >
                <Upload className="w-4 h-4" />
                <span>Upload File</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
            </>
          )}
        </div>
      </div>

      {/* Breadcrumb Navigation & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Breadcrumbs */}
        <div className="flex items-center space-x-1.5 text-xs font-sans text-muted-foreground overflow-x-auto py-1">
          {getBreadcrumbs().map((crumb, idx, arr) => (
            <React.Fragment key={crumb.id || 'root'}>
              <button
                type="button"
                onClick={() => setCurrentFolderId(crumb.id)}
                className={`px-2 py-1 rounded-lg transition-colors hover:bg-muted ${
                  idx === arr.length - 1
                    ? 'font-bold text-foreground bg-muted/60'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {crumb.name}
              </button>
              {idx < arr.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />}
            </React.Fragment>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search files by name..."
            className="w-full pl-9 pr-4 py-1.5 bg-card border border-border focus:ring-2 focus:ring-primary/20 rounded-xl text-xs font-sans text-foreground outline-none shadow-subtle"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Drag & Drop Upload Overlay / Zone */}
      {canManage && (
        <div
          onDragOver={e => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-4 flex items-center justify-center space-x-3 transition-all cursor-pointer ${
            isDragging
              ? 'border-primary bg-primary/10 scale-[1.01]'
              : 'border-border hover:border-primary/40 bg-muted/20 hover:bg-muted/30'
          }`}
        >
          <Upload className="w-4 h-4 text-primary" />
          <span className="text-xs text-foreground font-medium">
            Drag and drop files here to upload directly to this folder, or click to browse.
          </span>
        </div>
      )}

      {/* Create Folder Modal */}
      {isCreateFolderOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-elevated p-6 space-y-4 animate-scale-in">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="text-sm font-bold text-foreground flex items-center space-x-2">
                <FolderPlus className="w-4 h-4 text-primary" />
                <span>Create New Folder</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateFolderOpen(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateFolder} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-foreground mb-1">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="e.g. 04 Midterm Review Materials"
                  className="w-full px-3 py-2 bg-background border border-border rounded-xl text-xs font-sans text-foreground outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setIsCreateFolderOpen(false)}
                  className="px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl transition-all shadow-primary-sm"
                >
                  Create Folder
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Previewer Modal */}
      {previewFile && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-3xl shadow-elevated overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center space-x-3">
                {getFileIcon(previewFile.type)}
                <div>
                  <h3 className="text-sm font-bold text-foreground truncate max-w-md">
                    {previewFile.name}
                  </h3>
                  <p className="text-[10px] font-sans text-muted-foreground">
                    {previewFile.formattedSize} • Uploaded by {previewFile.uploadedByName}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleDownloadFile(previewFile)}
                  className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-all shadow-primary-sm flex items-center space-x-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewFile(null)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* In-Browser Document Preview Body */}
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-background">
              {previewFile.type === 'pdf' ? (
                <div className="p-8 bg-card border border-border rounded-xl space-y-4 shadow-subtle">
                  <div className="border-b border-border pb-3 flex items-center justify-between">
                    <span className="font-sans text-xs font-bold text-primary uppercase tracking-wider">
                      PDF Document Previewer
                    </span>
                    <span className="text-[10px] font-sans text-muted-foreground">Page 1 of 4</span>
                  </div>
                  <div className="font-sans text-xs text-foreground whitespace-pre-line leading-relaxed p-4 bg-muted/30 rounded-lg">
                    {previewFile.content ||
                      `[GABAY Built-in PDF Reader]\nFile: ${previewFile.name}\n\nDocument contents rendered seamlessly in-browser. Clean vector fidelity with full offline caching.`}
                  </div>
                </div>
              ) : previewFile.type === 'image' && previewFile.url ? (
                <div className="flex items-center justify-center p-4">
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    className="max-h-[60vh] rounded-xl object-contain shadow-card border border-border"
                  />
                </div>
              ) : (
                <div className="p-4 bg-muted/30 border border-border rounded-xl font-sans text-xs text-foreground whitespace-pre-wrap leading-relaxed">
                  {previewFile.content || `Plaintext content of ${previewFile.name}`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Directory Content Table / Grid */}
      <div className="bg-card border border-border rounded-2xl shadow-subtle overflow-hidden">
        <div className="divide-y divide-border">
          {/* Folders List */}
          {currentFolders.map(folder => (
            <div
              key={folder.id}
              onClick={() => setCurrentFolderId(folder.id)}
              className="p-4 flex items-center justify-between hover:bg-muted/30 transition-colors cursor-pointer group"
            >
              <div className="flex items-center space-x-3.5 truncate">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Folder className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors block truncate">
                    {folder.name}
                  </span>
                  <span className="text-[10px] font-sans text-muted-foreground">
                    Folder • Updated {new Date(folder.updatedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              <div className="flex items-center space-x-2" onClick={e => e.stopPropagation()}>
                {canManage && (
                  <button
                    type="button"
                    onClick={() =>
                      showConfirm(
                        `Delete folder "${folder.name}" and its files?`,
                        () => deleteCourseFolder(folder.id),
                        'Delete Folder'
                      )
                    }
                    className="p-1.5 text-muted-foreground hover:text-rose-600 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
          ))}

          {/* Files List */}
          {currentFiles.map(file => {
            const isRenaming = renamingFileId === file.id;

            return (
              <div
                key={file.id}
                className="p-4 flex items-center justify-between hover:bg-muted/20 transition-colors gap-4"
              >
                <div
                  className="flex items-center space-x-3.5 truncate flex-1 cursor-pointer"
                  onClick={() => setPreviewFile(file)}
                >
                  <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border">
                    {getFileIcon(file.type)}
                  </div>
                  <div className="truncate flex-1">
                    {isRenaming ? (
                      <div className="flex items-center space-x-1.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={renameValue}
                          onChange={e => setRenameValue(e.target.value)}
                          className="px-2 py-1 bg-background border border-border rounded-lg text-xs font-sans text-foreground outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveRename(file.id)}
                          className="p-1 text-emerald-600 hover:bg-emerald-500/10 rounded"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setRenamingFileId(null)}
                          className="p-1 text-muted-foreground hover:bg-muted rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="text-xs font-bold text-foreground hover:text-primary transition-colors block truncate">
                          {file.name}
                        </span>
                        <div className="flex items-center space-x-2 text-[10px] font-sans text-muted-foreground">
                          <span>{file.formattedSize}</span>
                          <span>•</span>
                          <span>Uploaded by {file.uploadedByName}</span>
                          <span>•</span>
                          <span>{new Date(file.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Visibility & Actions */}
                <div className="flex items-center space-x-2 shrink-0">
                  {/* Visibility Badge / Switcher */}
                  {canManage ? (
                    <select
                      value={file.visibility}
                      onChange={e =>
                        updateFileVisibility(
                          file.id,
                          e.target.value as 'published' | 'unpublished' | 'restricted'
                        )
                      }
                      className={`text-[11px] font-sans font-bold px-2 py-1 rounded-lg border outline-none cursor-pointer ${
                        file.visibility === 'published'
                          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                          : file.visibility === 'restricted'
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}
                    >
                      <option value="published">Published</option>
                      <option value="unpublished">Unpublished</option>
                      <option value="restricted">Restricted Access</option>
                    </select>
                  ) : (
                    <span
                      className={`text-[10px] font-sans font-bold px-2 py-0.5 rounded-md border ${
                        file.visibility === 'published'
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                      }`}
                    >
                      {file.visibility.toUpperCase()}
                    </span>
                  )}

                  {/* Preview Button */}
                  <button
                    type="button"
                    onClick={() => setPreviewFile(file)}
                    title="Preview File"
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  {/* Download Button */}
                  <button
                    type="button"
                    onClick={() => handleDownloadFile(file)}
                    title="Download File"
                    className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>

                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleStartRename(file)}
                        title="Rename"
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted cursor-pointer"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          showConfirm(
                            `Delete "${file.name}"?`,
                            () => deleteCourseFile(file.id),
                            'Delete File'
                          )
                        }
                        title="Delete"
                        className="p-1.5 text-muted-foreground hover:text-rose-600 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          {currentFolders.length === 0 && currentFiles.length === 0 && (
            <div className="p-10 text-center text-xs text-muted-foreground font-sans space-y-2">
              <Folder className="w-8 h-8 text-muted-foreground/50 mx-auto" />
              <p>This folder is currently empty.</p>
              {canManage && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-primary hover:underline font-bold"
                >
                  Upload a file now
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
