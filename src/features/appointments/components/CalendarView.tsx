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
  getBookingRangeEndExclusive,
  parseWorkingHourExceptions,
  parseWorkingHours,
  resolveWorkingDay,
  toFullCalendarBusinessHours,
  toFullCalendarBusinessHoursForRange,
  type WorkingHourException,
  type WorkingHours,
} from '../workingHours';
import { addDaysToDateKey, snapMinutes, snapTimeHm, toDateKey, toLocalDateFromKey, toTimeHm } from '../time';
import {
  isCalendarViewName,
  readCalendarLocation,
  writeCalendarLocation,
} from '../../../app/uiLocation';
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
  businessCode: string;
  events: EventInput[];
  appointments: AppointmentDetails[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onAddAppointment: () => void;
  onEventClick: (appointment: AppointmentDetails, serviceId: number) => void;
  onSelectDate: (date: string) => void;
  onSelectTime?: (time: string | null) => void;
  selectedAppointmentId: number | null;
  selectedServiceId: number | null;
  selectedDate: string | null;
  hasPendingMove: boolean;
  onDropRequest: (request: AppointmentDropRequest) => void;
  isBlocked: boolean;
  workingHours: Json | null;
  slotDurationMinutes: number | null;
  maxAdvBookingDays: number | null;
}

function isClosedCalendarDay(
  workingHours: WorkingHours | null,
  exceptions: WorkingHourException[],
  dateKey: string,
) {
  const exception = exceptions.find((item) => item.date === dateKey);
  if (exception) return exception.is_closed;
  if (!workingHours) return false;
  const day = resolveWorkingDay(workingHours, exceptions, dateKey);
  return !day || day.is_closed === true;
}

