import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React, { useState } from 'react';
import { NumericInput } from './NumericInput';

describe('NumericInput component', () => {
  it('renders as a normal input with inputMode numeric and no number stepper', () => {
    render(<NumericInput value={20} onChange={vi.fn()} aria-label="Points input" />);
    const input = screen.getByLabelText('Points input') as HTMLInputElement;

    expect(input.type).toBe('text');
    expect(input.getAttribute('inputMode')).toBe('numeric');
    expect(input.value).toBe('20');
  });

  it('allows user to delete the number 1 and empty the input completely', () => {
    const TestComponent = () => {
      const [val, setVal] = useState<number>(1);
      return (
        <NumericInput
          value={val}
          onChange={newVal => setVal(newVal)}
          min={1}
          aria-label="Deletable input"
        />
      );
    };

    render(<TestComponent />);
    const input = screen.getByLabelText('Deletable input') as HTMLInputElement;
    expect(input.value).toBe('1');

    // Simulate clearing the input (backspacing the 1)
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });

    // The input should be EMPTY, NOT locked at 1!
    expect(input.value).toBe('');

    // User types new number 50
    fireEvent.change(input, { target: { value: '50' } });
    expect(input.value).toBe('50');
  });

  it('restricts non-numeric characters on typing and pasting', () => {
    const handleChange = vi.fn();
    render(<NumericInput value={10} onChange={handleChange} aria-label="Strict input" />);
    const input = screen.getByLabelText('Strict input') as HTMLInputElement;

    // Simulate pasting letters mixed with numbers
    fireEvent.change(input, { target: { value: 'abc25def' } });
    expect(input.value).toBe('25');
    expect(handleChange).toHaveBeenCalledWith(25, '25');

    // Pressing a letter key on keyDown should be cancelled
    const notCancelled = fireEvent.keyDown(input, { key: 'a' });
    expect(notCancelled).toBe(false);

    // Pressing a digit key on keyDown should be allowed
    const digitAllowed = fireEvent.keyDown(input, { key: '7' });
    expect(digitAllowed).toBe(true);
  });

  it('supports decimal numbers when allowDecimals is true', () => {
    const handleChange = vi.fn();
    render(
      <NumericInput
        value={15.5}
        allowDecimals={true}
        onChange={handleChange}
        aria-label="Decimal input"
      />
    );
    const input = screen.getByLabelText('Decimal input') as HTMLInputElement;
    expect(input.getAttribute('inputMode')).toBe('decimal');
    expect(input.value).toBe('15.5');

    fireEvent.change(input, { target: { value: '18.75' } });
    expect(input.value).toBe('18.75');
    expect(handleChange).toHaveBeenCalledWith(18.75, '18.75');
  });

  it('enforces min bound when user leaves the field empty', () => {
    const handleChange = vi.fn();
    render(<NumericInput value={5} min={1} onChange={handleChange} aria-label="Min input" />);
    const input = screen.getByLabelText('Min input') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');

    // When blurring while empty, it defaults safely to min
    fireEvent.blur(input);
    expect(input.value).toBe('1');
    expect(handleChange).toHaveBeenCalledWith(1, '1');
  });

  it('allows empty when allowEmpty is true', () => {
    const handleChange = vi.fn();
    render(<NumericInput value={0} allowEmpty={true} onChange={handleChange} aria-label="Empty input" />);
    const input = screen.getByLabelText('Empty input') as HTMLInputElement;

    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(input.value).toBe('');
    expect(handleChange).toHaveBeenCalledWith(0, '');
  });
});
