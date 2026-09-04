import { useState } from 'react';
import { BedDouble, CheckCircle, LogOut, CalendarCheck, CalendarX, Wrench, Sparkles, X, DollarSign } from 'lucide-react';
import { StatCard, Card, StatusBadge } from '../components/ui';
import { formatDisplay, formatCurrency, daysUntil, todayStr, isSoon, calcNights } from '../utils/dateUtils';

function RoomPopup({ room, booking, guest, position, onClose }) {
  const nights = booking ? calcNights(booking.checkIn, booking.checkOut) : 0;
  const daysLeft = booking ? daysUntil(booking.checkOut) : null;

  const statusStyles = {
    Available: { bar: 'bg-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700' },
    Booked:    { bar: 'bg-blue-500',    bg: 'bg-blue-50',    text: 'text-blue-700'    },
    Maintenance:{ bar: 'bg-red-500',    bg: 'bg-red-50',     text: 'text-red-700'     },
    Cleaning:  { bar: 'bg-amber-500',   bg: 'bg-amber-50',   text: 'text-amber-700'   },
  };
  const style = statusStyles[room.status] || statusStyles.Available;

  // Smart position — don't overflow right or bottom edge
  let left = position.x + 12;
  let top  = position.y - 10;
  if (left + 260 > window.innerWidth  - 16) left = position.x - 272;
  if (top  + 340 > window.innerHeight - 16) top  = window.innerHeight - 356;
  if (top < 8) top = 8;

  return (
    <>
      {/* invisible backdrop to catch outside clicks */}
      <div className="fixed inset-0 z-[9998]" onClick={onClose} />

      <div
        className="fixed z-[9999] w-64 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden animate-pop-in origin-top-left"
        style={{ top, left }}
        onClick={e => e.stopPropagation()}
      >
        {/* colour bar */}
        <div className={`h-1.5 ${style.bar}`} />

        {/* header */}
        <div className="px-4 pt-3 pb-2 flex items-start justify-between">
          <div>
            <div className="text-lg font-black text-gray-900">Room {room.number}</div>
            <div className="text-xs text-gray-400">Floor {room.floor} · {room.type}</div>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
              {room.status}
            </span>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-600 transition-colors">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* price */}
        <div className="px-4 pb-3 border-b border-gray-100 flex items-center gap-1.5">
          <DollarSign size={13} className="text-emerald-600" />
          <span className="text-sm font-bold text-emerald-700 tabular-nums">{formatCurrency(room.pricePerNight)}</span>
          <span className="text-xs text-gray-400">/ night</span>
        </div>

        {/* current guest */}
        {booking && guest && (
          <div className="px-4 py-3 border-b border-gray-100 space-y-2">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Current Guest</div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xs shrink-0">
                {guest.firstName[0]}{guest.lastName[0]}
              </div>
              <div>
                <div className="text-sm font-semibold text-gray-800">{guest.firstName} {guest.lastName}</div>
                <div className="text-xs text-gray-400">{guest.phone}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-lg px-2.5 py-2">
                <div className="text-xs text-gray-400">Check-in</div>
                <div className="text-xs font-semibold text-gray-700">{formatDisplay(booking.checkIn)}</div>
              </div>
              <div className="bg-gray-50 rounded-lg px-2.5 py-2">
                <div className="text-xs text-gray-400">Check-out</div>
                <div className="text-xs font-semibold text-gray-700">{formatDisplay(booking.checkOut)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 tabular-nums">{nights} night{nights !== 1 ? 's' : ''} · {formatCurrency(booking.totalAmount)}</span>
              {daysLeft !== null && (
                <span className={`font-semibold ${daysLeft === 0 ? 'text-red-500' : daysLeft <= 2 ? 'text-amber-500' : 'text-gray-500'}`}>
                  {daysLeft < 0 ? 'Overdue' : daysLeft === 0 ? 'Leaving today' : `${daysLeft}d left`}
                </span>
              )}
            </div>
            <StatusBadge status={booking.paymentStatus} />
          </div>
        )}

        {/* status messages */}
        {room.status === 'Available' && (
          <div className="px-4 py-3 flex items-center gap-2 text-emerald-600">
            <Sparkles size={14} />
            <span className="text-xs font-medium">Ready for new booking</span>
          </div>
        )}
        {room.status === 'Maintenance' && (
          <div className="px-4 py-3 flex items-center gap-2 text-red-500">
            <Wrench size={14} />
            <span className="text-xs font-medium">Under maintenance — not bookable</span>
          </div>
        )}
        {room.status === 'Cleaning' && (
          <div className="px-4 py-3 flex items-center gap-2 text-amber-600">
            <Sparkles size={14} />
            <span className="text-xs font-medium">Being cleaned — available soon</span>
          </div>
        )}

        {/* amenities */}
        {room.amenities && room.amenities.length > 0 && (
          <div className="px-4 pb-4 flex flex-wrap gap-1">
            {room.amenities.map(a => (
              <span key={a} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{a}</span>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function RoomCell({ room, activeBookings, guests, colorClass }) {
  const [popup, setPopup] = useState(null);

  const booking = activeBookings.find(b => b.roomId === room.id);
  const guest   = booking ? guests.find(g => g.id === booking.guestId) : null;

  const handleClick = (e) => {
    setPopup(prev => prev ? null : { x: e.clientX, y: e.clientY });
  };

  const handleKeyDown = (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    setPopup(prev => prev ? null : { x: rect.left, y: rect.bottom });
  };

  return (
    <>
      <div
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        aria-label={`Room ${room.number}, ${room.status}`}
        className={`
          aspect-square rounded-lg flex items-center justify-center
          text-xs font-bold cursor-pointer select-none tabular-nums
          transition-transform duration-100 ease-out-expo
          hover:scale-[1.06]
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-1
          ${colorClass}
          ${popup ? 'ring-2 ring-white ring-offset-1 scale-[1.06]' : ''}
        `}
        tabIndex={0}
      >
        {room.number}
      </div>

      {popup && (
        <RoomPopup
          room={room}
          booking={booking}
          guest={guest}
          position={popup}
          onClose={() => setPopup(null)}
        />
      )}
    </>
  );
}

export default function Dashboard({ rooms, bookings, guests }) {
  const today = todayStr();
  const totalRooms       = rooms.length;
  const available        = rooms.filter(r => r.status === 'Available').length;
  const booked           = rooms.filter(r => r.status === 'Booked').length;
  const activeBookings   = bookings.filter(b => b.status === 'Active');
  const checkingOutToday = activeBookings.filter(b => b.checkOut === today).length;
  const arrivalsToday    = bookings.filter(b => b.checkIn  === today && b.status !== 'Cancelled');
  const departuresToday  = bookings.filter(b => b.checkOut === today && b.status === 'Active');
  const recentBookings   = [...bookings].sort((a, b) => b.id.localeCompare(a.id)).slice(0, 5);

  const getRoomColor = (room) => {
    if (room.status === 'Maintenance') return 'bg-gray-300 text-gray-700';
    if (room.status === 'Cleaning')    return 'bg-yellow-400 text-yellow-900';
    const bk = activeBookings.find(b => b.roomId === room.id);
    if (bk && isSoon(bk.checkOut))    return 'bg-amber-400 text-amber-900';
    if (room.status === 'Booked')      return 'bg-red-400 text-white';
    return 'bg-emerald-400 text-white';
  };

  const getGuest = id => guests.find(g => g.id === id);
  const getRoom  = id => rooms.find(r  => r.id === id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {new Date().toLocaleDateString('en-NG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: BedDouble,   label: 'Total Rooms',        value: totalRooms,       color: 'blue'    },
          { icon: CheckCircle, label: 'Available',          value: available,        color: 'emerald' },
          { icon: BedDouble,   label: 'Booked',              value: booked,           color: 'red'     },
          { icon: LogOut,      label: 'Checking Out Today',  value: checkingOutToday, color: 'amber'   },
        ].map((s, i) => (
          <div key={s.label} className="animate-fade-up" style={{ animationDelay: `${i * 40}ms` }}>
            <StatCard icon={s.icon} label={s.label} value={s.value} color={s.color} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

        {/* Room grid */}
        <div className="xl:col-span-2">
          <Card className="p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <h2 className="font-semibold text-gray-900">Room Status Overview</h2>
                <p className="text-xs text-gray-400 mt-0.5">Click any room for details</p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block"/>Available</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-400    inline-block"/>Booked</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400  inline-block"/>Checkout Soon</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-yellow-400 inline-block"/>Cleaning</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-300   inline-block"/>Maintenance</span>
              </div>
            </div>

            <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
              {rooms.map(room => (
                <RoomCell
                  key={room.id}
                  room={room}
                  activeBookings={activeBookings}
                  guests={guests}
                  colorClass={getRoomColor(room)}
                />
              ))}
            </div>
          </Card>
        </div>

        {/* Today's arrivals & departures */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <CalendarCheck size={16} className="text-emerald-600" />
              <h3 className="font-semibold text-gray-900 text-sm">Today's Arrivals ({arrivalsToday.length})</h3>
            </div>
            {arrivalsToday.length === 0 ? (
              <p className="text-sm text-gray-400">No arrivals today</p>
            ) : (
              <ul className="space-y-2">
                {arrivalsToday.map(b => {
                  const g = getGuest(b.guestId);
                  const r = getRoom(b.roomId);
                  return (
                    <li key={b.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-800">{g ? `${g.firstName} ${g.lastName}` : 'Unknown'}</span>
                      <span className="text-gray-500">Room {r?.number}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <CalendarX size={16} className="text-red-500" />
              <h3 className="font-semibold text-gray-900 text-sm">Today's Departures ({departuresToday.length})</h3>
            </div>
            {departuresToday.length === 0 ? (
              <p className="text-sm text-gray-400">No departures today</p>
            ) : (
              <ul className="space-y-2">
                {departuresToday.map(b => {
                  const g = getGuest(b.guestId);
                  const r = getRoom(b.roomId);
                  return (
                    <li key={b.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-gray-800">{g ? `${g.firstName} ${g.lastName}` : 'Unknown'}</span>
                      <span className="text-gray-500">Room {r?.number}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      </div>

      {/* Recent bookings */}
      <Card>
        <div className="p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent Bookings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Guest','Room','Check In','Check Out','Amount','Status'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentBookings.map(b => {
                const g = getGuest(b.guestId);
                const r = getRoom(b.roomId);
                return (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-gray-800">{g ? `${g.firstName} ${g.lastName}` : '-'}</td>
                    <td className="px-5 py-3 text-gray-600">{r ? `${r.number} (${r.type})` : '-'}</td>
                    <td className="px-5 py-3 text-gray-600">{formatDisplay(b.checkIn)}</td>
                    <td className="px-5 py-3 text-gray-600">{formatDisplay(b.checkOut)}</td>
                    <td className="px-5 py-3 font-medium text-gray-800 tabular-nums">{formatCurrency(b.totalAmount)}</td>
                    <td className="px-5 py-3"><StatusBadge status={b.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
