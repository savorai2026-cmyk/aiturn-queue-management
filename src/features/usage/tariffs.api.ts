import { useEffect, useState } from 'react';
import { supabase } from '../../supabaseClient';
import {
  applyTariffOverride,
  catalogTariff,
  type PlanTariff,
  type SubscriptionPlan,
} from './planPricing';

interface TariffRow {
  plan?: string;
  monthly_ils: number | string | null;
  included_users: number | string | null;
  extra_user_ils: number | string | null;
  included_storage_gb: number | string | null;
  extra_storage_gb_ils: number | string | null;
  voice_agorot_per_minute: number | string | null;
  whatsapp_customer_agorot: number | string | null;
  whatsapp_business_agorot: number | string | null;
  recording_max_days: number | string | null;
  history_max_months: number | string | null;
  correspondence_max_months: number | string | null;
}

function partialTariff(row: TariffRow | null): Partial<PlanTariff> | null {
  if (!row) return null;
  const value = (input: number | string | null) => {
    if (input == null || input === '') return undefined;
    const number = Number(input);
    return Number.isFinite(number) ? number : undefined;
  };
  return {
    monthlyIls: value(row.monthly_ils),
    includedUsers: value(row.included_users),
    extraUserIls: value(row.extra_user_ils),
    includedStorageGb: value(row.included_storage_gb),
    extraStorageGbIls: value(row.extra_storage_gb_ils),
    voiceAgorotPerMinute: value(row.voice_agorot_per_minute),
    whatsappCustomerAgorot: value(row.whatsapp_customer_agorot),
    whatsappBusinessAgorot: value(row.whatsapp_business_agorot),
    recordingMaxDays: value(row.recording_max_days),
    historyMaxMonths: value(row.history_max_months),
    correspondenceMaxMonths: value(row.correspondence_max_months),
  };
}

export async function loadPlanTariffs(businessCode: string): Promise<{
  regular: PlanTariff;
  expanded: PlanTariff;
  override: Partial<PlanTariff> | null;
}> {
  const [plans, override] = await Promise.all([
    supabase.from('plan_tariffs').select('*'),
    supabase
      .from('business_tariff_overrides')
      .select('*')
      .eq('business_code', businessCode)
      .maybeSingle(),
  ]);

  const rows = (plans.error ? [] : plans.data ?? []) as TariffRow[];
  const byPlan = new Map(rows.map((row) => [row.plan, partialTariff(row)]));
  const regular = applyTariffOverride(catalogTariff('regular'), byPlan.get('regular') ?? null);
  const expanded = applyTariffOverride(catalogTariff('expanded'), byPlan.get('expanded') ?? null);
  return {
    regular,
    expanded,
    override: override.error ? null : partialTariff(override.data as TariffRow | null),
  };
}

export function usePlanTariffs(businessCode: string) {
  const [regular, setRegular] = useState<PlanTariff>(() => catalogTariff('regular'));
  const [expanded, setExpanded] = useState<PlanTariff>(() => catalogTariff('expanded'));
  const [override, setOverride] = useState<Partial<PlanTariff> | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadPlanTariffs(businessCode)
      .then((value) => {
        if (cancelled) return;
        setRegular(value.regular);
        setExpanded(value.expanded);
        setOverride(value.override);
      })
      .catch(() => {
        if (cancelled) return;
        setRegular(catalogTariff('regular'));
        setExpanded(catalogTariff('expanded'));
        setOverride(null);
      });
    return () => {
      cancelled = true;
    };
  }, [businessCode]);

  const resolve = (plan: SubscriptionPlan) =>
    applyTariffOverride(plan === 'expanded' ? expanded : regular, override);

  return { regular, expanded, override, resolve };
}

export function tariffHasOverride(override: Partial<PlanTariff> | null): boolean {
  if (!override) return false;
  return Object.values(override).some(
    (value) => typeof value === 'number' && Number.isFinite(value),
  );
}
