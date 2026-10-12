import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, type Row } from '../api';
import { currencyOf, day, statusLabel, statuses, text, totalsOf, type Kind } from '../invoiceTypes';
import { formatMoney } from '../money';

export function InvoicesPage({ kind }: { kind: Kind }) {
  const base = kind === 'invoice' ? '/invoices' : '/quotes';
  const noun = kind === 'invoice' ? 'invoice' : 'quote';
  const nav = useNavigate();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    api
      .get<Row[]>(`/api/invoices?type=${kind}`)
      .then(setRows)
      .catch(() => setError('Could not load the list.'));
  useEffect(() => {
    setRows(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (rows ?? [])
      .filter(r => Boolean(r.isArchived) === archived)
      .filter(r => !status || r.status === status)
      .filter(
        r =>
          !q ||
          `${text(r.invoiceFullNumber)} ${text((r.invoiceClientSnapshot as Row)?.clientName)}`.toLowerCase().includes(q)
      )
      .sort((a, b) => text(b.issuedAt).localeCompare(text(a.issuedAt)) || Number(b.id) - Number(a.id));
  }, [rows, status, search, archived]);

  async function duplicate(r: Row) {
    try {
      await api.post('/api/invoices/duplicate', { invoiceId: r.id, invoiceType: kind });
      load();
    } catch {
      setError('Could not duplicate.');
    }
  }
  async function remove(r: Row) {
    if (!window.confirm(`Delete this ${noun}?`)) return;
    try {
      await api.del(`/api/invoices/${r.id}`);
      load();
    } catch {
      setError('Could not delete.');
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
      <div className="row filters">
        <input
          type="search"
          placeholder="Search number or client"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select value={status} onChange={e => setStatus(e.target.value)} aria-label="Status">
          <option value="">All statuses</option>
          {statuses[kind].map(s => (
            <option key={s} value={s}>
              {statusLabel[s]}
            </option>
          ))}
        </select>
        <label className="inline">
          <input type="checkbox" checked={archived} onChange={e => setArchived(e.target.checked)} /> Archived
        </label>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {rows === null ? (
        <p className="muted">Loading…</p>
      ) : shown.length === 0 ? (
        <p className="muted">Nothing here yet.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                <th>Number</th>
                <th>Client</th>
                <th>Date</th>
                <th>Due</th>
                <th className="num">Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {shown.map(r => (
                <tr key={String(r.id)}>
                  <td>
                    <Link to={`${base}/${r.id}`}>{text(r.invoiceFullNumber)}</Link>
                  </td>
                  <td>{text((r.invoiceClientSnapshot as Row)?.clientName)}</td>
                  <td>{day(r.issuedAt)}</td>
                  <td>{day(r.dueDate)}</td>
                  <td className="num">{formatMoney(totalsOf(r).total, currencyOf(r))}</td>
                  <td>
                    <span className={`badge ${text(r.status)}`}>{statusLabel[text(r.status)] ?? text(r.status)}</span>
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
      )}
    </section>
  );
}
