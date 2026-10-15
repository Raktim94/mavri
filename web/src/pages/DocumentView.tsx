import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { EmailDialog } from '../components/EmailDialog';
import { Icon } from '../components/Icon';
import { fmtTime } from '../components/Modal';
import { Paper } from '../components/Paper';
import { RecurringDialog } from '../components/RecurringDialog';
import { ShareDialog } from '../components/ShareDialog';
import { useUi } from '../components/ui';
import { api, ApiError, download, errorText } from '../api';
import { isOverdue, routeOf, statusLabel } from '../docs';
import { useSettings } from '../settings';
import type { ActivityEntry, Doc, Kind, MailLogRow } from '../types';

type Dialog = '' | 'share' | 'email' | 'remind' | 'repeat';

export function DocumentView({ kind }: { kind: Kind }) {
  const { id } = useParams();
  const base = routeOf(kind);
  const nav = useNavigate();
  const { features } = useSettings();
  const { confirm, toast } = useUi();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState('');
  const [problems, setProblems] = useState<string[]>([]);
  const [dialog, setDialog] = useState<Dialog>('');
  const [history, setHistory] = useState<ActivityEntry[]>([]);
  const [mail, setMail] = useState<MailLogRow[]>([]);

  const loadHistory = useCallback(() => {
    api
      .get<{ items: ActivityEntry[] }>(`/api/activity?entity=${kind}&entityId=${id}&limit=15`)
      .then(r => setHistory(r.items))
      .catch(() => undefined);
    api
      .get<MailLogRow[]>(`/api/documents/${id}/mail`)
      .then(setMail)
      .catch(() => undefined);
  }, [id, kind]);

  useEffect(() => {
    api
      .get<Doc>(`/api/documents/${id}`)
      .then(setDoc)
      .catch(e => setError(errorText(e, 'Could not load.')));
    loadHistory();
  }, [id, loadHistory]);

  if (!doc) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;

  async function exportXml(format: 'ubl' | 'xrechnung') {
    setError('');
    setProblems([]);
    try {
      await download(`/api/documents/${id}/einvoice?format=${format}`, `${format}-${doc!.fullNumber}.xml`);
    } catch (e) {
      if (e instanceof ApiError && e.problems.length > 0) {
        setError('This invoice is missing details the e-invoice format needs:');
        setProblems(e.problems);
      } else {
        setError(errorText(e));
      }
    }
  }

  async function convert() {
    try {
      const inv = await api.post<Doc>(`/api/documents/${id}/convert`);
      nav(`/invoices/${inv.id}`);
    } catch (e) {
      setError(errorText(e, 'Could not convert this quote.'));
    }
  }

  async function setStatus(status: string) {
    try {
      setDoc(await api.put<Doc>(`/api/documents/${id}`, { ...doc, status }));
      toast(`Marked ${statusLabel[status] ?? status}`);
      loadHistory();
    } catch (e) {
      setError(errorText(e));
    }
  }

  const owed = kind === 'invoice' && (doc.status === 'unpaid' || doc.status === 'partial');
  const late = isOverdue({ kind, status: doc.status, dueOn: doc.dueOn });

  return (
    <section>
      <header className="bar noprint">
        <h1>{doc.fullNumber}</h1>
        <Link to={base}>Back</Link>
        <Link to={`${base}/${id}/edit`}>Edit</Link>
        <button className="primary" onClick={() => setDialog('share')}>
          <Icon name="share" /> Share
        </button>
        <button onClick={() => setDialog('email')}>
          <Icon name="mail" /> Email
        </button>
        {owed && (
          <button onClick={() => setDialog('remind')} className={late ? 'warn-btn' : undefined}>
            <Icon name="bell" /> Remind
          </button>
        )}
        {kind === 'invoice' && doc.status !== 'void' && (
          <button onClick={() => setDialog('repeat')}>
            <Icon name="repeat" /> Repeat
          </button>
        )}
        {kind === 'invoice' && features.ubl && <button onClick={() => exportXml('ubl')}>UBL XML</button>}
        {kind === 'invoice' && features.xrechnung && (
          <button onClick={() => exportXml('xrechnung')}>XRechnung XML</button>
        )}
        {kind === 'quote' && doc.status !== 'declined' && !doc.convertedFrom && (
          <button onClick={convert}>Convert to invoice</button>
        )}
        {kind === 'quote' && doc.status === 'open' && (
          <button onClick={() => setStatus('declined')}>Mark declined</button>
        )}
        {kind === 'invoice' && doc.status !== 'void' && (
          <button
            onClick={async () =>
              (await confirm({
                title: 'Void this invoice?',
                body: 'It stays in your records but no longer counts as owed.',
                confirm: 'Void invoice',
                danger: true
              })) && setStatus('void')
            }
          >
            Void
          </button>
        )}
        <button onClick={() => window.print()}>Print / save as PDF</button>
      </header>
      {error && (
        <div className="error noprint" role="alert">
          <p>{error}</p>
          {problems.length > 0 && (
            <ul>
              {problems.map(p => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <Paper doc={doc} />

      {(history.length > 0 || mail.length > 0) && (
        <div className="doc-history noprint">
          {mail.length > 0 && (
            <div className="card">
              <h2>Emails</h2>
              <ul className="timeline">
                {mail.map(m => (
                  <li key={m.id} className={m.status}>
                    <span className="when">{fmtTime(m.at)}</span>
                    <span>
                      {m.kind === 'reminder' ? 'Reminder' : 'Sent'} to <strong>{m.to}</strong>
                      {m.status === 'failed' && <em className="error"> — failed: {m.error}</em>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {history.length > 0 && (
            <div className="card">
              <h2>History</h2>
              <ul className="timeline">
                {history.map(h => (
                  <li key={h.id}>
                    <span className="when">{fmtTime(h.at)}</span>
                    <span>
                      <strong>{h.action}</strong>
                      {h.detail && <span className="muted"> — {h.detail}</span>}
                      <small className="muted">
                        {' '}
                        · {h.source}
                        {h.actor ? ` (${h.actor})` : ''}
                      </small>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {dialog === 'share' && (
        <ShareDialog
          doc={doc}
          onClose={() => {
            setDialog('');
            loadHistory();
          }}
          onEmail={() => setDialog('email')}
        />
      )}
      {(dialog === 'email' || dialog === 'remind') && (
        <EmailDialog
          doc={doc}
          kind={dialog === 'remind' ? 'reminder' : 'send'}
          onClose={() => setDialog('')}
          onSent={loadHistory}
        />
      )}
      {dialog === 'repeat' && <RecurringDialog doc={doc} onClose={() => setDialog('')} />}
    </section>
  );
}
