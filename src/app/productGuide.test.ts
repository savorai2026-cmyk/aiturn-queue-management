import { describe, expect, it } from 'vitest';
import { APP_TABS } from './navigation.ts';
import { SCREEN_GUIDES, isAppTab, openScreenLine, productGuidePrompt } from './productGuide.ts';

describe('product guide', () => {
  it('covers every screen in the navigation', () => {
    expect(Object.keys(SCREEN_GUIDES).sort()).toEqual([...APP_TABS].sort());

    for (const tab of APP_TABS) {
      expect(SCREEN_GUIDES[tab].label.trim().length).toBeGreaterThan(0);
      expect(SCREEN_GUIDES[tab].text.trim().length).toBeGreaterThan(20);
      expect(isAppTab(tab)).toBe(true);
    }
  });

  it('puts every screen label in the prompt', () => {
    const prompt = productGuidePrompt();
    for (const tab of APP_TABS) {
      expect(prompt).toContain(SCREEN_GUIDES[tab].label);
      expect(prompt).toContain(SCREEN_GUIDES[tab].text);
    }
  });

  it('names the open screen', () => {
    expect(openScreenLine('settings')).toContain('הגדרות');
    expect(openScreenLine('calendar')).toContain('יומן חי');
  });

  it('includes choices the owner can actually make', () => {
    expect(SCREEN_GUIDES.settings.text).toContain('קול הסוכן');
    expect(SCREEN_GUIDES.settings.text).toContain('דגימה');
    expect(SCREEN_GUIDES.calendar.text).toContain('כל הביקור');
    expect(productGuidePrompt()).toContain('מצב כהה');
  });
});
