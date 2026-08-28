import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  readAppTab,
  readCalendarLocation,
  writeAppTab,
  writeCalendarLocation,
} from './uiLocation';

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
    },
  });
});

afterEach(() => {
  memory.clear();
});

describe('uiLocation', () => {
  it('restores the last app tab after a refresh', () => {
    expect(readAppTab()).toBe('calendar');
    writeAppTab('settings');
    expect(readAppTab()).toBe('settings');
  });

  it('ignores an unknown app tab', () => {
    sessionStorage.setItem('featurn:appTab', 'unknown');
    expect(readAppTab()).toBe('calendar');
  });

  it('keeps calendar date, view, and selected day together', () => {
    writeCalendarLocation('biz-1', {
      date: '2026-09-14',
      view: 'dayGridMonth',
      selectedDate: '2026-09-16',
    });
    writeCalendarLocation('biz-1', { view: 'timeGridDay', selectedId: 42 });

    expect(readCalendarLocation('biz-1')).toEqual({
      date: '2026-09-14',
      view: 'timeGridDay',
      selectedDate: '2026-09-16',
      selectedId: 42,
      selectedServiceId: null,
    });
  });


  it('does not write a calendar location without a date', () => {
    writeCalendarLocation('biz-1', { view: 'timeGridWeek' });
    expect(readCalendarLocation('biz-1')).toBeNull();
  });
});
