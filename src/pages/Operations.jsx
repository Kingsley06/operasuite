import { useState } from 'react';
import { Plus, Wrench, CheckSquare } from 'lucide-react';
import { Card, StatusBadge, Btn, Modal, Input, Select, Textarea, ConfirmDialog } from '../components/ui';
import { formatDisplay, todayStr } from '../utils/dateUtils';
import { useToast } from '../context/ToastContext';

const HK_STATUSES = ['Clean', 'Dirty', 'In Progress'];
const MX_PRIORITIES = ['Low', 'Medium', 'High'];
const MX_STATUSES = ['Open', 'In Progress', 'Resolved'];

function MaintenanceForm({ rooms, initial = {}, onSave, onClose }) {
  const [form, setForm] = useState({
    roomId: initial.roomId || rooms[0]?.id || '',
    issue: initial.issue || '',
    priority: initial.priority || 'Medium',
    status: initial.status || 'Open',
    notes: initial.notes || '',
    reportedDate: initial.reportedDate || todayStr(),
  });
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="p-6 space-y-4">
      <Select label="Room" value={form.roomId} onChange={e => set('roomId', e.target.value)}>
        {rooms.map(r => <option key={r.id} value={r.id}>Room {r.number} (Floor {r.floor})</option>)}
      </Select>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Issue Description</label>
        <textarea value={form.issue} onChange={e => set('issue', e.target.value)} rows={2}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-400 resize-none"
          placeholder="Describe the issue…" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Select label="Priority" value={form.priority} onChange={e => set('priority', e.target.value)}>
          {MX_PRIORITIES.map(p => <option key={p}>{p}</option>)}
        </Select>
        <Select label="Status" value={form.status} onChange={e => set('status', e.target.value)}>
          {MX_STATUSES.map(s => <option key={s}>{s}</option>)}
        </Select>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">Notes</label>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
          className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-emerald-400 resize-none"
          placeholder="Additional context…" />
      </div>
      <div className="flex gap-3 pt-2">
        <Btn variant="secondary" className="flex-1" onClick={onClose}>Cancel</Btn>
        <Btn className="flex-1" disabled={!form.issue}
          onClick={() => { onSave(form); onClose(); }}>
          {initial.id ? 'Save Changes' : 'Log Issue'}
        </Btn>
      </div>
    </div>
  );
}

export default function Operations({ rooms, housekeeping, maintenance, onUpdateHk, onAddMx, onUpdateMx, onDeleteMx }) {
  const toast = useToast();
  const [tab, setTab] = useState('housekeeping');
  const [showAddMx, setShowAddMx] = useState(false);
  const [editMx, setEditMx] = useState(null);
  const [deleteMx, setDeleteMx] = useState(null);
  const [mxFilter, setMxFilter] = useState('All');

  const getRoom = id => rooms.find(r => r.id === id);

  const hkStatusColor = { Clean: 'bg-emerald-50 border-emerald-200', Dirty: 'bg-red-50 border-red-200', 'In Progress': 'bg-amber-50 border-amber-200' };

  const filteredMx = maintenance.filter(m => mxFilter === 'All' || m.status === mxFilter)
    .sort((a, b) => {
      const pOrder = { High: 0, Medium: 1, Low: 2 };
      return pOrder[a.priority] - pOrder[b.priority];
    });

  const openCount = maintenance.filter(m => m.status !== 'Resolved').length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Operations</h1>
        <p className="text-sm text-gray-500">{openCount} open maintenance issue{openCount !== 1 ? 's' : ''}</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {[['housekeeping', 'Housekeeping', CheckSquare], ['maintenance', 'Maintenance', Wrench]].map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === id ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            <Icon size={16} />{label}
          </button>
        ))}
      </div>

      {tab === 'housekeeping' && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {housekeeping.map(hk => {
              const room = getRoom(hk.roomId);
              if (!room) return null;
              return (
                <Card key={hk.roomId} className={`p-4 border ${hkStatusColor[hk.status] || 'border-gray-100'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-bold text-gray-900">Room {room.number}</div>
                      <div className="text-xs text-gray-500">{room.type} · Floor {room.floor}</div>
                    </div>
                    <StatusBadge status={hk.status} />
                  </div>
                  <div className="text-xs text-gray-500 mb-3">Last cleaned: {formatDisplay(hk.lastCleaned)}</div>
                  {hk.assignedTo && <div className="text-xs text-gray-600 mb-3">👤 {hk.assignedTo}</div>}
                  <select value={hk.status}
                    onChange={e => { onUpdateHk(hk.roomId, { status: e.target.value, lastCleaned: e.target.value === 'Clean' ? todayStr() : hk.lastCleaned }); toast(`Room ${room.number} status updated`); }}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none focus:border-emerald-400">
                    {HK_STATUSES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'maintenance' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {['All', ...MX_STATUSES].map(s => (
                <button key={s} onClick={() => setMxFilter(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${mxFilter === s ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {s}
                </button>
              ))}
            </div>
            <Btn onClick={() => setShowAddMx(true)} size="sm"><Plus size={14} />Log Issue</Btn>
          </div>

          {filteredMx.length === 0 ? (
            <Card className="p-8 text-center">
              <Wrench size={32} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 font-medium">No maintenance issues</p>
              <p className="text-sm text-gray-400">All clear — or log a new issue.</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredMx.map(m => {
                const room = getRoom(m.roomId);
                const priorityColors = { High: 'border-l-red-500', Medium: 'border-l-amber-400', Low: 'border-l-blue-400' };
                return (
                  <Card key={m.id} className={`p-4 border-l-4 ${priorityColors[m.priority]}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-gray-800">Room {room?.number}</span>
                          <StatusBadge status={m.priority} />
                          <StatusBadge status={m.status} />
                        </div>
                        <p className="text-sm text-gray-700 mb-1">{m.issue}</p>
                        {m.notes && <p className="text-xs text-gray-500">{m.notes}</p>}
                        <p className="text-xs text-gray-400 mt-2">Reported {formatDisplay(m.reportedDate)}</p>
                      </div>
                      <div className="flex flex-col gap-1 shrink-0">
                        <select value={m.status}
                          onChange={e => { onUpdateMx(m.id, { status: e.target.value }); toast('Issue status updated'); }}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white outline-none">
                          {MX_STATUSES.map(s => <option key={s}>{s}</option>)}
                        </select>
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => setEditMx(m)} className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1">Edit</button>
                          <button onClick={() => setDeleteMx(m)} className="text-xs text-gray-400 hover:text-red-500 px-2 py-1">Delete</button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {showAddMx && (
        <Modal title="Log Maintenance Issue" onClose={() => setShowAddMx(false)}>
          <MaintenanceForm rooms={rooms} onSave={data => { onAddMx(data); toast('Maintenance issue logged'); }} onClose={() => setShowAddMx(false)} />
        </Modal>
      )}
      {editMx && (
        <Modal title="Edit Issue" onClose={() => setEditMx(null)}>
          <MaintenanceForm rooms={rooms} initial={editMx} onSave={data => { onUpdateMx(editMx.id, data); toast('Issue updated'); }} onClose={() => setEditMx(null)} />
        </Modal>
      )}
      {deleteMx && (
        <ConfirmDialog
          message="Delete this maintenance issue?"
          onConfirm={() => { onDeleteMx(deleteMx.id); setDeleteMx(null); toast('Issue removed', 'info'); }}
          onCancel={() => setDeleteMx(null)}
          confirmLabel="Delete" />
      )}
    </div>
  );
}
