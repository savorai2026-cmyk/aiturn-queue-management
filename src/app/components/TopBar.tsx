import logo from '../../assets/logo.png';
import type { AppTab } from '../navigation';
import type { BusinessMembership } from '../../features/business/BusinessContextState';
import {
  CalendarIcon,
  GearIcon,
  LogoutIcon,
  UsersIcon,
} from '../../shared/components/icons';
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

const NAV_ITEMS: Array<{
  tab: AppTab;
  label: string;
  icon: typeof CalendarIcon;
}> = [
  { tab: 'settings', label: 'הגדרות', icon: GearIcon },
  { tab: 'calendar', label: 'יומן חי', icon: CalendarIcon },
  { tab: 'clients', label: 'ניהול לקוחות', icon: UsersIcon },
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
        {NAV_ITEMS.map(({ tab, label, icon: Icon }) => (
          <button
            key={tab}
            className={`${styles.navBtn} ${activeTab === tab ? styles.activeNavBtn : ''}`}
            aria-current={activeTab === tab ? 'page' : undefined}
            onClick={() => onTabChange(tab)}
          >
            <Icon />
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
        <button className={styles.logoutBtn} onClick={onLogout}>
          <LogoutIcon />
          יציאה
        </button>
      </div>
    </header>
  );
}