import { useMemo, useState } from 'react';
import {
  formatClientCell,
  matchesClientSearch,
  toClientDetailRows,
} from '../clients.mappers';
import { deleteClient } from '../clients.api';
import type { Client, ClientColumnKey } from '../clients.types';
import { useClients } from '../useClients';
import {
  ErrorState,
  LoadingState,
} from '../../../shared/components/PageState';
import DisplayToolbar from '../../../shared/displayFields/DisplayToolbar';
import RecordDetailsModal from '../../../shared/displayFields/RecordDetailsModal';
import { CLIENT_FIELDS } from '../../../shared/displayFields/catalogs';
import { useUiPreferences } from '../../../shared/displayFields/useUiPreferences';
import IconButton, {
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from '../../../shared/components/IconButton';
import { SearchIcon } from '../../../shared/components/icons';
import { getErrorMessage } from '../../../shared/errors';
import AddClientModal from './AddClientModal';
import styles from './ClientManagement.module.css';

interface ClientManagementProps {
  businessCode: string;
}

export default function ClientManagement({ businessCode }: ClientManagementProps) {
  const { clients, error, isLoading, refresh } = useClients(businessCode);
  const { visibleFieldsFor, toggleField } = useUiPreferences(businessCode);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [actionError, setActionError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const visibleKeys = visibleFieldsFor('clients');
  const activeColumns = CLIENT_FIELDS.filter((field) =>
    visibleKeys.includes(field.key),
  );
  const filteredClients = useMemo(
    () => clients.filter((client) => matchesClientSearch(client, searchQuery)),
    [clients, searchQuery],
  );
  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ?? null;
  const hasSearch = searchQuery.trim().length > 0;
  const listTitle = hasSearch
    ? `ניהול לקוחות (${filteredClients.length} מתוך ${clients.length})`
    : `ניהול לקוחות (${clients.length})`;

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setSelectedClientId(client.id);
    setIsModalOpen(true);
  };

  const handleDelete = async (client: Client) => {
    const label = client.full_name || client.mobile_phone || 'הלקוח';
    if (!window.confirm(`למחוק את הלקוח "${label}"?`)) {
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
          : 'לא ניתן למחוק את הלקוח.',
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
          />
          <button
            className={styles.btnPrimary}
            onClick={() => {
              setEditingClient(null);
              setIsModalOpen(true);
            }}
          >
            <PlusIcon />
            לקוח חדש
          </button>
        </div>
      </div>

      <div className={styles.searchRow}>
        <label className={styles.searchField}>
          <span className={styles.searchIcon} aria-hidden="true">
            <SearchIcon />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="חיפוש לפי שם, נייד או תעודת זהות"
            aria-label="חיפוש לקוחות לפי שם, נייד או תעודת זהות"
            className={styles.searchInput}
          />
          {hasSearch ? (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setSearchQuery('')}
            >
              נקה
            </button>
          ) : null}
        </label>
      </div>

      {actionError && (
        <p className={styles.actionError} role="alert">
          {actionError}
        </p>
      )}

      <div className={styles.tableResponsive}>
        <table className={`data-table ${styles.table}`}>
          <thead>
            <tr>
              <th>פעולות</th>
              {activeColumns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredClients.map((client) => (
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
            {filteredClients.length === 0 && (
              <tr>
                <td colSpan={activeColumns.length + 1} className={styles.emptyState}>
                  {clients.length === 0
                    ? 'לא נמצאו לקוחות במערכת'
                    : 'לא נמצאו לקוחות מתאימים לחיפוש'}
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
