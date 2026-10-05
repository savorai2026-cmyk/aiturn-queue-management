import { useEffect, useMemo, useState } from 'react';
import {
  ErrorState,
  LoadingState,
} from '../../../shared/components/PageState';
import DisplayToolbar from '../../../shared/displayFields/DisplayToolbar';
import { USAGE_FIELDS } from '../../../shared/displayFields/catalogs';
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
import {
  filterAndSortUsageEvents,
  findUsagePrice,
  formatBillingCurrency,
  formatCreditAmount,
  formatQuantity,
  formatUnitPrice,
  formatUsageAction,
  formatUsageEventCell,
  formatUsageUnit,
  summarizeUsage,
  usageSelectOptions,
} from '../usage.mappers';
import type { UsageEventColumnKey } from '../usage.types';
import { useUsage } from '../useUsage';
import styles from './UsagePage.module.css';

interface UsagePageProps {
  businessCode: string;
}

type UsageTab = 'byType' | 'history';

const USAGE_TABS: UsageTab[] = ['byType', 'history'];

function readStoredUsageTab(businessCode: string): UsageTab {
  try {
    const stored = sessionStorage.getItem(`usageTab:${businessCode}`);
    if (stored && USAGE_TABS.includes(stored as UsageTab)) {
      return stored as UsageTab;
    }
  } catch {
    /* ignore */
  }
  return 'byType';
}

