import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import FullCalendar from '@fullcalendar/react';
import type {
  EventApi,
  EventContentArg,
  EventDropArg,
  EventInput,
} from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction';
import heLocale from '@fullcalendar/core/locales/he';
import { isCanceledStatus, type StatusCatalogItem } from '../appointmentStatuses';
import type { AppointmentDetails, CalendarEventProps } from '../appointments.types';
import AppointmentHoverCard, { type HoverAnchor } from './AppointmentHoverCard';
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
import {
  addDaysToDateKey,
  nowInTimeZone,
  snapMinutes,
  snapTimeHm,
  toDateKey,
  toLocalDateFromKey,
  toTimeHm,
} from '../time';
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
import { collapseVisitsForMonth } from '../appointments.mappers';
import {
  getIsraeliHolidaysInRange,
  isAgentClosedHoliday,
} from '../israeliHolidays';
import {
  ErrorState,
  LoadingState,
} from '../../../shared/components/PageState';
import { WaitingOverlay } from '../../../shared/components/QLoader';
import type { Json } from '../../../types/database';
import styles from './CalendarView.module.css';

const MOBILE_QUERY = '(max-width: 767px)';
const TODAY_HINT = 'מעבר להיום ביומן';

function dragCompanionIds(props: CalendarEventProps | undefined) {
  if (props?.groupRole !== 'combined') return [];
  return props.continuationIds ?? [];
}

function appointmentAtPointer(props: CalendarEventProps) {
  return {
    appointmentId: props.appointmentId,
    serviceId: props.serviceId,
  };
}

function resizeKeepsStart(event: EventApi, props: CalendarEventProps) {
  if (!event.start || !props.date || !props.startHm) return false;
  return toDateKey(event.start) === props.date && toTimeHm(event.start) === props.startHm;
}

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
  companionAppointmentIds: number[];
  previousStart: Date;
  previousEnd: Date | null;
  nextStart: Date;
  nextEnd: Date | null;
}

export interface AppointmentResizeRequest {
  revert: () => void;
  appointmentId: number;
  serviceId: number;
  nextStart: Date;
  nextEnd: Date;
  continuationIds: number[];
}

type DragOrigin = {
  appointmentId: number;
  serviceId: number;
  clientPhone: string | null;
  companionAppointmentIds: number[];
  start: Date;
  end: Date | null;
  label: string;
};

type VisitDrag = {
  pointerId: number;
  originX: number;
  originY: number;
  originLeft: number;
  originTop: number;
  frame: HTMLDivElement;
  moved: boolean;
  appointmentId: number;
  serviceId: number;
  clientPhone: string | null;
  companionAppointmentIds: number[];
  start: Date;
  end: Date | null;
  snappedMinutes: number;
  slotHeight: number;
  mirror: HTMLDivElement | null;
  sources: HTMLElement[];
};

const VISIT_SNAP_MINUTES = 5;

function snappedVisitMinutes(
  originMinutes: number,
  deltaY: number,
  slotHeight: number,
  slotLength: number,
): number {
  if (!slotHeight || !slotLength) return originMinutes;
  const raw = originMinutes + (deltaY / slotHeight) * slotLength;
  const snapped = snapMinutes(raw, VISIT_SNAP_MINUTES);
  return Math.min(Math.max(snapped, 0), 23 * 60 + 55);
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
  onEventDoubleClick?: (appointment: AppointmentDetails, serviceId: number) => void;
  onEventContextMenu?: (
    appointmentId: number,
    serviceId: number,
    x: number,
    y: number,
    scope?: 'appointment' | 'visit',
  ) => void;
  onBackgroundClick?: (info: { date: Date; allDay: boolean }) => void;
  onSelectedSlotContextMenu?: (x: number, y: number) => void;
  onSelectDate: (date: string) => void;
  onSelectTime?: (time: string | null) => void;
  selectedTime: string | null;
  selectedAppointmentId: number | null;
  selectedServiceId: number | null;
  selectedDate: string | null;
  hasPendingMove: boolean;
  onDropRequest: (request: AppointmentDropRequest) => void;
  onResizeRequest: (request: AppointmentResizeRequest) => void;
  isBlocked: boolean;
  workingHours: Json | null;
  slotDurationMinutes: number | null;
  maxAdvBookingDays: number | null;
  timezone: string | null;
  canEdit: boolean;
  statuses: StatusCatalogItem[];
  visibleFields: string[];
}

