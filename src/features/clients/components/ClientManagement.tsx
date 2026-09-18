import { useMemo, useState } from 'react';
import {
  formatClientCell,
  filterAndSortClients,
  toClientDetailRows,
} from '../clients.mappers';
import { deleteClient } from '../clients.api';
import {
  BOOKING_POLICY_OPTIONS,
  PAYMENT_REQUIREMENT_OPTIONS,
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
import IconButton, {
  PencilIcon,
  TrashIcon,
} from '../../../shared/components/IconButton';
import { getErrorMessage } from '../../../shared/errors';
import AddClientModal from './AddClientModal';
import styles from './ClientManagement.module.css';

interface ClientManagementProps {
  businessCode: string;
}

const CLIENT_SELECT_OPTIONS = {
  booking_policy: BOOKING_POLICY_OPTIONS,
  payment_requirement: PAYMENT_REQUIREMENT_OPTIONS,
  gender: [
    { value: 'M', label: 'זכר' },
    { value: 'F', label: 'נקבה' },
  ],
  allows_sms: [
    { value: 'yes', label: 'כן' },
    { value: 'no', label: 'לא' },
  ],
};

export default function ClientManagement({ businessCode }: ClientManagementProps) {
  const { clients, error, isLoading, refresh } = useClients(businessCode);
  const { visibleFieldsFor, toggleField } = useUiPreferences(businessCode);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFilters>({});
  const [sort, setSort] = useState<ColumnSort | null>(null);
  const [filtersVisible, setFiltersVisible] = useState(false);

  const visibleKeys = visibleFieldsFor('clients');
  const activeColumns = CLIENT_FIELDS.filter((field) =>
    visibleKeys.includes(field.key),
  );
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
  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ?? null;
  const hasActiveFilters = Object.keys(visibleFilters).length > 0;
  const hasTableControls = hasActiveFilters || visibleSort !== null;
  const listTitle = hasTableControls
    ? `ניהול לקוחות (${visibleClients.length} מתוך ${clients.length})`
    : `ניהול לקוחות (${clients.length})`;

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setSelectedClientId(client.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (client: Client) => {
    const label = client.full_name || client.mobile_phone || 'הלקוח';
    if (
      !window.confirm(
        `למחוק את הלקוח "${label}"? גם התורים שלו יימחקו.`,
      )
    ) {
      return;
    }

    setActionError('');
    try {
      await deleteClient(businessCode, client.id);
      if (selectedClientId === client.id) {
        setSelectedClientId(null);
      }
      refresh();
    } catch (error) {
      const message = getErrorMessage(error).toLowerCase();
      console.error('שגיאה במחיקת לקוח:', getErrorMessage(error));
      setActionError(
        message.includes('foreign key') || message.includes('violat')
          ? 'לא ניתן למחוק לקוח שיש לו תורים במערכת.'
          : getErrorMessage(error) || 'לא ניתן למחוק את הלקוח.',
      );
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

      {actionError && (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      )}

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
          />
          <tbody>
            {visibleClients.map((client) => (
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
                        void handleDelete(client);
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
