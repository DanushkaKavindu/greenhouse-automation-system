import { CalendarEvent } from '../types';
import GoogleCalendar from '../components/GoogleCalendar';
import { Calendar as CalendarIcon, Sparkles } from 'lucide-react';

interface CalendarPageProps {
  events: CalendarEvent[];
  onAddEvent: (event: CalendarEvent) => void;
  onConnectCalendar: () => void;
  isConnected: boolean;
  selectedDateStr?: string;
  onSelectDateStr?: (dateStr: string) => void;
  onNavigateToDashboard?: () => void;
}

export default function CalendarPage({ 
  events, 
  onAddEvent, 
  onConnectCalendar, 
  isConnected,
  selectedDateStr,
  onSelectDateStr,
  onNavigateToDashboard
}: CalendarPageProps) {
  return (
    <div id="calendar-page-container" className="space-y-6 select-none text-left">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] text-text-secondary font-bold uppercase tracking-wider block">CHRONOLOGY METRICS</span>
          <h2 className="text-2xl font-bold text-text-primary">Greenhouse Sync & Schedules</h2>
          <p className="text-xs text-text-secondary">
            Sync daily cultivation statistics, scheduled irrigation, and warnings with Google Calendar.
          </p>
        </div>
      </div>

      {/* Main GoogleCalendar component wrapper */}
      <GoogleCalendar
        events={events}
        onAddEvent={onAddEvent}
        onConnectCalendar={onConnectCalendar}
        isConnected={isConnected}
        selectedDateStr={selectedDateStr}
        onSelectDateStr={onSelectDateStr}
        onNavigateToDashboard={onNavigateToDashboard}
      />

    </div>
  );
}
