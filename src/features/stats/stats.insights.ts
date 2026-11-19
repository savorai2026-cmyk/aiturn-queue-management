import { isCanceledStatus } from '../appointments/appointmentStatuses';
import type { ClientInsights, InsightGroup, InsightPerson, StatsAppointment } from './stats.types';

const MONEY = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
});

interface ClientBucket {
  id: number;
  name: string;
  total: number;
  completed: number;
  canceled: number;
  noShow: number;
  revenue: number;
}

function isCompletedStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === '03' || normalized === 'completed';
}

function isNoShowStatus(status: string) {
  const normalized = status.trim().toLowerCase();
  return normalized === '09' || normalized === 'no_show' || normalized === 'noshow';
}

function shareLabel(part: number, total: number) {
  if (total <= 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

function person(bucket: ClientBucket, detail: string): InsightPerson {
  return { id: bucket.id, name: bucket.name, detail };
}

function top(buckets: ClientBucket[], limit = 3) {
  return buckets.slice(0, limit);
}

export function buildClientInsights(appointments: StatsAppointment[]): ClientInsights {
  const byClient = new Map<number, ClientBucket>();
  const byHour = new Map<string, number>();
  let withoutService = 0;

  for (const appointment of appointments) {
    const bucket = byClient.get(appointment.clientId) ?? {
      id: appointment.clientId,
      name: appointment.clientName.trim() || 'לקוח ללא שם',
      total: 0,
      completed: 0,
      canceled: 0,
      noShow: 0,
      revenue: 0,
    };
    bucket.total += 1;
    if (isCompletedStatus(appointment.status)) bucket.completed += 1;
    if (isCanceledStatus(appointment.status)) bucket.canceled += 1;
    if (isNoShowStatus(appointment.status)) bucket.noShow += 1;
    if (Number.isFinite(appointment.price)) bucket.revenue += appointment.price;
    byClient.set(appointment.clientId, bucket);

    const hour = /^(\d{1,2})/.exec(appointment.startTime)?.[1];
    if (hour) {
      const key = hour.padStart(2, '0');
      byHour.set(key, (byHour.get(key) ?? 0) + 1);
    }
    if (appointment.serviceTitles.every((title) => !title.trim())) withoutService += 1;
  }

  const clients = [...byClient.values()];
  const total = appointments.length;
  const canceled = clients.reduce((sum, client) => sum + client.canceled, 0);
  const completed = clients.reduce((sum, client) => sum + client.completed, 0);
  const revenue = clients.reduce((sum, client) => sum + client.revenue, 0);

  const cancellers = top(
    clients
      .filter((client) => client.canceled >= 2 && client.canceled / client.total >= 0.5)
      .sort((left, right) => right.canceled - left.canceled || right.total - left.total),
  );
  const noShows = top(
    clients
      .filter((client) => client.noShow >= 2)
      .sort((left, right) => right.noShow - left.noShow || right.total - left.total),
  );
  const loyal = top(
    clients
      .filter((client) => client.completed >= 2 && client.canceled === 0 && client.noShow === 0)
      .sort((left, right) => right.completed - left.completed || right.revenue - left.revenue),
  );
  const earners = top(
    clients
      .filter((client) => client.total >= 2 && revenue > 0 && client.revenue / revenue >= 0.3)
      .sort((left, right) => right.revenue - left.revenue),
  );

  const groups: InsightGroup[] = [];
  if (cancellers.length > 0) {
    groups.push({
      key: 'cancellers',
      title: 'מבטלים',
      body: 'לקוחות שביטלו לפחות שני תורים, ורוב התורים שלהם בתקופה בוטלו.',
      people: cancellers.map((client) =>
        person(client, `${client.canceled} ביטולים מתוך ${client.total} תורים`),
      ),
    });
  }
  if (noShows.length > 0) {
    groups.push({
      key: 'no-shows',
      title: 'לא הגיעו',
      body: 'לקוחות שלא הגיעו לפחות לשני תורים בתקופה.',
      people: noShows.map((client) =>
        person(client, `${client.noShow} אי-הגעות מתוך ${client.total} תורים`),
      ),
    });
  }
  if (loyal.length > 0) {
    groups.push({
      key: 'loyal',
      title: 'מתמידים',
      body: 'לקוחות שהשלימו לפחות שני תורים, בלי ביטול ובלי אי-הגעה.',
      people: loyal.map((client) => person(client, `${client.completed} תורים שהושלמו`)),
    });
  }
  if (earners.length > 0 && clients.length > 1) {
    groups.push({
      key: 'earners',
      title: 'חלק גדול מהסכום',
      body: 'לקוחות עם יותר מתור אחד, שמהם מגיע חלק ניכר מהסכום בתקופה.',
      people: earners.map((client) =>
        person(client, `${MONEY.format(client.revenue)} · ${shareLabel(client.revenue, revenue)}`),
      ),
    });
  }

  const advice: ClientInsights['advice'] = [];
  if (cancellers.length > 0) {
    advice.push({
      key: 'deposit',
      text: 'אצל המבטלים שחוזרים על כך, שווה לשקול אישור לפני המועד או מקדמה. רק אם זה מתאים למדיניות העסק.',
    });
  } else if (total >= 8 && canceled / total >= 0.3) {
    advice.push({
      key: 'cancel-rate',
      text: `${shareLabel(canceled, total)} מהתורים בתקופה בוטלו, בלי לקוח אחד שחוזר על זה. שווה לבדוק אם חסרות תזכורות, או שהמועדים שמוצעים פחות נוחים.`,
    });
  }
  if (noShows.length > 0) {
    advice.push({
      key: 'reminder',
      text: 'ללקוחות עם כמה אי-הגעות, תזכורת ביום התור עשויה לעזור. זה שיקול, לא כלל לכל הלקוחות.',
    });
  }
  if (loyal.length > 0) {
    advice.push({
      key: 'keep',
      text: 'המתמידים כבר מגיעים בעקביות. אפשר לשקול עבורם מועד קבוע או מילה טובה, לפי מה שמתאים לעסק.',
    });
  }
  if (earners.length > 0 && clients.length > 1) {
    advice.push({
      key: 'revenue',
      text: 'חלק ניכר מהסכום מרוכז אצל מעט לקוחות. שווה לשים לב איך שומרים עליהם, בלי להזניח לקוחות חדשים.',
    });
  }
  if (total >= 5 && withoutService / total >= 0.4) {
    advice.push({
      key: 'services',
      text: 'בהרבה תורים לא סומן שירות. שיוך שירות יבהיר אילו טיפולים באמת נמכרים.',
    });
  }
  if (total >= 5 && completed === 0) {
    advice.push({
      key: 'status',
      text: 'אין בתקופה תורים שסומנו כהושלמו. אם חלקם כבר התקיימו, עדכון הסטטוס יחדד את התמונה.',
    });
  }
  const busiest = [...byHour.entries()].sort((left, right) => right[1] - left[1])[0];
  if (busiest && total >= 8 && busiest[1] / total >= 0.35) {
    advice.push({
      key: 'hour',
      text: `הרבה תורים נפתחים סביב ${busiest[0]}:00. אם השעה הזו עמוסה, אפשר להציע ללקוחות חדשים שעות פנויות.`,
    });
  }

  return { groups, advice: advice.slice(0, 4) };
}
