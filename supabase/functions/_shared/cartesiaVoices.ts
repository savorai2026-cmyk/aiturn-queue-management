export const HEBREW_LANGUAGE = 'he';
export const MAX_VOICE_PAGES = 5;
export const VOICE_PAGE_SIZE = 100;
export const MAX_PREVIEW_BYTES = 1_500_000;

const VOICE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface VoiceAccent {
  locale: string;
  isNative: boolean;
}

export interface ListedVoice {
  id: string;
  name: string;
  language: string;
  tagline: string;
  status: string;
  accents: VoiceAccent[];
  previewFileUrl: string | null;
}

export interface PublicVoice {
  id: string;
  name: string;
  language: string;
  tagline: string;
}

export interface VoicePage {
  voices: ListedVoice[];
  hasMore: boolean;
  nextPage: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isHebrewCode(value: string): boolean {
  const code = value.trim().toLowerCase().replaceAll('_', '-');
  return code === 'he' || code.startsWith('he-');
}

export function readVoiceId(value: string): string | null {
  const id = value.trim();
  return VOICE_ID_PATTERN.test(id) ? id : null;
}

export function isCartesiaFileUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.protocol === 'https:' &&
      (url.hostname === 'cartesia.ai' || url.hostname.endsWith('.cartesia.ai'))
    );
  } catch {
    return false;
  }
}

export function previewContentType(header: string | null): string | null {
  const type = (header ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (type === 'audio/mp3' || type === 'audio/mpeg') return 'audio/mpeg';
  if (type === 'audio/wave' || type === 'audio/wav' || type === 'audio/x-wav') {
    return 'audio/wav';
  }
  if (type === 'audio/ogg' || type === 'audio/webm') return type;
  return null;
}

function readAccents(value: unknown): VoiceAccent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const accent = asRecord(item);
    if (!accent) return [];
    const locale = readString(accent.locale);
    if (!locale) return [];
    return [{ locale, isNative: accent.is_native === true }];
  });
}

export function readListedVoice(value: unknown): ListedVoice | null {
  const voice = asRecord(value);
  if (!voice) return null;
  const id = readVoiceId(readString(voice.id));
  const name = readString(voice.name);
  if (!id || !name) return null;
  const preview = readString(voice.preview_file_url);
  return {
    id,
    name,
    language: readString(voice.language),
    tagline: readString(voice.tagline),
    status: readString(voice.status) || 'active',
    accents: readAccents(voice.accents),
    previewFileUrl: preview || null,
  };
}

export function isHebrewVoice(voice: ListedVoice): boolean {
  if (isHebrewCode(voice.language)) return true;
  return voice.accents.some(
    (accent) => accent.isNative && isHebrewCode(accent.locale),
  );
}

export function toPublicVoice(voice: ListedVoice): PublicVoice | null {
  if (voice.status !== 'active' || !isHebrewVoice(voice)) return null;
  return {
    id: voice.id,
    name: voice.name,
    language: isHebrewCode(voice.language) ? voice.language : HEBREW_LANGUAGE,
    tagline: voice.tagline,
  };
}

export const PREVIEW_TRANSCRIPT = 'שלום, זה הקול של הסוכן.';
export const PREVIEW_MODEL = 'sonic-3.6';

export function previewSpeechRequest(voiceId: string) {
  return {
    model_id: PREVIEW_MODEL,
    transcript: PREVIEW_TRANSCRIPT,
    voice: { id: voiceId },
    language: HEBREW_LANGUAGE,
    output_format: {
      container: 'mp3',
      sample_rate: 44100,
      bit_rate: 128000,
    },
  };
}

export function readVoicePage(payload: unknown): VoicePage {
  const page = asRecord(payload);
  const data = Array.isArray(page?.data) ? page.data : [];
  const nextPage = readString(page?.next_page);
  return {
    voices: data.flatMap((item) => {
      const voice = readListedVoice(item);
      return voice ? [voice] : [];
    }),
    hasMore: page?.has_more === true,
    nextPage: nextPage || null,
  };
}
