import { useEffect, useMemo, useState } from 'react';
import {
  readCalendarLocation,
  writeCalendarLocation,
} from '../../app/uiLocation';
import AddAppointmentModal from './components/AddAppointmentModal';
import CalendarView, {
  type AppointmentDropRequest,
} from './components/CalendarView';
import EditAppointmentModal from './components/EditAppointmentModal';
import RescheduleConfirmModal from './components/RescheduleConfirmModal';
import { SidePanel } from './components/SidePanel';
import {
  updateAppointment,
  updateAppointmentServicePrices,
} from './appointments.api';
import {
  changedAppointmentFields,
  toAppointmentDetails,
  toAppointmentEditValues,
  toAppointmentUpdate,
} from './appointments.mappers';
import { isCanceledStatus } from './appointmentStatuses';
import { pickDefaultAppointment } from './pickDefaultAppointment';
import { useUiPreferences } from '../../shared/displayFields/useUiPreferences';
import {
  shiftedAppointmentTimes,
  formatHebrewDateTime,
  formatTimeHm,
  nowInTimeZone,
  toDateKey,
  toSchedulerDateTime,
} from './time';
import { cancelAppointment, rescheduleAppointment } from './scheduler.api';
import { useAppointments, useCalendarSettings } from './useAppointments';
import { canEditRecords, useBusiness } from '../business/BusinessContextState';
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

function getDropDeltaMinutes(drop: AppointmentDropRequest) {
  return Math.round(
    (drop.nextStart.getTime() - drop.previousStart.getTime()) / 60000,
  );
}

function toMovedEditValues(
  appointment: AppointmentDetails,
  drop: AppointmentDropRequest,
): AppointmentEditValues {
  const nextTimes = shiftedAppointmentTimes(
    appointment.appointment_date,
    appointment.start_time,
    appointment.end_time,
    getDropDeltaMinutes(drop),
  );

  return {
    ...toAppointmentEditValues(appointment),
    appointment_date: nextTimes.appointment_date,
    start_time: formatTimeHm(nextTimes.start_time),
    end_time: formatTimeHm(nextTimes.end_time),
  };
}

