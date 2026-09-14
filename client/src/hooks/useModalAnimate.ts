import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * Hook to coordinate modal opening and graceful disappearance/exit animations.
 * When startClose is invoked:
 * 1. isClosing becomes true (triggering animate-fade-out, animate-scale-out, or animate-slide-out-right).
 * 2. After duration (default: 200ms), the parent onClose() is invoked to unmount or reset state.
 */
export function useModalAnimate(onClose: () => void, duration = 200) {
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const startClose = useCallback((callback?: () => void) => {
    if (isClosing) return;
    setIsClosing(true);
    timerRef.current = setTimeout(() => {
      if (callback) {
        callback();
      }
      onClose();
      setIsClosing(false);
    }, duration);
  }, [isClosing, onClose, duration]);

  return { isClosing, startClose };
}
