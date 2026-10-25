import { useLayoutEffect, useRef, useState } from 'react';
import logo from '../../assets/logo.png';
import type { AppTab } from '../navigation';
import type { BusinessMembership } from '../../features/business/BusinessContextState';
import SupportRequestModal from '../../features/support/SupportRequestModal';
import { LogoutIcon, MailIcon } from '../../shared/components/icons';
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
}> = [
  { tab: 'settings', label: 'הגדרות' },
  { tab: 'calendar', label: 'יומן חי' },
  { tab: 'clients', label: 'ניהול לקוחות' },
  { tab: 'logs', label: 'לוגים' },
  { tab: 'usage', label: 'עלות' },
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
  const [supportOpen, setSupportOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ x: number; width: number } | null>(null);
  const [indicatorReady, setIndicatorReady] = useState(false);

  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;

    let cancelled = false;
    const place = () => {
      if (cancelled) return;
      const current = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!current) return;
      const navBox = nav.getBoundingClientRect();
      const box = current.getBoundingClientRect();
      setIndicator({
        x: box.left - navBox.left,
        width: box.width,
      });
    };

    place();
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) setIndicatorReady(true);
    });
    window.addEventListener('resize', place);
    void document.fonts?.ready.then(place);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
    };
  }, [activeTab]);

  return (
    <>
    <header className={styles.topBar}>
      <div className={styles.rightSection}>
        <img src={logo} alt="QGent" className={styles.logo} />
      </div>

      <nav ref={navRef} className={styles.navGroup} aria-label="תפריט ראשי">
        {indicator ? (
          <span
            className={`${styles.navIndicator} ${indicatorReady ? styles.navIndicatorReady : ''}`}
            style={{ width: indicator.width, transform: `translateX(${indicator.x}px)` }}
            aria-hidden="true"
          />
        ) : null}
        {NAV_ITEMS.map(({ tab, label }, index) => (
          <div key={tab} className={styles.navSlot}>
            {index > 0 ? <span className={styles.navDivider} aria-hidden="true" /> : null}
            <button
              type="button"
              className={`${styles.navBtn} ${activeTab === tab ? styles.activeNavBtn : ''}`}
              aria-current={activeTab === tab ? 'page' : undefined}
              onClick={() => onTabChange(tab)}
            >
              <span className={styles.navLabel}>{label}</span>
            </button>
          </div>
        ))}
      </nav>

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
        <button
          type="button"
          className={styles.mailBtn}
          aria-label="פנייה למערכת"
          onClick={() => setSupportOpen(true)}
        >
          <MailIcon />
        </button>
        <button className={styles.logoutBtn} onClick={onLogout}>
          <LogoutIcon />
          יציאה
        </button>
      </div>
    </header>
    {supportOpen ? (
      <SupportRequestModal
        businessCode={activeBusinessCode}
        businessName={businessName}
        onClose={() => setSupportOpen(false)}
      />
    ) : null}
    </>
  );
}