import { useLayoutEffect, useRef } from 'react';
import { APPOINTMENT_FIELDS } from '../../../shared/displayFields/catalogs';
import {
  getStatusColor,
  getStatusLabel,
  type StatusCatalogItem,
} from '../appointmentStatuses';
import { formatAppointmentField } from '../appointments.mappers';
import { readPaymentHold } from '../paymentHold';
import type { AppointmentDetails } from '../appointments.types';
import styles from './AppointmentHoverCard.module.css';

export interface HoverAnchor {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

interface AppointmentHoverCardProps {
  appointment: AppointmentDetails;
  statuses: StatusCatalogItem[];
  visibleFields: string[];
  anchor: HoverAnchor;
}

export default function AppointmentHoverCard({
  appointment,
  statuses,
  visibleFields,
  anchor,
}: AppointmentHoverCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const hold = readPaymentHold(appointment.status, appointment.metadata);
  const showStatus = visibleFields.includes('status');
  const rows = APPOINTMENT_FIELDS.filter((field) => {
    if (field.key === 'patientName' || field.key === 'status') return false;
    if (!visibleFields.includes(field.key)) return false;
    return formatAppointmentField(appointment, field.key, statuses).trim().length > 0;
  });

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const gap = 10;
    const margin = 8;
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    let left = anchor.left - width - gap;
    if (left < margin) left = anchor.right + gap;
    if (left + width > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - width - margin);
    }
    let top = Math.min(anchor.top, window.innerHeight - height - margin);
    if (top < margin) top = margin;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
    card.style.visibility = 'visible';
  }, [anchor.bottom, anchor.left, anchor.right, anchor.top, appointment.id, rows.length, showStatus]);

  return (
    <aside ref={cardRef} className={styles.card} role="tooltip" style={{ visibility: 'hidden' }}>
      <header className={styles.header}>
        <span className={styles.name}>{appointment.patientName}</span>
        {showStatus ? (
          <span
            className={styles.status}
            style={{ background: getStatusColor(appointment.status, statuses) }}
          >
            {getStatusLabel(appointment.status, statuses)}
          </span>
        ) : null}
      </header>
      {hold ? <p className={styles.hold}>{hold.label}</p> : null}
      {rows.length > 0 ? (
        <dl className={styles.list}>
          {rows.map((field) => (
            <div key={field.key} className={styles.row}>
              <dt>{field.label}</dt>
              <dd dir={field.dir}>
                {formatAppointmentField(appointment, field.key, statuses)}
              </dd>
            </div>
          ))}
        </dl>
      ) : null}
    </aside>
  );
}
