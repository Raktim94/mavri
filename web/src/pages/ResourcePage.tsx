import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Skeleton } from '../components/Icon';
import { EmptyState, useUi } from '../components/ui';
import { api, errorText } from '../api';
import { CountryPicker } from '../components/CountryPicker';
import { LogoPicker } from '../components/LogoPicker';
import { toMajor, toMinor } from '../money';
import type { Field, Resource } from '../resources';

type Rec = Record<string, unknown> & { id?: number };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const text = (v: unknown) => (v === null || v === undefined ? '' : String(v));

function cell(f: Field, r: Rec) {
  return f.kind === 'price' ? toMajor(Number(r[f.name] ?? 0), 2) : text(r[f.name]);
}

export function ResourcePage({ res }: { res: Resource }) {
  const [rows, setRows] = useState<Rec[] | null>(null);
  const { confirm, toast } = useUi();
  const [editing, setEditing] = useState<Rec | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [choices, setChoices] = useState<Record<string, Rec[]>>({});
  const [error, setError] = useState('');
  const listPath = res.query ? `${res.path}?${res.query}` : res.path;

  const load = useCallback(async () => {
    try {
      setRows(await api.get<Rec[]>(listPath));
    } catch (e) {
      setError(errorText(e, 'Could not load the list.'));
    }
  }, [listPath]);

  useEffect(() => {
    setRows(null);
    setEditing(null);
    setError('');
    load();
    const sources = [
      ...new Set(res.fields.flatMap(f => (f.options && !Array.isArray(f.options) ? [f.options.from] : [])))
    ];
    Promise.all(sources.map(src => api.get<Rec[]>(src).then(r => [src, r.filter(x => !x.archived)] as const)))
      .then(pairs => setChoices(Object.fromEntries(pairs)))
      .catch(() => setError('Could not load the choices.'));
  }, [res, load]);

  const visible = (rows ?? []).filter(r => showArchived || !r.archived);
  const columns = res.fields.filter(f => f.list);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const body = { ...res.defaults, ...editing };
    try {
      await (editing.id ? api.put(`${res.path}/${editing.id}`, body) : api.post(res.path, body));
      setEditing(null);
      setError('');
      toast(`${cap(res.singular)} saved`);
      load();
    } catch (err) {
      setError(errorText(err, 'Could not save.'));
    }
  }

  async function setArchived(r: Rec, archived: boolean) {
    try {
      await api.put(`${res.path}/${r.id}`, { ...r, archived });
      load();
    } catch (e) {
      setError(errorText(e));
    }
  }

  async function remove(r: Rec) {
    if (
      !(await confirm({
        title: `Delete this ${res.singular}?`,
        body: 'This cannot be undone.',
        confirm: 'Delete',
        danger: true
      }))
    )
      return;
    try {
      await api.del(`${res.path}/${r.id}`);
      load();
    } catch {
      setError(`This ${res.singular} is in use by documents. Archive it instead.`);
    }
  }

  function input(f: Field, rec: Rec) {
    const set = (v: unknown) => setEditing({ ...rec, [f.name]: v });
    const value = rec[f.name];
    switch (f.kind) {
      case 'logo':
        return (
          <LogoPicker
            logo={value as string | undefined}
            logoType={text(rec.logoType)}
            onChange={(logo, logoType) => setEditing(cur => (cur ? { ...cur, logo, logoType } : cur))}
          />
        );
      case 'country':
        return <CountryPicker value={text(value)} onChange={set} />;
      case 'textarea':
        return <textarea rows={3} value={text(value)} onChange={e => set(e.target.value)} />;
      case 'checkbox':
        return <input type="checkbox" checked={Boolean(value)} onChange={e => set(e.target.checked)} />;
      case 'color':
        return <input type="color" value={text(value) || '#3b5bdb'} onChange={e => set(e.target.value)} />;
      case 'price':
        return (
          <input
            type="number"
            step="0.01"
            min="0"
            value={value === undefined ? '' : toMajor(Number(value), 2)}
            onChange={e => set(toMinor(e.target.value, 2))}
          />
        );
      case 'number':
        return (
          <input
            type="number"
            step="any"
            value={text(value)}
            onChange={e => set(e.target.value === '' ? 0 : Number(e.target.value))}
          />
        );
      case 'select': {
        if (f.choices) {
          return (
            <select value={text(value)} onChange={e => set(e.target.value)}>
              {f.choices.map(c => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          );
        }
        const fixed = Array.isArray(f.options);
        const list = fixed ? [] : (choices[(f.options as { from: string }).from] ?? []);
        const labelKey = !fixed && f.options ? (f.options as { label: string }).label : 'name';
        return (
          <select
            required={f.required}
            value={text(value)}
            onChange={e => set(e.target.value === '' ? null : fixed ? e.target.value : Number(e.target.value))}
          >
            <option value="">{f.required ? 'Choose…' : 'None'}</option>
            {fixed
              ? (f.options as string[]).map(o => <option key={o}>{o}</option>)
              : list.map(r => (
                  <option key={String(r.id)} value={String(r.id)}>
                    {text(r[labelKey])}
                  </option>
                ))}
          </select>
        );
      }
      default:
        return <input required={f.required} value={text(value)} onChange={e => set(e.target.value)} />;
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
        <button className="primary" onClick={() => setEditing({ ...res.defaults })}>
          New {res.singular}
        </button>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {rows === null ? (
        <Skeleton />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={res.id}
          title={`No ${res.title.toLowerCase()} yet`}
          text={`Add your first ${res.singular} to see it here.`}
          action={
            <button className="primary" onClick={() => setEditing({ ...res.defaults })}>
              New {res.singular}
            </button>
          }
        />
      ) : (
        <div className="scroll">
          <table>
            <thead>
              <tr>
                {columns.map(c => (
                  <th key={c.name}>{c.label.replace(/ \(.*/, '')}</th>
                ))}
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map(r => (
                <tr key={String(r.id)} className={r.archived ? 'dim' : undefined}>
                  {columns.map(c => (
                    <td key={c.name}>{cell(c, r)}</td>
                  ))}
                  <td className="actions">
                    <button onClick={() => setEditing(r)}>Edit</button>
                    <button onClick={() => setArchived(r, !r.archived)}>{r.archived ? 'Restore' : 'Archive'}</button>
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
            {res.fields.map(f =>
              f.kind === 'logo' ? (
                <div key={f.name} className="field-group">
                  <span className="field-label">{f.label}</span>
                  {input(f, editing)}
                </div>
              ) : (
                <label key={f.name} className={f.kind === 'checkbox' ? 'inline' : undefined}>
                  {f.label}
                  {input(f, editing)}
                </label>
              )
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
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
