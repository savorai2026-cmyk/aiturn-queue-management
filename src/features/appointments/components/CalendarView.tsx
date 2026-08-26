import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import type { EventDropArg, EventInput } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import heLocale from '@fullcalendar/core/locales/he';
import { isCanceledStatus } from '../appointmentStatuses';
import type { AppointmentDetails, CalendarEventProps } from '../appointments.types';
import {
  getCalendarSlotRange,
  parseWorkingHours,
  toFullCalendarBusinessHours,
} from '../workingHours';
import { snapMinutes, toDateKey } from '../time';
import {
  ErrorState,
  LoadingState,
} from '../../../shared/components/PageState';
import type { Json } from '../../../types/database';
import styles from './CalendarView.module.css';

const MOBILE_QUERY = '(max-width: 767px)';

export interface AppointmentDropRequest {
  revert: () => void;
  appointmentId: number;
  serviceId: number;
  clientPhone: string | null;
  previousStart: Date;
  previousEnd: Date | null;
  nextStart: Date;
  nextEnd: Date | null;
}

interface CalendarViewProps {
  events: EventInput[];
  appointments: AppointmentDetails[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onAddAppointment: () => void;
  onEventClick: (appointment: AppointmentDetails, serviceId: number) => void;
  onSelectDate: (date: string) => void;
  selectedAppointmentId: number | null;
  selectedServiceId: number | null;
  selectedDate: string | null;
  hasPendingMove: boolean;
  onDropRequest: (request: AppointmentDropRequest) => void;
  isBlocked: boolean;
  workingHours: Json | null;
  slotDurationMinutes: number | null;
}

function getSlotDuration(slotDurationMinutes: number | null) {
  const minutes =
    slotDurationMinutes && slotDurationMinutes > 0 ? slotDurationMinutes : 30;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}:00`;
}

function readSnappedTimeFromPoint(
  clientX: number,
  clientY: number,
  slotLength: number,
) {
  const elements = document.elementsFromPoint(clientX, clientY);
  const slot = elements.find(
    (element): element is HTMLElement =>
      element instanceof HTMLElement && Boolean(element.dataset.time),
  );

  if (!slot?.dataset.time) {
    return null;
  }

  const [hours, minutes] = slot.dataset.time.split(':').map(Number);
  const slotRect = slot.getBoundingClientRect();
  const ratio = slotRect.height
    ? Math.min(Math.max((clientY - slotRect.top) / slotRect.height, 0), 0.999)
    : 0;
  const snapped = snapMinutes(hours * 60 + minutes + ratio * slotLength);

  return `${String(Math.floor(snapped / 60)).padStart(2, '0')}:${String(snapped % 60).padStart(2, '0')}`;
}

export default function CalendarView({
  events,
  appointments,
  isLoading,
  error,
  onRetry,
  onAddAppointment,
  onEventClick,
  onSelectDate,
  selectedAppointmentId,
  selectedServiceId,
  selectedDate,
  hasPendingMove,
  onDropRequest,
  isBlocked,
  workingHours,
  slotDurationMinutes,
}: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia(MOBILE_QUERY).matches,
  );
  const [dragTooltip, setDragTooltip] = useState<{
    x: number;
    y: number;
    time: string;
  } | null>(null);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const handleChange = () => setIsMobile(media.matches);

    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', handleChange);
      return () => media.removeEventListener('change', handleChange);
    }

    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;
    api.changeView(isMobile ? 'timeGridDay' : 'timeGridWeek');
  }, [isMobile]);

  const applySelectedDay = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    root.querySelectorAll<HTMLElement>('[data-date]').forEach((element) => {
      element.classList.toggle(
        'is-selected-day',
        Boolean(selectedDate) && element.dataset.date === selectedDate,
      );
    });
  }, [selectedDate]);

  useEffect(() => {
    applySelectedDay();
  }, [applySelectedDay, events, isMobile]);

  const parsedHours = useMemo(
    () => parseWorkingHours(workingHours),
    [workingHours],
  );
  const businessHours = useMemo(
    () => toFullCalendarBusinessHours(parsedHours),
    [parsedHours],
  );
  const slotRange = useMemo(
    () => getCalendarSlotRange(parsedHours),
    [parsedHours],
  );

  const calendarEvents = useMemo(
    () =>
      events.map((event) => {
        const props = event.extendedProps as CalendarEventProps | undefined;
        const existingNames = Array.isArray(event.classNames)
          ? event.classNames
          : event.classNames
            ? [event.classNames]
            : [];
        const canMove = !isCanceledStatus(props?.status ?? '');
        const classNames = [
          ...existingNames,
          props?.appointmentId === selectedAppointmentId ? 'event-selected' : '',
          props?.appointmentId === selectedAppointmentId &&
          props.serviceId === selectedServiceId
            ? 'event-focused'
            : '',
        ].filter(Boolean);

        return {
          ...event,
          classNames,
          editable: canMove,
          startEditable: canMove,
          durationEditable: false,
        };
      }),
    [events, selectedAppointmentId, selectedServiceId],
  );

  const slotMinutes =
    slotDurationMinutes && slotDurationMinutes > 0 ? slotDurationMinutes : 30;

  const handleDragMove = useCallback(
    (event: MouseEvent) => {
      const time = readSnappedTimeFromPoint(
        event.clientX,
        event.clientY,
        slotMinutes,
      );
      if (!time) return;
      setDragTooltip({ x: event.clientX, y: event.clientY, time });
    },
    [slotMinutes],
  );

  const stopDragTracking = useCallback(() => {
    document.removeEventListener('mousemove', handleDragMove);
    setDragTooltip(null);
  }, [handleDragMove]);

  const handleEventDrop = (info: EventDropArg) => {
    const start = info.event.start;
    const previousStart = info.oldEvent.start;
    const props = info.event.extendedProps as CalendarEventProps;

    if (!start || !previousStart || hasPendingMove) {
      info.revert();
      return;
    }

    onDropRequest({
      revert: () => info.revert(),
      appointmentId: props.appointmentId,
      serviceId: props.serviceId,
      clientPhone: props.clientPhone,
      previousStart,
      previousEnd: info.oldEvent.end,
      nextStart: start,
      nextEnd: info.event.end,
    });
  };

  if (isLoading) {
    return <LoadingState message="טוען תורים..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  return (
    <div className={styles.calendarContainer} ref={rootRef}>
      <FullCalendar
        ref={calendarRef}
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView={isMobile ? 'timeGridDay' : 'timeGridWeek'}
        locale={heLocale}
        customButtons={{
          newAppointmentBtn: {
            text: '➕ תור חדש',
            click: onAddAppointment,
          },
        }}
        headerToolbar={
          isMobile
            ? {
                left: 'newAppointmentBtn',
                center: 'prev,title,next',
                right: 'today',
              }
            : {
                left: 'newAppointmentBtn prev,next today',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }
        }
        events={calendarEvents}
        height="100%"
        direction="rtl"
        slotMinTime={slotRange.slotMinTime}
        slotMaxTime={slotRange.slotMaxTime}
        slotDuration={getSlotDuration(slotDurationMinutes)}
        snapDuration="00:05:00"
        businessHours={businessHours.length > 0 ? businessHours : undefined}
        eventConstraint={businessHours.length > 0 ? 'businessHours' : undefined}
        eventOverlap={false}
        editable
        eventDurationEditable={false}
        eventResizableFromStart={false}
        nowIndicator
        navLinks
        datesSet={applySelectedDay}
        dateClick={(info) => {
          onSelectDate(toDateKey(info.date));
        }}
        navLinkDayClick={(date, event) => {
          event.preventDefault();
          onSelectDate(toDateKey(date));
          calendarRef.current?.getApi().changeView('timeGridDay', date);
        }}
        eventDragStart={() => {
          document.addEventListener('mousemove', handleDragMove);
        }}
        eventDragStop={stopDragTracking}
        eventDrop={handleEventDrop}
        eventClick={(clickInfo) => {
          clickInfo.jsEvent.preventDefault();
          const props = clickInfo.event.extendedProps as CalendarEventProps;
          const appointment = appointments.find(
            (candidate) => candidate.id === props.appointmentId,
          );
          if (appointment) {
            onEventClick(appointment, props.serviceId);
          }
        }}
      />

      {dragTooltip && (
        <div
          className={styles.dragTooltip}
          style={{ left: dragTooltip.x + 12, top: dragTooltip.y + 12 }}
        >
          {dragTooltip.time}
        </div>
      )}

      {isBlocked && (
        <div className={styles.blockingOverlay} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          מעדכן תור...
        </div>
      )}
    </div>
  );
}
