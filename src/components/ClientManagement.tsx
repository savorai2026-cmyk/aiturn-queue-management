import { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import AddClientModal from './AddClientModal';
import styles from './ClientManagement.module.css';

// --- הגדרת הממשק לקבלת המשתמש מההורה (App.tsx) ---
interface ClientManagementProps {
  user: any; 
}

// הגדרת כל העמודות האפשריות במערכת
const ALL_COLUMNS = [
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

const DEFAULT_VISIBLE_COLUMNS = ['id', 'full_name', 'mobile_phone', 'city', 'last_contact'];

export default function ClientManagement({ user }: ClientManagementProps) {
  const [clients, setClients] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<any>(null);
  
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('clientTableVariant');
    return saved ? JSON.parse(saved) : DEFAULT_VISIBLE_COLUMNS;
  });

  // שליפת לקוחות אך ורק עבור העסק/המשתמש המחובר כרגע
  const fetchClients = async () => {
    if (!user?.id) return;

    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('business_code', user.id) 
      .order('id', { ascending: false });
      
    if (data) setClients(data);
    if (error) console.error('שגיאה בשליפת לקוחות:', error.message);
  };

  useEffect(() => {
    fetchClients();
  }, [user]);

  const handleEdit = (client: any) => {
    setEditingClient(client);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingClient(null);
    setIsModalOpen(true);
  };

  const toggleColumn = (colKey: string) => {
    setVisibleColumns(prev => {
      const newCols = prev.includes(colKey) 
        ? prev.filter(k => k !== colKey) 
        : [...prev, colKey];
      
      localStorage.setItem('clientTableVariant', JSON.stringify(newCols));
      return newCols;
    });
  };

  const renderCellContent = (client: any, colKey: string) => {
    switch (colKey) {
      case 'gender': return client.gender === 'M' ? 'זכר' : client.gender === 'F' ? 'נקבה' : '';
      case 'allows_sms': return client.allows_sms ? 'כן' : 'לא';
      case 'last_contact': return client.last_contact ? new Date(client.last_contact).toLocaleDateString('he-IL') : '';
      default: return client[colKey];
    }
  };

  const activeColumns = ALL_COLUMNS.filter(col => visibleColumns.includes(col.key));

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
                    style={{ textAlign: 'right' }}
                  >
                    {renderCellContent(c, col.key)}
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

      {/* חלון ה-Modal להוספה/עריכה */}
      {isModalOpen && (
        <AddClientModal 
          user={user}
          clientToEdit={editingClient}
          onClose={() => setIsModalOpen(false)}
          onSuccess={() => {
            setIsModalOpen(false);
            fetchClients();
          }}
        />
      )}
    </div>
  );
}