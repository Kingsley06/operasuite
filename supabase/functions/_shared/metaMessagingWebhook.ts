import { adminClient } from './admin.ts';
import { handleOptions, jsonResponse } from './cors.ts';
import { verifyMetaSignature } from './verifySignature.ts';
import { fetchProfileName } from './fetchProfileName.ts';
import { handleInboundMessage } from './aiAgent.ts';

// Instagram DM and Messenger both ride the same Meta "Messaging" webhook
// envelope and Graph API surface — this handles both, parameterized by
// channel type, so whatsapp-webhook (a genuinely different payload shape)
// stays separate but these two don't duplicate ~100 identical lines.
export async function handleMetaMessagingWebhook(req: Request, channelType: 'instagram' | 'messenger'): Promise<Response> {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const url = new URL(req.url);

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
      .eq('channels.type', channelType)
      .maybeSingle();

    if (!data) return new Response('Forbidden', { status: 403 });
    return new Response(challenge ?? '', { status: 200 });
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const rawBody = await req.text();
  let payload: MetaMessagingPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  const entry = payload.entry?.[0];
  const messaging = entry?.messaging?.[0];
  if (!entry || !messaging?.message?.text) {
    // Read receipts / reactions / non-text — acknowledge and ignore.
    return jsonResponse({ ok: true });
  }

  const externalAccountId = messaging.recipient.id;
  const supabase = adminClient();

  const { data: channel, error: channelErr } = await supabase
    .from('channels')
    .select('id, hotel_id, external_account_id, channel_secrets(app_secret, access_token)')
    .eq('type', channelType)
    .eq('external_account_id', externalAccountId)
    .eq('is_active', true)
    .maybeSingle();

  if (channelErr || !channel) return new Response('Unknown channel', { status: 404 });

  const secrets = Array.isArray(channel.channel_secrets) ? channel.channel_secrets[0] : channel.channel_secrets;
  const valid = await verifyMetaSignature(rawBody, req.headers.get('X-Hub-Signature-256'), secrets?.app_secret ?? '');
  if (!valid) return new Response('Invalid signature', { status: 401 });

  const externalContactId = messaging.sender.id;
  const text = messaging.message!.text!;
  const contactName = secrets?.access_token ? await fetchProfileName(externalContactId, secrets.access_token) : '';

  const { data: conversation, error: convErr } = await supabase
    .from('conversations')
    .upsert(
      {
        hotel_id: channel.hotel_id,
        channel_id: channel.id,
        external_contact_id: externalContactId,
        contact_name: contactName,
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
    external_message_id: messaging.message!.mid,
  });

  await supabase.from('conversations').update({ unread_count: 1 }).eq('id', conversation.id);

  try {
    await handleInboundMessage(supabase, conversation.id);
  } catch (err) {
    console.error('AI agent failed', err);
    await supabase.from('conversations').update({ status: 'needs_attention' }).eq('id', conversation.id);
  }

  return jsonResponse({ ok: true });
}

interface MetaMessagingPayload {
  entry?: Array<{
    id: string;
    messaging?: Array<{
      sender: { id: string };
      recipient: { id: string };
      message?: { mid: string; text?: string };
    }>;
  }>;
}
