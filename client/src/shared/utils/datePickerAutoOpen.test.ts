import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isDatePickerInput,
  openDatePicker,
  setupDatePickerAutoOpen,
} from './datePickerAutoOpen';

describe('datePickerAutoOpen utility', () => {
  let cleanup: (() => void) | null = null;

  beforeEach(() => {
    document.body.innerHTML = '';
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = null;
    }
    vi.restoreAllMocks();
  });

  describe('isDatePickerInput', () => {
    it('identifies date, datetime-local, time, month, and week inputs', () => {
      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      expect(isDatePickerInput(dateInput)).toBe(true);

      const datetimeInput = document.createElement('input');
      datetimeInput.type = 'datetime-local';
      expect(isDatePickerInput(datetimeInput)).toBe(true);

      const timeInput = document.createElement('input');
      timeInput.type = 'time';
      expect(isDatePickerInput(timeInput)).toBe(true);

      const monthInput = document.createElement('input');
      monthInput.type = 'month';
      expect(isDatePickerInput(monthInput)).toBe(true);

      const weekInput = document.createElement('input');
      weekInput.type = 'week';
      expect(isDatePickerInput(weekInput)).toBe(true);
    });

    it('rejects non-picker inputs and non-input elements', () => {
      const textInput = document.createElement('input');
      textInput.type = 'text';
      expect(isDatePickerInput(textInput)).toBe(false);

      const numberInput = document.createElement('input');
      numberInput.type = 'number';
      expect(isDatePickerInput(numberInput)).toBe(false);

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      expect(isDatePickerInput(checkbox)).toBe(false);

      const div = document.createElement('div');
      expect(isDatePickerInput(div)).toBe(false);

      expect(isDatePickerInput(null)).toBe(false);
      expect(isDatePickerInput(undefined)).toBe(false);
    });
  });

  describe('openDatePicker', () => {
    it('invokes showPicker on supported input and returns true', () => {
      const input = document.createElement('input');
      input.type = 'date';
      const showPickerSpy = vi.fn();
      input.showPicker = showPickerSpy;

      const result = openDatePicker(input);
      expect(result).toBe(true);
      expect(showPickerSpy).toHaveBeenCalledTimes(1);
    });

    it('does not invoke showPicker if the input is disabled', () => {
      const input = document.createElement('input');
      input.type = 'date';
      input.disabled = true;
      const showPickerSpy = vi.fn();
      input.showPicker = showPickerSpy;

      const result = openDatePicker(input);
      expect(result).toBe(false);
      expect(showPickerSpy).not.toHaveBeenCalled();
    });

    it('does not invoke showPicker if the input is readOnly', () => {
      const input = document.createElement('input');
      input.type = 'date';
      input.readOnly = true;
      const showPickerSpy = vi.fn();
      input.showPicker = showPickerSpy;

      const result = openDatePicker(input);
      expect(result).toBe(false);
      expect(showPickerSpy).not.toHaveBeenCalled();
    });

    it('catches showPicker errors gracefully and returns false', () => {
      const input = document.createElement('input');
      input.type = 'date';
      input.showPicker = vi.fn().mockImplementation(() => {
        throw new DOMException('Picker is already open', 'InvalidStateError');
      });

      expect(() => {
        const result = openDatePicker(input);
        expect(result).toBe(false);
      }).not.toThrow();
    });

    it('returns false when showPicker is not supported on the input', () => {
      const input = document.createElement('input');
      input.type = 'date';
      // @ts-expect-error test unsupported browser environment
      delete input.showPicker;

      const result = openDatePicker(input);
      expect(result).toBe(false);
    });
  });

  describe('setupDatePickerAutoOpen', () => {
    it('automatically opens picker when a date input is clicked', () => {
      cleanup = setupDatePickerAutoOpen();

      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      const showPickerSpy = vi.fn();
      dateInput.showPicker = showPickerSpy;
      document.body.appendChild(dateInput);

      dateInput.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(showPickerSpy).toHaveBeenCalledTimes(1);
    });

    it('automatically opens picker when a datetime-local input is clicked', () => {
      cleanup = setupDatePickerAutoOpen();

      const datetimeInput = document.createElement('input');
      datetimeInput.type = 'datetime-local';
      const showPickerSpy = vi.fn();
      datetimeInput.showPicker = showPickerSpy;
      document.body.appendChild(datetimeInput);

      datetimeInput.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(showPickerSpy).toHaveBeenCalledTimes(1);
    });

    it('ignores clicks on standard text or button inputs', () => {
      cleanup = setupDatePickerAutoOpen();

      const textInput = document.createElement('input');
      textInput.type = 'text';
      const showPickerSpy = vi.fn();
      textInput.showPicker = showPickerSpy;
      document.body.appendChild(textInput);

      textInput.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(showPickerSpy).not.toHaveBeenCalled();
    });

    it('is idempotent when called multiple times', () => {
      const cleanup1 = setupDatePickerAutoOpen();
      const cleanup2 = setupDatePickerAutoOpen();
      expect(cleanup1).toBe(cleanup2);

      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      const showPickerSpy = vi.fn();
      dateInput.showPicker = showPickerSpy;
      document.body.appendChild(dateInput);

      dateInput.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      // Should only trigger once, not twice
      expect(showPickerSpy).toHaveBeenCalledTimes(1);

      cleanup1();
    });

    it('removes listener when cleanup function is invoked', () => {
      const remove = setupDatePickerAutoOpen();

      const dateInput = document.createElement('input');
      dateInput.type = 'date';
      const showPickerSpy = vi.fn();
      dateInput.showPicker = showPickerSpy;
      document.body.appendChild(dateInput);

      remove();

      dateInput.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      expect(showPickerSpy).not.toHaveBeenCalled();
    });
  });
});
