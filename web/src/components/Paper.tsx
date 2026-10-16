import type { CSSProperties } from 'react';
import { formatDate, formatMoneyIn, isRtl, labelsFor, type Key } from '../i18n';
import { gstSplit } from '../lib/gst';
import { formatMoney, gross, lineTax } from '../money';
import { templateOf } from '../templates';
import type { Doc, PaymentOption } from '../types';
import { PayBlock } from './PayBlock';

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
export function Paper({ doc, pay }: { doc: Doc; pay?: PaymentOption[] }) {
  const kind = doc.kind;
  const { issuer, customer, bank, style, totals } = doc;
  // The language is the customer's. A document written before languages existed has none and prints as before.
  const lang = customer?.language ?? '';
  const t = labelsFor(lang);
  const rtl = isRtl(lang);
  const money = (c: number) =>
    formatMoneyIn(c, doc.currency.decimals, doc.currency.code, lang) ?? formatMoney(c, doc.currency);
  const day = (iso: string) => formatDate(iso, lang);
  const status = (k: string) =>
    ['unpaid', 'partial', 'paid', 'void', 'open', 'accepted', 'declined'].includes(k) ? t(k as Key) : k;
  const titleKey: Record<string, Key> = {
    Invoice: 'invoice',
    'Tax invoice': 'taxInvoice',
    'VAT invoice': 'vatInvoice',
    Receipt: 'receipt'
  };
  const hasStyle = Boolean(style?.accent);
  const paper: CSSProperties = {
    ['--accent' as string]: hasStyle ? style.accent : undefined,
    fontFamily: fonts[style?.font] ?? undefined,
    fontSize: sizes[style?.textSize] ?? undefined
  };
  const tpl = templateOf(style?.template);
  const taxIdLabel = !tpl || tpl.taxIdLabel === 'Tax ID' ? t('taxId') : tpl.taxIdLabel;
  const gst = tpl?.id.startsWith('gst-india') ? gstSplit(issuer.taxId, customer.taxId) : null;
  const taxByRate = tpl?.taxSummary ? summarise(doc) : [];
  const showNumbers = !hasStyle || style.showNumbers;
  const showUnit = !hasStyle || style.showUnit;
  const showQty = !hasStyle || style.showQty;
  return (
    <article
      className={`paper ${tpl ? `tpl tpl-${tpl.id}` : ''} ${style?.headerStyle === 'dark' ? 'dark-head' : ''} ${style?.rowStyle === 'striped' ? 'striped' : ''}`}
      style={paper}
      dir={rtl ? 'rtl' : undefined}
      lang={lang || undefined}
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
            {kind === 'invoice' ? t(titleKey[tpl?.title ?? 'Invoice'] ?? 'invoice') : t('quote')}
          </h2>
          <p className="paper-number">{doc.fullNumber}</p>
          <span className={`badge ${doc.status}`}>{status(doc.status)}</span>
        </div>
      </div>
      <dl className="paper-meta">
        <div>
          <dt>{t('issued')}</dt>
          <dd>{day(doc.issuedOn)}</dd>
        </div>
        {doc.dueOn && (
          <div>
            <dt>{kind === 'invoice' ? t('due') : t('validUntil')}</dt>
            <dd>{day(doc.dueOn)}</dd>
          </div>
        )}
        <div className="amount">
          <dt>{kind === 'invoice' ? t('amountDue') : t('total')}</dt>
          <dd>{money(kind === 'invoice' ? Math.max(totals.totalCents - doc.paidCents, 0) : totals.totalCents)}</dd>
        </div>
      </dl>
      <div className="grid2">
        <div className="paper-card">
          <h3>{t('from')}</h3>
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
          <h3>{t('billTo')}</h3>
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
            <th>{t('item')}</th>
            {showQty && <th className="num">{t('qty')}</th>}
            <th className="num">{t('price')}</th>
            <th className="num">{tpl?.taxLabel && tpl.taxLabel !== 'Tax' ? tpl.taxLabel : t('tax')}</th>
            <th className="num">{t('amount')}</th>
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
        <dt>{t('subtotal')}</dt>
        <dd>{money(totals.subtotalCents)}</dd>
        {totals.discountCents > 0 && (
          <>
            <dt>{t('discount')}</dt>
            <dd>−{money(totals.discountCents)}</dd>
          </>
        )}
        {totals.surchargeCents > 0 && (
          <>
            <dt>{t('surcharge')}</dt>
            <dd>{money(totals.surchargeCents)}</dd>
          </>
        )}
        {totals.shippingCents > 0 && (
          <>
            <dt>{t('shipping')}</dt>
            <dd>{money(totals.shippingCents)}</dd>
          </>
        )}
        <dt>{t('tax')}</dt>
        <dd>{money(totals.taxCents)}</dd>
        <dt className="big">{t('total')}</dt>
        <dd className="big" data-code={doc.currency.code}>
          {money(totals.totalCents)}
        </dd>
        {doc.payments.length > 0 && (
          <>
            <dt>{t('paid')}</dt>
            <dd>{money(doc.paidCents)}</dd>
            <dt className="big">{t('balanceDue')}</dt>
            <dd className="big">{money(Math.max(totals.totalCents - doc.paidCents, 0))}</dd>
          </>
        )}
      </dl>
      {taxByRate.length > 0 && (
        <table className="tax-summary">
          <caption>
            {tpl?.taxLabel ?? t('tax')} {t('byRate')}
          </caption>
          <thead>
            <tr>
              <th>{t('rate')}</th>
              <th className="num">{t('net')}</th>
              {gst === 'intra' ? (
                <>
                  <th className="num">CGST</th>
                  <th className="num">SGST</th>
                </>
              ) : gst === 'inter' ? (
                <th className="num">IGST</th>
              ) : (
                <th className="num">{tpl?.taxLabel ?? t('tax')}</th>
              )}
              <th className="num">{t('gross')}</th>
            </tr>
          </thead>
          <tbody>
            {taxByRate.map(r => {
              const half = Math.floor(r.tax / 2);
              return (
                <tr key={r.rate}>
                  <td>{gst === 'intra' ? `${r.rate / 2}% + ${r.rate / 2}%` : `${r.rate}%`}</td>
                  <td className="num">{money(r.net)}</td>
                  {gst === 'intra' ? (
                    <>
                      <td className="num">{money(half)}</td>
                      <td className="num">{money(r.tax - half)}</td>
                    </>
                  ) : (
                    <td className="num">{money(r.tax)}</td>
                  )}
                  <td className="num">{money(r.net + r.tax)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {tpl?.note && kind === 'invoice' && <p className="muted tpl-note">{tpl.note}</p>}
      {tpl?.schedule && kind === 'invoice' && (
        <div className="paper-card schedule">
          <h3>{t('schedule')}</h3>
          <dl>
            <dt>{t('invoiceTotal')}</dt>
            <dd>{money(totals.totalCents)}</dd>
            <dt>{t('receivedSoFar')}</dt>
            <dd>{money(doc.paidCents)}</dd>
            <dt className="big">{t('dueNow')}</dt>
            <dd className="big">{money(Math.max(totals.totalCents - doc.paidCents, 0))}</dd>
          </dl>
        </div>
      )}
      {doc.payments.length > 0 && (
        <div className="paper-card pay-history">
          <h3>{t('paymentsReceived')}</h3>
          <ul>
            {doc.payments.map((p, i) => (
              <li key={i}>
                <span>{day(p.paidOn)}</span>
                <span className="muted">{p.method}</span>
                <strong>{money(p.amountCents)}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      {bank?.label && !(pay && pay.length > 0) && (
        <div className="paper-card">
          <h3>{t('paymentDetails')}</h3>
          <p>{[bank.bankName, bank.holder, bank.accountNumber, bank.swift].filter(Boolean).join(' · ')}</p>
        </div>
      )}
      {pay && pay.length > 0 && <PayBlock options={pay} currency={doc.currency} title={t('howToPay')} />}
      {doc.noteCustomer && <p>{doc.noteCustomer}</p>}
      {doc.noteTerms && <p className="muted">{doc.noteTerms}</p>}
      {doc.noteThanks && <p className="paper-thanks">{doc.noteThanks}</p>}
      {tpl?.signature && (
        <div className="signature">
          <span className="sig-line" />
          <span>
            {t('signatory')}, {issuer.name}
          </span>
        </div>
      )}
      <footer className="paper-foot">
        <img src="/mavri-logo.png" alt="" width={16} height={16} />
        {t('madeWith')}
      </footer>
    </article>
  );
}
