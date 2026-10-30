import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, X, ChevronDown, Check } from 'lucide-react';

export interface TimeRangePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  /** When true, provides day pill selection (M, T, W, Th, F, S) within the picker */
  includeDays?: boolean;
}

const DAY_OPTIONS = ['M', 'T', 'W', 'Th', 'F', 'S'];

function minutesToTime(totalMinutes: number): string {
  const hours24 = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const meridiem = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')} ${meridiem}`;
}

function timeToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;
  let [, hStr, mStr, meridiem] = match;
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (meridiem) {
    const isPM = meridiem.toLowerCase() === 'pm';
    if (isPM && h < 12) h += 12;
    if (!isPM && h === 12) h = 0;
  }
  return h * 60 + m;
}

function normalizeTime(t: string): string {
  const mins = timeToMinutes(t);
  if (mins === null) return t.trim();
  return minutesToTime(mins);
}

function parseRange(str: string): { start: string; end: string; days: string[] } {
  if (!str) return { start: '', end: '', days: [] };
  // Check for days (e.g. MF, MWF, TTh, Th, etc.)
  const dayMatches = str.match(/\b(M|T|W|Th|F|S)+\b/g);
  let days: string[] = [];
  if (dayMatches && dayMatches.length > 0) {
    const rawDays = dayMatches.join('');
    days = DAY_OPTIONS.filter(d => rawDays.includes(d));
  }
  // Strip out known days to isolate time
  const cleanStr = str.replace(/\b(M|T|W|Th|F|S)+\b/g, '').trim();
  const parts = cleanStr.split(/[-–—/]/).map(s => s.trim()).filter(Boolean);
  return {
    start: parts[0] ? normalizeTime(parts[0]) : '',
    end: parts[1] ? normalizeTime(parts[1]) : '',
    days,
  };
}

function getDurationLabel(startStr: string, endStr: string): string | null {
  const startMins = timeToMinutes(startStr);
  const endMins = timeToMinutes(endStr);
  if (startMins === null || endMins === null || endMins <= startMins) return null;
  const diff = endMins - startMins;
  const hrs = Math.floor(diff / 60);
  const mins = diff % 60;
  const parts = [];
  if (hrs > 0) parts.push(`${hrs}h`);
  if (mins > 0) parts.push(`${mins}m`);
  return parts.join(' ');
}

