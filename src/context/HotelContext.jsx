import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const HotelContext = createContext(null);

function toCamel(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [
      k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()),
      v,
    ])
  );
}

export function HotelProvider({ userId, children }) {
  const [profile, setProfile] = useState(null);
  const [hotel, setHotel] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: prof, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profErr) throw profErr;
      const camelProfile = prof ? toCamel(prof) : null;
      setProfile(camelProfile);

      if (camelProfile?.hotelId) {
        const { data: hotelData, error: hotelErr } = await supabase
          .from('hotels')
          .select('*')
          .eq('id', camelProfile.hotelId)
          .single();
        if (hotelErr) throw hotelErr;
        setHotel(toCamel(hotelData));
      } else {
        setHotel(null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  // Called from the first-time onboarding form
  const createHotel = async ({ name, email, phone, address }) => {
    const hotelId = crypto.randomUUID();

    const { error: hotelErr } = await supabase
      .from('hotels')
      .insert({ id: hotelId, name, email, phone, address });
    if (hotelErr) throw hotelErr;

    const { error: profErr } = await supabase
      .from('profiles')
      .update({ hotel_id: hotelId, role: 'owner' })
      .eq('id', userId);
    if (profErr) throw profErr;

    await load();
  };

  const role = profile?.role || 'front_desk';
  const isOwner       = role === 'owner';
  const isManagement  = role === 'management';
  const isFrontDesk   = role === 'front_desk';
  const canManageRooms   = isOwner || isManagement;
  const canDeleteGuests  = isOwner || isManagement;
  const canViewRevenue   = isOwner || isManagement;
  const canAccessPricing = isOwner || isManagement;

  const roleLabel = { owner: 'Owner', management: 'Management', front_desk: 'Front Desk' }[role] ?? 'Staff';

  return (
    <HotelContext.Provider value={{
      profile,
      hotel,
      hotelId:   profile?.hotelId ?? null,
      hotelName: hotel?.name ?? '',
      role,
      roleLabel,
      isOwner,
      isManagement,
      isFrontDesk,
      canManageRooms,
      canDeleteGuests,
      canViewRevenue,
      canAccessPricing,
      loading,
      error,
      refresh:     load,
      createHotel,
    }}>
      {children}
    </HotelContext.Provider>
  );
}

export const useHotel = () => useContext(HotelContext);
