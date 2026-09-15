import type { DisplayField } from './types';
import type { ColumnFilters, ColumnSort } from './columnTable';
import styles from './ColumnTableHead.module.css';

export { styles as columnTableStyles };

interface ColumnTableHeadProps {
  columns: DisplayField[];
  filters: ColumnFilters;
  sort: ColumnSort | null;
  onSort: (key: string) => void;
  onFilter: (key: string, value: string) => void;
  selectOptions?: Record<string, Array<{ value: string; label: string }>>;
}

export default function ColumnTableHead({
  columns,
  filters,
  sort,
  onSort,
  onFilter,
  selectOptions,
}: ColumnTableHeadProps) {
  return (
    <thead>
      <tr>
        <th>פעולות</th>
        {columns.map((column) => {
          const ariaSort =
            sort?.key === column.key
              ? sort.direction === 'asc'
                ? 'ascending'
                : 'descending'
              : 'none';

          return (
            <th key={column.key} aria-sort={ariaSort}>
              <button
                type="button"
                className={styles.sortButton}
                onClick={() => onSort(column.key)}
              >
                {column.label}
                <span className={styles.sortMark} aria-hidden="true">
                  {sort?.key === column.key
                    ? sort.direction === 'asc'
                      ? '↑'
                      : '↓'
                    : '↕'}
                </span>
              </button>
            </th>
          );
        })}
      </tr>
      <tr className={styles.filterRow}>
        <th>
          <span className={styles.srOnly}>סינון</span>
        </th>
        {columns.map((column) => {
          const options = selectOptions?.[column.key];

          return (
            <th key={`${column.key}-filter`}>
              {options ? (
                <select
                  className={styles.filterSelect}
                  value={filters[column.key] ?? ''}
                  aria-label={`סינון לפי ${column.label}`}
                  onChange={(event) => onFilter(column.key, event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                >
                  <option value="">הכל</option>
                  {options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="search"
                  className={styles.filterInput}
                  value={filters[column.key] ?? ''}
                  placeholder="סינון"
                  aria-label={`סינון לפי ${column.label}`}
                  onChange={(event) => onFilter(column.key, event.target.value)}
                  onClick={(event) => event.stopPropagation()}
                />
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
