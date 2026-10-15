import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Skeleton } from '../components/Icon';
import { EmptyState, useUi } from '../components/ui';
import { api, errorText } from '../api';
import { isOverdue as overdue, routeOf, statusesOf, statusLabel } from '../docs';
import { formatMoney } from '../money';
import type { Doc, Kind, Summary } from '../types';

export function DocumentsPage({ kind }: { kind: Kind }) {
  const base = routeOf(kind);
  const noun = kind === 'invoice' ? 'invoice' : 'quote';
  const nav = useNavigate();
  const { confirm } = useUi();
  const [rows, setRows] = useState<Summary[] | null>(null);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams({ kind });
    if (query.trim()) params.set('q', query.trim());
    try {
      const res = await api.get<{ items: Summary[]; total: number }>(`/api/documents?${params}`);
      setRows(res.items);
      setTotal(res.total);
    } catch (e) {
      setError(errorText(e, 'Could not load the list.'));
    }
  }, [kind, query]);

  // Search as you type, but not on every keystroke.
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  const visible = (rows ?? []).filter(r => !status || r.status === status);
  const count = (st: string) => (rows ?? []).filter(r => !st || r.status === st).length;

  async function duplicate(s: Summary) {
    try {
      const copy = await api.post<Doc>(`/api/documents/${s.id}/duplicate`);
      nav(`${base}/${copy.id}/edit`);
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function remove(s: Summary) {
    if (
      !(await confirm({
        title: `Delete ${noun} ${s.fullNumber}?`,
        body: 'This cannot be undone.',
        confirm: 'Delete',
        danger: true
      }))
    )
      return;
    try {
      await api.del(`/api/documents/${s.id}`);
      load();
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <section>
      <header className="bar">
        <h1>{kind === 'invoice' ? 'Invoices' : 'Quotes'}</h1>
        <button className="primary" onClick={() => nav(`${base}/new`)}>
          New {noun}
        </button>
      </header>
      <div className="toolbar">
        <div className="tabs" role="tablist" aria-label="Status">
          {['', ...statusesOf[kind]].map(st => (
            <button
              key={st || 'all'}
              role="tab"
              aria-selected={status === st}
              className={status === st ? 'tab on' : 'tab'}
              onClick={() => setStatus(st)}
            >
              {st ? statusLabel[st] : 'All'}
              {rows && total <= rows.length && <span className="count">{count(st)}</span>}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder={`Search ${noun}s`}
          value={query}
          onChange={e => setQuery(e.target.value)}
          aria-label="Search"
        />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {rows === null ? (
        <Skeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={kind === 'invoice' ? 'invoices' : 'quotes'}
          title={rows.length === 0 && !query ? `No ${noun}s yet` : `No ${noun}s match`}
          text={
            rows.length === 0 && !query
              ? `Create your first ${noun} in about a minute. Your business and customers are picked up from your records.`
              : 'Try another status or a different search.'
          }
          action={
            rows.length === 0 && !query ? (
              <button className="primary" onClick={() => nav(`${base}/new`)}>
                New {noun}
              </button>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th>Number</th>
                  <th>Customer</th>
                  <th>Date</th>
                  <th>Due</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.id}>
                    <td>
                      <Link to={`${base}/${r.id}`}>{r.fullNumber}</Link>
                    </td>
                    <td>{r.customerName}</td>
                    <td>{r.issuedOn}</td>
                    <td className={overdue(r) ? 'late' : undefined}>{r.dueOn}</td>
                    <td className="num">
                      {formatMoney(r.totalCents, {
                        code: r.currencyCode,
                        symbol: r.currencySymbol,
                        pattern: r.currencyPattern,
                        decimals: r.currencyDecimals
                      })}
                    </td>
                    <td>
                      {overdue(r) ? (
                        <span className="badge overdue">Overdue</span>
                      ) : (
                        <span className={`badge ${r.status}`}>{statusLabel[r.status] ?? r.status}</span>
                      )}
                    </td>
                    <td className="actions">
                      <button onClick={() => nav(`${base}/${r.id}/edit`)}>Edit</button>
                      <button onClick={() => duplicate(r)}>Duplicate</button>
                      <button className="danger" onClick={() => remove(r)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {total > rows.length && (
            <p className="muted">
              Showing {rows.length} of {total}. Narrow the search to see the rest.
            </p>
          )}
        </>
      )}
    </section>
  );
}
