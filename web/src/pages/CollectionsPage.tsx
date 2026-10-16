import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, errorText } from '../api';
import { formatMoney } from '../money';
import type { Attention, AttentionItem } from '../types';

const REASONS: Array<{ id: AttentionItem['reason']; label: string }> = [
  { id: 'disputed', label: 'Disputed' },
  { id: 'broken_promise', label: 'Promise missed' },
  { id: 'delivery_failed', label: 'Email failed' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'due_soon', label: 'Due soon' },
  { id: 'partial', label: 'Part paid' },
  { id: 'promised', label: 'Promised' }
];
const label = (r: string) => REASONS.find(x => x.id === r)?.label ?? r;

/** The daily list of unpaid invoices that need a person, most urgent first. */
export function CollectionsPage() {
  const [data, setData] = useState<Attention | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('');

  useEffect(() => {
    api
      .get<Attention>('/api/attention')
      .then(setData)
      .catch(e => setError(errorText(e, 'Could not load the list.')));
  }, []);

  if (!data) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  const shown = data.items.filter(i => !filter || i.reason === filter);
  const owed = new Map<string, number>();
  for (const i of data.items) owed.set(i.currency, (owed.get(i.currency) ?? 0) + i.balanceCents);

  return (
    <section>
      <header className="bar">
        <h1>Needs attention</h1>
      </header>
      <p className="muted">
        Unpaid invoices that need a person today. Mavri lists them and suggests a next step; it sends nothing on its own
        from here and never adds late fees or interest.
      </p>
      <div className="chips" role="group" aria-label="Filter by reason">
        <button
          type="button"
          className={filter === '' ? 'chip on' : 'chip'}
          aria-pressed={filter === ''}
          onClick={() => setFilter('')}
        >
          All {data.items.length}
        </button>
        {REASONS.filter(r => data.counts[r.id]).map(r => (
          <button
            key={r.id}
            type="button"
            className={filter === r.id ? 'chip on' : 'chip'}
            aria-pressed={filter === r.id}
            onClick={() => setFilter(r.id)}
          >
            {r.label} {data.counts[r.id]}
          </button>
        ))}
      </div>
      {data.items.length === 0 ? (
        <div className="card empty">
          <h2>Nothing needs you right now</h2>
          <p className="muted">
            No invoice is overdue, disputed or due this week.
            {data.snoozed > 0 && ` ${data.snoozed} invoice${data.snoozed === 1 ? ' is' : 's are'} paused.`}
          </p>
        </div>
      ) : (
        <>
          <p className="muted">
            {shown.length} invoice{shown.length === 1 ? '' : 's'} ·{' '}
            {[...owed]
              .map(
                ([code, c]) =>
                  `${(c / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${code}`
              )
              .join(' · ')}{' '}
            still owed (all listed)
            {data.snoozed > 0 && ` · ${data.snoozed} paused and left off`}
          </p>
          <div className="scroll">
            <table className="collections">
              <thead>
                <tr>
                  <th>Why</th>
                  <th>Invoice</th>
                  <th>Customer</th>
                  <th>Due</th>
                  <th className="num">Owed</th>
                  <th>Next step</th>
                </tr>
              </thead>
              <tbody>
                {shown.map(i => (
                  <tr key={i.id}>
                    <td>
                      <span className={`badge reason-${i.reason}`}>{label(i.reason)}</span>
                    </td>
                    <td>
                      <Link to={`/invoices/${i.id}`}>{i.number}</Link>
                    </td>
                    <td>{i.customer}</td>
                    <td>{i.dueOn || '—'}</td>
                    <td className="num">
                      {formatMoney(i.balanceCents, {
                        symbol: '',
                        pattern: '{amount} {code}',
                        decimals: 2,
                        code: i.currency
                      })}
                    </td>
                    <td>
                      <div>{i.action}</div>
                      <small className="muted">{i.detail}</small>
                      <div>
                        <Link to={`/invoices/${i.id}`}>Open</Link>
                        {(i.reason === 'overdue' || i.reason === 'due_soon' || i.reason === 'broken_promise') && (
                          <>
                            {' · '}
                            <Link to={`/invoices/${i.id}?remind=1`}>Review a reminder</Link>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
