import { useState, useRef, useEffect } from 'react';
import { Plus, CalendarDays, Search, Eye, XCircle, LogOut, ChevronDown, Check, MessageCircle, Phone } from 'lucide-react';
import { Card, StatusBadge, Btn, Modal, Input, Select, ConfirmDialog, EmptyState } from '../components/ui';
import { formatDisplay, formatCurrency, calcNights, daysUntil, todayStr } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';
import { useHotel } from '../context/HotelContext';

// --- WhatsApp & SMS helpers ---
function sendWhatsApp(phone, message) {
  const cleaned = phone.replace(/\D/g, '');
  const intl = cleaned.startsWith('0') ? '234' + cleaned.slice(1) : cleaned;
  const url = `https://wa.me/${intl}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

function sendSMS(phone, message) {
  const url = `sms:${phone}?body=${encodeURIComponent(message)}`;
  window.open(url, '_blank');
}

function buildMessages(guest, room, booking, hotelName) {
  const name = guest ? `${guest.firstName}` : 'Guest';
  const hotel = hotelName || 'our hotel';
  const checkIn = formatDisplay(booking.checkIn);
  const checkOut = formatDisplay(booking.checkOut);
  const nights = calcNights(booking.checkIn, booking.checkOut);
  const total = formatCurrency(booking.totalAmount);

  return {
    confirmation: `Hello ${name}! 🏨\n\nYour booking at ${hotel} has been confirmed.\n\n📋 Details:\nRoom: ${room?.number} (${room?.type})\nCheck-in: ${checkIn}\nCheck-out: ${checkOut}\nDuration: ${nights} night${nights > 1 ? 's' : ''}\nTotal: ${total}\n\nWe look forward to hosting you. Please let us know if you need anything.\n\n${hotel}`,

    reminder: `Hello ${name}! 👋\n\nThis is a friendly reminder that your check-out at ${hotel} is tomorrow (${checkOut}).\n\nRoom: ${room?.number}\nCheck-out time: 12:00 PM\n\nSafe travels! 🙏\n${hotel}`,

    welcome: `Welcome to ${hotel}, ${name}! 🎉\n\nWe're delighted to have you.\n\nRoom: ${room?.number} (${room?.type})\nCheck-out: ${checkOut}\n\nFor any assistance, reply to this message or call the front desk.\n\nEnjoy your stay!`,

    thankyou: `Dear ${name}, 🙏\n\nThank you for staying at ${hotel}!\n\nWe hope you had a wonderful experience. We'd love to welcome you back soon.\n\nYour feedback means a lot to us — feel free to reply with your thoughts.\n\n${hotel}`,
  };
}

