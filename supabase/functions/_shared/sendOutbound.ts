const GRAPH_VERSION = 'v20.0';

export type ChannelType = 'whatsapp' | 'instagram' | 'messenger';

interface SendArgs {
  channelType: ChannelType;
  externalAccountId: string; // WhatsApp phone_number_id / IG or Page id
  externalContactId: string; // recipient phone (WhatsApp) or PSID/IGSID
  accessToken: string;
  text: string;
}

// Delivers a text message via the right Meta Graph API surface. WhatsApp
// Cloud API, Instagram Messaging, and Messenger Send API all live under
// graph.facebook.com and share very similar (but not identical) payload
// shapes — normalized here so `aiAgent.ts` and manual replies can call one
// function regardless of channel.
export async function sendOutboundMessage(args: SendArgs): Promise<{ externalMessageId: string | null }> {
  const { channelType, externalAccountId, externalContactId, accessToken, text } = args;

  let url: string;
  let body: Record<string, unknown>;

  if (channelType === 'whatsapp') {
    url = `https://graph.facebook.com/${GRAPH_VERSION}/${externalAccountId}/messages`;
    body = {
      messaging_product: 'whatsapp',
      to: externalContactId,
      type: 'text',
      text: { body: text },
    };
  } else {
    // Instagram and Messenger both use the Send API shape via the connected Page.
    url = `https://graph.facebook.com/${GRAPH_VERSION}/me/messages`;
    body = {
      recipient: { id: externalContactId },
      message: { text },
      messaging_type: 'RESPONSE',
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`sendOutboundMessage(${channelType}) failed: ${res.status} ${errBody}`);
  }

  const data = await res.json();
  const externalMessageId =
    data?.messages?.[0]?.id /* WhatsApp */ ??
    data?.message_id /* Messenger/Instagram */ ??
    null;

  return { externalMessageId };
}
