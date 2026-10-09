import {
  agorotIncludingVat,
  catalogTariff,
  daysLimitText,
  monthsLimitText,
  planLabel,
  voiceAgorotIncludingVat,
  type SubscriptionPlan,
} from '../planPricing';
import { MAX_STORAGE_QUOTA_GB } from '../../settings/storageQuota';
import styles from './PlanRates.module.css';

const PENDING = 'עדיין בפיתוח';

export default function PlanRates({
  plan = 'regular',
}: {
  plan?: SubscriptionPlan;
}) {
  const terms = catalogTariff(plan);
  const retention =
    plan === 'expanded'
      ? `הקלטה, היסטוריית תורים, תמלול, סיכום והתכתבות וואטסאפ ${monthsLimitText(terms.correspondenceMaxMonths)}.`
      : `הקלטת קול ${daysLimitText(terms.recordingMaxDays)}. היסטוריית תורים ${monthsLimitText(terms.historyMaxMonths)}. תמלול, סיכום והתכתבות וואטסאפ ${monthsLimitText(terms.correspondenceMaxMonths)}.`;

  return (
    <div className={styles.rates}>
      <p className={styles.note}>
        הסכום משוער, והוא מתעדכן לפי דקות השיחה והאחסון.
      </p>
      <Rate
        title={`מנוי ${planLabel(plan)}`}
        price={`${terms.monthlyIls} ₪ כולל מע״מ`}
        detail={`עד ${terms.includedUsers} משתמשים. כל משתמש נוסף ${terms.extraUserIls} ₪ לחודש. ${retention}`}
      />
      <Rate
        title="שיחת סוכן קולי"
        price={`${terms.voiceAgorotPerMinute} אגורות לדקה לפני מע״מ`}
        detail={`כולל מע״מ: ${voiceAgorotIncludingVat(terms.voiceAgorotPerMinute).toLocaleString('he-IL')} אגורות לדקה, לפי השניות שדיברו.`}
      />
      <Rate
        title="אחסון מעבר למכסה"
        price={`${terms.extraStorageGbIls} ₪ לג׳יגה לחודש`}
        detail={`${terms.includedStorageGb} ג׳יגה כלולים. המקסימום ${MAX_STORAGE_QUOTA_GB} ג׳יגה.`}
      />
      <Rate title="וואטסאפ, פניית לקוח" price={`${terms.whatsappCustomerAgorot} אגורות ל־24 שעות לפני מע״מ`} detail={`כולל מע״מ: ${agorotIncludingVat(terms.whatsappCustomerAgorot).toLocaleString('he-IL')} אגורות. כשהלקוח פונה ראשון.`} />
      <Rate title="וואטסאפ, פניית העסק" price={`${terms.whatsappBusinessAgorot} אגורות ל־24 שעות לפני מע״מ`} detail={`כולל מע״מ: ${agorotIncludingVat(terms.whatsappBusinessAgorot).toLocaleString('he-IL')} אגורות. כשהעסק פונה ראשון.`} />
      <Rate title="סליקה ושמירת אסמכתא" price={PENDING} detail="חיוב הלקוח ושמירת אסמכתת העסקה." pending />
      <Rate title="הפקת חשבונית" price={PENDING} detail="הפקת חשבונית ללקוח." pending />
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
