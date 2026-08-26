import { useCallback, useMemo, useState } from 'react';
import AddAppointmentModal from './components/AddAppointmentModal';
import CalendarView, {
  type AppointmentDropRequest,
} from './components/CalendarView';
import RescheduleConfirmModal from './components/RescheduleConfirmModal';
import { SidePanel } from './components/SidePanel';
import {
  updateAppointment,
  updateAppointmentServicePrices,
} from './appointments.api';
import {
  toAppointmentDetails,
  toAppointmentUpdate,
} from './appointments.mappers';
import { pickDefaultAppointment } from './pickDefaultAppointment';
import { useUiPreferences } from '../../shared/displayFields/useUiPreferences';
import {
  shiftedAppointmentTimes,
  formatHebrewDateTime,
  toDateKey,
  toLocalDateTime,
  toSchedulerDateTime,
} from './time';
import {
  cancelAppointment,
  rescheduleAppointment,
} from './scheduler.api';
import { useAppointments, useCalendarSettings } from './useAppointments';
import { getAppointmentSaveErrorMessage, getErrorMessage } from '../../shared/errors';
import type {
  AppointmentDetails,
  AppointmentEditValues,
} from './appointments.types';

interface AppointmentsPageProps {
  businessCode: string;
}

function formatMoveRange(start: Date, end: Date | null) {
  const startLabel = formatHebrewDateTime(start);
  if (!end) {
    return startLabel;
  }

  const endTime = new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(end);

  if (toDateKey(start) !== toDateKey(end)) {
    return `${startLabel} – ${formatHebrewDateTime(end)}`;
  }

  return `${startLabel} – ${endTime}`;
}

