import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../features/auth/AuthContextState';
import { getErrorMessage } from '../errors';
import {
  getDefaultVisibleKeys,
  getDisplayCatalog,
} from './catalogs';
import {
  hasStoredUiPreferences,
  readCachedUiPreferences,
  readLegacyClientColumns,
  resolveVisibleFields,
  toggleVisibleField,
  withScopeVisibleFields,
  writeCachedUiPreferences,
} from './preferences';
import type { DisplayScope, UiPreferences } from './types';
import {
  getUiPreferenceSources,
  updateMemberUiPreferences,
} from './uiPreferences.api';

export function useUiPreferences(businessCode: string) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberPrefs, setMemberPrefs] = useState<UiPreferences>(() =>
    readCachedUiPreferences(businessCode, userId),
  );
  const [businessPrefs, setBusinessPrefs] = useState<UiPreferences>({});

  useEffect(() => {
    if (!businessCode || !userId) return;

    let cancelled = false;

    void getUiPreferenceSources(businessCode, userId)
      .then((sources) => {
        if (cancelled) return;

        const cachedPrefs = readCachedUiPreferences(businessCode, userId);
        const legacyClients = readLegacyClientColumns(businessCode);
        let nextMemberPrefs = sources.memberPrefs;

        if (!hasStoredUiPreferences(nextMemberPrefs) && hasStoredUiPreferences(cachedPrefs)) {
          nextMemberPrefs = cachedPrefs;
        }

        if (!nextMemberPrefs.clients && legacyClients) {
          nextMemberPrefs = withScopeVisibleFields(
            nextMemberPrefs,
            'clients',
            legacyClients,
          );
        }

        setMemberId(sources.memberId);
        setMemberPrefs(nextMemberPrefs);
        setBusinessPrefs(sources.businessPrefs);
        writeCachedUiPreferences(businessCode, userId, nextMemberPrefs);

        if (
          sources.memberId &&
          hasStoredUiPreferences(nextMemberPrefs) &&
          JSON.stringify(nextMemberPrefs) !== JSON.stringify(sources.memberPrefs)
        ) {
          void updateMemberUiPreferences(sources.memberId, nextMemberPrefs).catch(
            (error: unknown) => {
              console.error('שגיאה בשמירת תצוגת עמודות:', getErrorMessage(error));
            },
          );
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.error('שגיאה בטעינת העדפות תצוגה:', getErrorMessage(error));
        const cachedPrefs = readCachedUiPreferences(businessCode, userId);
        if (hasStoredUiPreferences(cachedPrefs)) {
          setMemberPrefs(cachedPrefs);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [businessCode, userId]);

  const visibleFieldsFor = useCallback(
    (scope: DisplayScope) =>
      resolveVisibleFields(scope, memberPrefs, businessPrefs),
    [businessPrefs, memberPrefs],
  );

  const toggleField = useCallback(
    (scope: DisplayScope, key: string) => {
      const current = resolveVisibleFields(scope, memberPrefs, businessPrefs);
      const nextKeys = toggleVisibleField(current, key);
      const nextPrefs = withScopeVisibleFields(memberPrefs, scope, nextKeys);
      setMemberPrefs(nextPrefs);
      writeCachedUiPreferences(businessCode, userId, nextPrefs);

      if (!memberId) return;

      void updateMemberUiPreferences(memberId, nextPrefs).catch(
        (error: unknown) => {
          console.error('שגיאה בשמירת תצוגת שדות:', getErrorMessage(error));
        },
      );
    },
    [businessCode, businessPrefs, memberId, memberPrefs, userId],
  );

  const catalogs = useMemo(
    () => ({
      clients: getDisplayCatalog('clients'),
      appointments: getDisplayCatalog('appointments'),
      services: getDisplayCatalog('services'),
      business: getDisplayCatalog('business'),
      statuses: getDisplayCatalog('statuses'),
      defaults: getDefaultVisibleKeys,
    }),
    [],
  );

  return {
    catalogs,
    visibleFieldsFor,
    toggleField,
  };
}
