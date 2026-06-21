import { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Rooms from './pages/Rooms';
import Bookings from './pages/Bookings';
import Guests from './pages/Guests';
import Operations from './pages/Operations';
import Revenue from './pages/Revenue';
import SmartPricing from './pages/SmartPricing';
import Login from './pages/Login';
import { useStore } from './hooks/useStore';
import { ToastProvider } from './context/ToastContext';
import { supabase } from './lib/supabase';

function AppContent() {
  const [page, setPage] = useState('dashboard');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const store = useStore();

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 text-lg">Loading Opera Suite...</p>
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  const pageProps = {
    rooms: store.rooms,
    guests: store.guests,
    bookings: store.bookings,
    housekeeping: store.housekeeping,
    maintenance: store.maintenance,
  };

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard {...pageProps} />;
      case 'rooms': return <Rooms {...pageProps} onAdd={store.addRoom} onUpdate={store.updateRoom} onDelete={store.deleteRoom} />;
      case 'bookings': return <Bookings {...pageProps} onAdd={store.addBooking} onCancel={store.cancelBooking} onCheckOut={store.checkOutBooking} onUpdate={store.updateBooking} />;
      case 'guests': return <Guests {...pageProps} onAdd={store.addGuest} onUpdate={store.updateGuest} onDelete={store.deleteGuest} />;
      case 'operations': return <Operations {...pageProps} onUpdateHk={store.updateHousekeeping} onAddMx={store.addMaintenance} onUpdateMx={store.updateMaintenance} onDeleteMx={store.deleteMaintenance} />;
      case 'revenue': return <Revenue {...pageProps} />;
      case 'smartpricing': return <SmartPricing rooms={store.rooms} bookings={store.bookings} onUpdateRoom={store.updateRoom} />;
      default: return <Dashboard {...pageProps} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar active={page} onNavigate={setPage} onLogout={handleLogout} user={session.user} />
      <main className="flex-1 overflow-auto">
        <div className="pt-14 lg:pt-0 p-4 sm:p-6 max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}