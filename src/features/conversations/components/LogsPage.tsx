import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ErrorState,
  LoadingState,
} from '../../../shared/components/PageState';
import { DateField } from '../../../shared/components/DateField';
import DisplayToolbar from '../../../shared/displayFields/DisplayToolbar';
import RecordDetailsModal from '../../../shared/displayFields/RecordDetailsModal';
import { LOG_FIELDS } from '../../../shared/displayFields/catalogs';
import { useUiPreferences } from '../../../shared/displayFields/useUiPreferences';
import ColumnTableHead, {
  columnTableStyles,
} from '../../../shared/displayFields/ColumnTableHead';
import {
  nextColumnSort,
  visibleColumnFilters,
  type ColumnFilters,
  type ColumnSort,
} from '../../../shared/displayFields/columnTable';
import { orderCatalogFields } from '../../../shared/displayFields/preferences';
import { getRecordingSignedUrl } from '../conversations.api';
import {
  filterAndSortLogs,
  formatLogCell,
  logPlaybackUrl,
  toConversationDetailRows,
} from '../conversations.mappers';
import type {
  ConversationLogColumnKey,
  LogRecordingPlayback,
} from '../conversations.types';
import {
  DEFAULT_LOG_PAGE_SIZE,
  LOG_PAGE_SIZE_OPTIONS,
  defaultLogLookup,
  logPeriodRange,
} from '../conversations.mappers';
import type { LogLookup, LogPeriod } from '../conversations.types';
import { useConversationLogs } from '../useConversationLogs';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
} from '../../../shared/components/icons';
import RecordingCell from './RecordingCell';
import styles from './LogsPage.module.css';

interface LogsPageProps {
  businessCode: string;
}

/** Column filters and sort run in the browser, so they scan this many rows of the period. */
const FILTER_SCAN_LIMIT = 100;

const LOG_PERIODS: { id: LogPeriod; label: string }[] = [
  { id: 'week', label: 'שבוע' },
  { id: 'month', label: 'חודש' },
  { id: 'quarter', label: '3 חודשים' },
  { id: 'custom', label: 'תקופה' },
];

