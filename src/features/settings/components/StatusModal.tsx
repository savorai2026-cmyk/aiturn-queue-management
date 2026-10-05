import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  BRAND_STATUS_COLORS,
  DEFAULT_STATUS_COLOR,
} from '../../appointments/appointmentStatuses';
import { getErrorMessage } from '../../../shared/errors';
import { updateStatus } from '../settings.api';
import type { AppointmentStatusRow } from '../settings.types';
import { SaveIcon } from '../../../shared/components/icons';
import modal from '../../../shared/components/modalShell.module.css';
import styles from './AddServiceModal.module.css';

interface StatusModalProps {
  businessCode: string;
  status: AppointmentStatusRow;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function getStatusErrorMessage(error: unknown): string {
  const message = getErrorMessage(error).toLowerCase();

  if (
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return 'אין לך הרשאה לערוך סטטוסים בעסק.';
  }

  if (message.includes('check_valid_hex_color')) {
    return 'צבע הסטטוס אינו בפורמט תקין.';
  }

  return 'לא ניתן לשמור את צבע הסטטוס. נסו שוב.';
}

export default function StatusModal({
  businessCode,
  status,
  onClose,
  onSuccess,
}: StatusModalProps) {
  const [color, setColor] = useState(status.color || DEFAULT_STATUS_COLOR);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    setColor(event.target.value);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!isHexColor(color)) {
      setErrorMessage('צבע הסטטוס אינו בפורמט תקין.');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      await updateStatus(businessCode, status.status_code, { color });
      await onSuccess();
    } catch (error) {
      console.error('שגיאה בשמירת צבע סטטוס:', getErrorMessage(error));
      setErrorMessage(getStatusErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={`${modal.overlay} ${styles.overlay}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        className={`${modal.content} ${styles.content}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-modal-title"
      >
        <h2 id="status-modal-title" className={styles.title}>
          עריכת צבע · {status.status_text}
        </h2>

        {errorMessage && (
          <div className={styles.error} role="alert">
            {errorMessage}
          </div>
        )}

        <form className={modal.form} onSubmit={handleSubmit}>
          <div className={modal.scroll}>
            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label htmlFor="status-color">צבע</label>
              <div className={styles.swatchRow} role="listbox" aria-label="צבעי עיצוב">
                {BRAND_STATUS_COLORS.map((swatch) => {
                  const isSelected =
                    color.toLowerCase() === swatch.hex.toLowerCase();

                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      title={swatch.label}
                      className={`${styles.swatch} ${isSelected ? styles.swatchSelected : ''}`}
                      style={{ backgroundColor: swatch.hex }}
                      onClick={() => setColor(swatch.hex)}
                    />
                  );
                })}
              </div>
              <div className={styles.colorInput}>
                <input
                  id="status-color"
                  type="color"
                  name="color"
                  value={isHexColor(color) ? color : DEFAULT_STATUS_COLOR}
                  onChange={handleColorChange}
                />
                <input
                  aria-label="קוד צבע"
                  name="color"
                  value={color}
                  onChange={handleColorChange}
                  className={styles.input}
                  dir="ltr"
                  maxLength={7}
                />
              </div>
            </div>
          </div>

          <div className={styles.actions}>
            <button
              type="button"
              className={styles.btnCancel}
              onClick={onClose}
              disabled={isSaving}
            >
              ביטול
            </button>
            <button
              type="submit"
              className={styles.btnSave}
              disabled={isSaving}
            >
              {isSaving ? 'שומר...' : (
                <>
                  <SaveIcon />
                  שמור צבע
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
