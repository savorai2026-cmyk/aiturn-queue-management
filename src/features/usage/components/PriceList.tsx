import { StorageUsageBar } from '../../settings/components/StorageUsageMeter';
import { MAX_STORAGE_QUOTA_GB } from '../../settings/storageQuota';
import {
  daysLimitText,
  monthsLimitText,
  agorotIncludingVat,
  extraUserCount,
  formatPlanIls,
  formatSpokenTime,
  monthChargeIls,
  planLabel,
  VAT_RATE,
  voiceAgorotIncludingVat,
  type PlanTariff,
  type SubscriptionPlan,
} from '../planPricing';
import styles from './PriceList.module.css';

interface PriceListProps {
  usedBytes: number | null;
  quotaGb: number;
  storageError: string;
  memberCount: number | null;
  voiceSeconds: number | null;
  whatsappWindows: number | null;
  planError: string;
  subscriptionPlan: SubscriptionPlan | null;
  regularTariff: PlanTariff;
  expandedTariff: PlanTariff;
  resolvedTariff: PlanTariff;
  hasOverride: boolean;
  onOpenStorageSettings: () => void;
  onOpenPlanSettings: () => void;
}

const PENDING = 'עדיין בפיתוח';

export default function PriceList({
  usedBytes,
  quotaGb,
  storageError,
  memberCount,
  voiceSeconds,
  whatsappWindows,
  planError,
  subscriptionPlan,
  regularTariff,
  expandedTariff,
  resolvedTariff,
  hasOverride,
  onOpenStorageSettings,
  onOpenPlanSettings,
}: PriceListProps) {
  const plan = subscriptionPlan ?? 'regular';
  const terms = resolvedTariff;
  const voiceIls =
    voiceSeconds == null
      ? null
      : (Math.max(0, voiceSeconds) / 60) *
        (terms.voiceAgorotPerMinute / 100) *
        (1 + VAT_RATE);
  const storageIls = Math.max(0, quotaGb - terms.includedStorageGb) * terms.extraStorageGbIls;
  const extraUsers = memberCount == null ? 0 : extraUserCount(memberCount, terms.includedUsers);
  const extraUserAmount = extraUsers * terms.extraUserIls;
  const whatsappIls =
    whatsappWindows == null
      ? null
      : whatsappWindows * (terms.whatsappCustomerAgorot / 100) * (1 + VAT_RATE);
  const total =
    voiceSeconds == null || subscriptionPlan == null || memberCount == null || whatsappWindows == null
      ? null
      : monthChargeIls({
          voiceSeconds,
          quotaGb,
          memberCount,
          whatsappWindows,
          plan,
          tariff: terms,
        });
  const userFill =
    memberCount == null
      ? 0
      : Math.min(100, (memberCount / terms.includedUsers) * 100);
  const overUsers = memberCount != null && memberCount > terms.includedUsers;
  const money = (amount: number | null) =>
    planError ? 'לא זמין' : amount == null ? 'מחשב...' : formatPlanIls(amount);
  const extraStorageGb = Math.max(0, quotaGb - terms.includedStorageGb);

  return (
    <div className={styles.list}>
      <section className={styles.total}>
        <p className={styles.totalLabel}>עלות החודש עד עכשיו</p>
        <p className={styles.totalValue}>
          {planError ? 'לא זמין' : total == null ? 'מחשב...' : formatPlanIls(total)}
        </p>
        <p className={styles.vatNote}>כל הסכומים כאן כוללים מע״מ.</p>
        {hasOverride && (
          <p className={styles.vatNote}>לעסק הזה יש תעריף מיוחד, והוא גובר על מחירון המנוי.</p>
        )}
        <div className={styles.lines}>
          <ChargeLine
            title={`מנוי ${subscriptionPlan == null ? '' : planLabel(plan)}`.trim()}
            detail="דמי המנוי לחודש"
            amount={subscriptionPlan == null ? 'מחשב...' : formatPlanIls(terms.monthlyIls)}
          />
          <ChargeLine
            title="משתמשים נוספים"
            detail={
              memberCount == null
                ? 'מחשב משתמשים'
                : extraUsers === 0
                  ? `אין משתמשים מעבר ל־${terms.includedUsers} הכלולים`
                  : `${extraUsers.toLocaleString('he-IL')} מעבר ל־${terms.includedUsers} הכלולים`
            }
            amount={money(memberCount == null ? null : extraUserAmount)}
          />
          <ChargeLine
            title="שיחות קוליות"
            detail={
              planError
                ? 'החישוב נכשל'
                : voiceSeconds == null
                  ? 'מחשב דקות'
                  : formatSpokenTime(voiceSeconds)
            }
            amount={money(voiceIls)}
          />
          <ChargeLine
            title="וואטסאפ"
            detail={
              planError
                ? 'החישוב נכשל'
                : whatsappWindows == null
                  ? 'מחשב חלונות'
                  : `${whatsappWindows.toLocaleString('he-IL')} חלונות, פניית לקוח`
            }
            amount={money(whatsappIls)}
          />
          <ChargeLine
            title="אחסון"
            detail={
              extraStorageGb === 0
                ? `תשלום נוסף על ${terms.includedStorageGb} ג׳יגה כלולים`
                : `תשלום נוסף על ${terms.includedStorageGb} ג׳יגה כלולים, ${extraStorageGb.toLocaleString('he-IL')} ג׳יגה נוספות`
            }
            amount={formatPlanIls(storageIls)}
          />
        </div>
        {planError && <p className={styles.error}>{planError}</p>}
      </section>

      <p className={styles.catalogTitle}>מחירון</p>

      <section className={styles.row}>
        <div className={styles.copy}>
          <h2>מנוי</h2>
          <p>
            {subscriptionPlan == null
              ? 'מחשב את המנוי...'
              : `העסק על המנוי ${planLabel(plan)}. שני המנויים כאן, ואפשר לעבור למורחב בהגדרות העסק.`}
          </p>
        </div>
        <div className={styles.plans}>
          <article className={styles.planCard} data-current={plan === 'regular'}>
            <h3>רגיל</h3>
            <p className={styles.price}>{regularTariff.monthlyIls} ₪ לחודש, כולל מע״מ</p>
            <p>
              עד {regularTariff.includedUsers} משתמשים, וכל משתמש נוסף {regularTariff.extraUserIls} ₪ לחודש.
              {regularTariff.includedStorageGb} ג׳יגה כלולים, וכל ג׳יגה נוספת {regularTariff.extraStorageGbIls} ₪.
              הקלטת קול {daysLimitText(regularTariff.recordingMaxDays)}.
              היסטוריית תורים {monthsLimitText(regularTariff.historyMaxMonths)}.
              תמלול, סיכום והתכתבות וואטסאפ {monthsLimitText(regularTariff.correspondenceMaxMonths)}.
            </p>
          </article>
          <button
            type="button"
            className={styles.planCard}
            data-current={plan === 'expanded'}
            onClick={onOpenPlanSettings}
          >
            <h3>מורחב</h3>
            <p className={styles.price}>{expandedTariff.monthlyIls} ₪ לחודש, כולל מע״מ</p>
            <p>
              עד {expandedTariff.includedUsers} משתמשים, וכל משתמש נוסף {expandedTariff.extraUserIls} ₪ לחודש.
              {expandedTariff.includedStorageGb} ג׳יגה כלולים, וכל ג׳יגה נוספת {expandedTariff.extraStorageGbIls} ₪.
              הקלטה, היסטוריית תורים, תמלול, סיכום והתכתבות וואטסאפ {monthsLimitText(expandedTariff.correspondenceMaxMonths)}.
            </p>
            <p>לבחירת המנוי בהגדרות העסק</p>
          </button>
        </div>
        <div className={styles.meterHead}>
          <span>
            {planError
              ? 'החישוב נכשל'
              : memberCount == null
                ? 'מחשב משתמשים'
                : `${memberCount.toLocaleString('he-IL')} מתוך ${terms.includedUsers} משתמשים`}
          </span>
        </div>
        <div
          className={styles.track}
          role="meter"
          aria-label="משתמשים במנוי"
          aria-valuemin={0}
          aria-valuemax={terms.includedUsers}
          aria-valuenow={memberCount ?? 0}
        >
          <div
            className={styles.fill}
            data-level={overUsers ? 'full' : 'ok'}
            style={{ width: `${userFill}%` }}
          />
        </div>
        <p className={styles.live}>
          {overUsers
            ? `${extraUsers.toLocaleString('he-IL')} משתמשים מעבר לחבילה. `
            : ''}
          משתמש נוסף: {terms.extraUserIls} ₪ לחודש.
        </p>
        <button
          type="button"
          className={styles.linkButton}
          onClick={onOpenPlanSettings}
        >
          שינוי המנוי בהגדרות העסק
        </button>
      </section>

      <section className={styles.row}>
        <div className={styles.copy}>
          <h2>שיחת סוכן קולי</h2>
          <p>החיוב לפי השניות שדיברו בפועל.</p>
        </div>
        <p className={styles.price}>
          {terms.voiceAgorotPerMinute} אגורות לדקה
        </p>
        <p className={styles.live}>
          כולל מע״מ: {formatAgorot(voiceAgorotIncludingVat(terms.voiceAgorotPerMinute))} אגורות לדקה.
        </p>
      </section>

      <section className={styles.row}>
        <div className={styles.copy}>
          <h2>אחסון בענן</h2>
          <p>
            {terms.includedStorageGb} ג׳יגה כלולים במנוי. כל ג׳יגה נוספת: {terms.extraStorageGbIls} ₪ לחודש.
            המקסימום {MAX_STORAGE_QUOTA_GB} ג׳יגה.
          </p>
        </div>
        <StorageUsageBar
          usedBytes={usedBytes}
          quotaGb={quotaGb}
          plan={plan}
          rates={{
            includedGb: terms.includedStorageGb,
            extraGbIls: terms.extraStorageGbIls,
          }}
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

      <section className={styles.row}>
        <div className={styles.copy}>
          <h2>וואטסאפ</h2>
          <p>
            חלון של 24 שעות לכל מספר. שיחה נוספת בתוך אותו חלון לא מחויבת שוב.
            בלוג לא שמור מי פתח את החלון, ולכן כל חלון מחושב כפניית לקוח.
          </p>
        </div>
        <p className={styles.price}>
          פניית לקוח: {terms.whatsappCustomerAgorot} אגורות ל־24 שעות
        </p>
        <p className={styles.live}>
          כולל מע״מ: {formatAgorot(agorotIncludingVat(terms.whatsappCustomerAgorot))} אגורות.
        </p>
        <p className={styles.price}>
          פניית העסק: {terms.whatsappBusinessAgorot} אגורות ל־24 שעות
        </p>
        <p className={styles.live}>
          כולל מע״מ: {formatAgorot(agorotIncludingVat(terms.whatsappBusinessAgorot))} אגורות.
        </p>
      </section>
      <PriceRow
        title="סליקה ושמירת אסמכתא"
        price={PENDING}
        detail="חיוב הלקוח ושמירת אסמכתת העסקה."
      />
      <PriceRow
        title="הפקת חשבונית"
        price={PENDING}
        detail="הפקת חשבונית ללקוח."
      />
    </div>
  );
}

function formatAgorot(value: number): string {
  return value.toLocaleString('he-IL', { maximumFractionDigits: 2 });
}

function ChargeLine({
  title,
  detail,
  amount,
}: {
  title: string;
  detail: string;
  amount: string;
}) {
  return (
    <div className={styles.line}>
      <div>
        <p className={styles.lineTitle}>{title}</p>
        <p className={styles.lineDetail}>{detail}</p>
      </div>
      <p className={styles.lineAmount}>{amount}</p>
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
