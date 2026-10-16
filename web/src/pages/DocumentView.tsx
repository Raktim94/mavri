import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CorrectionDialog } from '../components/CorrectionDialog';
import { EmailDialog } from '../components/EmailDialog';
import { FollowUps } from '../components/FollowUps';
import { RecordPayment } from '../components/RecordPayment';
import { Icon } from '../components/Icon';
import { fmtTime } from '../components/Modal';
import { Paper } from '../components/Paper';
import { RecurringDialog } from '../components/RecurringDialog';
import { ShareDialog } from '../components/ShareDialog';
import { useUi } from '../components/ui';
import { api, ApiError, download, errorText } from '../api';
import { isOverdue, routeOf, statusLabel } from '../docs';
import { useSettings } from '../settings';
import { formatMoney } from '../money';
import type { ActivityEntry, Doc, Kind, MailLogRow, PaymentOption, Summary } from '../types';

type Dialog = '' | 'share' | 'email' | 'remind' | 'repeat' | 'payment' | 'credit' | 'debit';

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
  const [pay, setPay] = useState<PaymentOption[]>([]);
  const [notes, setNotes] = useState<Summary[]>([]);
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const [justSaved, setJustSaved] = useState(Boolean((location.state as { justSaved?: boolean } | null)?.justSaved));

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

  const loadDoc = useCallback(() => {
    api
      .get<Doc>(`/api/documents/${id}`)
      .then(setDoc)
      .catch(e => setError(errorText(e, 'Could not load.')));
    if (kind === 'invoice')
      api
        .get<Summary[]>(`/api/documents/${id}/corrections`)
        .then(setNotes)
        .catch(() => setNotes([]));
    if (kind === 'invoice')
      api
        .get<PaymentOption[]>(`/api/documents/${id}/payment-options`)
        .then(setPay)
        .catch(() => setPay([]));
    loadHistory();
  }, [id, kind, loadHistory]);
  useEffect(loadDoc, [loadDoc]);

  // "Save and share" arrives here with ?share=1: open the share dialog once, then tidy the address.
  useEffect(() => {
    if ((params.get('share') || params.get('remind')) && doc) {
      setDialog(params.get('share') ? 'share' : 'remind');
      params.delete('share');
      params.delete('remind');
      setParams(params, { replace: true });
    }
  }, [params, setParams, doc]);

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

  const isNote = doc.docType === 'credit' || doc.docType === 'debit';
  const draft = doc.status === 'draft';
  const canCorrect = kind === 'invoice' && !isNote && doc.locked && doc.status !== 'void';
  const owed = kind === 'invoice' && doc.docType !== 'credit' && (doc.status === 'unpaid' || doc.status === 'partial');
  const late = isOverdue({ kind, status: doc.status, dueOn: doc.dueOn });
  const balance = Math.max(doc.totals.totalCents - doc.paidCents, 0);

  async function issue() {
    const ok = await confirm({
      title: 'Issue this invoice?',
      body: 'Once issued, the figures and details can no longer be changed. Mistakes are fixed with a credit note or a debit note. You can still record payments and void it.',
      confirm: 'Issue invoice'
    });
    if (!ok) return;
    try {
      setDoc(await api.post<Doc>(`/api/documents/${id}/issue`));
      toast('Invoice issued');
      loadDoc();
    } catch (e) {
      setError(errorText(e, 'Could not issue it.'));
    }
  }

  async function duplicate() {
    try {
      const copy = await api.post<Doc>(`/api/documents/${id}/duplicate`);
      toast('Copied. Adjust it and save.');
      nav(`${base}/${copy.id}/edit`);
    } catch (e) {
      setError(errorText(e, 'Could not copy this document.'));
    }
  }

  return (
    <section>
      <header className="bar noprint">
        <h1>{doc.fullNumber}</h1>
        <Link to={base}>Back</Link>
        {!doc.locked && <Link to={`${base}/${id}/edit`}>Edit</Link>}
        {draft && (
          <button className="primary" onClick={issue}>
            Issue invoice
          </button>
        )}
        {canCorrect && <button onClick={() => setDialog('credit')}>Credit note</button>}
        {canCorrect && <button onClick={() => setDialog('debit')}>Debit note</button>}
        <button className={draft ? undefined : 'primary'} disabled={draft} onClick={() => setDialog('share')}>
          <Icon name="share" /> Share
        </button>
        <button disabled={draft} onClick={() => setDialog('email')}>
          <Icon name="mail" /> Email
        </button>
        {owed && (
          <button onClick={() => setDialog('remind')} className={late ? 'warn-btn' : undefined}>
            <Icon name="bell" /> Remind
          </button>
        )}
        {kind === 'invoice' && !isNote && doc.status !== 'void' && (
          <button onClick={() => setDialog('repeat')}>
            <Icon name="repeat" /> Repeat
          </button>
        )}
        {kind === 'invoice' && !isNote && !draft && features.ubl && (
          <button onClick={() => exportXml('ubl')}>UBL XML</button>
        )}
        {kind === 'invoice' && !isNote && !draft && features.xrechnung && (
          <button onClick={() => exportXml('xrechnung')}>XRechnung XML</button>
        )}
        {kind === 'quote' && doc.status !== 'declined' && !doc.convertedFrom && (
          <button onClick={convert}>Convert to invoice</button>
        )}
        {kind === 'quote' && doc.status === 'open' && (
          <button onClick={() => setStatus('declined')}>Mark declined</button>
        )}
        {kind === 'invoice' && !isNote && doc.status !== 'void' && (
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
      {doc.locked && !isNote && (
        <p className="notice noprint" role="note">
          Issued {doc.issuedAt.slice(0, 10)}: the figures and details are locked. To correct them, issue a credit note
          or a debit note; payments and voiding still work.
        </p>
      )}
      {draft && (
        <p className="notice noprint" role="note">
          This is a draft. It does not count as owed, and cannot be shared or emailed, until you issue it.
        </p>
      )}
      {isNote && doc.corrects && (
        <p className="notice noprint" role="note">
          This {doc.docType === 'credit' ? 'credit' : 'debit'} note corrects{' '}
          <Link to={`/invoices/${doc.corrects}`}>{doc.correctsNumber}</Link>.
        </p>
      )}
      {justSaved && (
        <div className="card receipt noprint" role="status">
          <div>
            <h2>
              {kind === 'invoice' ? 'Invoice' : 'Quote'} {doc.fullNumber} saved
            </h2>
            <p className="muted">
              {doc.customer.name} · {formatMoney(doc.totals.totalCents, doc.currency)}
              {doc.dueOn && ` · ${kind === 'invoice' ? 'due' : 'valid until'} ${doc.dueOn}`} ·{' '}
              {statusLabel[doc.status] ?? doc.status}
            </p>
          </div>
          <div className="row">
            <button className="primary" onClick={() => setDialog('share')}>
              Share link
            </button>
            <button onClick={() => setDialog('email')}>Send by email</button>
            <button onClick={() => window.print()}>Download PDF</button>
            {kind === 'invoice' && <button onClick={() => setDialog('payment')}>Record payment</button>}
            <button onClick={duplicate}>Create similar</button>
            <button className="link" onClick={() => setJustSaved(false)}>
              Dismiss
            </button>
          </div>
        </div>
      )}
      <div className="docsummary noprint">
        <div>
          <span className={`badge ${doc.status}`}>{statusLabel[doc.status] ?? doc.status}</span>
          {late && <span className="badge overdue">Overdue</span>}
        </div>
        <div>
          <small className="muted">Customer</small>
          <strong>{doc.customer.name}</strong>
        </div>
        <div>
          <small className="muted">{kind === 'invoice' ? 'Amount due' : 'Total'}</small>
          <strong>{formatMoney(kind === 'invoice' ? balance : doc.totals.totalCents, doc.currency)}</strong>
        </div>
        {doc.dueOn && (
          <div>
            <small className="muted">{kind === 'invoice' ? 'Due' : 'Valid until'}</small>
            <strong>{doc.dueOn}</strong>
          </div>
        )}
        <div className="next">
          {owed && (
            <button className="primary" onClick={() => setDialog('payment')}>
              Record payment
            </button>
          )}
          <button onClick={duplicate}>Create similar</button>
        </div>
      </div>
      {notes.length > 0 && (
        <div className="card noprint">
          <h2>Credit and debit notes</h2>
          <ul className="notelist">
            {notes.map(n => (
              <li key={n.id}>
                <Link to={`/invoices/${n.id}`}>{n.fullNumber}</Link> ·{' '}
                {n.docType === 'credit' ? 'credit note' : 'debit note'} · {n.issuedOn} ·{' '}
                {formatMoney(n.totalCents, doc.currency)}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Paper doc={doc} pay={pay} />
      {kind === 'invoice' && doc.status !== 'void' && <FollowUps docId={doc.id!} onChange={loadHistory} />}

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
      {dialog === 'payment' && (
        <RecordPayment
          doc={doc}
          onClose={() => setDialog('')}
          onSaved={d => {
            setDoc(d);
            setDialog('');
            toast('Payment recorded');
            loadDoc();
          }}
        />
      )}
      {(dialog === 'credit' || dialog === 'debit') && (
        <CorrectionDialog
          doc={doc}
          kind={dialog}
          onClose={() => setDialog('')}
          onDone={created => {
            setDialog('');
            toast(`${created.fullNumber} issued`);
            nav(`/invoices/${created.id}`);
          }}
        />
      )}
      {dialog === 'repeat' && <RecurringDialog doc={doc} onClose={() => setDialog('')} />}
    </section>
  );
}
