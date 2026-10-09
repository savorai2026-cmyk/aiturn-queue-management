import { useEffect, useState, type FormEvent } from 'react';
import { type SubscriptionPlan } from '../../usage/planPricing';
import { usePlanTariffs } from '../../usage/tariffs.api';
import {
  closeBusinessAccount,
  createBusinessMember,
  listBusinessMembers,
  removeBusinessMember,
  type BusinessMemberAccount,
} from '../members.api';
import { isEmailAddress, normalizeEmail, passwordRuleError } from '../passwordRules';
import styles from './BusinessAccountPanel.module.css';

interface BusinessAccountPanelProps {
  businessCode: string;
  plan: SubscriptionPlan;
  agentsActive: boolean;
  accountClosed: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'בעל העסק',
  admin: 'מנהל',
  staff: 'עובד',
  viewer: 'צפייה',
};

function membershipStatusLabel(status: string): string {
  if (status === 'active') return 'פעיל';
  if (status === 'inactive' || status === 'disabled') return 'לא פעיל';
  return status;
}

export default function BusinessAccountPanel({
  businessCode,
  plan,
  agentsActive,
  accountClosed,
}: BusinessAccountPanelProps) {
  const [members, setMembers] = useState<BusinessMemberAccount[]>([]);
  const [loadError, setLoadError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [formMessage, setFormMessage] = useState('');
  const [creating, setCreating] = useState(false);
  const [removingId, setRemovingId] = useState('');
  const [pendingRemoveId, setPendingRemoveId] = useState('');
  const [closeArmed, setCloseArmed] = useState(false);
  const [closeError, setCloseError] = useState('');
  const [closing, setClosing] = useState(false);
  const tariffs = usePlanTariffs(businessCode);
  const terms = tariffs.resolve(plan);

  useEffect(() => {
    let cancelled = false;
    listBusinessMembers(businessCode)
      .then((rows) => {
        if (!cancelled) setMembers(rows);
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'לא ניתן לטעון את המשתמשים.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [businessCode]);

  const extraUsers = Math.max(0, members.length - terms.includedUsers);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    setFormMessage('');

    const normalizedEmail = normalizeEmail(email);
    if (!isEmailAddress(normalizedEmail)) {
      setFormError('כתובת הדוא״ל אינה תקינה.');
      return;
    }
    const ruleError = passwordRuleError(password);
    if (ruleError) {
      setFormError(ruleError);
      return;
    }
    if (password !== confirmPassword) {
      setFormError('הסיסמאות אינן תואמות.');
      return;
    }

    setCreating(true);
    try {
      await createBusinessMember({
        businessCode,
        email: normalizedEmail,
        password,
      });
      const rows = await listBusinessMembers(businessCode);
      setMembers(rows);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setFormMessage(
        'המשתמש נוצר ומשויך לעסק. נשלח אליו מייל לאימות הכתובת. מסרו לו את הסיסמה שהקלדתם. אחרי האימות הוא מתחבר ורואה את יומן העסק.',
      );
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'לא ניתן ליצור את המשתמש.');
    } finally {
      setCreating(false);
    }
  };

  const handleRemove = async (member: BusinessMemberAccount) => {
    setRemovingId(member.userId);
    setPendingRemoveId('');
    setFormError('');
    try {
      await removeBusinessMember({ businessCode, userId: member.userId });
      setMembers((current) => current.filter((row) => row.userId !== member.userId));
    } catch (error: unknown) {
      setFormError(error instanceof Error ? error.message : 'לא ניתן למחוק את המשתמש.');
    } finally {
      setRemovingId('');
    }
  };

  const handleClose = async () => {
    setCloseError('');
    setClosing(true);
    try {
      await closeBusinessAccount(businessCode);
      window.location.reload();
    } catch (error: unknown) {
      setCloseError(error instanceof Error ? error.message : 'לא ניתן לסגור את החשבון.');
      setClosing(false);
    }
  };

  return (
    <div className={styles.panel}>
      <section className={styles.group}>
        <header className={styles.header}>
          <h3>משתמשים</h3>
          <p>
            בעל העסק יוצר כאן משתמש לעובד. עד {terms.includedUsers} משתמשים כלולים, וכל
            משתמש נוסף עולה {terms.extraUserIls} ₪ לחודש.
            {extraUsers > 0
              ? ` כרגע יש ${extraUsers.toLocaleString('he-IL')} מעבר למכסה.`
              : ''}
          </p>
        </header>

        {loadError ? <p className={styles.error}>{loadError}</p> : null}

        <p className={styles.hint}>
          כאן רואים את הסטטוס של כל משתמש. אצל בעל העסק מופיע גם מצב הסוכנים ומצב החשבון. את בעל העסק אי אפשר למחוק.
        </p>
        <ul className={styles.list}>
          {members.map((member) => {
            const isOwner = member.role === 'owner';
            const confirming = pendingRemoveId === member.userId;
            return (
              <li key={member.userId}>
                <div>
                  <p className={styles.email} dir="ltr">{member.email || 'ללא דוא״ל'}</p>
                  <p className={styles.role}>{ROLE_LABELS[member.role] ?? member.role}</p>
                  <div className={styles.badges}>
                    <span
                      className={styles.badge}
                      data-tone={member.status === 'active' ? 'ok' : 'off'}
                    >
                      {membershipStatusLabel(member.status)}
                    </span>
                    <span
                      className={styles.badge}
                      data-tone={member.emailConfirmed ? 'ok' : 'wait'}
                    >
                      {member.emailConfirmed ? 'הדוא״ל אומת' : 'ממתין לאימות'}
                    </span>
                  </div>
                </div>
                {isOwner ? (
                  <div className={styles.statusFrame}>
                    <p>
                      <span>סוכנים</span>
                      <strong data-tone={agentsActive ? 'ok' : 'off'}>
                        {agentsActive ? 'פעילים' : 'כבויים'}
                      </strong>
                    </p>
                    <p>
                      <span>חשבון</span>
                      <strong data-tone={accountClosed ? 'closed' : 'ok'}>
                        {accountClosed ? 'סגור' : 'פתוח'}
                      </strong>
                    </p>
                  </div>
                ) : confirming ? (
                  <div className={styles.confirm}>
                    <span>למחוק את המשתמש הזה?</span>
                    <button
                      type="button"
                      className={styles.remove}
                      disabled={removingId === member.userId}
                      onClick={() => void handleRemove(member)}
                    >
                      {removingId === member.userId ? 'מוחק...' : 'כן, למחוק'}
                    </button>
                    <button
                      type="button"
                      className={styles.cancel}
                      onClick={() => setPendingRemoveId('')}
                    >
                      ביטול
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => setPendingRemoveId(member.userId)}
                  >
                    מחיקת משתמש
                  </button>
                )}
              </li>
            );
          })}
        </ul>

        <form className={styles.form} onSubmit={(event) => void handleCreate(event)}>
          <label htmlFor="staff-email">דוא״ל העובד</label>
          <input
            id="staff-email"
            type="email"
            dir="ltr"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <label htmlFor="staff-password">סיסמה ראשונית</label>
          <input
            id="staff-password"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <p className={styles.hint}>
            לפחות 8 תווים, אות אנגלית גדולה וקטנה, ספרה ותו מיוחד.
          </p>
          <label htmlFor="staff-password-confirm">אימות סיסמה</label>
          <input
            id="staff-password-confirm"
            type="password"
            dir="ltr"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
          {formError ? <p className={styles.error}>{formError}</p> : null}
          {formMessage ? <p className={styles.success}>{formMessage}</p> : null}
          <button type="submit" className={styles.primary} disabled={creating}>
            {creating ? 'יוצר...' : 'יצירת משתמש'}
          </button>
        </form>
      </section>

      <section className={styles.group}>
        <header className={styles.header}>
          <h3>סגירת חשבון</h3>
          <p>
            זה נועל את המערכת. אף משתמש לא יוכל להיכנס ליומן, וסוכן הקול וסוכן
            הוואטסאפ ייעצרו. המתג «הסוכנים פעילים» רק מכבה את הסוכנים ומשאיר את היומן פתוח.
          </p>
        </header>
        {closeError ? <p className={styles.error}>{closeError}</p> : null}
        {closeArmed ? (
          <div className={styles.confirm}>
            <span>לסגור את החשבון ולנעול את המערכת?</span>
            <button
              type="button"
              className={styles.danger}
              disabled={closing}
              onClick={() => void handleClose()}
            >
              {closing ? 'סוגר...' : 'כן, לסגור'}
            </button>
            <button
              type="button"
              className={styles.cancel}
              disabled={closing}
              onClick={() => setCloseArmed(false)}
            >
              ביטול
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.danger}
            onClick={() => setCloseArmed(true)}
          >
            סגירת החשבון
          </button>
        )}
      </section>
    </div>
  );
}
