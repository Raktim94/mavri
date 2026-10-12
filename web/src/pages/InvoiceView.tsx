import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, type Row } from '../api';
import {
  asNumber,
  currencyOf,
  day,
  itemsOf,
  linesOf,
  paidCents,
  paymentsOf,
  statusLabel,
  text,
  totalsOf,
  type Kind
} from '../invoiceTypes';
import { featureOn, useSettings } from '../settings';
import { formatMoney } from '../money';

const addressLines = (v: unknown) => text(v).split('\n').filter(Boolean);

export function InvoiceView({ kind }: { kind: Kind }) {
  const { id } = useParams();
  const base = kind === 'invoice' ? '/invoices' : '/quotes';
  const nav = useNavigate();
  const [inv, setInv] = useState<Row | null>(null);
  const [error, setError] = useState('');
  const settings = useSettings();

  useEffect(() => {
    api
      .get<Row[]>(`/api/invoices?type=${kind}`)
      .then(all => {
        const hit = all.find(r => String(r.id) === id);
        if (hit) setInv(hit);
        else setError('Not found.');
      })
      .catch(() => setError('Could not load.'));
  }, [id, kind]);

  if (!inv) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  const cur = currencyOf(inv);
  const t = totalsOf(inv);
  const biz = (inv.invoiceBusinessSnapshot ?? {}) as Row;
  const cli = (inv.invoiceClientSnapshot ?? {}) as Row;
  const bank = (inv.invoiceBankSnapshot ?? {}) as Row;
  const lines = linesOf(inv);
  const paid = paidCents(inv);
  const money = (c: number) => formatMoney(c, cur);

  const problems: Record<string, string> = {
    NotSupported: 'This document type is not supported by that e-invoice format.',
    BusinessSchema: 'Add the e-invoice address (scheme and ID) to the business.',
    ClientSchema: 'Add the e-invoice address (scheme and ID) to the client.',
    ClientReference: 'Add a buyer reference to the client.',
    ClientCC: 'Add a country code to the client.',
    BusinessCC: 'Add a country code to the business.',
    DueDate: 'Set a due date.',
    BusinessVATCode: 'Add a tax ID to the business.',
    BusinessEmail: 'Add an email address to the business.',
    BusinessPhone: 'Add a phone number to the business.',
    ClientAddress: 'Add an address to the client.'
  };
  const explain = (key: string) => {
    const m = /^error\.(?:peppol|xrechnung)(\w+)$/.exec(key);
    return (m && problems[m[1]]) || `The e-invoice could not be made (${key}).`;
  };

  async function downloadXml(profile: string) {
    setError('');
    const res = await fetch(`/api/invoices/xml?invoiceId=${id}&einvoice=${profile}`, { credentials: 'same-origin' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(explain(String(body.message ?? res.status)));
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(await res.blob());
    a.download = `${profile}-${text(inv!.invoiceFullNumber)}.xml`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function convert() {
    try {
      const copy: Row = {
        ...inv,
        id: undefined,
        invoiceType: 'invoice',
        status: 'unpaid',
        convertedFromQuotationId: inv!.id,
        invoicePayments: []
      };
      delete copy.id;
      delete copy.invoiceNumber;
      const seq = await api.get<{ formattedSequence: string } | undefined>(
        `/api/invoices/sequence?businessId=${inv!.businessId}&clientId=${inv!.clientId}&invoiceType=invoice`
      );
      const made = await api.post<Row>('/api/invoices', { ...copy, invoiceNumber: seq?.formattedSequence ?? '1' });
      nav(`/invoices/${(Array.isArray(made) ? made[0] : made).id}`);
    } catch {
      setError('Could not convert this quote.');
    }
  }

  return (
    <section>
      <header className="bar noprint">
        <h1>{text(inv.invoiceFullNumber)}</h1>
        <Link to={`${base}`}>Back</Link>
        <Link to={`${base}/${id}/edit`}>Edit</Link>
        {featureOn(settings, 'ublON') && <button onClick={() => downloadXml('ubl21')}>UBL XML</button>}
        {featureOn(settings, 'xrechnungON') && <button onClick={() => downloadXml('xrechnung')}>XRechnung XML</button>}
        {kind === 'quotation' && <button onClick={convert}>Convert to invoice</button>}
        <button className="primary" onClick={() => window.print()}>
          Print / save as PDF
        </button>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <article className="paper">
        <div className="paper-head">
          <div>
            <h2>
              {kind === 'invoice' ? 'Invoice' : 'Quote'} {text(inv.invoiceFullNumber)}
            </h2>
            <p className="muted">
              {day(inv.issuedAt)}
              {inv.dueDate ? ` · ${kind === 'invoice' ? 'Due' : 'Valid until'} ${day(inv.dueDate)}` : ''} ·{' '}
              {statusLabel[text(inv.status)] ?? text(inv.status)}
            </p>
          </div>
          {biz.businessLogo ? (
            <img
              alt=""
              className="logo"
              src={`data:${text(biz.businessFileType) || 'image/png'};base64,${text(biz.businessLogo)}`}
            />
          ) : null}
        </div>
        <div className="grid2">
          <div>
            <h3>From</h3>
            <p>
              <strong>{text(biz.businessName)}</strong>
            </p>
            {addressLines(biz.businessAddress).map((l, i) => (
              <p key={i}>{l}</p>
            ))}
            <p>
              {text(biz.businessEmail)} {text(biz.businessPhone)}
            </p>
            {biz.businessVatCode ? <p>Tax ID: {text(biz.businessVatCode)}</p> : null}
          </div>
          <div>
            <h3>Bill to</h3>
            <p>
              <strong>{text(cli.clientName)}</strong>
            </p>
            {addressLines(cli.clientAddress).map((l, i) => (
              <p key={i}>{l}</p>
            ))}
            <p>
              {text(cli.clientEmail)} {text(cli.clientPhone)}
            </p>
            {cli.clientVatCode ? <p>Tax ID: {text(cli.clientVatCode)}</p> : null}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Item</th>
              <th className="num">Qty</th>
              <th className="num">Price</th>
              <th className="num">Tax</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {itemsOf(inv).map((l, i) => {
              const s = (l.invoiceItemSnapshot ?? {}) as Row;
              return (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{text(s.itemName)}</td>
                  <td className="num">
                    {text(l.quantity)} {text(s.unitName)}
                  </td>
                  <td className="num">{money(asNumber(s.unitPriceCents))}</td>
                  <td className="num">{asNumber(l.taxRate) ? `${asNumber(l.taxRate)}%` : ''}</td>
                  <td className="num">{money(Math.round(lines[i].quantity * lines[i].unitPriceCents))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <dl className="totals">
          <dt>Subtotal</dt>
          <dd>{money(t.subtotal)}</dd>
          {t.discount > 0 && (
            <>
              <dt>Discount</dt>
              <dd>−{money(t.discount)}</dd>
            </>
          )}
          {t.surcharge > 0 && (
            <>
              <dt>Surcharge</dt>
              <dd>{money(t.surcharge)}</dd>
            </>
          )}
          {t.shipping > 0 && (
            <>
              <dt>Shipping</dt>
              <dd>{money(t.shipping)}</dd>
            </>
          )}
          <dt>Tax</dt>
          <dd>{money(t.tax)}</dd>
          <dt className="big">Total</dt>
          <dd className="big">{money(t.total)}</dd>
          {paymentsOf(inv).length > 0 && (
            <>
              <dt>Paid</dt>
              <dd>{money(paid)}</dd>
              <dt className="big">Balance due</dt>
              <dd className="big">{money(Math.max(t.total - paid, 0))}</dd>
            </>
          )}
        </dl>
        {bank.name ? (
          <div>
            <h3>Payment details</h3>
            <p>
              {text(bank.bankName)} · {text(bank.accountHolder)} · {text(bank.accountNumber)} {text(bank.swiftCode)}
            </p>
          </div>
        ) : null}
        {inv.customerNotes ? <p>{text(inv.customerNotes)}</p> : null}
        {inv.termsConditionNotes ? <p className="muted">{text(inv.termsConditionNotes)}</p> : null}
        {inv.thanksNotes ? <p>{text(inv.thanksNotes)}</p> : null}
      </article>
    </section>
  );
}
