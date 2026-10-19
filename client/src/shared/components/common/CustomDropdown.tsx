import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search } from 'lucide-react';

export interface DropdownOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  /** Shown when no option matches `value` (e.g. "Select Program", "All School Years"). */
  placeholder?: string;
  /** Leading icon for the trigger; falls back to the selected option's icon. */
  icon?: React.ReactNode;
  id?: string;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  searchable?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Fires when focus leaves the whole control (trigger + panel), not on internal moves. */
  onBlur?: () => void;
  /** `compact` trims padding/type for dense layouts such as table cells and grids. */
  variant?: 'default' | 'compact';
  className?: string;
  buttonClassName?: string;
  /** Sets `data-testid` on the native select; the trigger gets `<testId>-trigger`. */
  testId?: string;
}

const TRIGGER_BASE =
  'w-full flex items-center justify-between gap-2 bg-background border text-foreground font-sans transition-all cursor-pointer';

const TRIGGER_SIZES: Record<'default' | 'compact', string> = {
  default: 'p-2.5 rounded-xl text-xs',
  compact: 'px-2 py-1 rounded-lg text-[11px]',
};

const ROW_BASE = 'w-full flex items-center justify-between gap-2 rounded-lg text-left transition-colors cursor-pointer';

const ROW_SIZES: Record<'default' | 'compact', string> = {
  default: 'px-3 py-2 text-xs',
  compact: 'px-2 py-1.5 text-[11px]',
};

const PANEL_MAX_WIDTH: Record<'default' | 'compact', number> = {
  default: 288,
  compact: 192,
};

/**
 * The app-wide dropdown: one trigger chrome and one option panel everywhere.
 *
 * A labelled native `<select>` stays mounted (visually hidden) as the value and
 * semantics source, so `<label htmlFor>`, form flows, screen readers and option
 * queries all behave exactly like a plain select. The visible trigger and panel
 * mirror that state for presentation.
 *
 * The panel is portalled to `document.body` with fixed positioning: cards, table
 * wrappers and accordions in this app clip overflow, which used to cut the panel
 * off at the container border.
 */
export const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  icon,
  id,
  ariaLabel,
  ariaDescribedBy,
  searchable = false,
  disabled = false,
  invalid = false,
  onBlur,
  variant = 'default',
  className = '',
  buttonClassName = '',
  testId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // A stale query from a previous open would hide the options again.
  useEffect(() => {
    if (!isOpen) setSearch('');
  }, [isOpen]);

  // `autoFocus` moves focus during React's commit, before `panelRef` is attached, so the
  // trigger's blur handler cannot yet see that focus stayed inside the control and would
  // report a blur the user never made. Focusing after mount keeps refs in place first.
  useEffect(() => {
    if (!isOpen || !searchable) return;
    searchRef.current?.focus();
  }, [isOpen, searchable]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    const position = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const estimatedHeight = 260;
      const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow;

      setPanelStyle({
        position: 'fixed',
        left: rect.left,
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
        minWidth: rect.width,
        maxWidth: Math.max(160, Math.min(PANEL_MAX_WIDTH[variant], window.innerWidth - rect.left - 8)),
        zIndex: 120,
      });
    };

    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [isOpen, variant]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen]);

  const validOptions = options.filter(
    o => o && typeof o.label === 'string' && o.label.trim().length > 0 && typeof o.value === 'string'
  );
  const selectedOption = validOptions.find(o => o.value === value);
  const query = search.trim().toLowerCase();
  const visibleOptions = searchable && query ? validOptions.filter(o => o.label.toLowerCase().includes(query)) : validOptions;

  const triggerTone = invalid
    ? 'border-destructive focus:ring-2 focus:ring-destructive/30'
    : isOpen
      ? 'border-primary ring-2 ring-primary/20'
      : 'border-border hover:border-primary/50';

  const panel = isOpen ? (
    <div
      ref={panelRef}
      role="listbox"
      aria-label={ariaLabel}
      style={panelStyle}
      className="bg-card border border-border rounded-xl shadow-elevated overflow-hidden"
    >
      {searchable && (
        <div className="p-2 border-b border-border bg-muted/30">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-2.5 top-2.5" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter..."
              className="w-full pl-8 pr-3 py-1.5 bg-background border border-border rounded-lg text-xs font-sans text-foreground outline-none focus:ring-1 focus:ring-primary/40"
            />
          </div>
        </div>
      )}

      <div className="max-h-56 overflow-y-auto p-1 space-y-0.5 custom-scrollbar">
        {visibleOptions.length === 0 ? (
          <div className="p-3 text-center text-xs text-muted-foreground font-sans">No matching options</div>
        ) : (
          visibleOptions.map(opt => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={opt.disabled}
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`${ROW_BASE} ${ROW_SIZES[variant]} ${
                  isSelected
                    ? 'bg-primary text-primary-foreground font-bold'
                    : 'text-foreground hover:bg-primary/10 hover:text-primary font-medium'
                } ${opt.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span className="flex items-center gap-2 truncate">
                  {opt.icon && <span className="shrink-0">{opt.icon}</span>}
                  <span className="truncate">{opt.label}</span>
                </span>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  ) : null;

  const handleBlur = (e: React.FocusEvent) => {
    if (!onBlur) return;
    const next = e.relatedTarget as Node | null;
    if (next && (wrapRef.current?.contains(next) || panelRef.current?.contains(next))) return;
    onBlur();
  };

  return (
    <div
      className={`relative ${className}`}
      ref={wrapRef}
      onBlur={handleBlur}
    >
      {/* Value + semantics layer: never remove, existing form flows and label lookups depend on it. */}
      <select
        id={id}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        aria-invalid={invalid || undefined}
        value={value}
        onChange={e => onChange(e.target.value)}
        disabled={disabled}
        tabIndex={-1}
        className="sr-only"
        data-testid={testId}
      >
        {validOptions.map(opt => (
          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
            {opt.label}
          </option>
        ))}
      </select>

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => setIsOpen(prev => !prev)}
        onBlur={e => {
          e.stopPropagation();
          handleBlur(e);
        }}
        data-testid={testId ? `${testId}-trigger` : undefined}
        className={`${TRIGGER_BASE} ${TRIGGER_SIZES[variant]} ${triggerTone} ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${buttonClassName}`}
      >
        <span className="flex items-center gap-2 truncate">
          {selectedOption?.icon || icon ? <span className="shrink-0">{selectedOption?.icon || icon}</span> : null}
          <span className="truncate font-medium">{selectedOption ? selectedOption.label : placeholder}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 shrink-0 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </div>
  );
};

export default CustomDropdown;
