import { useEffect, useMemo, useState } from 'react';
import {
  formatClientCell,
  filterAndSortClients,
  toClientDetailRows,
} from '../clients.mappers';
import { countClientUpcomingAppointments, deleteClient, sendCancellationNotices, cancellationNoticeError } from '../clients.api';
import {
  BOOKING_POLICY_OPTIONS,
  LANGUAGE_OPTIONS,
  PAYMENT_REQUIREMENT_OPTIONS,
  PREFERRED_CHANNEL_OPTIONS,
  type Client,
  type ClientColumnKey,
} from '../clients.types';
import { useClients } from '../useClients';
import {
  ErrorState,
  LoadingState,
} from '../../../shared/components/PageState';
import DisplayToolbar from '../../../shared/displayFields/DisplayToolbar';
import RecordDetailsModal from '../../../shared/displayFields/RecordDetailsModal';
import { CLIENT_FIELDS } from '../../../shared/displayFields/catalogs';
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
import IconButton, {
  PencilIcon,
  TrashIcon,
} from '../../../shared/components/IconButton';
import { getErrorMessage } from '../../../shared/errors';
import ConfirmDeleteModal from '../../settings/components/ConfirmDeleteModal';
import AddClientModal from './AddClientModal';
import styles from './ClientManagement.module.css';

interface ClientManagementProps {
  businessCode: string;
}

const CLIENT_PAGE_SIZE = 100;

function upcomingAppointmentsWarning(count: number | null, ready: boolean) {
  if (!ready) {
    return 'בודקים אם יש תורים עתידיים...';
  }

  if (count === null) {
    return 'התורים הקיימים שלו יימחקו מהיומן. היסטוריית התורים תישאר, והלקוח יקבל הודעה על הביטול.';
  }

  if (count === 0) {
    return 'אין לו תורים עתידיים. היסטוריית התורים תישאר.';
  }

  const appointments =
    count === 1
      ? 'תור קיים אחד יימחק מהיומן'
      : `${count.toLocaleString('he-IL')} תורים קיימים יימחקו מהיומן`;

  return `${appointments}. היסטוריית התורים תישאר, והלקוח יקבל הודעה על הביטול.`;
}

function ClientPager({
  className,
  page,
  pageCount,
  onPage,
}: {
  className?: string;
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}) {
  return (
    <div className={className ? `${styles.pager} ${className}` : styles.pager}>
      <button
        type="button"
        className={styles.pageButton}
        disabled={page === 0}
        onClick={() => onPage(Math.max(0, page - 1))}
      >
        הקודם
      </button>
      <button
        type="button"
        className={styles.pageButton}
        disabled={page + 1 >= pageCount}
        onClick={() => onPage(page + 1)}
      >
        הבא
      </button>
    </div>
  );
}

const CLIENT_SELECT_OPTIONS = {
  booking_policy: BOOKING_POLICY_OPTIONS,
  payment_requirement: PAYMENT_REQUIREMENT_OPTIONS,
  gender: [
    { value: 'M', label: 'זכר' },
    { value: 'F', label: 'נקבה' },
  ],
  language: LANGUAGE_OPTIONS,
  preferred_channel: PREFERRED_CHANNEL_OPTIONS,
  allows_sms: [
    { value: 'yes', label: 'כן' },
    { value: 'no', label: 'לא' },
  ],
};

