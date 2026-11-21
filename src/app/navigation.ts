export const APP_TABS = [
  'calendar',
  'clients',
  'settings',
  'stats',
  'logs',
  'usage',
] as const;

export type AppTab = (typeof APP_TABS)[number];
