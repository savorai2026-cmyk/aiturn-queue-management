import { useState } from 'react';
import { formatClientCell, toClientDetailRows } from '../clients.mappers';
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
import IconButton, { PencilIcon, PlusIcon } from '../../../shared/components/IconButton';
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

  const visibleKeys = visibleFieldsFor('clients');
  const activeColumns = CLIENT_FIELDS.filter((field) =>
    visibleKeys.includes(field.key),
  );
  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ?? null;

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setSelectedClientId(client.id);
    setIsModalOpen(true);
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
        <h2 className={styles.title}>ניהול לקוחות ({clients.length})</h2>

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
            {clients.map((client) => (
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
                      size="compact"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleEdit(client);
                      }}
                    >
                      <PencilIcon />
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
            {clients.length === 0 && (
              <tr>
                <td colSpan={activeColumns.length + 1} className={styles.emptyState}>
                  לא נמצאו לקוחות במערכת
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
