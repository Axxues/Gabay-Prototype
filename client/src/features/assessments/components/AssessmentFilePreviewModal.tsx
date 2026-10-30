import React, { useEffect } from 'react';
import { X, Download, ExternalLink, FileText, Image as ImageIcon, FileCheck2, FileSpreadsheet } from 'lucide-react';
import { ModalPortal } from '../../../shared/components/common/ModalPortal';
import { PdfViewer } from '../../../shared/components/common/PdfViewer';
import { resolveLikhaAssetUrl } from '../../../shared/api/likhaLmsApi';
import { sanitizeUrl } from '../../../shared/utils/security';

export interface AssessmentPreviewAttachment {
  name: string;
  size?: string;
  url?: string;
  type?: string;
}

export interface AssessmentFilePreviewModalProps {
  file: AssessmentPreviewAttachment | null;
  onClose: () => void;
}

export const AssessmentFilePreviewModal: React.FC<AssessmentFilePreviewModalProps> = ({ file, onClose }) => {
  useEffect(() => {
    if (!file) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file, onClose]);

  if (!file) return null;

  const fileName = file.name || 'Attached File';
  const resolvedUrl = file.url ? resolveLikhaAssetUrl(file.url) : '';
  const safeUrl = sanitizeUrl(resolvedUrl, '');
  const isImage = /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(fileName) || Boolean(file.type?.startsWith('image/'));
  const isPdf = /\.pdf$/i.test(fileName) || Boolean(file.type?.includes('pdf')) || (file.url ? file.url.toLowerCase().includes('.pdf') : false);
  const isHtml = /\.(html|htm)$/i.test(fileName) || Boolean(file.type?.includes('html'));
  const isSpreadsheet = /\.(xlsx|xls|csv)$/i.test(fileName);
  const isWord = /\.(docx|doc)$/i.test(fileName);

  const getIcon = () => {
    if (isImage) return <ImageIcon className="w-5 h-5 text-pink-500" />;
    if (isPdf) return <FileText className="w-5 h-5 text-rose-500" />;
    if (isSpreadsheet) return <FileSpreadsheet className="w-5 h-5 text-emerald-500" />;
    if (isWord) return <FileCheck2 className="w-5 h-5 text-blue-500" />;
    return <FileText className="w-5 h-5 text-primary" />;
  };

  const fileTypeLabel = isImage
    ? 'Image'
    : isPdf
      ? 'PDF Document'
      : isWord
        ? 'Microsoft Word Document'
        : isSpreadsheet
          ? 'Spreadsheet Document'
          : 'Document Resource';

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-6 overflow-hidden animate-fade-in"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview of ${fileName}`}
      >
        <div
          className="fixed inset-0 overlay-backdrop"
          onClick={onClose}
        />

        <div className="bg-card border border-border rounded-2xl w-full max-w-5xl h-[90vh] max-h-[92vh] shadow-elevated overflow-hidden animate-scale-in flex flex-col relative z-10">
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-border flex items-center justify-between bg-muted/40 gap-3 shrink-0">
            <div className="flex items-center space-x-3 truncate min-w-0">
              <div className="w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center shrink-0">
                {getIcon()}
              </div>
              <div className="truncate min-w-0">
                <h3 className="text-sm font-bold text-foreground truncate" title={fileName}>
                  {fileName}
                </h3>
                <div className="flex items-center space-x-2 text-[11px] font-sans text-muted-foreground mt-0.5">
                  <span>{fileTypeLabel}</span>
                  {file.size && (
                    <>
                      <span>•</span>
                      <span>{file.size}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-2 shrink-0">
              {safeUrl && (
                <>
                  <a
                    href={safeUrl}
                    download={fileName}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-all shadow-primary-sm flex items-center space-x-1.5 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Download</span>
                  </a>
                  <a
                    href={safeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-xl transition-colors cursor-pointer"
                    title="Open in new window"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted border border-border rounded-xl transition-colors cursor-pointer"
                title="Close viewer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Viewer Body */}
          <div className="flex-1 min-h-0 bg-background flex flex-col overflow-hidden relative">
            {isPdf && safeUrl ? (
              <PdfViewer
                url={safeUrl}
                title={fileName}
                className="w-full h-full border-0 rounded-none shadow-none flex-1"
              />
            ) : isImage && safeUrl ? (
              <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 flex flex-col items-center justify-start">
                <div className="min-w-full w-fit flex justify-center py-2 shrink-0">
                  <img
                    src={safeUrl}
                    alt={fileName}
                    className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain shadow-card border border-border shrink-0"
                  />
                </div>
              </div>
            ) : isHtml && safeUrl ? (
              <div className="w-full flex-1 min-h-0 flex flex-col p-4">
                <iframe
                  src={safeUrl}
                  title={fileName}
                  data-testid="sandboxed-html-frame"
                  sandbox="allow-scripts"
                  className="w-full flex-1 border border-border rounded-xl bg-background"
                />
              </div>
            ) : (
              <div className="flex-1 min-h-0 overflow-auto p-4 sm:p-6 flex flex-col items-center justify-center">
                <div className="w-full max-w-xl p-8 bg-muted/20 border border-border/80 rounded-2xl text-center space-y-4 shadow-subtle my-auto">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
                    {getIcon()}
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-foreground">{fileName}</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fileTypeLabel} {file.size ? `• ${file.size}` : ''}
                    </p>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Attached course reference handout. You can download this file directly to your device or open it in your browser.
                  </p>
                  {safeUrl && (
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                      <a
                        href={safeUrl}
                        download={fileName}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-xl transition-all shadow-primary-sm flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download {fileName}</span>
                      </a>
                      <a
                        href={safeUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-card hover:bg-muted text-foreground border border-border text-xs font-bold rounded-xl transition-all flex items-center space-x-1.5 cursor-pointer"
                      >
                        <ExternalLink className="w-4 h-4" />
                        <span>Open in Browser</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