export default function AppointmentsPage({
  businessCode,
}: AppointmentsPageProps) {
  const { appointments, statuses, events, error, isLoading, refresh } =
    useAppointments(businessCode);
  const calendarSettings = useCalendarSettings(businessCode);
  const timezone = calendarSettings.data.timezone;
  const { activeBusiness } = useBusiness();
  const canEdit = canEditRecords(activeBusiness?.role);
  const { visibleFieldsFor, toggleField } = useUiPreferences(businessCode);
  const [selectedId, setSelectedId] = useState<number | null>(
    () => readCalendarLocation(businessCode)?.selectedId ?? null,
  );
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    () => readCalendarLocation(businessCode)?.selectedServiceId ?? null,
  );
  const [selectedDate, setSelectedDate] = useState<string | null>(
    () => readCalendarLocation(businessCode)?.selectedDate ?? null,
  );
  const [draftStartTime, setDraftStartTime] = useState<string | null>(null);
  const [pendingDrop, setPendingDrop] = useState<AppointmentDropRequest | null>(
    null,
  );
  const [isDropEditOpen, setIsDropEditOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const actionError = calendarSettings.error
    ? `${calendarSettings.error} היומן מוצג בלי שעות פעילות.`
    : '';
  const [dropError, setDropError] = useState('');

  useEffect(() => {
    writeCalendarLocation(businessCode, {
      selectedDate,
      selectedId,
      selectedServiceId,
    });
  }, [businessCode, selectedDate, selectedId, selectedServiceId]);

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

  const displayedAppointment =
    selectedAppointment ??
    (isLoading ? null : pickDefaultAppointment(appointmentDetails, nowInTimeZone(timezone)));
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
    setIsBusy(true);
    try {
      await work();
    } finally {
      setIsBusy(false);
    }
  };

  /**
   * The scheduler moves or cancels through the bot so the customer hears about it.
   * The business may override the bot's slot rules, so a scheduler refusal falls
   * back to the direct update below.
   */
  const syncWithScheduler = async (
    appointment: AppointmentDetails,
    baseline: AppointmentEditValues,
    values: AppointmentEditValues,
    serviceId: number,
  ): Promise<'moved' | 'none'> => {
    if (!appointment.clientPhone) return 'none';
    const previousTime = toSchedulerDateTime(baseline.appointment_date, baseline.start_time);
    const nextTime = toSchedulerDateTime(values.appointment_date, values.start_time);
    try {
      if (isCanceledStatus(values.status) && !isCanceledStatus(baseline.status)) {
        await cancelAppointment({
          businessCode,
          clientPhone: appointment.clientPhone,
          appointmentTime: previousTime,
        });
      } else if (previousTime !== nextTime) {
        await rescheduleAppointment({
          businessCode,
          clientPhone: appointment.clientPhone,
          serviceId,
          currentAppointmentTime: previousTime,
          newAppointmentTime: nextTime,
        });
        return 'moved';
      }
    } catch (error) {
      console.warn('Scheduler sync failed, saving directly:', getErrorMessage(error));
    }
    return 'none';
  };

  const saveAppointmentEdits = async (
    appointment: AppointmentDetails,
    values: AppointmentEditValues,
    serviceId: number,
  ) => {
    const baseline = toAppointmentEditValues(appointment);
    const synced = await syncWithScheduler(appointment, baseline, values, serviceId);

    const changes = changedAppointmentFields(baseline, values);
    if (synced === 'moved') {
      const { appointment_date, start_time, end_time, status } = toAppointmentUpdate(values);
      Object.assign(changes, { appointment_date, start_time, end_time, status });
    }
    if (Object.keys(changes).length > 0) {
      await updateAppointment(businessCode, appointment.id, changes);
    }

    const pricesChanged = values.servicePrices.some(
      (service, index) => service.price !== baseline.servicePrices[index]?.price,
    );
    if (pricesChanged) {
      await updateAppointmentServicePrices(
        businessCode,
        appointment.id,
        values.servicePrices,
      );
    }
  };

  const handleSave = async (values: AppointmentEditValues) => {
    if (!displayedAppointment) return;
    const appointment = displayedAppointment;

    await runBusy(async () => {
      await saveAppointmentEdits(
        appointment,
        values,
        appointment.services[0]?.serviceId ?? 0,
      );
      refresh();
    });
  };

  const closePendingDrop = (shouldRevert: boolean) => {
    if (shouldRevert) {
      pendingDrop?.revert();
    }
    setPendingDrop(null);
    setIsDropEditOpen(false);
    setDropError('');
  };

  const persistReschedule = async (values?: AppointmentEditValues) => {
    if (!pendingDrop || !pendingAppointment) {
      return;
    }

    const target = values ?? toMovedEditValues(pendingAppointment, pendingDrop);
    const savedDate = target.appointment_date;

    setDropError('');
    setIsBusy(true);

    try {
      await saveAppointmentEdits(pendingAppointment, target, pendingDrop.serviceId);

      setSelectedId(pendingAppointment.id);
      setSelectedServiceId(pendingDrop.serviceId);
      setSelectedDate(savedDate);
      setPendingDrop(null);
      setIsDropEditOpen(false);
      refresh();
    } catch (error) {
      setDropError(getAppointmentSaveErrorMessage(error));
      throw error;
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
          readOnly={!canEdit}
          visibleFields={visibleFieldsFor('appointments')}
          onToggleField={(key) => toggleField('appointments', key)}
          onSave={handleSave}
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
            businessCode={businessCode}
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
              setDraftStartTime(null);
            }}
            onSelectDate={setSelectedDate}
            onSelectTime={setDraftStartTime}
            selectedAppointmentId={displayedAppointment?.id ?? null}
            selectedServiceId={displayedServiceId}
            selectedDate={displayedDate}
            hasPendingMove={pendingDrop !== null}
            onDropRequest={(request) => {
              setDropError('');
              setIsDropEditOpen(false);
              setPendingDrop(request);
              setSelectedId(request.appointmentId);
              setSelectedServiceId(request.serviceId);
              setSelectedDate(toDateKey(request.nextStart));
            }}
            isBlocked={isBusy && pendingDrop === null}
            workingHours={calendarSettings.data.workingHours}
            slotDurationMinutes={calendarSettings.data.slotDurationMinutes}
            maxAdvBookingDays={calendarSettings.data.maxAdvBookingDays}
            timezone={timezone}
            canEdit={canEdit}
          />
        </div>
      </main>

      {pendingDrop && pendingAppointment && !isDropEditOpen && (
        <RescheduleConfirmModal
          preview={{
            clientName: pendingAppointment.patientName,
            serviceTitle: pendingService?.title ?? '',
            fromLabel: formatMoveRange(
              pendingDrop.previousStart,
              pendingDrop.previousEnd,
            ),
            toLabel: formatMoveRange(pendingDrop.nextStart, pendingDrop.nextEnd),
            movesAllServices: (pendingAppointment.services.length ?? 0) > 1,
            isPastTarget:
              pendingDrop.nextStart.getTime() < nowInTimeZone(timezone).getTime(),
          }}
          isSaving={isBusy}
          errorMessage={dropError}
          onConfirm={() => {
            void persistReschedule().catch(() => undefined);
          }}
          onCancel={() => closePendingDrop(true)}
          onEdit={() => {
            setDropError('');
            setIsDropEditOpen(true);
          }}
        />
      )}

      {pendingDrop && pendingAppointment && isDropEditOpen && (
        <EditAppointmentModal
          key={`${pendingAppointment.id}-${pendingDrop.nextStart.toISOString()}`}
          appointment={pendingAppointment}
          initialValues={toMovedEditValues(pendingAppointment, pendingDrop)}
          statuses={statuses}
          isSaving={isBusy}
          errorMessage={dropError}
          onSave={(values) => persistReschedule(values)}
          onClose={() => {
            if (!isBusy) {
              setIsDropEditOpen(false);
            }
          }}
        />
      )}

      {canEdit && isAddModalOpen && (
        <AddAppointmentModal
          businessCode={businessCode}
          statuses={statuses}
          initialDate={displayedDate}
          initialTime={draftStartTime}
          maxAdvBookingDays={calendarSettings.data.maxAdvBookingDays}
          timezone={timezone}
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
