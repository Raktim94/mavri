import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { Skeleton } from '../components/Icon';
import { EmptyState, useUi } from '../components/ui';
import { api, download, errorText } from '../api';
import { isOverdue as overdue, routeOf, statusesOf, statusLabel } from '../docs';
import { formatMoney } from '../money';
import type { BulkResult, Doc, Kind, Summary } from '../types';

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
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<{ title: string; data: BulkResult } | null>(null);

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

  const ids = [...picked].filter(id => (rows ?? []).some(r => r.id === id));
  const allPicked = visible.length > 0 && visible.every(r => picked.has(r.id));
  const toggle = (id: number) =>
    setPicked(p => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  async function bulk(
    action: 'email' | 'remind' | 'paid' | 'void',
    title: string,
    ask?: { title: string; body: string; confirm: string }
  ) {
    if (ask && !(await confirm({ ...ask, danger: action === 'void' }))) return;
    setBusy(true);
    setError('');
    try {
      const data = await api.post<BulkResult>('/api/documents/bulk', { ids, action });
      setReport({ title, data });
      setPicked(new Set());
      load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

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
      {ids.length > 0 && (
        <div className="bulk-bar" role="region" aria-label="Selected documents">
          <strong>{ids.length} selected</strong>
          <button
            disabled={busy}
            onClick={() =>
              bulk('email', 'Emailing', {
                title: `Email ${ids.length} ${noun}${ids.length === 1 ? '' : 's'}?`,
                body: 'Each customer gets the standard email with a link. Customers without an email address are skipped and listed afterwards.',
                confirm: 'Send emails'
              })
            }
          >
            Email
          </button>
          {kind === 'invoice' && (
            <>
              <button
                disabled={busy}
                onClick={() =>
                  bulk('remind', 'Reminders', {
                    title: `Send payment reminders?`,
                    body: 'Only invoices that still have a balance get one.',
                    confirm: 'Send reminders'
                  })
                }
              >
                Remind
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  bulk('paid', 'Marking paid', {
                    title: `Mark ${ids.length} invoice${ids.length === 1 ? '' : 's'} as paid?`,
                    body: 'Each gets a payment for its full balance, dated today.',
                    confirm: 'Mark paid'
                  })
                }
              >
                Mark paid
              </button>
              <button
                className="danger"
                disabled={busy}
                onClick={() =>
                  bulk('void', 'Voiding', {
                    title: `Void ${ids.length} invoice${ids.length === 1 ? '' : 's'}?`,
                    body: 'They stay in your records but no longer count as owed.',
                    confirm: 'Void'
                  })
                }
              >
                Void
              </button>
            </>
          )}
          <button
            disabled={busy}
            onClick={() =>
              download(`/api/export/invoices.csv?ids=${ids.join(',')}`, 'mavri-selection.csv').catch(e =>
                setError(errorText(e))
              )
            }
          >
            Export CSV
          </button>
          <span className="grow" />
          <button onClick={() => setPicked(new Set())}>Clear</button>
        </div>
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
                  <th className="pick">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allPicked}
                      onChange={e => setPicked(e.target.checked ? new Set(visible.map(r => r.id)) : new Set())}
                    />
                  </th>
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
                  <tr key={r.id} className={picked.has(r.id) ? 'picked' : undefined}>
                    <td className="pick">
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.fullNumber}`}
                        checked={picked.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                    </td>
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
      {report && (
        <Modal title={report.title} onClose={() => setReport(null)} wide>
          <p>
            <strong className="ok-text">{report.data.ok} done</strong>
            {report.data.failed > 0 && (
              <>
                , <strong className="error">{report.data.failed} not done</strong>
              </>
            )}
            .
          </p>
          <table>
            <tbody>
              {report.data.results.map(r => (
                <tr key={r.id}>
                  <td>{r.number || `#${r.id}`}</td>
                  <td className={r.ok ? 'ok-text' : 'error'}>{r.ok ? '✓' : '✕'}</td>
                  <td>{r.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="row end">
            <button className="primary" onClick={() => setReport(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </section>
  );
}
