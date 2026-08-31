import { 
  LayoutDashboard, 
  Sliders, 
  FileText, 
  BrainCircuit, 
  Calendar as CalendarIcon, 
  Info, 
  LogOut, 
  Sprout, 
  User 
} from 'lucide-react';
import { PageId } from '../types';
import { auth, isMockFirebase } from '../firebase';

interface SidebarProps {
  activePage: PageId;
  onPageChange: (page: PageId) => void;
  user: any;
  onLogout: () => void;
}

export default function Sidebar({ activePage, onPageChange, user, onLogout }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard' as PageId, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'controls' as PageId, label: 'Controls', icon: Sliders },
    { id: 'reports' as PageId, label: 'Reports', icon: FileText },
    { id: 'ai-analysis' as PageId, label: 'AI Analysis', icon: BrainCircuit },
    { id: 'calendar' as PageId, label: 'Calendar', icon: CalendarIcon },
    { id: 'about' as PageId, label: 'About', icon: Info },
  ];

  return (
    <div 
      id="app-sidebar" 
      className="hidden md:flex fixed left-4 top-4 bottom-4 w-20 bg-white/80 backdrop-blur-md rounded-[28px] shadow-glass flex-col items-center py-6 justify-between z-30 border border-white/20 select-none"
    >
      {/* Brand / Logo */}
      <div 
        className="flex flex-col items-center cursor-pointer group"
        onClick={() => onPageChange(user ? 'dashboard' : 'landing')}
      >
        <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-status-healthy mb-1 border border-emerald-100 group-hover:scale-105 transition-all">
          <Sprout className="w-6 h-6 stroke-[1.5]" />
        </div>
        <span className="text-[10px] text-text-secondary font-medium tracking-wider">🌿 MONITOR</span>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 flex flex-col justify-center gap-6 my-8 w-full px-3">
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
              title={item.label}
              className={`relative w-full aspect-square rounded-[18px] flex items-center justify-center transition-all ${
                isActive 
                  ? 'bg-navy-active text-white shadow-md scale-105' 
                  : 'text-text-secondary hover:bg-inner-bg hover:text-text-primary'
              }`}
            >
              <Icon className="w-5 h-5 stroke-[1.5]" />
              
              {/* Tooltip on Hover */}
              <div className="absolute left-24 bg-navy-active text-white text-xs py-1 px-3 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity whitespace-nowrap shadow-lg">
                {item.label}
              </div>
            </button>
          );
        })}
      </nav>

      {/* User Actions (Avatar & Logout) */}
      <div className="flex flex-col items-center gap-4 w-full px-3">
        {user ? (
          <>
            {/* User Profile Avatar */}
            <div 
              title={`Logged in as ${user.email}`}
              className="w-10 h-10 rounded-full bg-inner-bg border border-white flex items-center justify-center text-text-primary cursor-pointer hover:bg-divider transition-colors"
              onClick={() => {
                alert(`User details:\nEmail: ${user.email}\nStatus: ${isMockFirebase ? 'Demo/Mock Mode' : 'Connected to Live Firebase'}`);
              }}
            >
              {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-5 h-5 text-text-secondary" />
              )}
            </div>

            {/* Logout Button */}
            <button
              onClick={onLogout}
              title="Log Out"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-text-secondary hover:bg-rose-50 hover:text-status-critical transition-all"
            >
              <LogOut className="w-5 h-5 stroke-[1.5]" />
            </button>
          </>
        ) : (
          <button
            onClick={() => onPageChange('login')}
            title="Log In / Sign Up"
            className="w-10 h-10 bg-inner-bg text-text-secondary hover:text-text-primary hover:bg-divider rounded-xl flex items-center justify-center transition-all"
          >
            <User className="w-5 h-5 stroke-[1.5]" />
          </button>
        )}
      </div>
    </div>
  );
}