export default function UsagePage({ businessCode }: UsagePageProps) {
  const { overview, error, isLoading, refresh } = useUsage(businessCode);
  const { visibleFieldsFor, toggleField } = useUiPreferences(businessCode);
  const [activeTab, setActiveTab] = useState<UsageTab>(() =>
    readStoredUsageTab(businessCode),
  );
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);

  useEffect(() => {
    setActiveTab(readStoredUsageTab(businessCode));
  }, [businessCode]);

  useEffect(() => {
    try {
      sessionStorage.setItem(`usageTab:${businessCode}`, activeTab);
    } catch {
      /* ignore */
    }
  }, [activeTab, businessCode]);

  const summary = useMemo(
    () => summarizeUsage(overview.events),
    [overview.events],
  );
  const visibleKeys = visibleFieldsFor('usage');
  const activeColumns = USAGE_FIELDS.filter((field) =>
    visibleKeys.includes(field.key),
  );
  const visibleFilters = useMemo(
    () => visibleColumnFilters(columnFilters, visibleKeys),
    [columnFilters, visibleKeys],
  );
  const visibleSort =
    sort && visibleKeys.includes(sort.key) ? sort : null;
  const visibleEvents = useMemo(
    () => filterAndSortUsageEvents(overview.events, visibleFilters, visibleSort),
    [overview.events, visibleFilters, visibleSort],
  );
  const selectOptions = useMemo(
    () => usageSelectOptions(overview.events),
    [overview.events],
  );
  const hasActiveFilters = Object.keys(visibleFilters).length > 0;
  const hasTableControls = hasActiveFilters || visibleSort !== null;
  const historyTitle = hasTableControls
    ? `היסטוריית חיובים (${visibleEvents.length} מתוך ${overview.events.length})`
    : `היסטוריית חיובים (${overview.events.length})`;
  const currency = overview.account?.currency ?? null;

  if (isLoading) {
    return <LoadingState message="טוען את נתוני העלות..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>עלות השימוש</h1>
        <p className={styles.pageNote}>
          קרדיטים מודדים שימוש ב-AI. שקלים הם מטבע החיוב מהלקוח, לא אותה יחידה.
        </p>
      </div>

      <div className={styles.summaryGrid}>
        <section className={styles.summaryCard}>
          <p className={styles.summaryLabel}>יתרת קרדיטים</p>
          <p className={styles.summaryValue}>
            {overview.account
              ? formatCreditAmount(overview.account.balanceCredits)
              : 'אין יתרה רשומה'}
          </p>
          <p className={styles.summaryHint}>
            יחידת מדידה לשימוש ב-AI: מודלים, שיחות והודעות.
          </p>
        </section>
        <section className={styles.summaryCard}>
          <p className={styles.summaryLabel}>קרדיטים שנצרכו</p>
          <p className={styles.summaryValue}>
            {formatCreditAmount(summary.totalCredits)}
          </p>
          <p className={styles.summaryHint}>
            כמה קרדיטי AI ירדו בהיסטוריית החיובים
            {overview.truncated ? ' (עד 500 האחרונים)' : ''}.
          </p>
        </section>
        <section className={styles.summaryCard}>
          <p className={styles.summaryLabel}>מטבע חיוב מהלקוח</p>
          <p className={styles.summaryValue}>
            {formatBillingCurrency(currency)}
          </p>
          <p className={styles.summaryHint}>
            כך נגבה כסף מהלקוח. זה לא מומר אוטומטית מקרדיטים.
          </p>
        </section>
      </div>

      <div className={styles.tabs}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'byType' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('byType')}
        >
          פירוט לפי סוג שימוש
        </button>
        <span className={styles.tabDivider} aria-hidden="true" />
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'history' ? styles.activeTab : ''}`}
          onClick={() => setActiveTab('history')}
        >
          היסטוריית חיובים
        </button>
      </div>

      <div className={styles.panel}>
        {activeTab === 'byType' ? (
          <>
            <p className={styles.sectionNote}>
              כל שורה היא סוג פעולת AI. המחיר כאן הוא בקרדיטים, לא בשקלים.
            </p>
            <div className={styles.tableResponsive}>
              <table className={`data-table ${styles.table} ${styles.byTypeTable}`}>
                <thead>
                  <tr>
                    <th>פעולה</th>
                    <th>יחידה</th>
                    <th>מחיר ליחידה</th>
                    <th>פעמים</th>
                    <th>כמות</th>
                    <th>קרדיטים שנצרכו</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.byAction.map((row) => (
                    <tr key={`${row.action}-${row.unit}`}>
                      <td>{formatUsageAction(row.action)}</td>
                      <td>{formatUsageUnit(row.unit)}</td>
                      <td>
                        {formatUnitPrice(
                          findUsagePrice(overview.prices, row.action, row.unit),
                        )}
                      </td>
                      <td>{row.count.toLocaleString('he-IL')}</td>
                      <td>{formatQuantity(row.quantity)}</td>
                      <td>{formatCreditAmount(row.credits)}</td>
                    </tr>
                  ))}
                  {summary.byAction.length === 0 && (
                    <tr>
                      <td colSpan={6} className={styles.emptyState}>
                        עדיין אין שימוש לעסק הזה.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <>
            <div className={styles.sectionHeader}>
              <h2 className={styles.sectionTitle}>{historyTitle}</h2>
              <div className={styles.tableControls}>
                <DisplayToolbar
                  fields={USAGE_FIELDS}
                  visibleKeys={visibleKeys}
                  onToggle={(key) => toggleField('usage', key)}
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
            {overview.truncated && (
              <p className={styles.note}>
                מוצגות 500 הפעולות האחרונות של העסק הזה.
              </p>
            )}
            <div className={styles.tableResponsive}>
              <table className={`data-table ${styles.table}`}>
                <ColumnTableHead
                  columns={activeColumns}
                  filters={columnFilters}
                  sort={visibleSort}
                  showFilters={filtersVisible}
                  showActions={false}
                  onSort={(key) =>
                    setSort((current) => nextColumnSort(current, key))
                  }
                  onFilter={(key, value) =>
                    setColumnFilters((current) => ({ ...current, [key]: value }))
                  }
                  selectOptions={selectOptions}
                />
                <tbody>
                  {visibleEvents.map((event) => (
                    <tr key={event.id}>
                      {activeColumns.map((column) => (
                        <td
                          key={column.key}
                          dir={column.dir || 'rtl'}
                          className={
                            column.key === 'meta' ? styles.metaCell : undefined
                          }
                          title={
                            column.key === 'meta'
                              ? formatUsageEventCell(event, 'meta')
                              : undefined
                          }
                        >
                          {formatUsageEventCell(
                            event,
                            column.key as UsageEventColumnKey,
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {visibleEvents.length === 0 && (
                    <tr>
                      <td
                        colSpan={Math.max(activeColumns.length, 1)}
                        className={styles.emptyState}
                      >
                        {overview.events.length === 0
                          ? 'אין פעולות מחויבות להצגה.'
                          : 'לא נמצאו חיובים מתאימים לסינון'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
