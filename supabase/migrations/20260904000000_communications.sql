-- ============================================================
--  Opera Suite — Communications Hub
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
--  ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE channels        ENABLE ROW LEVEL SECURITY;
ALTER TABLE channel_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages        ENABLE ROW LEVEL SECURITY;

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
