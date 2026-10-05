import { useEffect, useMemo, useState } from 'react';
import {
  ErrorState,
  LoadingState,
} from '../../../shared/components/PageState';
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
import { useConversationLogs } from '../useConversationLogs';
import RecordingCell from './RecordingCell';
import styles from './LogsPage.module.css';

interface LogsPageProps {
  businessCode: string;
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
  const { result, error, isLoading, refresh } = useConversationLogs(businessCode);
  const { visibleFieldsFor, toggleField } = useUiPreferences(businessCode);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [playback, setPlayback] = useState<LogRecordingPlayback>({});
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const visibleKeys = visibleFieldsFor('logs');
  const activeColumns = LOG_FIELDS.filter((field) =>
    visibleKeys.includes(field.key),
  );
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
  const listTitle = hasTableControls
    ? `לוגים (${visibleLogs.length} מתוך ${result.logs.length})`
    : `לוגים (${result.logs.length})`;

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

  if (isLoading) {
    return <LoadingState message="טוען לוגים..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>{listTitle}</h2>
        <div className={styles.tableControls}>
          <DisplayToolbar
            fields={LOG_FIELDS}
            visibleKeys={visibleKeys}
            onToggle={(key) => toggleField('logs', key)}
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
      </div>

      {result.truncated && (
        <p className={styles.note}>מוצגות 500 השיחות האחרונות של העסק הזה.</p>
      )}

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
                  <td key={column.key} dir={column.dir || 'rtl'}>
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
                    ? 'אין לוגים לעסק הזה.'
                    : 'לא נמצאו לוגים מתאימים לסינון'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
