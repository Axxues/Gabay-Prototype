import React, { useState, useRef, useEffect } from 'react';
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
  Check
} from 'lucide-react';

export const CalendarPage: React.FC = () => {
  const { activeRole, db, bookAdvisingSlot, createAdvisingSlot } = useLMS();

  const [selectedCourseFilter, setSelectedCourseFilter] = useState<string>('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Advising slot creation modal for Faculty
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [newSlotDate, setNewSlotDate] = useState('2026-09-18');
  const [newSlotTime, setNewSlotTime] = useState('10:00 AM - 10:30 AM');
  const [newSlotLocation, setNewSlotLocation] = useState('CS Faculty Office / Zoom');

  const filteredEvents = db.calendarEvents.filter(evt => {
    if (selectedCourseFilter === 'all') return true;
    return evt.courseId === selectedCourseFilter;
  });

  const handleCreateSlot = (e: React.FormEvent) => {
    e.preventDefault();
    createAdvisingSlot(newSlotDate, newSlotTime, newSlotLocation);
    setShowSlotModal(false);
    alert("New academic advising office hour slot created!");
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-zinc-200 dark:border-zinc-800 gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-pink-700 dark:text-pink-400" />
            <span>Institutional Academic Calendar & Advising Scheduler</span>
          </h1>
          <p className="text-xs text-zinc-500 font-mono">
            September 2026 • CHED Milestones & Office Hours Booking
          </p>
        </div>

        {/* Filter & Scheduler Controls */}
        <div className="flex items-center space-x-3">
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className="px-3 py-1.5 bg-card border border-border hover:border-pink-500/40 rounded-xl text-xs font-mono font-medium text-foreground flex items-center space-x-2 shadow-subtle transition-all cursor-pointer"
            >
              <Filter className="w-3.5 h-3.5 text-pink-700 dark:text-pink-400 shrink-0" />
              <span>
                {selectedCourseFilter === 'all'
                  ? 'All Courses & Milestones'
                  : db.courses.find(c => c.id === selectedCourseFilter)?.code || selectedCourseFilter}
              </span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ease-out ${
                  isFilterOpen ? 'rotate-180' : 'rotate-0'
                }`}
              />
            </button>

            {isFilterOpen && (
              <div className="absolute left-0 mt-1 w-56 bg-card border border-border rounded-xl shadow-elevated p-1.5 space-y-0.5 z-50 animate-dropdown">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCourseFilter('all');
                    setIsFilterOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors text-left cursor-pointer ${
                    selectedCourseFilter === 'all'
                      ? 'bg-pink-500/15 text-pink-700 dark:text-pink-300 font-bold border border-pink-500/30'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <span>All Courses & Milestones</span>
                  {selectedCourseFilter === 'all' && <Check className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400 shrink-0 ml-1" />}
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
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors text-left cursor-pointer ${
                        isSelected
                          ? 'bg-pink-500/15 text-pink-700 dark:text-pink-300 font-bold border border-pink-500/30'
                          : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <div className="flex items-center space-x-2 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: c.color }}
                        />
                        <span className="truncate">{c.code} ({c.section})</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-pink-600 dark:text-pink-400 shrink-0 ml-1" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {activeRole === 'faculty' && (
            <button
              onClick={() => setShowSlotModal(true)}
              className="px-3 py-1.5 text-xs font-semibold bg-pink-700 hover:bg-pink-800 text-white rounded transition-colors flex items-center space-x-1 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Scheduler: + Advising Slot</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Monthly Grid (2 Cols) */}
        <div className="lg:col-span-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-4 shadow-2xs">
          <div className="flex justify-between items-center pb-2 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 font-mono">
              September 2026
            </h2>
            <div className="flex space-x-1">
              <button className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Calendar Grid 7 columns */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="p-2 font-bold text-zinc-500 bg-zinc-50 dark:bg-zinc-950 rounded">
                {day}
              </div>
            ))}

            {/* Simulated 30 days grid */}
            {Array.from({ length: 30 }, (_, i) => {
              const dayNum = i + 1;
              const dateStr = `2026-09-${dayNum < 10 ? '0' + dayNum : dayNum}`;
              const dayEvents = filteredEvents.filter(e => e.date === dateStr);

              return (
                <div
                  key={dayNum}
                  className={`min-h-[70px] p-1.5 border rounded text-left flex flex-col justify-between transition-colors ${
                    dayNum === 15 || dayNum === 16
                      ? 'border-pink-500/50 bg-pink-50/20 dark:bg-pink-950/10'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900'
                  }`}
                >
                  <span className="font-bold text-[11px] text-zinc-700 dark:text-zinc-300">
                    {dayNum}
                  </span>
                  <div className="space-y-1 mt-1">
                    {dayEvents.map(evt => (
                      <div
                        key={evt.id}
                        title={evt.description}
                        className={`p-1 rounded text-[9px] font-mono leading-tight truncate font-bold ${
                          evt.type === 'assignment'
                            ? 'bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-300 border border-pink-200 dark:border-pink-800'
                            : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        }`}
                      >
                        {evt.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Pane: Academic Advising Scheduler Slots Widget */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-4 shadow-2xs">
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-2">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Faculty Academic Advising Scheduler</span>
            </h3>
            <p className="text-[11px] text-zinc-500 font-mono mt-0.5">
              Office Hours Appointment Slots
            </p>
          </div>

          <div className="space-y-3">
            {db.advisingSlots.map(slot => (
              <div
                key={slot.id}
                className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded border border-zinc-200 dark:border-zinc-800 space-y-2 text-xs"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-zinc-100">
                      {slot.instructorName}
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 flex items-center space-x-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{slot.date} • {slot.timeSlot}</span>
                    </div>
                    <div className="text-[10px] font-mono text-zinc-500 flex items-center space-x-1 mt-0.5">
                      <MapPin className="w-3 h-3" />
                      <span>{slot.location}</span>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded ${
                    slot.status === 'available'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                  }`}>
                    {slot.status}
                  </span>
                </div>

                {slot.status === 'booked' && (
                  <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded text-[10px] font-mono text-zinc-600 dark:text-zinc-400">
                    Booked by: <span className="font-bold text-zinc-900 dark:text-zinc-200">{slot.bookedByStudentName}</span>
                    {slot.notes && <div className="italic mt-0.5">"{slot.notes}"</div>}
                  </div>
                )}

                {activeRole === 'student' && slot.status === 'available' && (
                  <button
                    onClick={() => {
                      bookAdvisingSlot(slot.id);
                      alert(`Advising appointment booked with ${slot.instructorName}!`);
                    }}
                    className="w-full py-1.5 text-xs font-semibold bg-emerald-800 hover:bg-emerald-900 text-white rounded transition-colors flex items-center justify-center space-x-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Book Advising Slot</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scheduler Modal for Faculty */}
      {showSlotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 overlay-backdrop animate-fade-in"
          onClick={() => setShowSlotModal(false)}
        >
          <div
            className="w-full max-w-md bg-card border border-border rounded-2xl p-6 space-y-4 shadow-elevated animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-bold text-base text-foreground">
              Create Faculty Advising Office Hours Slot
            </h3>

            <form onSubmit={handleCreateSlot} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Date:</label>
                <input
                  type="date"
                  value={newSlotDate}
                  onChange={e => setNewSlotDate(e.target.value)}
                  className="w-full p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Time Slot:</label>
                <input
                  type="text"
                  value={newSlotTime}
                  onChange={e => setNewSlotTime(e.target.value)}
                  placeholder="e.g. 10:00 AM - 10:30 AM"
                  className="w-full p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">Location / Office:</label>
                <input
                  type="text"
                  value={newSlotLocation}
                  onChange={e => setNewSlotLocation(e.target.value)}
                  placeholder="e.g. CS Faculty Office Room 204"
                  className="w-full p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded font-mono"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowSlotModal(false)}
                  className="px-4 py-2 font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 font-semibold bg-pink-700 hover:bg-pink-800 text-white rounded"
                >
                  Create Office Hours Slot
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
