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
  type AppointmentResizeRequest,
} from './components/CalendarView';
import EditAppointmentModal from './components/EditAppointmentModal';
import MoveAppointmentModal from './components/MoveAppointmentModal';
import RescheduleConfirmModal from './components/RescheduleConfirmModal';
import { SidePanel } from './components/SidePanel';
import StretchContinuationPrompt from './components/StretchContinuationPrompt';
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
import { isCanceledStatus, statusAfterBusinessMove } from './appointmentStatuses';
import { combinedAppointmentChain } from './calendarGrouping';
import { getClient } from '../clients/clients.api';
import { toClientDetailSections } from '../clients/clients.mappers';
import type { Client } from '../clients/clients.types';
import RecordDetailsModal from '../../shared/displayFields/RecordDetailsModal';
import { useUiPreferences } from '../../shared/displayFields/useUiPreferences';
import {
  shiftedAppointmentTimes,
  formatTimeHm,
  nowInTimeZone,
  toDateKey,
  toSchedulerDateTime,
  toTimeHm,
} from './time';
import { cancelAppointment, rescheduleAppointment } from './scheduler.api';
import { useAppointments, useCalendarSettings } from './useAppointments';
import { canEditRecords, useBusiness } from '../business/BusinessContextState';
import { getAppointmentSaveErrorMessage, getErrorMessage } from '../../shared/errors';
import { useReportPageReady } from '../../shared/components/PageState';
import {
  BanIcon,
  CalendarIcon,
  CheckIcon,
  GlassesIcon,
  MoveIcon,
  PencilIcon,
  UserIcon,
} from '../../shared/components/icons';
import type {
  AppointmentDetails,
  AppointmentEditValues,
} from './appointments.types';

interface AppointmentsPageProps {
  businessCode: string;
  onReady?: () => void;
}

