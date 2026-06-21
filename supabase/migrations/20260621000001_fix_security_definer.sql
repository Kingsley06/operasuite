-- Fix SECURITY DEFINER functions to include explicit search_path
-- Required by Supabase to prevent search path injection

CREATE OR REPLACE FUNCTION get_my_hotel_id()
RETURNS uuid LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT hotel_id FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION create_housekeeping_for_room()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.housekeeping (hotel_id, room_id, status, last_cleaned)
  VALUES (NEW.hotel_id, NEW.id, 'Clean', CURRENT_DATE)
  ON CONFLICT (hotel_id, room_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION touch_housekeeping_updated_at()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
