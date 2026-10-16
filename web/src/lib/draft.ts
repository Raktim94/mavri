import { useEffect, useRef, useState } from 'react';

/**
 * Keeps an unsaved document in this browser so a refresh or an accidental
 * navigation does not lose it. Browser storage can be blocked, so every call
 * is allowed to fail quietly.
 */
const key = (k: string) => `mavri.draft.${k}`;

export function loadDraft<T>(k: string): { value: T; at: string } | null {
  try {
    const raw = localStorage.getItem(key(k));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearDraft(k: string) {
  try {
    localStorage.removeItem(key(k));
  } catch {
    // nothing to clear
  }
}

export type SaveState = 'idle' | 'saving' | 'saved';

/** Saves `value` shortly after it stops changing. Reports the state for a live region. */
export function useDraft<T>(k: string, value: T | null, enabled: boolean) {
  const [state, setState] = useState<SaveState>('idle');
  const [at, setAt] = useState('');
  const first = useRef(true);
  useEffect(() => {
    if (!enabled || value === null) return;
    if (first.current) {
      first.current = false; // the freshly loaded or restored value is not a change
      return;
    }
    setState('saving');
    const t = setTimeout(() => {
      const stamp = new Date().toISOString();
      try {
        localStorage.setItem(key(k), JSON.stringify({ value, at: stamp }));
        setAt(stamp);
        setState('saved');
      } catch {
        setState('idle');
      }
    }, 600);
    return () => clearTimeout(t);
  }, [k, value, enabled]);
  return { state, at };
}
