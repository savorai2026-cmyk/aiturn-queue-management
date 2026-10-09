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
  const total =
    voiceSeconds == null || subscriptionPlan == null || memberCount == null
      ? null
      : monthChargeIls({
          voiceSeconds,
          quotaGb,
          memberCount,
          plan,
          tariff: terms,
        });
  const userFill =
    memberCount == null
      ? 0
      : Math.min(100, (memberCount / terms.includedUsers) * 100);
  const overUsers = memberCount != null && memberCount > terms.includedUsers;

  return (
    <div className={styles.list}>
      <section className={styles.total}>
        <p className={styles.totalLabel}>עלות החודש עד עכשיו</p>
        <p className={styles.totalValue}>
          {total == null ? 'מחשב...' : formatPlanIls(total)}
        </p>
        <p className={styles.totalDetail}>
          {subscriptionPlan == null
            ? ''
            : `מנוי ${planLabel(plan)} ${formatPlanIls(terms.monthlyIls)}. `}
          {hasOverride ? 'לעסק הזה יש תעריף מיוחד, והוא גובר על מחירון המנוי. ' : ''}
          {extraUserAmount > 0
            ? `משתמשים נוספים ${formatPlanIls(extraUserAmount)}. `
            : ''}
          {voiceIls == null
            ? ''
            : `שיחות קוליות ${formatPlanIls(voiceIls)}, כולל מע״מ. `}
          {`אחסון ${formatPlanIls(storageIls)}. `}
          הסכום משוער לפי השימוש עד עכשיו, והוא מתעדכן לפי דקות השיחה והאחסון.
        </p>
        {planError && <p className={styles.error}>{planError}</p>}
      </section>

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
            {memberCount == null
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
        {overUsers ? (
          <p className={styles.live}>
            {extraUsers.toLocaleString('he-IL')} משתמשים נוספים, {formatPlanIls(extraUserAmount)} לחודש.
          </p>
        ) : (
          <p className={styles.live}>
            משתמש נוסף מעבר ל־{terms.includedUsers}: {terms.extraUserIls} ₪ לחודש.
          </p>
        )}
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
          {terms.voiceAgorotPerMinute} אגורות לדקה לפני מע״מ
        </p>
        <p className={styles.live}>
          כולל מע״מ: {voiceAgorotIncludingVat(terms.voiceAgorotPerMinute).toLocaleString('he-IL')} אגורות לדקה.
          {voiceSeconds == null
            ? ' מחשב דקות...'
            : ` ${formatSpokenTime(voiceSeconds)} החודש, ${formatPlanIls(voiceIls ?? 0)}.`}
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
          <p>התעריף לחלון של 24 שעות.</p>
        </div>
        <p className={styles.price}>
          פניית לקוח: {terms.whatsappCustomerAgorot} אגורות ל־24 שעות לפני מע״מ
        </p>
        <p className={styles.live}>
          כולל מע״מ: {agorotIncludingVat(terms.whatsappCustomerAgorot).toLocaleString('he-IL')} אגורות.
        </p>
        <p className={styles.price}>
          פניית העסק: {terms.whatsappBusinessAgorot} אגורות ל־24 שעות לפני מע״מ
        </p>
        <p className={styles.live}>
          כולל מע״מ: {agorotIncludingVat(terms.whatsappBusinessAgorot).toLocaleString('he-IL')} אגורות.
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
