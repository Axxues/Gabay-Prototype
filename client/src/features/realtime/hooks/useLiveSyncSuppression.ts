import { useEffect } from 'react';
import { setLiveSyncSuppressed } from '../api/realtimeApi';

/**
 * Pause live sync refetches while `active` (e.g. an assessment runner is
 * open). Clamped to true in case an ancestor suppression is still lingering.
 */
export function useLiveSyncSuppression(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    setLiveSyncSuppressed(true);
    return () => setLiveSyncSuppressed(false);
  }, [active]);
}
