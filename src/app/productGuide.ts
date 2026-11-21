import { APP_TABS, type AppTab } from './navigation.ts';

export interface ScreenGuide {
  label: string;
  text: string;
}

export const SCREEN_GUIDES: Record<AppTab, ScreenGuide> = {
  calendar: {
    label: 'יומן חי',
    text: 'כאן רואים ומשנים תורים. אפשר לעבור בין יום לשבוע, להוסיף תור, להזיז, לבטל ולשנות סטטוס. שעות האפור הן מחוץ לשעות הפעילות.',
  },
  clients: {
    label: 'ניהול לקוחות',
    text: 'רשימת הלקוחות של העסק. אפשר לחפש, להוסיף ולערוך לקוח, ולקבוע אם הוא נקבע מיד, ממתין לאישור, או חסום.',
  },
  settings: {
    label: 'הגדרות',
    text: 'פרטי העסק, שעות פעילות, שירותים וסטטוסים, תיאור לסוכן, מדיניות ביטול ותשלום מראש, כתובת הגעה, מנוי, אחסון ומשתמשים.',
  },
  stats: {
    label: 'סטטיסטיקה',
    text: 'סיכום תורים לטווח שנבחר: כמה נקבעו, כמה הושלמו, כמה בוטלו, הכנסה, שירותים נפוצים ושעות עמוסות.',
  },
  logs: {
    label: 'לוגים',
    text: 'שיחות של הסוכן עם לקוחות, בטלפון ובוואטסאפ. לכל שיחה יש ערוץ, תוצאה, וסיכום או תמליל אם נשמרו.',
  },
  usage: {
    label: 'עלות',
    text: 'המחירון של העסק והשימוש בחודש הנוכחי: מנוי, משתמשים, אחסון, דקות של הסוכן הקולי וחלונות וואטסאפ.',
  },
};

export function isAppTab(value: string): value is AppTab {
  return (APP_TABS as readonly string[]).includes(value);
}

export function productGuidePrompt(): string {
  return APP_TABS.map((tab) => {
    const screen = SCREEN_GUIDES[tab];
    return `${screen.label}: ${screen.text}`;
  }).join('\n');
}

export function openScreenLine(tab: AppTab): string {
  const screen = SCREEN_GUIDES[tab];
  return `המסך הפתוח עכשיו: ${screen.label}. ${screen.text}`;
}
