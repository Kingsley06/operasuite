import { useState } from 'react';
import { Plus, Edit2, Trash2, Users, Search, Eye } from 'lucide-react';
import { Card, StatusBadge, Btn, Modal, Input, Select, Textarea, ConfirmDialog, EmptyState } from '../components/ui';
import { formatDisplay, formatCurrency, calcNights } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';

const ID_TYPES = ['NIN', 'International Passport', "Driver's License"];

function GuestForm({ initial = {}, onSave, onClose }) {
  const [form, setForm] = useState({
    firstName: initial.firstName || '',
    lastName: initial.lastName || '',
    email: initial.email || '',
    phone: initial.phone || '',
    idType: initial.idType || 'NIN',
    idNumber: initial.idNumber || '',
    notes: initial.notes || '',
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.firstName && form.lastName && form.phone;

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="First Name" value={form.firstName} onChange={e => set('firstName', e.target.value)} placeholder="Chukwuemeka" />
        <Input label="Last Name" value={form.lastName} onChange={e => set('lastName', e.target.value)} placeholder="Okafor" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Phone Number" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="080XXXXXXXX" />
        <Input label="Email Address" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="guest@email.com" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select label="ID Type" value={form.idType} onChange={e => set('idType', e.target.value)}>
          {ID_TYPES.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Input label="ID Number" value={form.idNumber} onChange={e => set('idNumber', e.target.value)} placeholder="NIN-XXXXXXXXXX" />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50 resize-none"
          placeholder="Preferences, special requirements…" />
      </div>
      <div className="flex gap-3 pt-2">
        <Btn variant="secondary" className="flex-1" onClick={onClose}>Cancel</Btn>
        <Btn className="flex-1" disabled={!valid} onClick={async () => { await onSave(form); onClose(); }}>
          {initial.id ? 'Save Changes' : 'Add Guest'}
        </Btn>
      </div>
    </div>
  );
}

function GuestHistory({ guest, bookings, rooms, onClose }) {
  const guestBookings = bookings.filter(b => b.guestId === guest.id).sort((a, b) => b.id.localeCompare(a.id));
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg">
          {guest.firstName[0]}{guest.lastName[0]}
        </div>
        <div>
          <div className="font-bold text-gray-900">{guest.firstName} {guest.lastName}</div>
          <div className="text-sm text-gray-500">{guest.phone} · {guest.email}</div>
          <div className="text-xs text-gray-400">{guest.idType}: {guest.idNumber}</div>
        </div>
      </div>
      {guest.notes && <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm text-amber-800">{guest.notes}</div>}
      <div>
        <h3 className="font-semibold text-gray-800 mb-3">Booking History ({guestBookings.length})</h3>
        {guestBookings.length === 0 ? (
          <p className="text-sm text-gray-400">No bookings yet</p>
        ) : (
          <div className="space-y-2">
            {guestBookings.map(b => {
              const room = rooms.find(r => r.id === b.roomId);
              const nights = calcNights(b.checkIn, b.checkOut);
              return (
                <div key={b.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <div className="text-sm font-medium text-gray-800">Room {room?.number} ({room?.type})</div>
                    <div className="text-xs text-gray-500">{formatDisplay(b.checkIn)} → {formatDisplay(b.checkOut)} · {nights} nights</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-gray-800">{formatCurrency(b.totalAmount)}</div>
                    <StatusBadge status={b.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      <Btn variant="secondary" className="w-full" onClick={onClose}>Close</Btn>
    </div>
  );
}

export default function Guests({ guests, bookings, rooms, onAdd, onUpdate, onDelete }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const filtered = guests.filter(g => {
    const q = search.toLowerCase();
    return `${g.firstName} ${g.lastName}`.toLowerCase().includes(q) ||
      g.phone.includes(search) || g.email.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Guests</h1>
          <p className="text-sm text-gray-500">{guests.length} registered guests</p>
        </div>
        <Btn onClick={() => setShowAdd(true)}><Plus size={16} />Add Guest</Btn>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search guests…"
          className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Users} title="No guests found" description="Add your first guest or adjust your search."
          action={<Btn onClick={() => setShowAdd(true)}><Plus size={16} />Add Guest</Btn>} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Guest', 'Contact', 'ID', 'Total Stays', 'Last Visit', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(g => (
                  <tr key={g.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
                          {g.firstName[0]}{g.lastName[0]}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{g.firstName} {g.lastName}</div>
                          {g.notes && <div className="text-xs text-amber-600 truncate max-w-[140px]">{g.notes}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700">{g.phone}</div>
                      <div className="text-xs text-gray-400">{g.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs text-gray-500">{g.idType}</div>
                      <div className="text-xs font-mono text-gray-700">{g.idNumber || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xs">{g.totalStays}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-sm">{g.lastVisit ? formatDisplay(g.lastVisit) : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setViewing(g)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Eye size={14} /></button>
                        <button onClick={() => setEditing(g)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Edit2 size={14} /></button>
                        <button onClick={() => setDeleting(g)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {showAdd && (
        <Modal title="Add New Guest" onClose={() => setShowAdd(false)} size="lg">
          <GuestForm onSave={async data => { await onAdd(data); toast('Guest profile created'); }} onClose={() => setShowAdd(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title="Edit Guest Profile" onClose={() => setEditing(null)} size="lg">
          <GuestForm initial={editing} onSave={async data => { await onUpdate(editing.id, data); toast('Guest profile updated'); }} onClose={() => setEditing(null)} />
        </Modal>
      )}
      {viewing && (
        <Modal title="Guest Profile" onClose={() => setViewing(null)} size="lg">
          <GuestHistory guest={viewing} bookings={bookings} rooms={rooms} onClose={() => setViewing(null)} />
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          message={`Delete ${deleting.firstName} ${deleting.lastName}'s profile? All booking history will be unlinked.`}
          onConfirm={async () => { await onDelete(deleting.id); setDeleting(null); toast('Guest removed', 'info'); }}
          onCancel={() => setDeleting(null)}
          confirmLabel="Delete Guest" />
      )}
    </div>
  );
}
