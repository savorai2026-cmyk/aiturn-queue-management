import { forwardRef, useImperativeHandle } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import heLocale from '@fullcalendar/core/locales/he';
import { toAppointmentDetails } from '../appointments.mappers';
import { useAppointments } from '../useAppointments';
import type { AppointmentDetails } from '../appointments.types';
import {
  ErrorState,
  LoadingState,
} from '../../../shared/components/PageState';
import styles from './CalendarView.module.css';

interface CalendarViewProps {
  onAddAppointment: () => void;
  businessCode: string;
  onEventClick: (appointment: AppointmentDetails) => void;
}

export interface CalendarViewHandle {
  refreshCalendar: () => void;
}

const CalendarView = forwardRef<CalendarViewHandle, CalendarViewProps>(({
  onAddAppointment,
  businessCode,
  onEventClick,
}, ref) => {
  const { appointments, events, error, isLoading, refresh } =
    useAppointments(businessCode);

  useImperativeHandle(ref, () => ({
    refreshCalendar: refresh,
  }), [refresh]);

  if (isLoading) {
    return <LoadingState message="טוען תורים..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={refresh} />;
  }

  return (
    <div className={styles.calendarContainer}>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="timeGridWeek"
        locale={heLocale}
        
        customButtons={{
          newAppointmentBtn: {
            text: '➕ תור חדש',
            click: onAddAppointment
          }
        }}
        
        headerToolbar={{
          left: 'newAppointmentBtn prev,next today',
          center: 'title',
          right: 'dayGridMonth,timeGridWeek,timeGridDay'
        }}
        
        events={events}
        height="100%"
        direction="rtl"
        slotMinTime="08:00:00"
        slotMaxTime="20:00:00"
        
        eventClick={(clickInfo) => {
          clickInfo.jsEvent.preventDefault();
          const appointment = appointments.find(
            (candidate) => String(candidate.id) === clickInfo.event.id,
          );

          if (appointment) {
            onEventClick(toAppointmentDetails(appointment));
          }
        }}
      />
    </div>
  );
});

export default CalendarView;