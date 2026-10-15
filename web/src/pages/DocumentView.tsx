import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useUi } from '../components/ui';
import { api, ApiError, download, errorText } from '../api';
import { routeOf, statusLabel } from '../docs';
import { formatMoney, gross } from '../money';
import { useSettings } from '../settings';
import type { Doc, Kind } from '../types';

const fonts: Record<string, string> = {
  sans: 'system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, Menlo, Consolas, monospace'
};
const sizes: Record<string, string> = { small: '13px', medium: '15px', large: '17px' };
const logoHeights: Record<string, number> = { small: 40, medium: 64, large: 96 };

const lines = (v: string) => v.split('\n').filter(Boolean);

export function DocumentView({ kind }: { kind: Kind }) {
  const { id } = useParams();
  const base = routeOf(kind);
  const nav = useNavigate();
  const { features } = useSettings();
  const { confirm, toast } = useUi();
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState('');
  const [problems, setProblems] = useState<string[]>([]);

  useEffect(() => {
    api
      .get<Doc>(`/api/documents/${id}`)
      .then(setDoc)
      .catch(e => setError(errorText(e, 'Could not load.')));
  }, [id]);

  if (!doc) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  const money = (c: number) => formatMoney(c, doc.currency);
  const { issuer, customer, bank, style, totals } = doc;
  const hasStyle = Boolean(style?.accent);
  const paper: CSSProperties = {
    ['--accent' as string]: hasStyle ? style.accent : undefined,
    fontFamily: fonts[style?.font] ?? undefined,
    fontSize: sizes[style?.textSize] ?? undefined
  };
  const showNumbers = !hasStyle || style.showNumbers;
  const showUnit = !hasStyle || style.showUnit;
  const showQty = !hasStyle || style.showQty;

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
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <section>
      <header className="bar noprint">
        <h1>{doc.fullNumber}</h1>
        <Link to={base}>Back</Link>
        <Link to={`${base}/${id}/edit`}>Edit</Link>
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
        <button className="primary" onClick={() => window.print()}>
          Print / save as PDF
        </button>
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
      <article
        className={`paper ${style?.headerStyle === 'dark' ? 'dark-head' : ''} ${style?.rowStyle === 'striped' ? 'striped' : ''}`}
        style={paper}
      >
        <div className="paper-head">
          <div className="paper-brand">
            {issuer.logo ? (
              <img
                alt=""
                className="logo"
                style={{ maxHeight: logoHeights[style?.logoSize] ?? 64 }}
                src={`data:${issuer.logoType || 'image/png'};base64,${issuer.logo}`}
              />
            ) : (
              <span className="monogram" aria-hidden="true">
                {(issuer.name || '?').trim().charAt(0).toUpperCase()}
              </span>
            )}
            <strong>{issuer.name}</strong>
          </div>
          <div className="paper-title">
            <h2 style={style?.upperLabels ? { textTransform: 'uppercase' } : undefined}>
              {kind === 'invoice' ? 'Invoice' : 'Quote'}
            </h2>
            <p className="paper-number">{doc.fullNumber}</p>
            <span className={`badge ${doc.status}`}>{statusLabel[doc.status] ?? doc.status}</span>
          </div>
        </div>
        <dl className="paper-meta">
          <div>
            <dt>Issued</dt>
            <dd>{doc.issuedOn}</dd>
          </div>
          {doc.dueOn && (
            <div>
              <dt>{kind === 'invoice' ? 'Due' : 'Valid until'}</dt>
              <dd>{doc.dueOn}</dd>
            </div>
          )}
          <div className="amount">
            <dt>{kind === 'invoice' ? 'Amount due' : 'Total'}</dt>
            <dd>{money(kind === 'invoice' ? Math.max(totals.totalCents - doc.paidCents, 0) : totals.totalCents)}</dd>
          </div>
        </dl>
        <div className="grid2">
          <div className="paper-card">
            <h3>From</h3>
            <p>
              <strong>{issuer.name}</strong>
            </p>
            {lines(issuer.address).map(l => (
              <p key={l}>{l}</p>
            ))}
            <p>{[issuer.email, issuer.phone].filter(Boolean).join(' · ')}</p>
            {issuer.taxId && <p>Tax ID: {issuer.taxId}</p>}
          </div>
          <div className="paper-card">
            <h3>Bill to</h3>
            <p>
              <strong>{customer.name}</strong>
            </p>
            {lines(customer.address).map(l => (
              <p key={l}>{l}</p>
            ))}
            <p>{[customer.email, customer.phone].filter(Boolean).join(' · ')}</p>
            {customer.taxId && <p>Tax ID: {customer.taxId}</p>}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              {showNumbers && <th>#</th>}
              <th>Item</th>
              {showQty && <th className="num">Qty</th>}
              <th className="num">Price</th>
              <th className="num">Tax</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={i}>
                {showNumbers && <td>{i + 1}</td>}
                <td>{l.name}</td>
                {showQty && (
                  <td className="num">
                    {l.quantity}
                    {showUnit && l.unit ? ` ${l.unit}` : ''}
                  </td>
                )}
                <td className="num">{money(l.unitCents)}</td>
                <td className="num">{l.taxRate && l.taxMode ? `${l.taxRate}%` : ''}</td>
                <td className="num">{money(gross(l))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="totals">
          <dt>Subtotal</dt>
          <dd>{money(totals.subtotalCents)}</dd>
          {totals.discountCents > 0 && (
            <>
              <dt>Discount</dt>
              <dd>−{money(totals.discountCents)}</dd>
            </>
          )}
          {totals.surchargeCents > 0 && (
            <>
              <dt>Surcharge</dt>
              <dd>{money(totals.surchargeCents)}</dd>
            </>
          )}
          {totals.shippingCents > 0 && (
            <>
              <dt>Shipping</dt>
              <dd>{money(totals.shippingCents)}</dd>
            </>
          )}
          <dt>Tax</dt>
          <dd>{money(totals.taxCents)}</dd>
          <dt className="big">Total</dt>
          <dd className="big">{money(totals.totalCents)}</dd>
          {doc.payments.length > 0 && (
            <>
              <dt>Paid</dt>
              <dd>{money(doc.paidCents)}</dd>
              <dt className="big">Balance due</dt>
              <dd className="big">{money(Math.max(totals.totalCents - doc.paidCents, 0))}</dd>
            </>
          )}
        </dl>
        {bank?.label && (
          <div className="paper-card">
            <h3>Payment details</h3>
            <p>{[bank.bankName, bank.holder, bank.accountNumber, bank.swift].filter(Boolean).join(' · ')}</p>
          </div>
        )}
        {doc.noteCustomer && <p>{doc.noteCustomer}</p>}
        {doc.noteTerms && <p className="muted">{doc.noteTerms}</p>}
        {doc.noteThanks && <p className="paper-thanks">{doc.noteThanks}</p>}
        <footer className="paper-foot">
          <img src="/mavri-logo.png" alt="" width={16} height={16} />
          Made with Mavri
        </footer>
      </article>
    </section>
  );
}
