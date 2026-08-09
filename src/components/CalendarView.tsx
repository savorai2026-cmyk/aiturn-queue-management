import { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import heLocale from '@fullcalendar/core/locales/he';
import { supabase } from '../supabaseClient';
import styles from './CalendarView.module.css';

// הגדרת הפרמטרים שהרכיב מקבל
interface CalendarViewProps {
  onAddAppointment: () => void;
  user: any;
  onEventClick: (appointment: any) => void;
}

const CalendarView = forwardRef(({ onAddAppointment, user, onEventClick }: CalendarViewProps, ref) => {
  const [events, setEvents] = useState<any[]>([]);

  useImperativeHandle(ref, () => ({
    refreshCalendar: () => fetchAppointments()
  }));

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        start_time,
        end_time,
        status,
        client_notes,
        clients ( full_name, mobile_phone )
      `)
      .eq('business_code', user.id);

    if (error) {
      console.error('Error fetching appointments:', error.message);
      return;
    }

    const formattedEvents = data.map((apt: any) => {
      let color = '#3498db'; 
      if (apt.status === 'scheduled') color = '#1abc9c';
      if (apt.status === 'canceled') color = '#e74c3c';
      if (apt.status === 'completed') color = '#95a5a6';

      const startDateTime = `${apt.appointment_date}T${apt.start_time}`;
      const endDateTime = `${apt.appointment_date}T${apt.end_time}`;
      const clientName = apt.clients?.full_name || 'לקוח לא ידוע';

      return {
        id: apt.id,
        title: clientName,
        start: startDateTime,
        end: endDateTime,
        backgroundColor: color,
        borderColor: color,
        extendedProps: { ...apt }
      };
    });

    setEvents(formattedEvents);
  };

  return (
    <div className={styles.calendarContainer}>
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin] as any}
        initialView="timeGridWeek"
        locale={heLocale as any}
        
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
          // מניעת התנהגות ברירת מחדל של הספרייה (למשל ניתוב URL אם קיים)
          clickInfo.jsEvent.preventDefault();
          
          // שליפת הנתונים המקוריים ששמרנו תחת extendedProps
          const aptData = clickInfo.event.extendedProps;
          
          // בניית האובייקט בדיוק במבנה שה-SidePanel והמודל מצפים לקבל
          const appointmentDetails = {
            id: aptData.id,
            patientName: clickInfo.event.title, // השם כבר נשמר ב-title
            time: aptData.start_time,
            status: aptData.status,
            notes: aptData.client_notes,
            ...aptData // מעביר את שאר השדות מה-DB לכל מקרה
          };

          // זריקת האירוע החוצה אל ה-Dashboard
          onEventClick(appointmentDetails);
        }}
      />
    </div>
  );
}); // <-- חסרו כאן סוגריים מסיימים לקומפוננטה (תואם לשורה 16 בקוד שלך)

export default CalendarView;