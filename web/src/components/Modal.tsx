import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

const LEAVE_MS = 160;

/** A dialog that fades in and out, closes on Escape or a click outside, and keeps focus inside. */
export function Modal({
  title,
  onClose,
  children,
  wide
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const [leaving, setLeaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setLeaving(true);
    setTimeout(onClose, matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : LEAVE_MS);
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>('input, textarea, select, button:not(.modal-x)');
    (first ?? box.current)?.focus(); // content may still be loading: keep keyboard focus inside the dialog
    document.body.classList.add('modal-open');
    return () => {
      document.body.classList.remove('modal-open');
      previous?.focus?.();
    };
  }, []);

  // Escape works wherever the focus is, as long as the dialog is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [close]);

  function onKeyDown(e: { key: string; shiftKey: boolean; preventDefault: () => void }) {
    if (e.key !== 'Tab' || !box.current) return;
    const items = [
      ...box.current.querySelectorAll<HTMLElement>(
        'a[href], button:not(:disabled), input:not(:disabled), textarea, select'
      )
    ];
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  return (
    <div className={`backdrop ${leaving ? 'leaving' : ''}`} onClick={close}>
      <div
        ref={box}
        className={`card dialog modal ${wide ? 'wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <header className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="modal-x" aria-label="Close" onClick={close}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}

/** Copy text to the clipboard; false if the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const t = document.createElement('textarea');
    t.value = text;
    t.style.position = 'fixed';
    t.style.opacity = '0';
    document.body.appendChild(t);
    t.select();
    const ok = document.execCommand('copy');
    t.remove();
    return ok;
  }
}

export const fmtTime = (iso: string) => (iso ? iso.replace('T', ' ').slice(0, 16) : '');

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