function MessagingPanel({ booking, guest, room, onClose }) {
  const { hotelName } = useHotel();
  const messages = buildMessages(guest, room, booking, hotelName);
  const phone = guest?.phone || '';
  const [selected, setSelected] = useState('confirmation');

  const templates = [
    { key: 'confirmation', label: '✅ Booking Confirmation', when: 'Send when booking is created' },
    { key: 'welcome', label: '👋 Welcome Message', when: 'Send at check-in' },
    { key: 'reminder', label: '⏰ Checkout Reminder', when: 'Send the day before checkout' },
    { key: 'thankyou', label: '🙏 Thank You', when: 'Send after checkout' },
  ];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">
          {guest?.firstName?.[0]}{guest?.lastName?.[0]}
        </div>
        <div>
          <div className="font-semibold text-gray-800">{guest?.firstName} {guest?.lastName}</div>
          <div className="text-sm text-gray-500">{phone}</div>
        </div>
      </div>

      {/* Template selector */}
      <div className="grid grid-cols-2 gap-2">
        {templates.map(t => (
          <button key={t.key} onClick={() => setSelected(t.key)}
            className={`text-left p-3 rounded-xl border text-sm transition-colors ${selected === t.key ? 'border-emerald-400 bg-emerald-50' : 'border-gray-200 hover:bg-gray-50'}`}>
            <div className="font-medium text-gray-800">{t.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{t.when}</div>
          </button>
        ))}
      </div>

      {/* Message preview */}
      <div>
        <div className="text-xs font-medium text-gray-500 mb-2">MESSAGE PREVIEW</div>
        <div className="bg-[#e9fbe5] border border-green-200 rounded-xl p-4 text-sm text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
          {messages[selected]}
        </div>
      </div>

      {/* Send buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => sendWhatsApp(phone, messages[selected])}
          className="flex items-center justify-center gap-2 py-3 bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl font-medium text-sm transition-colors">
          <MessageCircle size={18} />
          Send via WhatsApp
        </button>
        <button onClick={() => sendSMS(phone, messages[selected])}
          className="flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium text-sm transition-colors">
          <Phone size={18} />
          Send via SMS
        </button>
      </div>
      <p className="text-xs text-gray-400 text-center">Opens WhatsApp/SMS with the message pre-filled. One tap to send.</p>
      <Btn variant="secondary" className="w-full" onClick={onClose}>Close</Btn>
    </div>
  );
}

// Searchable guest picker
function GuestSearch({ guests, value, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const selected = guests.find(g => g.id === value);
  const filtered = guests.filter(g => {
    const q = query.toLowerCase();
    return `${g.firstName} ${g.lastName}`.toLowerCase().includes(q) || g.phone.includes(q);
  });

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex flex-col gap-1" ref={ref}>
      <label className="text-sm font-medium text-gray-700">Guest</label>
      <div className="relative">
        <button type="button" onClick={() => { setOpen(!open); setQuery(''); }}
          className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:border-emerald-400 text-left">
          <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
            {selected ? `${selected.firstName} ${selected.lastName} · ${selected.phone}` : '— Search or select guest —'}
          </span>
          <ChevronDown size={16} className="text-gray-400 shrink-0" />
        </button>
        {open && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            <div className="p-2 border-b border-gray-100">
              <input autoFocus value={query} onChange={e => setQuery(e.target.value)}
                placeholder="Type name or phone…"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-emerald-400" />
            </div>
            <div className="max-h-48 overflow-y-auto">
              {filtered.length === 0 ? (
                <div className="px-4 py-3 text-sm text-gray-400">No guests found</div>
              ) : filtered.map(g => (
                <button key={g.id} type="button"
                  onClick={() => { onChange(g.id); setOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-emerald-50 text-left transition-colors">
                  <div>
                    <div className="font-medium text-gray-800">{g.firstName} {g.lastName}</div>
                    <div className="text-xs text-gray-400">{g.phone}</div>
                  </div>
                  {value === g.id && <Check size={14} className="text-emerald-600 shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function BookingForm({ rooms, guests, onSave, onClose }) {
  const today = todayStr();
  const [form, setForm] = useState({ guestId: '', roomId: '', checkIn: today, checkOut: '', notes: '', paymentStatus: 'Unpaid' });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const availRooms = rooms.filter(r => r.status === 'Available');
  const selectedRoom = rooms.find(r => r.id === form.roomId);
  const nights = form.checkIn && form.checkOut ? calcNights(form.checkIn, form.checkOut) : 0;
  const total = selectedRoom ? nights * selectedRoom.pricePerNight : 0;
  const valid = form.guestId && form.roomId && form.checkIn && form.checkOut && nights > 0;

  return (
    <div className="p-6 space-y-4">
      <GuestSearch guests={guests} value={form.guestId} onChange={v => set('guestId', v)} />
      <Select label="Room (Available only)" value={form.roomId} onChange={e => set('roomId', e.target.value)}>
        <option value="">— Select a room —</option>
        {availRooms.map(r => <option key={r.id} value={r.id}>Room {r.number} · {r.type} · Floor {r.floor} · {formatCurrency(r.pricePerNight)}/night</option>)}
      </Select>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Check-in Date" type="date" value={form.checkIn} min={today} onChange={e => set('checkIn', e.target.value)} />
        <Input label="Check-out Date" type="date" value={form.checkOut} min={form.checkIn || today} onChange={e => set('checkOut', e.target.value)} />
      </div>
      {nights > 0 && selectedRoom && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
          <div className="flex justify-between text-gray-600">
            <span>{formatCurrency(selectedRoom.pricePerNight)} × {nights} night{nights > 1 ? 's' : ''}</span>
            <span className="font-bold text-emerald-700 text-base">{formatCurrency(total)}</span>
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Payment Status</label>
        <div className="flex gap-2">
          {['Unpaid', 'Partial', 'Paid'].map(s => (
            <button key={s} type="button" onClick={() => set('paymentStatus', s)}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
                ${form.paymentStatus === s
                  ? s === 'Paid' ? 'bg-emerald-600 text-white border-emerald-600'
                    : s === 'Partial' ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-red-500 text-white border-red-500'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Notes (optional)</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-400 resize-none"
          placeholder="Special requests, preferences…" />
      </div>
      <div className="flex gap-3 pt-2">
        <Btn variant="secondary" className="flex-1" onClick={onClose}>Cancel</Btn>
        <Btn className="flex-1" disabled={!valid} onClick={async () => {
          await onSave({ ...form, totalAmount: total });
          onClose();
        }}>
          Create Booking
        </Btn>
      </div>
    </div>
  );
}

function BookingDetail({ booking, room, guest, onClose, onUpdate }) {
  const nights = calcNights(booking.checkIn, booking.checkOut);
  const daysLeft = daysUntil(booking.checkOut);
  const toast = useToast();
  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs text-gray-500 mb-1">Guest</div>
          <div className="font-semibold text-gray-900">{guest ? `${guest.firstName} ${guest.lastName}` : 'Unknown'}</div>
          {guest && <div className="text-sm text-gray-500">{guest.phone}</div>}
          {guest && <div className="text-sm text-gray-500">{guest.email}</div>}
        </div>
        <div>
          <div className="text-xs text-gray-500 mb-1">Room</div>
          <div className="font-semibold text-gray-900">Room {room?.number} ({room?.type})</div>
          <div className="text-sm text-gray-500">Floor {room?.floor}</div>
          <div className="text-sm text-emerald-600">{formatCurrency(room?.pricePerNight)}/night</div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 bg-gray-50 rounded-xl p-4">
        <div><div className="text-xs text-gray-500">Check In</div><div className="font-medium text-sm">{formatDisplay(booking.checkIn)}</div></div>
        <div><div className="text-xs text-gray-500">Check Out</div><div className="font-medium text-sm">{formatDisplay(booking.checkOut)}</div></div>
        <div><div className="text-xs text-gray-500">Nights</div><div className="font-medium text-sm">{nights}</div></div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-gray-500">Total Amount</div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(booking.totalAmount)}</div>
        </div>
      </div>
      <div>
        <div className="text-xs text-gray-500 mb-2">Payment Status</div>
        <div className="flex gap-2">
          {['Unpaid', 'Partial', 'Paid'].map(s => (
            <button key={s} type="button"
              onClick={() => { onUpdate(booking.id, { paymentStatus: s }); toast(`Marked as ${s}`); onClose(); }}
              className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors
                ${booking.paymentStatus === s
                  ? s === 'Paid' ? 'bg-emerald-600 text-white border-emerald-600'
                    : s === 'Partial' ? 'bg-amber-500 text-white border-amber-500'
                    : 'bg-red-500 text-white border-red-500'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'}`}>
              {s === booking.paymentStatus ? `✓ ${s}` : s}
            </button>
          ))}
        </div>
      </div>
      {booking.status === 'Active' && daysLeft <= 2 && daysLeft >= 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
          ⏰ {daysLeft === 0 ? 'Checking out today' : `Checking out in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`}
        </div>
      )}
      {booking.notes && (
        <div><div className="text-xs text-gray-500 mb-1">Notes</div><div className="text-sm text-gray-700 bg-gray-50 rounded-xl p-3">{booking.notes}</div></div>
      )}
      <Btn variant="secondary" className="w-full" onClick={onClose}>Close</Btn>
    </div>
  );
}

export default function Bookings({ bookings, rooms, guests, onAdd, onCancel, onCheckOut, onUpdate }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [detail, setDetail] = useState(null);
  const [messaging, setMessaging] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [checkingOut, setCheckingOut] = useState(null);

  const filtered = bookings.filter(b => {
    const guest = guests.find(g => g.id === b.guestId);
    const room = rooms.find(r => r.id === b.roomId);
    const matchSearch = !search ||
      `${guest?.firstName} ${guest?.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      room?.number.includes(search);
    const matchStatus = filterStatus === 'All' || b.status === filterStatus;
    return matchSearch && matchStatus;
  }).sort((a, b) => b.id.localeCompare(a.id));

  const getGuest = id => guests.find(g => g.id === id);
  const getRoom = id => rooms.find(r => r.id === id);

  const daysLabel = (b) => {
    if (b.status !== 'Active') return null;
    const d = daysUntil(b.checkOut);
    if (d < 0) return <span className="text-xs text-red-500">Overdue</span>;
    if (d === 0) return <span className="text-xs text-amber-600 font-medium">Checkout today</span>;
    if (d <= 2) return <span className="text-xs text-amber-500">In {d} day{d > 1 ? 's' : ''}</span>;
    return null;
  };

  const paymentColors = {
    Paid: 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200',
    Partial: 'bg-amber-100 text-amber-700 hover:bg-amber-200',
    Unpaid: 'bg-red-100 text-red-700 hover:bg-red-200',
    Refunded: 'bg-gray-100 text-gray-600',
  };
  const nextPaymentStatus = { Unpaid: 'Partial', Partial: 'Paid', Paid: 'Unpaid' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-sm text-gray-500">{bookings.filter(b => b.status === 'Active').length} active</p>
        </div>
        <Btn onClick={() => setShowAdd(true)}><Plus size={16} />New Booking</Btn>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guest or room…"
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:border-emerald-400">
          {['All', 'Active', 'Upcoming', 'Checked Out', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
        </select>
        <span className="text-xs text-gray-400 ml-auto">💡 Click payment badge to toggle · 💬 Message icon to WhatsApp/SMS</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No bookings found" description="Create a new booking or adjust your filters."
          action={<Btn onClick={() => setShowAdd(true)}><Plus size={16} />New Booking</Btn>} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Guest', 'Room', 'Check In', 'Check Out', 'Nights', 'Total', 'Status', 'Payment', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => {
                  const g = getGuest(b.guestId);
                  const r = getRoom(b.roomId);
                  const nights = calcNights(b.checkIn, b.checkOut);
                  return (
                    <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-800">{g ? `${g.firstName} ${g.lastName}` : '-'}</div>
                        {daysLabel(b)}
                      </td>
                      <td className="px-4 py-3 text-gray-600">{r ? `${r.number} (${r.type})` : '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDisplay(b.checkIn)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDisplay(b.checkOut)}</td>
                      <td className="px-4 py-3 text-gray-600">{nights}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{formatCurrency(b.totalAmount)}</td>
                      <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      <td className="px-4 py-3">
                        {b.paymentStatus === 'Refunded' ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">Refunded</span>
                        ) : (
                          <button
                            onClick={() => { const next = nextPaymentStatus[b.paymentStatus] || 'Unpaid'; onUpdate(b.id, { paymentStatus: next }); toast(`Payment marked as ${next}`); }}
                            title="Click to change payment status"
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors cursor-pointer ${paymentColors[b.paymentStatus] || 'bg-gray-100 text-gray-600'}`}>
                            {b.paymentStatus}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button onClick={() => setDetail(b)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="View details"><Eye size={14} /></button>
                          <button onClick={() => setMessaging(b)} className="p-1.5 rounded-lg hover:bg-green-50 text-gray-400 hover:text-green-600" title="Send WhatsApp/SMS"><MessageCircle size={14} /></button>
                          {b.status === 'Active' && <>
                            <button onClick={() => setCheckingOut(b)} className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600" title="Check Out"><LogOut size={14} /></button>
                            <button onClick={() => setCancelling(b)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500" title="Cancel"><XCircle size={14} /></button>
                          </>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showAdd && (
        <Modal title="New Booking" onClose={() => setShowAdd(false)} size="lg">
          <BookingForm rooms={rooms} guests={guests}
            onSave={async data => { await onAdd(data); toast('Booking created successfully!'); }}
            onClose={() => setShowAdd(false)} />
        </Modal>
      )}
      {detail && (
        <Modal title="Booking Details" onClose={() => setDetail(null)}>
          <BookingDetail booking={detail} room={getRoom(detail.roomId)} guest={getGuest(detail.guestId)}
            onClose={() => setDetail(null)} onUpdate={onUpdate} />
        </Modal>
      )}
      {messaging && (
        <Modal title="Send Message to Guest" onClose={() => setMessaging(null)} size="lg">
          <MessagingPanel booking={messaging} guest={getGuest(messaging.guestId)}
            room={getRoom(messaging.roomId)} onClose={() => setMessaging(null)} />
        </Modal>
      )}
      {cancelling && (
        <ConfirmDialog
          message={`Cancel booking for ${getGuest(cancelling.guestId)?.firstName}? This will free up Room ${getRoom(cancelling.roomId)?.number}.`}
          onConfirm={async () => { await onCancel(cancelling.id); setCancelling(null); toast('Booking cancelled', 'info'); }}
          onCancel={() => setCancelling(null)} confirmLabel="Cancel Booking" />
      )}
      {checkingOut && (
        <ConfirmDialog
          message={`Check out ${getGuest(checkingOut.guestId)?.firstName} from Room ${getRoom(checkingOut.roomId)?.number}?`}
          danger={false}
          onConfirm={async () => { await onCheckOut(checkingOut.id); setCheckingOut(null); toast('Guest checked out. Room set to cleaning.'); }}
          onCancel={() => setCheckingOut(null)} confirmLabel="Confirm Checkout" />
      )}
    </div>
  );
}
