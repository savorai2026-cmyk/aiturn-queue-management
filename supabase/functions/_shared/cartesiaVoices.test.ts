import { describe, expect, it } from 'vitest';
import {
  isCartesiaFileUrl,
  isHebrewVoice,
  previewContentType,
  previewSpeechRequest,
  readListedVoice,
  readVoiceId,
  readVoicePage,
  toPublicVoice,
  type ListedVoice,
} from './cartesiaVoices';

const HEBREW: ListedVoice = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'דנה',
  language: 'he',
  tagline: 'חמה',
  status: 'active',
  accents: [{ locale: 'he-IL', isNative: true }],
  previewFileUrl: null,
};

describe('hebrew voices', () => {
  it('keeps a native Hebrew voice and drops an English voice with an Israeli accent', () => {
    const english = readListedVoice({
      id: 'db6b0ed5-d5d3-463d-ae85-518a07d3c2b4',
      name: 'Skylar',
      language: 'en',
      tagline: 'Friendly Guide',
      status: 'active',
      accents: [
        { locale: 'en-US', is_native: true },
        { locale: 'he-IL', is_native: false },
      ],
    });

    expect(english).not.toBeNull();
    expect(isHebrewVoice(english as ListedVoice)).toBe(false);
    expect(toPublicVoice(english as ListedVoice)).toBeNull();
    expect(toPublicVoice(HEBREW)).toEqual({
      id: HEBREW.id,
      name: 'דנה',
      language: 'he',
      tagline: 'חמה',
    });
  });

  it('keeps a voice whose native accent is Hebrew', () => {
    const voice: ListedVoice = {
      ...HEBREW,
      language: 'en',
      accents: [{ locale: 'he-IL', isNative: true }],
    };
    expect(isHebrewVoice(voice)).toBe(true);
  });

  it('drops archived voices and leaves the preview address off the public voice', () => {
    expect(toPublicVoice({ ...HEBREW, status: 'archived' })).toBeNull();
    expect(toPublicVoice(HEBREW)).not.toHaveProperty('previewFileUrl');
  });
});

describe('voice pages', () => {
  it('reads the next cursor and ignores a voice without an id', () => {
    const page = readVoicePage({
      data: [{ name: 'בלי מזהה', language: 'he' }, { ...HEBREW, preview_file_url: 'https://files.cartesia.ai/a.mp3' }],
      has_more: true,
      next_page: HEBREW.id,
    });

    expect(page.hasMore).toBe(true);
    expect(page.nextPage).toBe(HEBREW.id);
    expect(page.voices).toHaveLength(1);
    expect(page.voices[0]?.previewFileUrl).toBe('https://files.cartesia.ai/a.mp3');
  });

  it('accepts only a voice id and a Cartesia preview address', () => {
    expect(readVoiceId(HEBREW.id)).toBe(HEBREW.id);
    expect(readVoiceId('../secrets')).toBeNull();
    expect(isCartesiaFileUrl('https://files.cartesia.ai/preview.mp3')).toBe(true);
    expect(isCartesiaFileUrl('https://example.com/preview.mp3')).toBe(false);
    expect(isCartesiaFileUrl('http://files.cartesia.ai/preview.mp3')).toBe(false);
    expect(previewContentType('audio/mpeg; charset=binary')).toBe('audio/mpeg');
    expect(previewContentType('application/json')).toBeNull();
  });

  it('asks Cartesia for a short Hebrew sample in the selected voice', () => {
    expect(previewSpeechRequest(HEBREW.id)).toEqual({
      model_id: 'sonic-3.6',
      transcript: 'שלום, זה הקול של הסוכן.',
      voice: { id: HEBREW.id },
      language: 'he',
      output_format: {
        container: 'mp3',
        sample_rate: 44100,
        bit_rate: 128000,
      },
    });
  });
});