function LogPager({
  className,
  isLoading,
  page,
  pageCount,
  pageSize,
  onPage,
  onPageSize,
}: {
  className?: string;
  isLoading: boolean;
  page: number;
  pageCount: number;
  pageSize: number;
  onPage: (page: number) => void;
  onPageSize: (pageSize: number) => void;
}) {
  return (
    <div className={className ? `${styles.pager} ${className}` : styles.pager}>
      <button
        type="button"
        className={styles.pageButton}
        disabled={isLoading || page === 0}
        onClick={() => onPage(Math.max(0, page - 1))}
      >
        <ChevronRightIcon />
        הקודם
      </button>
      <button
        type="button"
        className={styles.pageButton}
        disabled={isLoading || page + 1 >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        הבא
        <ChevronLeftIcon />
      </button>
      <span className={styles.pageLabel}>
        עמוד {page + 1} מתוך {pageCount}
      </span>
      <label className={styles.pageSize}>
        <span>בעמוד</span>
        <select
          value={pageSize}
          disabled={isLoading}
          onChange={(event) => onPageSize(Number(event.target.value))}
        >
          {LOG_PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>{size}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

const LOG_SELECT_OPTIONS = {
  channel: [
    { value: 'WhatsApp', label: 'WhatsApp' },
    { value: 'קול', label: 'קול' },
  ],
  recording: [
    { value: 'יש הקלטה', label: 'יש הקלטה' },
    { value: 'אין הקלטה', label: 'אין הקלטה' },
    { value: 'נמחקה', label: 'נמחקה' },
  ],
};

export default function LogsPage({ businessCode }: LogsPageProps) {
  const [draft, setDraft] = useState<LogLookup>(defaultLogLookup);
  const [lookup, setLookup] = useState<LogLookup>(defaultLogLookup);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_LOG_PAGE_SIZE);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const { visibleFieldsFor, toggleField, reorderFields } = useUiPreferences(businessCode);
  const visibleKeys = visibleFieldsFor('logs');
  const visibleFilters = useMemo(
    () => visibleColumnFilters(columnFilters, visibleKeys),
    [columnFilters, visibleKeys],
  );
  const visibleSort =
    sort && visibleKeys.includes(sort.key) ? sort : null;
  const hasActiveFilters = Object.keys(visibleFilters).length > 0;
  const hasTableControls = hasActiveFilters || visibleSort !== null;
  const { result, error, isLoading, refresh } = useConversationLogs(
    businessCode,
    hasTableControls ? 0 : page,
    hasTableControls ? FILTER_SCAN_LIMIT : pageSize,
    lookup,
  );
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [playback, setPlayback] = useState<LogRecordingPlayback>({});

  useEffect(() => {
    setDraft(defaultLogLookup());
    setLookup(defaultLogLookup());
    setPage(0);
    setPageSize(DEFAULT_LOG_PAGE_SIZE);
  }, [businessCode]);
  const activeColumns = orderCatalogFields(LOG_FIELDS, visibleKeys);
  const matchingLogs = useMemo(
    () => filterAndSortLogs(result.logs, visibleFilters, visibleSort),
    [result.logs, visibleFilters, visibleSort],
  );
  const visibleLogs = hasTableControls
    ? matchingLogs.slice(page * pageSize, (page + 1) * pageSize)
    : matchingLogs;
  const scanTruncated = hasTableControls && result.total > result.logs.length;
  const selectedLog =
    result.logs.find((log) => log.id === selectedLogId) ?? null;
  const hasLookup = Boolean(
    lookup.phone ||
      lookup.nationalId ||
      lookup.clientName ||
      lookup.period !== 'week',
  );
  const pageCount = Math.max(
    1,
    Math.ceil((hasTableControls ? matchingLogs.length : result.total) / pageSize),
  );

  const applyLookup = (next: LogLookup) => {
    const same =
      page === 0 &&
      next.phone === lookup.phone &&
      next.nationalId === lookup.nationalId &&
      next.clientName === lookup.clientName &&
      next.period === lookup.period &&
      next.from === lookup.from &&
      next.to === lookup.to;
    setPage(0);
    setLookup(next);
    if (same) refresh();
  };

  useEffect(() => {
    if (!isDetailsOpen || !selectedLog) {
      return;
    }

    const readyUrl = logPlaybackUrl(selectedLog);
    if (readyUrl) {
      setPlayback({ audioUrl: readyUrl });
      return;
    }

    if (!selectedLog.storagePath) {
      setPlayback({});
      return;
    }

    let cancelled = false;
    setPlayback({});
    void getRecordingSignedUrl(selectedLog.storagePath)
      .then((audioUrl) => {
        if (!cancelled) {
          setPlayback({ audioUrl });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPlayback({ error: 'לא ניתן לטעון את ההקלטה.' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isDetailsOpen, selectedLog]);

  const periodRef = useRef<HTMLDivElement>(null);
  const [periodPill, setPeriodPill] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [periodPillReady, setPeriodPillReady] = useState(false);

  useLayoutEffect(() => {
    const container = periodRef.current;
    if (!container) return;

    let cancelled = false;
    const place = () => {
      if (cancelled) return;
      const current = container.querySelector<HTMLElement>('[aria-checked="true"]');
      if (!current) {
        setPeriodPill(null);
        return;
      }
      const containerBox = container.getBoundingClientRect();
      const itemBox = current.getBoundingClientRect();
      setPeriodPill({
        x: itemBox.left - containerBox.left + container.scrollLeft,
        y: itemBox.top - containerBox.top + container.scrollTop,
        width: itemBox.width,
        height: itemBox.height,
      });
    };

    place();
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) setPeriodPillReady(true);
    });
    window.addEventListener('resize', place);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
    };
  }, [draft.period]);

  const selectPeriod = (period: LogPeriod) => {
    if (period === 'custom') {
      setDraft((current) => ({ ...current, period }));
      return;
    }
    const next = {
      ...draft,
      period,
      ...logPeriodRange(period),
    };
    setDraft(next);
    applyLookup(next);
  };

  return (
    <div className={styles.container}>
      <form
        className={styles.search}
        onSubmit={(event) => {
          event.preventDefault();
          applyLookup({
            phone: draft.phone.trim(),
            nationalId: draft.nationalId.trim(),
            clientName: draft.clientName.trim(),
            period: draft.period,
            from: draft.from,
            to: draft.to,
          });
        }}
      >
        <div className={styles.tableControls}>
          <DisplayToolbar
            fields={LOG_FIELDS}
            visibleKeys={visibleKeys}
            onToggle={(key) => toggleField('logs', key)}
            onReorder={(keys) => reorderFields('logs', keys)}
            filtersVisible={filtersVisible}
            filtersActive={hasActiveFilters}
            onToggleFilters={() => setFiltersVisible((open) => !open)}
          />
          {hasTableControls ? (
            <button
              type="button"
              className={columnTableStyles.clearButton}
              onClick={() => {
                setColumnFilters({});
                setSort(null);
                setPage(0);
              }}
            >
              נקה סינון ומיון
            </button>
          ) : null}
        </div>
        <div className={styles.periodGroup}>
          <div className={styles.periodField}>
            <span>תקופה</span>
            <div
              ref={periodRef}
              className={styles.period}
              role="radiogroup"
              aria-label="תקופת הסינון"
            >
              {periodPill ? (
                <span
                  className={`${styles.periodGlide} ${periodPillReady ? styles.periodGlideReady : ''}`}
                  style={{
                    width: periodPill.width,
                    height: periodPill.height,
                    transform: `translate(${periodPill.x}px, ${periodPill.y}px)`,
                  }}
                  aria-hidden="true"
                />
              ) : null}
              {LOG_PERIODS.map((period) => (
                <button
                  key={period.id}
                  type="button"
                  role="radio"
                  aria-checked={draft.period === period.id}
                  className={draft.period === period.id ? styles.periodActive : styles.periodButton}
                  onClick={() => selectPeriod(period.id)}
                >
                  {period.label}
                </button>
              ))}
            </div>
          </div>
          {draft.period === 'custom' ? (
            <div className={styles.dateRange}>
              <DateField
                aria-label="מתאריך"
                value={draft.from}
                max={draft.to || undefined}
                onChange={(from) => setDraft((current) => ({ ...current, from, period: 'custom' }))}
              />
              <span className={styles.dateRangeLine} aria-hidden="true" />
              <DateField
                aria-label="עד תאריך"
                value={draft.to}
                min={draft.from || undefined}
                onChange={(to) => setDraft((current) => ({ ...current, to, period: 'custom' }))}
              />
            </div>
          ) : null}
        </div>
        <button type="submit" className={styles.searchButton} disabled={isLoading}>
          חיפוש
        </button>
        {hasLookup ? (
          <button
            type="button"
            className={styles.clearSearch}
            onClick={() => {
              const next = defaultLogLookup();
              setDraft(next);
              applyLookup(next);
            }}
          >
            נקה
          </button>
        ) : null}
      </form>

      {!error ? (
        <LogPager
          className={styles.pagerTop}
          isLoading={isLoading}
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(0);
          }}
        />
      ) : null}

      {error ? <ErrorState message={error} onRetry={refresh} /> : null}
      {scanTruncated ? (
        <p className={styles.scanNotice} role="status">
          הסינון והמיון חלים על {FILTER_SCAN_LIMIT} השיחות האחרונות בתקופה. לצמצום, בחרו תקופה קצרה יותר.
        </p>
      ) : null}

      {isLoading && result.logs.length === 0 ? (
        <LoadingState message="טוען לוגים..." />
      ) : error ? null : (
      <div className={styles.tableResponsive}>
        <table className={`data-table ${styles.table}`}>
          <ColumnTableHead
            columns={activeColumns}
            filters={columnFilters}
            sort={visibleSort}
            showFilters={filtersVisible}
            showActions={false}
            onSort={(key) => {
              setSort((current) => nextColumnSort(current, key));
              setPage(0);
            }}
            onFilter={(key, value) => {
              setColumnFilters((current) => ({ ...current, [key]: value }));
              setPage(0);
            }}
            selectOptions={LOG_SELECT_OPTIONS}
            onReorder={(keys) => reorderFields('logs', keys)}
          />
          <tbody>
            {visibleLogs.map((log) => (
              <tr
                key={log.id}
                className={selectedLogId === log.id ? 'is-selected' : undefined}
                onClick={() => {
                  setSelectedLogId(log.id);
                  setPlayback({});
                  setIsDetailsOpen(true);
                }}
              >
                {activeColumns.map((column) => (
                  <td
                    key={column.key}
                    dir={column.dir || 'rtl'}
                    data-column={column.key}
                  >
                    {column.key === 'recording' ? (
                      <RecordingCell log={log} />
                    ) : (
                      formatLogCell(log, column.key as ConversationLogColumnKey)
                    )}
                  </td>
                ))}
              </tr>
            ))}
            {visibleLogs.length === 0 && (
              <tr>
                <td colSpan={Math.max(activeColumns.length, 1)} className={styles.emptyState}>
                  {result.logs.length === 0
                    ? hasLookup
                      ? 'לא נמצאו לוגים לחיפוש הזה.'
                      : 'אין לוגים לעסק הזה.'
                    : 'לא נמצאו לוגים מתאימים לסינון'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      {!error ? (
        <LogPager
          isLoading={isLoading}
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={(size) => {
            setPageSize(size);
            setPage(0);
          }}
        />
      ) : null}

      {isDetailsOpen && selectedLog && (
        <RecordDetailsModal
          title={`שיחה · ${formatLogCell(selectedLog, 'channel')}`}
          rows={toConversationDetailRows(selectedLog, playback)}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </div>
  );
}
