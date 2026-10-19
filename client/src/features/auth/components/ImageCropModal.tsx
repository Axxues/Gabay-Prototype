import React, { useState, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Check, X, Loader2, Move } from 'lucide-react';
import { ModalPortal } from '../../../shared/components/common/ModalPortal';

interface ImageCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  kind: 'avatar' | 'banner';
  onSave: (croppedFile: File) => Promise<void> | void;
}

export const ImageCropModal: React.FC<ImageCropModalProps> = ({
  isOpen,
  onClose,
  file,
  kind,
  onSave,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Viewport sizes
  const frameWidth = kind === 'avatar' ? 260 : 440;
  const frameHeight = kind === 'avatar' ? 260 : 140;

  // Load image when file changes
  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      const src = e.target?.result as string;
      setImageSrc(src);
      const img = new Image();
      img.onload = () => {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        setZoom(1);
        setOffset({ x: 0, y: 0 });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  }, [file]);

  // Mouse & Touch Drag Handlers
  const handlePointerDown = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setDragStart({ x: clientX - offset.x, y: clientY - offset.y });
  };

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    if (!isDragging) return;
    setOffset({
      x: clientX - dragStart.x,
      y: clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isProcessing) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isProcessing, onClose]);

  // Perform crop to canvas and output new File
  const handleApplyCrop = async () => {
    setIsProcessing(true);

    try {
      const src = imageSrc || (file ? URL.createObjectURL(file) : null);
      if (!src) return;

      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
      });

      const nw = naturalSize.width || img.naturalWidth || 500;
      const nh = naturalSize.height || img.naturalHeight || 500;

      // Target export dimensions
      const targetWidth = kind === 'avatar' ? 512 : 1400;
      const targetHeight = kind === 'avatar' ? 512 : Math.round((1400 * frameHeight) / frameWidth);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas 2D context unavailable');

      // Calculate how the image renders inside the viewport
      // At zoom 1, calculate base display dimensions
      const imgAspect = nw / nh;
      const frameAspect = frameWidth / frameHeight;

      let baseW: number;
      let baseH: number;
      if (imgAspect > frameAspect) {
        // Image is wider than frame -> height fits frame, width overflows
        baseH = frameHeight;
        baseW = frameHeight * imgAspect;
      } else {
        // Image is taller than frame -> width fits frame, height overflows
        baseW = frameWidth;
        baseH = frameWidth / imgAspect;
      }

      const displayW = baseW * zoom;
      const displayH = baseH * zoom;

      // Image top-left in viewport coordinate system:
      // Centered at (frameWidth/2, frameHeight/2) + offset
      const imgDisplayX = (frameWidth - displayW) / 2 + offset.x;
      const imgDisplayY = (frameHeight - displayH) / 2 + offset.y;

      // Map from viewport to canvas export scale
      const scaleToCanvas = targetWidth / frameWidth;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Draw image onto canvas transformed
      ctx.drawImage(
        img,
        imgDisplayX * scaleToCanvas,
        imgDisplayY * scaleToCanvas,
        displayW * scaleToCanvas,
        displayH * scaleToCanvas
      );

      const blob = await new Promise<Blob | null>(resolve => {
        canvas.toBlob(resolve, 'image/jpeg', 0.92);
      });

      if (!blob) throw new Error('Failed to create cropped image blob');

      const fileName = file ? file.name.replace(/\.[^/.]+$/, '') + '-cropped.jpg' : 'cropped.jpg';
      const croppedFile = new File([blob], fileName, { type: 'image/jpeg' });

      await onSave(croppedFile);
      onClose();
    } catch (err) {
      console.error('Failed to crop image:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !file) return null;

  // Base rendered dimensions in frame
  const imgAspect = naturalSize.width && naturalSize.height ? naturalSize.width / naturalSize.height : 1;
  const frameAspect = frameWidth / frameHeight;
  let baseW = frameWidth;
  let baseH = frameHeight;
  if (imgAspect > frameAspect) {
    baseH = frameHeight;
    baseW = frameHeight * imgAspect;
  } else {
    baseW = frameWidth;
    baseH = frameWidth / imgAspect;
  }

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
        onClick={onClose}
      >
        <div
          className="bg-card border border-border rounded-2xl shadow-2xl overflow-hidden max-w-lg w-full flex flex-col m-auto animate-in zoom-in-95 duration-150 relative"
          onClick={e => e.stopPropagation()}
        >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-card">
          <div>
            <h3 className="font-bold text-sm text-foreground">
              {kind === 'avatar' ? 'Arrange Profile Picture' : 'Arrange Profile Banner'}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Drag to position and adjust the zoom slider to fit.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Area */}
        <div className="p-6 flex flex-col items-center justify-center bg-muted/20 select-none">
          <div
            className={`relative overflow-hidden bg-black/40 shadow-inner flex items-center justify-center border-2 border-primary/60 cursor-grab active:cursor-grabbing ${
              kind === 'avatar' ? 'rounded-full' : 'rounded-xl'
            }`}
            style={{ width: `${frameWidth}px`, height: `${frameHeight}px` }}
            onMouseDown={e => handlePointerDown(e.clientX, e.clientY)}
            onMouseMove={e => handlePointerMove(e.clientX, e.clientY)}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={e => {
              if (e.touches[0]) handlePointerDown(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchMove={e => {
              if (e.touches[0]) handlePointerMove(e.touches[0].clientX, e.touches[0].clientY);
            }}
            onTouchEnd={handlePointerUp}
          >
            {imageSrc && (
              <img
                src={imageSrc}
                alt="Preview"
                draggable={false}
                className="max-w-none pointer-events-none transition-transform duration-75 ease-out select-none"
                style={{
                  width: `${baseW * zoom}px`,
                  height: `${baseH * zoom}px`,
                  transform: `translate(${offset.x}px, ${offset.y}px)`,
                }}
              />
            )}

            {/* Visual crop overlay indicator */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30 group-hover:opacity-60 transition-opacity">
              <Move className="w-6 h-6 text-white drop-shadow" />
            </div>
          </div>

          <span className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1">
            <Move className="w-3.5 h-3.5" /> Drag image to adjust frame position
          </span>
        </div>

        {/* Zoom Controls */}
        <div className="px-6 py-3 border-t border-border bg-card flex items-center gap-3">
          <button
            type="button"
            onClick={() => setZoom(prev => Math.max(1, Number((prev - 0.1).toFixed(2))))}
            disabled={zoom <= 1}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 cursor-pointer"
            title="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))}
            className="flex-1 accent-primary h-1.5 bg-muted rounded-lg cursor-pointer"
          />

          <button
            type="button"
            onClick={() => setZoom(prev => Math.min(3, Number((prev + 0.1).toFixed(2))))}
            disabled={zoom >= 3}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 cursor-pointer"
            title="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
            title="Reset position and zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border bg-muted/20">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApplyCrop}
            disabled={isProcessing}
            className="inline-flex items-center space-x-1.5 px-4 py-2 text-xs font-bold bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-60"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Applying…</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Save & Apply</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
};