export const TimeRangePicker: React.FC<TimeRangePickerProps> = ({
  value,
  onChange,
  placeholder = 'Select time range',
  disabled = false,
  className = '',
  id,
  includeDays = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [interval, setInterval] = useState<30 | 15>(30);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const parsed = parseRange(value);
  const [start, setStart] = useState(parsed.start);
  const [end, setEnd] = useState(parsed.end);
  const [days, setDays] = useState<string[]>(parsed.days);

  // Sync internal state when external value changes while closed
  useEffect(() => {
    if (!isOpen) {
      const p = parseRange(value);
      setStart(p.start);
      setEnd(p.end);
      setDays(p.days);
    }
  }, [value, isOpen]);

  // Generate slots from 07:00 AM (420 min) to 09:00 PM (1260 min)
  const timeSlots: string[] = [];
  for (let m = 420; m <= 1260; m += interval) {
    timeSlots.push(minutesToTime(m));
  }

  // Position portal dropdown
  useLayoutEffect(() => {
    if (!isOpen) return;

    const position = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const estimatedHeight = 350;
      const openUp = spaceBelow < estimatedHeight && rect.top > spaceBelow;

      const panelWidth = 340;
      let left = rect.left;
      if (left + panelWidth > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - panelWidth - 8);
      }

      setPanelStyle({
        position: 'fixed',
        left,
        top: openUp ? undefined : rect.bottom + 4,
        bottom: openUp ? window.innerHeight - rect.top + 4 : undefined,
        width: panelWidth,
        zIndex: 150,
      });
    };

    position();
    window.addEventListener('resize', position);
    window.addEventListener('scroll', position, true);
    return () => {
      window.removeEventListener('resize', position);
      window.removeEventListener('scroll', position, true);
    };
  }, [isOpen]);

  // Click outside & Escape handling
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

  const commitValue = (newStart: string, newEnd: string, newDays: string[]) => {
    // Only a complete range is committed: start, end, and (when applicable) days.
    if (!newStart || !newEnd || (includeDays && newDays.length === 0)) {
      onChange('');
      return;
    }
    const daysPart = includeDays ? ` ${newDays.join('')}` : '';
    onChange(`${newStart} – ${newEnd}${daysPart}`);
  };

  const handleSelectStart = (t: string) => {
    setStart(t);
    // If end is currently before new start, bump or clear end
    const startMins = timeToMinutes(t);
    const endMins = timeToMinutes(end);
    let nextEnd = end;
    if (startMins !== null && endMins !== null && endMins <= startMins) {
      // Auto-set end time to 1 hour after start time
      const autoEndMins = Math.min(1260, startMins + 60);
      nextEnd = minutesToTime(autoEndMins);
      setEnd(nextEnd);
    }
    commitValue(t, nextEnd, days);
  };

  const handleSelectEnd = (t: string) => {
    setEnd(t);
    commitValue(start, t, days);
  };

  const handleToggleDay = (day: string) => {
    const nextDays = days.includes(day) ? days.filter(d => d !== day) : [...days, day];
    setDays(nextDays);
    commitValue(start, end, nextDays);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setStart('');
    setEnd('');
    setDays([]);
    onChange('');
  };

  const duration = getDurationLabel(start, end);
  // A range needs both ends; class schedules also need their meeting days.
  const missingTime = Boolean(start) !== Boolean(end);
  const missingDays = includeDays && (Boolean(start) || Boolean(end)) && days.length === 0;
  const validationMessage = missingTime
    ? 'Select a start and end time.'
    : missingDays
    ? 'Select at least one day.'
    : '';

  return (
    <div ref={wrapRef} className={`relative w-full ${className}`}>
      {/* Trigger Button */}
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(prev => !prev)}
        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-xs rounded-lg border bg-background text-left transition-colors cursor-pointer select-none ${
          disabled
            ? 'bg-muted/50 text-muted-foreground border-border cursor-not-allowed'
            : isOpen
            ? 'border-primary ring-1 ring-primary/30 text-foreground'
            : 'border-border text-foreground hover:border-border/90 hover:bg-muted/30'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <Clock className={`w-3.5 h-3.5 shrink-0 ${value ? 'text-primary' : 'text-muted-foreground'}`} />
          <span className={`truncate font-medium ${!value ? 'text-muted-foreground font-normal' : 'text-foreground'}`}>
            {value || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={e => e.key === 'Enter' && handleClear()}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
              title="Clear time"
            >
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {/* Popover Interface */}
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            className="rounded-xl border border-border bg-card shadow-2xl p-3 text-card-foreground flex flex-col gap-2.5 font-sans animate-in fade-in zoom-in-95 duration-100"
          >
            {/* Header: Selected Range Display & Interval toggle */}
            <div className="flex items-center justify-between border-b border-border/70 pb-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold">
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${start ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground'}`}>
                  {start || 'Start'}
                </span>
                <span className="text-muted-foreground text-[10px]">➔</span>
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${end ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-muted text-muted-foreground'}`}>
                  {end || 'End'}
                </span>
                {duration && (
                  <span className="text-[10px] text-muted-foreground font-normal">
                    ({duration})
                  </span>
                )}
              </div>

              {/* Interval Toggle */}
              <div className="flex items-center rounded-md border border-border p-0.5 bg-muted/40 text-[10px]">
                <button
                  type="button"
                  onClick={() => setInterval(30)}
                  className={`px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                    interval === 30 ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  30m
                </button>
                <button
                  type="button"
                  onClick={() => setInterval(15)}
                  className={`px-1.5 py-0.5 rounded font-medium transition-colors cursor-pointer ${
                    interval === 15 ? 'bg-background text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  15m
                </button>
              </div>
            </div>

            {/* Optional Days Row (for Lecture/Lab schedules) */}
            {includeDays && (
              <div className="space-y-1 pt-1 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
                    Days: <span className="text-destructive">*</span>
                  </span>
                  <div className="flex gap-1" role="group" aria-label="Required meeting days" aria-required="true">
                    {DAY_OPTIONS.map(d => {
                      const active = days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={active}
                          onClick={() => handleToggleDay(d)}
                          className={`w-6 h-6 text-[10px] font-bold rounded border transition-colors cursor-pointer flex items-center justify-center ${
                            active
                              ? 'bg-primary text-primary-foreground border-primary'
                              : missingDays
                              ? 'bg-muted/40 text-muted-foreground border-destructive/50 hover:bg-muted'
                              : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                          }`}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}

            {/* Two Columns: Start Time & End Time */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/70">
              {/* Start Column */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block px-1">
                  Start Time
                </span>
                <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
                  {timeSlots.map(t => {
                    const isSelected = start === t;
                    return (
                      <button
                        key={`start-${t}`}
                        type="button"
                        onClick={() => handleSelectStart(t)}
                        className={`w-full text-left px-2 py-1 text-xs rounded-md transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                            : 'text-foreground hover:bg-muted/70'
                        }`}
                      >
                        <span>{t}</span>
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* End Column */}
              <div className="space-y-1 border-l border-border/70 pl-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block px-1">
                  End Time
                </span>
                <div className="max-h-44 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
                  {timeSlots.map(t => {
                    const isSelected = end === t;
                    const startMins = timeToMinutes(start);
                    const slotMins = timeToMinutes(t);
                    const isBeforeStart = startMins !== null && slotMins !== null && slotMins <= startMins;

                    return (
                      <button
                        key={`end-${t}`}
                        type="button"
                        onClick={() => handleSelectEnd(t)}
                        className={`w-full text-left px-2 py-1 text-xs rounded-md transition-colors flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                            : isBeforeStart
                            ? 'text-muted-foreground/50 hover:bg-muted/40 text-[11px]'
                            : 'text-foreground hover:bg-muted/70'
                        }`}
                      >
                        <span>{t}</span>
                        {isSelected && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {validationMessage && (
              <p className="text-[10px] font-medium text-destructive" role="alert">
                {validationMessage}
              </p>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-border/70">
              <button
                type="button"
                onClick={handleClear}
                className="text-[11px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer px-1.5 py-0.5 rounded"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={Boolean(validationMessage)}
                title={validationMessage || undefined}
                className="px-3 py-1 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:bg-primary/90 transition-colors cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Done
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};

