import React, { useState, useEffect } from 'react';
import { X, Calendar, MapPin, Trash2, Check } from 'lucide-react';
import type { CalendarEvent, Course } from '../../types/lms';
import { ModalPortal, useModalAnimate } from '../common/ModalPortal';

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateOnlyValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const PRESET_COLORS = [
  { label: 'Cellwego Blue', hex: '#2563eb' },
  { label: 'Emerald Green', hex: '#059669' },
  { label: 'Amber Gold', hex: '#d97706' },
  { label: 'Purple Violet', hex: '#7c3aed' },
  { label: 'Rose Pink', hex: '#be185d' },
  { label: 'Slate Zinc', hex: '#475569' }
];

interface CalendarEventFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (event: Omit<CalendarEvent, 'id'>, id?: string) => void;
  onDelete?: (id: string) => void;
  courses: Course[];
  anchorDate: Date | null;
  initialEvent?: CalendarEvent | null;
}

export const CalendarEventFormDialog: React.FC<CalendarEventFormDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  onDelete,
  courses,
  anchorDate,
  initialEvent
}) => {
  const isEditing = !!initialEvent?.id;
  const { isClosing, startClose } = useModalAnimate(onClose, 200);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [courseId, setCourseId] = useState<string>('');
  const [eventType, setEventType] = useState<'assignment' | 'milestone' | 'advising' | 'lecture' | 'exam' | 'event'>('event');
  const [isAllDay, setIsAllDay] = useState(false);
  const [startDateStr, setStartDateStr] = useState('');
  const [endDateStr, setEndDateStr] = useState('');
  const [location, setLocation] = useState('');
  const [colorHex, setColorHex] = useState('#be185d');

  useEffect(() => {
    if (!isOpen) return;

    if (initialEvent) {
      setTitle(initialEvent.title || '');
      setDescription(initialEvent.description || '');
      setCourseId(initialEvent.courseId || '');
      setEventType(initialEvent.type || 'event');
      setIsAllDay(initialEvent.isAllDay ?? false);
      setLocation(initialEvent.location || '');
      setColorHex(initialEvent.colorHex || '#be185d');

      const start = initialEvent.startAt
        ? new Date(initialEvent.startAt)
        : new Date(initialEvent.date + 'T09:00:00');
      const end = initialEvent.endAt
        ? new Date(initialEvent.endAt)
        : new Date(initialEvent.date + 'T10:00:00');

      if (initialEvent.isAllDay) {
        setStartDateStr(toDateOnlyValue(start));
        setEndDateStr(toDateOnlyValue(end));
      } else {
        setStartDateStr(toDatetimeLocalValue(start));
        setEndDateStr(toDatetimeLocalValue(end));
      }
    } else {
      const base = anchorDate ? new Date(anchorDate) : new Date();
      base.setHours(9, 0, 0, 0);
      const end = new Date(base);
      end.setHours(10, 0, 0, 0);

      setTitle('');
      setDescription('');
      setCourseId('');
      setEventType('event');
      setIsAllDay(false);
      setLocation('');
      setColorHex('#be185d');
      setStartDateStr(toDatetimeLocalValue(base));
      setEndDateStr(toDatetimeLocalValue(end));
    }
  }, [isOpen, initialEvent, anchorDate]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    let startIso = '';
    let endIso = '';
    let dateOnly = '';
    let timeFormatted = '';

    if (isAllDay) {
      const parts = startDateStr.split('-').map(Number);
      const s = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
      const endParts = (endDateStr || startDateStr).split('-').map(Number);
      const e = new Date(endParts[0], endParts[1] - 1, endParts[2], 23, 59, 59);

      startIso = s.toISOString();
      endIso = e.toISOString();
      dateOnly = startDateStr;
      timeFormatted = 'All Day';
    } else {
      const s = new Date(startDateStr);
      const e = new Date(endDateStr);

      startIso = s.toISOString();
      endIso = e.toISOString();
      dateOnly = toDateOnlyValue(s);
      timeFormatted = `${s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    const matchedCourse = courses.find(c => c.id === courseId);

    const payload: Omit<CalendarEvent, 'id'> = {
      title: title.trim(),
      description: description.trim(),
      date: dateOnly,
      time: timeFormatted,
      courseId: courseId || undefined,
      courseCode: matchedCourse?.code,
      type: eventType,
      isAllDay,
      startAt: startIso,
      endAt: endIso,
      colorHex: matchedCourse?.color || colorHex,
      location: location.trim() || undefined
    };

    startClose(() => {
      onSubmit(payload, initialEvent?.id);
    });
  };

  const handleDelete = () => {
    if (initialEvent && onDelete) {
      startClose(() => {
        onDelete(initialEvent.id);
      });
    }
  };

  return (
    <ModalPortal>
      <div
        className={`fixed inset-0 z-[100] flex items-center justify-center p-4 overlay-backdrop ${
          isClosing ? 'animate-fade-out' : 'animate-fade-in'
        }`}
        onClick={() => startClose()}
      >
        <div
          className={`w-full max-w-lg bg-card border border-border rounded-2xl shadow-elevated overflow-hidden ${
            isClosing ? 'animate-scale-out' : 'animate-scale-in'
          }`}
          onClick={e => e.stopPropagation()}
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/40">
            <div className="flex items-center space-x-2.5">
              <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
                <Calendar className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {isEditing ? 'Edit Scheduled Event' : 'Schedule New Event'}
                </h2>
                <p className="text-[11px] font-sans text-muted-foreground">
                  Cell We Go Interactive Calendar Engine
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => startClose()}
              className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            {/* Title */}
            <div>
              <label className="block font-bold text-foreground mb-1">
                Event Title *
              </label>
              <input
                type="text"
                required
                autoFocus
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Lab 3 Submission, Faculty Advising, Midterm Exam"
                className="w-full p-2.5 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground text-xs shadow-inner font-sans"
              />
            </div>

            {/* Event Category / Course Assignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-foreground mb-1">
                  Course Attachment
                </label>
                <select
                  value={courseId}
                  onChange={e => {
                    const val = e.target.value;
                    setCourseId(val);
                    const c = courses.find(item => item.id === val);
                    if (c?.color) setColorHex(c.color);
                  }}
                  className="w-full p-2.5 bg-background border border-border hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl text-foreground text-xs font-sans font-medium outline-none shadow-subtle cursor-pointer transition-all"
                >
                  <option value="">General / Institutional Milestone</option>
                  {courses.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code} ({c.section})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">
                  Event Type
                </label>
                <select
                  value={eventType}
                  onChange={e => setEventType(e.target.value as any)}
                  className="w-full p-2.5 bg-background border border-border hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl text-foreground text-xs font-sans font-medium outline-none shadow-subtle cursor-pointer transition-all"
                >
                  <option value="event">General Event</option>
                  <option value="assignment">Assignment Deadline</option>
                  <option value="milestone">Curriculum Milestone</option>
                  <option value="advising">Academic Advising / Office Hours</option>
                  <option value="lecture">Lecture / Class Session</option>
                  <option value="exam">Quiz / Major Examination</option>
                </select>
              </div>
            </div>

            {/* All Day Switch */}
            <div className="flex items-center space-x-2 py-1">
              <input
                type="checkbox"
                id="isAllDayCheckbox"
                checked={isAllDay}
                onChange={e => {
                  const checked = e.target.checked;
                  setIsAllDay(checked);
                  if (checked) {
                    setStartDateStr(startDateStr.split('T')[0] || toDateOnlyValue(new Date()));
                    setEndDateStr(endDateStr.split('T')[0] || toDateOnlyValue(new Date()));
                  } else {
                    const base = anchorDate ? new Date(anchorDate) : new Date();
                    base.setHours(9, 0, 0, 0);
                    const end = new Date(base);
                    end.setHours(10, 0, 0, 0);
                    setStartDateStr(toDatetimeLocalValue(base));
                    setEndDateStr(toDatetimeLocalValue(end));
                  }
                }}
                className="w-4 h-4 accent-primary rounded cursor-pointer"
              />
              <label htmlFor="isAllDayCheckbox" className="font-semibold text-foreground cursor-pointer select-none">
                All Day Event
              </label>
            </div>

            {/* Date & Time Pickers */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-foreground mb-1">
                  Start {isAllDay ? 'Date' : 'Time'}
                </label>
                <input
                  type={isAllDay ? 'date' : 'datetime-local'}
                  required
                  value={startDateStr}
                  onChange={e => setStartDateStr(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground text-xs font-sans"
                />
              </div>
              <div>
                <label className="block font-bold text-foreground mb-1">
                  End {isAllDay ? 'Date' : 'Time'}
                </label>
                <input
                  type={isAllDay ? 'date' : 'datetime-local'}
                  required
                  value={endDateStr}
                  onChange={e => setEndDateStr(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground text-xs font-sans"
                />
              </div>
            </div>

            {/* Location / Meeting Link */}
            <div>
              <label className="block font-bold text-foreground mb-1">
                Location / Video Link (Optional)
              </label>
              <div className="relative">
                <MapPin className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-3" />
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. SLUC CS Lab 304, Zoom Meeting Link"
                  className="w-full pl-9 pr-3 py-2 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground text-xs"
                />
              </div>
            </div>

            {/* Color Swatch Picker */}
            <div>
              <label className="block font-bold text-foreground mb-1">
                Event Badge Color
              </label>
              <div className="flex items-center space-x-2.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => setColorHex(c.hex)}
                    title={c.label}
                    className="w-6 h-6 rounded-full flex items-center justify-center transition-transform hover:scale-110 shadow-soft cursor-pointer"
                    style={{ backgroundColor: c.hex }}
                  >
                    {colorHex.toLowerCase() === c.hex.toLowerCase() && (
                      <Check className="w-3.5 h-3.5 text-white" />
                    )}
                  </button>
                ))}
                <input
                  type="color"
                  value={colorHex}
                  onChange={e => setColorHex(e.target.value)}
                  className="w-6 h-6 p-0 border-0 rounded cursor-pointer"
                  title="Custom color"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block font-bold text-foreground mb-1">
                Description / Notes
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Add agenda, assignment instructions, or advising notes..."
                className="w-full p-2.5 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground text-xs font-sans"
              />
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-border flex items-center justify-between">
              {isEditing && onDelete ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-500/10 rounded-xl transition-all flex items-center space-x-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Event</span>
                </button>
              ) : <div />}

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => startClose()}
                  className="px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-primary-sm cursor-pointer"
                >
                  {isEditing ? 'Save Changes' : 'Schedule Event'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </ModalPortal>
  );
};
