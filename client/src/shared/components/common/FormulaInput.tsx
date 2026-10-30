import React, { useState, useEffect } from 'react';

interface FormulaInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  allowedComponents?: string[];
}

/**
 * Specialized formula input that only accepts valid formula characters:
 * - Numbers (0-9 and decimal point)
 * - Operators (+, -, *, /)
 * - Parentheses
 * - Percentage symbol (%)
 * - Whitespace
 * - Component names (e.g., "Class Standing", "Midterm Exam")
 */
export const FormulaInput: React.FC<FormulaInputProps> = ({
  value,
  onChange,
  placeholder = 'e.g. 60% Class Standing + 40% Midterm Exam',
  className = '',
  id,
  allowedComponents = []
}) => {
  const [error, setError] = useState<string>('');

  const validateAndChange = (input: string) => {
    // Allow alphanumeric, spaces, operators, parentheses, and percent
    // Also allow common words if allowedComponents is provided
    const formulaPattern = /^[0-9+\-*/().%\s]+$/;

    if (input === '') {
      setError('');
      onChange(input);
      return;
    }

    // Check if input matches basic formula pattern
    if (formulaPattern.test(input)) {
      setError('');
      onChange(input);
    } else {
      // Check if it contains allowed component names
      const hasAllowedComponents = allowedComponents.some(comp =>
        input.includes(comp)
      );

      if (hasAllowedComponents) {
        // Temporarily allow it but mark as needing component validation
        setError('');
        onChange(input);
      } else {
        setError('Invalid characters. Use only numbers, operators (+, -, *, /), parentheses, and %');
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Allow navigation keys
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Escape', 'Enter',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End'
    ];

    if (allowedKeys.includes(e.key)) {
      return;
    }

    // Allow formula characters
    const formulaChars = /^[0-9+\-*/().%\s]$/;
    if (!formulaChars.test(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => validateAndChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-mono text-xs ${error ? 'border-destructive focus:ring-destructive/20 focus:border-destructive' : ''} ${className}`}
      />
      {error && (
        <p className="text-[10px] text-destructive mt-1">{error}</p>
      )}
    </div>
  );
};

interface PercentageInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  min?: number;
  max?: number;
}

/**
 * Specialized percentage input that only accepts numeric values between 0 and 100
 */
export const PercentageInput: React.FC<PercentageInputProps> = ({
  value,
  onChange,
  placeholder = 'e.g. 75',
  className = '',
  id,
  min = 0,
  max = 100
}) => {
  const [error, setError] = useState<string>('');

  const validateAndChange = (input: string) => {
    if (input === '') {
      setError('');
      onChange(input);
      return;
    }

    // Allow only numbers and decimal point
    const numPattern = /^\d*\.?\d*$/;

    if (!numPattern.test(input)) {
      setError('Only numbers are allowed');
      return;
    }

    const numValue = parseFloat(input);

    if (isNaN(numValue)) {
      setError('Invalid number');
      return;
    }

    if (numValue < min || numValue > max) {
      setError(`Value must be between ${min} and ${max}`);
    } else {
      setError('');
    }

    onChange(input);
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => validateAndChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-3 py-2 text-sm rounded-xl border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all ${error ? 'border-destructive focus:ring-destructive/20 focus:border-destructive' : ''} ${className}`}
      />
      {error && (
        <p className="text-[10px] text-destructive mt-1">{error}</p>
      )}
    </div>
  );
};

interface PercentageSplitInputProps {
  label1: string;
  label2: string;
  value1: string;
  value2: string;
  onChange1: (value: string) => void;
  onChange2: (value: string) => void;
  className?: string;
}

/**
 * Specialized input for percentage splits (e.g., Class Standing vs Exam)
 * The two values must always equal 100%
 */
export const PercentageSplitInput: React.FC<PercentageSplitInputProps> = ({
  label1,
  label2,
  value1,
  value2,
  onChange1,
  onChange2,
  className = ''
}) => {
  const [localValue1, setLocalValue1] = useState(value1);
  const [localValue2, setLocalValue2] = useState(value2);

  // Sync props to local state
  useEffect(() => {
    setLocalValue1(value1);
    setLocalValue2(value2);
  }, [value1, value2]);

  const handle1Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setLocalValue1(input);
    onChange1(input);
  };

  const handle1Blur = () => {
    // Auto-adjust complementary value on blur
    const numValue = parseFloat(localValue1);
    if (!isNaN(numValue) && localValue1 !== '') {
      const clamped = Math.max(0, Math.min(100, numValue));
      const complementary = (100 - clamped).toFixed(1).replace(/\.0$/, '');
      onChange2(complementary);
      setLocalValue2(complementary);
    } else if (localValue1 === '') {
      onChange2('');
      setLocalValue2('');
    }
  };

  const handle2Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    setLocalValue2(input);
    onChange2(input);
  };

  const handle2Blur = () => {
    // Auto-adjust complementary value on blur
    const numValue = parseFloat(localValue2);
    if (!isNaN(numValue) && localValue2 !== '') {
      const clamped = Math.max(0, Math.min(100, numValue));
      const complementary = (100 - clamped).toFixed(1).replace(/\.0$/, '');
      onChange1(complementary);
      setLocalValue1(complementary);
    } else if (localValue2 === '') {
      onChange1('');
      setLocalValue1('');
    }
  };

  const total = (parseFloat(localValue1) || 0) + (parseFloat(localValue2) || 0);
  const isBalanced = Math.abs(total - 100) < 0.01;

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1 max-w-[100px] space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground truncate">{label1}</label>
          <div className="relative">
            <input
              type="text"
              value={localValue1}
              onChange={handle1Change}
              onBlur={handle1Blur}
              placeholder="0"
              className={`w-full px-2 py-1.5 text-sm font-mono text-center rounded-md border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all ${!isBalanced ? 'border-destructive focus:ring-destructive/20 focus:border-destructive' : ''}`}
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
          </div>
        </div>

        <div className="flex items-center justify-center h-full pt-5">
          <div className={`w-4 h-px ${isBalanced ? 'bg-primary' : 'bg-destructive'}`} />
        </div>

        <div className="flex-1 max-w-[100px] space-y-1">
          <label className="text-[10px] font-semibold text-muted-foreground truncate">{label2}</label>
          <div className="relative">
            <input
              type="text"
              value={localValue2}
              onChange={handle2Change}
              onBlur={handle2Blur}
              placeholder="0"
              className={`w-full px-2 py-1.5 text-sm font-mono text-center rounded-md border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all ${!isBalanced ? 'border-destructive focus:ring-destructive/20 focus:border-destructive' : ''}`}
            />
            <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
          </div>
        </div>

        <div className={`flex items-center justify-center w-12 h-full pt-5 text-xs font-bold ${isBalanced ? 'text-primary' : 'text-destructive'}`}>
          {total.toFixed(0)}%
        </div>
      </div>
    </div>
  );
};
