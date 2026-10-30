import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TimeRangePicker } from './TimeRangePicker';

const openPicker = () =>
  fireEvent.click(screen.getByRole('button', { name: /Select time range/i }));

const pickStart = (time: string) =>
  fireEvent.click(screen.getAllByRole('button', { name: time })[0]);

// The end-time list renders after the start-time list, so the second match is the end slot.
const pickEnd = (time: string) =>
  fireEvent.click(screen.getAllByRole('button', { name: time })[1]);

describe('TimeRangePicker', () => {
  it('requires a start and end time before committing', () => {
    const onChange = vi.fn();
    render(<TimeRangePicker value="" onChange={onChange} includeDays />);

    openPicker();
    pickStart('07:00 AM');

    expect(onChange).toHaveBeenCalledWith('');
    expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('07:00 AM'));
    expect(screen.getByRole('alert')).toHaveTextContent(/start and end time/i);
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  });

  it('then requires a day for class schedules', () => {
    const onChange = vi.fn();
    render(<TimeRangePicker value="" onChange={onChange} includeDays />);

    openPicker();
    pickStart('07:00 AM');
    pickEnd('08:00 AM');

    expect(onChange).not.toHaveBeenCalledWith(expect.stringContaining('07:00 AM'));
    expect(screen.getByRole('alert')).toHaveTextContent(/Select at least one day/i);
    expect(screen.getByRole('button', { name: 'Done' })).toBeDisabled();
  });

  it('commits the range once both times and a day are picked', () => {
    const onChange = vi.fn();
    render(<TimeRangePicker value="" onChange={onChange} includeDays />);

    openPicker();
    pickStart('07:00 AM');
    pickEnd('08:00 AM');
    fireEvent.click(screen.getByRole('button', { name: 'M' }));

    expect(onChange).toHaveBeenCalledWith('07:00 AM – 08:00 AM M');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();
  });

  it('commits a plain time range (consultation hours) with both times', () => {
    const onChange = vi.fn();
    render(<TimeRangePicker value="" onChange={onChange} />);

    openPicker();
    pickStart('09:00 AM');

    expect(onChange).toHaveBeenCalledWith('');
    expect(screen.getByRole('alert')).toHaveTextContent(/start and end time/i);

    pickEnd('10:00 AM');

    expect(onChange).toHaveBeenLastCalledWith('09:00 AM – 10:00 AM');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();
  });

  it('still closes when nothing was picked', () => {
    const onChange = vi.fn();
    render(<TimeRangePicker value="" onChange={onChange} includeDays />);

    openPicker();
    const done = screen.getByRole('button', { name: 'Done' });
    expect(done).toBeEnabled();
    fireEvent.click(done);

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });
});
