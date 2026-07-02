import { useEffect, useState } from 'react';

/** Belirtilen aralıkla güncellenen "şu an" zaman damgası (ms). */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
