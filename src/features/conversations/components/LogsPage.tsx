import { useEffect, useMemo, useState } from 'react';
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
import RecordingCell from './RecordingCell';
import styles from './LogsPage.module.css';

interface LogsPageProps {
  businessCode: string;
}

function insertLogColumns(keys: string[], extras: string[]) {
  const catalog = LOG_FIELDS.map((field) => field.key);
  const next = [...keys];
  for (const extra of extras) {
    if (next.includes(extra)) continue;
    const catalogIndex = catalog.indexOf(extra);
    const index = next.findIndex((key) => catalog.indexOf(key) > catalogIndex);
    next.splice(index === -1 ? next.length : index, 0, extra);
  }
  return next;
}

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
        הקודם
      </button>
      <button
        type="button"
        className={styles.pageButton}
        disabled={isLoading || page + 1 >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        הבא
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
  const { result, error, isLoading, refresh } = useConversationLogs(
    businessCode,
    page,
    pageSize,
    lookup,
  );
  const { visibleFieldsFor, toggleField, reorderFields } = useUiPreferences(businessCode);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [playback, setPlayback] = useState<LogRecordingPlayback>({});

  useEffect(() => {
    setDraft(defaultLogLookup());
    setLookup(defaultLogLookup());
    setPage(0);
    setPageSize(DEFAULT_LOG_PAGE_SIZE);
  }, [businessCode]);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const storedLogKeys = visibleFieldsFor('logs');
  const visibleKeys = storedLogKeys.every((key) =>
    ['startedAt', 'channel', 'clientPhone', 'durationSeconds', 'summary', 'recording'].includes(key),
  )
    ? insertLogColumns(storedLogKeys, ['clientName', 'nationalId'])
    : storedLogKeys;
  const activeColumns = orderCatalogFields(LOG_FIELDS, visibleKeys);
  const visibleFilters = useMemo(
    () => visibleColumnFilters(columnFilters, visibleKeys),
    [columnFilters, visibleKeys],
  );
  const visibleSort =
    sort && visibleKeys.includes(sort.key) ? sort : null;
  const visibleLogs = useMemo(
    () => filterAndSortLogs(result.logs, visibleFilters, visibleSort),
    [result.logs, visibleFilters, visibleSort],
  );
  const selectedLog =
    result.logs.find((log) => log.id === selectedLogId) ?? null;
  const hasActiveFilters = Object.keys(visibleFilters).length > 0;
  const hasTableControls = hasActiveFilters || visibleSort !== null;
  const hasLookup = Boolean(
    lookup.phone ||
      lookup.nationalId ||
      lookup.clientName ||
      lookup.period !== 'week',
  );
  const pageCount = Math.max(1, Math.ceil(result.total / pageSize));

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
        <label className={`${styles.field} ${styles.phoneField}`}>
          <span>נייד</span>
          <input
            value={draft.phone}
            dir="ltr"
            inputMode="tel"
            onChange={(event) =>
              setDraft((current) => ({ ...current, phone: event.target.value }))
            }
          />
        </label>
        <label className={`${styles.field} ${styles.idField}`}>
          <span>תעודת זהות</span>
          <input
            value={draft.nationalId}
            dir="ltr"
            inputMode="numeric"
            onChange={(event) =>
              setDraft((current) => ({ ...current, nationalId: event.target.value }))
            }
          />
        </label>
        <label className={`${styles.field} ${styles.nameField}`}>
          <span>שם לקוח</span>
          <input
            value={draft.clientName}
            onChange={(event) =>
              setDraft((current) => ({ ...current, clientName: event.target.value }))
            }
          />
        </label>
        <div className={styles.period} role="radiogroup" aria-label="תקופה">
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
        {draft.period === 'custom' ? (
          <>
            <label className={`${styles.field} ${styles.dateField}`}>
              <span>מתאריך</span>
              <DateField
                aria-label="מתאריך"
                value={draft.from}
                max={draft.to || undefined}
                onChange={(from) => setDraft((current) => ({ ...current, from, period: 'custom' }))}
              />
            </label>
            <label className={`${styles.field} ${styles.dateField}`}>
              <span>עד תאריך</span>
              <DateField
                aria-label="עד תאריך"
                value={draft.to}
                min={draft.from || undefined}
                onChange={(to) => setDraft((current) => ({ ...current, to, period: 'custom' }))}
              />
            </label>
          </>
        ) : null}
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
              }}
            >
              נקה סינון ומיון
            </button>
          ) : null}
        </div>
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
            onSort={(key) => setSort((current) => nextColumnSort(current, key))}
            onFilter={(key, value) =>
              setColumnFilters((current) => ({ ...current, [key]: value }))
            }
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
