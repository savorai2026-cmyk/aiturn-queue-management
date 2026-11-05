import { describe, expect, it } from 'vitest';
import {
  agentVoiceLabel,
  agentVoiceLanguageLabel,
  decodeAudioBase64,
  readAgentVoices,
} from './agentVoices';

describe('agent voices', () => {
  it('labels a voice by name and shows Hebrew for a Hebrew code', () => {
    expect(agentVoiceLabel({ name: 'דנה', tagline: 'חמה' })).toBe('דנה · חמה');
    expect(agentVoiceLabel({ name: 'דנה', tagline: '' })).toBe('דנה');
    expect(agentVoiceLanguageLabel('he')).toBe('עברית');
    expect(agentVoiceLanguageLabel('he-IL')).toBe('עברית');
  });

  it('keeps only voices that have an id and a name', () => {
    expect(readAgentVoices([
      { id: 'voice-1', name: 'דנה', language: 'he', tagline: '' },
      { id: '', name: 'בלי מזהה' },
      { name: 'בלי מזהה' },
    ])).toEqual([
      { id: 'voice-1', name: 'דנה', language: 'he', tagline: '' },
    ]);
  });

  it('decodes a preview into an audio blob', () => {
    const blob = decodeAudioBase64(btoa('demo'), 'audio/mpeg');
    expect(blob.type).toBe('audio/mpeg');
    expect(blob.size).toBe(4);
  });
});