export default function ClientManagement({ businessCode }: ClientManagementProps) {
  const { clients, error, isLoading, refresh } = useClients(businessCode);
  const { visibleFieldsFor, toggleField, reorderFields } = useUiPreferences(businessCode);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);
  const [upcomingCount, setUpcomingCount] = useState<number | null>(null);
  const [countReady, setCountReady] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const visibleKeys = visibleFieldsFor('clients');
  const activeColumns = orderCatalogFields(CLIENT_FIELDS, visibleKeys);
  const visibleFilters = useMemo(
    () => visibleColumnFilters(columnFilters, visibleKeys),
    [columnFilters, visibleKeys],
  );
  const visibleSort =
    sort && visibleKeys.includes(sort.key) ? sort : null;
  const visibleClients = useMemo(
    () => filterAndSortClients(clients, visibleFilters, visibleSort),
    [clients, visibleFilters, visibleSort],
  );
  const listKey = `${JSON.stringify(visibleFilters)}|${visibleSort?.key ?? ''}|${visibleSort?.direction ?? ''}`;
  const [page, setPage] = useState(0);
  const [trackedListKey, setTrackedListKey] = useState(listKey);
  if (trackedListKey !== listKey) {
    setTrackedListKey(listKey);
    setPage(0);
  }
  const pageCount = Math.max(1, Math.ceil(visibleClients.length / CLIENT_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pageClients = visibleClients.slice(
    currentPage * CLIENT_PAGE_SIZE,
    currentPage * CLIENT_PAGE_SIZE + CLIENT_PAGE_SIZE,
  );
  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ?? null;
  const hasActiveFilters = Object.keys(visibleFilters).length > 0;
  const hasTableControls = hasActiveFilters || visibleSort !== null;
  const rangeStart = visibleClients.length === 0 ? 0 : currentPage * CLIENT_PAGE_SIZE + 1;
  const rangeEnd = Math.min(visibleClients.length, (currentPage + 1) * CLIENT_PAGE_SIZE);
  const listTitle = visibleClients.length > CLIENT_PAGE_SIZE
    ? `ניהול לקוחות (${rangeStart.toLocaleString('he-IL')}–${rangeEnd.toLocaleString('he-IL')} מתוך ${
        hasTableControls
          ? `${visibleClients.length.toLocaleString('he-IL')} מסוננים, ${clients.length.toLocaleString('he-IL')} בסה״כ`
          : visibleClients.length.toLocaleString('he-IL')
      })`
    : hasTableControls
      ? `ניהול לקוחות (${visibleClients.length} מתוך ${clients.length})`
      : `ניהול לקוחות (${clients.length})`;

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setSelectedClientId(client.id);
    setIsModalOpen(true);
  };

  useEffect(() => {
    if (!pendingDelete) return;

    let cancelled = false;
    setUpcomingCount(null);
    setCountReady(false);
    setActionError('');

    void countClientUpcomingAppointments(businessCode, pendingDelete.id)
      .then((count) => {
        if (cancelled) return;
        setUpcomingCount(count);
        setCountReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('שגיאה בספירת תורים:', getErrorMessage(error));
        setUpcomingCount(null);
        setCountReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [businessCode, pendingDelete]);

  const closeDeleteModal = () => {
    if (isDeleting) return;
    setPendingDelete(null);
    setActionError('');
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setActionError('');
    setIsDeleting(true);
    try {
      const notice = await sendCancellationNotices(businessCode, pendingDelete.id);
      const noticeError = cancellationNoticeError(notice);
      if (noticeError) {
        setActionError(noticeError);
        return;
      }

      await deleteClient(businessCode, pendingDelete.id);
      if (selectedClientId === pendingDelete.id) {
        setSelectedClientId(null);
      }
      setPendingDelete(null);
      refresh();
    } catch (error) {
      console.error('שגיאה במחיקת לקוח:', getErrorMessage(error));
      setActionError(getErrorMessage(error) || 'לא ניתן למחוק את הלקוח.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="טוען לקוחות..." />;
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
            fields={CLIENT_FIELDS}
            visibleKeys={visibleKeys}
            onToggle={(key) => toggleField('clients', key)}
            onReorder={(keys) => reorderFields('clients', keys)}
            onViewDetails={() => setIsDetailsOpen(true)}
            canViewDetails={selectedClient !== null}
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
          <button
            className={styles.btnPrimary}
            onClick={() => {
              setEditingClient(null);
              setIsModalOpen(true);
            }}
          >
            לקוח חדש
          </button>
        </div>
      </div>

      {visibleClients.length > CLIENT_PAGE_SIZE ? (
        <ClientPager
          className={styles.pagerTop}
          page={currentPage}
          pageCount={pageCount}
          onPage={setPage}
        />
      ) : null}

      <div className={styles.tableResponsive}>
        <table className={`data-table ${styles.table}`}>
          <ColumnTableHead
            columns={activeColumns}
            filters={columnFilters}
            sort={visibleSort}
            showFilters={filtersVisible}
            onSort={(key) => setSort((current) => nextColumnSort(current, key))}
            onFilter={(key, value) =>
              setColumnFilters((current) => ({ ...current, [key]: value }))
            }
            selectOptions={CLIENT_SELECT_OPTIONS}
            onReorder={(keys) => reorderFields('clients', keys)}
          />
          <tbody>
            {pageClients.map((client) => (
              <tr
                key={client.id}
                className={
                  selectedClientId === client.id ? 'is-selected' : undefined
                }
                onClick={() => setSelectedClientId(client.id)}
              >
                <td>
                  <div className={styles.rowActions}>
                    <IconButton
                      label="ערוך לקוח"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleEdit(client);
                      }}
                    >
                      <PencilIcon />
                    </IconButton>
                    <IconButton
                      label="מחק לקוח"
                      variant="danger"
                      onClick={(event) => {
                        event.stopPropagation();
                        setPendingDelete(client);
                      }}
                    >
                      <TrashIcon />
                    </IconButton>
                  </div>
                </td>
                {activeColumns.map((column) => (
                  <td key={column.key} dir={column.dir || 'rtl'}>
                    {formatClientCell(client, column.key as ClientColumnKey)}
                  </td>
                ))}
              </tr>
            ))}
            {visibleClients.length === 0 && (
              <tr>
                <td colSpan={activeColumns.length + 1} className={styles.emptyState}>
                  {clients.length === 0
                    ? 'לא נמצאו לקוחות במערכת'
                    : 'לא נמצאו לקוחות מתאימים לסינון'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {visibleClients.length > CLIENT_PAGE_SIZE ? (
        <ClientPager
          page={currentPage}
          pageCount={pageCount}
          onPage={setPage}
        />
      ) : null}

      {isModalOpen && (
        <AddClientModal
          businessCode={businessCode}
          clientToEdit={editingClient}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            refresh();
          }}
        />
      )}

      {pendingDelete ? (
        <ConfirmDeleteModal
          title="מחיקת לקוח"
          message={
            <>
              למחוק את הלקוח{' '}
              <strong>
                {pendingDelete.full_name || pendingDelete.mobile_phone || 'הלקוח'}
              </strong>
              ? {upcomingAppointmentsWarning(upcomingCount, countReady)}
            </>
          }
          confirmLabel="מחק לקוח"
          isBusy={isDeleting}
          busyLabel="שולח עדכון..."
          confirmDisabled={!countReady}
          errorMessage={actionError}
          onConfirm={() => void confirmDelete()}
          onCancel={closeDeleteModal}
        />
      ) : null}

      {isDetailsOpen && selectedClient && (
        <RecordDetailsModal
          title={`פרטי לקוח · ${selectedClient.full_name || selectedClient.mobile_phone}`}
          rows={toClientDetailRows(selectedClient)}
          onClose={() => setIsDetailsOpen(false)}
        />
      )}
    </div>
  );
}
