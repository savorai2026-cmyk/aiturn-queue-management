export interface AgentVoiceOption {
  id: string;
  name: string;
  language: string;
  tagline: string;
}

export function agentVoiceLabel(voice: Pick<AgentVoiceOption, 'name' | 'tagline'>): string {
  return voice.tagline ? `${voice.name} · ${voice.tagline}` : voice.name;
}

export function agentVoiceLanguageLabel(language: string): string {
  const code = language.trim().toLowerCase();
  if (code === 'he' || code.startsWith('he-') || code.startsWith('he_')) {
    return 'עברית';
  }
  return language.trim();
}

export function readAgentVoices(value: unknown): AgentVoiceOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (item === null || typeof item !== 'object') return [];
    const voice = item as Record<string, unknown>;
    const id = typeof voice.id === 'string' ? voice.id.trim() : '';
    const name = typeof voice.name === 'string' ? voice.name.trim() : '';
    if (!id || !name) return [];
    return [{
      id,
      name,
      language: typeof voice.language === 'string' ? voice.language.trim() : '',
      tagline: typeof voice.tagline === 'string' ? voice.tagline.trim() : '',
    }];
  });
}

export function decodeAudioBase64(audioBase64: string, contentType: string): Blob {
  const binary = atob(audioBase64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: contentType || 'audio/mpeg' });
}
