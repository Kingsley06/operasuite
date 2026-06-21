import { useState, useMemo } from 'react';
import { TrendingUp, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Card, StatCard } from '../components/ui';
import { formatCurrency, formatDisplay, todayStr } from '../utils/dateUtils';

function exportCSV(bookings, rooms, guests) {
  const getGuest = id => guests.find(g => g.id === id);
  const getRoom = id => rooms.find(r => r.id === id);
  const headers = ['Booking ID', 'Guest Name', 'Room', 'Room Type', 'Check In', 'Check Out', 'Nights', 'Total (NGN)', 'Status', 'Payment'];
  const rows = bookings.filter(b => b.status !== 'Cancelled').map(b => {
    const g = getGuest(b.guestId);
    const r = getRoom(b.roomId);
    const nights = Math.round((new Date(b.checkOut) - new Date(b.checkIn)) / 86400000);
    return [b.id, g ? `${g.firstName} ${g.lastName}` : '', r?.number || '', r?.type || '', b.checkIn, b.checkOut, nights, b.totalAmount, b.status, b.paymentStatus].join(',');
  });
  const csv = [headers.join(','), ...rows].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = `revenue-${todayStr()}.csv`;
  a.click();
}

export default function Revenue({ bookings, rooms, guests }) {
  const today = new Date();
  const todayStr2 = todayStr();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const paid = bookings.filter(b => b.status !== 'Cancelled');

  const allTime = paid.reduce((s, b) => s + b.totalAmount, 0);

  const thisMonth = paid.filter(b => {
    const d = new Date(b.checkIn);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  }).reduce((s, b) => s + b.totalAmount, 0);

  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  const thisWeek = paid.filter(b => new Date(b.checkIn) >= startOfWeek).reduce((s, b) => s + b.totalAmount, 0);

  const todayRev = paid.filter(b => b.checkIn === todayStr2).reduce((s, b) => s + b.totalAmount, 0);

  const bookedRooms = rooms.filter(r => r.status === 'Booked').length;
  const occupancy = rooms.length > 0 ? Math.round((bookedRooms / rooms.length) * 100) : 0;

  // Revenue by room type
  const byType = useMemo(() => {
    const types = {};
    paid.forEach(b => {
      const room = rooms.find(r => r.id === b.roomId);
      if (room) {
        types[room.type] = (types[room.type] || 0) + b.totalAmount;
      }
    });
    return Object.entries(types).map(([type, total]) => ({ type, total }));
  }, [paid, rooms]);

  // Monthly revenue last 6 months
  const monthlyData = useMemo(() => {
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const label = d.toLocaleDateString('en-NG', { month: 'short' });
      const total = paid.filter(b => {
        const bd = new Date(b.checkIn);
        return bd.getMonth() === d.getMonth() && bd.getFullYear() === d.getFullYear();
      }).reduce((s, b) => s + b.totalAmount, 0);
      months.push({ month: label, total });
    }
    return months;
  }, [paid]);

  // Filtered bookings for table
  const filtered = paid.filter(b => {
    if (dateFrom && b.checkIn < dateFrom) return false;
    if (dateTo && b.checkIn > dateTo) return false;
    return true;
  }).sort((a, b) => b.checkIn.localeCompare(a.checkIn));

  const getGuest = id => guests.find(g => g.id === id);
  const getRoom = id => rooms.find(r => r.id === id);

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Revenue</h1>
          <p className="text-sm text-gray-500">Financial overview</p>
        </div>
        <button onClick={() => exportCSV(bookings, rooms, guests)}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm">
          <Download size={16} />Export CSV
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="All Time Revenue" value={formatCurrency(allTime)} color="emerald" />
        <StatCard icon={TrendingUp} label="This Month" value={formatCurrency(thisMonth)} color="blue" />
        <StatCard icon={TrendingUp} label="This Week" value={formatCurrency(thisWeek)} color="purple" />
        <StatCard icon={TrendingUp} label="Today" value={formatCurrency(todayRev)} color="amber" />
      </div>

      {/* Occupancy + Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Occupancy */}
        <Card className="p-5 flex flex-col items-center justify-center">
          <div className="text-sm font-medium text-gray-500 mb-3">Current Occupancy</div>
          <div className="relative w-32 h-32">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="12" />
              <circle cx="50" cy="50" r="40" fill="none" stroke="#10b981" strokeWidth="12"
                strokeDasharray={`${occupancy * 2.51} 251`} strokeLinecap="round" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold text-gray-900">{occupancy}%</span>
            </div>
          </div>
          <div className="text-sm text-gray-500 mt-3">{bookedRooms} of {rooms.length} rooms occupied</div>
        </Card>

        {/* Revenue by type */}
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Revenue by Room Type</h3>
          {byType.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data yet</p>
          ) : (
            <div className="space-y-3">
              {byType.map((item, i) => {
                const max = Math.max(...byType.map(b => b.total));
                const pct = max > 0 ? (item.total / max) * 100 : 0;
                return (
                  <div key={item.type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700">{item.type}</span>
                      <span className="text-gray-600">{formatCurrency(item.total)}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Monthly chart */}
        <Card className="p-5">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Monthly Revenue</h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={monthlyData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis hide />
              <Tooltip formatter={(v) => [formatCurrency(v), 'Revenue']} contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }} />
              <Bar dataKey="total" radius={[4, 4, 0, 0]}>
                {monthlyData.map((_, i) => <Cell key={i} fill={i === monthlyData.length - 1 ? '#10b981' : '#d1fae5'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Bookings table with filter */}
      <Card>
        <div className="p-5 border-b border-gray-100 flex items-center justify-between flex-wrap gap-3">
          <h3 className="font-semibold text-gray-900">Booking Revenue</h3>
          <div className="flex items-center gap-2 text-sm">
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-emerald-400" />
            <span className="text-gray-400">to</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm outline-none focus:border-emerald-400" />
            {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Guest', 'Room', 'Check In', 'Check Out', 'Amount', 'Status', 'Payment'].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(b => {
                const g = getGuest(b.guestId);
                const r = getRoom(b.roomId);
                return (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-medium text-gray-800">{g ? `${g.firstName} ${g.lastName}` : '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{r ? `${r.number} (${r.type})` : '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDisplay(b.checkIn)}</td>
                    <td className="px-4 py-3 text-gray-600">{formatDisplay(b.checkOut)}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{formatCurrency(b.totalAmount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${b.status === 'Active' ? 'bg-emerald-100 text-emerald-700' : b.status === 'Checked Out' ? 'bg-gray-100 text-gray-600' : 'bg-amber-100 text-amber-700'}`}>{b.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${b.paymentStatus === 'Paid' ? 'bg-emerald-100 text-emerald-700' : b.paymentStatus === 'Partial' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>{b.paymentStatus}</span>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No bookings in this date range</td></tr>
              )}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td colSpan={4} className="px-4 py-3 text-sm font-semibold text-gray-700">Total ({filtered.length} bookings)</td>
                  <td className="px-4 py-3 text-sm font-bold text-emerald-700">{formatCurrency(filtered.reduce((s, b) => s + b.totalAmount, 0))}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>
    </div>
  );
}
