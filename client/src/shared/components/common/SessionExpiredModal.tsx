import React, { useEffect, useRef } from 'react';
import { Clock, LogIn } from 'lucide-react';
import { ModalPortal } from './ModalPortal';

export interface SessionExpiredModalProps {
  isOpen: boolean;
  onBackToLogin: () => void;
  title?: string;
  message?: string;
  buttonText?: string;
}

export const SessionExpiredModal: React.FC<SessionExpiredModalProps> = ({
  isOpen,
  onBackToLogin,
  title = 'Session Expired',
  message = 'Your session has ended. Please sign in again to continue using Gabay LMS.',
  buttonText = 'Back to Login',
}) => {
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Auto-focus the action button for keyboard accessibility
      const timer = setTimeout(() => {
        buttonRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="session-expired-title"
        aria-describedby="session-expired-desc"
      >
        <div
          className="w-full max-w-md bg-card border border-border/80 rounded-2xl p-6 sm:p-8 shadow-elevated text-center space-y-6 animate-scale-in"
          onClick={e => e.stopPropagation()}
        >
          {/* Visual anchor / Icon badge */}
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto shadow-sm">
            <Clock className="w-8 h-8" aria-hidden="true" />
          </div>

          <div className="space-y-2">
            <h2
              id="session-expired-title"
              className="text-xl font-bold text-foreground font-sans tracking-tight"
            >
              {title}
            </h2>
            <p
              id="session-expired-desc"
              className="text-sm text-muted-foreground font-sans leading-relaxed max-w-sm mx-auto"
            >
              {message}
            </p>
          </div>

          <div className="pt-2">
            <button
              ref={buttonRef}
              type="button"
              onClick={onBackToLogin}
              className="w-full py-3 px-5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm shadow-primary-sm transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-[0.99] font-sans focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
            >
              <LogIn className="w-4 h-4" aria-hidden="true" />
              <span>{buttonText}</span>
            </button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
};
