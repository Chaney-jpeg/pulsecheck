/**
 * Custom React hooks for PulseCheck v2.0
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/** Runs `fn` immediately and then again every `intervalMs` milliseconds. */
export function usePolling(fn: () => Promise<void> | void, intervalMs: number, enabled = true) {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const tick = async () => {
      if (!cancelled) await fnRef.current();
    };

    void tick();
    const id = setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [intervalMs, enabled]);
}

/** Persists a value to localStorage under the given key. */
export function useLocalStorage<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  const set = useCallback(
    (v: T) => {
      setValue(v);
      try {
        localStorage.setItem(key, JSON.stringify(v));
      } catch {
        // storage might be unavailable
      }
    },
    [key],
  );

  return [value, set];
}
