import { useState } from 'react';
import { Plus, Edit2, Trash2, BedDouble, Search } from 'lucide-react';
import { Card, StatusBadge, Badge, Btn, Modal, Input, Select, ConfirmDialog, EmptyState } from '../components/ui';
import { formatCurrency } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';

const ROOM_TYPES = ['Single', 'Double', 'Suite'];
const STATUSES = ['Available', 'Booked', 'Maintenance', 'Cleaning'];

function RoomForm({ initial = {}, onSave, onClose }) {
  const [form, setForm] = useState({
    number: initial.number || '',
    type: initial.type || 'Single',
    floor: initial.floor || 1,
    status: initial.status || 'Available',
    pricePerNight: initial.pricePerNight || 15000,
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="p-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input label="Room Number" value={form.number} onChange={e => set('number', e.target.value)} placeholder="e.g. 101" />
        <Select label="Floor" value={form.floor} onChange={e => set('floor', +e.target.value)}>
          {[1, 2, 3, 4].map(f => <option key={f} value={f}>Floor {f}</option>)}
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Room Type" value={form.type} onChange={e => set('type', e.target.value)}>
          {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
        </Select>
        <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </Select>
      </div>
      <Input label="Price per Night (₦)" type="number" value={form.pricePerNight} onChange={e => set('pricePerNight', +e.target.value)} />
      <div className="flex gap-3 pt-2">
        <Btn variant="secondary" className="flex-1" onClick={onClose}>Cancel</Btn>
        <Btn className="flex-1" onClick={async () => { if (form.number) { await onSave(form); onClose(); } }}>
          {initial.id ? 'Save Changes' : 'Add Room'}
        </Btn>
      </div>
    </div>
  );
}

export default function Rooms({ rooms, bookings, guests, onAdd, onUpdate, onDelete }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterType, setFilterType] = useState('All');
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [view, setView] = useState('grid');

  const filtered = rooms.filter(r => {
    const matchSearch = r.number.includes(search) || r.type.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'All' || r.status === filterStatus;
    const matchType = filterType === 'All' || r.type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  const getCurrentGuest = (room) => {
    const booking = bookings.find(b => b.roomId === room.id && b.status === 'Active');
    if (!booking) return null;
    const guest = guests.find(g => g.id === booking.guestId);
    return guest ? `${guest.firstName} ${guest.lastName}` : null;
  };

  const statusColor = { Available: 'bg-emerald-100 border-emerald-200', Booked: 'bg-blue-50 border-blue-200', Maintenance: 'bg-red-50 border-red-200', Cleaning: 'bg-amber-50 border-amber-200' };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
          <p className="text-sm text-gray-500">{rooms.length} rooms total</p>
        </div>
        <Btn onClick={() => setShowAdd(true)}><Plus size={16} />Add Room</Btn>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search rooms…"
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-50" />
        </div>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:border-emerald-400">
          <option value="All">All Statuses</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filterType} onChange={e => setFilterType(e.target.value)}
          className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white outline-none focus:border-emerald-400">
          <option value="All">All Types</option>
          {ROOM_TYPES.map(t => <option key={t}>{t}</option>)}
        </select>
        <div className="ml-auto flex items-center border border-gray-200 rounded-xl overflow-hidden">
          {['grid', 'list'].map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`px-3 py-2 text-xs font-medium transition-colors ${view === v ? 'bg-emerald-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}>
              {v.charAt(0).toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={BedDouble} title="No rooms found" description="Try adjusting your filters or add a new room."
          action={<Btn onClick={() => setShowAdd(true)}><Plus size={16} />Add Room</Btn>} />
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(room => {
            const guestName = getCurrentGuest(room);
            return (
              <Card key={room.id} className={`p-4 border ${statusColor[room.status] || 'border-gray-100'}`}>
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-lg font-bold text-gray-900">Room {room.number}</div>
                    <div className="text-xs text-gray-500">Floor {room.floor} · {room.type}</div>
                  </div>
                  <StatusBadge status={room.status} />
                </div>
                <div className="text-sm font-semibold text-emerald-700 mb-2">{formatCurrency(room.pricePerNight)}<span className="font-normal text-gray-400">/night</span></div>
                {guestName && <div className="text-xs text-blue-600 bg-blue-50 rounded-lg px-2 py-1 mb-2">👤 {guestName}</div>}
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
                  <select value={room.status} onChange={async e => { await onUpdate(room.id, { status: e.target.value }); toast(`Room ${room.number} marked as ${e.target.value}`); }}
                    className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none">
                    {STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                  <button onClick={() => setEditing(room)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Edit2 size={14} /></button>
                  <button onClick={() => setDeleting(room)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Room', 'Type', 'Floor', 'Status', 'Guest', 'Price/Night', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(room => {
                  const guestName = getCurrentGuest(room);
                  return (
                    <tr key={room.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-4 py-3 font-bold text-gray-800">{room.number}</td>
                      <td className="px-4 py-3 text-gray-600">{room.type}</td>
                      <td className="px-4 py-3 text-gray-600">{room.floor}</td>
                      <td className="px-4 py-3"><StatusBadge status={room.status} /></td>
                      <td className="px-4 py-3 text-gray-600">{guestName || '—'}</td>
                      <td className="px-4 py-3 font-medium text-gray-800">{formatCurrency(room.pricePerNight)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button onClick={() => setEditing(room)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600"><Edit2 size={14} /></button>
                          <button onClick={() => setDeleting(room)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={14} /></button>
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
        <Modal title="Add New Room" onClose={() => setShowAdd(false)}>
          <RoomForm onSave={async data => { await onAdd(data); toast('Room added successfully'); }} onClose={() => setShowAdd(false)} />
        </Modal>
      )}
      {editing && (
        <Modal title={`Edit Room ${editing.number}`} onClose={() => setEditing(null)}>
          <RoomForm initial={editing} onSave={async data => { await onUpdate(editing.id, data); toast(`Room ${editing.number} updated`); }} onClose={() => setEditing(null)} />
        </Modal>
      )}
      {deleting && (
        <ConfirmDialog
          message={`Delete Room ${deleting.number}? This cannot be undone.`}
          onConfirm={async () => { await onDelete(deleting.id); setDeleting(null); toast('Room deleted', 'info'); }}
          onCancel={() => setDeleting(null)}
          confirmLabel="Delete Room" />
      )}
    </div>
  );
}
