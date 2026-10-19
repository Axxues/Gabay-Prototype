// @vitest-environment jsdom
import { describe, expect, test, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import React from 'react';
import { CustomDropdown } from './CustomDropdown';

const OPTIONS = [
  { value: 'cs', label: 'Computer Science' },
  { value: 'it', label: 'Information Technology' },
  { value: 'is', label: 'Information Systems' },
  { value: 'ce', label: 'Computer Engineering' },
  { value: 'ee', label: 'Electrical Engineering' },
];

describe('CustomDropdown', () => {
  test('shows the selected option label and falls back to the placeholder', () => {
    const { rerender } = render(
      <CustomDropdown value="cs" onChange={() => {}} options={OPTIONS} placeholder="Select Program" />
    );
    expect(screen.getByRole('button', { name: /computer science/i })).toBeInTheDocument();

    rerender(<CustomDropdown value="" onChange={() => {}} options={OPTIONS} placeholder="Select Program" />);
    expect(screen.getByRole('button', { name: /select program/i })).toBeInTheDocument();
  });

  test('opens the panel and reports the picked value', () => {
    const onChange = vi.fn();
    render(<CustomDropdown value="cs" onChange={onChange} options={OPTIONS} />);

    // Panel is closed until the trigger is activated.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /computer science/i }));

    const panel = screen.getByRole('listbox');
    fireEvent.click(within(panel).getByRole('option', { name: /information technology/i }));

    expect(onChange).toHaveBeenCalledWith('it');
    // Picking an option closes the panel again.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('filters options when searchable', () => {
    render(<CustomDropdown value="cs" onChange={() => {}} options={OPTIONS} searchable />);

    fireEvent.click(screen.getByRole('button', { name: /computer science/i }));
    const panel = screen.getByRole('listbox');

    fireEvent.change(within(panel).getByPlaceholderText('Filter...'), { target: { value: 'engineering' } });

    expect(within(panel).getByRole('option', { name: /computer engineering/i })).toBeInTheDocument();
    expect(within(panel).getByRole('option', { name: /electrical engineering/i })).toBeInTheDocument();
    expect(within(panel).queryByRole('option', { name: /information technology/i })).not.toBeInTheDocument();
  });

  test('reports no matches instead of an empty panel', () => {
    render(<CustomDropdown value="cs" onChange={() => {}} options={OPTIONS} searchable />);

    fireEvent.click(screen.getByRole('button', { name: /computer science/i }));
    const panel = screen.getByRole('listbox');

    fireEvent.change(within(panel).getByPlaceholderText('Filter...'), { target: { value: 'zzz' } });

    expect(within(panel).getByText(/no matching options/i)).toBeInTheDocument();
  });

  test('does not open while disabled', () => {
    render(<CustomDropdown value="cs" onChange={() => {}} options={OPTIONS} disabled />);

    const trigger = screen.getByRole('button', { name: /computer science/i });
    expect(trigger).toBeDisabled();

    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  test('closes the panel on Escape and on an outside click', () => {
    render(
      <div>
        <CustomDropdown value="cs" onChange={() => {}} options={OPTIONS} />
        <button type="button">outside</button>
      </div>
    );

    const trigger = screen.getByRole('button', { name: /computer science/i });

    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: /outside/i }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  // The visual layer is presentational: a labelled native <select> stays mounted as the
  // value/semantics source so form flows, label lookups and option queries keep working.
  test('keeps a labelled native select in sync for form flows', () => {
    const onChange = vi.fn();
    render(
      <CustomDropdown id="program" ariaLabel="Program" value="cs" onChange={onChange} options={OPTIONS} />
    );

    const native = screen.getByLabelText('Program') as HTMLSelectElement;
    expect(native.tagName).toBe('SELECT');
    expect(native.value).toBe('cs');

    fireEvent.change(native, { target: { value: 'it' } });
    expect(onChange).toHaveBeenCalledWith('it');

    // Options stay queryable by role, exactly like a plain <select>.
    expect(screen.getByRole('option', { name: 'Information Technology' })).toBeInTheDocument();
  });

  test('renders a compact trigger for dense layouts', () => {
    render(<CustomDropdown value="cs" onChange={() => {}} options={OPTIONS} variant="compact" />);

    const trigger = screen.getByRole('button', { name: /computer science/i });
    expect(trigger.className).toContain('text-[11px]');
  });

  test('portals the panel out of clipping containers', () => {
    render(
      <div data-testid="clipping-card" style={{ overflow: 'hidden' }}>
        <CustomDropdown value="cs" onChange={() => {}} options={OPTIONS} />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: /computer science/i }));

    // The panel must escape the card: otherwise `overflow-hidden` cuts it off.
    const panel = screen.getByRole('listbox');
    expect(screen.getByTestId('clipping-card')).not.toContainElement(panel);
    expect(panel.parentElement).toBe(document.body);
  });

  test('reports blur only when focus leaves the whole control', () => {
    const onBlur = vi.fn();
    render(
      <div>
        <CustomDropdown value="cs" onChange={() => {}} options={OPTIONS} onBlur={onBlur} />
        <button type="button">after</button>
      </div>
    );

    const trigger = screen.getByRole('button', { name: /computer science/i });

    // Moving focus into the panel is still inside the control.
    fireEvent.click(trigger);
    const option = within(screen.getByRole('listbox')).getByRole('option', {
      name: /information technology/i,
    });
    fireEvent.blur(trigger, { relatedTarget: option });
    expect(onBlur).not.toHaveBeenCalled();

    // Leaving the control reports blur once.
    fireEvent.blur(trigger, { relatedTarget: screen.getByRole('button', { name: /after/i }) });
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test('does not report blur when opening a searchable panel, even though its search box auto-focuses', () => {
    const onBlur = vi.fn();
    render(<CustomDropdown value="" onChange={() => {}} options={OPTIONS} onBlur={onBlur} searchable placeholder="Select College" />);

    const trigger = screen.getByRole('button', { name: /select college/i });
    trigger.focus();
    fireEvent.click(trigger);

    // The panel's search input steals focus on mount; that is an internal move, not a blur.
    expect(document.activeElement).toBe(screen.getByPlaceholderText('Filter...'));
    expect(onBlur).not.toHaveBeenCalled();
  });

  test('reports blur when tabbing away from a closed dropdown', () => {
    const onBlur = vi.fn();
    render(
      <div>
        <CustomDropdown value="cs" onChange={() => {}} options={OPTIONS} onBlur={onBlur} />
        <button type="button">after</button>
      </div>
    );

    const trigger = screen.getByRole('button', { name: /computer science/i });
    trigger.focus();
    // Never opened: the panel is unmounted, so its ref is null here too.
    fireEvent.blur(trigger, { relatedTarget: screen.getByRole('button', { name: /after/i }) });

    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  test('reports blur once focus genuinely leaves a searchable panel', () => {
    const onBlur = vi.fn();
    render(
      <div>
        <CustomDropdown value="" onChange={() => {}} options={OPTIONS} onBlur={onBlur} searchable placeholder="Select College" />
        <button type="button">after</button>
      </div>
    );

    const trigger = screen.getByRole('button', { name: /select college/i });
    trigger.focus();
    fireEvent.click(trigger);
    expect(onBlur).not.toHaveBeenCalled();

    fireEvent.blur(screen.getByPlaceholderText('Filter...'), {
      relatedTarget: screen.getByRole('button', { name: /after/i }),
    });
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
