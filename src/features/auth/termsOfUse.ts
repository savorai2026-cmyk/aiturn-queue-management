export const TERMS_VERSION = '2026-10-30';

/** Accounts created before this instant are not asked again. */
export const TERMS_REQUIRED_FROM = '2026-10-30T09:00:00.000Z';

export const TERMS_UPDATED_LABEL = '30 באוקטובר 2026';

export const TERMS_SUMMARY =
  'בשליטתנו רק ממשק הניהול, הלוגיקה העסקית ושכבת הקישור ביניהם. שיחות, הודעות, בינה מלאכותית, סליקה, אחסון ותשתית מופעלים אצל ספקים חיצוניים, ושיבוש אצלם אינו באחריותנו.';

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
    id: 'control',
    title: 'מה נמצא בשליטתנו',
    paragraphs: [
      'בשליטת QGent נמצאים רק שלושה רכיבים: ממשק הניהול, הלוגיקה העסקית של ניהול התורים והחשבון, ושכבת הקישור שמחברת ביניהם לבין שירותים חיצוניים.',
      'כל יתר הרכיבים שבהם השירות תלוי מופעלים על ידי ספקים חיצוניים ואינם בשליטתנו. אין צורך להכיר את זהות הספקים כדי להשתמש במערכת. אלה תחומי הפעולה שלהם:',
    ],
    bullets: [
      'שיחות טלפון וסוכן קולי',
      'שליחה וקבלה של הודעות, לרבות בוואטסאפ',
      'מודלים של בינה מלאכותית, תמלול וניסוח',
      'סליקת תשלומים ושמירת אמצעי תשלום',
      'אחסון נתונים, מסדי נתונים ואימות זהות',
      'תשתיות ענן, רשת ותקשורת',
    ],
  },
  {
    id: 'disruptions',
    title: 'שיבושים אצל ספקים חיצוניים',
    paragraphs: [
      'שיבוש, השבתה, עיכוב, ניתוק, אי-מסירה, שגיאה, ירידה באיכות, תשובה שגויה או חלקית, כשל בסליקה, או אי-זמינות של מידע אצל ספק חיצוני אינם בשליטתנו.',
      'אנחנו לא אחראים לנזק, להחמצת תור, לאובדן רווח, לפגיעה במוניטין, לאובדן נתון או להוצאה שנגרמו משיבוש כזה, גם אם ניתן היה לצפות אפשרות של תקלה אצל ספק.',
      'אין התחייבות שהשירותים החיצוניים יהיו זמינים ברציפות, נטולי טעויות, או שיתאימו לתוצאה מסוימת. זמינות המערכת תלויה גם בהם. אי-זמינות שמקורה אצל ספק חיצוני אינה הפרה של תנאים אלה מצדנו.',
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
      'הסוכן הקולי וסוכן ההודעות נשענים על מודלים חיצוניים. הם עלולים לטעות, לחסר פרט, או לנסח מענה שאינו תואם את ההנחיות שהוגדרו במערכת.',
      'האחריות לבדוק תורים שנקבעו, לתקן אותם ולהגדיר את הנחיות הסוכן היא על העסק. פלט של מודל אינו ייעוץ מקצועי, רפואי, משפטי או כספי, ואין להסתמך עליו ככזה.',
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
