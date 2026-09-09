import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useLMS } from '../context/LMSContext';
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  UserCheck,
  CheckCircle2,
  Filter,
  MapPin,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Check,
  X
} from 'lucide-react';
import type { CalendarEvent } from '../types/lms';
import { CalendarEventFormDialog } from '../components/calendar/CalendarEventFormDialog';
import { AnimatedModal } from '../components/common/ModalPortal';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const CalendarPage: React.FC = () => {
  const {
    activeRole,
    db,
    bookAdvisingSlot,
    createAdvisingSlot,
    addCalendarEvent,
    updateCalendarEvent,
    deleteCalendarEvent,
    showAlert,
    showConfirm
  } = useLMS();

  // Cell We Go Month Cursor
  const [cursor, setCursor] = useState<Date>(() => startOfMonth(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());

  // Filters
  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  // Dialog states
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [anchorDate, setAnchorDate] = useState<Date | null>(null);

  // Advising office hours modal
  const [showAdvisingModal, setShowAdvisingModal] = useState(false);
  const [advisingDate, setAdvisingDate] = useState(() => dayKey(new Date()));
  const [advisingTime, setAdvisingTime] = useState('10:00 AM - 10:30 AM');
  const [advisingLocation, setAdvisingLocation] = useState('CS Faculty Office / Zoom');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const today = useMemo(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
  }, []);

  // Compute month layout grid
  const { label, weeks } = useMemo(() => {
    const first = startOfMonth(cursor);
    const year = first.getFullYear();
    const month = first.getMonth();
    const lastDay = new Date(year, month + 1, 0);
    const startPad = first.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startPad; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(year, month, d));
    }
    while (days.length % 7 !== 0) days.push(null);

    const weekRows: (Date | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      weekRows.push(days.slice(i, i + 7));
    }

    const monthLabel = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    return {
      label: monthLabel,
      weeks: weekRows
    };
  }, [cursor]);

  // Filter events by course
  const filteredEvents = useMemo(() => {
    return db.calendarEvents.filter(evt => {
      if (selectedCourseFilter === 'all') return true;
      return evt.courseId === selectedCourseFilter;
    });
  }, [db.calendarEvents, selectedCourseFilter]);

  // Map events to date keys (supporting both date strings and startAt/endAt)
  const dayEventsMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const ev of filteredEvents) {
      if (ev.startAt && ev.endAt) {
        const es = new Date(ev.startAt);
        const ee = new Date(ev.endAt);
        const s = new Date(es.getFullYear(), es.getMonth(), es.getDate());
        const e = new Date(ee.getFullYear(), ee.getMonth(), ee.getDate());
        const cur = new Date(s);
        while (cur <= e) {
          const k = dayKey(cur);
          const list = map.get(k) || [];
          list.push(ev);
          map.set(k, list);
          cur.setDate(cur.getDate() + 1);
        }
      } else if (ev.date) {
        const k = ev.date;
        const list = map.get(k) || [];
        list.push(ev);
        map.set(k, list);
      }
    }

    return map;
  }, [filteredEvents]);

  // Selected day events & advising slots
  const selectedDayKey = dayKey(selectedDay);
  const selectedDayEvents = dayEventsMap.get(selectedDayKey) || [];

  const selectedDayAdvisingSlots = useMemo(() => {
    return db.advisingSlots.filter(s => s.date === selectedDayKey);
  }, [db.advisingSlots, selectedDayKey]);

  // Event actions
  const openAddEvent = (d: Date) => {
    setEditingEvent(null);
    setAnchorDate(d);
    setEventDialogOpen(true);
  };

  const openEditEvent = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setAnchorDate(new Date(ev.startAt || ev.date));
    setEventDialogOpen(true);
  };

  const handleSaveEvent = (payload: Omit<CalendarEvent, 'id'>, existingId?: string) => {
    if (existingId) {
      updateCalendarEvent(existingId, payload);
      showAlert({
        title: 'Event Updated',
        message: `"${payload.title}" has been updated.`,
        type: 'success'
      });
    } else {
      addCalendarEvent(payload);
      showAlert({
        title: 'Event Scheduled',
        message: `"${payload.title}" has been added to your schedule.`,
        type: 'success'
      });
    }
  };

  const handleDeleteEvent = (id: string) => {
    showConfirm(
      'Are you sure you want to remove this event from the calendar?',
      () => {
        deleteCalendarEvent(id);
        showAlert({
          title: 'Event Removed',
          message: 'The event has been deleted from your schedule.',
          type: 'info'
        });
      },
      'Delete Scheduled Event'
    );
  };

  const handleCreateAdvising = (e: React.FormEvent) => {
    e.preventDefault();
    createAdvisingSlot(advisingDate, advisingTime, advisingLocation);
    setShowAdvisingModal(false);
    showAlert({
      title: 'Advising Slot Created',
      message: `Office hours slot published for ${advisingDate}.`,
      type: 'success'
    });
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto animate-fade-in pb-12">
      {/* Cell We Go Style Header & Toolbar Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between pb-3 border-b border-border gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-soft">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <span>Academic Calendar & Scheduler</span>
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Course milestones, assignment deadlines, lectures, and faculty advising office hours.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Course Filter Dropdown */}
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`px-3.5 py-2 bg-card/90 hover:bg-card border rounded-xl text-xs font-sans font-semibold text-foreground flex items-center space-x-2 shadow-subtle transition-all cursor-pointer group ${
                isFilterOpen
                  ? 'border-primary ring-2 ring-primary/20 shadow-primary-sm text-primary'
                  : 'border-border/80 hover:border-primary/40'
              }`}
            >
              <Filter className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="truncate max-w-[130px] sm:max-w-[180px]">
                {selectedCourseFilter === 'all'
                  ? 'All Courses & Milestones'
                  : db.courses.find(c => c.id === selectedCourseFilter)?.code || selectedCourseFilter}
              </span>
              <div className={`w-4 h-4 rounded-md flex items-center justify-center transition-colors shrink-0 ml-0.5 ${
                isFilterOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground group-hover:text-foreground'
              }`}>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${
                    isFilterOpen ? 'rotate-180 text-primary' : 'rotate-0'
                  }`}
                />
              </div>
            </button>

            {isFilterOpen && (
              <div className="absolute left-0 sm:right-0 sm:left-auto mt-2 w-64 dropdown-panel p-2 z-50 animate-dropdown">
                <div className="px-2.5 py-1.5 flex items-center justify-between border-b border-border/60 mb-1.5">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground">
                    Filter Events
                  </span>
                  <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                    {db.courses.length + 1} options
                  </span>
                </div>

                <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar pr-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCourseFilter('all');
                      setIsFilterOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-sans transition-all text-left cursor-pointer group ${
                      selectedCourseFilter === 'all'
                        ? 'bg-primary/15 text-primary font-bold border border-primary/30 shadow-xs'
                        : 'text-foreground hover:bg-muted/80 hover:translate-x-0.5 font-medium'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0 ring-2 ring-background shadow-xs" />
                      <span className="font-sans font-semibold">All Courses & Milestones</span>
                    </div>
                    {selectedCourseFilter === 'all' && (
                      <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 ml-1.5">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>

                  {db.courses.map(c => {
                    const isSelected = selectedCourseFilter === c.id;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCourseFilter(c.id);
                          setIsFilterOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-sans transition-all text-left cursor-pointer group ${
                          isSelected
                            ? 'bg-primary/15 text-primary font-bold border border-primary/30 shadow-xs'
                            : 'text-foreground hover:bg-muted/80 hover:translate-x-0.5 font-medium'
                        }`}
                      >
                        <div className="flex items-center space-x-2.5 truncate min-w-0">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 transition-transform ${isSelected ? 'ring-2 ring-primary/40 scale-110' : 'group-hover:scale-125'}`}
                            style={{ backgroundColor: c.color || '#64748b' }}
                          />
                          <div className="truncate">
                            <span className="font-sans font-bold block truncate">{c.code}</span>
                            <span className="text-[10px] text-muted-foreground block truncate font-normal">{c.section} • {c.title}</span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary shrink-0 ml-1.5">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Cell We Go Month Navigator Pill */}
          <div className="flex items-center bg-card rounded-xl border border-border shadow-subtle p-1">
            <button
              type="button"
              onClick={() => setCursor(c => addMonths(c, -1))}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="min-w-[7rem] sm:min-w-[9rem] text-center text-xs sm:text-sm font-black text-foreground tabular-nums px-2">
              {label}
            </span>
            <button
              type="button"
              onClick={() => setCursor(c => addMonths(c, 1))}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setCursor(startOfMonth(now));
                setSelectedDay(now);
              }}
              className="ml-1 px-2.5 py-1 text-[11px] font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg border border-primary/20 transition-colors cursor-pointer"
            >
              Today
            </button>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={() => openAddEvent(selectedDay)}
            className="px-3.5 py-2 text-xs font-bold bg-primary hover:bg-primary/90 active:scale-[0.98] text-primary-foreground rounded-xl transition-all shadow-primary-sm flex items-center space-x-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Schedule Event</span>
          </button>
        </div>
      </div>

      {/* Main Dual-Column Workspace (Calendar Grid + Cell We Go Side Panel) */}
      <div className="lg:grid lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_380px] lg:gap-6 lg:items-start space-y-6 lg:space-y-0">
        {/* Calendar Monthly Grid */}
        <div className="bg-card rounded-2xl shadow-subtle border border-border overflow-hidden">
          {/* Weekday Header */}
          <div className="grid grid-cols-7 border-b border-border bg-muted/60">
            {WEEKDAYS.map(day => (
              <div
                key={day}
                className="px-2 py-2.5 text-center text-[11px] font-sans font-bold text-muted-foreground uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Weeks Rows */}
          <div className="divide-y divide-border">
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 divide-x divide-border">
                {week.map((cell, di) => {
                  if (!cell) {
                    return (
                      <div
                        key={`pad-${wi}-${di}`}
                        className="min-h-[5.5rem] sm:min-h-[7rem] bg-muted/20"
                      />
                    );
                  }

                  const isToday = isSameDay(cell, today);
                  const isWeekend = cell.getDay() === 0 || cell.getDay() === 6;
                  const isSelected = selectedDay && isSameDay(cell, selectedDay);
                  const cellKey = dayKey(cell);
                  const dayEvents = dayEventsMap.get(cellKey) || [];
                  const dayAdvising = db.advisingSlots.filter(s => s.date === cellKey);

                  return (
                    <div
                      key={cellKey}
                      onClick={() => setSelectedDay(new Date(cell.getFullYear(), cell.getMonth(), cell.getDate()))}
                      className={`min-h-[5.5rem] sm:min-h-[7rem] p-1.5 sm:p-2 flex flex-col text-left cursor-pointer transition-all duration-150 relative group ${
                        isWeekend ? 'bg-muted/30' : 'bg-card'
                      } ${isToday ? 'ring-inset ring-2 ring-primary/40 bg-primary/5' : ''} ${
                        isSelected ? 'bg-primary/10 ring-inset ring-1 ring-primary/50' : 'hover:bg-muted/50'
                      }`}
                    >
                      {/* Day Header with Inline Quick + Button */}
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-xs font-black tabular-nums ${
                            isToday
                              ? 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-primary-sm'
                              : isWeekend
                              ? 'text-muted-foreground/80'
                              : 'text-foreground'
                          }`}
                        >
                          {cell.getDate()}
                        </span>

                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation();
                            openAddEvent(cell);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-primary/15 text-primary transition-opacity cursor-pointer"
                          title="Schedule event on this date"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Event Chips (Cell We Go Styling) */}
                      <div className="flex-1 flex flex-col gap-1 min-h-0 overflow-hidden">
                        {dayEvents.slice(0, 3).map(ev => {
                          const eventColor = ev.colorHex || '#be185d';
                          return (
                            <div
                              key={ev.id}
                              onClick={e => {
                                e.stopPropagation();
                                setSelectedDay(cell);
                                openEditEvent(ev);
                              }}
                              className="w-full text-left rounded-md px-1.5 py-0.5 text-[10px] font-bold text-white shadow-subtle hover:opacity-90 transition-opacity truncate flex items-center space-x-1"
                              style={{ backgroundColor: eventColor }}
                              title={`${ev.title} (${ev.time || 'All Day'})`}
                            >
                              <span className="truncate">{ev.title}</span>
                            </div>
                          );
                        })}

                        {/* Advising Slots indicator */}
                        {dayAdvising.length > 0 && dayEvents.length < 3 && (
                          <div
                            className="w-full text-left rounded-md px-1.5 py-0.5 text-[9px] font-sans font-bold bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30 truncate flex items-center space-x-1"
                            title={`${dayAdvising.length} Advising Slot(s)`}
                          >
                            <UserCheck className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">Advising ({dayAdvising.length})</span>
                          </div>
                        )}

                        {/* +N More Indicator */}
                        {dayEvents.length > 3 && (
                          <span className="text-[9px] font-bold text-primary font-sans pl-0.5">
                            +{dayEvents.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Cell We Go Desktop Side Inspector Panel */}
        <aside className="space-y-4 sticky top-4">
          <div className="bg-card rounded-2xl border border-border shadow-subtle p-5 space-y-4">
            {/* Header with Selected Date */}
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div>
                <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-muted-foreground block">
                  Inspector
                </span>
                <h2 className="text-sm font-extrabold text-foreground">
                  {selectedDay.toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => openAddEvent(selectedDay)}
                className="p-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all cursor-pointer"
                title="Schedule event on this day"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* Event List for Selected Day */}
            <div className="space-y-2.5 max-h-[40vh] overflow-y-auto pr-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                Scheduled Events ({selectedDayEvents.length})
              </span>

              {selectedDayEvents.length === 0 ? (
                <div className="p-4 rounded-xl border border-border/80 bg-muted/20 text-center space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">No events scheduled for this day.</p>
                  <button
                    type="button"
                    onClick={() => openAddEvent(selectedDay)}
                    className="text-xs font-bold text-primary hover:underline cursor-pointer"
                  >
                    + Click here to add an event
                  </button>
                </div>
              ) : (
                selectedDayEvents.map(ev => (
                  <div
                    key={ev.id}
                    onClick={() => openEditEvent(ev)}
                    className="p-3 bg-card rounded-xl border border-border hover:border-primary/40 transition-all cursor-pointer shadow-subtle space-y-1.5 card-hover"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-soft"
                          style={{ backgroundColor: ev.colorHex || '#be185d' }}
                        />
                        <h4 className="text-xs font-bold text-foreground truncate">
                          {ev.title}
                        </h4>
                      </div>
                      <span className="text-[9px] font-sans uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border shrink-0">
                        {ev.type}
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-[10px] font-sans text-muted-foreground pl-4.5">
                      <div className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{ev.time || 'All Day'}</span>
                      </div>
                      {ev.location && (
                        <div className="flex items-center space-x-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{ev.location}</span>
                        </div>
                      )}
                    </div>

                    {ev.description && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 pl-4.5 font-sans">
                        {ev.description}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Academic Advising Office Hours Section */}
            <div className="pt-3 border-t border-border space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 text-xs font-bold text-foreground">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Advising Office Hours</span>
                </div>
                {(activeRole === 'faculty' || activeRole === 'admin') && (
                  <button
                    type="button"
                    onClick={() => {
                      setAdvisingDate(selectedDayKey);
                      setShowAdvisingModal(true);
                    }}
                    className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                  >
                    + Open Slot
                  </button>
                )}
              </div>

              {selectedDayAdvisingSlots.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">
                  No faculty office hours posted for this day.
                </p>
              ) : (
                <div className="space-y-2">
                  {selectedDayAdvisingSlots.map(slot => (
                    <div
                      key={slot.id}
                      className="p-3 bg-muted/30 border border-border rounded-xl space-y-2 text-xs"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-foreground">{slot.instructorName}</div>
                          <div className="text-[10px] font-sans text-muted-foreground flex items-center space-x-1 mt-0.5">
                            <Clock className="w-3 h-3" />
                            <span>{slot.timeSlot}</span>
                          </div>
                          <div className="text-[10px] font-sans text-muted-foreground flex items-center space-x-1 mt-0.5">
                            <MapPin className="w-3 h-3" />
                            <span>{slot.location}</span>
                          </div>
                        </div>

                        <span className={`px-2 py-0.5 text-[9px] font-sans font-bold uppercase rounded border ${
                          slot.status === 'available'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}>
                          {slot.status}
                        </span>
                      </div>

                      {slot.status === 'booked' && (
                        <div className="text-[10px] font-sans bg-muted/60 p-2 rounded-lg text-foreground border border-border">
                          Booked by: <span className="font-bold">{slot.bookedByStudentName}</span>
                          {slot.notes && <p className="italic text-muted-foreground mt-0.5">"{slot.notes}"</p>}
                        </div>
                      )}

                      {activeRole === 'student' && slot.status === 'available' && (
                        <button
                          type="button"
                          onClick={() => {
                            bookAdvisingSlot(slot.id);
                            showAlert({
                              title: 'Appointment Booked',
                              message: `Advising appointment booked with ${slot.instructorName}!`,
                              type: 'success'
                            });
                          }}
                          className="w-full py-1.5 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl transition-all shadow-subtle flex items-center justify-center space-x-1.5 cursor-pointer active:scale-[0.98]"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Book Advising Slot</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Cell We Go Event Form Dialog (Add / Edit / Delete Event) */}
      <CalendarEventFormDialog
        isOpen={eventDialogOpen}
        onClose={() => {
          setEventDialogOpen(false);
          setEditingEvent(null);
        }}
        onSubmit={handleSaveEvent}
        onDelete={handleDeleteEvent}
        courses={db.courses}
        anchorDate={anchorDate}
        initialEvent={editingEvent}
      />

      {/* Faculty Office Hours Modal */}
      <AnimatedModal
        isOpen={showAdvisingModal}
        onClose={() => setShowAdvisingModal(false)}
        panelClassName="w-full max-w-md bg-card border border-border rounded-2xl p-6 space-y-4 shadow-elevated"
      >
        {({ startClose }) => (
          <>
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <h3 className="font-bold text-base text-foreground flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Open Advising Office Hours</span>
              </h3>
              <button
                type="button"
                onClick={startClose}
                className="p-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAdvising} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-foreground mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={advisingDate}
                  onChange={e => setAdvisingDate(e.target.value)}
                  className="w-full p-2.5 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground font-sans"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Time Window</label>
                <input
                  type="text"
                  required
                  value={advisingTime}
                  onChange={e => setAdvisingTime(e.target.value)}
                  placeholder="e.g. 10:00 AM - 10:30 AM"
                  className="w-full p-2.5 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground font-sans"
                />
              </div>

              <div>
                <label className="block font-bold text-foreground mb-1">Office Location / Link</label>
                <input
                  type="text"
                  required
                  value={advisingLocation}
                  onChange={e => setAdvisingLocation(e.target.value)}
                  placeholder="e.g. CS Faculty Office Room 204 or Zoom Link"
                  className="w-full p-2.5 bg-background border border-border focus:ring-2 focus:ring-primary/30 rounded-xl text-foreground"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={startClose}
                  className="px-4 py-2 text-xs font-bold text-muted-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl transition-all shadow-card cursor-pointer"
                >
                  Publish Slot
                </button>
              </div>
            </form>
          </>
        )}
      </AnimatedModal>
    </div>
  );
};
