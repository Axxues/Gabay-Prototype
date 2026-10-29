/**
 * Global utility to ensure that clicking anywhere on a date, datetime, or time input
 * immediately opens the native browser picker (calendar / clock popup).
 */

const PICKER_INPUT_TYPES = new Set([
  'date',
  'datetime-local',
  'time',
  'month',
  'week',
]);

/**
 * Checks if the given element is an HTMLInputElement supported by native picker popups.
 */
export function isDatePickerInput(element: unknown): element is HTMLInputElement {
  if (!(element instanceof HTMLInputElement)) return false;
  const type = element.type?.toLowerCase();
  return Boolean(type && PICKER_INPUT_TYPES.has(type));
}

/**
 * Safely invokes `showPicker()` on the target input if supported and permitted.
 * Silently catches any browser-specific exceptions (e.g. picker already open,
 * disabled/readOnly state, or transient activation constraints).
 */
export function openDatePicker(input: HTMLInputElement): boolean {
  if (input.disabled || input.readOnly) {
    return false;
  }

  if (typeof input.showPicker === 'function') {
    try {
      input.showPicker();
      return true;
    } catch {
      // Browser may throw InvalidStateError or NotAllowedError if already active or restricted
      return false;
    }
  }

  return false;
}

let activeCleanup: (() => void) | null = null;

/**
 * Installs a global document click listener (in capture phase) that intercepts clicks
 * on any date/datetime/time input across the entire application and immediately displays
 * the native calendar/time picker popup.
 *
 * Safe to call multiple times (idempotent).
 */
export function setupDatePickerAutoOpen(): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return () => {};
  }

  if (activeCleanup) {
    return activeCleanup;
  }

  const handleClick = (event: MouseEvent) => {
    const target = event.target;
    if (isDatePickerInput(target)) {
      openDatePicker(target);
    }
  };

  document.addEventListener('click', handleClick, true);

  activeCleanup = () => {
    document.removeEventListener('click', handleClick, true);
    activeCleanup = null;
  };

  return activeCleanup;
}
