import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, errorText } from '../api';
import { Paper } from '../components/Paper';
import { formatMoney } from '../money';
import type { Doc, PaymentOption } from '../types';

/** What a client sees at /d/<token>: the document, to read, print or save as PDF, and for quotes to accept or decline. */
export function PublicDocument({ token }: { token: string }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [gone, setGone] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [thanks, setThanks] = useState('');
  const [options, setOptions] = useState<{ pay: boolean; payAmount: number; einvoice: string[] }>({
    pay: false,
    payAmount: 0,
    einvoice: []
  });
  const [paying, setPaying] = useState(false);
  const [payOpts, setPayOpts] = useState<PaymentOption[]>([]);
  const [help, setHelp] = useState<'' | 'dispute' | 'promise'>('');
  const [promiseOn, setPromiseOn] = useState('');

  useEffect(() => {
    api
      .get<Doc>(`/api/public/documents/${encodeURIComponent(token)}`)
      .then(d => {
        setDoc(d);
        document.title = `${d.kind === 'invoice' ? 'Invoice' : 'Quote'} ${d.fullNumber} · ${d.issuer.name}`;
      })
      .catch(e => (e instanceof ApiError && e.status === 404 ? setGone(true) : setError(errorText(e))));
  }, [token]);

  const loadOptions = useCallback(() => {
    api
      .get<typeof options>(`/api/public/documents/${encodeURIComponent(token)}/options`)
      .then(setOptions)
      .catch(() => undefined);
  }, [token]);
  useEffect(loadOptions, [loadOptions]);
  useEffect(() => {
    api
      .get<PaymentOption[]>(`/api/public/documents/${encodeURIComponent(token)}/payment-options`)
      .then(setPayOpts)
      .catch(() => setPayOpts([]));
  }, [token, doc?.status, doc?.paidCents]);

  async function tell(action: 'dispute' | 'promise') {
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/public/documents/${encodeURIComponent(token)}/respond`, {
        action,
        message,
        date: promiseOn
      });
      setThanks(
        action === 'dispute'
          ? 'Thank you. We have your message and will get back to you.'
          : `Thank you. We have noted that you plan to pay by ${promiseOn}.`
      );
      setHelp('');
      setMessage('');
    } catch (e) {
      setError(errorText(e, 'That did not work. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  // Coming back from the payment page: Stripe tells Mavri a moment later, so check a few times.
  useEffect(() => {
    if (!new URLSearchParams(location.search).get('paid')) return;
    setThanks('Thank you — we are confirming your payment…');
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      try {
        const d = await api.get<Doc>(`/api/public/documents/${encodeURIComponent(token)}`);
        setDoc(d);
        if (d.status === 'paid' || d.status === 'partial') {
          setThanks(
            d.status === 'paid' ? 'Payment received — thank you!' : 'Payment received — thank you. A balance remains.'
          );
          loadOptions();
          clearInterval(t);
        }
      } catch {
        /* keep trying */
      }
      if (tries >= 20) {
        setThanks('Thank you. Your payment can take a few minutes to show up here.');
        clearInterval(t);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [token, loadOptions]);

  async function payNow() {
    setPaying(true);
    setError('');
    try {
      const r = await api.post<{ url: string }>(`/api/public/documents/${encodeURIComponent(token)}/pay`);
      location.assign(r.url);
    } catch (e) {
      setError(errorText(e, 'The payment page could not be opened. Please try again.'));
      setPaying(false);
    }
  }

  async function respond(action: 'accept' | 'decline') {
    setBusy(true);
    setError('');
    try {
      const d = await api.post<Doc>(`/api/public/documents/${encodeURIComponent(token)}/respond`, { action, message });
      setDoc(d);
      setThanks(
        action === 'accept'
          ? 'Thank you — the quote is accepted.'
          : 'The quote was declined. Thank you for letting us know.'
      );
    } catch (e) {
      setError(errorText(e, 'That did not work. Please try again.'));
    } finally {
      setBusy(false);
    }
  }

  if (gone)
    return (
      <main className="public gone">
        <div className="card center-card">
          <h1>This link is not valid any more</h1>
          <p className="muted">The sender may have turned it off. Please ask them for a new one.</p>
        </div>
      </main>
    );
  if (!doc)
    return (
      <main className="public">
        {error ? <p className="error">{error}</p> : <p className="muted center">Loading…</p>}
      </main>
    );

  const owed = doc.kind === 'invoice' ? Math.max(doc.totals.totalCents - doc.paidCents, 0) : 0;
  const pending = doc.kind === 'quote' && doc.status === 'open';
  return (
    <main className="public">
      <header className="public-bar noprint">
        <div className="public-summary">
          <span className="muted">{doc.kind === 'invoice' ? 'Invoice' : 'Quote'} from</span>
          <strong>{doc.issuer.name}</strong>
        </div>
        <div className="public-amount">
          {doc.kind === 'invoice' && doc.status === 'paid' ? (
            <span className="badge paid">Paid — thank you</span>
          ) : (
            <>
              <span className="muted">{doc.kind === 'invoice' ? 'Amount due' : 'Total'}</span>
              <strong>{formatMoney(doc.kind === 'invoice' ? owed : doc.totals.totalCents, doc.currency)}</strong>
            </>
          )}
        </div>
        <div className="public-actions">
          {options.pay && (
            <button className="primary" disabled={paying} onClick={payNow}>
              {paying ? 'Opening…' : `Pay ${formatMoney(options.payAmount, doc.currency)}`}
            </button>
          )}
          <button onClick={() => window.print()}>Print / save as PDF</button>
        </div>
      </header>

      {thanks && (
        <p className="notice ok" role="status">
          {thanks}
        </p>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <Paper doc={doc} pay={payOpts} />
      {options.einvoice.length > 0 && (
        <p className="downloads noprint">
          {options.einvoice.map(f => (
            <a key={f} className="btn" href={`/api/public/documents/${encodeURIComponent(token)}/einvoice?format=${f}`}>
              Download {f === 'ubl' ? 'UBL XML' : 'XRechnung XML'}
            </a>
          ))}
        </p>
      )}

      {pending && (
        <section className="card respond noprint">
          <h2>Your answer</h2>
          <p className="muted">Accepting lets {doc.issuer.name} know they can go ahead. You can add a note.</p>
          <label>
            Note (optional)
            <textarea rows={2} maxLength={500} value={message} onChange={e => setMessage(e.target.value)} />
          </label>
          <div className="row end">
            <button disabled={busy} onClick={() => respond('decline')}>
              Decline
            </button>
            <button className="primary" disabled={busy} onClick={() => respond('accept')}>
              Accept quote
            </button>
          </div>
        </section>
      )}
      {doc.kind === 'invoice' && owed > 0 && doc.status !== 'void' && (
        <section className="card respond noprint">
          <h2>Questions about this invoice?</h2>
          {help === '' ? (
            <div className="row">
              <button onClick={() => setHelp('promise')}>I will pay by a date</button>
              <button onClick={() => setHelp('dispute')}>I need help or want to dispute this</button>
            </div>
          ) : (
            <>
              {help === 'promise' && (
                <label>
                  I will pay by
                  <input
                    type="date"
                    value={promiseOn}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={e => setPromiseOn(e.target.value)}
                    required
                  />
                </label>
              )}
              <label>
                {help === 'dispute' ? 'What is wrong?' : 'Note (optional)'}
                <textarea
                  rows={3}
                  maxLength={500}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  required={help === 'dispute'}
                />
              </label>
              <p className="muted">
                This tells {doc.issuer.name}; it does not change the amount or mark anything paid.
              </p>
              <div className="row end">
                <button onClick={() => setHelp('')}>Cancel</button>
                <button
                  className="primary"
                  disabled={busy || (help === 'promise' && !promiseOn) || (help === 'dispute' && !message.trim())}
                  onClick={() => tell(help)}
                >
                  Send
                </button>
              </div>
            </>
          )}
        </section>
      )}
      {doc.kind === 'quote' && !pending && !thanks && <p className="notice noprint">This quote was {doc.status}.</p>}
    </main>
  );
}
