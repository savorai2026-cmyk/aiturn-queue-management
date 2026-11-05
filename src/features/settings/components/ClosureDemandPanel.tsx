import { useEffect, useState } from 'react';
import { listClosureDemand } from '../settings.api';
import { formatTimeHm } from '../../appointments/time';
import styles from './ClosureDemandPanel.module.css';

interface ClosureDemandPanelProps {
  businessCode: string;
}

interface DemandGroup {
  key: string;
  date: string;
  start: string;
  end: string;
  asked: number;
  insisted: number;
  bookedElsewhere: number;
}

const STATE_LABELS = {
  asked: 'ביקשו',
  insisted: 'התעקשו',
  bookedElsewhere: 'קבעו שעה אחרת',
} as const;

function groupDemand(
  rows: Array<{
    range_date: string;
    range_start: string;
    range_end: string;
    state: string;
  }>,
): DemandGroup[] {
  const groups = new Map<string, DemandGroup>();

  for (const row of rows) {
    const key = `${row.range_date}|${row.range_start}|${row.range_end}`;
    const current = groups.get(key) ?? {
      key,
      date: row.range_date,
      start: formatTimeHm(row.range_start),
      end: formatTimeHm(row.range_end),
      asked: 0,
      insisted: 0,
      bookedElsewhere: 0,
    };
    if (row.state === 'asked') current.asked += 1;
    if (row.state === 'insisted') current.insisted += 1;
    if (row.state === 'booked_elsewhere') current.bookedElsewhere += 1;
    groups.set(key, current);
  }

  return [...groups.values()];
}

function formatDate(dateKey: string) {
  const [year, month, day] = dateKey.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return dateKey;
  return new Intl.DateTimeFormat('he-IL', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  }).format(new Date(year, month - 1, day));
}

export default function ClosureDemandPanel({
  businessCode,
}: ClosureDemandPanelProps) {
  const [groups, setGroups] = useState<DemandGroup[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    listClosureDemand(businessCode)
      .then((rows) => {
        if (active) setGroups(groupDemand(rows));
      })
      .catch(() => {
        if (active) setError('לא ניתן לטעון את בקשות הלקוחות.');
      });
    return () => {
      active = false;
    };
  }, [businessCode]);

  return (
    <section className={styles.panel}>
      <h3>בקשות בטווחים שנשקלת בהם סגירה</h3>
      <p>
        כאן רואים מי ביקש שעה בטווח טנטטיבי, מי התעקש, ומי כבר קבע שעה אחרת.
        כשמספר המתעקשים מגיע לסף, הטווח עצמו יורד.
      </p>
      {error ? <p className={styles.error}>{error}</p> : null}
      {groups == null && !error ? <p>טוען בקשות...</p> : null}
      {groups && groups.length === 0 ? (
        <p>עדיין אין בקשות מלקוחות.</p>
      ) : null}
      {groups && groups.length > 0 ? (
        <ul className={styles.list}>
          {groups.map((group) => (
            <li key={group.key}>
              <strong>
                {formatDate(group.date)} · {group.start}–{group.end}
              </strong>
              <span>
                {STATE_LABELS.asked} {group.asked}
              </span>
              <span>
                {STATE_LABELS.insisted} {group.insisted}
              </span>
              <span>
                {STATE_LABELS.bookedElsewhere} {group.bookedElsewhere}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
