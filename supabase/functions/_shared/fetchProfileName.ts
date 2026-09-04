// Best-effort profile name lookup for Instagram/Messenger senders (their
// webhook payloads carry only an opaque IGSID/PSID, unlike WhatsApp which
// includes the contact's display name inline). Never throws — a failed
// lookup just leaves the conversation's contact_name blank.
export async function fetchProfileName(senderId: string, accessToken: string): Promise<string> {
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${senderId}?fields=name&access_token=${accessToken}`);
    if (!res.ok) return '';
    const data = await res.json();
    return typeof data?.name === 'string' ? data.name : '';
  } catch {
    return '';
  }
}
