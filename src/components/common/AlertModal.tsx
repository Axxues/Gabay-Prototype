import React from 'react';
import { AlertCircle, CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';
import { ModalPortal, useModalAnimate } from './ModalPortal';

export interface AlertModalOptions {
  title: string;
  message: React.ReactNode;
  type?: 'info' | 'success' | 'warning' | 'error' | 'confirm';
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}

interface AlertModalProps {
  isOpen: boolean;
  options: AlertModalOptions | null;
  onClose: () => void;
}

export const AlertModal: React.FC<AlertModalProps> = ({ isOpen, options, onClose }) => {
  const { isClosing, startClose } = useModalAnimate(onClose);

  if (!isOpen || !options) return null;

  const {
    title,
    message,
    type = 'info',
    confirmText = 'OK',
    cancelText = 'Cancel',
    onConfirm,
    onCancel
  } = options;

  const isConfirm = type === 'confirm' || Boolean(onCancel) || Boolean(options.cancelText);

  const handleConfirm = () => {
    startClose(() => {
      if (onConfirm) {
        onConfirm();
      }
    });
  };

  const handleCancel = () => {
    startClose(() => {
      if (onCancel) {
        onCancel();
      }
    });
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-6 h-6 text-emerald-500" />;
      case 'warning':
      case 'confirm':
        return <AlertTriangle className="w-6 h-6 text-amber-500" />;
      case 'error':
        return <AlertCircle className="w-6 h-6 text-red-500" />;
      case 'info':
      default:
        return <Info className="w-6 h-6 text-primary" />;
    }
  };

  return (
    <ModalPortal>
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 overlay-backdrop ${
          isClosing ? 'animate-fade-out' : 'animate-fade-in'
        }`}
        onClick={handleCancel}
      >
        <div
          className={`w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-elevated space-y-4 ${
            isClosing ? 'animate-scale-out' : 'animate-scale-in'
          }`}
          onClick={e => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-muted shrink-0">
                {getIcon()}
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground leading-tight">
                  {title}
                </h3>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="text-xs sm:text-sm text-muted-foreground leading-relaxed pl-1">
            {message}
          </div>

          <div className="flex items-center justify-end space-x-2 pt-2">
            {isConfirm && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-xs font-semibold rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                {cancelText}
              </button>
            )}
            <button
              type="button"
              onClick={handleConfirm}
              className="px-5 py-2 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary-sm transition-all cursor-pointer active:scale-[0.98]"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
