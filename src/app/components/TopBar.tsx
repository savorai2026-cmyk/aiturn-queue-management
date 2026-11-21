import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import BrandLogo from '../../shared/components/BrandLogo';
import type { AppTab } from '../navigation';
import type { BusinessMembership, BusinessRole } from '../../features/business/BusinessContextState';
import OwnerAssistantPanel from '../../features/assistant/components/OwnerAssistantPanel';
import SupportRequestModal from '../../features/support/SupportRequestModal';
import { LogoutIcon, MailIcon } from '../../shared/components/icons';
import { applyColorScheme, readColorScheme, type ColorScheme } from '../colorScheme';
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
  showAssistant?: boolean;
  role?: BusinessRole;
}

const NAV_ITEMS: Array<{
  tab: AppTab;
  label: string;
}> = [
  { tab: 'settings', label: 'הגדרות' },
  { tab: 'calendar', label: 'יומן חי' },
  { tab: 'clients', label: 'ניהול לקוחות' },
  { tab: 'stats', label: 'סטטיסטיקה' },
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
  showAssistant = false,
  role,
}: TopBarProps) {
  const navItems = NAV_ITEMS.filter((item) => item.tab !== 'stats' || role === 'owner');
  const [supportOpen, setSupportOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [supportNotice, setSupportNotice] = useState('');
  const [supportNoticeVisible, setSupportNoticeVisible] = useState(false);
  const [colorScheme, setColorScheme] = useState<ColorScheme>(readColorScheme);
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ x: number; width: number } | null>(null);
  const [indicatorReady, setIndicatorReady] = useState(false);

  useEffect(() => {
    if (!supportNotice) return;
    const fadeTimer = window.setTimeout(() => setSupportNoticeVisible(false), 3000);
    const hideTimer = window.setTimeout(() => setSupportNotice(''), 3500);
    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
    };
  }, [supportNotice]);

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
        x: box.left - navBox.left + nav.scrollLeft,
        width: box.width,
      });
    };

    place();
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) setIndicatorReady(true);
    });
    window.addEventListener('resize', place);
    nav.addEventListener('scroll', place, { passive: true });
    void document.fonts?.ready.then(place);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
      nav.removeEventListener('scroll', place);
    };
  }, [activeTab, role]);

  return (
    <>
    <header className={styles.topBar}>
      <div className={styles.rightSection}>
        <BrandLogo className={styles.logo} />
      </div>

      <nav ref={navRef} className={styles.navGroup} aria-label="תפריט ראשי">
        {indicator ? (
          <span
            className={`${styles.navIndicator} ${indicatorReady ? styles.navIndicatorReady : ''}`}
            style={{ width: indicator.width, transform: `translateX(${indicator.x}px)` }}
            aria-hidden="true"
          />
        ) : null}
        {navItems.map(({ tab, label }, index) => (
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
        {businesses.length > 1 ? (
          <>
            <span className={styles.greeting}>שלום,</span>
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
          </>
        ) : (
          <span className={styles.greeting}>
            שלום, {businessName || userEmail?.split('@')[0] || 'משתמש'}
          </span>
        )}
        <button
          type="button"
          className={styles.themeBtn}
          aria-pressed={colorScheme === 'dark'}
          aria-label={colorScheme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
          title={colorScheme === 'dark' ? 'מצב בהיר' : 'מצב כהה'}
          onClick={() => {
            const next: ColorScheme = colorScheme === 'dark' ? 'light' : 'dark';
            applyColorScheme(next);
            setColorScheme(next);
          }}
        >
          {colorScheme === 'dark' ? '☀' : '☾'}
        </button>
        <button
          type="button"
          className={styles.mailBtn}
          aria-label="פנייה למערכת"
          onClick={() => {
            setSupportNotice('');
            setSupportNoticeVisible(false);
            setSupportOpen(true);
          }}
        >
          <MailIcon />
        </button>
        <button className={styles.logoutBtn} onClick={onLogout} aria-label="יציאה">
          <LogoutIcon />
          <span className={styles.logoutLabel}>יציאה</span>
        </button>
      </div>
    </header>
    {supportNotice
      ? createPortal(
          <p
            className={`${styles.supportToast} ${supportNoticeVisible ? '' : styles.supportToastLeaving}`}
            role="status"
          >
            {supportNotice}
          </p>,
          document.body,
        )
      : null}
    {showAssistant ? (
      <OwnerAssistantPanel
        key={activeBusinessCode}
        businessCode={activeBusinessCode}
        businessName={businessName}
        activeTab={activeTab}
        open={assistantOpen}
        onToggle={() => setAssistantOpen((open) => !open)}
        onClose={() => setAssistantOpen(false)}
      />
    ) : null}
    {supportOpen ? (
      <SupportRequestModal
        businessCode={activeBusinessCode}
        businessName={businessName}
        onClose={() => setSupportOpen(false)}
        onSent={() => {
          setSupportNoticeVisible(true);
          setSupportNotice('הפנייה נשלחה בהצלחה.');
        }}
      />
    ) : null}
    </>
  );
}