import { describe, expect, it } from 'vitest';
import {
  MissingAgentVoiceColumnError,
  isMissingAgentVoiceColumn,
} from './agentVoiceColumn';

describe('agent voice column', () => {
  it('recognizes the missing voice column and ignores other database errors', () => {
    expect(isMissingAgentVoiceColumn({
      code: '42703',
      message: 'column businesses.agent_voice_id does not exist',
    })).toBe(true);
    expect(isMissingAgentVoiceColumn({
      code: '42703',
      message: 'column businesses.other does not exist',
    })).toBe(false);
    expect(new MissingAgentVoiceColumnError().name).toBe('MissingAgentVoiceColumnError');
  });
});
