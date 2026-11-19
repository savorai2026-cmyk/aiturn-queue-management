import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { ErrorState, LoadingState, useReportPageReady } from '../../../shared/components/PageState';
import { summarizeStats } from '../stats.aggregate';
import { buildClientInsights } from '../stats.insights';
import type { StatsBar, StatsPeriod } from '../stats.types';
import { useStats } from '../useStats';
import styles from './StatsPage.module.css';

const PERIODS: { id: StatsPeriod; label: string }[] = [
  { id: 'week', label: 'שבוע' },
  { id: 'month', label: 'חודש' },
  { id: 'quarter', label: '90 יום' },
];

const MONEY = new Intl.NumberFormat('he-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
});

const PIE_COLORS = [
  '#16a34a',
  '#2563eb',
  '#d97706',
  '#7c3aed',
  '#e11d48',
  '#0f766e',
  '#65a30d',
  '#ea580c',
  '#4f46e5',
  '#64748b',
];

function Accordion({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(true);

  return (
    <section className={`${styles.accordion} ${open ? '' : styles.accordionClosed}`}>
      <button
        type="button"
        className={styles.accordionHit}
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={`${styles.chevron} ${open ? '' : styles.chevronClosed}`} aria-hidden="true" />
        <h2>{title}</h2>
      </button>
      {open ? <div className={styles.accordionBody}>{children}</div> : null}
    </section>
  );
}

function hasValues(rows: StatsBar[]) {
  return rows.some((row) => row.value > 0);
}

function shareLabel(part: number, total: number) {
  if (total <= 0) return '0%';
  return `${Math.round((part / total) * 100)}%`;
}

const WEEKDAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function dayTipTitle(dateKey: string, fallback: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  if (!year || !month || !day) return fallback;
  const date = new Date(year, month - 1, day);
  return `יום ${WEEKDAYS[date.getDay()]}, ${day}.${month}`;
}

function dayTipCount(value: number) {
  if (value === 0) return 'אין תורים';
  if (value === 1) return 'תור אחד';
  return `${value} תורים`;
}

function LineChart({ rows }: { rows: StatsBar[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const width = 1000;
  const height = 150;
  const pad = { top: 10, right: 18, bottom: 26, left: 32 };
  const max = Math.max(...rows.map((row) => row.value), 1);
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const step = rows.length > 1 ? innerW / (rows.length - 1) : 0;
  const points = rows.map((row, index) => ({
    ...row,
    x: pad.left + index * step,
    y: pad.top + innerH - (row.value / max) * innerH,
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const last = points[points.length - 1];
  const area = last
    ? `${pad.left},${pad.top + innerH} ${line} ${last.x},${pad.top + innerH}`
    : '';
  const labelEvery = Math.max(1, Math.ceil(rows.length / 7));
  const yTicks = [...new Set([0, Math.ceil(max / 2), max])];
  const lastIndex = points.length - 1;
  const labelIndexes = points
    .map((_, index) => index)
    .filter((index) => index % labelEvery === 0 || index === lastIndex);
  while (labelIndexes.length > 1) {
    const last = labelIndexes[labelIndexes.length - 1];
    const previous = labelIndexes[labelIndexes.length - 2];
    if (points[last].x - points[previous].x >= 56) break;
    labelIndexes.splice(labelIndexes.length - 2, 1);
  }

  const active = points.find((point) => point.key === activeKey) ?? null;

  return (
    <div className={styles.lineFrame} onMouseLeave={() => setActiveKey(null)}>
    <svg className={styles.lineChart} viewBox={`0 0 ${width} ${height}`} role="img">
      {yTicks.map((tick) => {
        const y = pad.top + innerH - (tick / max) * innerH;
        return (
          <g key={tick}>
            <line className={styles.gridLine} x1={pad.left} x2={width - pad.right} y1={y} y2={y} />
            <text className={styles.axisText} x={pad.left - 8} y={y + 4} textAnchor="end">
              {tick}
            </text>
          </g>
        );
      })}
      {area ? <polygon className={styles.lineArea} points={area} /> : null}
      <polyline className={styles.line} points={line} />
      {points.map((point) => (
        <g key={point.key}>
          <circle
            className={`${styles.point}${activeKey === point.key ? ` ${styles.pointOn}` : ''}`}
            cx={point.x}
            cy={point.y}
            r={activeKey === point.key ? 3.2 : 2.1}
          />
          <circle
            className={styles.pointHit}
            cx={point.x}
            cy={point.y}
            r={9}
            onMouseEnter={() => setActiveKey(point.key)}
          />
        </g>
      ))}
      {labelIndexes.map((index) => {
        const point = points[index];
        const anchor = index === 0 ? 'start' : index === lastIndex ? 'end' : 'middle';
        return (
          <text
            key={`${point.key}-label`}
            className={styles.axisText}
            x={point.x}
            y={height - 8}
            textAnchor={anchor}
          >
            {point.label}
          </text>
        );
      })}
    </svg>
    {active ? (
      <div
        className={`${styles.dayTip}${active.y < 42 ? ` ${styles.dayTipBelow}` : ''}`}
        style={{
          left: `${(active.x / width) * 100}%`,
          top: `${(active.y / height) * 100}%`,
        }}
      >
        <strong>{dayTipTitle(active.key, active.label)}</strong>
        <span>{dayTipCount(active.value)}</span>
      </div>
    ) : null}
    </div>
  );
}

function piePath(cx: number, cy: number, radius: number, start: number, end: number) {
  const sweep = end - start;
  if (sweep >= Math.PI * 2 - 0.0001) {
    return '';
  }
  const x1 = cx + radius * Math.cos(start);
  const y1 = cy + radius * Math.sin(start);
  const x2 = cx + radius * Math.cos(end);
  const y2 = cy + radius * Math.sin(end);
  const large = sweep > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`;
}

function PieChart({ rows }: { rows: StatsBar[] }) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const items = rows.filter((row) => row.value > 0);
  const total = items.reduce((sum, row) => sum + row.value, 0);
  let angle = -Math.PI / 2;
  const slices = items.map((item, index) => {
    const start = angle;
    const sweep = total > 0 ? (item.value / total) * Math.PI * 2 : 0;
    angle += sweep;
    const mid = start + sweep / 2;
    return {
      ...item,
      start,
      end: angle,
      color: item.color ?? PIE_COLORS[index % PIE_COLORS.length],
      dx: Math.cos(mid) * 7,
      dy: Math.sin(mid) * 7,
    };
  });
  const active = slices.find((slice) => slice.key === activeKey) ?? null;

  return (
    <div className={styles.pieLayout}>
      <svg className={styles.pie} viewBox="0 0 180 180" aria-hidden="true">
        {slices.length === 1 ? (
          <circle
            className={`${styles.slice}${active ? ` ${styles.sliceOn}` : ''}`}
            cx="90"
            cy="90"
            r="68"
            fill={slices[0].color}
            onMouseEnter={() => setActiveKey(slices[0].key)}
            onMouseLeave={() => setActiveKey(null)}
          />
        ) : (
          slices.map((slice) => (
            <path
              key={slice.key}
              className={`${styles.slice}${activeKey === slice.key ? ` ${styles.sliceOn}` : ''}`}
              d={piePath(90, 90, 68, slice.start, slice.end)}
              fill={slice.color}
              style={activeKey === slice.key ? { transform: `translate(${slice.dx}px, ${slice.dy}px)` } : undefined}
              onMouseEnter={() => setActiveKey(slice.key)}
              onMouseLeave={() => setActiveKey(null)}
            >
              <title>{`${slice.label}: ${slice.value}`}</title>
            </path>
          ))
        )}
        <circle className={styles.pieHole} cx="90" cy="90" r="42" />
        <text className={styles.pieTotal} x="90" y={active ? 88 : 96} textAnchor="middle">
          {active ? active.value : total}
        </text>
        {active ? (
          <text className={styles.pieShare} x="90" y="108" textAnchor="middle">
            {shareLabel(active.value, total)}
          </text>
        ) : null}
      </svg>
      <ul className={styles.legend}>
        {slices.map((slice) => (
          <li key={slice.key}>
            <button
              type="button"
              className={activeKey === slice.key ? styles.legendOn : undefined}
              style={{ '--slice': slice.color } as CSSProperties}
              onMouseEnter={() => setActiveKey(slice.key)}
              onMouseLeave={() => setActiveKey(null)}
            >
              <span className={styles.swatch} style={{ background: slice.color }} />
              <span className={styles.legendLabel} title={slice.label}>{slice.label}</span>
              <span className={styles.legendValue}>
                {slice.value}
                <small>{shareLabel(slice.value, total)}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function StatsPage({
  businessCode,
  onReady,
}: {
  businessCode: string;
  onReady?: () => void;
}) {
  const [period, setPeriod] = useState<StatsPeriod>('month');
  const { data, error, isLoading, refresh, range } = useStats(businessCode, period);
  useReportPageReady(!isLoading || Boolean(error), onReady);
  const viewRef = useRef<{
    rows: typeof data.rows;
    statuses: typeof data.statuses;
    from: string;
    to: string;
  } | null>(null);
  if (!isLoading && !error) {
    const current = viewRef.current;
    if (!current || current.rows !== data.rows || current.from !== range.from || current.to !== range.to) {
      viewRef.current = { rows: data.rows, statuses: data.statuses, from: range.from, to: range.to };
    }
  }
  const view = viewRef.current;
  const summary = useMemo(
    () => (view ? summarizeStats(view.rows, view.from, view.to, view.statuses) : null),
    [view],
  );
  const insights = useMemo(() => (view ? buildClientInsights(view.rows) : null), [view]);
  const periodRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [pillReady, setPillReady] = useState(false);

  useLayoutEffect(() => {
    const container = periodRef.current;
    if (!container) return;
    let cancelled = false;
    const place = () => {
      if (cancelled) return;
      const current = container.querySelector<HTMLElement>('[aria-checked="true"]');
      if (!current) return;
      setPill({
        x: current.offsetLeft,
        y: current.offsetTop,
        width: current.offsetWidth,
        height: current.offsetHeight,
      });
    };
    place();
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) setPillReady(true);
    });
    window.addEventListener('resize', place);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
    };
  }, [period]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1>סטטיסטיקה</h1>
          <p>תמונת מצב של התורים בתקופה שנבחרה.</p>
        </div>
        <div
          ref={periodRef}
          className={styles.period}
          role="radiogroup"
          aria-label="תקופה"
        >
          {pill ? (
            <span
              className={`${styles.periodGlide}${pillReady ? ` ${styles.periodGlideReady}` : ''}`}
              style={{
                width: pill.width,
                height: pill.height,
                transform: `translate(${pill.x}px, ${pill.y}px)`,
              }}
            />
          ) : null}
          {PERIODS.map((item) => {
            const selected = item.id === period;
            return (
              <button
                key={item.id}
                type="button"
                role="radio"
                aria-checked={selected}
                className={selected ? styles.periodActive : styles.periodButton}
                onClick={() => setPeriod(item.id)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </header>

      {!view && isLoading ? <LoadingState message="טוען סטטיסטיקה..." /> : null}
      {!isLoading && error ? <ErrorState message={error} onRetry={refresh} /> : null}
      {view && summary && insights && !error ? (
        <div className={isLoading ? styles.resultsUpdating : styles.results}>
          <section className={styles.kpis}>
            <article className={styles.kpiTotal}>
              <span>תורים בתקופה</span>
              <strong>{summary.total}</strong>
              <small>כל הסטטוסים יחד</small>
            </article>
            <article className={styles.kpiDone}>
              <span>הושלמו</span>
              <strong>{summary.completed}</strong>
              <small>{shareLabel(summary.completed, summary.total)} מהתורים</small>
            </article>
            <article className={styles.kpiCancel}>
              <span>בוטלו</span>
              <strong>{summary.canceled}</strong>
              <small>{shareLabel(summary.canceled, summary.total)} מהתורים</small>
            </article>
            <article className={styles.kpiMoney}>
              <span>סכום מחירים</span>
              <strong>{MONEY.format(summary.revenue)}</strong>
              <small>
                {summary.total > 0
                  ? `ממוצע ${MONEY.format(summary.revenue / summary.total)} לתור`
                  : 'אין תורים בתקופה'}
              </small>
            </article>
          </section>
          <Accordion title="תובנות">
            <p className={styles.insightIntro}>
              על לקוחות בולטים בתקופה, ומסקנות לשיקול בעל העסק.
            </p>
            {insights.groups.length === 0 && insights.advice.length === 0 ? (
              <p className={styles.empty}>אין עדיין דפוס בולט של לקוחות בתקופה הזו.</p>
            ) : (
              <>
                {insights.groups.length > 0 ? (
                  <div className={styles.insightGrid}>
                    {insights.groups.map((group) => (
                      <article key={group.key} className={styles.insightGroup} data-tone={group.key}>
                        <h3>{group.title}</h3>
                        <p>{group.body}</p>
                        <ul>
                          {group.people.map((person) => (
                            <li key={person.id}>
                              <span>{person.name}</span>
                              <small>{person.detail}</small>
                            </li>
                          ))}
                        </ul>
                      </article>
                    ))}
                  </div>
                ) : null}
                {insights.advice.length > 0 ? (
                  <div className={styles.advice}>
                    <h3>לשיקולכם</h3>
                    <ul>
                      {insights.advice.map((item) => (
                        <li key={item.key}>{item.text}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            )}
          </Accordion>
          <Accordion title="תורים לפי יום">
            {hasValues(summary.byDay) ? (
              <LineChart rows={summary.byDay} />
            ) : (
              <p className={styles.empty}>אין נתונים בתקופה הזו.</p>
            )}
          </Accordion>
          <div className={styles.grid}>
            {(
              [
                ['לפי סטטוס', summary.byStatus],
                ['לפי שירות', summary.byService],
                ['לפי שעת התחלה', summary.byHour],
                ['לפי ערוץ', summary.byChannel],
              ] as const
            ).map(([title, rows]) => (
              <section key={title} className={styles.card}>
                <h2>{title}</h2>
                {hasValues(rows) ? (
                  <PieChart rows={rows} />
                ) : (
                  <p className={styles.empty}>אין נתונים בתקופה הזו.</p>
                )}
              </section>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
