import { useState, type FormEvent } from 'react';
import TermsDialog from './TermsDialog';
import { TERMS_SUMMARY } from './termsOfUse';
import styles from './TermsConsent.module.css';

interface TermsConsentProps {
  checked: boolean;
  invalid?: boolean;
  onChange: (checked: boolean) => void;
  onInvalid?: () => void;
}

export default function TermsConsent({
  checked,
  invalid = false,
  onChange,
  onInvalid,
}: TermsConsentProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={`${styles.block}${invalid ? ` ${styles.invalid}` : ''}`}>
      <div className={styles.row}>
        <input
          id="accept-terms"
          type="checkbox"
          checked={checked}
          required
          aria-invalid={invalid || undefined}
          aria-describedby="accept-terms-note"
          onChange={(event) => onChange(event.target.checked)}
          onInvalid={(event: FormEvent<HTMLInputElement>) => {
            event.preventDefault();
            onInvalid?.();
          }}
        />
        <div className={styles.copy}>
          <label htmlFor="accept-terms">קראתי ואני מסכים/ה לתנאי השימוש.</label>
          <button type="button" className={styles.link} onClick={() => setIsOpen(true)}>
            לקריאת הנוסח המלא
          </button>
        </div>
      </div>
      <p id="accept-terms-note" className={styles.note}>
        {TERMS_SUMMARY}
      </p>
      {isOpen ? <TermsDialog onClose={() => setIsOpen(false)} /> : null}
    </div>
  );
}
