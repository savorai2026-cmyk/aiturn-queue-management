export type StatsPeriod = 'week' | 'month' | 'quarter';

export interface StatsAppointment {
  clientId: number;
  clientName: string;
  date: string;
  startTime: string;
  status: string;
  channel: string | null;
  price: number;
  serviceTitles: string[];
}

export interface InsightPerson {
  id: number;
  name: string;
  detail: string;
}

export interface InsightGroup {
  key: string;
  title: string;
  body: string;
  people: InsightPerson[];
}

export interface InsightAdvice {
  key: string;
  text: string;
}

export interface ClientInsights {
  groups: InsightGroup[];
  advice: InsightAdvice[];
}

export interface StatsBar {
  key: string;
  label: string;
  value: number;
  color?: string;
}

export interface StatsSummary {
  total: number;
  completed: number;
  canceled: number;
  revenue: number;
  byDay: StatsBar[];
  byStatus: StatsBar[];
  byService: StatsBar[];
  byHour: StatsBar[];
  byChannel: StatsBar[];
}
