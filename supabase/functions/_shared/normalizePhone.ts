// Mirrors the local-number-to-international convention already used by
// `sendWhatsApp` in src/pages/Bookings.jsx (Nigeria-first: a leading 0 is
// treated as a local number and swapped for the 234 country code).
// Used to match an inbound WhatsApp sender ID against `guests.phone`.
export function normalizePhone(raw: string): string {
  const cleaned = raw.replace(/\D/g, '');
  if (cleaned.startsWith('0')) return '234' + cleaned.slice(1);
  return cleaned;
}
