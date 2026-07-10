import { useEffect, useState } from 'react';

// Counts from 0 to target with an ease-out curve. `restartKey` retriggers it
// (e.g. every time the screen gains focus). `delay` holds at 0 first, so the
// count can start after its card's entrance lands. When disabled, jumps
// straight to target.
export default function useCountUp(
  target,
  { duration = 600, enabled = true, restartKey = 0, delay = 0 } = {}
) {
  const [value, setValue] = useState(enabled ? 0 : target);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return undefined;
    }
    let raf;
    setValue(0);
    const startTicking = () => {
      const start = Date.now();
      const tick = () => {
        const t = Math.min(1, (Date.now() - start) / duration);
        const eased = 1 - Math.pow(1 - t, 3);
        setValue(Math.round(target * eased));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const timer = setTimeout(startTicking, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [target, duration, enabled, restartKey, delay]);

  return value;
}
