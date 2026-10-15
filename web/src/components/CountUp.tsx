import { useEffect, useRef, useState } from 'react';

/** Counts a number up to its value (ease-out) so figures feel alive. Shows the final value at once when motion is reduced. */
export function useCountUp(target: number, ms = 700): number {
  const [value, setValue] = useState(() => (matchMedia('(prefers-reduced-motion: reduce)').matches ? target : 0));
  const from = useRef(0);
  const first = useRef(true);
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    const start = first.current ? 0 : from.current;
    first.current = false;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min((now - t0) / ms, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      from.current = start + (target - start) * eased;
      setValue(from.current);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

/** A money figure that counts up. `format` turns whole minor units into text. */
export function CountUp({ cents, format }: { cents: number; format: (cents: number) => string }) {
  return <>{format(Math.round(useCountUp(cents)))}</>;
}
