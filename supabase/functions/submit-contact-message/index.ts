import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_MESSAGE_LENGTH = 10;

const UPDATE_LIST_EMAIL_ERROR = 'Please enter a valid email address to join the update list.';
const BCC_WARNING =
  'Your message was saved, but we could not add you to the update email list. You can try again later or contact us.';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isValidEmail(email: string): boolean {
  const t = email.trim();
  if (!t || t.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/**
 * Opt-in BCC: email is unique. Existing row → set is_active true, set label when name provided.
 * New row → insert. Falls back to email-only insert if optional columns are missing.
 */
async function upsertBccOptIn(
  supabase: SupabaseClient,
  normalizedEmail: string,
  displayName: string | null,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const nameTrim = displayName && displayName.trim() ? displayName.trim() : null;

  const sel = await supabase.from('admin_update_bcc_emails').select('id').eq('email', normalizedEmail).maybeSingle();
  if (sel.error) {
    console.error('admin_update_bcc_emails select', sel.error);
    return { ok: false, reason: sel.error.message || 'select failed' };
  }

  if (sel.data?.id) {
    const patch: Record<string, unknown> = { is_active: true };
    if (nameTrim) patch.label = nameTrim;

    let upd = await supabase.from('admin_update_bcc_emails').update(patch).eq('id', sel.data.id);
    if (!upd.error) return { ok: true };

    if (nameTrim) {
      upd = await supabase.from('admin_update_bcc_emails').update({ is_active: true }).eq('id', sel.data.id);
      if (!upd.error) return { ok: true };
    }

    console.error('admin_update_bcc_emails update', upd.error);
    return { ok: false, reason: upd.error.message || 'update failed' };
  }

  let ins = await supabase.from('admin_update_bcc_emails').insert({
    email: normalizedEmail,
    is_active: true,
    label: nameTrim,
  });
  if (!ins.error) return { ok: true };

  ins = await supabase.from('admin_update_bcc_emails').insert({ email: normalizedEmail });
  if (!ins.error) return { ok: true };

  console.error('admin_update_bcc_emails insert', ins.error);
  return { ok: false, reason: ins.error.message || 'insert failed' };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'Method not allowed' }, 405);
  }

  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: 'Invalid JSON body' }, 400);
  }

  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  const emailRaw = typeof payload.email === 'string' ? payload.email.trim() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const turnstileToken =
    typeof payload.turnstileToken === 'string' ? payload.turnstileToken.trim() : '';
  const addToUpdateList = payload.addToUpdateList === true;
  const isPrayerRequest =
    payload.isPrayerRequest === true || payload.prayerRequest === true;

  if (!turnstileToken) {
    return jsonResponse({ ok: false, error: 'Verification is required before sending.' }, 400);
  }

  if (!message) {
    return jsonResponse({ ok: false, error: 'Please enter a message.' }, 400);
  }

  if (message.length < MIN_MESSAGE_LENGTH) {
    return jsonResponse(
      { ok: false, error: `Please write a bit more (at least ${MIN_MESSAGE_LENGTH} characters).` },
      400,
    );
  }

  if (addToUpdateList && (!emailRaw || !isValidEmail(emailRaw))) {
    return jsonResponse({ ok: false, error: UPDATE_LIST_EMAIL_ERROR }, 400);
  }

  if (!addToUpdateList && emailRaw && !isValidEmail(emailRaw)) {
    return jsonResponse({ ok: false, error: 'Please enter a valid email address.' }, 400);
  }

  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) {
    console.error('TURNSTILE_SECRET_KEY is not set');
    return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500);
  }

  const verifyBody = new URLSearchParams();
  verifyBody.set('secret', secret);
  verifyBody.set('response', turnstileToken);

  let verifyJson: { success?: boolean; 'error-codes'?: string[] };
  try {
    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: verifyBody.toString(),
    });
    verifyJson = (await verifyRes.json()) as typeof verifyJson;
  } catch {
    return jsonResponse({ ok: false, error: 'Could not verify submission. Please try again.' }, 502);
  }

  if (!verifyJson.success) {
    const codes = verifyJson['error-codes']?.join(', ') || 'unknown';
    console.warn('Turnstile verification failed', codes);
    return jsonResponse({ ok: false, error: 'Verification failed. Please refresh and try again.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return jsonResponse({ ok: false, error: 'Server configuration error.' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const storedContactEmail = emailRaw
    ? addToUpdateList
      ? emailRaw.trim().toLowerCase()
      : emailRaw.trim()
    : null;

  const row: Record<string, unknown> = {
    name: name || null,
    email: storedContactEmail,
    message,
    prayer_request: isPrayerRequest,
  };

  const { error: insertError } = await supabase.from('contact_messages').insert(row);

  if (insertError) {
    console.error('contact_messages insert', insertError);
    return jsonResponse({ ok: false, error: 'Could not save your message. Please try again later.' }, 500);
  }

  let warning: string | undefined;
  if (addToUpdateList && storedContactEmail) {
    const bcc = await upsertBccOptIn(supabase, storedContactEmail, name || null);
    if (!bcc.ok) {
      console.warn('BCC opt-in failed', bcc.reason);
      warning = BCC_WARNING;
    }
  }

  const body: Record<string, unknown> = { ok: true };
  if (warning) body.warning = warning;
  return jsonResponse(body);
});
