import React, { useState, useEffect, useRef } from 'react';

export interface NumericInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string | undefined | null;
  onChange: (value: number, raw: string) => void;
  min?: number;
  max?: number;
  allowDecimals?: boolean;
  allowEmpty?: boolean;
  fallbackValue?: number;
}

/**
 * Clean, standard text input restricted strictly to numbers.
 *
 * Solves:
 * 1. Hides browser-native spin/arrow buttons that clash with UI themes.
 * 2. Allows users to freely delete the last digit (including '1') down to empty without
 *    getting locked or immediately snapped back while typing.
 * 3. Enforces valid numeric bounds (min/max) smoothly upon blur.
 */
export const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  min,
  max,
  allowDecimals = false,
  allowEmpty = false,
  fallbackValue,
  onBlur,
  onFocus,
  onKeyDown,
  className,
  placeholder,
  ...rest
}) => {
  const isFocusedRef = useRef(false);

  // Compute initial display text
  const formatInitial = (val: number | string | undefined | null): string => {
    if (val === undefined || val === null || val === '') return '';
    const num = Number(val);
    if (isNaN(num)) return '';
    return String(val);
  };

  const [text, setText] = useState<string>(() => formatInitial(value));

  // Sync with value prop only when value changes externally (not during active typing)
  useEffect(() => {
    if (isFocusedRef.current) {
      // While user is focused and actively typing, do not overwrite if text is empty and value is 0/min
      if (text === '') return;
      const currentNum = allowDecimals ? parseFloat(text) : parseInt(text, 10);
      const propNum = Number(value);
      if (currentNum === propNum) return;
    }
    setText(formatInitial(value));
  }, [value, allowDecimals]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Call parent handler first
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    // Allow navigation & editing keys
    const allowedNavigationKeys = [
      'Backspace',
      'Delete',
      'ArrowLeft',
      'ArrowRight',
      'ArrowUp',
      'ArrowDown',
      'Home',
      'End',
      'Tab',
      'Enter',
      'Escape',
    ];

    if (allowedNavigationKeys.includes(e.key)) {
      return;
    }

    // Allow copy/paste/select-all shortcuts (Ctrl/Cmd + A, C, V, X, Z)
    if (e.ctrlKey || e.metaKey) {
      return;
    }

    // Allow decimal point if configured and not already present
    if (allowDecimals && e.key === '.') {
      if (!text.includes('.')) {
        return;
      }
      e.preventDefault();
      return;
    }

    // Allow digits 0-9
    if (/^[0-9]$/.test(e.key)) {
      return;
    }

    // Reject all other characters (letters, symbols, etc.)
    e.preventDefault();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let sanitized = e.target.value;

    if (allowDecimals) {
      // Allow only digits and at most one decimal point
      sanitized = sanitized.replace(/[^0-9.]/g, '');
      const parts = sanitized.split('.');
      if (parts.length > 2) {
        sanitized = parts[0] + '.' + parts.slice(1).join('');
      }
    } else {
      // Digits only
      sanitized = sanitized.replace(/[^0-9]/g, '');
    }

    setText(sanitized);

    if (sanitized === '' || sanitized === '.') {
      const emptyVal = allowEmpty ? 0 : (fallbackValue ?? (min !== undefined && min > 0 ? 0 : 0));
      onChange(emptyVal, sanitized);
      return;
    }

    let num = allowDecimals ? parseFloat(sanitized) : parseInt(sanitized, 10);
    if (!isNaN(num)) {
      if (max !== undefined && num > max) {
        num = max;
        sanitized = String(max);
        setText(sanitized);
      }
      onChange(num, sanitized);
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    onFocus?.(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false;

    if (text === '' || text === '.') {
      if (allowEmpty) {
        setText('');
        onChange(fallbackValue ?? 0, '');
      } else {
        const defaultVal = fallbackValue ?? min ?? 0;
        setText(String(defaultVal));
        onChange(defaultVal, String(defaultVal));
      }
    } else {
      let num = allowDecimals ? parseFloat(text) : parseInt(text, 10);
      if (isNaN(num)) {
        const defaultVal = allowEmpty ? 0 : (fallbackValue ?? min ?? 0);
        const resolvedText = allowEmpty ? '' : String(defaultVal);
        setText(resolvedText);
        onChange(defaultVal, resolvedText);
      } else {
        if (min !== undefined && num < min) {
          num = min;
        }
        if (max !== undefined && num > max) {
          num = max;
        }
        const formatted = String(num);
        setText(formatted);
        onChange(num, formatted);
      }
    }

    onBlur?.(e);
  };

  return (
    <input
      type="text"
      inputMode={allowDecimals ? 'decimal' : 'numeric'}
      value={text}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
      placeholder={placeholder}
      {...rest}
    />
  );
};
