-- ============================================================
--  Opera Suite — Multi-Tenant Supabase Schema
--  Run this entire file in your Supabase SQL Editor once.
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist";  -- needed for no-overlap constraint on bookings

-- ============================================================
--  TABLES
-- ============================================================

-- Hotels (one row per subscribed hotel = one tenant)
CREATE TABLE IF NOT EXISTS hotels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text,
  phone       text,
  address     text,
  created_at  timestamptz DEFAULT now()
);

-- Profiles: extends auth.users, links a user to a hotel + role
CREATE TABLE IF NOT EXISTS profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  hotel_id    uuid REFERENCES hotels(id) ON DELETE SET NULL,
  role        text NOT NULL DEFAULT 'front_desk'
                CHECK (role IN ('owner', 'management', 'front_desk')),
  full_name   text NOT NULL DEFAULT '',
  created_at  timestamptz DEFAULT now()
);

-- Rooms
CREATE TABLE IF NOT EXISTS rooms (
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

-- Guests
CREATE TABLE IF NOT EXISTS guests (
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

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
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

-- Prevent double-booking at the database level
ALTER TABLE bookings
  ADD CONSTRAINT no_double_booking
  EXCLUDE USING gist (
    room_id WITH =,
    daterange(check_in, check_out, '[)') WITH &&
  ) WHERE (status NOT IN ('Cancelled', 'Checked Out'));

-- Housekeeping (one record per room, upserted)
CREATE TABLE IF NOT EXISTS housekeeping (
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

-- Maintenance issues
CREATE TABLE IF NOT EXISTS maintenance (
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
--  COMMUNICATIONS HUB
--  Multi-channel guest messaging (WhatsApp / Instagram / Messenger)
--  + AI receptionist tables
-- ============================================================

-- Connected social/messaging accounts (one row per hotel per account)
CREATE TABLE IF NOT EXISTS channels (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  type                text NOT NULL CHECK (type IN ('whatsapp', 'instagram', 'messenger')),
  display_name        text NOT NULL DEFAULT '',
  external_account_id text NOT NULL,
  ai_autonomous        boolean NOT NULL DEFAULT true,
  is_active            boolean NOT NULL DEFAULT true,
  created_at           timestamptz DEFAULT now(),
  UNIQUE (hotel_id, type, external_account_id)
);

-- Access tokens / secrets for each channel. Deliberately separate from
-- `channels` so RLS can let staff manage channel metadata while nobody
-- (not even authenticated users) can ever read a token through the API —
-- only the service-role key used inside Edge Functions can.
CREATE TABLE IF NOT EXISTS channel_secrets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id    uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  access_token  text NOT NULL,
  app_secret    text NOT NULL,
  verify_token  text NOT NULL,
  created_at    timestamptz DEFAULT now(),
  UNIQUE (channel_id)
);

-- One conversation per (channel, external contact)
CREATE TABLE IF NOT EXISTS conversations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id              uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  channel_id            uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  guest_id              uuid REFERENCES guests(id) ON DELETE SET NULL,
  external_contact_id   text NOT NULL,
  contact_name          text NOT NULL DEFAULT '',
  status                text NOT NULL DEFAULT 'open'
                          CHECK (status IN ('open', 'resolved', 'needs_attention')),
  ai_handled            boolean NOT NULL DEFAULT true,
  last_message_at       timestamptz,
  last_message_preview  text NOT NULL DEFAULT '',
  unread_count          integer NOT NULL DEFAULT 0,
  created_at            timestamptz DEFAULT now(),
  UNIQUE (channel_id, external_contact_id)
);

-- Individual messages within a conversation
CREATE TABLE IF NOT EXISTS messages (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id            uuid NOT NULL REFERENCES hotels(id) ON DELETE CASCADE,
  conversation_id     uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  direction           text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender              text NOT NULL CHECK (sender IN ('guest', 'ai', 'staff')),
  staff_id            uuid REFERENCES profiles(id) ON DELETE SET NULL,
  body                text NOT NULL DEFAULT '',
  external_message_id text,
  metadata             jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at           timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conversations_hotel ON conversations (hotel_id, last_message_at DESC);

-- ============================================================
--  HELPER FUNCTIONS (used by RLS policies)
-- ============================================================

-- Returns the calling user's hotel_id
CREATE OR REPLACE FUNCTION get_my_hotel_id()
RETURNS uuid LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT hotel_id FROM public.profiles WHERE id = auth.uid()
$$;

-- Returns the calling user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS text LANGUAGE sql STABLE
SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$;

-- ============================================================
--  TRIGGERS
-- ============================================================

-- 1. Auto-create a profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. Auto-create a housekeeping record when a room is added
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

-- 3. Keep housekeeping.updated_at fresh
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
--  Every user only sees/touches rows that belong to their hotel.
--  Role-based write restrictions are enforced per-table.
-- ============================================================

ALTER TABLE hotels      ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms       ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance ENABLE ROW LEVEL SECURITY;
ALTER TABLE channels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;

-- ── hotels ──
CREATE POLICY "View own hotel"    ON hotels FOR SELECT USING (id = get_my_hotel_id());
CREATE POLICY "Owner updates hotel" ON hotels FOR UPDATE USING (id = get_my_hotel_id() AND get_my_role() = 'owner');

-- ── profiles ──
CREATE POLICY "View own profile"   ON profiles FOR SELECT USING (id = auth.uid());
CREATE POLICY "Update own profile" ON profiles FOR UPDATE USING (id = auth.uid());
-- Owners can view all profiles in their hotel (for user management)
CREATE POLICY "Owner views hotel profiles" ON profiles FOR SELECT
  USING (hotel_id = get_my_hotel_id() AND get_my_role() = 'owner');

-- ── rooms ──
CREATE POLICY "Staff view rooms"   ON rooms FOR SELECT USING (hotel_id = get_my_hotel_id());
CREATE POLICY "Mgmt insert rooms"  ON rooms FOR INSERT WITH CHECK (hotel_id = get_my_hotel_id() AND get_my_role() IN ('owner','management'));
CREATE POLICY "Mgmt update rooms"  ON rooms FOR UPDATE USING     (hotel_id = get_my_hotel_id() AND get_my_role() IN ('owner','management'));
CREATE POLICY "Owner deletes rooms" ON rooms FOR DELETE USING    (hotel_id = get_my_hotel_id() AND get_my_role() = 'owner');
-- Front desk can update room status (check-in/out triggers status change)
CREATE POLICY "FD updates room status" ON rooms FOR UPDATE USING (hotel_id = get_my_hotel_id());

-- ── guests ──
CREATE POLICY "Staff view guests"   ON guests FOR SELECT USING (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff insert guests" ON guests FOR INSERT WITH CHECK (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff update guests" ON guests FOR UPDATE USING   (hotel_id = get_my_hotel_id());
CREATE POLICY "Mgmt delete guests"  ON guests FOR DELETE USING   (hotel_id = get_my_hotel_id() AND get_my_role() IN ('owner','management'));

-- ── bookings ──
CREATE POLICY "Staff view bookings"   ON bookings FOR SELECT USING (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff insert bookings" ON bookings FOR INSERT WITH CHECK (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff update bookings" ON bookings FOR UPDATE USING   (hotel_id = get_my_hotel_id());
CREATE POLICY "Mgmt delete bookings"  ON bookings FOR DELETE USING   (hotel_id = get_my_hotel_id() AND get_my_role() IN ('owner','management'));

-- ── housekeeping ──
CREATE POLICY "Staff view hk"   ON housekeeping FOR SELECT USING (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff insert hk" ON housekeeping FOR INSERT WITH CHECK (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff update hk" ON housekeeping FOR UPDATE USING   (hotel_id = get_my_hotel_id());

-- ── maintenance ──
CREATE POLICY "Staff view mx"   ON maintenance FOR SELECT USING (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff insert mx" ON maintenance FOR INSERT WITH CHECK (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff update mx" ON maintenance FOR UPDATE USING   (hotel_id = get_my_hotel_id());
CREATE POLICY "Mgmt delete mx"  ON maintenance FOR DELETE USING   (hotel_id = get_my_hotel_id() AND get_my_role() IN ('owner','management'));

-- ── channels ──
-- All staff can see which channels are connected; only owner/management
-- can add channels or flip the AI-autonomy kill switch.
CREATE POLICY "Staff view channels" ON channels FOR SELECT USING (hotel_id = get_my_hotel_id());
CREATE POLICY "Mgmt insert channels" ON channels FOR INSERT WITH CHECK (hotel_id = get_my_hotel_id() AND get_my_role() IN ('owner','management'));
CREATE POLICY "Mgmt update channels" ON channels FOR UPDATE USING (hotel_id = get_my_hotel_id() AND get_my_role() IN ('owner','management'));
CREATE POLICY "Owner deletes channels" ON channels FOR DELETE USING (hotel_id = get_my_hotel_id() AND get_my_role() = 'owner');

-- ── channel_secrets ──
-- No policies at all: RLS is enabled but no SELECT/INSERT/UPDATE/DELETE
-- policy is granted to `authenticated` or `anon`, so this table is only
-- ever reachable via the service-role key inside Edge Functions.

-- ── conversations ──
CREATE POLICY "Staff view conversations"   ON conversations FOR SELECT USING (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff update conversations" ON conversations FOR UPDATE USING (hotel_id = get_my_hotel_id());

-- ── messages ──
-- Staff can view and send manual replies; inbound/AI messages are written
-- by Edge Functions via the service-role key (bypasses RLS).
CREATE POLICY "Staff view messages"   ON messages FOR SELECT USING (hotel_id = get_my_hotel_id());
CREATE POLICY "Staff insert messages" ON messages FOR INSERT WITH CHECK (hotel_id = get_my_hotel_id() AND sender = 'staff');

-- ============================================================
--  INITIAL SETUP INSTRUCTIONS
--  After running this schema, follow these steps to create
--  your first hotel tenant:
--
--  1. Create the first user via Supabase Auth (Dashboard →
--     Authentication → Users → Invite user), or use the
--     signup form in the app.
--
--  2. In the SQL editor, create the hotel record:
--       INSERT INTO hotels (name, email, phone, address)
--       VALUES ('Your Hotel Name', 'info@hotel.com', '+234...', 'Lagos, Nigeria')
--       RETURNING id;
--
--  3. Link that user as owner (replace the UUIDs):
--       UPDATE profiles
--       SET hotel_id = '<hotel_uuid>', role = 'owner', full_name = 'Manager Name'
--       WHERE id = '<user_uuid>';
--
--  4. To add staff members:
--       -- First create them via Auth, then:
--       UPDATE profiles
--       SET hotel_id = '<hotel_uuid>', role = 'front_desk', full_name = 'Staff Name'
--       WHERE id = '<staff_user_uuid>';
--
--  Roles: 'owner' | 'management' | 'front_desk'
-- ============================================================
