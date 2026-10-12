import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, type Row } from '../api';
import type { Resource } from '../resources';

const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() ?? '')
    .join('');

export function ResourcePage({ res }: { res: Resource }) {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState('');
  const [choices, setChoices] = useState<Record<string, Row[]>>({});

  const load = useCallback(async () => {
    try {
      setRows(await api.get<Row[]>(`/api/${res.path}`));
    } catch {
      setError('Could not load the list.');
    }
  }, [res.path]);

  useEffect(() => {
    const sources = [
      ...new Set(res.fields.flatMap(f => (f.options && !Array.isArray(f.options) ? [f.options.from] : [])))
    ];
    Promise.all(
      sources.map(src => api.get<Row[]>(`/api/${src}`).then(r => [src, r.filter(x => !x.isArchived)] as const))
    )
      .then(pairs => setChoices(Object.fromEntries(pairs)))
      .catch(() => setError('Could not load the choices.'));
  }, [res]);

  useEffect(() => {
    setRows(null);
    setEditing(null);
    setError('');
    load();
  }, [load]);

  const visible = (rows ?? []).filter(r => showArchived || !r.isArchived);
  const columns = res.fields.filter(x => x.list);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    // clients and businesses keep a one- or two-letter badge derived from the name
    const body =
      res.path === 'clients' || res.path === 'businesses'
        ? { ...editing, shortName: initials(String(editing.name ?? '')) }
        : editing;
    try {
      await (editing.id ? api.put(`/api/${res.path}`, body) : api.post(`/api/${res.path}`, body));
      setEditing(null);
      load();
    } catch {
      setError('Could not save. Check the fields and try again.');
    }
  }

  async function setArchived(row: Row, isArchived: boolean) {
    await api.put(`/api/${res.path}`, { ...row, isArchived });
    load();
  }

  async function remove(row: Row) {
    if (!window.confirm(`Delete this ${res.singular}?`)) return;
    try {
      await api.del(`/api/${res.path}/${row.id}`);
      load();
    } catch {
      setError(`This ${res.singular} is in use. Archive it instead.`);
    }
  }

  return (
    <section>
      <header className="bar">
        <h1>{res.title}</h1>
        <label className="inline">
          <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} /> Show
          archived
        </label>
        <button className="primary" onClick={() => setEditing({})}>
          New {res.singular}
        </button>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {rows === null ? (
        <p className="muted">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="muted">Nothing here yet.</p>
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                {columns.map(c => (
                  <th key={c.name}>{c.label}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={String(r.id)} className={r.isArchived ? 'dim' : undefined}>
                  {columns.map(c => (
                    <td key={c.name}>{String(r[c.name] ?? '')}</td>
                  ))}
                  <td className="actions">
                    <button onClick={() => setEditing(r)}>Edit</button>
                    <button onClick={() => setArchived(r, !r.isArchived)}>
                      {r.isArchived ? 'Restore' : 'Archive'}
                    </button>
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
      {editing && (
        <div className="backdrop" onClick={() => setEditing(null)}>
          <form className="card dialog" onClick={e => e.stopPropagation()} onSubmit={save}>
            <h2>
              {editing.id ? 'Edit' : 'New'} {res.singular}
            </h2>
            {res.fields.map(fl => (
              <label key={fl.name} className={fl.kind === 'checkbox' ? 'inline' : undefined}>
                {fl.label}
                {fl.kind === 'select' ? (
                  <select
                    required={fl.required}
                    value={String(editing[fl.name] ?? '')}
                    onChange={e =>
                      setEditing({
                        ...editing,
                        [fl.name]:
                          e.target.value === ''
                            ? null
                            : Array.isArray(fl.options)
                              ? e.target.value
                              : Number(e.target.value)
                      })
                    }
                  >
                    <option value="">{fl.required ? 'Choose…' : 'None'}</option>
                    {Array.isArray(fl.options)
                      ? fl.options.map(o => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))
                      : (choices[fl.options?.from ?? ''] ?? []).map(r => (
                          <option key={String(r.id)} value={String(r.id)}>
                            {String(r[fl.options && !Array.isArray(fl.options) ? fl.options.label : 'name'] ?? r.id)}
                          </option>
                        ))}
                  </select>
                ) : fl.kind === 'color' ? (
                  <input
                    type="color"
                    value={String(editing[fl.name] ?? '#006400')}
                    onChange={e => setEditing({ ...editing, [fl.name]: e.target.value })}
                  />
                ) : fl.kind === 'textarea' ? (
                  <textarea
                    rows={3}
                    value={String(editing[fl.name] ?? '')}
                    onChange={e => setEditing({ ...editing, [fl.name]: e.target.value })}
                  />
                ) : fl.kind === 'checkbox' ? (
                  <input
                    type="checkbox"
                    checked={Boolean(editing[fl.name])}
                    onChange={e => setEditing({ ...editing, [fl.name]: e.target.checked })}
                  />
                ) : (
                  <input
                    type={fl.kind === 'number' ? 'number' : 'text'}
                    step="any"
                    required={fl.required}
                    value={String(editing[fl.name] ?? '')}
                    onChange={e =>
                      setEditing({
                        ...editing,
                        [fl.name]:
                          fl.kind === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value
                      })
                    }
                  />
                )}
              </label>
            ))}
            <div className="row end">
              <button type="button" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button className="primary">Save</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
