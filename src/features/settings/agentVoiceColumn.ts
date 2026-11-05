export function isMissingAgentVoiceColumn(error: {
  code?: string;
  message?: string;
}): boolean {
  return error.code === '42703' && (error.message ?? '').includes('agent_voice_id');
}

export class MissingAgentVoiceColumnError extends Error {
  constructor() {
    super('agent_voice_id is not in the database');
    this.name = 'MissingAgentVoiceColumnError';
  }
}
