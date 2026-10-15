import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Icon, Skeleton } from '../components/Icon';
import { EmptyState } from '../components/ui';
import { isOverdue, statusLabel, today } from '../docs';
import { formatMoney } from '../money';
import { useAuth } from '../auth';
import type { Bank, Party, Summary } from '../types';

const money = (cents: number, r: Summary) =>
  formatMoney(cents, {
    code: r.currencyCode,
    symbol: r.currencySymbol,
    pattern: r.currencyPattern,
    decimals: r.currencyDecimals
  });

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export function DashboardPage() {
  const nav = useNavigate();
  const { user } = useAuth();
  const [docs, setDocs] = useState<Summary[] | null>(null);
  const [issuers, setIssuers] = useState<Party[]>([]);
  const [customers, setCustomers] = useState<Party[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);

  useEffect(() => {
    api
      .get<{ items: Summary[] }>('/api/documents?kind=invoice')
      .then(r => setDocs(r.items))
      .catch(() => setDocs([]));
    api
      .get<Party[]>('/api/parties?kind=issuer')
      .then(setIssuers)
      .catch(() => undefined);
    api
      .get<Party[]>('/api/parties?kind=customer')
      .then(setCustomers)
      .catch(() => undefined);
    api
      .get<Bank[]>('/api/banks')
      .then(setBanks)
      .catch(() => undefined);
  }, []);

  const live = (docs ?? []).filter(d => d.status !== 'void');
  // Money is only added up within one currency: the one used most.
  const used = live.reduce<Record<string, number>>(
    (m, d) => ({ ...m, [d.currencyCode]: (m[d.currencyCode] ?? 0) + 1 }),
    {}
  );
  const main = Object.entries(used).sort((a, b) => b[1] - a[1])[0]?.[0];
  const inMain = live.filter(d => d.currencyCode === main);
  const sample = inMain[0];
  const owed = (d: Summary) => Math.max(d.totalCents - d.paidCents, 0);
  const open = inMain.filter(d => d.status === 'unpaid' || d.status === 'partial');
  const late = open.filter(isOverdue);
  const month = today().slice(0, 7);
  const billed = inMain.filter(d => d.issuedOn.startsWith(month));
  const sum = (rows: Summary[], f: (d: Summary) => number) => rows.reduce((t, d) => t + f(d), 0);
  const m = (c: number) => (sample ? money(c, sample) : '0');

  const steps = [
    { done: issuers.length > 0, label: 'Add your business', to: '/issuers' },
    { done: issuers.some(i => i.logoType !== ''), label: 'Upload your logo', to: '/issuers' },
    { done: banks.length > 0, label: 'Add bank details', to: '/banks' },
    { done: customers.length > 0, label: 'Add a customer', to: '/customers' },
    { done: (docs?.length ?? 0) > 0, label: 'Create your first invoice', to: '/invoices/new' }
  ];
  const doneCount = steps.filter(s => s.done).length;
  const first = (user?.email ?? '').split('@')[0];

  return (
    <section>
      <header className="bar">
        <div className="grow">
          <h1>
            {greeting()}
            {first ? `, ${first}` : ''}
          </h1>
          <p className="muted sub">Here is where your invoicing stands.</p>
        </div>
        <button onClick={() => nav('/quotes/new')}>New quote</button>
        <button className="primary" onClick={() => nav('/invoices/new')}>
          <Icon name="plus" size={16} /> New invoice
        </button>
      </header>

      {doneCount < steps.length && (
        <div className="card checklist">
          <div className="check-head">
            <h2>Get set up</h2>
            <span className="muted">
              {doneCount} of {steps.length} done
            </span>
          </div>
          <div className="progress" aria-hidden="true">
            <i style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
          <ul>
            {steps.map(s => (
              <li key={s.label} className={s.done ? 'done' : undefined}>
                <span className="dot">{s.done ? <Icon name="check" size={14} /> : null}</span>
                {s.done ? s.label : <Link to={s.to}>{s.label}</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {docs === null ? (
        <Skeleton rows={3} />
      ) : (
        <>
          <div className="kpis">
            <div className="kpi">
              <span className="kpi-label">Outstanding</span>
              <strong>{m(sum(open, owed))}</strong>
              <span className="muted">
                {open.length} open invoice{open.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className={`kpi ${late.length ? 'warn' : ''}`}>
              <span className="kpi-label">Overdue</span>
              <strong>{m(sum(late, owed))}</strong>
              <span className="muted">{late.length ? `${late.length} past due` : 'Nothing overdue'}</span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Billed this month</span>
              <strong>{m(sum(billed, d => d.totalCents))}</strong>
              <span className="muted">
                {billed.length} invoice{billed.length === 1 ? '' : 's'}
              </span>
            </div>
            <div className="kpi">
              <span className="kpi-label">Collected</span>
              <strong>{m(sum(inMain, d => d.paidCents))}</strong>
              <span className="muted">
                across {inMain.length} invoice{inMain.length === 1 ? '' : 's'}
              </span>
            </div>
          </div>
          {Object.keys(used).length > 1 && (
            <p className="muted small">Totals are shown in {main}, your most used currency.</p>
          )}

          <div className="card recent">
            <div className="check-head">
              <h2>Recent invoices</h2>
              <Link to="/invoices">View all</Link>
            </div>
            {docs.length === 0 ? (
              <EmptyState
                icon="invoices"
                title="No invoices yet"
                text="Your first invoice takes about a minute."
                action={
                  <button className="primary" onClick={() => nav('/invoices/new')}>
                    New invoice
                  </button>
                }
              />
            ) : (
              <table>
                <tbody>
                  {docs.slice(0, 6).map(r => (
                    <tr key={r.id} onClick={() => nav(`/invoices/${r.id}`)} className="click">
                      <td>
                        <Link to={`/invoices/${r.id}`}>{r.fullNumber}</Link>
                      </td>
                      <td>{r.customerName}</td>
                      <td className="muted">{r.issuedOn}</td>
                      <td className="num">{money(r.totalCents, r)}</td>
                      <td>
                        {isOverdue(r) ? (
                          <span className="badge overdue">Overdue</span>
                        ) : (
                          <span className={`badge ${r.status}`}>{statusLabel[r.status] ?? r.status}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </section>
  );
}
