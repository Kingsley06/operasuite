import { createClient } from 'jsr:@supabase/supabase-js@2';
import { adminClient } from '../_shared/admin.ts';
import { handleOptions, jsonResponse } from '../_shared/cors.ts';
import { sendOutboundMessage } from '../_shared/sendOutbound.ts';

// Called by the logged-in frontend when staff types a reply in the
// Communications tab. Sending a manual reply hands the conversation back
// to a human (ai_handled=false) until someone flips it back to the AI.
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

  const { conversationId, text } = await req.json();
  if (!conversationId || !text?.trim()) return jsonResponse({ error: 'conversationId and text are required' }, 400);

  // RLS ("Staff view conversations") already scopes this to the caller's hotel.
  const { data: conversation, error: convErr } = await userClient
    .from('conversations')
    .select('id, hotel_id, channel_id, external_contact_id, channels(type, external_account_id)')
    .eq('id', conversationId)
    .single();
  if (convErr || !conversation) return jsonResponse({ error: 'Conversation not found' }, 404);

  const { data: message, error: insertErr } = await userClient
    .from('messages')
    .insert({
      hotel_id: conversation.hotel_id,
      conversation_id: conversationId,
      direction: 'outbound',
      sender: 'staff',
      staff_id: user.id,
      body: text.trim(),
    })
    .select('id')
    .single();
  if (insertErr) return jsonResponse({ error: insertErr.message }, 500);

  await userClient
    .from('conversations')
    .update({
      ai_handled: false,
      status: 'open',
      last_message_at: new Date().toISOString(),
      last_message_preview: text.trim().slice(0, 140),
    })
    .eq('id', conversationId);

  // Delivering to the actual platform needs the stored token, which only
  // the service-role client can read.
  const admin = adminClient();
  const { data: secrets } = await admin.from('channel_secrets').select('access_token').eq('channel_id', conversation.channel_id).maybeSingle();

  if (secrets?.access_token) {
    const channel = conversation.channels as unknown as { type: 'whatsapp' | 'instagram' | 'messenger'; external_account_id: string };
    try {
      const { externalMessageId } = await sendOutboundMessage({
        channelType: channel.type,
        externalAccountId: channel.external_account_id,
        externalContactId: conversation.external_contact_id,
        accessToken: secrets.access_token,
        text: text.trim(),
      });
      if (externalMessageId) {
        await admin.from('messages').update({ external_message_id: externalMessageId }).eq('id', message.id);
      }
    } catch (err) {
      return jsonResponse({ ok: true, messageId: message.id, deliveryError: String(err instanceof Error ? err.message : err) });
    }
  }

  return jsonResponse({ ok: true, messageId: message.id });
});
