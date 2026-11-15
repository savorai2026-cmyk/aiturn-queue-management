export const TERMS_VERSION = '2026-11-14';

/** Accounts created before this instant are not asked again. */
export const TERMS_REQUIRED_FROM = '2026-10-30T09:00:00.000Z';

export const TERMS_UPDATED_LABEL = '14 בנובמבר 2026';

export const TERMS_SUMMARY =
  'QGent מנהלת את היומן, התורים, הלקוחות וההגדרות של העסק, ומפעילה עבורו מענה בשיחה ובהודעה לפי הכללים שהעסק קבע. שיבוש אצל ספק שמפעיל רכיב חיצוני, כמו שיחה, הודעה, סליקה או אחסון, אינו באחריותנו.';

export interface TermsSection {
  id: string;
  title: string;
  paragraphs: string[];
  bullets?: string[];
}

export const TERMS_SECTIONS: TermsSection[] = [
  {
    id: 'consent',
    title: 'ההסכמה',
    paragraphs: [
      'השימוש ב-QGent, לרבות יצירת חשבון עסק, מותנה באישור תנאים אלה. לא ניתן להשלים הרשמה בלי לסמן את תיבת ההסכמה.',
      'מי שמאשר את התנאים מצהיר שהוא מוסמך לחייב את העסק. האישור חל על בעל החשבון ועל המשתמשים שהוא מצרף אליו.',
    ],
  },
  {
    id: 'service',
    title: 'השירות',
    paragraphs: [
      'QGent היא מערכת לניהול העסק מול הלקוחות: יומן, תורים, לקוחות, שעות פעילות, מחירים, סטטוסים והרשאות. ממשק הניהול והלוגיקה העסקית פועלים אצלנו, והם אלה שקובעים מה מותר לקבוע, מתי, ובאילו תנאים.',
      'מעבר לניהול, המערכת מפעילה עבור העסק מענה ללקוחות בשיחת טלפון ובהודעות, לפי ההנחיות, השעות והשירותים שהעסק הגדיר. שכבת הקישור מחברת בין הניהול לבין ערוצי השיחה, ההודעות והתשלום, כדי שפעולה במערכת תגיע ללקוח ופעולה של לקוח תחזור ליומן.',
    ],
  },
  {
    id: 'control',
    title: 'רכיבים שמופעלים אצל ספק',
    paragraphs: [
      'כדי לספק את המענה ללקוחות, המערכת נעזרת בספקים מקצועיים לתחומים שדורשים תשתית נפרדת. אנחנו בוחרים אותם, מחברים אותם למערכת ומתפעלים את החיבור. עצם הפעלת הרכיב אצל הספק אינה אצלנו. אין צורך להכיר את זהות הספקים כדי להשתמש במערכת. אלה תחומי הפעולה שלהם:',
    ],
    bullets: [
      'שיחות טלפון והשמעת הסוכן הקולי',
      'שליחה וקבלה של הודעות, לרבות בוואטסאפ',
      'מודלים של בינה מלאכותית, תמלול וניסוח',
      'סליקת תשלומים ושמירת אמצעי תשלום',
      'אחסון נתונים, מסדי נתונים ואימות זהות',
      'תשתיות ענן, רשת ותקשורת',
    ],
  },
  {
    id: 'disruptions',
    title: 'שיבוש אצל ספק',
    paragraphs: [
      'אנחנו אחראים לתפעול המערכת ולחיבורים שהגדרנו. שיבוש, השבתה, עיכוב, ניתוק, אי-מסירה, ירידה באיכות, תשובה שגויה או חלקית, כשל בסליקה או אי-זמינות של מידע שמקורם אצל ספק כזה אינם באחריותנו.',
      'אין התחייבות שרכיב אצל ספק יהיה זמין ברציפות או נטול טעויות. אי-זמינות שמקורה אצל ספק אינה הפרה של תנאים אלה מצדנו. אנחנו לא אחראים לנזק, להחמצת תור, לאובדן רווח, לפגיעה במוניטין, לאובדן נתון או להוצאה שנגרמו משיבוש כזה.',
    ],
  },
  {
    id: 'cap',
    title: 'תקרת האחריות',
    paragraphs: [
      'אם בכל זאת תיקבע לנו אחריות, היא מוגבלת לסכום ששולם לנו בפועל עבור המנוי בשלושת החודשים שקדמו לאירוע. אנחנו לא אחראים לנזק עקיף, תוצאתי או מיוחד.',
      'המגבלה אינה גורעת מאחריות שלא ניתן להתנות עליה לפי דין.',
    ],
  },
  {
    id: 'ai',
    title: 'בינה מלאכותית',
    paragraphs: [
      'הסוכן הקולי וסוכן ההודעות עונים ללקוחות לפי ההנחיות, השעות והשירותים שהעסק הגדיר במערכת. הניסוח עצמו נשען על מודל חיצוני, ולכן תשובה עלולה לטעות, לחסר פרט, או לסטות מההנחיה.',
      'העסק אחראי לבדוק תורים שנקבעו, לתקן אותם ולעדכן את הנחיות הסוכן. פלט של מודל אינו ייעוץ מקצועי, רפואי, משפטי או כספי, ואין להסתמך עליו ככזה.',
    ],
  },
  {
    id: 'customers',
    title: 'לקוחות העסק',
    paragraphs: [
      'העסק אחראי ליידע את לקוחותיו על הקלטה, על פנייה אוטומטית ועל שמירת פרטים, ולקיים את הדין החל עליו ואת כללי פלטפורמות ההודעות.',
      'אנחנו לא צד ליחסים בין העסק לבין לקוחותיו, ולא אחראים לתוכן שהעסק מזין, למועדים שנקבעו או לשירות שהעסק עצמו נותן.',
    ],
  },
  {
    id: 'billing',
    title: 'תשלום וסליקה',
    paragraphs: [
      'החיוב הוא לפי המחירון המוצג במערכת. הסליקה ושמירת פרטי אמצעי התשלום מתבצעות אצל סולק חיצוני. אנחנו לא שומרים את מספר הכרטיס המלא.',
      'כשל, עיכוב או חיוב שגוי שמקורם אצל הסולק אינם באחריותנו. סטטוס החיוב במערכת משקף את המידע שהתקבל מהסולק. חוב או סירוב חיוב עשויים להגביל את הגישה למערכת.',
    ],
  },
  {
    id: 'account',
    title: 'החשבון',
    paragraphs: [
      'המשתמש אחראי לשמירת אמצעי הכניסה ולהרשאות שניתנות למשתמשי העסק.',
      'אנחנו רשאים להשעות גישה במקרה של שימוש אסור, סיכון אבטחה או חוב.',
    ],
  },
  {
    id: 'changes',
    title: 'שינוי התנאים',
    paragraphs: [
      'אנחנו רשאים לעדכן תנאים אלה ואת היקף השירות, בין השאר כאשר ספק חיצוני משנה או מפסיק רכיב שהמערכת נשענת עליו.',
      'להרשמה חדשה נדרשת הסכמה לנוסח שבתוקף במועד ההרשמה.',
    ],
  },
  {
    id: 'law',
    title: 'הדין החל',
    paragraphs: [
      'על תנאים אלה חלים דיני מדינת ישראל. סמכות השיפוט נתונה לבתי המשפט המוסמכים בישראל, בכפוף לזכות שיפוט שלא ניתן להתנות עליה.',
    ],
  },
];

