import { useEffect, useState } from 'react';
import {
  getBusinessPlanUsage,
  getBusinessStorageQuotaGb,
  getBusinessStorageUsedBytes,
  getBusinessSubscriptionPlan,
} from './settings.api';
import { type SubscriptionPlan } from '../usage/planPricing';
import { INCLUDED_STORAGE_GB, normalizeStorageQuotaGb } from './storageQuota';

export function useBusinessStorage(businessCode: string) {
  const [usedBytes, setUsedBytes] = useState<number | null>(null);
  const [quotaGb, setQuotaGb] = useState(INCLUDED_STORAGE_GB);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setUsedBytes(null);
    setError('');

    Promise.all([
      getBusinessStorageUsedBytes(businessCode),
      getBusinessStorageQuotaGb(businessCode),
    ])
      .then(([bytes, quota]) => {
        if (cancelled) return;
        setUsedBytes(bytes);
        setQuotaGb(normalizeStorageQuotaGb(quota) ?? INCLUDED_STORAGE_GB);
      })
      .catch(() => {
        if (!cancelled) setError('לא ניתן לחשב את נפח האחסון.');
      });

    return () => {
      cancelled = true;
    };
  }, [businessCode]);

  return { usedBytes, quotaGb, error };
}

export function usePlanMeters(businessCode: string) {
  const storage = useBusinessStorage(businessCode);
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [voiceSeconds, setVoiceSeconds] = useState<number | null>(null);
  const [planError, setPlanError] = useState('');
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan | null>(null);

  useEffect(() => {
    let cancelled = false;
    setMemberCount(null);
    setVoiceSeconds(null);
    setPlanError('');
    setSubscriptionPlan(null);

    Promise.all([
      getBusinessPlanUsage(businessCode),
      getBusinessSubscriptionPlan(businessCode),
    ])
      .then(([usage, plan]) => {
        if (cancelled) return;
        setMemberCount(usage.memberCount);
        setVoiceSeconds(usage.voiceSeconds);
        setSubscriptionPlan(plan);
      })
      .catch(() => {
        if (!cancelled) setPlanError('לא ניתן לחשב את השימוש החודשי.');
      });

    return () => {
      cancelled = true;
    };
  }, [businessCode]);

  return { ...storage, memberCount, voiceSeconds, planError, subscriptionPlan };
}