function formatMoveMoment(start: Date, end: Date | null) {
  const dateLabel = new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(start);
  const clock = new Intl.DateTimeFormat('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const startTime = clock.format(start);
  if (!end) {
    return { dateLabel, timeLabel: startTime };
  }

  const endTime = clock.format(end);
  if (toDateKey(start) === toDateKey(end)) {
    return { dateLabel, timeLabel: `${startTime}–${endTime}` };
  }

  const endDate = new Intl.DateTimeFormat('he-IL', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(end);
  return {
    dateLabel: `${dateLabel} עד ${endDate}`,
    timeLabel: `${startTime}–${endTime}`,
  };
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
  onReady,
}: AppointmentsPageProps) {
  const { appointments, statuses, events, error, isLoading, refresh } =
    useAppointments(businessCode);
  useReportPageReady(!isLoading || Boolean(error), onReady);
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
  const [detailsSession, setDetailsSession] = useState<{
    editing: boolean;
    key: number;
  } | null>(null);
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
  const [statusError, setStatusError] = useState('');
  const [clientError, setClientError] = useState('');
  const [clientRecord, setClientRecord] = useState<Client | null>(null);
  const actionError =
    statusError ||
    clientError ||
    (calendarSettings.error
      ? `${calendarSettings.error} היומן מוצג בלי שעות פעילות.`
      : '');
  const [dropError, setDropError] = useState('');
  const [moveRequest, setMoveRequest] = useState<{
    appointmentId: number;
    serviceId: number;
    wholeVisit: boolean;
  } | null>(null);
  const [pendingResize, setPendingResize] = useState<
    (AppointmentResizeRequest & { overlapMinutes: number }) | null
  >(null);
  const [resizeError, setResizeError] = useState('');
  const [menu, setMenu] = useState<{
    appointmentId: number;
    serviceId: number;
    x: number;
    y: number;
    scope?: 'appointment' | 'visit';
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

  const displayedAppointment = selectedAppointment;
  const displayedServiceId = selectedAppointment ? selectedServiceId : null;
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
          // Every move from this screen is the business. The flag must be set for
          // any status: otherwise the scheduler treats it as a customer move,
          // alerts the owner, and skips the client.
          ownerApprovedMove: true,
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
      const { appointment_date, start_time, end_time } = toAppointmentUpdate(values);
      Object.assign(changes, {
        appointment_date,
        start_time,
        end_time,
        status: statusAfterBusinessMove(baseline.status),
      });
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

  const openClientDetails = (appointment: AppointmentDetails) => {
    setClientError('');
    void getClient(businessCode, appointment.client_id)
      .then((client) => {
        if (!client) {
          setClientError('לא נמצאו פרטי הלקוח.');
          return;
        }
        setClientRecord(client);
      })
      .catch((error) => {
        console.error('שגיאה בטעינת פרטי לקוח:', getErrorMessage(error));
        setClientError(getErrorMessage(error) || 'לא ניתן לטעון את פרטי הלקוח.');
      });
  };

  const openDetails = (
    appointment: AppointmentDetails,
    serviceId: number,
    editing: boolean,
  ) => {
    setMenu(null);
    setSlotMenu(null);
    setSelectedId(appointment.id);
    setSelectedServiceId(serviceId);
    setSelectedDate(appointment.appointment_date);
    setDraftStartTime(null);
    setDetailsSession((current) => ({
      editing,
      key: (current?.key ?? 0) + 1,
    }));
  };

  const closePanel = () => {
    setDetailsSession(null);
  };

  const applyStatus = (
    appointment: AppointmentDetails,
    status: string,
    wholeVisit = false,
  ) => {
    const targets = wholeVisit
      ? combinedAppointmentChain(appointmentDetails, appointment.id)
      : [appointment];
    setStatusError('');
    void runBusy(async () => {
      try {
        for (const target of targets) {
          if (isCanceledStatus(target.status)) continue;
          if (status === '02' && isApprovedStatus(target.status)) continue;
          await saveAppointmentEdits(
            target,
            { ...toAppointmentEditValues(target), status },
            target.services[0]?.serviceId ?? 0,
          );
        }
        refresh();
      } catch (error) {
        setStatusError(getAppointmentSaveErrorMessage(error));
      }
    });
  };

  const persistResize = async (
    request: AppointmentResizeRequest,
    overlapMinutes: number,
  ) => {
    const appointment = appointmentDetails.find(
      (item) => item.id === request.appointmentId,
    );
    if (!appointment) {
      request.revert();
      setPendingResize(null);
      return;
    }

    setResizeError('');
    setIsBusy(true);
    try {
      await saveAppointmentEdits(
        appointment,
        {
          ...toAppointmentEditValues(appointment),
          appointment_date: toDateKey(request.nextStart),
          start_time: formatTimeHm(toTimeHm(request.nextStart)),
          end_time: formatTimeHm(toTimeHm(request.nextEnd)),
        },
        request.serviceId,
      );

      if (overlapMinutes > 0) {
        for (const companionId of request.continuationIds) {
          const companion = appointmentDetails.find((item) => item.id === companionId);
          if (!companion) continue;
          const shifted = shiftedAppointmentTimes(
            companion.appointment_date,
            companion.start_time,
            companion.end_time,
            overlapMinutes,
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
      }

      setPendingResize(null);
      refresh();
    } catch (error) {
      const message = getAppointmentSaveErrorMessage(error);
      if (overlapMinutes > 0) {
        setResizeError(message);
      } else {
        request.revert();
        setStatusError(message);
      }
      refresh();
    } finally {
      setIsBusy(false);
    }
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
      {detailsSession && displayedAppointment ? (
        <SidePanel
          key={detailsSession.key}
          appointment={displayedAppointment}
          statuses={statuses}
          isBusy={isBusy}
          readOnly={!canEdit}
          visibleFields={visibleFieldsFor('appointments')}
          onToggleField={(key) => toggleField('appointments', key)}
          onSave={handleSave}
          startInEdit={detailsSession.editing}
          visitCount={displayedGroup.length}
          onClose={closePanel}
        />
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
              setSelectedId(appointment.id);
              setSelectedServiceId(serviceId);
              setSelectedDate(appointment.appointment_date);
              setDraftStartTime(null);
            }}
            onEventDoubleClick={(appointment, serviceId) => {
              openDetails(appointment, serviceId, false);
            }}
            onEventContextMenu={(appointmentId, serviceId, x, y, scope) => {
              setSlotMenu(null);
              setMenu({ appointmentId, serviceId, x, y, scope });
            }}
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
            hasPendingMove={pendingDrop !== null || pendingResize !== null}
            onDropRequest={(request) => {
              setDropError('');
              setIsDropEditOpen(false);
              setPendingDrop(request);
              setSelectedId(request.appointmentId);
              setSelectedServiceId(request.serviceId);
              setSelectedDate(toDateKey(request.nextStart));
            }}
            onResizeRequest={(request) => {
              const next = appointmentDetails.find(
                (item) => item.id === request.continuationIds[0],
              );
              const overlapMinutes = next
                ? Math.round(
                    (request.nextEnd.getTime() -
                      dateAt(next.appointment_date, next.start_time).getTime()) /
                      60000,
                  )
                : 0;
              if (overlapMinutes > 0) {
                setResizeError('');
                setPendingResize({ ...request, overlapMinutes });
                return;
              }
              void persistResize(request, 0);
            }}
            isBlocked={isBusy && pendingDrop === null}
            workingHours={calendarSettings.data.workingHours}
            slotDurationMinutes={calendarSettings.data.slotDurationMinutes}
            maxAdvBookingDays={calendarSettings.data.maxAdvBookingDays}
            timezone={timezone}
            canEdit={canEdit}
            statuses={statuses}
            visibleFields={visibleFieldsFor('appointments')}
          />
        </div>
      </main>

      {pendingDrop && pendingAppointment && !isDropEditOpen && (
        <RescheduleConfirmModal
          preview={{
            clientName: pendingAppointment.patientName,
            serviceTitle: pendingService?.title ?? '',
            from: formatMoveMoment(
              pendingDrop.previousStart,
              pendingDrop.previousEnd,
            ),
            to: formatMoveMoment(pendingDrop.nextStart, pendingDrop.nextEnd),
            movesAllServices: (pendingAppointment.services.length ?? 0) > 1,
            movesVisit: pendingDrop.companionAppointmentIds.length > 0,
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

      {menu && menuAppointment && menu.scope === 'visit' ? (
        <AppointmentContextMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          actions={[
            {
              id: 'approve-visit',
              label: 'אישור כל הביקור',
              icon: <CheckIcon />,
              disabled: combinedAppointmentChain(appointmentDetails, menuAppointment.id).every(
                (item) => isApprovedStatus(item.status) || isCanceledStatus(item.status),
              ),
              onSelect: () => applyStatus(menuAppointment, '02', true),
            },
            {
              id: 'cancel-visit',
              label: 'ביטול כל הביקור',
              icon: <BanIcon />,
              onSelect: () => applyStatus(menuAppointment, '10', true),
            },
            {
              id: 'move-visit',
              label: 'הזזת כל הביקור',
              icon: <MoveIcon />,
              disabled: isCanceledStatus(menuAppointment.status),
              onSelect: () => {
                setSelectedId(menuAppointment.id);
                setSelectedServiceId(menu.serviceId);
                setSelectedDate(menuAppointment.appointment_date);
                setMoveRequest({
                  appointmentId: menuAppointment.id,
                  serviceId: menu.serviceId,
                  wholeVisit: true,
                });
              },
            },
          ]}
        />
      ) : null}

      {menu && menuAppointment && menu.scope !== 'visit' ? (
        <AppointmentContextMenu
          x={menu.x}
          y={menu.y}
          onClose={closeMenu}
          actions={[
            {
              id: 'details',
              label: 'פרטים',
              icon: <GlassesIcon />,
              onSelect: () => openDetails(menuAppointment, menu.serviceId, false),
            },
            {
              id: 'client',
              label: 'פרטי לקוח',
              icon: <UserIcon />,
              onSelect: () => openClientDetails(menuAppointment),
            },
            ...(canEdit
              ? [
                  {
                    id: 'approve',
                    label: 'אישור',
                    icon: <CheckIcon />,
                    disabled:
                      isApprovedStatus(menuAppointment.status) ||
                      isCanceledStatus(menuAppointment.status),
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
                    onSelect: () => openDetails(menuAppointment, menu.serviceId, true),
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
                        wholeVisit: false,
                      });
                    },
                  },
                ]
              : []),
          ]}
        />
      ) : null}

      {moveRequest && moveAppointment ? (
        <MoveAppointmentModal
          appointment={moveAppointment}
          timezone={timezone}
          isSaving={isBusy}
          movesVisit={moveRequest.wholeVisit}
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
                companionAppointmentIds: moveRequest.wholeVisit
                  ? combinedAppointmentChain(appointmentDetails, moveAppointment.id)
                      .map((item) => item.id)
                      .filter((id) => id !== moveAppointment.id)
                  : [],
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

      {pendingResize ? (
        <StretchContinuationPrompt
          isSaving={isBusy}
          errorMessage={resizeError}
          onMoveContinuation={() => {
            void persistResize(pendingResize, pendingResize.overlapMinutes);
          }}
          onCancel={() => {
            if (isBusy) return;
            pendingResize.revert();
            setResizeError('');
            setPendingResize(null);
          }}
        />
      ) : null}

      {clientRecord ? (
        <RecordDetailsModal
          title={`פרטי לקוח · ${clientRecord.full_name || clientRecord.mobile_phone}`}
          sections={toClientDetailSections(clientRecord)}
          onClose={() => setClientRecord(null)}
        />
      ) : null}
    </>
  );
}
