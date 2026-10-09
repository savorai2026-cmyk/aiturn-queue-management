import { usePlanMeters } from '../../settings/useBusinessStorage';
import PriceList from './PriceList';
import { tariffHasOverride, usePlanTariffs } from '../tariffs.api';
import styles from './UsagePage.module.css';

interface UsagePageProps {
  businessCode: string;
  onOpenStorageSettings: () => void;
  onOpenPlanSettings: () => void;
}

export default function UsagePage({
  businessCode,
  onOpenStorageSettings,
  onOpenPlanSettings,
}: UsagePageProps) {
  const meters = usePlanMeters(businessCode);
  const tariffs = usePlanTariffs(businessCode);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>עלות השימוש</h1>
        <p className={styles.pageNote}>
          המחירון של העסק, לפי השימוש עד עכשיו החודש.
        </p>
      </div>
      <div className={styles.panel}>
        <PriceList
          usedBytes={meters.usedBytes}
          quotaGb={meters.quotaGb}
          storageError={meters.error}
          memberCount={meters.memberCount}
          voiceSeconds={meters.voiceSeconds}
          planError={meters.planError}
          subscriptionPlan={meters.subscriptionPlan}
          regularTariff={tariffs.regular}
          expandedTariff={tariffs.expanded}
          resolvedTariff={tariffs.resolve(meters.subscriptionPlan ?? 'regular')}
          hasOverride={tariffHasOverride(tariffs.override)}
          onOpenStorageSettings={onOpenStorageSettings}
          onOpenPlanSettings={onOpenPlanSettings}
        />
      </div>
    </div>
  );
}
