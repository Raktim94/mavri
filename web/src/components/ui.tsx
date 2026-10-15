import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

// Toasts (quiet confirmation), an in-app confirm dialog (instead of the
// browser's), and the empty state used by every list.

type ToastKind = 'ok' | 'error';
interface ToastItem {
  id: number;
  kind: ToastKind;
  text: string;
}
interface ConfirmOptions {
  title: string;
  body?: string;
  confirm?: string;
  danger?: boolean;
}
interface Ctx {
  toast: (text: string, kind?: ToastKind) => void;
  confirm: (o: ConfirmOptions) => Promise<boolean>;
}

const UiCtx = createContext<Ctx | null>(null);

export function useUi(): Ctx {
  const v = useContext(UiCtx);
  if (!v) throw new Error('useUi outside UiProvider');
  return v;
}

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [ask, setAsk] = useState<(ConfirmOptions & { done: (ok: boolean) => void }) | null>(null);
  const next = useRef(1);

  const toast = useCallback((text: string, kind: ToastKind = 'ok') => {
    const id = next.current++;
    setToasts(t => [...t, { id, kind, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  }, []);

  const confirm = useCallback(
    (o: ConfirmOptions) => new Promise<boolean>(resolve => setAsk({ ...o, done: resolve })),
    []
  );

  function close(ok: boolean) {
    ask?.done(ok);
    setAsk(null);
  }

  return (
    <UiCtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.kind}`}>
            <span aria-hidden="true">{t.kind === 'ok' ? '✓' : '!'}</span> {t.text}
          </div>
        ))}
      </div>
      {ask && (
        <div className="backdrop" onClick={() => close(false)}>
          <div
            className="card dialog confirm"
            role="alertdialog"
            aria-labelledby="confirm-title"
            onClick={e => e.stopPropagation()}
            onKeyDown={e => e.key === 'Escape' && close(false)}
          >
            <h2 id="confirm-title">{ask.title}</h2>
            {ask.body && <p className="muted">{ask.body}</p>}
            <div className="row end">
              <button autoFocus onClick={() => close(false)}>
                Cancel
              </button>
              <button className={ask.danger ? 'primary danger-fill' : 'primary'} onClick={() => close(true)}>
                {ask.confirm ?? 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </UiCtx.Provider>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action
}: {
  icon: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon name={icon} size={28} />
      </div>
      <h2>{title}</h2>
      <p className="muted">{text}</p>
      {action}
    </div>
  );
}
