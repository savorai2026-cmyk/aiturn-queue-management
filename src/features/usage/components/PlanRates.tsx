import {
  EXTRA_STORAGE_GB_ILS,
  INCLUDED_STORAGE_GB,
} from '../../settings/storageQuota';
import {
  INCLUDED_USERS,
  MONTHLY_PLAN_ILS,
  VOICE_AGOROT_PER_MINUTE,
} from '../planPricing';
import styles from './PlanRates.module.css';

const PENDING = 'עדיין בפיתוח';

export default function PlanRates() {
  return (
    <div className={styles.rates}>
      <p className={styles.note}>
        זו עלות משוערת. היא יכולה להשתנות לפי החלטות העסק, כמו דקות שיחה
        נוספות או הגדלת מכסת האחסון, ולפי פונקציות שעדיין בפיתוח.
      </p>
      <Rate title="מנוי חודשי" price={`${MONTHLY_PLAN_ILS} ₪ כולל מע״מ`} detail={`עד ${INCLUDED_USERS} משתמשים, ו־${INCLUDED_STORAGE_GB} ג׳יגה אחסון.`} />
      <Rate title="שיחת סוכן קולי" price={`${VOICE_AGOROT_PER_MINUTE} אגורות לדקה`} detail="לפי השניות שדיברו בפועל." />
      <Rate title="אחסון מעבר למכסה" price={`${EXTRA_STORAGE_GB_ILS} ₪ לג׳יגה לחודש`} detail={`${INCLUDED_STORAGE_GB} ג׳יגה כלולים במנוי.`} />
      <Rate title="וואטסאפ" price={PENDING} detail="הפונקציונליות עדיין בפיתוח." pending />
      <Rate title="סליקה ושמירת אסמכתא" price={PENDING} detail="הפונקציונליות עדיין בפיתוח." pending />
      <Rate title="הפקת חשבונית" price={PENDING} detail="הפונקציונליות עדיין בפיתוח." pending />
    </div>
  );
}

function Rate({
  title,
  price,
  detail,
  pending = false,
}: {
  title: string;
  price: string;
  detail: string;
  pending?: boolean;
}) {
  return (
    <div className={styles.rate}>
      <div>
        <p className={styles.title}>{title}</p>
        <p className={styles.detail}>{detail}</p>
      </div>
      <p className={pending ? styles.pending : styles.price}>{price}</p>
    </div>
  );
}
