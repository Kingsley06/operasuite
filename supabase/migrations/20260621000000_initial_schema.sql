-- ============================================================
--  Opera Suite — Multi-Tenant Supabase Schema
--  v2: drops any legacy tables before recreating cleanly
-- ============================================================

-- Drop legacy tables (safe: all data is demo)
DROP TABLE IF EXISTS maintenance   CASCADE;
DROP TABLE IF EXISTS housekeeping  CASCADE;
DROP TABLE IF EXISTS bookings      CASCADE;
DROP TABLE IF EXISTS guests        CASCADE;
DROP TABLE IF EXISTS rooms         CASCADE;
DROP TABLE IF EXISTS profiles      CASCADE;
DROP TABLE IF EXISTS hotels        CASCADE;

-- Drop any old functions
DROP FUNCTION IF EXISTS get_my_hotel_id() CASCADE;
DROP FUNCTION IF EXISTS get_my_role()     CASCADE;
DROP FUNCTION IF EXISTS handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS create_housekeeping_for_room() CASCADE;
DROP FUNCTION IF EXISTS touch_housekeeping_updated_at() CASCADE;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ============================================================
--  TABLES
-- ============================================================

CREATE TABLE hotels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text,
  phone       text,
  address     text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id    uuid REFERENCES hotels(id) ON DELETE SET NULL,
  role        text NOT NULL DEFAULT 'front_desk'
                CHECK (role IN ('owner', 'management', 'front_desk')),
  full_name   text NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE rooms (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id         uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  number           text NOT NULL,
  type             text NOT NULL CHECK (type IN ('Single', 'Double', 'Suite')),
  floor            integer NOT NULL,
  status           text NOT NULL DEFAULT 'Available'
                     CHECK (status IN ('Available', 'Booked', 'Maintenance', 'Cleaning')),
  price_per_night  numeric(12,2) NOT NULL,
  amenities        text[] DEFAULT '{}',
  created_at       timestamptz DEFAULT now(),
  UNIQUE (hotel_id, number)
);

CREATE TABLE guests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  first_name   text NOT NULL,
  last_name    text NOT NULL,
  email        text,
  phone        text NOT NULL,
  id_type      text CHECK (id_type IN ('NIN', 'International Passport', 'Driver''s License')),
  id_number    text,
  total_stays  integer NOT NULL DEFAULT 0,
  last_visit   date,
  notes        text NOT NULL DEFAULT '',
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE bookings (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id        uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  guest_id        uuid NOT NULL REFERENCES guests(id) ON DELETE RESTRICT,
  room_id         uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  check_in        date NOT NULL,
  check_out       date NOT NULL,
  status          text NOT NULL DEFAULT 'Upcoming'
                    CHECK (status IN ('Active', 'Upcoming', 'Checked Out', 'Cancelled')),
  payment_status  text NOT NULL DEFAULT 'Unpaid'
                    CHECK (payment_status IN ('Unpaid', 'Partial', 'Paid', 'Refunded')),
  total_amount    numeric(12,2) NOT NULL,
  notes           text NOT NULL DEFAULT '',
  created_at      timestamptz DEFAULT now(),
  CONSTRAINT check_out_after_check_in CHECK (check_out > check_in)
);

ALTER TABLE bookings
  ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status NOT IN ('Cancelled', 'Checked Out'));

CREATE TABLE housekeeping (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id     uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_id      uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'Clean'
                 CHECK (status IN ('Clean', 'Dirty', 'In Progress')),
  last_cleaned date,
  assigned_to  text NOT NULL DEFAULT '',
  updated_at   timestamptz DEFAULT now(),
  UNIQUE (hotel_id, room_id)
);

CREATE TABLE maintenance (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id       uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  room_id        uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  issue          text NOT NULL,
  priority       text NOT NULL DEFAULT 'Medium'
                   CHECK (priority IN ('Low', 'Medium', 'High')),
  status         text NOT NULL DEFAULT 'Open'
                   CHECK (status IN ('Open', 'In Progress', 'Resolved')),
  reported_date  date NOT NULL DEFAULT CURRENT_DATE,
  notes          text NOT NULL DEFAULT '',
  created_at     timestamptz DEFAULT now()
);

-- ============================================================
--  HELPER FUNCTIONS
-- ============================================================

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

-- ============================================================
--  TRIGGERS
-- ============================================================

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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

