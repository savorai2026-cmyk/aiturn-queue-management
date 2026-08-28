import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { HelpIcon } from './icons';
import styles from './HelpTip.module.css';

interface HelpTipProps {
  text: string;
  label?: string;
  variant?: 'default' | 'onDark';
}

const VIEW_MARGIN = 8;
const GAP = 8;
const MAX_WIDTH = 260;

function placeTooltip(trigger: HTMLElement, tooltip: HTMLElement) {
  const rect = trigger.getBoundingClientRect();
  const maxWidth = Math.min(MAX_WIDTH, window.innerWidth - VIEW_MARGIN * 2);
  tooltip.style.maxWidth = `${maxWidth}px`;

  const tipRect = tooltip.getBoundingClientRect();
  const tipWidth = Math.min(tipRect.width, maxWidth);
  const tipHeight = tipRect.height;
  const spaceBelow = window.innerHeight - rect.bottom - VIEW_MARGIN;
  const spaceAbove = rect.top - VIEW_MARGIN;

  let top = rect.bottom + GAP;
  if (tipHeight > spaceBelow && spaceAbove > spaceBelow) {
    top = rect.top - GAP - tipHeight;
  }
  top = Math.min(
    Math.max(top, VIEW_MARGIN),
    window.innerHeight - VIEW_MARGIN - tipHeight,
  );

  const spaceOnRight = window.innerWidth - rect.left - VIEW_MARGIN;
  const spaceOnLeft = rect.right - VIEW_MARGIN;
  let left =
    spaceOnRight >= tipWidth || spaceOnRight >= spaceOnLeft
      ? rect.left
      : rect.right - tipWidth;
  left = Math.min(
    Math.max(left, VIEW_MARGIN),
    window.innerWidth - VIEW_MARGIN - tipWidth,
  );

  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
  tooltip.style.visibility = 'visible';
}

export default function HelpTip({
  text,
  label = 'הסבר',
  variant = 'default',
}: HelpTipProps) {
  const tooltipId = useId();
  const rootRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [pinned, setPinned] = useState(false);
  const [hovered, setHovered] = useState(false);
  const isOpen = pinned || hovered;

  useLayoutEffect(() => {
    const trigger = triggerRef.current;
    const tooltip = tooltipRef.current;
    if (!isOpen || !trigger || !tooltip) return;

    const update = () => placeTooltip(trigger, tooltip);
    update();

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [isOpen, text]);

  useEffect(() => {
    if (!pinned) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node) &&
          !tooltipRef.current?.contains(event.target as Node)) {
        setPinned(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPinned(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [pinned]);

  return (
    <span
      ref={rootRef}
      className={styles.root}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.trigger} ${variant === 'onDark' ? styles.onDark : ''}`}
        aria-label={label}
        aria-expanded={isOpen}
        aria-controls={tooltipId}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setPinned((open) => !open);
        }}
      >
        <HelpIcon />
      </button>
      {isOpen &&
        createPortal(
          <span
            ref={tooltipRef}
            id={tooltipId}
            role="tooltip"
            className={styles.tooltip}
          >
            {text}
          </span>,
          document.body,
        )}
    </span>
  );
}
