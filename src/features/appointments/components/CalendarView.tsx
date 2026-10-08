import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import type {
  EventApi,
  EventContentArg,
  EventDropArg,
  EventInput,
} from '@fullcalendar/core';
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
  DRAG_PERIOD_HOVER_MS,
  buildDropRange,
  canNavigateByView,
  findDragNavTarget,
  isDateKeyBookable,
  isSameSlot,
  periodNavLabel,
  readDateKeyFromPoint,
} from '../calendarDragNav';
import {
  isCalendarViewName,
  readCalendarLocation,
  writeCalendarLocation,
} from '../../../app/uiLocation';
import { allowCalendarEventOverlap } from '../calendarGrouping';
import {
  getIsraeliHolidaysInRange,
} from '../israeliHolidays';
import {
  ErrorState,
  LoadingState,
} from '../../../shared/components/PageState';
import type { Json } from '../../../types/database';
import styles from './CalendarView.module.css';

const MOBILE_QUERY = '(max-width: 767px)';
const TODAY_HINT = 'מעבר להיום ביומן';

function DragEdgeChevron({ direction }: { direction: 'prev' | 'next' }) {
  return (
    <svg className={styles.dragEdgeIcon} viewBox="0 0 24 24" aria-hidden="true">
      {direction === 'next' ? (
        <path d="M14.5 5.5 8 12l6.5 6.5" />
      ) : (
        <path d="M9.5 5.5 16 12l-6.5 6.5" />
      )}
    </svg>
  );
}

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

