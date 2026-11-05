import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  HEBREW_LANGUAGE,
  MAX_PREVIEW_BYTES,
  MAX_VOICE_PAGES,
  VOICE_PAGE_SIZE,
  isCartesiaFileUrl,
  previewContentType,
  previewSpeechRequest,
  readListedVoice,
  readVoiceId,
  readVoicePage,
  toPublicVoice,
  type PublicVoice,
} from '../_shared/cartesiaVoices.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const CARTESIA_VERSION = '2026-08-14';
const CARTESIA_API = 'https://api.cartesia.ai';
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 30;

const recentCalls = new Map<string, number[]>();
const previewCache = new Map<string, { content_type: string; audio_base64: string }>();

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function allowCall(userId: string) {
  const now = Date.now();
  const stamps = (recentCalls.get(userId) ?? []).filter(
    (stamp) => now - stamp < RATE_WINDOW_MS,
  );
  if (stamps.length >= RATE_LIMIT) {
    recentCalls.set(userId, stamps);
    return false;
  }
  stamps.push(now);
  recentCalls.set(userId, stamps);
  return true;
}

function cartesiaHeaders(apiKey: string) {
  return {
    Authorization: `Bearer ${apiKey}`,
    'Cartesia-Version': CARTESIA_VERSION,
  };
}

async function listHebrewVoices(apiKey: string, language: string) {
  const voices: PublicVoice[] = [];
  const seen = new Set<string>();
  const cursors = new Set<string>();
  let startingAfter = '';

  for (let page = 0; page < MAX_VOICE_PAGES; page += 1) {
    if (startingAfter && cursors.has(startingAfter)) break;
    if (startingAfter) cursors.add(startingAfter);

    const url = new URL('/voices', CARTESIA_API);
    url.searchParams.set('limit', String(VOICE_PAGE_SIZE));
    url.searchParams.set('language', language);
    if (startingAfter) url.searchParams.set('starting_after', startingAfter);

    const response = await fetch(url, { headers: cartesiaHeaders(apiKey) });
    if (!response.ok) {
      throw new Error('Cartesia request failed');
    }

    const voicePage = readVoicePage(await response.json().catch(() => ({})));
    for (const voice of voicePage.voices) {
      const pub = toPublicVoice(voice);
      if (!pub || seen.has(pub.id)) continue;
      seen.add(pub.id);
      voices.push(pub);
    }

    if (!voicePage.hasMore || !voicePage.nextPage) break;
    startingAfter = voicePage.nextPage;
  }

  voices.sort((left, right) => left.name.localeCompare(right.name, 'he'));
  return voices;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function readAudio(
  response: Response,
  fallbackType: string | null,
): Promise<{ content_type: string; audio_base64: string } | null> {
  if (!response.ok) return null;
  const contentType = previewContentType(response.headers.get('content-type')) ?? fallbackType;
  if (!contentType) return null;
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_PREVIEW_BYTES) return null;
  return {
    content_type: contentType,
    audio_base64: bytesToBase64(bytes),
  };
}

async function readPreview(apiKey: string, voiceId: string) {
  const cached = previewCache.get(voiceId);
  if (cached) return jsonResponse(cached);

  const voiceUrl = new URL(`/voices/${voiceId}`, CARTESIA_API);
  voiceUrl.searchParams.append('expand[]', 'preview_file_url');
  const voiceResponse = await fetch(voiceUrl, { headers: cartesiaHeaders(apiKey) });
  if (voiceResponse.status === 404) {
    return jsonResponse({ error: 'Voice not found' }, 404);
  }
  if (!voiceResponse.ok) {
    return jsonResponse({ error: 'Cartesia request failed' }, 502);
  }

  const voice = readListedVoice(await voiceResponse.json().catch(() => null));
  if (!voice || !toPublicVoice(voice)) {
    return jsonResponse({ error: 'Voice not found' }, 404);
  }

  let audio = null;
  if (voice.previewFileUrl && isCartesiaFileUrl(voice.previewFileUrl)) {
    audio = await readAudio(
      await fetch(voice.previewFileUrl, {
        headers: cartesiaHeaders(apiKey),
        redirect: 'follow',
      }),
      null,
    );
  }

  if (!audio) {
    audio = await readAudio(
      await fetch(new URL('/tts/bytes', CARTESIA_API), {
        method: 'POST',
        headers: {
          ...cartesiaHeaders(apiKey),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(previewSpeechRequest(voiceId)),
      }),
      'audio/mpeg',
    );
  }

  if (!audio) {
    return jsonResponse({ error: 'Voice has no preview' }, 502);
  }

  previewCache.set(voiceId, audio);
  return jsonResponse(audio);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const authorization = request.headers.get('Authorization');
  if (!authorization) {
    return jsonResponse({ error: 'Missing authorization header' }, 401);
  }

  const cartesiaKey = Deno.env.get('CARTESIA_API_KEY') ?? '';
  if (!cartesiaKey) {
    return jsonResponse({ error: 'Cartesia is not configured' }, 500);
  }

  let body: Record<string, unknown>;
  try {
    body = asRecord(await request.json());
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  const businessCode = readString(body.business_code);
  if (!businessCode) {
    return jsonResponse({ error: 'Missing business_code' }, 400);
  }

  const requestedVoiceId = readString(body.voice_id);
  const voiceId = requestedVoiceId ? readVoiceId(requestedVoiceId) : null;
  if (requestedVoiceId && !voiceId) {
    return jsonResponse({ error: 'Voice not found' }, 404);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!supabaseUrl || !supabaseAnonKey) {
    return jsonResponse({ error: 'Supabase is not configured' }, 500);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
  });

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    return jsonResponse({ error: 'Not authenticated' }, 401);
  }

  const { data: membership, error: membershipError } = await supabase
    .from('business_members')
    .select('role')
    .eq('business_code', businessCode)
    .eq('user_id', userData.user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (membershipError) {
    return jsonResponse({ error: membershipError.message }, 400);
  }

  if (membership?.role !== 'owner' && membership?.role !== 'admin') {
    return jsonResponse({ error: 'Not allowed' }, 403);
  }

  if (!allowCall(userData.user.id)) {
    return jsonResponse({ error: 'Too many voice requests' }, 429);
  }

  try {
    if (voiceId) {
      return await readPreview(cartesiaKey, voiceId);
    }

    let voices = await listHebrewVoices(cartesiaKey, HEBREW_LANGUAGE);
    if (voices.length === 0) {
      voices = await listHebrewVoices(cartesiaKey, 'he-IL');
    }
    return jsonResponse({ voices });
  } catch {
    return jsonResponse({ error: 'Cartesia request failed' }, 502);
  }
});
