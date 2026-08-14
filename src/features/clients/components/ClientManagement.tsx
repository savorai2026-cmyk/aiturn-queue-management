import { useState } from 'react';
import { formatClientCell } from '../clients.mappers';
import type {
  Client,
  ClientColumnKey,
} from '../clients.types';
import { useClients } from '../useClients';
import {
  ErrorState,
  LoadingState,
} from '../../../shared/components/PageState';
import AddClientModal from './AddClientModal';
import styles from './ClientManagement.module.css';

interface ClientManagementProps {
  businessCode: string;
}

interface ClientColumn {
  key: ClientColumnKey;
  label: string;
  dir?: 'ltr' | 'rtl';
}

const ALL_COLUMNS: ClientColumn[] = [
  { key: 'id', label: 'מזהה' },
  { key: 'full_name', label: 'שם מלא' },
  { key: 'national_id', label: 'ת.ז' },
  { key: 'gender', label: 'מין' },
  { key: 'birth_date_gregorian', label: 'ת.לידה לועזי' },
  { key: 'birth_date_hebrew', label: 'ת.לידה עברי' },
  { key: 'language', label: 'שפה' },
  { key: 'mobile_phone', label: 'נייד', dir: 'ltr' },
  { key: 'landline_phone', label: 'נייח', dir: 'ltr' },
  { key: 'whatsapp_number', label: 'וואטסאפ', dir: 'ltr' },
  { key: 'allows_sms', label: 'מקבל SMS?' },
  { key: 'email', label: 'אימייל' },
  { key: 'city', label: 'עיר' },
  { key: 'street', label: 'רחוב' },
  { key: 'building_number', label: 'בניין' },
  { key: 'apartment_number', label: 'דירה' },
  { key: 'entrance', label: 'כניסה' },
  { key: 'floor', label: 'קומה' },
  { key: 'zip_code', label: 'מיקוד' },
  { key: 'po_box', label: 'ת.ד' },
  { key: 'acquisition_source', label: 'מקור הגעה' },
  { key: 'preferred_channel', label: 'ערוץ מועדף' },
  { key: 'last_contact', label: 'תאריך הצטרפות' }
];

const DEFAULT_VISIBLE_COLUMNS: ClientColumnKey[] = [
  'id',
  'full_name',
  'mobile_phone',
  'city',
  'last_contact',
];

export default function ClientManagement({ businessCode }: ClientManagementProps) {
  const { clients, error, isLoading, refresh } = useClients(businessCode);
  const columnStorageKey = `clientTableColumns:${businessCode}`;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<ClientColumnKey[]>(() => {
    const saved = localStorage.getItem(columnStorageKey);
    if (!saved) return DEFAULT_VISIBLE_COLUMNS;

    try {
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed)) return DEFAULT_VISIBLE_COLUMNS;

      const validKeys = new Set(ALL_COLUMNS.map((column) => column.key));
      return parsed.filter(
        (key): key is ClientColumnKey =>
          typeof key === 'string' && validKeys.has(key as ClientColumnKey),
      );
    } catch {
      return DEFAULT_VISIBLE_COLUMNS;
    }
  });

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingClient(null);
    setIsModalOpen(true);
  };

  const toggleColumn = (colKey: ClientColumnKey) => {
    setVisibleColumns(prev => {
      const newCols = prev.includes(colKey) 
        ? prev.filter(k => k !== colKey) 
        : [...prev, colKey];
      
      localStorage.setItem(columnStorageKey, JSON.stringify(newCols));
      return newCols;
    });
  };

  const activeColumns = ALL_COLUMNS.filter(col => visibleColumns.includes(col.key));

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
          <div className={styles.columnChooserContainer}>
            <button 
              className={styles.btnSecondary} 
              onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
            >
              תצוגת עמודות
            </button>
            
            {isColumnMenuOpen && (
              <div className={styles.columnMenu}>
                <div className={styles.columnMenuTitle}>בחר עמודות להצגה:</div>
                {ALL_COLUMNS.map(col => (
                  <label key={col.key} className={styles.columnMenuLabel}>
                    <input 
                      type="checkbox" 
                      checked={visibleColumns.includes(col.key)}
                      onChange={() => toggleColumn(col.key)}
                    />
                    {col.label}
                  </label>
                ))}
              </div>
            )}
          </div>
          
          <button className={styles.btnPrimary} onClick={handleAddNew}>לקוח חדש</button>
        </div>
      </div>

      <div className={styles.tableResponsive}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>פעולות</th>
              {activeColumns.map(col => (
                <th key={col.key}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {clients.map(c => (
              <tr key={c.id}>
                <td>
                  <button className={styles.btnEdit} onClick={() => handleEdit(c)}>ערוך</button>
                </td>
                {activeColumns.map(col => (
                  <td 
                    key={col.key} 
                    dir={col.dir || 'rtl'} 
                  >
                    {formatClientCell(c, col.key)}
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
    </div>
  );
}