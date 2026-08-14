import { useState, type FormEvent } from 'react';
import { useBusiness } from './BusinessContextState';
import styles from './BusinessOnboarding.module.css';

export default function BusinessOnboarding() {
  const { createBusiness, isCreating, error } = useBusiness();
  const [businessName, setBusinessName] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!businessName.trim()) return;

    await createBusiness({ businessName, contactPhone });
  };

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <div className={styles.brand}>Featurn</div>
        <h1 className={styles.title}>הקמת העסק שלך</h1>
        <p className={styles.description}>
          עוד רגע מתחילים. הזן את פרטי העסק הראשוניים; ניתן יהיה להשלים
          ולשנות אותם בהגדרות.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <label className={styles.field}>
            <span>שם העסק</span>
            <input
              type="text"
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              required
              autoFocus
              autoComplete="organization"
              placeholder="לדוגמה: מרפאת ד״ר ישראלי"
            />
          </label>

          <label className={styles.field}>
            <span>טלפון ליצירת קשר</span>
            <input
              type="tel"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
              autoComplete="tel"
              dir="ltr"
              placeholder="050-0000000"
            />
          </label>

          <button
            type="submit"
            className={styles.submit}
            disabled={isCreating || !businessName.trim()}
          >
            {isCreating ? 'מקים את העסק...' : 'המשך למערכת'}
          </button>
        </form>
      </section>
    </main>
  );
}
