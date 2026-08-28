import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  BRAND_STATUS_COLORS,
  DEFAULT_STATUS_COLOR,
} from '../../appointments/appointmentStatuses';
import { getErrorMessage } from '../../../shared/errors';
import { createStatus, updateStatus } from '../settings.api';
import type {
  AppointmentStatusInsert,
  AppointmentStatusRow,
  AppointmentStatusUpdate,
  StatusFormValues,
} from '../settings.types';
import { PlusIcon, SaveIcon } from '../../../shared/components/icons';
import styles from './AddServiceModal.module.css';

interface StatusModalProps {
  businessCode: string;
  status?: AppointmentStatusRow | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

const DEFAULT_COLOR = DEFAULT_STATUS_COLOR;

const INITIAL_VALUES: StatusFormValues = {
  status_code: '',
  status_text: '',
  color: DEFAULT_COLOR,
};

function toFormValues(status?: AppointmentStatusRow | null): StatusFormValues {
  if (!status) return INITIAL_VALUES;

  return {
    status_code: status.status_code,
    status_text: status.status_text,
    color: status.color || DEFAULT_COLOR,
  };
}

function validateStatus(values: StatusFormValues): string | null {
  if (!values.status_code.trim()) {
    return 'יש להזין קוד סטטוס.';
  }

  if (!values.status_text.trim()) {
    return 'יש להזין שם סטטוס.';
  }

  if (!/^#[0-9a-f]{6}$/i.test(values.color)) {
    return 'צבע הסטטוס אינו בפורמט תקין.';
  }

  return null;
}

function toStatusInsert(
  businessCode: string,
  values: StatusFormValues,
): AppointmentStatusInsert {
  return {
    business_code: businessCode,
    status_code: values.status_code.trim(),
    status_text: values.status_text.trim(),
    color: values.color,
  };
}

function toStatusUpdate(values: StatusFormValues): AppointmentStatusUpdate {
  return {
    status_text: values.status_text.trim(),
    color: values.color,
  };
}

function getStatusErrorMessage(error: unknown): string {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes('duplicate') || message.includes('unique')) {
    return 'קוד הסטטוס כבר קיים בעסק.';
  }

  if (
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return 'אין לך הרשאה לערוך סטטוסים בעסק.';
  }

  if (message.includes('check_valid_hex_color')) {
    return 'צבע הסטטוס אינו בפורמט תקין.';
  }

  return 'לא ניתן לשמור את הסטטוס. בדוק את הפרטים ונסה שוב.';
}

export default function StatusModal({
  businessCode,
  status,
  onClose,
  onSuccess,
}: StatusModalProps) {
  const isEdit = Boolean(status);
  const [formData, setFormData] = useState<StatusFormValues>(() =>
    toFormValues(status),
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateStatus(formData);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      if (isEdit && status) {
        await updateStatus(
          businessCode,
          status.status_code,
          toStatusUpdate(formData),
        );
      } else {
        await createStatus(toStatusInsert(businessCode, formData));
      }
      await onSuccess();
    } catch (error) {
      console.error('שגיאה בשמירת סטטוס:', getErrorMessage(error));
      setErrorMessage(getStatusErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSaving) {
          onClose();
        }
      }}
    >
      <section
        className={styles.content}
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-modal-title"
      >
        <h2 id="status-modal-title" className={styles.title}>
          {isEdit ? 'עריכת סטטוס' : 'הוספת סטטוס חדש'}
        </h2>

        {errorMessage && (
          <div className={styles.error} role="alert">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="status-code">קוד סטטוס *</label>
              <input
                ref={isEdit ? undefined : firstInputRef}
                id="status-code"
                name="status_code"
                value={formData.status_code}
                onChange={handleChange}
                className={styles.input}
                dir="ltr"
                maxLength={50}
                required
                readOnly={isEdit}
                disabled={isEdit}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="status-text">שם הסטטוס *</label>
              <input
                ref={isEdit ? firstInputRef : undefined}
                id="status-text"
                name="status_text"
                value={formData.status_text}
                onChange={handleChange}
                className={styles.input}
                maxLength={80}
                required
              />
            </div>

            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label htmlFor="status-color">צבע</label>
              <div className={styles.swatchRow} role="listbox" aria-label="צבעי עיצוב">
                {BRAND_STATUS_COLORS.map((swatch) => {
                  const isSelected =
                    formData.color.toLowerCase() === swatch.hex.toLowerCase();

                  return (
                    <button
                      key={swatch.hex}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      title={swatch.label}
                      className={`${styles.swatch} ${isSelected ? styles.swatchSelected : ''}`}
                      style={{ backgroundColor: swatch.hex }}
                      onClick={() =>
                        setFormData((previous) => ({
                          ...previous,
                          color: swatch.hex,
                        }))
                      }
                    />
                  );
                })}
              </div>
              <div className={styles.colorInput}>
                <input
                  id="status-color"
                  type="color"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
                />
                <input
                  aria-label="קוד צבע"
                  name="color"
                  value={formData.color}
                  onChange={handleChange}
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
              {isSaving ? 'שומר...' : isEdit ? (
                <>
                  <SaveIcon />
                  שמור שינויים
                </>
              ) : (
                <>
                  <PlusIcon />
                  הוסף סטטוס
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
