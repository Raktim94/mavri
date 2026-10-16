import type { CSSProperties } from 'react';
import { statusLabel } from '../docs';
import { formatMoney, gross, lineTax } from '../money';
import { templateOf } from '../templates';
import type { Doc } from '../types';

const fonts: Record<string, string> = {
  sans: 'system-ui, sans-serif',
  serif: 'Georgia, "Times New Roman", serif',
  mono: 'ui-monospace, Menlo, Consolas, monospace'
};
const sizes: Record<string, string> = { small: '13px', medium: '15px', large: '17px' };
const logoHeights: Record<string, number> = { small: 40, medium: 64, large: 96 };

/** Net, tax and rate per tax rate, for the templates that print a summary. */
function summarise(doc: Doc) {
  const by = new Map<number, { rate: number; net: number; tax: number }>();
  for (const l of doc.lines) {
    if (!l.taxMode || !l.taxRate) continue;
    const { net, tax } = lineTax(l);
    const row = by.get(l.taxRate) ?? { rate: l.taxRate, net: 0, tax: 0 };
    row.net += net;
    row.tax += tax;
    by.set(l.taxRate, row);
  }
  return [...by.values()].sort((a, b) => a.rate - b.rate);
}

const lines = (v: string) => v.split('\n').filter(Boolean);

/** The document as printed: used by the editor view and by the client link. */
export function Paper({ doc }: { doc: Doc }) {
  const kind = doc.kind;
  const money = (c: number) => formatMoney(c, doc.currency);
  const { issuer, customer, bank, style, totals } = doc;
  const hasStyle = Boolean(style?.accent);
  const paper: CSSProperties = {
    ['--accent' as string]: hasStyle ? style.accent : undefined,
    fontFamily: fonts[style?.font] ?? undefined,
    fontSize: sizes[style?.textSize] ?? undefined
  };
  const tpl = templateOf(style?.template);
  const taxIdLabel = tpl?.taxIdLabel ?? 'Tax ID';
  const taxByRate = tpl?.taxSummary ? summarise(doc) : [];
  const showNumbers = !hasStyle || style.showNumbers;
  const showUnit = !hasStyle || style.showUnit;
  const showQty = !hasStyle || style.showQty;
  return (
    <article
      className={`paper ${tpl ? `tpl tpl-${tpl.id}` : ''} ${style?.headerStyle === 'dark' ? 'dark-head' : ''} ${style?.rowStyle === 'striped' ? 'striped' : ''}`}
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
            {kind === 'invoice' ? (tpl?.title ?? 'Invoice') : 'Quote'}
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
          {issuer.taxId && (
            <p>
              {taxIdLabel}: {issuer.taxId}
            </p>
          )}
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
          {customer.taxId && (
            <p>
              {taxIdLabel}: {customer.taxId}
            </p>
          )}
        </div>
      </div>
      <table>
        <thead>
          <tr>
            {showNumbers && <th>#</th>}
            <th>Item</th>
            {showQty && <th className="num">Qty</th>}
            <th className="num">Price</th>
            <th className="num">{tpl?.taxLabel ?? 'Tax'}</th>
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
        <dd className="big" data-code={doc.currency.code}>
          {money(totals.totalCents)}
        </dd>
        {doc.payments.length > 0 && (
          <>
            <dt>Paid</dt>
            <dd>{money(doc.paidCents)}</dd>
            <dt className="big">Balance due</dt>
            <dd className="big">{money(Math.max(totals.totalCents - doc.paidCents, 0))}</dd>
          </>
        )}
      </dl>
      {taxByRate.length > 0 && (
        <table className="tax-summary">
          <caption>{tpl?.taxLabel ?? 'Tax'} by rate</caption>
          <thead>
            <tr>
              <th>Rate</th>
              <th className="num">Net</th>
              <th className="num">{tpl?.taxLabel ?? 'Tax'}</th>
              <th className="num">Gross</th>
            </tr>
          </thead>
          <tbody>
            {taxByRate.map(r => (
              <tr key={r.rate}>
                <td>{r.rate}%</td>
                <td className="num">{money(r.net)}</td>
                <td className="num">{money(r.tax)}</td>
                <td className="num">{money(r.net + r.tax)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {tpl?.note && kind === 'invoice' && <p className="muted tpl-note">{tpl.note}</p>}
      {tpl?.schedule && kind === 'invoice' && (
        <div className="paper-card schedule">
          <h3>Payment schedule</h3>
          <dl>
            <dt>Invoice total</dt>
            <dd>{money(totals.totalCents)}</dd>
            <dt>Received so far</dt>
            <dd>{money(doc.paidCents)}</dd>
            <dt className="big">Due now</dt>
            <dd className="big">{money(Math.max(totals.totalCents - doc.paidCents, 0))}</dd>
          </dl>
        </div>
      )}
      {doc.payments.length > 0 && (
        <div className="paper-card pay-history">
          <h3>Payments received</h3>
          <ul>
            {doc.payments.map((p, i) => (
              <li key={i}>
                <span>{p.paidOn}</span>
                <span className="muted">{p.method}</span>
                <strong>{money(p.amountCents)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      {bank?.label && (
        <div className="paper-card">
          <h3>Payment details</h3>
          <p>{[bank.bankName, bank.holder, bank.accountNumber, bank.swift].filter(Boolean).join(' · ')}</p>
        </div>
      )}
      {doc.noteCustomer && <p>{doc.noteCustomer}</p>}
      {doc.noteTerms && <p className="muted">{doc.noteTerms}</p>}
      {doc.noteThanks && <p className="paper-thanks">{doc.noteThanks}</p>}
      {tpl?.signature && (
        <div className="signature">
          <span className="sig-line" />
          <span>Authorised signatory, {issuer.name}</span>
        </div>
      )}
      <footer className="paper-foot">
        <img src="/mavri-logo.png" alt="" width={16} height={16} />
        Made with Mavri
      </footer>
    </article>
  );
}
