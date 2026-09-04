import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { sendOutboundMessage } from './sendOutbound.ts';

const ANTHROPIC_MODEL = 'claude-sonnet-5';
const MAX_TOOL_ROUNDS = 5;
const CONTEXT_MESSAGE_LIMIT = 20;

type ToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };

const TOOLS = [
  {
    name: 'check_availability',
    description:
      'Check which rooms are free for a given date range. Always call this before promising a room or a price.',
    input_schema: {
      type: 'object',
      properties: {
        check_in: { type: 'string', description: 'Check-in date, YYYY-MM-DD' },
        check_out: { type: 'string', description: 'Check-out date, YYYY-MM-DD, must be after check_in' },
        room_type: { type: 'string', enum: ['Single', 'Double', 'Suite'], description: 'Optional filter' },
      },
      required: ['check_in', 'check_out'],
    },
  },
  {
    name: 'create_booking',
    description:
      "Book a room for the guest. Only call this after the guest has confirmed a specific room and dates, and you have their full name and phone number. Price is calculated automatically from the room's nightly rate — do not ask the guest to confirm a total amount yourself, tell them what this tool returns.",
    input_schema: {
      type: 'object',
      properties: {
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        phone: { type: 'string', description: "Guest's phone number, digits only or with country code" },
        room_id: { type: 'string', description: 'The room UUID returned by check_availability' },
        check_in: { type: 'string' },
        check_out: { type: 'string' },
      },
      required: ['first_name', 'last_name', 'phone', 'room_id', 'check_in', 'check_out'],
    },
  },
  {
    name: 'escalate_to_staff',
    description:
      'Hand this conversation off to a human staff member instead of replying yourself. Use this for anything you are not confident about, complaints, refund/payment disputes, or anything the guest explicitly asks a human for.',
    input_schema: {
      type: 'object',
      properties: { reason: { type: 'string' } },
      required: ['reason'],
    },
  },
];

async function runTool(
  supabase: SupabaseClient,
  hotelId: string,
  conversationId: string,
  name: string,
  input: Record<string, unknown>
): Promise<{ content: string; isError: boolean }> {
  try {
    if (name === 'check_availability') {
      const { check_in, check_out, room_type } = input as { check_in: string; check_out: string; room_type?: string };
      let roomsQuery = supabase.from('rooms').select('id, number, type, floor, price_per_night, status').eq('hotel_id', hotelId).neq('status', 'Maintenance');
      if (room_type) roomsQuery = roomsQuery.eq('type', room_type);
      const { data: rooms, error: roomsErr } = await roomsQuery;
      if (roomsErr) throw roomsErr;

      const { data: overlapping, error: bookErr } = await supabase
        .from('bookings')
        .select('room_id')
        .eq('hotel_id', hotelId)
        .not('status', 'in', '(Cancelled,Checked Out)')
        .lt('check_in', check_out)
        .gt('check_out', check_in);
      if (bookErr) throw bookErr;

      const bookedRoomIds = new Set((overlapping ?? []).map((b: { room_id: string }) => b.room_id));
      const available = (rooms ?? []).filter((r: { id: string }) => !bookedRoomIds.has(r.id));

      return {
        content: JSON.stringify(
          available.map((r: { id: string; number: string; type: string; floor: number; price_per_night: number }) => ({
            room_id: r.id,
            number: r.number,
            type: r.type,
            floor: r.floor,
            price_per_night: r.price_per_night,
          }))
        ),
        isError: false,
      };
    }

    if (name === 'create_booking') {
      const { first_name, last_name, phone, room_id, check_in, check_out } = input as {
        first_name: string; last_name: string; phone: string; room_id: string; check_in: string; check_out: string;
      };

      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .select('id, number, price_per_night')
        .eq('id', room_id)
        .eq('hotel_id', hotelId)
        .single();
      if (roomErr || !room) throw new Error('Room not found');

      const nights = Math.round((new Date(check_out).getTime() - new Date(check_in).getTime()) / 86400000);
      if (nights <= 0) return { content: JSON.stringify({ error: 'check_out must be after check_in' }), isError: true };
      const totalAmount = Number(room.price_per_night) * nights;

      let { data: guest } = await supabase
        .from('guests')
        .select('id')
        .eq('hotel_id', hotelId)
        .eq('phone', phone)
        .maybeSingle();

      if (!guest) {
        const { data: newGuest, error: guestErr } = await supabase
          .from('guests')
          .insert({ hotel_id: hotelId, first_name, last_name, phone })
          .select('id')
          .single();
        if (guestErr) throw guestErr;
        guest = newGuest;
      }

      const today = new Date().toISOString().split('T')[0];
      const status = check_in <= today ? 'Active' : 'Upcoming';

      const { data: booking, error: bookingErr } = await supabase
        .from('bookings')
        .insert({
          hotel_id: hotelId,
          guest_id: guest.id,
          room_id,
          check_in,
          check_out,
          status,
          total_amount: totalAmount,
          notes: 'Booked via AI receptionist',
        })
        .select('id')
        .single();

      if (bookingErr) {
        // Postgres exclusion-constraint violation (room taken between check and book)
        if (bookingErr.code === '23P01') {
          return { content: JSON.stringify({ error: 'room_no_longer_available' }), isError: true };
        }
        throw bookingErr;
      }

      await supabase.from('rooms').update({ status: 'Booked' }).eq('id', room_id).eq('hotel_id', hotelId);
      await supabase.from('conversations').update({ guest_id: guest.id }).eq('id', conversationId).is('guest_id', null);

      return {
        content: JSON.stringify({
          booking_id: booking.id,
          room_number: room.number,
          check_in,
          check_out,
          nights,
          total_amount: totalAmount,
          status,
        }),
        isError: false,
      };
    }

    if (name === 'escalate_to_staff') {
      await supabase
        .from('conversations')
        .update({ status: 'needs_attention', ai_handled: false })
        .eq('id', conversationId);
      return { content: JSON.stringify({ ok: true }), isError: false };
    }

    return { content: `Unknown tool ${name}`, isError: true };
  } catch (err) {
    return { content: String(err instanceof Error ? err.message : err), isError: true };
  }
}

