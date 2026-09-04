import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Bookings from './pages/Bookings';
import Guests from './pages/Guests';
import Operations from './pages/Operations';
import Communications from './pages/Communications';
import Revenue from './pages/Revenue';
import SmartPricing from './pages/SmartPricing';
import Login from './pages/Login';
import { useStore } from './hooks/useStore';
import { ToastProvider, useToast } from './context/ToastContext';
import { HotelProvider, useHotel } from './context/HotelContext';
import { supabase } from './lib/supabase';

// ── First-time setup screen shown when hotel_id is null ───────────────────────
function HotelSetup({ onDone }) {
  const { createHotel } = useHotel();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', address: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      await createHotel(form);
      toast('Hotel profile created — welcome to Opera Suite!', 'success');
      onDone();
    } catch (err) {
      toast(err.message || 'Failed to create hotel', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-emerald-700">Opera Suite</h1>
          <p className="text-gray-500 mt-1">Let's set up your hotel profile</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hotel Name <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={e => set('name', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Eko Hotels & Suites"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Hotel Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="info@yourhotel.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              value={form.phone}
              onChange={e => set('phone', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="+234 800 000 0000"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            <input
              value={form.address}
              onChange={e => set('address', e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              placeholder="Victoria Island, Lagos"
            />
          </div>
          <button
            type="submit"
            disabled={saving || !form.name.trim()}
            className="w-full bg-emerald-700 text-white py-2 rounded-lg font-medium hover:bg-emerald-800 transition disabled:opacity-50"
          >
            {saving ? 'Creating…' : 'Create Hotel Profile'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Main authenticated shell ───────────────────────────────────────────────────
function AppShell({ session }) {
  const [page, setPage] = useState('dashboard');
  const toast = useToast();
  const { hotelId, loading: hotelLoading, refresh } = useHotel();

  const store = useStore(hotelId);
  const [commsUnread, setCommsUnread] = useState(0);

  const loadCommsUnread = useCallback(async () => {
    if (!hotelId) return;
    const { count } = await supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('hotel_id', hotelId)
      .gt('unread_count', 0);
    setCommsUnread(count ?? 0);
  }, [hotelId]);

  useEffect(() => { loadCommsUnread(); }, [loadCommsUnread]);

  useEffect(() => {
    if (!hotelId) return;
    const ch = supabase
      .channel(`hotel:${hotelId}:comms-badge`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations', filter: `hotel_id=eq.${hotelId}` }, loadCommsUnread)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [hotelId, loadCommsUnread]);

  // Wrap every store mutation so pages don't need try/catch
  const wrap = useCallback((fn, successMsg) => async (...args) => {
    try {
      const result = await fn(...args);
      if (successMsg) toast(successMsg, 'success');
      return result;
    } catch (err) {
      toast(err.message || 'Something went wrong', 'error');
      return null;
    }
  }, [toast]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (hotelLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading Opera Suite…</p>
      </div>
    );
  }

  // Owner hasn't set up their hotel yet
  if (!hotelId) {
    return <HotelSetup onDone={refresh} />;
  }

  const pageProps = {
    rooms:        store.rooms,
    guests:       store.guests,
    bookings:     store.bookings,
    housekeeping: store.housekeeping,
    maintenance:  store.maintenance,
    storeLoading: store.loading,
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard':
        return <Dashboard {...pageProps} />;

      case 'rooms':
        return (
          <Rooms
            {...pageProps}
            onAdd={wrap(store.addRoom, 'Room added')}
            onUpdate={wrap(store.updateRoom)}
            onDelete={wrap(store.deleteRoom, 'Room deleted')}
          />
        );

      case 'bookings':
        return (
          <Bookings
            {...pageProps}
            onAdd={wrap(store.addBooking)}
            onCancel={wrap(store.cancelBooking)}
            onCheckOut={wrap(store.checkOutBooking)}
            onUpdate={wrap(store.updateBooking)}
          />
        );

      case 'guests':
        return (
          <Guests
            {...pageProps}
            onAdd={wrap(store.addGuest, 'Guest added')}
            onUpdate={wrap(store.updateGuest)}
            onDelete={wrap(store.deleteGuest, 'Guest removed')}
          />
        );

      case 'operations':
        return (
          <Operations
            {...pageProps}
            onUpdateHk={wrap(store.updateHousekeeping)}
            onAddMx={wrap(store.addMaintenance, 'Issue logged')}
            onUpdateMx={wrap(store.updateMaintenance)}
            onDeleteMx={wrap(store.deleteMaintenance, 'Issue removed')}
          />
        );

      case 'communications':
        return <Communications />;

      case 'revenue':
        return <Revenue {...pageProps} />;

      case 'smartpricing':
        return (
          <SmartPricing
            rooms={store.rooms}
            bookings={store.bookings}
            onUpdateRoom={wrap(store.updateRoom)}
          />
        );

      default:
        return <Dashboard {...pageProps} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        active={page}
        onNavigate={setPage}
        onLogout={handleLogout}
        user={session.user}
        badges={commsUnread > 0 ? { communications: String(commsUnread) } : {}}
      />
      <main className="flex-1 overflow-auto">
        {store.loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-gray-400">Loading hotel data…</p>
          </div>
        ) : (
          <div className="pt-14 lg:pt-0 p-4 sm:p-6 max-w-7xl mx-auto">
            {renderPage()}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Root: manages auth session, then hands off to HotelProvider ───────────────
function AppContent() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-lg">Loading Opera Suite…</p>
      </div>
    );
  }

  if (!session) return <Login />;

  return (
    <HotelProvider userId={session.user.id}>
      <AppShell session={session} />
    </HotelProvider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