function specialNoteForDate(
  exceptions: WorkingHourException[],
  date: Date,
) {
  const dateKey = toDateKey(date);
  const note = exceptions.find((item) => item.date === dateKey)?.note?.trim();
  return note || null;
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
  businessCode,
  events,
  appointments,
  isLoading,
  error,
  onRetry,
  onAddAppointment,
  onEventClick,
  onSelectDate,
  onSelectTime,
  selectedAppointmentId,
  selectedServiceId,
  selectedDate,
  hasPendingMove,
  onDropRequest,
  isBlocked,
  workingHours,
  slotDurationMinutes,
  maxAdvBookingDays,
}: CalendarViewProps) {
  const calendarRef = useRef<FullCalendar | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const storedLocation = useMemo(
    () => readCalendarLocation(businessCode),
    [businessCode],
  );
  const [isMobile, setIsMobile] = useState(() =>
    window.matchMedia(MOBILE_QUERY).matches,
  );
  const [visibleRange, setVisibleRange] = useState(() => {
    const start = storedLocation?.date ?? toDateKey(new Date());
    return { start, end: start };
  });
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
    if (isMobile && api.view.type !== 'timeGridDay') {
      api.changeView('timeGridDay');
    }
  }, [isMobile]);

  const parsedHours = useMemo(
    () => parseWorkingHours(workingHours),
    [workingHours],
  );
  const exceptions = useMemo(
    () => parseWorkingHourExceptions(workingHours),
    [workingHours],
  );

  const applyDayMarks = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    root.querySelectorAll<HTMLElement>('[data-date]').forEach((element) => {
      const dateKey = element.dataset.date ?? '';
      element.classList.toggle(
        'is-selected-day',
        Boolean(selectedDate) && dateKey === selectedDate,
      );
      element.classList.toggle(
        'is-closed-day',
        Boolean(dateKey) &&
          isClosedCalendarDay(parsedHours, exceptions, dateKey),
      );
    });
  }, [exceptions, parsedHours, selectedDate]);

  useEffect(() => {
    applyDayMarks();
  }, [applyDayMarks, events, isMobile]);

  useEffect(() => {
    writeCalendarLocation(businessCode, { selectedDate });
  }, [businessCode, selectedDate]);

  const businessHours = useMemo(
    () =>
      exceptions.length > 0 && visibleRange.end > visibleRange.start
        ? toFullCalendarBusinessHoursForRange(
            parsedHours,
            exceptions,
            visibleRange.start,
            visibleRange.end,
          )
        : toFullCalendarBusinessHours(parsedHours),
    [exceptions, parsedHours, visibleRange.end, visibleRange.start],
  );
  const slotRange = useMemo(
    () => getCalendarSlotRange(parsedHours, exceptions),
    [exceptions, parsedHours],
  );
  const bookingRangeEnd = useMemo(
    () => getBookingRangeEndExclusive(maxAdvBookingDays),
    [maxAdvBookingDays],
  );

  const calendarEvents = useMemo(
    () => {
      const appointmentEvents = events.map((event) => {
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
      });

      const markers: EventInput[] = [];
      if (visibleRange.end > visibleRange.start) {
        let current = visibleRange.start;
        let guard = 0;
        while (current < visibleRange.end && guard < 400) {
          const exception = exceptions.find((item) => item.date === current);
          const closed = isClosedCalendarDay(parsedHours, exceptions, current);
          const note = exception?.note?.trim() || (closed ? 'סגור' : '');

          if (closed) {
            markers.push({
              id: `special-day-${current}`,
              title: note,
              start: toLocalDateFromKey(current, slotRange.slotMinTime),
              end: toLocalDateFromKey(current, slotRange.slotMaxTime),
              display: 'background',
              editable: false,
              overlap: true,
              classNames: ['special-day-fill'],
              extendedProps: { specialDayLabel: true },
            });
          } else if (exception && !exception.is_closed) {
            exception.shifts.forEach((shift, index) => {
              markers.push({
                id: `special-day-${current}-${index}`,
                title: note,
                start: toLocalDateFromKey(current, shift.start),
                end: toLocalDateFromKey(current, shift.end),
                display: 'background',
                editable: false,
                overlap: true,
                classNames: ['special-day-fill'],
                extendedProps: { specialDayLabel: true },
              });
            });
          }

          current = addDaysToDateKey(current, 1);
          guard += 1;
        }
      }

      return [...markers, ...appointmentEvents];
    },
    [
      events,
      exceptions,
      parsedHours,
      selectedAppointmentId,
      selectedServiceId,
      slotRange.slotMaxTime,
      slotRange.slotMinTime,
      visibleRange.end,
      visibleRange.start,
    ],
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

  const onDropRequestRef = useRef(onDropRequest);
  const hasPendingMoveRef = useRef(hasPendingMove);

  useEffect(() => {
    onDropRequestRef.current = onDropRequest;
    hasPendingMoveRef.current = hasPendingMove;
  }, [hasPendingMove, onDropRequest]);

  const handleEventDrop = useCallback((info: EventDropArg) => {
    const start = info.event.start;
    const previousStart = info.oldEvent.start;
    const props = info.event.extendedProps as CalendarEventProps;

    if (!start || !previousStart || hasPendingMoveRef.current) {
      info.revert();
      return;
    }

    if (!props?.appointmentId) {
      info.revert();
      return;
    }

    onDropRequestRef.current({
      revert: () => info.revert(),
      appointmentId: props.appointmentId,
      serviceId: props.serviceId,
      clientPhone: props.clientPhone,
      previousStart,
      previousEnd: info.oldEvent.end,
      nextStart: start,
      nextEnd: info.event.end,
    });
  }, []);

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
        initialView={
          isMobile ? 'timeGridDay' : (storedLocation?.view ?? 'timeGridWeek')
        }
        initialDate={
          storedLocation?.date
            ? toLocalDateFromKey(storedLocation.date)
            : undefined
        }
        locale={heLocale}
        customButtons={{
          newAppointmentBtn: {
            text: 'תור חדש',
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
        validRange={bookingRangeEnd ? { end: bookingRangeEnd } : undefined}
        businessHours={businessHours.length > 0 ? businessHours : undefined}
        eventOverlap={false}
        editable
        eventDurationEditable={false}
        eventResizableFromStart={false}
        nowIndicator
        navLinks
        datesSet={(info) => {
          applyDayMarks();
          const start = toDateKey(info.start);
          const end = toDateKey(info.end);
          setVisibleRange((current) =>
            current.start === start && current.end === end
              ? current
              : { start, end },
          );
          if (isCalendarViewName(info.view.type)) {
            writeCalendarLocation(businessCode, {
              date: toDateKey(info.view.currentStart),
              view: info.view.type,
            });
          }
        }}
        dayHeaderContent={(arg) => {
          const note = specialNoteForDate(exceptions, arg.date);
          return (
            <span className={styles.dayHeaderInner}>
              <span>{arg.text}</span>
              {note ? (
                <span className={styles.specialNote} title={note}>
                  {note}
                </span>
              ) : null}
            </span>
          );
        }}
        dayCellContent={(arg) => {
          if (arg.view.type !== 'dayGridMonth') return;
          const note = specialNoteForDate(exceptions, arg.date);
          if (!note) return;
          return (
            <>
              {arg.dayNumberText}
              <span className={styles.monthNote} title={note}>
                {note}
              </span>
            </>
          );
        }}
        dateClick={(info) => {
          onSelectDate(toDateKey(info.date));
          onSelectTime?.(
            info.allDay ? null : snapTimeHm(toTimeHm(info.date)),
          );
        }}
        navLinkDayClick={(date, event) => {
          event.preventDefault();
          onSelectDate(toDateKey(date));
          onSelectTime?.(null);
          calendarRef.current?.getApi().changeView('timeGridDay', date);
        }}
        eventDragStart={() => {
          document.addEventListener('mousemove', handleDragMove);
        }}
        eventDragStop={stopDragTracking}
        eventDrop={handleEventDrop}
        eventClick={(clickInfo) => {
          clickInfo.jsEvent.preventDefault();
          const props = clickInfo.event.extendedProps as CalendarEventProps & {
            specialDayLabel?: boolean;
          };
          if (props?.specialDayLabel) {
            return;
          }
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
