import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  createBusiness as createBusinessRequest,
  getBusinessMemberships,
} from './business.api';
import {
  BusinessContext,
  type BusinessMembership,
  type CreateBusinessInput,
} from './BusinessContextState';

interface BusinessProviderProps {
  userId: string;
  children: ReactNode;
}

const getStoredBusinessKey = (userId: string) => `activeBusiness:${userId}`;

function selectAvailableBusiness(
  memberships: BusinessMembership[],
  userId: string,
  currentCode: string | null,
) {
  const storedCode =
    currentCode ?? localStorage.getItem(getStoredBusinessKey(userId));
  const isAvailable = memberships.some(
    (membership) => membership.businessCode === storedCode,
  );
  const nextCode = isAvailable
    ? storedCode
    : memberships[0]?.businessCode ?? null;

  if (nextCode) {
    localStorage.setItem(getStoredBusinessKey(userId), nextCode);
  } else {
    localStorage.removeItem(getStoredBusinessKey(userId));
  }

  return nextCode;
}

export function BusinessProvider({ userId, children }: BusinessProviderProps) {
  const [memberships, setMemberships] = useState<BusinessMembership[]>([]);
  const [activeBusinessCode, setActiveBusinessCode] = useState<string | null>(
    () => localStorage.getItem(getStoredBusinessKey(userId)),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyMemberships = useCallback(
    (nextMemberships: BusinessMembership[]) => {
      setMemberships(nextMemberships);
      setActiveBusinessCode((currentCode) =>
        selectAvailableBusiness(nextMemberships, userId, currentCode),
      );
      setError(null);
    },
    [userId],
  );

  const refreshBusinesses = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const nextMemberships = await getBusinessMemberships(userId);
      applyMemberships(nextMemberships);
    } catch (requestError) {
      console.error('שגיאה בטעינת העסקים:', requestError);
      setMemberships([]);
      setError('לא ניתן לטעון את פרטי העסק. נסה לרענן את העמוד.');
    } finally {
      setIsLoading(false);
    }
  }, [applyMemberships, userId]);

  useEffect(() => {
    let isCancelled = false;

    void getBusinessMemberships(userId)
      .then((nextMemberships) => {
        if (isCancelled) return;

        applyMemberships(nextMemberships);
        setIsLoading(false);
      })
      .catch((requestError: unknown) => {
        if (isCancelled) return;

        console.error('שגיאה בטעינת העסקים:', requestError);
        setMemberships([]);
        setError('לא ניתן לטעון את פרטי העסק. נסה לרענן את העמוד.');
        setIsLoading(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [applyMemberships, userId]);

  const setActiveBusiness = useCallback(
    (businessCode: string) => {
      const isAvailable = memberships.some(
        (membership) => membership.businessCode === businessCode,
      );

      if (!isAvailable) return;

      localStorage.setItem(getStoredBusinessKey(userId), businessCode);
      setActiveBusinessCode(businessCode);
    },
    [memberships, userId],
  );

  const createBusiness = useCallback(
    async ({ businessName, contactPhone }: CreateBusinessInput) => {
      setIsCreating(true);
      setError(null);

      try {
        await createBusinessRequest({ businessName, contactPhone });
        await refreshBusinesses();
      } catch (requestError) {
        console.error('שגיאה ביצירת העסק:', requestError);
        setError('לא ניתן ליצור את העסק. בדוק את הפרטים ונסה שוב.');
      } finally {
        setIsCreating(false);
      }
    },
    [refreshBusinesses],
  );

  const activeBusiness = useMemo(
    () =>
      memberships.find(
        (membership) => membership.businessCode === activeBusinessCode,
      ) ?? null,
    [activeBusinessCode, memberships],
  );

  const value = useMemo(
    () => ({
      activeBusiness,
      memberships,
      isLoading,
      isCreating,
      error,
      createBusiness,
      setActiveBusiness,
      refreshBusinesses,
    }),
    [
      activeBusiness,
      memberships,
      isLoading,
      isCreating,
      error,
      createBusiness,
      setActiveBusiness,
      refreshBusinesses,
    ],
  );

  return (
    <BusinessContext.Provider value={value}>
      {children}
    </BusinessContext.Provider>
  );
}
