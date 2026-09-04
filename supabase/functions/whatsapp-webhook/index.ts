import { adminClient } from '../_shared/admin.ts';
import { corsHeaders, handleOptions, jsonResponse } from '../_shared/cors.ts';
import { verifyMetaSignature } from '../_shared/verifySignature.ts';
import { handleInboundMessage } from '../_shared/aiAgent.ts';

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const url = new URL(req.url);

  // ── Meta webhook verification handshake ──────────────────────────────
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (mode !== 'subscribe' || !token) return new Response('Forbidden', { status: 403 });

    const supabase = adminClient();
    const { data } = await supabase
      .from('channel_secrets')
      .select('channel_id, channels!inner(type)')
      .eq('verify_token', token)
      .eq('channels.type', 'whatsapp')
      .maybeSingle();

    if (!data) return new Response('Forbidden', { status: 403 });
    return new Response(challenge ?? '', { status: 200 });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const rawBody = await req.text();
  let payload: WhatsAppPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const change = payload.entry?.[0]?.changes?.[0]?.value;
  const message = change?.messages?.[0];
  if (!change || !message || message.type !== 'text') {
    // Delivery receipts / non-text messages — acknowledge and ignore.
    return jsonResponse({ ok: true });
  }

  const phoneNumberId = change.metadata?.phone_number_id;
  const supabase = adminClient();

  const { data: channel, error: channelErr } = await supabase
    .from('channels')
    .select('id, hotel_id, external_account_id, channel_secrets(app_secret)')
    .eq('type', 'whatsapp')
    .eq('external_account_id', phoneNumberId)
    .eq('is_active', true)
    .maybeSingle();

  if (channelErr || !channel) return new Response('Unknown channel', { status: 404 });

  const secrets = Array.isArray(channel.channel_secrets) ? channel.channel_secrets[0] : channel.channel_secrets;
  const valid = await verifyMetaSignature(rawBody, req.headers.get('X-Hub-Signature-256'), secrets?.app_secret ?? '');
  if (!valid) return new Response('Invalid signature', { status: 401 });

  const externalContactId = message.from;
  const contactName = change.contacts?.[0]?.profile?.name ?? '';
  const text = message.text?.body ?? '';

  // Try to link to an existing guest by phone (best-effort — see normalizePhone).
  const { data: existingGuest } = await supabase
    .from('guests')
    .select('id')
    .eq('hotel_id', channel.hotel_id)
    .eq('phone', externalContactId)
    .maybeSingle();

  const { data: conversation, error: convErr } = await supabase
    .from('conversations')
    .upsert(
      {
        hotel_id: channel.hotel_id,
        channel_id: channel.id,
        external_contact_id: externalContactId,
        contact_name: contactName,
        guest_id: existingGuest?.id ?? null,
        status: 'open',
        last_message_at: new Date().toISOString(),
        last_message_preview: text.slice(0, 140),
      },
      { onConflict: 'channel_id,external_contact_id', ignoreDuplicates: false }
    )
    .select('id')
    .single();
  if (convErr || !conversation) return new Response('Failed to upsert conversation', { status: 500 });

  await supabase.from('messages').insert({
    hotel_id: channel.hotel_id,
    conversation_id: conversation.id,
    direction: 'inbound',
    sender: 'guest',
    body: text,
    external_message_id: message.id,
  });

  await supabase
    .from('conversations')
    .update({ unread_count: 1 }) // simple v1 model: 1 = has unread activity
    .eq('id', conversation.id);

  try {
    await handleInboundMessage(supabase, conversation.id);
  } catch (err) {
    console.error('AI agent failed', err);
    await supabase.from('conversations').update({ status: 'needs_attention' }).eq('id', conversation.id);
  }

  return jsonResponse({ ok: true });
});

interface WhatsAppPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string } }>;
        messages?: Array<{ from: string; id: string; type: string; text?: { body: string } }>;
      };
    }>;
  }>;
}