export default function AppointmentsPage({
  businessCode,
}: AppointmentsPageProps) {
  const { appointments, statuses, events, error, isLoading, refresh } =
    useAppointments(businessCode);
  const calendarSettings = useCalendarSettings(businessCode);
  const { visibleFieldsFor, toggleField } = useUiPreferences(businessCode);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    null,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<AppointmentDropRequest | null>(
    null,
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState('');
  const [dropError, setDropError] = useState('');

  const appointmentDetails = useMemo(
    () => appointments.map(toAppointmentDetails),
    [appointments],
  );

  const selectedAppointment = useMemo(
    () =>
      appointmentDetails.find((appointment) => appointment.id === selectedId) ??
      null,
    [appointmentDetails, selectedId],
  );

  const applySelection = useCallback((appointment: AppointmentDetails | null) => {
    setSelectedId(appointment?.id ?? null);
    setSelectedServiceId(appointment?.services[0]?.serviceId ?? null);
    setSelectedDate(appointment?.appointment_date ?? null);
  }, []);

  const displayedAppointment =
    selectedAppointment ??
    (isLoading ? null : pickDefaultAppointment(appointmentDetails));
  const displayedServiceId = selectedAppointment
    ? selectedServiceId
    : displayedAppointment?.services[0]?.serviceId ?? null;
  const displayedDate =
    selectedDate ?? displayedAppointment?.appointment_date ?? null;

  const pendingAppointment = appointmentDetails.find(
    (appointment) => appointment.id === pendingDrop?.appointmentId,
  );
  const pendingService = pendingAppointment?.services.find(
    (service) => service.serviceId === pendingDrop?.serviceId,
  );

  const runBusy = async (work: () => Promise<void>) => {
    setActionError('');
    setIsBusy(true);
    try {
      await work();
    } finally {
      setIsBusy(false);
    }
  };

  const handleSave = async (values: AppointmentEditValues) => {
    if (!displayedAppointment) {
      throw new Error('No appointment is selected');
    }

    const movedTimes =
      pendingDrop && pendingDrop.appointmentId === displayedAppointment.id
        ? shiftedAppointmentTimes(
            displayedAppointment.appointment_date,
            displayedAppointment.start_time,
            displayedAppointment.end_time,
            Math.round(
              (pendingDrop.nextStart.getTime() -
                pendingDrop.previousStart.getTime()) /
                60000,
            ),
          )
        : null;

    await runBusy(async () => {
      await updateAppointment(
        businessCode,
        displayedAppointment.id,
        toAppointmentUpdate({
          ...values,
          appointment_date:
            movedTimes?.appointment_date ?? values.appointment_date,
          start_time: movedTimes?.start_time ?? values.start_time,
          end_time: movedTimes?.end_time ?? values.end_time,
        }),
      );

      if (values.servicePrices.length > 0) {
        try {
          await updateAppointmentServicePrices(
            businessCode,
            displayedAppointment.id,
            values.servicePrices,
          );
        } catch (error) {
          console.error(
            'שגיאה בעדכון מחירי שירותים:',
            getErrorMessage(error),
          );
        }
      }

      if (pendingDrop?.appointmentId === displayedAppointment.id) {
        setPendingDrop(null);
        setDropError('');
      }

      refresh();
    });
  };

  const handleCancelAppointment = async () => {
    if (!displayedAppointment?.clientPhone) {
      throw new Error('חסר מספר טלפון ללקוח');
    }

    await runBusy(async () => {
      await cancelAppointment({
        businessCode,
        clientPhone: displayedAppointment.clientPhone as string,
        appointmentTime: toSchedulerDateTime(
          displayedAppointment.appointment_date,
          displayedAppointment.start_time,
        ),
      });
      applySelection(
        pickDefaultAppointment(
          appointmentDetails.filter(
            (appointment) => appointment.id !== displayedAppointment.id,
          ),
        ),
      );
      refresh();
    });
  };

  const closePendingDrop = (shouldRevert: boolean) => {
    if (shouldRevert) {
      pendingDrop?.revert();
    }
    setPendingDrop(null);
    setDropError('');
  };

  const handleConfirmDrop = async () => {
    if (!pendingDrop || !pendingAppointment) {
      return;
    }

    const nextTimes = shiftedAppointmentTimes(
      pendingAppointment.appointment_date,
      pendingAppointment.start_time,
      pendingAppointment.end_time,
      Math.round(
        (pendingDrop.nextStart.getTime() - pendingDrop.previousStart.getTime()) /
          60000,
      ),
    );

    setDropError('');
    setIsBusy(true);

    try {
      await updateAppointment(businessCode, pendingAppointment.id, nextTimes);

      if (pendingDrop.clientPhone) {
        try {
          await rescheduleAppointment({
            businessCode,
            clientPhone: pendingDrop.clientPhone,
            serviceId: pendingDrop.serviceId,
            currentAppointmentTime: toLocalDateTime(pendingDrop.previousStart),
            newAppointmentTime: toLocalDateTime(pendingDrop.nextStart),
          });
        } catch (error) {
          console.error('Scheduler reschedule failed:', getErrorMessage(error));
        }
      }

      setSelectedId(pendingAppointment.id);
      setSelectedServiceId(pendingDrop.serviceId);
      setSelectedDate(nextTimes.appointment_date);
      setPendingDrop(null);
      refresh();
    } catch (error) {
      setDropError(getAppointmentSaveErrorMessage(error));
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <>
      <aside className="side-panel-wrapper">
        <SidePanel
          key={`${displayedAppointment?.id ?? 'empty'}-${displayedAppointment?.appointment_date ?? ''}-${displayedAppointment?.start_time ?? ''}`}
          appointment={displayedAppointment}
          statuses={statuses}
          isBusy={isBusy}
          visibleFields={visibleFieldsFor('appointments')}
          onToggleField={(key) => toggleField('appointments', key)}
          onMoveOptions={() => undefined}
          onSave={handleSave}
          onCancelAppointment={handleCancelAppointment}
        />
      </aside>

      <main className="calendar-area">
        {actionError && (
          <div className="appointments-action-error" role="alert">
            {actionError}
          </div>
        )}
        <div className="calendar-stage">
          <CalendarView
            events={events}
            appointments={appointmentDetails}
            isLoading={isLoading}
            error={error}
            onRetry={refresh}
            onAddAppointment={() => setIsAddModalOpen(true)}
            onEventClick={(appointment, serviceId) => {
              setSelectedId(appointment.id);
              setSelectedServiceId(serviceId);
              setSelectedDate(appointment.appointment_date);
              setActionError('');
            }}
            onSelectDate={setSelectedDate}
            selectedAppointmentId={displayedAppointment?.id ?? null}
            selectedServiceId={displayedServiceId}
            selectedDate={displayedDate}
            hasPendingMove={pendingDrop !== null}
            onDropRequest={(request) => {
              setActionError('');
              setDropError('');
              setPendingDrop(request);
              setSelectedId(request.appointmentId);
              setSelectedServiceId(request.serviceId);
              setSelectedDate(toDateKey(request.nextStart));
            }}
            isBlocked={isBusy && pendingDrop === null}
            workingHours={calendarSettings.data.workingHours}
            slotDurationMinutes={calendarSettings.data.slotDurationMinutes}
          />
        </div>
      </main>

      {pendingDrop && pendingAppointment && (
        <RescheduleConfirmModal
          preview={{
            clientName: pendingAppointment.patientName,
            serviceTitle: pendingService?.title ?? 'שירות',
            fromLabel: formatMoveRange(
              pendingDrop.previousStart,
              pendingDrop.previousEnd,
            ),
            toLabel: formatMoveRange(pendingDrop.nextStart, pendingDrop.nextEnd),
            movesAllServices: (pendingAppointment.services.length ?? 0) > 1,
          }}
          isSaving={isBusy}
          errorMessage={dropError}
          onConfirm={() => {
            void handleConfirmDrop();
          }}
          onCancel={() => closePendingDrop(true)}
        />
      )}

      {isAddModalOpen && (
        <AddAppointmentModal
          businessCode={businessCode}
          statuses={statuses}
          onClose={() => setIsAddModalOpen(false)}
          onSuccess={() => {
            setIsAddModalOpen(false);
            refresh();
          }}
        />
      )}
    </>
  );
}