function isClosedCalendarDay(
  workingHours: WorkingHours | null,
  exceptions: WorkingHourException[],
  dateKey: string,
) {
  const exception = exceptions.find((item) => item.date === dateKey);
  if (exception) return exception.is_closed;
  if (isAgentClosedHoliday(dateKey)) return true;
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

function dateWhenLeavingMonth(
  monthStart: Date,
  monthEnd: Date,
  selectedDate: string | null,
  now: Date,
) {
  const today = new Date(now.getTime());
  today.setHours(0, 0, 0, 0);
  if (today >= monthStart && today < monthEnd) return today;
  if (selectedDate) {
    const selected = toLocalDateFromKey(selectedDate);
    if (selected >= monthStart && selected < monthEnd) return selected;
  }
  return today;
}

function findTimegridSlotLane(root: HTMLElement, timeHm: string) {
  const [hours, minutes] = timeHm.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  const target = hours * 60 + minutes;
  const lanes = [
    ...root.querySelectorAll<HTMLElement>('.fc-timegrid-slot-lane[data-time]'),
  ];
  let match: HTMLElement | null = null;
  for (const lane of lanes) {
    const [laneHours, laneMinutes] = (lane.dataset.time ?? '').split(':').map(Number);
    if (!Number.isFinite(laneHours) || !Number.isFinite(laneMinutes)) continue;
    if (laneHours * 60 + laneMinutes <= target) match = lane;
    else break;
  }
  return match;
}

function columnAtPoint(root: HTMLElement, clientX: number, clientY: number) {
  const columns = root.querySelectorAll<HTMLElement>('.fc-timegrid-col[data-date]');
  for (const column of columns) {
    const box = column.getBoundingClientRect();
    if (
      clientX >= box.left &&
      clientX <= box.right &&
      clientY >= box.top &&
      clientY <= box.bottom
    ) {
      return column;
    }
  }
  return null;
}

function yForTimeHm(root: HTMLElement, timeHm: string, slotLength: number) {
  const lane = findTimegridSlotLane(root, timeHm);
  if (!lane || !slotLength) return null;
  const [hours, minutes] = timeHm.split(':').map(Number);
  const [laneHours, laneMinutes] = (lane.dataset.time ?? '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (!Number.isFinite(laneHours) || !Number.isFinite(laneMinutes)) return null;
  const ratio = Math.min(
    Math.max((hours * 60 + minutes - (laneHours * 60 + laneMinutes)) / slotLength, 0),
    1,
  );
  const box = lane.getBoundingClientRect();
  return box.top + ratio * box.height;
}

function readEmptySlotAtPoint(
  root: HTMLElement,
  clientX: number,
  clientY: number,
  viewType: string,
) {
  if (viewType === 'dayGridMonth') {
    const hit = document.elementFromPoint(clientX, clientY);
    const cell =
      hit instanceof Element
        ? hit.closest<HTMLElement>('.fc-daygrid-day[data-date]')
        : null;
    if (!cell?.dataset.date || !root.contains(cell)) return null;
    return { dateKey: cell.dataset.date, timeHm: null as string | null };
  }

  const column = columnAtPoint(root, clientX, clientY);
  if (!column?.dataset.date) return null;
  const lanes = root.querySelectorAll<HTMLElement>('.fc-timegrid-slot-lane[data-time]');
  let lane: HTMLElement | null = null;
  for (const candidate of lanes) {
    const box = candidate.getBoundingClientRect();
    if (clientY >= box.top && clientY <= box.bottom) {
      lane = candidate;
      break;
    }
  }
  if (!lane?.dataset.time) return null;
  return {
    dateKey: column.dataset.date,
    timeHm: snapTimeHm(lane.dataset.time.slice(0, 5)),
  };
}

function collectVisitEvents(root: HTMLElement, appointmentId: string) {
  const anchor = root.querySelector<HTMLElement>(
    `[data-appointment-id="${appointmentId}"][data-visit-anchor="true"]`,
  );
  const key = anchor?.dataset.visit;
  if (!key) return [];
  return [...root.querySelectorAll<HTMLElement>(`[data-visit="${CSS.escape(key)}"]`)]
    .filter((node) => node.classList.contains('fc-timegrid-event'))
    .sort(
      (left, right) =>
        left.getBoundingClientRect().top - right.getBoundingClientRect().top,
    );
}

function buildVisitMirror(
  root: HTMLElement,
  frame: HTMLDivElement,
  mirrorClass: string,
  sourceClass: string,
  handleClass: string,
) {
  const nodes = collectVisitEvents(root, frame.dataset.appointmentId ?? '');
  if (nodes.length === 0) return null;
  const rects = nodes.map((node) => node.getBoundingClientRect());
  const top = Math.min(...rects.map((rect) => rect.top));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const mirror = document.createElement('div');
  mirror.className = mirrorClass;
  mirror.style.height = `${bottom - top}px`;
  mirror.style.outlineColor = frame.style.borderColor;
  nodes.forEach((node, index) => {
    const clone = node.cloneNode(true);
    if (!(clone instanceof HTMLElement)) return;
    clone.removeAttribute('data-visit');
    clone.removeAttribute('data-visit-anchor');
    clone.removeAttribute('data-appointment-id');
    clone.style.position = 'absolute';
    clone.style.top = `${rects[index].top - top}px`;
    clone.style.left = '0';
    clone.style.right = 'auto';
    clone.style.bottom = 'auto';
    clone.style.width = '100%';
    clone.style.height = `${rects[index].height}px`;
    clone.style.margin = '0';
    mirror.appendChild(clone);
    node.classList.add(sourceClass);
  });
  const handle = document.createElement('div');
  handle.className = handleClass;
  handle.style.borderColor = frame.style.borderColor;
  mirror.appendChild(handle);
  frame.classList.add(sourceClass);
  document.body.appendChild(mirror);
  return { mirror, sources: [...nodes, frame] };
}

function placeVisitMirror(
  mirror: HTMLDivElement,
  root: HTMLElement,
  clientX: number,
  clientY: number,
  slotLength: number,
) {
  const column = columnAtPoint(root, clientX, clientY);
  const host = column?.querySelector<HTMLElement>('.fc-timegrid-col-events');
  const time = readSnappedTimeFromPoint(clientX, clientY, slotLength);
  const top = time ? yForTimeHm(root, time, slotLength) : null;
  if (!host || top == null) {
    mirror.style.visibility = 'hidden';
    return;
  }
  const box = host.getBoundingClientRect();
  mirror.style.visibility = 'visible';
  mirror.style.left = `${box.left}px`;
  mirror.style.width = `${box.width}px`;
  mirror.style.top = `${top}px`;
}

function getSlotDuration(slotDurationMinutes: number | null) {
  const minutes =
    slotDurationMinutes && slotDurationMinutes > 0 ? slotDurationMinutes : 30;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(rest).padStart(2, '0')}:00`;
}

function visitRangeHitsAnotherEvent(
  events: EventApi[],
  nextStart: Date,
  nextEnd: Date,
  ownIds: Set<number>,
) {
  return events.some((event) => {
    if (event.display === 'background' || !event.start) return false;
    const appointmentId = (event.extendedProps as CalendarEventProps).appointmentId;
    if (appointmentId == null || ownIds.has(appointmentId)) return false;
    const eventEnd = event.end ?? event.start;
    return event.start < nextEnd && eventEnd > nextStart;
  });
}

function visitDragOverlaps(
  events: EventApi[],
  origin: {
    appointmentId: number;
    companionAppointmentIds: number[];
    start: Date;
    end: Date | null;
  },
  dateKey: string,
  time: string | null,
  month: boolean,
) {
  const moved = buildDropRange(dateKey, time, origin.start, origin.end, month);
  const ownIds = new Set([origin.appointmentId, ...origin.companionAppointmentIds]);
  let visitEndMs = origin.end?.getTime() ?? origin.start.getTime();
  for (const event of events) {
    const appointmentId = (event.extendedProps as CalendarEventProps).appointmentId;
    if (appointmentId == null || !ownIds.has(appointmentId) || !event.end) continue;
    visitEndMs = Math.max(visitEndMs, event.end.getTime());
  }
  const visitEnd = new Date(
    moved.nextStart.getTime() + (visitEndMs - origin.start.getTime()),
  );
  return {
    moved,
    overlaps: visitRangeHitsAnotherEvent(events, moved.nextStart, visitEnd, ownIds),
  };
}

function darkerVisitTone(color: string): string {
  const channels = color.match(/\d+(?:\.\d+)?/g)?.slice(0, 3).map(Number);
  if (!channels || channels.length < 3) return 'rgb(8, 52, 60)';
  return `rgb(${channels
    .map((channel) => Math.round(Math.min(255, channel * 0.62)))
    .join(', ')})`;
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
  onEventDoubleClick,
  onEventContextMenu,
  onBackgroundClick,
  onSelectedSlotContextMenu,
  onSelectDate,
  onSelectTime,
  selectedTime,
  selectedAppointmentId,
  selectedServiceId,
  selectedDate,
  hasPendingMove,
  onDropRequest,
  onResizeRequest,
  isBlocked,
  workingHours,
  slotDurationMinutes,
  maxAdvBookingDays,
  timezone,
  canEdit,
  statuses,
  visibleFields,
}: CalendarViewProps) {
  const getNow = useCallback(() => nowInTimeZone(timezone), [timezone]);
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
    const start = storedLocation?.date ?? toDateKey(getNow());
    return { start, end: start };
  });
  const [appointmentTip, setAppointmentTip] = useState<{
    appointmentId: number;
    anchor: HoverAnchor;
  } | null>(null);
  const tipTimerRef = useRef<number | null>(null);
  const tipShownIdRef = useRef<number | null>(null);
  const tipPendingIdRef = useRef<number | null>(null);
  const hideAppointmentTipRef = useRef<() => void>(() => {});
  const moveAppointmentTipRef = useRef<
    (props: CalendarEventProps, element: HTMLElement) => void
  >(() => {});
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
  const glideOriginRef = useRef(
    new Map<
      string,
      {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
        view: string;
      }
    >(),
  );
  const toolbarAnchorRef = useRef<number | null>(null);
  const bookingRangeEndRef = useRef<string | null>(null);
  const [calendarViewType, setCalendarViewType] = useState<string>(
    storedLocation?.view ?? (isMobile ? 'timeGridDay' : 'timeGridWeek'),
  );
  const [viewCurrentStartKey, setViewCurrentStartKey] = useState(
    () => storedLocation?.date ?? toDateKey(getNow()),
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
      element.classList.remove('is-selected-day');
      element.classList.toggle(
        'is-closed-day',
        Boolean(dateKey) &&
          isClosedCalendarDay(parsedHours, exceptions, dateKey),
      );
    });
  }, [exceptions, parsedHours]);

  const placeDaySelection = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;

    const placeGlide = (
      host: HTMLElement | null | undefined,
      target: HTMLElement | null,
      className: string,
      alongBottom: boolean,
      frame?: Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>,
    ) => {
      root.querySelectorAll<HTMLElement>(`.${className}`).forEach((node) => {
        if (!host || !target || node.parentElement !== host) node.remove();
      });
      if (!host || !target) return;

      let glide = host.querySelector<HTMLElement>(`:scope > .${className}`);
      const created = !glide;
      if (!glide) {
        glide = document.createElement('div');
        glide.className = className;
        glide.setAttribute('aria-hidden', 'true');
        host.insertBefore(glide, host.firstChild);
      }

      const hostStyle = window.getComputedStyle(host);
      const borderLeft = Number.parseFloat(hostStyle.borderLeftWidth) || 0;
      const borderTop = Number.parseFloat(hostStyle.borderTopWidth) || 0;
      const hostBox = host.getBoundingClientRect();
      const box = frame ?? target.getBoundingClientRect();
      const x = box.left - hostBox.left - borderLeft;
      const y = alongBottom
        ? box.bottom - hostBox.top - borderTop - 4
        : box.top - hostBox.top - borderTop;
      const width = `${box.width}px`;
      const height = alongBottom ? '4px' : `${box.height}px`;
      const transform = `translate(${x}px, ${y}px)`;
      const previous = glideOriginRef.current.get(className);
      const sameView = previous?.view === viewTypeRef.current;
      const crossView = className === styles.viewGlide;
      glide.dataset.endWidth = width;
      glide.dataset.endHeight = height;
      glide.dataset.endTransform = transform;
      if (glide.dataset.glideHold === '1') {
        /* Destination is already stored for the flight that is about to start. */
      } else if (created && previous && (sameView || crossView) && previous.width > 0) {
        const startX = previous.left - hostBox.left - borderLeft;
        const startY = alongBottom
          ? previous.bottom - hostBox.top - borderTop - 4
          : previous.top - hostBox.top - borderTop;
        glide.dataset.glideHold = '1';
        glide.classList.remove(styles.dayGlideReady);
        glide.style.width = `${previous.width}px`;
        glide.style.height = alongBottom ? '4px' : `${previous.height}px`;
        glide.style.transform = `translate(${startX}px, ${startY}px)`;
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (!glide.isConnected) return;
            glide.dataset.glideHold = '';
            glide.classList.add(styles.dayGlideReady);
            glide.style.width = glide.dataset.endWidth || width;
            glide.style.height = glide.dataset.endHeight || height;
            glide.style.transform = glide.dataset.endTransform || transform;
          });
        });
      } else {
        glide.style.width = width;
        glide.style.height = height;
        glide.style.transform = transform;
        if (created) {
          if (alongBottom) glide.style.visibility = 'hidden';
          window.requestAnimationFrame(() => {
            if (!glide.isConnected) return;
            if (alongBottom) {
              placeDaySelection();
              glide.style.visibility = '';
            }
            glide.classList.add(styles.dayGlideReady);
          });
        }
      }
      glideOriginRef.current.set(className, {
        left: box.left,
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        width: box.width,
        height: box.height,
        view: viewTypeRef.current,
      });
    };

    placeGlide(null, null, styles.dayLaneGlide, false);
    placeGlide(null, null, styles.dayHeaderGlide, false);
    const viewGroup = root.querySelector<HTMLElement>(
      '.fc-button-group:has(.fc-dayGridMonth-button)',
    );
    placeGlide(
      viewGroup,
      viewGroup?.querySelector<HTMLElement>('.fc-button-active') ?? null,
      styles.viewGlide,
      false,
    );

    if (selectedAppointmentId != null && !selectedTime) {
      placeGlide(null, null, styles.dayGlide, false);
      return;
    }

    const dateKey = selectedDate ? CSS.escape(selectedDate) : '';
    const timeColumn = dateKey
      ? root.querySelector<HTMLElement>(`.fc-timegrid-col[data-date="${dateKey}"]`)
      : null;
    const dayCell = dateKey
      ? root.querySelector<HTMLElement>(`.fc-daygrid-day[data-date="${dateKey}"]`)
      : null;
    const slotLane = timeColumn && selectedTime
      ? findTimegridSlotLane(root, selectedTime)
      : null;
    const slotHost = timeColumn?.closest<HTMLElement>('.fc-timegrid-cols') ?? null;

    if (timeColumn && slotLane && slotHost) {
      const columnBox = timeColumn.getBoundingClientRect();
      const laneBox = slotLane.getBoundingClientRect();
      placeGlide(slotHost, timeColumn, styles.dayGlide, false, {
        left: columnBox.left,
        top: laneBox.top,
        right: columnBox.right,
        bottom: laneBox.bottom,
        width: columnBox.width,
        height: laneBox.height,
      });
    } else if (!timeColumn && dayCell && viewTypeRef.current === 'dayGridMonth') {
      placeGlide(
        dayCell.closest<HTMLElement>('.fc-daygrid-body'),
        dayCell,
        styles.dayGlide,
        false,
      );
    } else {
      placeGlide(null, null, styles.dayGlide, false);
    }
  }, [selectedAppointmentId, selectedDate, selectedTime]);

  useLayoutEffect(() => {
    placeDaySelection();
  }, [placeDaySelection, events, isMobile]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest(
        '.fc-dayGridMonth-button, .fc-timeGridWeek-button, .fc-timeGridDay-button',
      );
      if (!button) return;
      event.preventDefault();
      const toolbar = root.querySelector('.fc-header-toolbar');
      toolbarAnchorRef.current = toolbar?.getBoundingClientRect().top ?? null;
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const button = target.closest<HTMLElement>(
        '.fc-timeGridWeek-button, .fc-timeGridDay-button',
      );
      if (!button) return;
      const api = calendarRef.current?.getApi();
      if (!api || api.view.type !== 'dayGridMonth') return;
      event.preventDefault();
      event.stopPropagation();
      const nextView = button.classList.contains('fc-timeGridWeek-button')
        ? 'timeGridWeek'
        : 'timeGridDay';
      api.changeView(
        nextView,
        dateWhenLeavingMonth(
          api.view.currentStart,
          api.view.currentEnd,
          selectedDate,
          getNow(),
        ),
      );
    };
    root.addEventListener('mousedown', onMouseDown, true);
    root.addEventListener('click', onClick, true);
    return () => {
      root.removeEventListener('mousedown', onMouseDown, true);
      root.removeEventListener('click', onClick, true);
    };
  }, [getNow, selectedDate]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => placeDaySelection());
    const watch = () => {
      observer.disconnect();
      observer.observe(root);
      root
        .querySelectorAll<HTMLElement>(
          '.fc-scrollgrid-section-header, .fc-timegrid-cols, .fc-daygrid-body, .fc-button-group',
        )
        .forEach((node) => observer.observe(node));
    };
    watch();
    const mutations = new MutationObserver((records) => {
      const onlyGlides = records.every((record) =>
        [...record.addedNodes, ...record.removedNodes].every(
          (node) =>
            node instanceof HTMLElement &&
            (node.classList.contains(styles.dayGlide) ||
              node.classList.contains(styles.dayLaneGlide) ||
              node.classList.contains(styles.dayHeaderGlide) ||
              node.classList.contains(styles.viewGlide)),
        ),
      );
      if (onlyGlides) return;
      watch();
      placeDaySelection();
    });
    mutations.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [placeDaySelection]);

  useEffect(() => {
    applyDayMarks();
  }, [applyDayMarks, events, isMobile]);

  const goToToday = useCallback(() => {
    const today = getNow();
    calendarRef.current?.getApi().today();
    onSelectDate(toDateKey(today));
    onSelectTime?.(null);
  }, [getNow, onSelectDate, onSelectTime]);

  const syncTodayButton = useCallback(() => {
    const root = rootRef.current;
    const api = calendarRef.current?.getApi();
    const button = root?.querySelector<HTMLButtonElement>(
      '.fc-goTodayBtn-button',
    );
    if (!button) return;

    button.title = TODAY_HINT;
    button.setAttribute('aria-label', TODAY_HINT);

    const today = getNow();
    const todayKey = toDateKey(today);
    const viewHasToday = api
      ? api.view.activeStart <= today && today < api.view.activeEnd
      : false;
    button.disabled = selectedDate === todayKey && viewHasToday;
  }, [getNow, selectedDate]);

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
  const activeAppointments = useMemo(
    () => appointments.filter((appointment) => !isCanceledStatus(appointment.status)),
    [appointments],
  );
  const slotRange = useMemo(
    () =>
      getCalendarSlotRange(
        parsedHours,
        exceptions,
        activeAppointments.map((appointment) => ({
          start: appointment.start_time,
          end: appointment.end_time,
        })),
      ),
    [activeAppointments, exceptions, parsedHours],
  );
  const bookingRangeEnd = useMemo(
    () => getBookingRangeEndExclusive(maxAdvBookingDays, getNow()),
    [getNow, maxAdvBookingDays],
  );
  bookingRangeEndRef.current = bookingRangeEnd;
  const navigationRangeEnd = useMemo(() => {
    if (!bookingRangeEnd) return null;
    const lastDate = activeAppointments.reduce(
      (latest, appointment) =>
        appointment.appointment_date > latest ? appointment.appointment_date : latest,
      '',
    );
    const afterLast = lastDate ? addDaysToDateKey(lastDate, 1) : '';
    return afterLast > bookingRangeEnd ? afterLast : bookingRangeEnd;
  }, [activeAppointments, bookingRangeEnd]);

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
      const sourceEvents =
        calendarViewType === 'dayGridMonth' ? collapseVisitsForMonth(events) : events;
      const appointmentEvents = sourceEvents.map((event) => {
        const props = event.extendedProps as CalendarEventProps | undefined;
        const existingNames = Array.isArray(event.classNames)
          ? event.classNames
          : event.classNames
            ? [event.classNames]
            : [];
        const canMove = canEdit && !isCanceledStatus(props?.status ?? '');
        const canResize = canMove && calendarViewType !== 'dayGridMonth';
        const memberIds =
          props?.groupRole === 'combined'
            ? (props.segments?.map((segment) => segment.appointmentId) ??
              (props.appointmentId != null ? [props.appointmentId] : []))
            : props?.appointmentId != null
              ? [props.appointmentId]
              : [];
        const isSelected =
          selectedAppointmentId != null &&
          memberIds.includes(selectedAppointmentId);
        const isFocused =
          isSelected &&
          (props?.groupRole === 'combined' ||
            props?.serviceId === selectedServiceId);
        const classNames = [
          ...existingNames,
          isSelected ? 'event-selected' : '',
          isFocused ? 'event-focused' : '',
        ].filter(Boolean);

        return {
          ...event,
          classNames,
          editable: canMove,
          startEditable: canMove,
          durationEditable: canResize,
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
              classNames: ['closed-day-fill'],
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

          const tentative =
            resolveWorkingDay(parsedHours, exceptions, current)?.tentative ?? [];
          tentative.forEach((range, index) => {
            markers.push({
              id: `tentative-${current}-${index}`,
              title: 'שוקל סגירה',
              start: toLocalDateFromKey(current, range.start),
              end: toLocalDateFromKey(current, range.end),
              display: 'background',
              editable: false,
              overlap: true,
              classNames: ['tentative-fill'],
              extendedProps: { specialDayLabel: true },
            });
          });

          current = addDaysToDateKey(current, 1);
          guard += 1;
        }
      }

      return [...markers, ...appointmentEvents];
    },
    [
      calendarViewType,
      canEdit,
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
    const frame = window.requestAnimationFrame(() => syncVisitFramesRef.current());
    return () => window.cancelAnimationFrame(frame);
  }, [calendarEvents]);

  const slotMinutes =
    slotDurationMinutes && slotDurationMinutes > 0 ? slotDurationMinutes : 30;

  const onDropRequestRef = useRef(onDropRequest);
  const onResizeRequestRef = useRef(onResizeRequest);
  const hasPendingMoveRef = useRef(hasPendingMove);
  const onEventContextMenuRef = useRef(onEventContextMenu);
  const onEventDoubleClickRef = useRef(onEventDoubleClick);
  const appointmentsRef = useRef(appointments);
  const onBackgroundClickRef = useRef(onBackgroundClick);
  const onSelectedSlotContextMenuRef = useRef(onSelectedSlotContextMenu);
  const onSelectDateRef = useRef(onSelectDate);
  const onSelectTimeRef = useRef(onSelectTime);

  useEffect(() => {
    onDropRequestRef.current = onDropRequest;
    onResizeRequestRef.current = onResizeRequest;
    hasPendingMoveRef.current = hasPendingMove;
    onEventContextMenuRef.current = onEventContextMenu;
    onEventDoubleClickRef.current = onEventDoubleClick;
    appointmentsRef.current = appointments;
    onBackgroundClickRef.current = onBackgroundClick;
    onSelectedSlotContextMenuRef.current = onSelectedSlotContextMenu;
    onSelectDateRef.current = onSelectDate;
    onSelectTimeRef.current = onSelectTime;
  }, [
    hasPendingMove,
    onBackgroundClick,
    onDropRequest,
    onResizeRequest,
    onEventContextMenu,
    appointments,
    onEventDoubleClick,
    onSelectedSlotContextMenu,
    onSelectDate,
    onSelectTime,
  ]);

  const slotMinutesRef = useRef(slotMinutes);
  const canEditRef = useRef(canEdit);
  slotMinutesRef.current = slotMinutes;
  canEditRef.current = canEdit;

  const visitFramesRef = useRef(new Map<string, HTMLDivElement>());
  const visitDragRef = useRef<VisitDrag | null>(null);
  const syncVisitFramesRef = useRef<() => void>(() => {});
  const visitDragMoveRef = useRef<(event: PointerEvent) => void>(() => {});
  const visitDragFinishRef = useRef<
    (drag: VisitDrag, clientX: number, clientY: number) => void
  >(() => {});

  const resetVisitFrame = useCallback((frame: HTMLDivElement) => {
    frame.classList.remove(styles.visitFrameMoving);
    frame.style.position = '';
    frame.style.zIndex = '';
  }, []);

  const onVisitHandlePointerDown = useCallback((event: PointerEvent) => {
    if (event.button !== 0 || !canEditRef.current || hasPendingMoveRef.current) return;
    const handle = event.currentTarget;
    if (!(handle instanceof HTMLElement)) return;
    const frame = handle.parentElement;
    if (!(frame instanceof HTMLDivElement)) return;
    const appointmentId = Number(frame.dataset.appointmentId);
    const serviceId = Number(frame.dataset.serviceId);
    if (!appointmentId || !serviceId) return;
    const fcEvent = calendarRef.current?.getApi().getEventById(String(appointmentId));
    if (!fcEvent?.start) return;
    const props = fcEvent.extendedProps as CalendarEventProps;
    const rect = frame.getBoundingClientRect();
    const lane = rootRef.current?.querySelector('.fc-timegrid-slot-lane');
    const slotHeight = lane instanceof HTMLElement ? lane.getBoundingClientRect().height : 0;
    const originMinutes = fcEvent.start.getHours() * 60 + fcEvent.start.getMinutes();
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // The drag still follows pointermove when capture is unavailable.
    }
    event.preventDefault();
    event.stopPropagation();
    const label = [props.clientName, props.timeLabel].filter(Boolean).join(' · ');
    dragOriginRef.current = {
      appointmentId,
      serviceId,
      clientPhone: props.clientPhone ?? null,
      companionAppointmentIds: props.continuationIds ?? [],
      start: fcEvent.start,
      end: fcEvent.end,
      label: label || 'תור',
    };
    document.body.classList.add('featurn-is-event-dragging');
    rootRef.current?.classList.add(styles.isDragging);
    visitDragRef.current = {
      pointerId: event.pointerId,
      originX: event.clientX,
      originY: event.clientY,
      originLeft: rect.left,
      originTop: rect.top,
      frame,
      moved: false,
      appointmentId,
      serviceId,
      clientPhone: props.clientPhone ?? null,
      companionAppointmentIds: props.continuationIds ?? [],
      start: fcEvent.start,
      end: fcEvent.end,
      snappedMinutes: originMinutes,
      slotHeight,
      mirror: null,
      sources: [],
    };
  }, []);

  const onVisitHandlePointerMove = useCallback((event: PointerEvent) => {
    const drag = visitDragRef.current;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const dx = event.clientX - drag.originX;
    const dy = event.clientY - drag.originY;
    if (!drag.moved && Math.hypot(dx, dy) < 4) return;
    drag.moved = true;
    const originMinutes = drag.start.getHours() * 60 + drag.start.getMinutes();
    const pointedTime = readSnappedTimeFromPoint(
      event.clientX,
      event.clientY,
      slotMinutesRef.current,
    );
    if (pointedTime) {
      const [hours, minutes] = pointedTime.split(':').map(Number);
      drag.snappedMinutes = hours * 60 + minutes;
    } else {
      drag.snappedMinutes = snappedVisitMinutes(
        originMinutes,
        dy,
        drag.slotHeight,
        slotMinutesRef.current,
      );
    }
    const root = rootRef.current;
    if (root && !drag.mirror) {
      const built = buildVisitMirror(
        root,
        drag.frame,
        styles.visitMirror,
        styles.visitDragSource,
        styles.visitHandle,
      );
      if (built) {
        drag.mirror = built.mirror;
        drag.sources = built.sources;
      }
    }
    if (root && drag.mirror) {
      placeVisitMirror(drag.mirror, root, event.clientX, event.clientY, slotMinutesRef.current);
    }
    const dateKey = readDateKeyFromPoint(event.clientX, event.clientY);
    const viewType = calendarRef.current?.getApi().view.type ?? viewTypeRef.current;
    const blocked =
      dateKey != null &&
      pointedTime != null &&
      visitDragOverlaps(
        calendarRef.current?.getApi().getEvents() ?? [],
        drag,
        dateKey,
        pointedTime,
        viewType === 'dayGridMonth',
      ).overlaps;
    document.body.classList.toggle('fc-not-allowed', blocked);
    visitDragMoveRef.current(event);
  }, []);

  const onVisitHandlePointerUp = useCallback(
    (event: PointerEvent) => {
      const drag = visitDragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      visitDragRef.current = null;
      const handle = event.currentTarget;
      if (handle instanceof HTMLElement && handle.hasPointerCapture(event.pointerId)) {
        handle.releasePointerCapture(event.pointerId);
      }
      visitDragFinishRef.current(drag, event.clientX, event.clientY);
    },
    [],
  );

  const onVisitHandleMenu = useCallback((event: MouseEvent) => {
    const handle = event.currentTarget;
    if (!(handle instanceof HTMLElement)) return;
    const frame = handle.parentElement;
    if (!(frame instanceof HTMLElement)) return;
    event.preventDefault();
    event.stopPropagation();
    const appointmentId = Number(frame.dataset.appointmentId);
    const serviceId = Number(frame.dataset.serviceId);
    if (!appointmentId || !serviceId || !canEditRef.current) return;
    onEventContextMenuRef.current?.(
      appointmentId,
      serviceId,
      event.clientX,
      event.clientY,
      'visit',
    );
  }, []);

  syncVisitFramesRef.current = () => {
    const root = rootRef.current;
    if (!root) return;
    const seen = new Set<string>();
    if (viewTypeRef.current !== 'dayGridMonth') {
      const groups = new Map<string, HTMLElement[]>();
      for (const node of root.querySelectorAll<HTMLElement>('[data-visit]')) {
        const key = node.dataset.visit;
        if (!key) continue;
        const list = groups.get(key) ?? [];
        list.push(node);
        groups.set(key, list);
      }
      for (const [key, list] of groups) {
        const column = list[0].closest('.fc-timegrid-col-events');
        if (!(column instanceof HTMLElement)) continue;
        seen.add(key);
        const columnRect = column.getBoundingClientRect();
        let top = Infinity;
        let left = Infinity;
        let right = -Infinity;
        let bottom = -Infinity;
        for (const node of list) {
          const rect = node.getBoundingClientRect();
          top = Math.min(top, rect.top);
          left = Math.min(left, rect.left);
          right = Math.max(right, rect.right);
          bottom = Math.max(bottom, rect.bottom);
        }
        if (!Number.isFinite(top) || right <= left || bottom <= top) continue;
        let frame = visitFramesRef.current.get(key);
        if (!frame) {
          frame = document.createElement('div');
          frame.className = styles.visitFrame;
          const handle = document.createElement('div');
          handle.className = styles.visitHandle;
          handle.dataset.visitHandle = 'true';
          handle.setAttribute('role', 'button');
          handle.tabIndex = 0;
          handle.setAttribute('aria-label', 'כל הביקור');
          handle.title = 'גרירה או לחיצה ימנית פועלות על כל הביקור';
          handle.addEventListener('pointerdown', onVisitHandlePointerDown);
          handle.addEventListener('pointermove', onVisitHandlePointerMove);
          handle.addEventListener('pointerup', onVisitHandlePointerUp);
          handle.addEventListener('pointercancel', onVisitHandlePointerUp);
          handle.addEventListener('contextmenu', onVisitHandleMenu);
          frame.appendChild(handle);
          visitFramesRef.current.set(key, frame);
        }
        if (frame.parentElement !== column) column.appendChild(frame);
        const anchor =
          list.find((node) => node.dataset.visitAnchor === 'true') ?? list[0];
        frame.dataset.appointmentId = anchor.dataset.appointmentId ?? '';
        frame.dataset.serviceId = anchor.dataset.serviceId ?? '';
        const handle = frame.querySelector('[data-visit-handle]');
        if (handle instanceof HTMLElement) {
          handle.style.pointerEvents = canEditRef.current ? 'auto' : 'none';
        }
        const tone = darkerVisitTone(getComputedStyle(anchor).backgroundColor);
        frame.style.borderColor = tone;
        if (handle instanceof HTMLElement) handle.style.borderColor = tone;
        if (visitDragRef.current?.frame === frame) continue;
        frame.style.top = `${top - columnRect.top}px`;
        frame.style.left = `${left - columnRect.left}px`;
        frame.style.width = `${right - left}px`;
        frame.style.height = `${bottom - top}px`;
      }
    }
    for (const [key, frame] of visitFramesRef.current) {
      if (seen.has(key)) continue;
      frame.remove();
      visitFramesRef.current.delete(key);
    }
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const schedule = () => {
      window.requestAnimationFrame(() => syncVisitFramesRef.current());
    };
    const observer = new ResizeObserver(schedule);
    observer.observe(root);
    schedule();
    return () => {
      observer.disconnect();
      for (const frame of visitFramesRef.current.values()) frame.remove();
      visitFramesRef.current.clear();
    };
  }, []);

  const hideAppointmentTip = useCallback(() => {
    if (tipTimerRef.current != null) {
      window.clearTimeout(tipTimerRef.current);
      tipTimerRef.current = null;
    }
    tipPendingIdRef.current = null;
    tipShownIdRef.current = null;
    setAppointmentTip(null);
  }, []);

  const moveAppointmentTip = useCallback(
    (props: CalendarEventProps, element: HTMLElement) => {
      if (document.body.classList.contains('featurn-is-event-dragging')) {
        hideAppointmentTip();
        return;
      }
      const target = appointmentAtPointer(props);
      if (tipShownIdRef.current === target.appointmentId) return;
      if (tipPendingIdRef.current === target.appointmentId && tipTimerRef.current != null) {
        return;
      }
      if (tipTimerRef.current != null) {
        window.clearTimeout(tipTimerRef.current);
      }
      const rect = element.getBoundingClientRect();
      const anchor = {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
      };
      tipPendingIdRef.current = target.appointmentId;
      tipTimerRef.current = window.setTimeout(() => {
        tipTimerRef.current = null;
        tipPendingIdRef.current = null;
        tipShownIdRef.current = target.appointmentId;
        setAppointmentTip({ appointmentId: target.appointmentId, anchor });
      }, 420);
    },
    [hideAppointmentTip],
  );

  hideAppointmentTipRef.current = hideAppointmentTip;
  moveAppointmentTipRef.current = moveAppointmentTip;

  useEffect(() => {
    const hide = () => hideAppointmentTip();
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      hide();
    };
  }, [hideAppointmentTip]);

  useEffect(() => {
    if (isLoading || error) return;
    const root = rootRef.current;
    if (!root) return;
    const hide = () => hideAppointmentTip();
    root.addEventListener('scroll', hide, true);
    return () => root.removeEventListener('scroll', hide, true);
  }, [error, hideAppointmentTip, isLoading]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !canEdit) return;

    const onContextMenu = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (
        target.closest(
          '.fc-event, [data-visit-handle], .fc-header-toolbar, .fc-col-header, .fc-timegrid-slot-label, .fc-timegrid-axis, .fc-popover',
        )
      ) {
        return;
      }
      const slot = readEmptySlotAtPoint(
        root,
        event.clientX,
        event.clientY,
        viewTypeRef.current,
      );
      if (!slot) return;
      event.preventDefault();
      onSelectDateRef.current(slot.dateKey);
      onSelectTimeRef.current?.(slot.timeHm);
      onBackgroundClickRef.current?.({
        date: toLocalDateFromKey(slot.dateKey, slot.timeHm ?? '00:00'),
        allDay: slot.timeHm == null,
      });
      onSelectedSlotContextMenuRef.current?.(event.clientX, event.clientY);
    };

    root.addEventListener('contextmenu', onContextMenu);
    return () => root.removeEventListener('contextmenu', onContextMenu);
  }, [canEdit, error, isLoading]);

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
        companionAppointmentIds: origin.companionAppointmentIds,
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
  visitDragMoveRef.current = handleDragMove;
  visitDragFinishRef.current = (drag, clientX, clientY) => {
    drag.mirror?.remove();
    for (const node of drag.sources) node.classList.remove(styles.visitDragSource);
    resetVisitFrame(drag.frame);
    hideDragTooltip();
    hideDragGhost();
    clearDragHot();
    document.body.classList.remove('fc-not-allowed');
    document.body.classList.remove('featurn-is-event-dragging');
    rootRef.current?.classList.remove(styles.isDragging);
    const restore = () => syncVisitFramesRef.current();
    const origin = dragOriginRef.current;
    dragOriginRef.current = null;
    syntheticDragRef.current = false;
    navigatingRef.current = false;
    if (!drag.moved || !origin) {
      restore();
      return;
    }

    const dateKey = readDateKeyFromPoint(clientX, clientY);
    const time = readSnappedTimeFromPoint(clientX, clientY, slotMinutesRef.current);
    const viewType = calendarRef.current?.getApi().view.type ?? viewTypeRef.current;
    if (!dateKey) {
      restore();
      return;
    }

    const { moved, overlaps } = visitDragOverlaps(
      calendarRef.current?.getApi().getEvents() ?? [],
      origin,
      dateKey,
      time,
      viewType === 'dayGridMonth',
    );
    if (overlaps) {
      restore();
      return;
    }

    const applied = requestMoveFromDrag(
      origin,
      moved.nextStart,
      moved.nextEnd,
      restore,
    );
    if (!applied) restore();
  };

  const startDragTracking = useCallback(
    (info: { event: EventApi; jsEvent: MouseEvent }) => {
      hideAppointmentTipRef.current();
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
              companionAppointmentIds: dragCompanionIds(props),
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
      document.body.classList.remove('fc-not-allowed');
    },
    [onDragPointerMove, onDragPointerUp],
  );

  const handleEventOverlap = useCallback(
    (stillEvent: EventApi, movingEvent: EventApi | null) => {
      const movingProps = movingEvent?.extendedProps as
        | CalendarEventProps
        | undefined;
      return allowCalendarEventOverlap({
        stillDisplay: stillEvent.display,
        stillAppointmentId: (stillEvent.extendedProps as CalendarEventProps)
          .appointmentId,
        movingAppointmentId: movingProps?.appointmentId,
        movingStartUnchanged: movingEvent
          ? resizeKeepsStart(movingEvent, movingProps ?? ({} as CalendarEventProps))
          : false,
        continuationIds: movingProps?.continuationIds,
      });
    },
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
            companionAppointmentIds: dragCompanionIds(props),
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

  const handleEventResize = useCallback((info: EventResizeDoneArg) => {
    const start = info.event.start;
    const end = info.event.end;
    const props = info.event.extendedProps as CalendarEventProps;
    if (!start || !end || !props.appointmentId || end.getTime() <= start.getTime()) {
      info.revert();
      return;
    }

    onResizeRequestRef.current({
      revert: () => info.revert(),
      appointmentId: props.appointmentId,
      serviceId: props.serviceId,
      nextStart: start,
      nextEnd: end,
      continuationIds: props.continuationIds ?? [],
    });
  }, []);

  if (isLoading) {
    return <LoadingState message="טוען תורים..." />;
  }

  if (error) {
    return <ErrorState message={error} onRetry={onRetry} />;
  }

  const hoveredAppointment = appointmentTip
    ? appointments.find((candidate) => candidate.id === appointmentTip.appointmentId) ?? null
    : null;

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
                left: canEdit ? 'newAppointmentBtn' : '',
                center: 'prev,title,next',
                right: 'goTodayBtn',
              }
            : {
                left: canEdit
                  ? 'newAppointmentBtn goTodayBtn'
                  : 'goTodayBtn',
                center: 'prev,title,next',
                right: 'dayGridMonth,timeGridWeek,timeGridDay',
              }
        }
        now={getNow}
        events={calendarEvents}
        height="auto"
        stickyHeaderDates
        direction="rtl"
        allDaySlot={false}
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
        eventMinHeight={0}
        validRange={navigationRangeEnd ? { end: navigationRangeEnd } : undefined}
        businessHours={businessHours.length > 0 ? businessHours : undefined}
        eventOverlap={handleEventOverlap}
        slotEventOverlap={false}
        editable={canEdit}
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
          const nextViewType = info.view.type;
          const viewChanged = viewTypeRef.current !== nextViewType;
          viewTypeRef.current = nextViewType;
          applyDayMarks();
          placeDaySelection();
          if (viewChanged) {
            const anchor = toolbarAnchorRef.current;
            const toolbar = rootRef.current?.querySelector('.fc-header-toolbar');
            if (anchor != null && toolbar) {
              window.requestAnimationFrame(() => {
                const shift = toolbar.getBoundingClientRect().top - anchor;
                if (Math.abs(shift) > 1) window.scrollBy(0, shift);
              });
            }
          }
          syncTodayButton();
          window.requestAnimationFrame(() => syncVisitFramesRef.current());
          const currentStartKey = toDateKey(info.view.currentStart);
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
          const dayName = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][arg.date.getDay()];
          const headerLabel = arg.view.type === 'dayGridMonth'
            ? dayName
            : `${arg.date.getDate()}.${arg.date.getMonth() + 1} ${dayName}`;
          return (
            <span className={styles.dayHeaderInner}>
              <span>{headerLabel}</span>
              {holiday ? (
                <span className={styles.holidayNote} title={holiday}>
                  {holiday}
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
          const target = info.jsEvent.target;
          if (target instanceof Element && target.closest('.fc-event')) return;
          onSelectDate(toDateKey(info.date));
          onSelectTime?.(
            info.allDay ? null : snapTimeHm(toTimeHm(info.date)),
          );
          onBackgroundClickRef.current?.({
            date: info.date,
            allDay: info.allDay,
          });
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
        eventResize={handleEventResize}
        eventDidMount={(info) => {
          const props = info.event.extendedProps as CalendarEventProps & {
            specialDayLabel?: boolean;
          };
          if (props?.specialDayLabel || props?.appointmentId == null) return;
          info.el.dataset.appointmentId = String(props.appointmentId);
          info.el.dataset.serviceId = String(props.serviceId);
          if (
            props.segments &&
            props.segments.length > 1 &&
            props.groupRole !== 'combined' &&
            props.groupRole !== 'single'
          ) {
            info.el.dataset.visit = props.segments
              .map((segment) => segment.appointmentId)
              .join('-');
            if (props.groupRole === 'start') info.el.dataset.visitAnchor = 'true';
          } else {
            delete info.el.dataset.visit;
            delete info.el.dataset.visitAnchor;
          }
          const onMenu = (event: Event) => {
            event.preventDefault();
            const mouse = event as MouseEvent;
            const target = appointmentAtPointer(props);
            onEventContextMenuRef.current?.(
              target.appointmentId,
              target.serviceId,
              mouse.clientX,
              mouse.clientY,
            );
          };
          const onDoubleClick = () => {
            const target = appointmentAtPointer(props);
            const appointment = appointmentsRef.current.find(
              (candidate) => candidate.id === target.appointmentId,
            );
            if (appointment) {
              onEventDoubleClickRef.current?.(appointment, target.serviceId);
            }
          };
          const onHover = () => {
            moveAppointmentTipRef.current(props, info.el);
          };
          const onHoverEnd = () => hideAppointmentTipRef.current();
          info.el.addEventListener('mouseenter', onHover);
          info.el.addEventListener('mousemove', onHover);
          info.el.addEventListener('mouseleave', onHoverEnd);
          info.el.addEventListener('pointerdown', onHoverEnd);
          info.el.addEventListener('contextmenu', onMenu);
          info.el.addEventListener('dblclick', onDoubleClick);
          const marked = info.el as HTMLElement & {
            __appointmentMenu?: (event: Event) => void;
            __appointmentDoubleClick?: (event: Event) => void;
            __appointmentHover?: (event: Event) => void;
            __appointmentHoverEnd?: () => void;
          };
          marked.__appointmentMenu = onMenu;
          marked.__appointmentDoubleClick = onDoubleClick;
          marked.__appointmentHover = onHover;
          marked.__appointmentHoverEnd = onHoverEnd;
        }}
        eventWillUnmount={(info) => {
          const el = info.el as HTMLElement & {
            __appointmentMenu?: (event: Event) => void;
            __appointmentDoubleClick?: (event: Event) => void;
            __appointmentHover?: (event: Event) => void;
            __appointmentHoverEnd?: () => void;
          };
          if (el.__appointmentMenu) {
            info.el.removeEventListener('contextmenu', el.__appointmentMenu);
          }
          if (el.__appointmentDoubleClick) {
            info.el.removeEventListener('dblclick', el.__appointmentDoubleClick);
          }
          if (el.__appointmentHover) {
            info.el.removeEventListener('mouseenter', el.__appointmentHover);
            info.el.removeEventListener('mousemove', el.__appointmentHover);
          }
          if (el.__appointmentHoverEnd) {
            info.el.removeEventListener('mouseleave', el.__appointmentHoverEnd);
            info.el.removeEventListener('pointerdown', el.__appointmentHoverEnd);
          }
        }}
        eventContent={(arg: EventContentArg) => {
          if (arg.event.display === 'background') {
            return arg.event.title;
          }

          const props = arg.event.extendedProps as CalendarEventProps;

          return (
            <div className={styles.eventInner}>
              {props.timeLabel ? (
                <span className={styles.eventTime}>{props.timeLabel}</span>
              ) : null}
              {props.serviceTitle ? (
                <span className={styles.eventService}>{props.serviceTitle}</span>
              ) : null}
              {props.clientName &&
              props.groupRole !== 'middle' &&
              props.groupRole !== 'end' ? (
                <span className={styles.eventName}>{props.clientName}</span>
              ) : null}
              {props.holdLabel ? (
                <span className={styles.eventHold}>{props.holdLabel}</span>
              ) : null}
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
          const target = appointmentAtPointer(props);
          const appointment = appointments.find(
            (candidate) => candidate.id === target.appointmentId,
          );
          if (appointment) {
            onEventClick(appointment, target.serviceId);
          }
        }}
      />

      {isBlocked && <WaitingOverlay message="מעדכן תור..." />}
      </div>

      <div
        className={`${styles.dragEdge} ${canDragNext ? '' : styles.dragEdgeDisabled}`}
        data-drag-nav={canDragNext ? 'next' : undefined}
        aria-label={periodNavLabel(calendarViewType, 'next')}
        aria-hidden={canDragNext ? undefined : true}
      >
        <DragEdgeChevron direction="next" />
      </div>

      {hoveredAppointment && appointmentTip ? (
        <AppointmentHoverCard
          appointment={hoveredAppointment}
          statuses={statuses}
          visibleFields={visibleFields}
          anchor={appointmentTip.anchor}
        />
      ) : null}

      {createPortal(
        <>
          <div ref={dragTooltipRef} className={styles.dragTooltip} />
          <div ref={dragGhostRef} className={styles.dragGhost} />
        </>,
        document.body,
      )}
    </div>
  );
}