export const TERMS_ACCEPTANCE_REQUIRED_MESSAGE =
  'כדי להירשם יש לאשר את תנאי השימוש.';

export interface TermsSubject {
  created_at?: string;
  invited_at?: string | null;
  user_metadata?: Record<string, unknown> | null;
}

export interface StoredTermsAcceptance {
  terms_accepted_at: string;
  terms_version: string;
}

const PENDING_TERMS_KEY = 'qgent-terms-acceptance';

export function termsAcceptanceMetadata(acceptedAt: string): StoredTermsAcceptance {
  return {
    terms_accepted_at: acceptedAt,
    terms_version: TERMS_VERSION,
  };
}

export function hasAcceptedTerms(user: TermsSubject | null | undefined) {
  const acceptedAt = user?.user_metadata?.terms_accepted_at;
  return typeof acceptedAt === 'string' && acceptedAt.trim().length > 0;
}

export function needsTermsAcceptance(user: TermsSubject | null | undefined) {
  if (!user || hasAcceptedTerms(user)) return false;
  if (user.invited_at) return false;

  const createdAt = Date.parse(user.created_at ?? '');
  if (Number.isNaN(createdAt)) return false;

  return createdAt >= Date.parse(TERMS_REQUIRED_FROM);
}

export function writePendingTermsAcceptance(
  storage: Pick<Storage, 'setItem'>,
  acceptedAt: string,
) {
  storage.setItem(PENDING_TERMS_KEY, JSON.stringify(termsAcceptanceMetadata(acceptedAt)));
}

export function readPendingTermsAcceptance(
  storage: Pick<Storage, 'getItem'>,
): StoredTermsAcceptance | null {
  const raw = storage.getItem(PENDING_TERMS_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<StoredTermsAcceptance>;
    if (
      parsed.terms_version !== TERMS_VERSION ||
      typeof parsed.terms_accepted_at !== 'string' ||
      parsed.terms_accepted_at.trim() === ''
    ) {
      return null;
    }

    return {
      terms_accepted_at: parsed.terms_accepted_at,
      terms_version: TERMS_VERSION,
    };
  } catch {
    return null;
  }
}

export function clearPendingTermsAcceptance(storage: Pick<Storage, 'removeItem'>) {
  storage.removeItem(PENDING_TERMS_KEY);
}

export function rememberPendingTermsAcceptance(acceptedAt = new Date().toISOString()) {
  try {
    writePendingTermsAcceptance(sessionStorage, acceptedAt);
  } catch {
    // Private mode can block storage. The screen after Google sign-in still requires the checkbox.
  }
}

export function takePendingTermsAcceptance() {
  try {
    return readPendingTermsAcceptance(sessionStorage);
  } catch {
    return null;
  }
}

export function forgetPendingTermsAcceptance() {
  try {
    clearPendingTermsAcceptance(sessionStorage);
  } catch {
    // Ignore storage failures in private browsing.
  }
}
