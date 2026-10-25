import {
  daysLimitText,
  monthsLimitText,
  planLabel,
  type PlanTariff,
  type SubscriptionPlan,
} from '../planPricing';
import styles from './PlanCard.module.css';

export default function PlanCard({
  plan,
  terms,
  selected,
  onSelect,
}: {
  plan: SubscriptionPlan;
  terms: PlanTariff;
  selected: boolean;
  onSelect?: () => void;
}) {
  const amount = (value: number) => value.toLocaleString('he-IL');
  const body = (
    <>
      <span className={styles.planHead}>
        <span className={styles.planName}>{planLabel(plan)}</span>
        {selected ? <span className={styles.planBadge}>נבחר</span> : null}
      </span>
      <span className={styles.planPrice}>
        {amount(terms.monthlyIls)} ₪ לחודש
        <span>כולל מע״מ</span>
      </span>
      <ul>
        <li>
          עד {amount(terms.includedUsers)} משתמשים. כל משתמש נוסף {amount(terms.extraUserIls)} ₪ לחודש.
        </li>
        <li>
          {amount(terms.includedStorageGb)} ג׳יגה כלולים. כל ג׳יגה נוספת {amount(terms.extraStorageGbIls)} ₪ לחודש.
        </li>
        <li>שיחת סוכן קולי: {amount(terms.voiceAgorotPerMinute)} אגורות לדקה, לפני מע״מ.</li>
        <li>
          וואטסאפ, פניית לקוח: {amount(terms.whatsappCustomerAgorot)} אגורות ל־24 שעות, לפני מע״מ.
        </li>
        <li>
          וואטסאפ, פניית העסק: {amount(terms.whatsappBusinessAgorot)} אגורות ל־24 שעות, לפני מע״מ.
        </li>
        <li>הקלטת קול {daysLimitText(terms.recordingMaxDays)}.</li>
        <li>היסטוריית תורים {monthsLimitText(terms.historyMaxMonths)}.</li>
        <li>
          תמלול, סיכום והתכתבות וואטסאפ {monthsLimitText(terms.correspondenceMaxMonths)}.
        </li>
      </ul>
    </>
  );

  if (!selected && onSelect) {
    return (
      <button type="button" className={styles.planOption} data-selected="false" onClick={onSelect}>
        {body}
      </button>
    );
  }

  return (
    <article className={styles.planOption} data-selected={selected}>
      {body}
    </article>
  );
}
