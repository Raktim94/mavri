import { useCallback, useEffect, useState } from 'react';
import { Skeleton } from '../components/Icon';
import { EmptyState } from '../components/ui';
import { fmtTime } from '../components/Modal';
import { api, download, errorText } from '../api';
import type { ActivityEntry } from '../types';

const SOURCES: [string, string][] = [
  ['', 'Anywhere'],
  ['ui', 'The app'],
  ['api', 'API'],
  ['mcp', 'AI assistant (MCP)'],
  ['public', 'Client link'],
  ['system', 'Automatic']
];
const PAGE = 50;

export function ActivityPage() {
  const [items, setItems] = useState<ActivityEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  const [source, setSource] = useState('');
  const [q, setQ] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [error, setError] = useState('');

  const query = useCallback(
    (offset: number) => {
      const p = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
      if (source) p.set('source', source);
      if (q.trim()) p.set('q', q.trim());
      if (from) p.set('from', from);
      if (to) p.set('to', to);
      return p;
    },
    [source, q, from, to]
  );

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .get<{ items: ActivityEntry[]; total: number }>(`/api/activity?${query(0)}`)
        .then(r => {
          setItems(r.items);
          setTotal(r.total);
          setError('');
        })
        .catch(e => setError(errorText(e, 'Could not load the history.')));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  async function more() {
    if (!items) return;
    const r = await api.get<{ items: ActivityEntry[]; total: number }>(`/api/activity?${query(items.length)}`);
    setItems([...items, ...r.items]);
  }

  return (
    <section>
      <header className="bar">
        <div>
          <h1>Activity</h1>
          <p className="muted sub">Who changed what, when, and where from. Kept in your backups.</p>
        </div>
        <button
          onClick={() => {
            const p = query(0);
            p.delete('limit');
            p.delete('offset');
            download(`/api/activity.csv?${p}`, 'mavri-activity.csv').catch(e => setError(errorText(e)));
          }}
        >
          Export CSV
        </button>
      </header>
      <div className="filters">
        <input
          type="search"
          placeholder="Search number, name, detail…"
          value={q}
          onChange={e => setQ(e.target.value)}
          aria-label="Search"
        />
        <select value={source} onChange={e => setSource(e.target.value)} aria-label="Source">
          {SOURCES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="From date" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="To date" />
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!items && !error && <Skeleton />}
      {items && items.length === 0 && (
        <EmptyState
          icon="activity"
          title="Nothing here yet"
          text="Changes to invoices, customers and settings will show up as they happen."
        />
      )}
      {items && items.length > 0 && (
        <>
          <table className="activity">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Where from</th>
                <th>What</th>
              </tr>
            </thead>
            <tbody>
              {items.map(e => (
                <tr key={e.id}>
                  <td className="nowrap">{fmtTime(e.at)}</td>
                  <td>{e.actor || <span className="muted">—</span>}</td>
                  <td>
                    <span className={`src src-${e.source}`}>
                      {SOURCES.find(s => s[0] === e.source)?.[1] ?? e.source}
                    </span>
                  </td>
                  <td>
                    <strong>{e.action}</strong> {e.entity}
                    {e.label && <> {e.label}</>}
                    {e.detail && <div className="muted small">{e.detail}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">
            Showing {items.length} of {total}.
          </p>
          {items.length < total && (
            <div className="row">
              <button onClick={more}>Show more</button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
