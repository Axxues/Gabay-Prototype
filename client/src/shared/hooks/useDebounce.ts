import { useState, useEffect } from 'react';

/**
 * useDebounce hook
 * Delays updating a value until a specified delay has passed since the last change.
 * Useful for search inputs and rapid filters to avoid jank and unnecessary calculations.
 */
export function useDebounce<T>(value: T, delayMs: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