CREATE OR REPLACE FUNCTION create_housekeeping_for_room()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO housekeeping (hotel_id, room_id, status, last_cleaned)
  VALUES (NEW.hotel_id, NEW.id, 'Clean', CURRENT_DATE)
  ON CONFLICT (hotel_id, room_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_room_created ON rooms;
CREATE TRIGGER on_room_created
  AFTER INSERT ON rooms
  FOR EACH ROW EXECUTE FUNCTION create_housekeeping_for_room();

CREATE OR REPLACE FUNCTION touch_housekeeping_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_housekeeping_updated ON housekeeping;
CREATE TRIGGER on_housekeeping_updated
  BEFORE UPDATE ON housekeeping
  FOR EACH ROW EXECUTE FUNCTION touch_housekeeping_updated_at();

-- ============================================================
--  ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE hotels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests       ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance  ENABLE ROW LEVEL SECURITY;

-- hotels
CREATE POLICY "View own hotel"      ON hotels FOR SELECT USING (id = get_my_hotel_id());
CREATE POLICY "Owner updates hotel" ON hotels FOR UPDATE USING (id = get_my_hotel_id() AND get_my_role() = 'owner');

-- profiles
CREATE POLICY "View own profile"   ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Owner views hotel profiles" ON profiles FOR SELECT
  USING (hotel_id = get_my_hotel_id() AND get_my_role() = 'owner');

-- rooms
CREATE POLICY "Staff view rooms"       ON rooms FOR SELECT USING (hotel_id = get_my_hotel_id());
CREATE POLICY "Mgmt insert rooms"      ON rooms FOR INSERT WITH CHECK (hotel_id = get_my_hotel_id() AND get_my_role() IN ('owner','management'));
CREATE POLICY "Mgmt update rooms"      ON rooms FOR UPDATE USING     (hotel_id = get_my_hotel_id() AND get_my_role() IN ('owner','management'));
CREATE POLICY "Owner deletes rooms"    ON rooms FOR DELETE USING     (hotel_id = get_my_hotel_id() AND get_my_role() = 'owner');
CREATE POLICY "FD updates room status" ON rooms FOR UPDATE USING     (hotel_id = get_my_hotel_id());

-- guests
CREATE POLICY "Staff view guests"   ON guests FOR SELECT USING (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff insert guests" ON guests FOR INSERT WITH CHECK (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff update guests" ON guests FOR UPDATE USING   (hotel_id = get_my_hotel_id());
CREATE POLICY "Mgmt delete guests"  ON guests FOR DELETE USING   (hotel_id = get_my_hotel_id() AND get_my_role() IN ('owner','management'));

-- bookings
CREATE POLICY "Staff view bookings"   ON bookings FOR SELECT USING (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff insert bookings" ON bookings FOR INSERT WITH CHECK (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff update bookings" ON bookings FOR UPDATE USING   (hotel_id = get_my_hotel_id());
CREATE POLICY "Mgmt delete bookings"  ON bookings FOR DELETE USING   (hotel_id = get_my_hotel_id() AND get_my_role() IN ('owner','management'));

-- housekeeping
CREATE POLICY "Staff view hk"   ON housekeeping FOR SELECT USING (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff insert hk" ON housekeeping FOR INSERT WITH CHECK (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff update hk" ON housekeeping FOR UPDATE USING   (hotel_id = get_my_hotel_id());

-- maintenance
CREATE POLICY "Staff view mx"   ON maintenance FOR SELECT USING (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff insert mx" ON maintenance FOR INSERT WITH CHECK (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff update mx" ON maintenance FOR UPDATE USING   (hotel_id = get_my_hotel_id());
CREATE POLICY "Mgmt delete mx"  ON maintenance FOR DELETE USING   (hotel_id = get_my_hotel_id() AND get_my_role() IN ('owner','management'));

-- ============================================================
--  INSERT YOUR FIRST HOTEL AFTER RUNNING THIS SCRIPT:
--
--  1. Sign up via the app (or Auth → Users → Invite user)
--
--  2. In SQL Editor:
--       INSERT INTO hotels (name, email, phone, address)
--       VALUES ('Your Hotel Name', 'info@hotel.com', '+234...', 'Lagos')
--       RETURNING id;
--
--  3. Link yourself as owner (replace UUIDs):
--       UPDATE profiles
--       SET hotel_id = '<hotel_uuid>', role = 'owner', full_name = 'Your Name'
--       WHERE id = '<your_auth_uuid>';
-- ============================================================
