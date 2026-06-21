import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ── Case converters (only at the Supabase boundary) ──────────────────────────

function toCamel(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      v,
    ])
  );
}

function toSnake(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    const snake = k.replace(/([A-Z])/g, c => '_' + c.toLowerCase());
    result[snake] = v;
  }
  return result;
}

const camelize = rows => (rows ?? []).map(toCamel);

// ── Main store hook ───────────────────────────────────────────────────────────

export function useStore(hotelId) {
  const [rooms, setRooms]           = useState([]);
  const [guests, setGuests]         = useState([]);
  const [bookings, setBookings]     = useState([]);
  const [housekeeping, setHousekeeping] = useState([]);
  const [maintenance, setMaintenance]   = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);

  const load = useCallback(async () => {
    if (!hotelId) return;
    setLoading(true);
    setError(null);
    try {
      const [r, g, b, h, m] = await Promise.all([
        supabase.from('rooms').select('*').eq('hotel_id', hotelId).order('number'),
        supabase.from('guests').select('*').eq('hotel_id', hotelId).order('last_name'),
        supabase.from('bookings').select('*').eq('hotel_id', hotelId).order('created_at', { ascending: false }),
        supabase.from('housekeeping').select('*').eq('hotel_id', hotelId),
        supabase.from('maintenance').select('*').eq('hotel_id', hotelId).order('created_at', { ascending: false }),
      ]);

      for (const res of [r, g, b, h, m]) {
        if (res.error) throw res.error;
      }

      setRooms(camelize(r.data));
      setGuests(camelize(g.data));
      setBookings(camelize(b.data));
      setHousekeeping(camelize(h.data));
      setMaintenance(camelize(m.data));
    } catch (err) {
      setError(err.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [hotelId]);

  useEffect(() => { load(); }, [load]);

  // ── ROOMS ─────────────────────────────────────────────────────────────────

  const addRoom = async (room) => {
    const { data, error } = await supabase
      .from('rooms')
      .insert({ ...toSnake(room), hotel_id: hotelId })
      .select()
      .single();
    if (error) throw error;
    const newRoom = toCamel(data);
    setRooms(prev => [...prev, newRoom].sort((a, b) => a.number.localeCompare(b.number)));
    return newRoom;
  };

  const updateRoom = async (id, updates) => {
    const { data, error } = await supabase
      .from('rooms')
      .update(toSnake(updates))
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select()
      .single();
    if (error) throw error;
    const updated = toCamel(data);
    setRooms(prev => prev.map(r => r.id === id ? updated : r));
    return updated;
  };

  const deleteRoom = async (id) => {
    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('id', id)
      .eq('hotel_id', hotelId);
    if (error) throw error;
    setRooms(prev => prev.filter(r => r.id !== id));
  };

  // ── GUESTS ────────────────────────────────────────────────────────────────

  const addGuest = async (guest) => {
    const { data, error } = await supabase
      .from('guests')
      .insert({ ...toSnake(guest), hotel_id: hotelId, total_stays: 0 })
      .select()
      .single();
    if (error) throw error;
    const newGuest = toCamel(data);
    setGuests(prev => [...prev, newGuest]);
    return newGuest;
  };

  const updateGuest = async (id, updates) => {
    const { data, error } = await supabase
      .from('guests')
      .update(toSnake(updates))
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select()
      .single();
    if (error) throw error;
    const updated = toCamel(data);
    setGuests(prev => prev.map(g => g.id === id ? updated : g));
    return updated;
  };

  const deleteGuest = async (id) => {
    const { error } = await supabase
      .from('guests')
      .delete()
      .eq('id', id)
      .eq('hotel_id', hotelId);
    if (error) throw error;
    setGuests(prev => prev.filter(g => g.id !== id));
  };

  // ── BOOKINGS ──────────────────────────────────────────────────────────────

  const addBooking = async (booking) => {
    const today = new Date().toISOString().split('T')[0];
    const status = booking.checkIn <= today ? 'Active' : 'Upcoming';

    const { data, error } = await supabase
      .from('bookings')
      .insert({
        ...toSnake(booking),
        hotel_id: hotelId,
        status,
      })
      .select()
      .single();
    if (error) throw error;

    const newBooking = toCamel(data);
    setBookings(prev => [newBooking, ...prev]);

    // Mark room as Booked
    await updateRoom(booking.roomId, { status: 'Booked' });

    return newBooking;
  };

  const updateBooking = async (id, updates) => {
    const { data, error } = await supabase
      .from('bookings')
      .update(toSnake(updates))
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select()
      .single();
    if (error) throw error;
    const updated = toCamel(data);
    setBookings(prev => prev.map(b => b.id === id ? updated : b));
    return updated;
  };

  const cancelBooking = async (id) => {
    // Read fresh booking state from current state snapshot
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;

    await updateBooking(id, { status: 'Cancelled' });

    // Free the room if no other active/upcoming bookings remain for it
    const stillActive = bookings.filter(b =>
      b.roomId === booking.roomId &&
      b.id !== id &&
      !['Cancelled', 'Checked Out'].includes(b.status)
    );
    if (stillActive.length === 0) {
      await updateRoom(booking.roomId, { status: 'Available' });
    }
  };

  const checkOutBooking = async (id) => {
    const booking = bookings.find(b => b.id === id);
    if (!booking) return;

    await updateBooking(id, { status: 'Checked Out' });
    await updateRoom(booking.roomId, { status: 'Cleaning' });

    // Increment total stays ONLY on actual checkout
    const guest = guests.find(g => g.id === booking.guestId);
    if (guest) {
      await updateGuest(booking.guestId, {
        totalStays: (guest.totalStays ?? 0) + 1,
        lastVisit: booking.checkOut,
      });
    }

    // Mark room as dirty in housekeeping
    const hkEntry = housekeeping.find(h => h.roomId === booking.roomId);
    if (hkEntry) {
      await updateHousekeeping(booking.roomId, { status: 'Dirty' });
    }
  };

  // ── HOUSEKEEPING ──────────────────────────────────────────────────────────

  const updateHousekeeping = async (roomId, updates) => {
    const { data, error } = await supabase
      .from('housekeeping')
      .update(toSnake(updates))
      .eq('room_id', roomId)
      .eq('hotel_id', hotelId)
      .select()
      .single();
    if (error) throw error;
    const updated = toCamel(data);
    setHousekeeping(prev => prev.map(h => h.roomId === roomId ? updated : h));
    return updated;
  };

  // ── MAINTENANCE ───────────────────────────────────────────────────────────

  const addMaintenance = async (issue) => {
    const { data, error } = await supabase
      .from('maintenance')
      .insert({ ...toSnake(issue), hotel_id: hotelId })
      .select()
      .single();
    if (error) throw error;
    const newIssue = toCamel(data);
    setMaintenance(prev => [newIssue, ...prev]);
    return newIssue;
  };

  const updateMaintenance = async (id, updates) => {
    const { data, error } = await supabase
      .from('maintenance')
      .update(toSnake(updates))
      .eq('id', id)
      .eq('hotel_id', hotelId)
      .select()
      .single();
    if (error) throw error;
    const updated = toCamel(data);
    setMaintenance(prev => prev.map(m => m.id === id ? updated : m));
    return updated;
  };

  const deleteMaintenance = async (id) => {
    const { error } = await supabase
      .from('maintenance')
      .delete()
      .eq('id', id)
      .eq('hotel_id', hotelId);
    if (error) throw error;
    setMaintenance(prev => prev.filter(m => m.id !== id));
  };

  return {
    rooms, guests, bookings, housekeeping, maintenance,
    loading, error, reload: load,
    addRoom, updateRoom, deleteRoom,
    addGuest, updateGuest, deleteGuest,
    addBooking, updateBooking, cancelBooking, checkOutBooking,
    updateHousekeeping,
    addMaintenance, updateMaintenance, deleteMaintenance,
  };
}
