import { LayoutDashboard, BedDouble, CalendarDays, Users, Settings, TrendingUp, Hotel, Menu, X, Zap, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useHotel } from '../context/HotelContext';

const navItems = [
  { id: 'dashboard',    label: 'Dashboard',     icon: LayoutDashboard },
  { id: 'rooms',        label: 'Rooms',          icon: BedDouble },
  { id: 'bookings',     label: 'Bookings',       icon: CalendarDays },
  { id: 'guests',       label: 'Guests',         icon: Users },
  { id: 'operations',  label: 'Operations',     icon: Settings },
  { id: 'revenue',      label: 'Revenue',        icon: TrendingUp },
  { id: 'smartpricing', label: 'Smart Pricing',  icon: Zap, badge: 'AI' },
];

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
}

const roleBadgeColors = {
  owner:       'bg-amber-400/20 text-amber-300',
  management:  'bg-blue-400/20 text-blue-300',
  front_desk:  'bg-emerald-400/20 text-emerald-300',
};

export default function Sidebar({ active, onNavigate, onLogout, user }) {
  const [open, setOpen] = useState(false);
  const { hotelName, roleLabel, role, profile } = useHotel();

  const displayName = profile?.fullName || user?.email?.split('@')[0] || 'Staff';
  const avatarLetters = initials(profile?.fullName || displayName);

  const NavContent = () => (
    <>
      {/* ── Product brand ── */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-emerald-700/30">
        <div className="w-9 h-9 rounded-xl bg-emerald-400/20 flex items-center justify-center shrink-0">
          <Hotel size={20} className="text-emerald-300" />
        </div>
        <div>
          <div className="text-sm font-bold text-white tracking-wide">Opera Suite</div>
          <div className="text-xs text-emerald-400/70">Hotel Management</div>
        </div>
      </div>

      {/* ── Nav items ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(({ id, label, icon: Icon, badge }) => (
          <button
            key={id}
            onClick={() => { onNavigate(id); setOpen(false); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
              ${active === id
                ? 'bg-emerald-500/20 text-white'
                : 'text-emerald-200/70 hover:bg-white/5 hover:text-white'}`}
          >
            <Icon size={18} className={active === id ? 'text-emerald-300' : ''} />
            <span className="flex-1 text-left">{label}</span>
            {badge && (
              <span className="text-xs px-1.5 py-0.5 rounded-md bg-purple-500/30 text-purple-300 font-medium">{badge}</span>
            )}
            {active === id && !badge && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
          </button>
        ))}
      </nav>

      {/* ── Bottom: hotel name + user ── */}
      <div className="px-4 pt-3 pb-4 border-t border-emerald-700/30 space-y-3">
        {/* Hotel name strip */}
        {hotelName && (
          <div className="px-3 py-2 rounded-xl bg-emerald-700/30">
            <div className="text-xs text-emerald-400/60 leading-none mb-0.5">Property</div>
            <div className="text-xs font-semibold text-white truncate">{hotelName}</div>
          </div>
        )}

        {/* User row */}
        <div className="flex items-center gap-3 px-3 py-2">
          <div className="w-8 h-8 rounded-full bg-emerald-400/20 flex items-center justify-center text-emerald-300 text-xs font-bold shrink-0">
            {avatarLetters}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-medium text-white truncate">{displayName}</div>
            <div className={`text-xs px-1.5 py-0.5 rounded-md inline-block mt-0.5 font-medium ${roleBadgeColors[role] ?? 'bg-gray-500/20 text-gray-300'}`}>
              {roleLabel}
            </div>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 rounded-lg text-emerald-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors"
            title="Sign out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-emerald-900 flex items-center justify-between px-4 py-3 border-b border-emerald-700/40">
        <div className="flex flex-col">
          <span className="text-sm font-bold text-white leading-tight">Opera Suite</span>
          {hotelName && <span className="text-xs text-emerald-400/70 leading-tight">{hotelName}</span>}
        </div>
        <button onClick={() => setOpen(!open)} className="text-emerald-200 p-1">
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="absolute left-0 top-0 bottom-0 w-64 bg-emerald-900 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <NavContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:flex flex-col w-56 xl:w-60 shrink-0 bg-emerald-900 min-h-screen">
        <NavContent />
      </div>
    </>
  );
}
