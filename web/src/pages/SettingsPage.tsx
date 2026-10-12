import { useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Row } from '../api';
import { text } from '../invoiceTypes';

const toggles: [string, string][] = [
  ['quotesON', 'Quotes'],
  ['presetsON', 'Presets'],
  ['styleProfilesON', 'Styles'],
  ['reportsON', 'Reports'],
  ['ublON', 'UBL e-invoice export'],
  ['xrechnungON', 'XRechnung e-invoice export']
];

export function SettingsPage({ onSaved }: { onSaved: (s: Row) => void }) {
  const [s, setS] = useState<Row | null>(null);
  const [msg, setMsg] = useState('');
  const [keys, setKeys] = useState<Row[]>([]);
  const [newKey, setNewKey] = useState('');
  const [secret, setSecret] = useState('');

  const loadKeys = () =>
    api
      .get<Row[]>('/api/auth/api-keys')
      .then(setKeys)
      .catch(() => setMsg('Could not load API keys.'));
  useEffect(() => {
    api
      .get<Row>('/api/settings')
      .then(setS)
      .catch(() => setMsg('Could not load settings.'));
    loadKeys();
  }, []);

  if (!s) return <p className="muted">{msg || 'Loading…'}</p>;
  const set = (patch: Row) => setS({ ...s, ...patch });

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api.put('/api/settings', s);
      onSaved(s!);
      setMsg('Saved.');
    } catch {
      setMsg('Could not save.');
    }
  }

  async function exportAll() {
    const data = await api.get<Row>('/api/export');
    const blob = await new Response(
      new Blob([JSON.stringify(data)]).stream().pipeThrough(new CompressionStream('gzip'))
    ).blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mavri-backup-${new Date().toISOString().slice(0, 10)}.json.gz`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function importAll(file: File | undefined) {
    if (!file || !window.confirm('Restoring replaces the data in this backup with what is in the file. Continue?'))
      return;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/import', { method: 'POST', body: form, credentials: 'same-origin' });
    setMsg(res.ok ? 'Backup restored. Reload the page to see it.' : 'That file could not be restored.');
  }

  async function createKey() {
    try {
      const made = await api.post<{ secret: string }>('/api/auth/api-keys', { name: newKey });
      setSecret(made.secret);
      setNewKey('');
      loadKeys();
    } catch (e) {
      setMsg(e instanceof ApiError ? 'Could not create the key.' : 'Network error.');
    }
  }

  return (
    <section className="settings">
      <header className="bar">
        <h1>Settings</h1>
      </header>
      {msg && <p role="status">{msg}</p>}
      <form className="card" onSubmit={save}>
        <h2>General</h2>
        <div className="grid2">
          <label>
            Language
            <select value={text(s.language)} onChange={e => set({ language: e.target.value })}>
              {['en', 'de', 'fr', 'lt', 'pt'].map(l => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Date format
            <select value={text(s.dateFormat)} onChange={e => set({ dateFormat: e.target.value })}>
              {['MM/dd/yyyy', 'dd/MM/yyyy', 'yyyy-MM-dd', 'dd.MM.yyyy'].map(l => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Number format
            <select value={text(s.amountFormat)} onChange={e => set({ amountFormat: e.target.value })}>
              {['en-US', 'de-DE', 'fr-FR', 'en-IN'].map(l => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            Invoice prefix
            <input value={text(s.invoicePrefix)} onChange={e => set({ invoicePrefix: e.target.value || null })} />
          </label>
          <label>
            Invoice suffix
            <input value={text(s.invoiceSuffix)} onChange={e => set({ invoiceSuffix: e.target.value || null })} />
          </label>
        </div>
        <h2>Features</h2>
        {toggles.map(([key, label]) => (
          <label className="inline" key={key}>
            <input type="checkbox" checked={Boolean(s[key])} onChange={e => set({ [key]: e.target.checked })} /> {label}
          </label>
        ))}
        <div className="row end">
          <button className="primary">Save settings</button>
        </div>
      </form>

      <div className="card">
        <h2>Backup</h2>
        <p className="muted">Download everything as one file, or restore from a file made here.</p>
        <div className="row">
          <button onClick={exportAll}>Download backup</button>
          <label className="file">
            Restore from file
            <input type="file" accept=".gz" onChange={e => importAll(e.target.files?.[0])} />
          </label>
        </div>
      </div>

      <div className="card">
        <h2>API keys</h2>
        <p className="muted">Keys let scripts and tools read invoices and post orders. The secret is shown once.</p>
        {secret && (
          <p role="status">
            New key: <code>{secret}</code>
          </p>
        )}
        <div className="row">
          <input placeholder="Key name" value={newKey} onChange={e => setNewKey(e.target.value)} />
          <button onClick={createKey}>Create key</button>
        </div>
        <table>
          <tbody>
            {keys.map(k => (
              <tr key={String(k.id)} className={k.revokedAt ? 'dim' : undefined}>
                <td>{text(k.name)}</td>
                <td>
                  <code>{text(k.keyPrefix)}…</code>
                </td>
                <td>{k.revokedAt ? 'Revoked' : k.lastUsedAt ? `Used ${text(k.lastUsedAt)}` : 'Never used'}</td>
                <td className="actions">
                  {!k.revokedAt && (
                    <button className="danger" onClick={() => api.del(`/api/auth/api-keys/${k.id}`).then(loadKeys)}>
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
