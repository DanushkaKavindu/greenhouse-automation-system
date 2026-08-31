import React from 'react';
import { 
  LayoutDashboard, 
  Sliders, 
  FileText, 
  BrainCircuit, 
  Calendar as CalendarIcon, 
  Info, 
  Sprout, 
  LogOut, 
  User 
} from 'lucide-react';
import { PageId } from '../types';
import { isMockFirebase } from '../firebase';

interface MobileNavProps {
  activePage: PageId;
  onPageChange: (page: PageId) => void;
  user: any;
  onLogout: () => void;
}

export default function MobileNav({ activePage, onPageChange, user, onLogout }: MobileNavProps) {
  const menuItems = [
    { id: 'dashboard' as PageId, label: 'Dash', icon: LayoutDashboard },
    { id: 'controls' as PageId, label: 'Controls', icon: Sliders },
    { id: 'ai-analysis' as PageId, label: 'AI Diagnostic', icon: BrainCircuit },
    { id: 'calendar' as PageId, label: 'Calendar', icon: CalendarIcon },
    { id: 'reports' as PageId, label: 'Reports', icon: FileText },
    { id: 'about' as PageId, label: 'About', icon: Info },
  ];

  return (
    <>
      {/* Mobile Top Header */}
      <header className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-white/20 px-4 flex items-center justify-between z-30 select-none">
        <div 
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => onPageChange(user ? 'dashboard' : 'landing')}
        >
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-status-healthy border border-emerald-100">
            <Sprout className="w-5 h-5 stroke-[1.5]" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-extrabold text-text-primary tracking-wider uppercase leading-none">🌿 LK-CHILLI</span>
            <span className="text-[8px] text-status-healthy font-semibold mt-0.5 animate-pulse">● LIVE STREAM</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <>
              {/* User profile avatar info trigger */}
              <div 
                className="w-8 h-8 rounded-full bg-inner-bg border border-white flex items-center justify-center text-text-primary cursor-pointer"
                onClick={() => {
                  alert(`User details:\nEmail: ${user.email}\nStatus: ${isMockFirebase ? 'Demo/Mock Mode' : 'Connected to Live Firebase'}`);
                }}
              >
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <User className="w-4 h-4 text-text-secondary" />
                )}
              </div>

              {/* Logout button */}
              <button
                onClick={onLogout}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-text-secondary hover:bg-rose-50 hover:text-status-critical transition-all"
                title="Log Out"
              >
                <LogOut className="w-4 h-4 stroke-[1.5]" />
              </button>
            </>
          )}
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-white/90 backdrop-blur-md border-t border-white/20 flex items-center justify-around z-30 shadow-lg px-1 pb-safe">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (user || item.id === 'about') {
                  onPageChange(item.id);
                } else {
                  onPageChange('login');
                }
              }}
              className="flex flex-col items-center justify-center w-full h-full py-1.5 px-1 relative"
            >
              <div 
                className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
                  isActive 
                    ? 'bg-navy-active text-white shadow-sm' 
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Icon className="w-5 h-5 stroke-[1.5]" />
              </div>
              <span className={`text-[8px] font-semibold mt-1 tracking-tight leading-none ${isActive ? 'text-navy-active' : 'text-text-secondary'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </>
  );
}
