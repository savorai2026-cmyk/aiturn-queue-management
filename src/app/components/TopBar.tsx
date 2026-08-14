import logo from '../../assets/logo.png';
import type { AppTab } from '../navigation';
import type { BusinessMembership } from '../../features/business/BusinessContextState';
import styles from './TopBar.module.css';

interface TopBarProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  onLogout: () => void;
  businessName: string;
  userEmail?: string;
  businesses: BusinessMembership[];
  activeBusinessCode: string;
  onBusinessChange: (businessCode: string) => void;
}

const NAV_ITEMS: Array<{ tab: AppTab; label: string }> = [
  { tab: 'settings', label: 'הגדרות' },
  { tab: 'calendar', label: 'יומן חי' },
  { tab: 'clients', label: 'ניהול לקוחות' },
  { tab: 'modmed', label: 'מודמד' },
];

export default function TopBar({
  activeTab,
  onTabChange,
  onLogout,
  businessName,
  userEmail,
  businesses,
  activeBusinessCode,
  onBusinessChange,
}: TopBarProps) {
  return (
    <header className={styles.topBar}>
      <div className={styles.rightSection}>
        <img src={logo} alt="Featurn Logo" className={styles.logo} />
      </div>

      <div className={styles.navGroup}>
        {NAV_ITEMS.map(({ tab, label }) => (
          <button
            key={tab}
            className={`${styles.navBtn} ${activeTab === tab ? styles.activeNavBtn : ''}`}
            onClick={() => onTabChange(tab)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.leftSection}>
        {businesses.length > 1 && (
          <select
            className={styles.businessSelect}
            value={activeBusinessCode}
            onChange={(event) => onBusinessChange(event.target.value)}
            aria-label="בחירת עסק פעיל"
          >
            {businesses.map((business) => (
              <option key={business.businessCode} value={business.businessCode}>
                {business.businessName}
              </option>
            ))}
          </select>
        )}
        <span className={styles.greeting}>
          שלום, {businessName || userEmail?.split('@')[0] || 'משתמש'}
        </span>
        <button className={styles.logoutBtn} onClick={onLogout}>יציאה</button>
      </div>
    </header>
  );
}