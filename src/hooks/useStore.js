import { useState, useEffect } from 'react';
import { mockRooms, mockGuests, mockBookings, mockHousekeeping, mockMaintenance } from '../data/mockData';

function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

export function useStore() {
  const [rooms, setRooms] = useLocalStorage('hotel_rooms', mockRooms);
  const [guests, setGuests] = useLocalStorage('hotel_guests', mockGuests);
  const [bookings, setBookings] = useLocalStorage('hotel_bookings', mockBookings);
  const [housekeeping, setHousekeeping] = useLocalStorage('hotel_housekeeping', mockHousekeeping);
  const [maintenance, setMaintenance] = useLocalStorage('hotel_maintenance', mockMaintenance);

  // Rooms
  const addRoom = (room) => setRooms(prev => [...prev, { ...room, id: 'r' + Date.now() }]);
  const updateRoom = (id, updates) => setRooms(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  const deleteRoom = (id) => setRooms(prev => prev.filter(r => r.id !== id));

  // Guests
  const addGuest = (guest) => {
    const newGuest = { ...guest, id: 'g' + Date.now(), totalStays: 0, lastVisit: '' };
    setGuests(prev => [...prev, newGuest]);
    return newGuest;
  };
  const updateGuest = (id, updates) => setGuests(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  const deleteGuest = (id) => setGuests(prev => prev.filter(g => g.id !== id));

  // Bookings
  const addBooking = (booking) => {
    const newBooking = { ...booking, id: 'b' + Date.now(), status: 'Active', paymentStatus: 'Unpaid' };
    setBookings(prev => [...prev, newBooking]);
    // Update room status
    updateRoom(booking.roomId, { status: 'Booked' });
    // Update guest stats
    const guest = guests.find(g => g.id === booking.guestId);
    if (guest) {
      updateGuest(booking.guestId, {
        totalStays: (guest.totalStays || 0) + 1,
        lastVisit: booking.checkIn,
      });
    }
    return newBooking;
  };
  const updateBooking = (id, updates) => setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  const cancelBooking = (id) => {
    const booking = bookings.find(b => b.id === id);
    if (booking) {
      updateBooking(id, { status: 'Cancelled' });
      // Free up the room if no other active bookings
      const otherActive = bookings.filter(b => b.roomId === booking.roomId && b.id !== id && b.status === 'Active');
      if (otherActive.length === 0) updateRoom(booking.roomId, { status: 'Available' });
    }
  };
  const checkOutBooking = (id) => {
    const booking = bookings.find(b => b.id === id);
    if (booking) {
      updateBooking(id, { status: 'Checked Out' });
      updateRoom(booking.roomId, { status: 'Cleaning' });
      // Update housekeeping
      setHousekeeping(prev => prev.map(h => h.roomId === booking.roomId ? { ...h, status: 'Dirty' } : h));
    }
  };

  // Housekeeping
  const updateHousekeeping = (roomId, updates) =>
    setHousekeeping(prev => prev.map(h => h.roomId === roomId ? { ...h, ...updates } : h));

  // Maintenance
  const addMaintenance = (issue) => setMaintenance(prev => [...prev, { ...issue, id: 'm' + Date.now() }]);
  const updateMaintenance = (id, updates) => setMaintenance(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  const deleteMaintenance = (id) => setMaintenance(prev => prev.filter(m => m.id !== id));

  return {
    rooms, guests, bookings, housekeeping, maintenance,
    addRoom, updateRoom, deleteRoom,
    addGuest, updateGuest, deleteGuest,
    addBooking, updateBooking, cancelBooking, checkOutBooking,
    updateHousekeeping,
    addMaintenance, updateMaintenance, deleteMaintenance,
  };
}
