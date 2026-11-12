import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  readCalendarLocation,
  writeCalendarLocation,
} from '../../app/uiLocation';
import { useCalendarWriteLock } from '../billing/usePaymentMethod';
import AddAppointmentModal from './components/AddAppointmentModal';
import AppointmentContextMenu from './components/AppointmentContextMenu';
import CalendarView, {
  type AppointmentDropRequest,
} from './components/CalendarView';
import EditAppointmentModal from './components/EditAppointmentModal';
import MoveAppointmentModal from './components/MoveAppointmentModal';
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
import { combinedAppointmentChain } from './calendarGrouping';
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
import {
  BanIcon,
  CalendarIcon,
  CheckIcon,
  MoveIcon,
  PencilIcon,
} from '../../shared/components/icons';
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

function dateAt(dateKey: string, time: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  return new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
}

function isApprovedStatus(status: string) {
  return status === '02' || status === 'scheduled';
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
  const calendarLocked = useCalendarWriteLock(businessCode);
  const canEdit = canEditRecords(activeBusiness?.role) && !calendarLocked;
  const { visibleFieldsFor, toggleField } = useUiPreferences(businessCode);
  const [selectedId, setSelectedId] = useState<number | null>(
    () => readCalendarLocation(businessCode)?.selectedId ?? null,
  );
  const [selectedServiceId, setSelectedServiceId] = useState<number | null>(
    () => readCalendarLocation(businessCode)?.selectedServiceId ?? null,
  );
  const [panelDismissed, setPanelDismissed] = useState(false);
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
  const [editToken, setEditToken] = useState(0);
  const [moveRequest, setMoveRequest] = useState<{
    appointmentId: number;
    serviceId: number;
  } | null>(null);
  const [menu, setMenu] = useState<{
    appointmentId: number;
    serviceId: number;
    x: number;
    y: number;
  } | null>(null);
  const [slotMenu, setSlotMenu] = useState<{ x: number; y: number } | null>(null);

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
    (isLoading || panelDismissed
      ? null
      : pickDefaultAppointment(appointmentDetails, nowInTimeZone(timezone)));
  const displayedServiceId = selectedAppointment
    ? selectedServiceId
    : displayedAppointment?.services[0]?.serviceId ?? null;
  const displayedDate =
    selectedDate ?? displayedAppointment?.appointment_date ?? null;
  const displayedGroup = useMemo(
    () =>
      displayedAppointment
        ? combinedAppointmentChain(appointmentDetails, displayedAppointment.id)
        : [],
    [appointmentDetails, displayedAppointment],
  );
  const menuAppointment =
    appointmentDetails.find((appointment) => appointment.id === menu?.appointmentId) ??
    null;

  const pendingAppointment = appointmentDetails.find(
    (appointment) => appointment.id === pendingDrop?.appointmentId,
  );
  const moveAppointment = appointmentDetails.find(
    (appointment) => appointment.id === moveRequest?.appointmentId,
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

  const closePanel = () => {
    setPanelDismissed(true);
    setSelectedId(null);
    setSelectedServiceId(null);
    setEditToken(0);
  };

  const applyStatus = (appointment: AppointmentDetails, status: string) => {
    const values = { ...toAppointmentEditValues(appointment), status };
    void runBusy(async () => {
      await saveAppointmentEdits(
        appointment,
        values,
        appointment.services[0]?.serviceId ?? 0,
      );
      refresh();
    });
  };

  const closeMenu = useCallback(() => setMenu(null), []);
  const closeSlotMenu = useCallback(() => setSlotMenu(null), []);

  const closePendingDrop = (shouldRevert: boolean) => {
    if (shouldRevert) {
      pendingDrop?.revert();
    }
    setPendingDrop(null);
    setIsDropEditOpen(false);
    setDropError('');
  };

  const persistReschedule = async (
    drop: AppointmentDropRequest,
    values?: AppointmentEditValues,
  ) => {
    const appointment = appointmentDetails.find(
      (item) => item.id === drop.appointmentId,
    );
    if (!appointment) {
      return;
    }

    const target = values ?? toMovedEditValues(appointment, drop);
    const savedDate = target.appointment_date;

    setDropError('');
    setIsBusy(true);

    try {
      await saveAppointmentEdits(appointment, target, drop.serviceId);

      const originalStart = dateAt(
        appointment.appointment_date,
        appointment.start_time,
      );
      const savedStart = dateAt(target.appointment_date, target.start_time);
      const deltaMinutes = Math.round(
        (savedStart.getTime() - originalStart.getTime()) / 60000,
      );
      for (const companionId of drop.companionAppointmentIds) {
        if (companionId === appointment.id || deltaMinutes === 0) continue;
        const companion = appointmentDetails.find((item) => item.id === companionId);
        if (!companion) continue;
        const shifted = shiftedAppointmentTimes(
          companion.appointment_date,
          companion.start_time,
          companion.end_time,
          deltaMinutes,
        );
        await saveAppointmentEdits(
          companion,
          {
            ...toAppointmentEditValues(companion),
            appointment_date: shifted.appointment_date,
            start_time: formatTimeHm(shifted.start_time),
            end_time: formatTimeHm(shifted.end_time),
          },
          companion.services[0]?.serviceId ?? 0,
        );
      }

      setSelectedId(appointment.id);
      setSelectedServiceId(drop.serviceId);
      setSelectedDate(savedDate);
      setPendingDrop(null);
      setIsDropEditOpen(false);
      setMoveRequest(null);
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
      {displayedAppointment ? (
        <aside className="side-panel-wrapper">
          <SidePanel
            key={`${displayedAppointment.id}-${displayedAppointment.appointment_date}-${displayedAppointment.start_time}`}
            appointment={displayedAppointment}
            statuses={statuses}
            isBusy={isBusy}
            readOnly={!canEdit}
            visibleFields={visibleFieldsFor('appointments')}
            onToggleField={(key) => toggleField('appointments', key)}
            onSave={handleSave}
            editToken={editToken}
            groupAppointments={displayedGroup}
            onClose={closePanel}
          />
        </aside>
      ) : null}

      <main className="calendar-area">
        {actionError && (
          <div className="appointments-action-error" role="alert">
            {actionError}
          </div>
        )}
        {calendarLocked ? (
          <div className="calendar-note" role="status">
            אין כרטיס אשראי פעיל. היומן זמין לצפייה בלבד עד שיוזן כרטיס אחר.
          </div>
        ) : null}
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
              setMenu(null);
              setSlotMenu(null);
              setEditToken(0);
              setSelectedId(appointment.id);
              setSelectedServiceId(serviceId);
              setSelectedDate(appointment.appointment_date);
              setDraftStartTime(null);
            }}
            onEventContextMenu={
              canEdit
                ? (appointmentId, serviceId, x, y) => {
                    setSlotMenu(null);
                    setMenu({ appointmentId, serviceId, x, y });
                  }
                : undefined
            }
            onSelectedSlotContextMenu={
              canEdit
                ? (x, y) => {
                    setMenu(null);
                    setSlotMenu({ x, y });
                  }
                : undefined
            }
            onBackgroundClick={() => {
              setMenu(null);
              setSlotMenu(null);
            }}
            onSelectDate={setSelectedDate}
            onSelectTime={setDraftStartTime}
            selectedTime={draftStartTime}
            selectedAppointmentId={selectedId}
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
            movesAllServices:
              (pendingAppointment.services.length ?? 0) > 1 ||
              pendingDrop.companionAppointmentIds.length > 0,
            isPastTarget:
              pendingDrop.nextStart.getTime() < nowInTimeZone(timezone).getTime(),
          }}
          isSaving={isBusy}
          errorMessage={dropError}
          onConfirm={() => {
            if (!pendingDrop) return;
            void persistReschedule(pendingDrop).catch(() => undefined);
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
          onSave={(values) => persistReschedule(pendingDrop, values)}
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

      {slotMenu && canEdit ? (
        <AppointmentContextMenu
          x={slotMenu.x}
          y={slotMenu.y}
          onClose={closeSlotMenu}
          actions={[
            {
              id: 'create',
              label: 'יצירת תור חדש',
              icon: <CalendarIcon />,
              onSelect: () => setIsAddModalOpen(true),
            },
          ]}
        />
      ) : null}

      {menu && menuAppointment ? (
        <AppointmentContextMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          actions={[
            {
              id: 'approve',
              label: 'אישור',
              icon: <CheckIcon />,
              disabled: isApprovedStatus(menuAppointment.status) || isCanceledStatus(menuAppointment.status),
              onSelect: () => applyStatus(menuAppointment, '02'),
            },
            {
              id: 'cancel',
              label: 'ביטול',
              icon: <BanIcon />,
              disabled: isCanceledStatus(menuAppointment.status),
              onSelect: () => applyStatus(menuAppointment, '10'),
            },
            {
              id: 'edit',
              label: 'עריכה',
              icon: <PencilIcon />,
              onSelect: () => {
                setSelectedId(menuAppointment.id);
                setSelectedServiceId(menu.serviceId);
                setSelectedDate(menuAppointment.appointment_date);
                setEditToken((current) => current + 1);
              },
            },
            {
              id: 'move',
              label: 'הזזה',
              icon: <MoveIcon />,
              disabled: isCanceledStatus(menuAppointment.status),
              onSelect: () => {
                setSelectedId(menuAppointment.id);
                setSelectedServiceId(menu.serviceId);
                setSelectedDate(menuAppointment.appointment_date);
                setMoveRequest({
                  appointmentId: menuAppointment.id,
                  serviceId: menu.serviceId,
                });
              },
            },
          ]}
        />
      ) : null}

      {moveRequest && moveAppointment ? (
        <MoveAppointmentModal
          appointment={moveAppointment}
          timezone={timezone}
          isSaving={isBusy}
          onClose={() => {
            if (!isBusy) setMoveRequest(null);
          }}
          onMove={async (times) => {
            const previousStart = dateAt(
              moveAppointment.appointment_date,
              moveAppointment.start_time,
            );
            const previousEnd = dateAt(
              moveAppointment.appointment_date,
              moveAppointment.end_time,
            );
            const nextStart = dateAt(times.appointment_date, times.start_time);
            const nextEnd = dateAt(times.appointment_date, times.end_time);
            await persistReschedule(
              {
                revert: () => undefined,
                appointmentId: moveAppointment.id,
                serviceId: moveRequest.serviceId,
                clientPhone: moveAppointment.clientPhone,
                companionAppointmentIds: [],
                previousStart,
                previousEnd,
                nextStart,
                nextEnd,
              },
              {
                ...toAppointmentEditValues(moveAppointment),
                appointment_date: times.appointment_date,
                start_time: times.start_time,
                end_time: times.end_time,
              },
            );
          }}
        />
      ) : null}
    </>
  );
}
