import {
  getStatusColor,
  getStatusLabel,
  isCanceledStatus,
  type StatusCatalogItem,
} from '../appointments/appointmentStatuses';
import { eachDateKey, formatDayLabel } from './stats.range';
import type { StatsAppointment, StatsBar, StatsSummary } from './stats.types';

const CHANNEL_LABELS: Record<string, string> = {
  manual: 'ידני',
  whatsapp: 'וואטסאפ',
  phone: 'טלפון',
  voice: 'קולי',
  vapi: 'בוט קולי',
};

function isCompletedStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === '03' || normalized === 'completed';
}

function channelLabel(channel: string | null) {
  if (!channel?.trim()) return 'לא צוין';
  return CHANNEL_LABELS[channel.trim().toLowerCase()] ?? channel.trim();
}

function hourKey(startTime: string) {
  const match = /^(\d{1,2})/.exec(startTime);
  if (!match) return null;
  const hour = Number(match[1]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;
  return String(hour).padStart(2, '0');
}

function barsDescending(bars: StatsBar[]) {
  return bars.sort((left, right) => right.value - left.value || left.label.localeCompare(right.label, 'he'));
}

export function summarizeStats(
  appointments: StatsAppointment[],
  from: string,
  to: string,
  catalog: StatusCatalogItem[] = [],
): StatsSummary {
  const byDay = new Map(eachDateKey(from, to).map((date) => [date, 0]));
  const byStatus = new Map<string, number>();
  const byService = new Map<string, number>();
  const byHour = new Map<string, number>();
  const byChannel = new Map<string, number>();
  let completed = 0;
  let canceled = 0;
  let revenue = 0;

  for (const appointment of appointments) {
    byDay.set(appointment.date, (byDay.get(appointment.date) ?? 0) + 1);
    byStatus.set(appointment.status, (byStatus.get(appointment.status) ?? 0) + 1);
    const titles = appointment.serviceTitles.map((title) => title.trim()).filter(Boolean);
    for (const title of titles.length > 0 ? titles : ['בלי שירות']) {
      byService.set(title, (byService.get(title) ?? 0) + 1);
    }
    const hour = hourKey(appointment.startTime);
    if (hour) byHour.set(hour, (byHour.get(hour) ?? 0) + 1);
    const channel = channelLabel(appointment.channel);
    byChannel.set(channel, (byChannel.get(channel) ?? 0) + 1);
    if (isCompletedStatus(appointment.status)) completed += 1;
    if (isCanceledStatus(appointment.status)) canceled += 1;
    revenue += Number.isFinite(appointment.price) ? appointment.price : 0;
  }

  return {
    total: appointments.length,
    completed,
    canceled,
    revenue,
    byDay: [...byDay.entries()].map(([date, value]) => ({
      key: date,
      label: formatDayLabel(date),
      value,
    })),
    byStatus: barsDescending(
      [...byStatus.entries()].map(([status, value]) => ({
        key: status,
        label: getStatusLabel(status, catalog),
        value,
        color: getStatusColor(status, catalog),
      })),
    ),
    byService: barsDescending(
      [...byService.entries()].map(([label, value]) => ({ key: label, label, value })),
    ),
    byHour: [...byHour.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([hour, value]) => ({ key: hour, label: `${hour}:00`, value })),
    byChannel: barsDescending(
      [...byChannel.entries()].map(([label, value]) => ({ key: label, label, value })),
    ),
  };
}
