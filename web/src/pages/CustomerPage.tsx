import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, errorText } from '../api';
import { TaxCheck } from '../components/TaxCheck';
import { LANGUAGES } from '../i18n';
import { isOverdue, statusLabel } from '../docs';
import { formatMoney } from '../money';
import type { Party, Summary } from '../types';

interface View {
  invoices: number;
  billedCents: Record<string, number>;
  ageing: Array<{
    currency: string;
    decimals: number;
    owedCents: number;
    buckets: Array<{ label: string; cents: number; count: number }>;
  }>;
  lastInvoiceOn: string;
  lastPaymentOn: string;
  lastContactAt: string;
  openFollowUps: Array<{ id: number; documentId: number; kind: string; note: string; dueOn: string }>;
}

/** One customer: what they owe and how late it is, their invoices, and the details Mavri holds about them. */
export function CustomerPage() {
  const { id } = useParams();
  const [party, setParty] = useState<Party | null>(null);
  const [view, setView] = useState<View | null>(null);
  const [docs, setDocs] = useState<Summary[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      api.get<Party>(`/api/parties/${id}`),
      api.get<View>(`/api/parties/${id}/summary`),
      api.get<{ items: Summary[] }>(`/api/documents?customerId=${id}&limit=500`)
    ])
      .then(([p, v, d]) => {
        setParty(p);
        setView(v);
        setDocs(d.items);
      })
      .catch(e => setError(errorText(e, 'Could not load this customer.')));
  }, [id]);

  if (!party || !view) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  const cur = (code: string, decimals: number) => ({ symbol: '', pattern: '{amount} {code}', decimals, code });
  const lang = LANGUAGES.find(l => l.code === party.language)?.name ?? 'English (default)';

  return (
    <section>
      <header className="bar">
        <div className="grow">
          <h1>{party.name}</h1>
          <p className="muted sub">
            {[party.email, party.phone].filter(Boolean).join(' · ') || 'No contact details yet'}
          </p>
        </div>
        <Link to="/customers">All customers</Link>
        <Link className="btn" to={`/invoices/new`}>
          New invoice
        </Link>
      </header>
      {error && <p className="error">{error}</p>}

      <div className="grid2">
        <div className="card">
          <h2>What they owe</h2>
          {view.ageing.length === 0 ? (
            <p className="muted">Nothing is owed.</p>
          ) : (
            view.ageing.map(a => (
              <div key={a.currency} className="ageing">
                <p>
                  <strong>{formatMoney(a.owedCents, cur(a.currency, a.decimals))}</strong> owed
                </p>
                <table>
                  <tbody>
                    {a.buckets
                      .filter(b => b.count > 0)
                      .map(b => (
                        <tr key={b.label}>
                          <td>{b.label}</td>
                          <td className="num">
                            {b.count} invoice{b.count === 1 ? '' : 's'}
                          </td>
                          <td className="num">{formatMoney(b.cents, cur(a.currency, a.decimals))}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            ))
          )}
          <p className="muted">
            {view.invoices} invoice{view.invoices === 1 ? '' : 's'}
            {Object.entries(view.billedCents)
              .map(([c, v]) => ` · billed ${formatMoney(v, cur(c, 2))}`)
              .join('')}
            {view.lastInvoiceOn && ` · last invoice ${view.lastInvoiceOn}`}
            {view.lastPaymentOn && ` · last payment ${view.lastPaymentOn}`}
            {view.lastContactAt && ` · last contact ${view.lastContactAt.slice(0, 10)}`}
          </p>
        </div>
        <div className="card">
          <h2>Details</h2>
          <dl className="facts-list">
            <dt>Address</dt>
            <dd>{party.address ? party.address.split('\n').join(', ') : '—'}</dd>
            <dt>Country</dt>
            <dd>{party.country || '—'}</dd>
            <dt>Tax number</dt>
            <dd>
              {party.taxId || '—'}
              {party.taxExempt && ' (tax-exempt)'}
            </dd>
            <dt>Documents are written in</dt>
            <dd>{lang}</dd>
            <dt>Payment terms</dt>
            <dd>{party.paymentTermsDays > 0 ? `Net ${party.paymentTermsDays}` : 'Not set'}</dd>
            <dt>Reminders</dt>
            <dd>
              {party.noReminders ? 'Never sent' : 'Automatic'}
              {party.quietFrom &&
                party.quietTo &&
                `, not between ${party.quietFrom} and ${party.quietTo}${party.timezone ? ` (${party.timezone})` : ''}`}
            </dd>
          </dl>
          {party.taxId && <TaxCheck party={party} />}
          <p>
            <Link to="/customers">Edit these details</Link>
          </p>
        </div>
      </div>

      {view.openFollowUps.length > 0 && (
        <div className="card">
          <h2>Open follow-ups</h2>
          <ul>
            {view.openFollowUps.map(f => (
              <li key={f.id}>
                <Link to={`/invoices/${f.documentId}`}>invoice #{f.documentId}</Link>: {f.kind}
                {f.dueOn && ` until ${f.dueOn}`}
                {f.note && ` — ${f.note}`}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h2>Invoices and quotes</h2>
        {docs.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Date</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th className="num">Total</th>
                  <th className="num">Owed</th>
                </tr>
              </thead>
              <tbody>
                {docs.map(d => (
                  <tr key={d.id}>
                    <td>
                      <Link to={`/${d.kind === 'invoice' ? 'invoices' : 'quotes'}/${d.id}`}>{d.fullNumber}</Link>
                      {d.docType && (
                        <small className="muted"> {d.docType === 'credit' ? 'credit note' : 'debit note'}</small>
                      )}
                    </td>
                    <td>{d.issuedOn}</td>
                    <td>{d.dueOn || '—'}</td>
                    <td>
                      <span className={`badge ${d.status}`}>{statusLabel[d.status] ?? d.status}</span>
                      {isOverdue(d) && <span className="badge overdue">Overdue</span>}
                    </td>
                    <td className="num">
                      {formatMoney(d.totalCents, {
                        symbol: '',
                        pattern: '{amount} {code}',
                        decimals: d.currencyDecimals,
                        code: d.currencyCode
                      })}
                    </td>
                    <td className="num">
                      {d.kind === 'invoice' && (d.status === 'unpaid' || d.status === 'partial')
                        ? formatMoney(d.totalCents - d.paidCents, {
                            symbol: '',
                            pattern: '{amount} {code}',
                            decimals: d.currencyDecimals,
                            code: d.currencyCode
                          })
                        : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {docs.some(d => d.kind === 'invoice' && (d.status === 'unpaid' || d.status === 'partial')) && (
        <p className="muted">
          To record what a customer said about an invoice, open it and use <em>Collections</em>.
        </p>
      )}
    </section>
  );
}
