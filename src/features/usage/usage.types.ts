import type { Json } from '../../types/database';

export interface UsageEvent {
  id: string;
  businessCode: string;
  action: string;
  quantity: number;
  unit: string;
  amountCredits: number;
  meta: Json | null;
  createdAt: string;
}

export interface UsageAccount {
  balanceCredits: number;
  currency: string;
  updatedAt: string;
}

export interface UsagePrice {
  action: string;
  unit: string;
  amountCredits: number;
}

export interface UsageActionSummary {
  action: string;
  unit: string;
  count: number;
  quantity: number;
  credits: number;
}

export interface UsageOverview {
  account: UsageAccount | null;
  events: UsageEvent[];
  prices: UsagePrice[];
  truncated: boolean;
}

export type UsageEventColumnKey =
  | 'createdAt'
  | 'action'
  | 'quantity'
  | 'unit'
  | 'amountCredits'
  | 'id'
  | 'businessCode'
  | 'meta';
