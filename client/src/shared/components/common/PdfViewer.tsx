import { resolveLikhaAssetUrl } from '../../api/likhaLmsApi';
import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';

export interface PdfViewerProps {
  url?: string;
  title?: string;
  className?: string;
  initialScale?: number;
}

function decodeDataUri(dataUri: string): Uint8Array {
  const base64Index = dataUri.indexOf(';base64,');
  if (base64Index !== -1) {
    const base64 = dataUri.substring(base64Index + 8);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  const commaIndex = dataUri.indexOf(',');
  const raw = commaIndex !== -1 ? decodeURIComponent(dataUri.substring(commaIndex + 1)) : dataUri;
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

async function loadPdfjs() {
  const pdfjsLib = await import('pdfjs-dist');
  try {
    const workerModule = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
    if (typeof workerModule?.default === 'string') {
      let src = workerModule.default;
      const isNode =
        typeof globalThis !== 'undefined' &&
        'process' in globalThis &&
        Boolean((globalThis as any).process?.versions?.node);
      if (isNode) {
        if (src.startsWith('/@fs/')) {
          src = src.slice(5);
        }
        if (/^[A-Za-z]:/.test(src)) {
          src = 'file:///' + src.replace(/\\/g, '/');
        }
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc = src;
    }
  } catch {
    // In environments where worker cannot be loaded, pdfjs-dist uses fake worker
  }
  return pdfjsLib;
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  url,
  title,
  className = '',
  initialScale = 1.0,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(initialScale);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<RenderTask | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Load document when url changes
  useEffect(() => {
    isMountedRef.current = true;
    setIsLoading(true);
    setError(null);
    setCurrentPage(1);

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore
      }
      renderTaskRef.current = null;
    }

    if (pdfDocRef.current) {
      try {
        pdfDocRef.current.destroy();
      } catch {
        // ignore
      }
      pdfDocRef.current = null;
    }

    if (!url) {
      setIsLoading(false);
      setError('No PDF URL provided.');
      return;
    }

    const activeUrl = resolveLikhaAssetUrl(url);
    let isEffectActive = true;

    async function initDoc() {
      try {
        const pdfjsLib = await loadPdfjs();
        if (!isEffectActive) return;

        let source: any;
        if (activeUrl.startsWith('data:')) {
          source = { data: decodeDataUri(activeUrl) };
        } else {
          source = { url: activeUrl };
        }

        const loadingTask = pdfjsLib.getDocument(source);
        const doc = await loadingTask.promise;

        if (!isEffectActive) {
          try {
            doc.destroy();
          } catch {
            // ignore
          }
          return;
        }

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        setIsLoading(false);
      } catch (err: any) {
        if (!isEffectActive) return;
        if (err?.name === 'PasswordException') {
          setError('This PDF is password-protected.');
        } else {
          setError('Could not render PDF document in-canvas. You can download or open the file directly.');
        }
        setIsLoading(false);
      }
    }

    initDoc();

    return () => {
      isEffectActive = false;
      isMountedRef.current = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
      if (pdfDocRef.current) {
        try {
          pdfDocRef.current.destroy();
        } catch {
          // ignore
        }
      }
    };
  }, [url]);

  // Render current page when pdfDoc, currentPage, or scale changes
  useEffect(() => {
    if (!pdfDocRef.current || currentPage < 1) return;

    let isPageActive = true;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch {
        // ignore
      }
      renderTaskRef.current = null;
    }

    async function renderPage() {
      try {
        const doc = pdfDocRef.current;
        if (!doc) return;

        const page = await doc.getPage(currentPage);
        if (!isPageActive) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const outputScale = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
        const viewport = page.getViewport({ scale });

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // If 2d context is not supported (e.g. node/jsdom test environments)
          return;
        }

        const renderContext = {
          canvasContext: ctx,
          transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
          viewport: viewport,
        };

        const renderTask = page.render(renderContext);
        renderTaskRef.current = renderTask;
        await renderTask.promise;
      } catch (err: any) {
        if (!isPageActive) return;
        if (err?.name === 'RenderingCancelledException') {
          return;
        }
        console.warn('PDF canvas rendering error:', err);
      }
    }

    renderPage();

    return () => {
      isPageActive = false;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [currentPage, scale, numPages]);

  const handlePrevPage = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((p) => Math.min(numPages || 1, p + 1));
  };

  const handleZoomIn = () => {
    setScale((s) => Math.min(3.0, Number((s + 0.2).toFixed(1))));
  };

  const handleZoomOut = () => {
    setScale((s) => Math.max(0.5, Number((s - 0.2).toFixed(1))));
  };

  const handleResetZoom = () => {
    setScale(1.0);
  };

  return (
    <div
      data-testid="pdf-canvas-viewer"
      className={`flex flex-col bg-card border border-border rounded-xl overflow-hidden shadow-subtle ${className}`}
      aria-label={title || 'PDF Document Viewer'}
    >
      {/* Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-muted/40 border-b border-border text-xs select-none">
        {/* Document Title */}
        <div className="flex items-center space-x-2 min-w-0 max-w-[260px] sm:max-w-xs">
          <FileText className="w-4 h-4 text-primary shrink-0" />
          <span className="font-semibold text-foreground truncate" title={title || 'PDF Document'}>
            {title || 'PDF Document'}
          </span>
        </div>

        {/* Page Navigation */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage <= 1 || isLoading}
            aria-label="Previous Page"
            className="p-1 rounded hover:bg-accent text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Previous Page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-muted-foreground font-mono px-1.5 min-w-[70px] text-center">
            {numPages > 0 ? `${currentPage} / ${numPages}` : '—'}
          </span>
          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage >= numPages || isLoading}
            aria-label="Next Page"
            className="p-1 rounded hover:bg-accent text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Next Page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom & Action Controls */}
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            aria-label="Zoom Out"
            className="p-1 rounded hover:bg-accent text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono text-[11px] text-muted-foreground px-1 min-w-[42px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 3.0}
            aria-label="Zoom In"
            className="p-1 rounded hover:bg-accent text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleResetZoom}
            disabled={scale === 1.0}
            aria-label="Reset Zoom"
            className="p-1 rounded hover:bg-accent text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            title="Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          {url && (
            <a
              href={url}
              download={title || 'document.pdf'}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Download Document"
              className="p-1 rounded hover:bg-accent text-foreground transition-colors ml-1 cursor-pointer"
              title="Download Document"
            >
              <Download className="w-4 h-4" />
            </a>
          )}
        </div>
      </div>

      {/* Canvas / Render Body */}
      <div className="relative flex-1 overflow-auto bg-muted/10 p-4 flex items-center justify-center min-h-[360px]">
        {isLoading && (
          <div className="flex flex-col items-center justify-center space-y-2 text-muted-foreground py-12">
            <Loader2 className="w-7 h-7 animate-spin text-primary" />
            <span className="text-xs font-sans">Rendering PDF vector canvas...</span>
          </div>
        )}

        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center text-center p-6 space-y-3 max-w-md mx-auto my-auto">
            <AlertCircle className="w-8 h-8 text-amber-500 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-foreground font-sans">Client-Side Render Notice</p>
              <p className="text-xs text-muted-foreground font-sans leading-relaxed">{error}</p>
            </div>
            {url && (
              <a
                href={url}
                download={title || 'document.pdf'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download / Open File</span>
              </a>
            )}
          </div>
        )}

        <canvas
          ref={canvasRef}
          data-testid="pdf-canvas"
          className={`shadow-elevated rounded border border-border bg-white transition-opacity ${
            isLoading || error ? 'hidden' : 'block'
          }`}
        />
      </div>
    </div>
  );
};
