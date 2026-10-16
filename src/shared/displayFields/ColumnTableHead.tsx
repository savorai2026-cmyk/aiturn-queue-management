import { useRef, useState, type DragEvent } from 'react';
import type { DisplayField } from './types';
import type { ColumnFilters, ColumnSort } from './columnTable';
import { moveColumn } from './preferences';
import styles from './ColumnTableHead.module.css';

export { styles as columnTableStyles };

interface ColumnTableHeadProps {
  columns: DisplayField[];
  filters: ColumnFilters;
  sort: ColumnSort | null;
  onSort: (key: string) => void;
  onFilter: (key: string, value: string) => void;
  selectOptions?: Record<string, Array<{ value: string; label: string }>>;
  showFilters?: boolean;
  showActions?: boolean;
  onReorder?: (keys: string[]) => void;
}

export default function ColumnTableHead({
  columns,
  filters,
  sort,
  onSort,
  onFilter,
  selectOptions,
  showFilters = false,
  showActions = true,
  onReorder,
}: ColumnTableHeadProps) {
  const dragKey = useRef<string | null>(null);
  const suppressSort = useRef(false);
  const [drop, setDrop] = useState<{ key: string; place: 'before' | 'after' } | null>(null);

  const placeFor = (event: DragEvent<HTMLTableCellElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientX > rect.left + rect.width / 2 ? 'before' : 'after';
  };

  const finishDrop = (targetKey: string, place: 'before' | 'after') => {
    const fromKey = dragKey.current;
    dragKey.current = null;
    setDrop(null);
    if (!onReorder || !fromKey || fromKey === targetKey) return;
    onReorder(moveColumn(columns.map((column) => column.key), fromKey, targetKey, place));
  };

  return (
    <thead>
      <tr>
        {showActions ? <th>פעולות</th> : null}
        {columns.map((column) => {
          const ariaSort =
            sort?.key === column.key
              ? sort.direction === 'asc'
                ? 'ascending'
                : 'descending'
              : 'none';

          return (
            <th
              key={column.key}
              data-column={column.key}
              data-drop={drop?.key === column.key ? drop.place : undefined}
              aria-sort={ariaSort}
              title={onReorder ? 'גררו כדי לשנות את מקום העמודה' : undefined}
              onDragOver={(event) => {
                if (!onReorder || !dragKey.current) return;
                event.preventDefault();
                const place = placeFor(event);
                setDrop((current) =>
                  current?.key === column.key && current.place === place
                    ? current
                    : { key: column.key, place },
                );
              }}
              onDrop={(event) => {
                event.preventDefault();
                finishDrop(column.key, placeFor(event));
              }}
              onDragEnd={() => {
                dragKey.current = null;
                setDrop(null);
              }}
            >
              <button
                type="button"
                className={styles.sortButton}
                draggable={Boolean(onReorder)}
                onDragStart={(event) => {
                  dragKey.current = column.key;
                  suppressSort.current = false;
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', column.key);
                }}
                onDrag={() => {
                  suppressSort.current = true;
                }}
                onClick={() => {
                  if (suppressSort.current) {
                    suppressSort.current = false;
                    return;
                  }
                  onSort(column.key);
                }}
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
      {showFilters ? (
        <tr className={styles.filterRow}>
          {showActions ? (
            <th>
              <span className={styles.srOnly}>סינון</span>
            </th>
          ) : null}
          {columns.map((column) => {
            const options = selectOptions?.[column.key];

            return (
              <th key={`${column.key}-filter`} data-column={column.key}>
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
      ) : null}
    </thead>
  );
}
