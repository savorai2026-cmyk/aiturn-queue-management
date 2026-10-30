import { useEffect } from 'react';
import modal from '../../shared/components/modalShell.module.css';
import { TERMS_SECTIONS, TERMS_SUMMARY, TERMS_UPDATED_LABEL } from './termsOfUse';
import styles from './TermsDialog.module.css';

interface TermsDialogProps {
  onClose: () => void;
}

export default function TermsDialog({ onClose }: TermsDialogProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className={`${modal.overlay} ${styles.overlay}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className={`${modal.content} ${styles.content}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-of-use-title"
      >
        <header className={styles.header}>
          <h2 id="terms-of-use-title" className={styles.title}>
            תנאי השימוש
          </h2>
          <p className={styles.updated}>עודכן לאחרונה: {TERMS_UPDATED_LABEL}</p>
        </header>

        <p className={styles.summary}>{TERMS_SUMMARY}</p>

        <div className={modal.scroll}>
          {TERMS_SECTIONS.map((section, index) => (
            <section key={section.id} className={styles.section}>
              <h3>
                {index + 1}. {section.title}
              </h3>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul>
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <button type="button" className={styles.close} onClick={onClose}>
          סגירה
        </button>
      </section>
    </div>
  );
}
