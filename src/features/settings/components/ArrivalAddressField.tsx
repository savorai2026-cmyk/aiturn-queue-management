import { useEffect, useId, useRef, useState } from 'react';
import {
  mapEmbedSrc,
  pointFromWazeUrl,
  searchAddressSuggestions,
  wazeUrlForPoint,
  type AddressSuggestion,
  type MapPoint,
} from '../arrivalAddress';
import styles from './ArrivalAddressField.module.css';

interface ArrivalAddressFieldProps {
  id: string;
  address: string;
  wazeUrl: string;
  inputClassName: string;
  onChange: (next: { address: string; wazeUrl: string }) => void;
}

export default function ArrivalAddressField({
  id,
  address,
  wazeUrl,
  inputClassName,
  onChange,
}: ArrivalAddressFieldProps) {
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  const [query, setQuery] = useState(address);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [point, setPoint] = useState<MapPoint | null>(() => pointFromWazeUrl(wazeUrl));
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'searching' | 'miss'>('idle');
  const knownAddress = useRef(address);
  const pointRef = useRef(point);
  onChangeRef.current = onChange;
  pointRef.current = point;

  useEffect(() => {
    if (address === knownAddress.current) return;
    knownAddress.current = address;
    setQuery(address);
    setPoint(pointFromWazeUrl(wazeUrl));
    setEditing(false);
    setStatus('idle');
  }, [address, wazeUrl]);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setStatus('idle');
      return;
    }
    if (!editing && pointRef.current) return;

    const controller = new AbortController();
    setStatus('searching');
    const timer = window.setTimeout(() => {
      void searchAddressSuggestions(trimmed, controller.signal)
        .then((next) => {
          if (controller.signal.aborted) return;
          setSuggestions(next);
          setActiveIndex(0);
          const best = next[0];
          if (!best) {
            setPoint(null);
            setStatus('miss');
            onChangeRef.current({ address: query, wazeUrl: '' });
            return;
          }
          setPoint(best.point);
          setStatus('idle');
          onChangeRef.current({
            address: query,
            wazeUrl: wazeUrlForPoint(best.point),
          });
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setSuggestions([]);
          setPoint(null);
          setStatus('miss');
        });
    }, 400);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [editing, query]);

  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, []);

  const choose = (suggestion: AddressSuggestion) => {
    knownAddress.current = suggestion.label;
    setEditing(false);
    setOpen(false);
    setSuggestions([]);
    setQuery(suggestion.label);
    setPoint(suggestion.point);
    setStatus('idle');
    onChange({
      address: suggestion.label,
      wazeUrl: wazeUrlForPoint(suggestion.point),
    });
  };

  return (
    <div className={styles.wrap} ref={rootRef}>
      <div className={styles.row}>
        <input
          id={id}
          type="text"
          className={inputClassName}
          value={query}
          autoComplete="off"
          role="combobox"
          aria-expanded={open && suggestions.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          placeholder="רחוב, מספר, עיר"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            const next = event.target.value;
            knownAddress.current = next;
            setEditing(true);
            setOpen(true);
            setQuery(next);
            setStatus(next.trim().length >= 2 ? 'searching' : 'idle');
            if (next.trim().length < 2) setPoint(null);
            onChange({ address: next, wazeUrl: '' });
          }}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setOpen(false);
              return;
            }
            if (!open || suggestions.length === 0) return;
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % suggestions.length);
            } else if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => (index - 1 + suggestions.length) % suggestions.length);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              const suggestion = suggestions[activeIndex] ?? suggestions[0];
              if (suggestion) choose(suggestion);
            }
          }}
        />
      </div>
      {open && suggestions.length > 0 ? (
        <ul id={listId} className={styles.suggestions} role="listbox">
          {suggestions.map((suggestion, index) => (
            <li key={`${suggestion.label}-${suggestion.point.lat}-${suggestion.point.lon}`}>
              <button
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={styles.suggestion}
                onClick={() => choose(suggestion)}
              >
                {suggestion.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {status === 'searching' ? <p className={styles.status}>מאתר את הכתובת…</p> : null}
      {status === 'miss' ? <p className={styles.status}>לא נמצאה נקודה לכתובת הזו.</p> : null}
      {point ? (
        <iframe
          key={`${point.lat},${point.lon}`}
          className={styles.map}
          title="מפת הכתובת"
          src={mapEmbedSrc(point)}
          loading="lazy"
        />
      ) : null}
    </div>
  );
}
