import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MIN_MESSAGE_LENGTH = 10;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
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
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const message = typeof payload.message === 'string' ? payload.message.trim() : '';
  const turnstileToken =
    typeof payload.turnstileToken === 'string' ? payload.turnstileToken.trim() : '';
  const prayerRequest = payload.prayerRequest === true;

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

  if (!email) {
    return jsonResponse({ ok: false, error: 'Please enter your email address.' }, 400);
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

  const row: Record<string, unknown> = {
    name: name || null,
    email,
    message,
    prayer_request: prayerRequest,
  };

  const { error: insertError } = await supabase.from('contact_messages').insert(row);

  if (insertError) {
    console.error('contact_messages insert', insertError);
    return jsonResponse({ ok: false, error: 'Could not save your message. Please try again later.' }, 500);
  }

  return jsonResponse({ ok: true });
});
