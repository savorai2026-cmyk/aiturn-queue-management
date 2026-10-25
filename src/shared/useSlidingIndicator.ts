import { useLayoutEffect, useRef, useState } from 'react';

export interface SlidingBox {
  x: number;
  y: number;
  width: number;
}

export function useSlidingIndicator(activeKey: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState<SlidingBox | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let cancelled = false;
    const place = () => {
      if (cancelled) return;
      const current = container.querySelector<HTMLElement>('[aria-current="page"]');
      if (!current) {
        setBox(null);
        return;
      }
      const containerBox = container.getBoundingClientRect();
      const itemBox = current.getBoundingClientRect();
      setBox({
        x: itemBox.left - containerBox.left,
        y: itemBox.bottom - containerBox.top - 2,
        width: itemBox.width,
      });
    };

    place();
    const frame = window.requestAnimationFrame(() => {
      if (!cancelled) setReady(true);
    });
    window.addEventListener('resize', place);
    void document.fonts?.ready.then(place);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', place);
    };
  }, [activeKey]);

  return { containerRef, box, ready };
}
