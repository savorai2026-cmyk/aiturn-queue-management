import { StorageUsageBar } from '../../settings/components/StorageUsageMeter';
import {
  EXTRA_STORAGE_GB_ILS,
  INCLUDED_STORAGE_GB,
  extraStorageMonthlyIls,
} from '../../settings/storageQuota';
import {
  INCLUDED_USERS,
  MONTHLY_PLAN_ILS,
  VOICE_AGOROT_PER_MINUTE,
  formatPlanIls,
  formatSpokenTime,
  monthChargeIls,
  voiceChargeIls,
} from '../planPricing';
import styles from './PriceList.module.css';

interface PriceListProps {
  usedBytes: number | null;
  quotaGb: number;
  storageError: string;
  memberCount: number | null;
  voiceSeconds: number | null;
  planError: string;
  onOpenStorageSettings: () => void;
}

const PENDING = 'עדיין בפיתוח';

export default function PriceList({
  usedBytes,
  quotaGb,
  storageError,
  memberCount,
  voiceSeconds,
  planError,
  onOpenStorageSettings,
}: PriceListProps) {
  const voiceIls = voiceSeconds == null ? null : voiceChargeIls(voiceSeconds);
  const storageIls = extraStorageMonthlyIls(quotaGb);
  const total =
    voiceSeconds == null
      ? null
      : monthChargeIls({ voiceSeconds, quotaGb });
  const userFill =
    memberCount == null
      ? 0
      : Math.min(100, (memberCount / INCLUDED_USERS) * 100);
  const overUsers = memberCount != null && memberCount > INCLUDED_USERS;

  return (
    <div className={styles.list}>
      <section className={styles.total}>
        <p className={styles.totalLabel}>עלות החודש עד עכשיו</p>
        <p className={styles.totalValue}>
          {total == null ? 'מחשב...' : formatPlanIls(total)}
        </p>
        <p className={styles.totalDetail}>
          {formatPlanIls(MONTHLY_PLAN_ILS)} מנוי
          {voiceIls == null ? '' : ` + ${formatPlanIls(voiceIls)} שיחות`}
          {` + ${formatPlanIls(storageIls)} אחסון`}. זו עלות משוערת לפי
          השימוש עד עכשיו, והיא יכולה להשתנות לפי החלטות העסק, כמו דקות שיחה
          נוספות או הגדלת מכסת האחסון.
        </p>
        {planError && <p className={styles.error}>{planError}</p>}
      </section>

      <section className={styles.row}>
        <div className={styles.copy}>
          <h2>מנוי חודשי</h2>
          <p>עד {INCLUDED_USERS} משתמשים. כולל {INCLUDED_STORAGE_GB} ג׳יגה אחסון.</p>
        </div>
        <p className={styles.price}>{MONTHLY_PLAN_ILS} ₪ כולל מע״מ</p>
        <div className={styles.meterHead}>
          <span>
            {memberCount == null
              ? 'מחשב משתמשים'
              : `${memberCount.toLocaleString('he-IL')} מתוך ${INCLUDED_USERS} משתמשים`}
          </span>
        </div>
        <div
          className={styles.track}
          role="meter"
          aria-label="משתמשים במנוי"
          aria-valuemin={0}
          aria-valuemax={INCLUDED_USERS}
          aria-valuenow={memberCount ?? 0}
        >
          <div
            className={styles.fill}
            data-level={overUsers ? 'full' : 'ok'}
            style={{ width: `${userFill}%` }}
          />
        </div>
        {overUsers && (
          <p className={styles.pendingNote}>
            יש יותר מ־{INCLUDED_USERS} משתמשים. הוספת משתמש מעבר לזה עדיין בפיתוח.
          </p>
        )}
      </section>

      <section className={styles.row}>
        <div className={styles.copy}>
          <h2>שיחת סוכן קולי</h2>
          <p>לפי השניות שדיברו בפועל, בלי מכסה כלולה.</p>
        </div>
        <p className={styles.price}>{VOICE_AGOROT_PER_MINUTE} אגורות לדקה</p>
        <p className={styles.live}>
          {voiceSeconds == null
            ? 'מחשב דקות...'
            : `${formatSpokenTime(voiceSeconds)} החודש, ${formatPlanIls(voiceIls ?? 0)}`}
        </p>
      </section>

      <section className={styles.row}>
        <div className={styles.copy}>
          <h2>אחסון בענן</h2>
          <p>
            {INCLUDED_STORAGE_GB} ג׳יגה כלולים במנוי. כל ג׳יגה נוספת:{' '}
            {EXTRA_STORAGE_GB_ILS} ₪ לחודש.
          </p>
        </div>
        <StorageUsageBar
          usedBytes={usedBytes}
          quotaGb={quotaGb}
          error={storageError}
        />
        <button
          type="button"
          className={styles.linkButton}
          onClick={onOpenStorageSettings}
        >
          שינוי המכסה בהגדרות העסק
        </button>
      </section>

      <PriceRow
        title="וואטסאפ"
        price={PENDING}
        detail="שיחה או הודעה. הפונקציונליות עדיין בפיתוח."
      />
      <PriceRow
        title="סליקה ושמירת אסמכתא"
        price={PENDING}
        detail="חיוב כרטיס ללקוח ושמירת אסמכתת העסקה. הפונקציונליות עדיין בפיתוח."
      />
      <PriceRow
        title="הפקת חשבונית"
        price={PENDING}
        detail="חשבונית ללקוח. הפונקציונליות עדיין בפיתוח."
      />
    </div>
  );
}

function PriceRow({
  title,
  price,
  detail,
}: {
  title: string;
  price: string;
  detail: string;
}) {
  return (
    <section className={styles.row}>
      <div className={styles.copy}>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      <p className={styles.pending}>{price}</p>
    </section>
  );
}