export async function handleInboundMessage(supabase: SupabaseClient, conversationId: string): Promise<void> {
  const { data: conversation, error: convErr } = await supabase
    .from('conversations')
    .select('id, hotel_id, channel_id, status, ai_handled, channels(id, type, external_account_id, ai_autonomous, channel_secrets(access_token))')
    .eq('id', conversationId)
    .single();
  if (convErr || !conversation) throw convErr ?? new Error('Conversation not found');

  const channel = conversation.channels as unknown as {
    id: string; type: 'whatsapp' | 'instagram' | 'messenger'; external_account_id: string;
    ai_autonomous: boolean; channel_secrets: { access_token: string }[] | { access_token: string } | null;
  };

  if (!channel.ai_autonomous || !conversation.ai_handled) {
    if (conversation.status === 'open') {
      await supabase.from('conversations').update({ status: 'needs_attention' }).eq('id', conversationId);
    }
    return;
  }

  const { data: hotel } = await supabase.from('hotels').select('name').eq('id', conversation.hotel_id).single();

  const { data: history, error: historyErr } = await supabase
    .from('messages')
    .select('sender, body')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(CONTEXT_MESSAGE_LIMIT);
  if (historyErr) throw historyErr;

  const messages = (history ?? [])
    .reverse()
    .map((m: { sender: string; body: string }) => ({
      role: m.sender === 'guest' ? 'user' : 'assistant',
      content: m.body,
    }));

  const systemPrompt = [
    `You are the AI receptionist for ${hotel?.name ?? 'this hotel'}, chatting with a guest over ${channel.type}.`,
    'Be warm, concise, and professional. Answer questions about rooms and availability using the check_availability tool — never guess prices or availability.',
    'Before calling create_booking you must have: a confirmed room, confirmed dates, and the guest\'s full name and phone number. Ask for whatever is missing first.',
    'If the guest is upset, asks for a refund/payment dispute, or asks for a human, call escalate_to_staff and let them know a team member will follow up.',
    'Keep replies short — this is a chat conversation, not an email.',
  ].join(' ');

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')!;
  let finalText = '';

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        tools: TOOLS,
      }),
    });

    if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`);
    const data = await res.json();

    const textBlocks = (data.content ?? []).filter((b: { type: string }) => b.type === 'text');
    finalText = textBlocks.map((b: { text: string }) => b.text).join('\n').trim();

    if (data.stop_reason !== 'tool_use') break;

    messages.push({ role: 'assistant', content: data.content });

    const toolUseBlocks = (data.content ?? []).filter((b: { type: string }) => b.type === 'tool_use');
    const toolResults: ToolResultBlock[] = [];
    for (const block of toolUseBlocks) {
      const { content, isError } = await runTool(supabase, conversation.hotel_id, conversationId, block.name, block.input);
      toolResults.push({ type: 'tool_result', tool_use_id: block.id, content, is_error: isError });
    }
    messages.push({ role: 'user', content: toolResults });
  }

  if (!finalText) return;

  const { data: outbound, error: insertErr } = await supabase
    .from('messages')
    .insert({ hotel_id: conversation.hotel_id, conversation_id: conversationId, direction: 'outbound', sender: 'ai', body: finalText })
    .select('id')
    .single();
  if (insertErr) throw insertErr;

  const secrets = Array.isArray(channel.channel_secrets) ? channel.channel_secrets[0] : channel.channel_secrets;
  if (secrets?.access_token) {
    const { data: convRow } = await supabase.from('conversations').select('external_contact_id').eq('id', conversationId).single();
    try {
      const { externalMessageId } = await sendOutboundMessage({
        channelType: channel.type,
        externalAccountId: channel.external_account_id,
        externalContactId: convRow!.external_contact_id,
        accessToken: secrets.access_token,
        text: finalText,
      });
      if (externalMessageId) {
        await supabase.from('messages').update({ external_message_id: externalMessageId }).eq('id', outbound.id);
      }
    } catch (err) {
      // Message is already recorded in our DB even if delivery to the platform failed —
      // flag it for a human rather than losing it silently.
      await supabase
        .from('messages')
        .update({ metadata: { send_error: String(err instanceof Error ? err.message : err) } })
        .eq('id', outbound.id);
      await supabase.from('conversations').update({ status: 'needs_attention' }).eq('id', conversationId);
    }
  }

  await supabase
    .from('conversations')
    .update({ last_message_at: new Date().toISOString(), last_message_preview: finalText.slice(0, 140) })
    .eq('id', conversationId);
}
