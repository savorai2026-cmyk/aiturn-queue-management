import { useRef, useState } from 'react';
import AddAppointmentModal from './components/AddAppointmentModal';
import CalendarView, {
  type CalendarViewHandle,
} from './components/CalendarView';
import { SidePanel } from './components/SidePanel';
import { updateAppointment } from './appointments.api';
import { toAppointmentUpdate } from './appointments.mappers';
import type {
  AppointmentDetails,
  AppointmentEditValues,
} from './appointments.types';

interface AppointmentsPageProps {
  businessCode: string;
}

/**
 * Coordinates the calendar, selected appointment and appointment modals.
 * Keeping this workflow inside the feature prevents the application shell
 * from depending on appointment-specific state.
 */
export default function AppointmentsPage({
  businessCode,
}: AppointmentsPageProps) {
  const [selectedAppointment, setSelectedAppointment] =
    useState<AppointmentDetails | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const calendarRef = useRef<CalendarViewHandle | null>(null);

  const refreshCalendar = () => {
    calendarRef.current?.refreshCalendar();
  };

  const handleUpdateAppointment = async (values: AppointmentEditValues) => {
    if (!selectedAppointment) {
      throw new Error('No appointment is selected');
    }

    const update = toAppointmentUpdate(values);
    await updateAppointment(businessCode, selectedAppointment.id, update);

    setSelectedAppointment((current) =>
      current
        ? {
            ...current,
            ...update,
            time: values.start_time,
            notes: values.client_notes || null,
          }
        : current,
    );
    refreshCalendar();
  };

  return (
    <>
      <aside className="side-panel-wrapper">
        <SidePanel
          appointment={selectedAppointment}
          onUpdate={handleUpdateAppointment}
        />
      </aside>

      <main className="calendar-area">
        <CalendarView
          ref={calendarRef}
          businessCode={businessCode}
          onAddAppointment={() => setIsAddModalOpen(true)}
          onEventClick={setSelectedAppointment}
        />
      </main>

      {isAddModalOpen && (
        <AddAppointmentModal
          businessCode={businessCode}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            refreshCalendar();
          }}
        />
      )}
    </>
  );
}