type DragOrigin = {
  appointmentId: number;
  serviceId: number;
  clientPhone: string | null;
  start: Date;
  end: Date | null;
  label: string;
};

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
  const dragTooltipRef = useRef<HTMLDivElement | null>(null);
  const dragGhostRef = useRef<HTMLDivElement | null>(null);
  const dragOriginRef = useRef<DragOrigin | null>(null);
  const lastPointerRef = useRef({ x: 0, y: 0 });
  const hoverKeyRef = useRef('');
  const hoverSinceRef = useRef(0);
  const dropHandledRef = useRef(false);
  const syntheticDragRef = useRef(false);
  const navigatingRef = useRef(false);
  const handleDragMoveRef = useRef<(event: PointerEvent) => void>(() => {});
  const handlePointerUpRef = useRef<() => void>(() => {});
  const viewTypeRef = useRef<string>(
    storedLocation?.view ?? (isMobile ? 'timeGridDay' : 'timeGridWeek'),
  );
  const bookingRangeEndRef = useRef<string | null>(null);
  const [calendarViewType, setCalendarViewType] = useState<string>(
    storedLocation?.view ?? (isMobile ? 'timeGridDay' : 'timeGridWeek'),
  );
  const [viewCurrentStartKey, setViewCurrentStartKey] = useState(
    () => storedLocation?.date ?? toDateKey(new Date()),
  );

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

  const goToToday = useCallback(() => {
    const today = new Date();
    calendarRef.current?.getApi().today();
    onSelectDate(toDateKey(today));
    onSelectTime?.(null);
  }, [onSelectDate, onSelectTime]);

  const syncTodayButton = useCallback(() => {
    const root = rootRef.current;
    const api = calendarRef.current?.getApi();
    const button = root?.querySelector<HTMLButtonElement>(
      '.fc-goTodayBtn-button',
    );
    if (!button) return;

    button.title = TODAY_HINT;
    button.setAttribute('aria-label', TODAY_HINT);

    const today = new Date();
    const todayKey = toDateKey(today);
    const viewHasToday = api
      ? api.view.activeStart <= today && today < api.view.activeEnd
      : false;
    button.disabled = selectedDate === todayKey && viewHasToday;
  }, [selectedDate]);

  useLayoutEffect(() => {
    syncTodayButton();
  }, [isMobile, syncTodayButton, visibleRange]);

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
  bookingRangeEndRef.current = bookingRangeEnd;

  const holidaysByDate = useMemo(
    () => getIsraeliHolidaysInRange(visibleRange.start, visibleRange.end),
    [visibleRange.end, visibleRange.start],
  );
  const viewStartDate = toLocalDateFromKey(viewCurrentStartKey);
  const canDragPrev = canNavigateByView(
    viewStartDate,
    calendarViewType,
    -1,
    bookingRangeEnd,
  );
  const canDragNext = canNavigateByView(
    viewStartDate,
    calendarViewType,
    1,
    bookingRangeEnd,
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

  useEffect(() => {
    const api = calendarRef.current?.getApi();
    if (!api) return;

    api.removeAllEventSources();
    api.addEventSource(calendarEvents);
  }, [calendarEvents]);

  const slotMinutes =
    slotDurationMinutes && slotDurationMinutes > 0 ? slotDurationMinutes : 30;

  const onDropRequestRef = useRef(onDropRequest);
  const hasPendingMoveRef = useRef(hasPendingMove);

  useEffect(() => {
    onDropRequestRef.current = onDropRequest;
    hasPendingMoveRef.current = hasPendingMove;
  }, [hasPendingMove, onDropRequest]);

  const hideDragTooltip = useCallback(() => {
    const tooltip = dragTooltipRef.current;
    if (!tooltip) return;
    tooltip.style.display = 'none';
    tooltip.textContent = '';
  }, []);

  const hideDragGhost = useCallback(() => {
    const ghost = dragGhostRef.current;
    if (!ghost) return;
    ghost.style.display = 'none';
  }, []);

  const showDragGhost = useCallback(() => {
    const ghost = dragGhostRef.current;
    const origin = dragOriginRef.current;
    if (!ghost || !origin) return;
    ghost.style.display = 'block';
    ghost.textContent = origin.label;
  }, []);

  const placeDragChrome = useCallback((clientX: number, clientY: number) => {
    const tooltip = dragTooltipRef.current;
    const ghost = dragGhostRef.current;
    if (tooltip) {
      tooltip.style.left = `${clientX + 12}px`;
      tooltip.style.top = `${clientY + 12}px`;
    }
    if (ghost) {
      ghost.style.left = `${clientX + 14}px`;
      ghost.style.top = `${clientY + 36}px`;
    }
  }, []);

  const clearDragHot = useCallback(() => {
    rootRef.current
      ?.querySelectorAll(`.${styles.dragNavHot}`)
      .forEach((element) => element.classList.remove(styles.dragNavHot));
  }, []);

  const setDragHot = useCallback(
    (target: Element | null) => {
      clearDragHot();
      if (target instanceof HTMLElement) {
        target.classList.add(styles.dragNavHot);
      }
    },
    [clearDragHot],
  );

  const onDragPointerMove = useCallback((event: PointerEvent) => {
    handleDragMoveRef.current(event);
  }, []);

  const onDragPointerUp = useCallback(() => {
    handlePointerUpRef.current();
  }, []);

  const cleanupDrag = useCallback(() => {
    document.removeEventListener('pointermove', onDragPointerMove);
    document.removeEventListener('pointerup', onDragPointerUp);
    document.removeEventListener('pointercancel', onDragPointerUp);
    hideDragTooltip();
    hideDragGhost();
    document.body.classList.remove('featurn-is-event-dragging');
    rootRef.current?.classList.remove(styles.isDragging);
    clearDragHot();
    hoverKeyRef.current = '';
    hoverSinceRef.current = 0;
    dragOriginRef.current = null;
    dropHandledRef.current = false;
    syntheticDragRef.current = false;
    navigatingRef.current = false;
  }, [clearDragHot, hideDragGhost, hideDragTooltip, onDragPointerMove, onDragPointerUp]);

  const requestMoveFromDrag = useCallback(
    (
      origin: DragOrigin,
      nextStart: Date,
      nextEnd: Date | null,
      revert: () => void,
    ) => {
      if (hasPendingMoveRef.current) {
        return false;
      }

      if (isSameSlot(origin.start, origin.end, nextStart, nextEnd)) {
        return false;
      }

      if (!isDateKeyBookable(toDateKey(nextStart), bookingRangeEndRef.current)) {
        return false;
      }

      onDropRequestRef.current({
        revert: () => {
          revert();
          calendarRef.current?.getApi().gotoDate(origin.start);
        },
        appointmentId: origin.appointmentId,
        serviceId: origin.serviceId,
        clientPhone: origin.clientPhone,
        previousStart: origin.start,
        previousEnd: origin.end,
        nextStart,
        nextEnd,
      });
      calendarRef.current?.getApi().gotoDate(nextStart);
      return true;
    },
    [],
  );

  const jumpViewDuringDrag = useCallback(
    (nav: ReturnType<typeof findDragNavTarget>) => {
      const api = calendarRef.current?.getApi();
      if (!api || !nav || navigatingRef.current) {
        return;
      }

      if (nav.type === 'period') {
        if (
          !canNavigateByView(
            api.view.currentStart,
            api.view.type,
            nav.direction,
            bookingRangeEndRef.current,
          )
        ) {
          return;
        }
      }

      syntheticDragRef.current = true;
      navigatingRef.current = true;
      showDragGhost();

      if (nav.type === 'date') {
        api.gotoDate(toLocalDateFromKey(nav.dateKey));
      } else if (nav.direction === 1) {
        api.next();
      } else {
        api.prev();
      }

      window.setTimeout(() => {
        navigatingRef.current = false;
      }, 280);
    },
    [showDragGhost],
  );

  const completeSyntheticDrop = useCallback(() => {
    const origin = dragOriginRef.current;
    const pointer = lastPointerRef.current;
    if (!origin) {
      return;
    }

    const dateKey = readDateKeyFromPoint(pointer.x, pointer.y);
    if (!dateKey) {
      return;
    }

    const viewType =
      calendarRef.current?.getApi().view.type ?? viewTypeRef.current;
    const time = readSnappedTimeFromPoint(
      pointer.x,
      pointer.y,
      slotMinutes,
    );
    const moved = buildDropRange(
      dateKey,
      time,
      origin.start,
      origin.end,
      viewType === 'dayGridMonth',
    );
    requestMoveFromDrag(origin, moved.nextStart, moved.nextEnd, () => {
      calendarRef.current?.getApi().gotoDate(origin.start);
    });
  }, [requestMoveFromDrag, slotMinutes]);

  const handleDragMove = useCallback(
    (event: PointerEvent) => {
      lastPointerRef.current = { x: event.clientX, y: event.clientY };
      placeDragChrome(event.clientX, event.clientY);

      const nav = findDragNavTarget(event.clientX, event.clientY);
      const navKey = nav
        ? nav.type === 'period'
          ? `period:${nav.direction}`
          : `date:${nav.dateKey}`
        : '';

      if (nav) {
        const hot = document
          .elementsFromPoint(event.clientX, event.clientY)
          .find(
            (element) =>
              element instanceof HTMLElement &&
              element.closest('[data-drag-nav]'),
          );
        setDragHot(
          hot instanceof HTMLElement
            ? (hot.closest('[data-drag-nav]') ?? hot)
            : null,
        );
        if (hoverKeyRef.current !== navKey) {
          hoverKeyRef.current = navKey;
          hoverSinceRef.current = event.timeStamp;
        } else if (
          event.timeStamp - hoverSinceRef.current >=
          DRAG_PERIOD_HOVER_MS
        ) {
          jumpViewDuringDrag(nav);
          hoverSinceRef.current = event.timeStamp;
        }
      } else {
        hoverKeyRef.current = '';
        clearDragHot();
      }

      const tooltip = dragTooltipRef.current;
      if (!tooltip) return;

      const time = readSnappedTimeFromPoint(
        event.clientX,
        event.clientY,
        slotMinutes,
      );
      const dateKey = readDateKeyFromPoint(event.clientX, event.clientY);
      const originTime = dragOriginRef.current
        ? toTimeHm(dragOriginRef.current.start)
        : null;
      const navLabel =
        nav?.type === 'period'
          ? periodNavLabel(
              viewTypeRef.current,
              nav.direction === 1 ? 'next' : 'prev',
            )
          : null;

      const tooltipParts = [
        time ?? (dateKey ? originTime : null),
        dateKey && !time ? dateKey.slice(8) : null,
        navLabel,
      ].filter(Boolean);

      if (tooltipParts.length === 0) {
        tooltip.style.display = 'none';
        return;
      }

      tooltip.style.display = 'block';
      tooltip.textContent = tooltipParts.join(' · ');
    },
    [
      clearDragHot,
      jumpViewDuringDrag,
      placeDragChrome,
      setDragHot,
      slotMinutes,
    ],
  );

  const handlePointerUp = useCallback(() => {
    window.setTimeout(() => {
      if (!dropHandledRef.current && syntheticDragRef.current) {
        completeSyntheticDrop();
      }
      cleanupDrag();
    }, 0);
  }, [cleanupDrag, completeSyntheticDrop]);

  handleDragMoveRef.current = handleDragMove;
  handlePointerUpRef.current = handlePointerUp;

  const startDragTracking = useCallback(
    (info: { event: EventApi; jsEvent: MouseEvent }) => {
      const start = info.event.start;
      const props = info.event.extendedProps as CalendarEventProps;
      dropHandledRef.current = false;
      syntheticDragRef.current = false;
      navigatingRef.current = false;
      hoverKeyRef.current = '';
      lastPointerRef.current = {
        x: info.jsEvent.clientX,
        y: info.jsEvent.clientY,
      };
      const label = [props?.clientName, props?.timeLabel]
        .filter(Boolean)
        .join(' · ');
      dragOriginRef.current =
        start && props?.appointmentId
          ? {
              appointmentId: props.appointmentId,
              serviceId: props.serviceId,
              clientPhone: props.clientPhone,
              start,
              end: info.event.end,
              label: label || info.event.title || 'תור',
            }
          : null;
      viewTypeRef.current =
        calendarRef.current?.getApi().view.type ?? viewTypeRef.current;
      const ghost = dragGhostRef.current;
      if (ghost) {
        ghost.textContent = dragOriginRef.current?.label ?? '';
        ghost.style.display = 'none';
      }
      document.body.classList.add('featurn-is-event-dragging');
      rootRef.current?.classList.add(styles.isDragging);
      document.addEventListener('pointermove', onDragPointerMove);
      document.addEventListener('pointerup', onDragPointerUp);
      document.addEventListener('pointercancel', onDragPointerUp);
    },
    [onDragPointerMove, onDragPointerUp],
  );

  const handleEventDragStop = useCallback(() => {
    if (syntheticDragRef.current) {
      showDragGhost();
    }
  }, [showDragGhost]);

  useEffect(
    () => () => {
      document.removeEventListener('pointermove', onDragPointerMove);
      document.removeEventListener('pointerup', onDragPointerUp);
      document.removeEventListener('pointercancel', onDragPointerUp);
      document.body.classList.remove('featurn-is-event-dragging');
    },
    [onDragPointerMove, onDragPointerUp],
  );

  const handleEventOverlap = useCallback(
    (stillEvent: EventApi, movingEvent: EventApi | null) =>
      allowCalendarEventOverlap({
        stillDisplay: stillEvent.display,
        stillAppointmentId: (stillEvent.extendedProps as CalendarEventProps)
          .appointmentId,
        movingAppointmentId: (movingEvent?.extendedProps as
          | CalendarEventProps
          | undefined)?.appointmentId,
      }),
    [],
  );

  const handleEventDrop = useCallback((info: EventDropArg) => {
    dropHandledRef.current = true;
    const start = info.event.start;
    const previousStart = info.oldEvent.start;
    const props = info.event.extendedProps as CalendarEventProps;
    const origin = dragOriginRef.current ?? (
      start && previousStart && props?.appointmentId
        ? {
            appointmentId: props.appointmentId,
            serviceId: props.serviceId,
            clientPhone: props.clientPhone,
            start: previousStart,
            end: info.oldEvent.end,
            label: '',
          }
        : null
    );

    if (!start || !previousStart || !origin) {
      info.revert();
      return;
    }

    const applied = requestMoveFromDrag(
      origin,
      start,
      info.event.end,
      () => info.revert(),
    );
    if (!applied) {
      info.revert();
    }
  }, [requestMoveFromDrag]);

  if (isLoading) {
    return <LoadingState message="טוען תורים..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  return (
    <div className={styles.calendarShell} ref={rootRef}>
      <div
        className={`${styles.dragEdge} ${canDragPrev ? '' : styles.dragEdgeDisabled}`}
        data-drag-nav={canDragPrev ? 'prev' : undefined}
        aria-label={periodNavLabel(calendarViewType, 'prev')}
        aria-hidden={canDragPrev ? undefined : true}
      >
        <DragEdgeChevron direction="prev" />
      </div>
      <div className={styles.calendarContainer}>
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
          goTodayBtn: {
            text: 'היום',
            click: goToToday,
          },
        }}
        headerToolbar={
          isMobile
            ? {
                left: 'newAppointmentBtn',
                center: 'prev,title,next',
                right: 'goTodayBtn',
              }
            : {
                left: 'newAppointmentBtn prev,next goTodayBtn',
                center: 'title',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }
        }
        events={calendarEvents}
        height="auto"
        stickyHeaderDates
        direction="rtl"
        allDaySlot={false}
        eventMinHeight={22}
        displayEventTime={false}
        slotMinTime={slotRange.slotMinTime}
        slotMaxTime={slotRange.slotMaxTime}
        slotDuration={getSlotDuration(slotDurationMinutes)}
        slotLabelFormat={{
          hour: 'numeric',
          minute: '2-digit',
          omitZeroMinute: false,
          meridiem: false,
        }}
        snapDuration="00:05:00"
        validRange={bookingRangeEnd ? { end: bookingRangeEnd } : undefined}
        businessHours={businessHours.length > 0 ? businessHours : undefined}
        eventOverlap={handleEventOverlap}
        editable
        eventDurationEditable={false}
        eventResizableFromStart={false}
        nowIndicator
        navLinks
        views={{
          dayGridMonth: {
            navLinks: false,
          },
        }}
        datesSet={(info) => {
          applyDayMarks();
          syncTodayButton();
          const nextViewType = info.view.type;
          const currentStartKey = toDateKey(info.view.currentStart);
          viewTypeRef.current = nextViewType;
          setCalendarViewType((current) =>
            current === nextViewType ? current : nextViewType,
          );
          setViewCurrentStartKey((current) =>
            current === currentStartKey ? current : currentStartKey,
          );
          const start = toDateKey(info.start);
          const end = toDateKey(info.end);
          setVisibleRange((current) =>
            current.start === start && current.end === end
              ? current
              : { start, end },
          );
          if (isCalendarViewName(nextViewType)) {
            writeCalendarLocation(businessCode, {
              date: currentStartKey,
              view: nextViewType,
            });
          }
        }}
        dayHeaderContent={(arg) => {
          const holiday = holidaysByDate.get(toDateKey(arg.date)) ?? null;
          const note = specialNoteForDate(exceptions, arg.date);
          return (
            <span className={styles.dayHeaderInner}>
              <span>{arg.text}</span>
              {holiday ? (
                <span className={styles.holidayNote} title={holiday}>
                  {holiday}
                </span>
              ) : null}
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
          const holiday = holidaysByDate.get(toDateKey(arg.date)) ?? null;
          const note = specialNoteForDate(exceptions, arg.date);
          return (
            <div className={styles.monthCell}>
              <div className={styles.monthCellTop}>
                <span className={styles.monthDayNum}>{arg.dayNumberText}</span>
                {holiday ? (
                  <span className={styles.monthHoliday} title={holiday}>
                    {holiday}
                  </span>
                ) : null}
              </div>
              {note ? (
                <span className={styles.monthNote} title={note}>
                  {note}
                </span>
              ) : null}
            </div>
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
        eventDragStart={startDragTracking}
        eventDragStop={handleEventDragStop}
        eventDrop={handleEventDrop}
        eventDidMount={(info) => {
          const props = info.event.extendedProps as CalendarEventProps;
          if (props?.tooltip) {
            info.el.title = props.tooltip;
          }
        }}
        eventContent={(arg: EventContentArg) => {
          if (arg.event.display === 'background') {
            return arg.event.title;
          }

          const props = arg.event.extendedProps as CalendarEventProps;
          const isGroupContinuation =
            props.groupRole === 'middle' || props.groupRole === 'end';

          return (
            <div className={styles.eventInner} title={props.tooltip}>
              {isGroupContinuation ? null : (
                <span className={styles.eventTime}>{props.timeLabel}</span>
              )}
              {props.serviceTitle ? (
                <span className={styles.eventService}>{props.serviceTitle}</span>
              ) : null}
              {isGroupContinuation ? null : (
                <span className={styles.eventName}>{props.clientName}</span>
              )}
            </div>
          );
        }}
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

      {isBlocked && (
        <div className={styles.blockingOverlay} role="status">
          <span className={styles.spinner} aria-hidden="true" />
          מעדכן תור...
        </div>
      )}
      </div>

      <div
        className={`${styles.dragEdge} ${canDragNext ? '' : styles.dragEdgeDisabled}`}
        data-drag-nav={canDragNext ? 'next' : undefined}
        aria-label={periodNavLabel(calendarViewType, 'next')}
        aria-hidden={canDragNext ? undefined : true}
      >
        <DragEdgeChevron direction="next" />
      </div>

      <div ref={dragTooltipRef} className={styles.dragTooltip} />
      <div ref={dragGhostRef} className={styles.dragGhost} />
    </div>
  );
}
