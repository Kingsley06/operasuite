import { createClient } from 'jsr:@supabase/supabase-js@2';

// Service-role client — bypasses RLS entirely. Only ever used inside
// Edge Functions, never sent to the browser.
export function adminClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } }
  );
}
