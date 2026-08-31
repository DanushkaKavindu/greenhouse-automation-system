import { useState, useEffect } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Check, Clock, AlertTriangle, CloudRain, ShieldAlert, BarChart2, ArrowRight, RefreshCw } from 'lucide-react';
import { CalendarEvent } from '../types';
import { GoogleCalendarToken, isGoogleCalendarTokenValid, createGoogleCalendarEvent } from '../firebase';
import { useDailyAverages } from '../utils/telemetry';

interface GoogleCalendarProps {
  events: CalendarEvent[];
  onAddEvent: (event: CalendarEvent) => void;
  onConnectCalendar: () => void;
  isConnected: boolean;
  googleCalendarToken?: GoogleCalendarToken | null;
  selectedDateStr?: string;
  onSelectDateStr?: (dateStr: string) => void;
  onNavigateToDashboard?: () => void;
}

export default function GoogleCalendar({ 
  events, 
  onAddEvent, 
  onConnectCalendar, 
  isConnected,
  googleCalendarToken,
  selectedDateStr,
  onSelectDateStr,
  onNavigateToDashboard
}: GoogleCalendarProps) {
  const [isSyncingToGoogle, setIsSyncingToGoogle] = useState(false);
  const canSyncToRealGoogleCalendar = isConnected && isGoogleCalendarTokenValid(googleCalendarToken ?? null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(
    selectedDateStr ? new Date(selectedDateStr) : new Date()
  );
  const [viewMode, setViewMode] = useState<'Month' | 'Week' | 'Day'>('Month');
  const [showAddEventModal, setShowAddEventModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<'normal' | 'warning' | 'critical'>('normal');

  useEffect(() => {
    if (selectedDateStr) {
      const d = new Date(selectedDateStr);
      if (!isNaN(d.getTime())) {
        setSelectedDate(d);
      }
    }
  }, [selectedDateStr]);

  // Real daily average telemetry for the selected day — zero when nothing
  // has actually been logged for that date.
  const selectedDateIsoStr = selectedDate.toISOString().split('T')[0];
  const { data: selectedDayAvgData } = useDailyAverages(selectedDateIsoStr);

  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    // getDay() is 0 (Sunday) to 6 (Saturday). We want Monday (0) to Sunday (6)
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1;
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = getDaysInMonth(year, month);
  const firstDayIndex = getFirstDayOfMonth(year, month);

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const addDays = (d: Date, n: number) => {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + n);
    return copy;
  };

  // Monday-start week, matching getFirstDayOfMonth's convention above.
  const startOfWeek = (d: Date) => {
    const copy = new Date(d);
    const day = copy.getDay(); // 0 Sun .. 6 Sat
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
  };

  const selectDate = (d: Date) => {
    setSelectedDate(d);
    onSelectDateStr?.(d.toISOString().split('T')[0]);
  };

  // Navigation step depends on the active view: a month, a week, or a
  // single day. Day view keeps currentDate and selectedDate in lockstep
  // since there's only one date on screen at a time.
  const goToPrevPeriod = () => {
    if (viewMode === 'Month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (viewMode === 'Week') {
      setCurrentDate(addDays(currentDate, -7));
    } else {
      const d = addDays(currentDate, -1);
      setCurrentDate(d);
      selectDate(d);
    }
  };

  const goToNextPeriod = () => {
    if (viewMode === 'Month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (viewMode === 'Week') {
      setCurrentDate(addDays(currentDate, 7));
    } else {
      const d = addDays(currentDate, 1);
      setCurrentDate(d);
      selectDate(d);
    }
  };

  // Switching to Week/Day should show the period containing whatever date
  // is currently selected, not silently keep whatever currentDate was.
  const changeViewMode = (view: 'Month' | 'Week' | 'Day') => {
    setViewMode(view);
    if (view !== 'Month') {
      setCurrentDate(selectedDate);
    }
  };

  const weekStart = startOfWeek(currentDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = weekDays[6];
  const weekRangeLabel = weekStart.getMonth() === weekEnd.getMonth()
    ? `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} – ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`
    : `${monthNames[weekStart.getMonth()]} ${weekStart.getDate()} – ${monthNames[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  const dayViewLabel = currentDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  // Build calendar days array
  const calendarDays: { date: Date; isCurrentMonth: boolean; isToday: boolean; isSelected: boolean }[] = [];

  // Previous month offset days
  const prevMonthDays = getDaysInMonth(year, month - 1);
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthDays - i);
    calendarDays.push({
      date: d,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false
    });
  }

  // Current month days
  const today = new Date();
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    const isToday = d.toDateString() === today.toDateString();
    const isSelected = d.toDateString() === selectedDate.toDateString();
    calendarDays.push({
      date: d,
      isCurrentMonth: true,
      isToday,
      isSelected
    });
  }

  // Next month fill days
  const totalSlotsNeeded = 42; // 6 rows of 7
  const fillCount = totalSlotsNeeded - calendarDays.length;
  for (let i = 1; i <= fillCount; i++) {
    const d = new Date(year, month + 1, i);
    calendarDays.push({
      date: d,
      isCurrentMonth: false,
      isToday: false,
      isSelected: false
    });
  }

  // Event handler for adding a custom event with mandatory confirmation.
  // Always saves inside the app's own event list; when a real, unexpired
  // Google OAuth token is present, it ALSO writes a real event to the
  // user's actual primary Google Calendar via the Calendar v3 REST API.
  const handleCreateEvent = async () => {
    if (!newTitle.trim()) return;

    const dateStr = selectedDate.toISOString().split('T')[0];

    const confirmMessage = canSyncToRealGoogleCalendar
      ? `Write this event "${newTitle}" to your REAL Google Calendar (primary calendar) under date ${dateStr}?`
      : `Save "${newTitle}" as an in-app log entry for ${dateStr}? (Not connected to a real Google Calendar right now.)`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    const newEvent: CalendarEvent = {
      id: 'event_' + Date.now(),
      title: newTitle,
      description: newDesc,
      date: dateStr,
      type: newType,
      details: canSyncToRealGoogleCalendar ? 'Manual entry — synced to Google Calendar' : 'Manual Cultivator Log Entry'
    };

    onAddEvent(newEvent);

    if (canSyncToRealGoogleCalendar && googleCalendarToken) {
      setIsSyncingToGoogle(true);
      try {
        await createGoogleCalendarEvent(googleCalendarToken.accessToken, {
          summary: newTitle,
          description: newDesc || 'Added from Smart Greenhouse Assistant.',
          dateStr,
        });
      } catch (err: any) {
        console.error('Google Calendar write failed:', err);
        alert('Saved in the app, but writing to your real Google Calendar failed: ' + (err?.message || 'unknown error') + '. Your Google access may have expired — try reconnecting.');
      } finally {
        setIsSyncingToGoogle(false);
      }
    }

    // Reset form
    setNewTitle('');
    setNewDesc('');
    setNewType('normal');
    setShowAddEventModal(false);
  };

  // Sync the REAL daily average (computed from actually-logged ESP32
  // readings, selectedDayAvgData — never fabricated) to the user's real
  // Google Calendar as an all-day event, in addition to the in-app log.
  const syncDailyAverages = async () => {
    const dateStr = selectedDate.toISOString().split('T')[0];
    const avg = selectedDayAvgData;

    const destination = canSyncToRealGoogleCalendar ? 'your REAL Google Calendar' : 'this app only (not connected to a real Google Calendar)';
    const confirmMessage = avg.sampleCount > 0
      ? `Sync daily greenhouse statistics (Avg Temp: ${avg.temp}, Avg Soil Moisture: ${avg.soil}, from ${avg.sampleCount} logged readings) to ${destination} for ${dateStr}?`
      : `No sensor readings have been logged for ${dateStr} yet, so there are no real statistics to sync. Add a "no data" placeholder to ${destination} anyway?`;

    if (!window.confirm(confirmMessage)) return;

    const title = avg.sampleCount > 0
      ? `🌱 Greenhouse stats: ${avg.temp} / ${avg.soil} Soil`
      : '🌱 Greenhouse stats: no data logged';
    const description = avg.sampleCount > 0
      ? `Real 24hr averages from ${avg.sampleCount} logged readings — Temp: ${avg.temp}, Humidity: ${avg.humidity}, Soil Moisture: ${avg.soil}, Light: ${avg.light}, N: ${avg.nitrogen}, P: ${avg.phosphorus}, K: ${avg.potassium}.`
      : 'No ESP32 readings were logged for this date — the hardware may not have been connected.';

    const averageEvent: CalendarEvent = {
      id: 'auto_avg_' + Date.now(),
      title,
      description,
      date: dateStr,
      type: 'normal',
      details: canSyncToRealGoogleCalendar ? 'Automated average — synced to Google Calendar' : 'Automated System Average (in-app only)'
    };
    onAddEvent(averageEvent);

    if (canSyncToRealGoogleCalendar && googleCalendarToken) {
      setIsSyncingToGoogle(true);
      try {
        await createGoogleCalendarEvent(googleCalendarToken.accessToken, { summary: title, description, dateStr });
      } catch (err: any) {
        console.error('Google Calendar sync failed:', err);
        alert('Saved in the app, but syncing to your real Google Calendar failed: ' + (err?.message || 'unknown error') + '. Your Google access may have expired — try reconnecting.');
      } finally {
        setIsSyncingToGoogle(false);
      }
    }
  };

  // Selected date events
  const currentSelectedIsoStr = selectedDate.toISOString().split('T')[0];
  const selectedDateEvents = events.filter(e => e.date === currentSelectedIsoStr);

  return (
    <div id="google-calendar-panel" className="grid grid-cols-1 lg:grid-cols-3 gap-6 select-none">
      
      {/* Calendar Grid Section */}
      <div className="lg:col-span-2 bg-card-bg rounded-[28px] p-6 shadow-glass border border-white/20 flex flex-col justify-between">
        <div className="space-y-4">
          
          {/* Header Controls */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-bold text-text-secondary tracking-wider uppercase block">
                Greenhouse Schedule
              </span>
              <h2 className="text-xl font-semibold text-text-primary">
                {viewMode === 'Month' && `${monthNames[month]} ${year}`}
                {viewMode === 'Week' && weekRangeLabel}
                {viewMode === 'Day' && dayViewLabel}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              {/* Period selection tabs */}
              <div className="bg-inner-bg p-0.5 rounded-xl flex gap-1 text-[10px] font-semibold">
                {(['Month', 'Week', 'Day'] as const).map((view) => (
                  <button
                    key={view}
                    onClick={() => changeViewMode(view)}
                    className={`py-1 px-3 rounded-lg ${
                      viewMode === view 
                        ? 'bg-navy-active text-white shadow-sm' 
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {view}
                  </button>
                ))}
              </div>

              {/* Prev / Next buttons */}
              <div className="flex items-center bg-inner-bg p-0.5 rounded-xl">
                <button 
                  onClick={goToPrevPeriod} 
                  className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-divider/50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                  onClick={goToNextPeriod} 
                  className="p-1 rounded-lg text-text-secondary hover:text-text-primary hover:bg-divider/50"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Calendar Grid - Month view */}
          {viewMode === 'Month' && (
            <div className="grid grid-cols-7 gap-1 text-center">
              {/* Days of week header */}
              {daysOfWeek.map((day) => (
                <span key={day} className="text-[10px] font-bold text-text-secondary uppercase tracking-wider py-2">
                  {day}
                </span>
              ))}

              {/* Grid days */}
              {calendarDays.map((slot, idx) => {
                const slotDateStr = slot.date.toISOString().split('T')[0];
                const slotEvents = events.filter(e => e.date === slotDateStr);

                return (
                  <div
                    key={idx}
                    onClick={() => selectDate(slot.date)}
                    className={`aspect-square rounded-[16px] flex flex-col items-center justify-between py-2 cursor-pointer relative hover:bg-inner-bg/50 transition-all ${
                      slot.isSelected 
                        ? 'bg-navy-active text-white scale-102 shadow-md' 
                        : slot.isToday 
                        ? 'bg-inner-bg text-text-primary font-bold' 
                        : slot.isCurrentMonth 
                        ? 'text-text-primary' 
                        : 'text-text-secondary/50'
                    }`}
                  >
                    {/* Day number */}
                    <span className="text-xs font-semibold">{slot.date.getDate()}</span>

                    {/* Multi-colored dots beneath for scheduled events */}
                    <div className="flex justify-center gap-0.5 mt-auto">
                      {slotEvents.slice(0, 3).map((evt) => (
                        <span
                          key={evt.id}
                          className={`w-1.5 h-1.5 rounded-full ${
                            evt.type === 'critical' ? 'bg-status-critical' :
                            evt.type === 'warning' ? 'bg-status-warning' : 'bg-status-healthy'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Calendar Grid - Week view */}
          {viewMode === 'Week' && (
            <div className="grid grid-cols-7 gap-2 text-center">
              {weekDays.map((d, idx) => {
                const dStr = d.toISOString().split('T')[0];
                const dEvents = events.filter(e => e.date === dStr);
                const isToday = dStr === new Date().toISOString().split('T')[0];
                const isSelected = dStr === selectedDate.toISOString().split('T')[0];

                return (
                  <div key={idx} className="flex flex-col items-center gap-1">
                    <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">
                      {daysOfWeek[idx]}
                    </span>
                    <div
                      onClick={() => selectDate(d)}
                      className={`w-full aspect-square rounded-[16px] flex flex-col items-center justify-between py-2 cursor-pointer relative hover:bg-inner-bg/50 transition-all ${
                        isSelected
                          ? 'bg-navy-active text-white scale-102 shadow-md'
                          : isToday
                          ? 'bg-inner-bg text-text-primary font-bold'
                          : 'text-text-primary'
                      }`}
                    >
                      <span className="text-xs font-semibold">{d.getDate()}</span>
                      <div className="flex justify-center gap-0.5 mt-auto">
                        {dEvents.slice(0, 3).map((evt) => (
                          <span
                            key={evt.id}
                            className={`w-1.5 h-1.5 rounded-full ${
                              evt.type === 'critical' ? 'bg-status-critical' :
                              evt.type === 'warning' ? 'bg-status-warning' : 'bg-status-healthy'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {dEvents.length > 0 && (
                      <span className="text-[9px] text-text-secondary">{dEvents.length} event{dEvents.length > 1 ? 's' : ''}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Calendar Grid - Day view */}
          {viewMode === 'Day' && (
            <div className="space-y-3">
              {selectedDateEvents.length === 0 ? (
                <div className="text-center py-10 text-text-secondary text-sm">
                  No scheduled events for this day.
                </div>
              ) : (
                selectedDateEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className={`p-4 rounded-[16px] border flex items-start gap-3 ${
                      evt.type === 'critical' ? 'border-status-critical/30 bg-status-critical/5' :
                      evt.type === 'warning' ? 'border-status-warning/30 bg-status-warning/5' :
                      'border-status-healthy/30 bg-status-healthy/5'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        evt.type === 'critical' ? 'bg-status-critical' :
                        evt.type === 'warning' ? 'bg-status-warning' : 'bg-status-healthy'
                      }`}
                    />
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{evt.title}</p>
                      {evt.description && (
                        <p className="text-xs text-text-secondary mt-1">{evt.description}</p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Sync panel */}
        <div className="mt-6 pt-4 border-t border-divider/40 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onConnectCalendar}
              className={`py-2 px-4 rounded-xl text-xs font-medium flex items-center gap-2 ${
                canSyncToRealGoogleCalendar
                  ? 'bg-green-50 text-status-healthy border border-green-100'
                  : 'bg-navy-active text-white hover:shadow-md'
              }`}
            >
              {canSyncToRealGoogleCalendar ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Google Calendar Linked
                </>
              ) : (
                <>
                  <CalendarIcon className="w-3.5 h-3.5" />
                  {isConnected ? 'Reconnect Google Calendar' : 'Connect Google Calendar'}
                </>
              )}
            </button>

            <span className="text-[10px] text-text-secondary">
              {canSyncToRealGoogleCalendar
                ? 'Writes real events to your Google Calendar'
                : isConnected
                ? 'Google access expired — reconnect to resume real syncing'
                : 'Not connected — events are saved in this app only'}
            </span>
          </div>

          <button
            onClick={syncDailyAverages}
            disabled={isSyncingToGoogle}
            className="py-2 px-4 bg-inner-bg hover:bg-divider text-text-primary text-xs font-medium rounded-xl border border-divider/30 flex items-center gap-1.5 disabled:opacity-60"
          >
            {isSyncingToGoogle && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
            {isSyncingToGoogle ? 'Syncing…' : 'Sync Daily Averages'}
          </button>
        </div>
      </div>

      {/* Events Sidebar Drawer Section */}
      <div className="bg-card-bg rounded-[28px] p-6 shadow-glass border border-white/20 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-divider/40 pb-3">
            <div>
              <span className="text-[10px] text-text-secondary uppercase font-bold tracking-wider block font-mono">
                Selected Day Logs
              </span>
              <h3 className="text-sm font-semibold text-text-primary">
                {selectedDate.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
              </h3>
            </div>
            
            <button
              onClick={() => setShowAddEventModal(true)}
              className="p-1.5 bg-inner-bg text-text-primary hover:bg-divider rounded-xl"
              title="Add manual log entry"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Daily Average Telemetry Card for Selected Date */}
          {(() => {
            const avgData = selectedDayAvgData;
            return (
              <div className="bg-inner-bg/60 rounded-2xl p-3.5 border border-navy-active/15 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold text-navy-active uppercase tracking-wider font-mono flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5 text-navy-active" />
                    Daily Average Values
                  </span>
                  <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                    avgData.sampleCount > 0
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                      : 'text-amber-700 bg-amber-50 border-amber-200/60'
                  }`}>
                    {avgData.sampleCount > 0 ? '24H Aggregate' : 'No Data Logged'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="bg-white/80 p-2 rounded-xl border border-divider/20">
                    <span className="text-[9px] text-text-secondary font-bold uppercase block">Avg Air Temp</span>
                    <span className="font-extrabold text-text-primary text-sm">{avgData.temp}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-divider/20">
                    <span className="text-[9px] text-text-secondary font-bold uppercase block">Avg Air Humid</span>
                    <span className="font-extrabold text-text-primary text-sm">{avgData.humidity}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-divider/20">
                    <span className="text-[9px] text-text-secondary font-bold uppercase block">Avg Soil Moisture</span>
                    <span className="font-extrabold text-text-primary text-sm">{avgData.soil}</span>
                  </div>
                  <div className="bg-white/80 p-2 rounded-xl border border-divider/20">
                    <span className="text-[9px] text-text-secondary font-bold uppercase block">Avg Solar Lux</span>
                    <span className="font-extrabold text-amber-600 text-sm">{avgData.light}</span>
                  </div>
                </div>

                {onNavigateToDashboard && (
                  <button
                    onClick={onNavigateToDashboard}
                    className="w-full mt-1 py-1.5 px-3 bg-white hover:bg-slate-50 text-navy-active border border-navy-active/20 font-bold text-[10px] rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                  >
                    <span>View Averages on Dashboard</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })()}

          {/* Events list */}
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {selectedDateEvents.length > 0 ? (
              selectedDateEvents.map((evt) => (
                <div
                  key={evt.id}
                  className="p-3 bg-inner-bg/40 rounded-xl border border-divider/20 flex gap-3"
                >
                  <div className="mt-0.5 shrink-0">
                    {evt.type === 'critical' ? (
                      <div className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center text-status-critical">
                        <ShieldAlert className="w-4.5 h-4.5" />
                      </div>
                    ) : evt.type === 'warning' ? (
                      <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center text-status-warning">
                        <AlertTriangle className="w-4.5 h-4.5" />
                      </div>
                    ) : (
                      <div className="w-6 h-6 rounded-lg bg-blue-50 flex items-center justify-center text-sky-500">
                        <CloudRain className="w-4.5 h-4.5" />
                      </div>
                    )}
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-semibold text-text-primary leading-tight">
                      {evt.title}
                    </h4>
                    <p className="text-[10px] text-text-secondary leading-normal">
                      {evt.description}
                    </p>
                    <span className="text-[9px] text-text-secondary font-mono flex items-center gap-1 mt-1">
                      <Clock className="w-3 h-3" />
                      {evt.details || 'Calendar Event'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 space-y-2">
                <div className="w-10 h-10 rounded-full bg-inner-bg flex items-center justify-center text-text-secondary mx-auto">
                  <Check className="w-5 h-5 stroke-[1.5]" />
                </div>
                <p className="text-xs text-text-secondary">
                  No automated alerts or logs scheduled for this date. All normal!
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Color Legend */}
        <div className="border-t border-divider/40 pt-4 flex justify-between text-[9px] text-text-secondary font-semibold uppercase tracking-wider">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-status-healthy" />
            <span>Normal</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-status-warning" />
            <span>Warning</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-status-critical" />
            <span>Critical</span>
          </div>
        </div>
      </div>

      {/* Manual Add Event Modal Backdrop */}
      {showAddEventModal && (
        <div className="fixed inset-0 bg-navy-active/20 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white w-[400px] rounded-[24px] p-6 shadow-2xl border border-divider/20 space-y-4">
            <div className="flex items-center justify-between border-b border-divider/40 pb-2">
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-wider">
                Create Schedule Entry
              </h3>
              <button 
                onClick={() => setShowAddEventModal(false)}
                className="text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-text-secondary font-medium">Log Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Fan maintenance check, Organic fertilizer feed"
                  className="w-full bg-inner-bg focus:bg-white rounded-xl py-2 px-3 outline-none border border-transparent focus:border-divider text-text-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-text-secondary font-medium">Description</label>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  placeholder="Provide activity logs or notes..."
                  className="w-full bg-inner-bg focus:bg-white rounded-xl py-2 px-3 outline-none border border-transparent focus:border-divider text-text-primary"
                />
              </div>

              <div className="space-y-1">
                <label className="text-text-secondary font-medium">Severity Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {['normal', 'warning', 'critical'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewType(type as any)}
                      className={`py-2 rounded-xl font-semibold capitalize border ${
                        newType === type
                          ? 'bg-navy-active text-white border-navy-active'
                          : 'bg-inner-bg text-text-primary border-transparent hover:bg-divider'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateEvent}
              className="w-full py-3 bg-navy-active text-white hover:shadow-lg font-semibold rounded-xl text-xs uppercase tracking-wider mt-4"
            >
              Confirm & Save Entry
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
