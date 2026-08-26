import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { getErrorMessage } from '../../../shared/errors';
import { createService, updateService } from '../settings.api';
import type {
  Service,
  ServiceFormValues,
  ServiceInsert,
  ServiceUpdate,
} from '../settings.types';
import styles from './AddServiceModal.module.css';

interface AddServiceModalProps {
  businessCode: string;
  service?: Service | null;
  onClose: () => void;
  onSuccess: () => void | Promise<void>;
}

const INITIAL_VALUES: ServiceFormValues = {
  title: '',
  service_code: '',
  description: '',
  duration_minutes: '30',
  buffer_time_minutes: '0',
  price: '0',
  deposit_amount: '0',
  color_code: '#0d9488',
  is_active: true,
};

function toFormValues(service?: Service | null): ServiceFormValues {
  if (!service) return INITIAL_VALUES;

  return {
    title: service.title,
    service_code: service.service_code ?? '',
    description: service.description ?? '',
    duration_minutes: String(service.duration_minutes),
    buffer_time_minutes: String(service.buffer_time_minutes ?? 0),
    price: String(service.price),
    deposit_amount: String(service.deposit_amount ?? 0),
    color_code: service.color_code || '#0d9488',
    is_active: service.is_active !== false,
  };
}

function validateService(values: ServiceFormValues): string | null {
  const duration = Number(values.duration_minutes);
  const buffer = Number(values.buffer_time_minutes);
  const price = Number(values.price);
  const deposit = Number(values.deposit_amount);

  if (!values.title.trim()) {
    return 'יש להזין שם שירות.';
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    return 'משך השירות חייב להיות גדול מאפס.';
  }

  if (!Number.isFinite(buffer) || buffer < 0) {
    return 'זמן החיץ אינו יכול להיות שלילי.';
  }

  if (!Number.isFinite(price) || price < 0) {
    return 'מחיר השירות אינו יכול להיות שלילי.';
  }

  if (!Number.isFinite(deposit) || deposit < 0) {
    return 'סכום הפיקדון אינו יכול להיות שלילי.';
  }

  if (deposit > price) {
    return 'סכום הפיקדון אינו יכול להיות גבוה ממחיר השירות.';
  }

  if (!/^#[0-9a-f]{6}$/i.test(values.color_code)) {
    return 'צבע השירות אינו בפורמט תקין.';
  }

  return null;
}

function toServiceInsert(
  businessCode: string,
  values: ServiceFormValues,
): ServiceInsert {
  return {
    business_code: businessCode,
    title: values.title.trim(),
    service_code: values.service_code.trim() || null,
    description: values.description.trim() || null,
    duration_minutes: Number(values.duration_minutes),
    buffer_time_minutes: Number(values.buffer_time_minutes),
    price: Number(values.price),
    deposit_amount: Number(values.deposit_amount),
    color_code: values.color_code,
    is_active: values.is_active,
  };
}

function toServiceUpdate(values: ServiceFormValues): ServiceUpdate {
  return {
    title: values.title.trim(),
    service_code: values.service_code.trim() || null,
    description: values.description.trim() || null,
    duration_minutes: Number(values.duration_minutes),
    buffer_time_minutes: Number(values.buffer_time_minutes),
    price: Number(values.price),
    deposit_amount: Number(values.deposit_amount),
    color_code: values.color_code,
    is_active: values.is_active,
  };
}

function getServiceErrorMessage(error: unknown, isEdit: boolean): string {
  const message = getErrorMessage(error).toLowerCase();

  if (message.includes('duplicate') || message.includes('unique')) {
    return 'קוד השירות כבר קיים בעסק.';
  }

  if (
    message.includes('row-level security') ||
    message.includes('permission denied')
  ) {
    return isEdit
      ? 'אין לך הרשאה לעדכן שירותים בעסק.'
      : 'אין לך הרשאה להוסיף שירותים לעסק.';
  }

  return isEdit
    ? 'לא ניתן לשמור את השירות. בדוק את הפרטים ונסה שוב.'
    : 'לא ניתן להוסיף את השירות. בדוק את הפרטים ונסה שוב.';
}

export default function AddServiceModal({
  businessCode,
  service = null,
  onClose,
  onSuccess,
}: AddServiceModalProps) {
  const isEdit = service !== null;
  const [formData, setFormData] = useState<ServiceFormValues>(() =>
    toFormValues(service),
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleInputRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSaving) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSaving, onClose]);

  const handleChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateService(formData);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsSaving(true);
    setErrorMessage('');

    try {
      if (isEdit && service) {
        await updateService(businessCode, service.id, toServiceUpdate(formData));
      } else {
        await createService(toServiceInsert(businessCode, formData));
      }
      await onSuccess();
    } catch (error) {
      console.error('שגיאה בשמירת שירות:', getErrorMessage(error));
      setErrorMessage(getServiceErrorMessage(error, isEdit));
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
        aria-labelledby="service-modal-title"
      >
        <h2 id="service-modal-title" className={styles.title}>
          {isEdit ? 'עריכת שירות' : 'הוספת שירות חדש'}
        </h2>

        {errorMessage && (
          <div className={styles.error} role="alert">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label htmlFor="service-title">שם השירות *</label>
              <input
                ref={titleInputRef}
                id="service-title"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={styles.input}
                maxLength={120}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="service-code">קוד שירות</label>
              <input
                id="service-code"
                name="service_code"
                value={formData.service_code}
                onChange={handleChange}
                className={styles.input}
                dir="ltr"
                maxLength={50}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="service-duration">משך בדקות *</label>
              <input
                id="service-duration"
                type="number"
                name="duration_minutes"
                value={formData.duration_minutes}
                onChange={handleChange}
                className={styles.input}
                min="1"
                step="1"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="service-buffer">זמן חיץ בדקות</label>
              <input
                id="service-buffer"
                type="number"
                name="buffer_time_minutes"
                value={formData.buffer_time_minutes}
                onChange={handleChange}
                className={styles.input}
                min="0"
                step="1"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="service-price">מחיר (₪) *</label>
              <input
                id="service-price"
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                className={styles.input}
                min="0"
                step="0.01"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="service-deposit">פיקדון (₪)</label>
              <input
                id="service-deposit"
                type="number"
                name="deposit_amount"
                value={formData.deposit_amount}
                onChange={handleChange}
                className={styles.input}
                min="0"
                step="0.01"
              />
            </div>

            <div className={`${styles.formGroup} ${styles.fullWidth}`}>
              <label htmlFor="service-description">תיאור</label>
              <textarea
                id="service-description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                className={styles.textarea}
                rows={3}
                maxLength={500}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="service-color">צבע ביומן</label>
              <div className={styles.colorInput}>
                <input
                  id="service-color"
                  type="color"
                  name="color_code"
                  value={formData.color_code}
                  onChange={handleChange}
                />
                <input
                  aria-label="קוד צבע"
                  name="color_code"
                  value={formData.color_code}
                  onChange={handleChange}
                  className={styles.input}
                  dir="ltr"
                  maxLength={7}
                />
              </div>
            </div>

            <label className={styles.checkboxGroup}>
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(event) =>
                  setFormData((previous) => ({
                    ...previous,
                    is_active: event.target.checked,
                  }))
                }
              />
              שירות פעיל
            </label>
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
              {isSaving ? 'שומר...' : isEdit ? 'שמור שינויים' : 'הוסף שירות'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
