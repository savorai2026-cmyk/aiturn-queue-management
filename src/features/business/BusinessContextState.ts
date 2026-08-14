import { createContext, useContext } from 'react';

export type BusinessRole = 'owner' | 'admin' | 'staff' | 'viewer';

export interface BusinessMembership {
  businessCode: string;
  businessName: string;
  role: BusinessRole;
}

export interface CreateBusinessInput {
  businessName: string;
  contactPhone?: string;
}

export interface BusinessContextValue {
  activeBusiness: BusinessMembership | null;
  memberships: BusinessMembership[];
  isLoading: boolean;
  isCreating: boolean;
  error: string | null;
  createBusiness: (input: CreateBusinessInput) => Promise<void>;
  setActiveBusiness: (businessCode: string) => void;
  refreshBusinesses: () => Promise<void>;
}

export const BusinessContext = createContext<BusinessContextValue | null>(null);

export function useBusiness() {
  const context = useContext(BusinessContext);

  if (!context) {
    throw new Error('useBusiness must be used inside BusinessProvider');
  }

  return context;
}
