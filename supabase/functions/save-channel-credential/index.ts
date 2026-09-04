import { createClient } from 'jsr:@supabase/supabase-js@2';
import { adminClient } from '../_shared/admin.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';

// Owner-only: connects (or reconnects) a WhatsApp/Instagram/Messenger
// account by writing its credentials straight to `channel_secrets`, which
// no client-side Supabase key can ever read back. Called from the "Add
// channel" form in the Communications page settings modal.
Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return jsonResponse({ error: 'Unauthorized' }, 401);

  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const {
    data: { user },
  } = await userClient.auth.getUser();
  if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

  const { data: profile } = await userClient.from('profiles').select('hotel_id, role').eq('id', user.id).single();
  if (!profile?.hotel_id || profile.role !== 'owner') {
    return jsonResponse({ error: 'Only the hotel owner can connect a channel' }, 403);
  }

  const { type, displayName, externalAccountId, accessToken, appSecret, verifyToken } = await req.json();
  if (!['whatsapp', 'instagram', 'messenger'].includes(type)) return jsonResponse({ error: 'Invalid channel type' }, 400);
  if (!externalAccountId || !accessToken || !appSecret || !verifyToken) {
    return jsonResponse({ error: 'externalAccountId, accessToken, appSecret and verifyToken are all required' }, 400);
  }

  const admin = adminClient();

  const { data: channel, error: channelErr } = await admin
    .from('channels')
    .upsert(
      { hotel_id: profile.hotel_id, type, display_name: displayName ?? '', external_account_id: externalAccountId, is_active: true },
      { onConflict: 'hotel_id,type,external_account_id' }
    )
    .select('id')
    .single();
  if (channelErr || !channel) return jsonResponse({ error: channelErr?.message ?? 'Failed to save channel' }, 500);

  const { error: secretsErr } = await admin
    .from('channel_secrets')
    .upsert({ channel_id: channel.id, access_token: accessToken, app_secret: appSecret, verify_token: verifyToken }, { onConflict: 'channel_id' });
  if (secretsErr) return jsonResponse({ error: secretsErr.message }, 500);

  return jsonResponse({ ok: true, channelId: channel.id });
});
