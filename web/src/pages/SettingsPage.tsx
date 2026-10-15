import { useEffect, useState, type FormEvent } from 'react';
import { useUi } from '../components/ui';
import { api, download, errorText } from '../api';
import { UpdatePanel } from '../components/Updates';
import type { ApiKey, Features, Settings } from '../types';

const features: [keyof Features, string][] = [
  ['quotes', 'Quotes'],
  ['presets', 'Presets'],
  ['styles', 'Styles'],
  ['reports', 'Reports'],
  ['ubl', 'UBL e-invoice export'],
  ['xrechnung', 'XRechnung e-invoice export']
];

export function SettingsPage({ onSaved }: { onSaved: (s: Settings) => void }) {
  const [s, setS] = useState<Settings | null>(null);
  const [msg, setMsg] = useState('');
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [label, setLabel] = useState('');
  const [secret, setSecret] = useState('');
  const { confirm, toast } = useUi();

  const loadKeys = () =>
    api
      .get<ApiKey[]>('/api/keys')
      .then(setKeys)
      .catch(() => setMsg('Could not load API keys.'));
  useEffect(() => {
    api
      .get<Settings>('/api/settings')
      .then(setS)
      .catch(e => setMsg(errorText(e, 'Could not load settings.')));
    loadKeys();
  }, []);

  if (!s) return <p className="muted">{msg || 'Loading…'}</p>;
  const set = (patch: Partial<Settings>) => setS({ ...s, ...patch });

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      onSaved(await api.put<Settings>('/api/settings', s));
      toast('Settings saved');
    } catch (err) {
      setMsg(errorText(err, 'Could not save.'));
    }
  }

  async function restore(file: File | undefined) {
    if (
      !file ||
      !(await confirm({
        title: 'Restore from this backup?',
        body: 'Restoring replaces all invoices, quotes and records with the ones in the file. Store connections are removed.',
        confirm: 'Restore',
        danger: true
      }))
    )
      return;
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/backup', { method: 'POST', body: form, credentials: 'same-origin' });
    if (res.ok) {
      setMsg('Backup restored. Reload the page to see it.');
    } else {
      const body = await res.json().catch(() => ({}));
      setMsg(body.error?.message ?? 'That file could not be restored.');
    }
  }

  async function createKey() {
    try {
      const made = await api.post<{ secret: string }>('/api/keys', { label });
      setSecret(made.secret);
      setLabel('');
      loadKeys();
    } catch (e) {
      setMsg(errorText(e, 'Could not create the key.'));
    }
  }

  return (
    <section className="settings">
      <header className="bar">
        <h1>Settings</h1>
      </header>
      {msg && <p role="status">{msg}</p>}
      <UpdatePanel />
      <form className="card" onSubmit={save}>
        <h2>Numbering</h2>
        <div className="grid2">
          <label>
            Invoice prefix
            <input value={s.invoicePrefix} onChange={e => set({ invoicePrefix: e.target.value })} />
          </label>
          <label>
            Invoice suffix
            <input value={s.invoiceSuffix} onChange={e => set({ invoiceSuffix: e.target.value })} />
          </label>
          <label>
            Quote prefix
            <input value={s.quotePrefix} onChange={e => set({ quotePrefix: e.target.value })} />
          </label>
        </div>
        <h2>Features</h2>
        {features.map(([key, text]) => (
          <label className="inline" key={key}>
            <input
              type="checkbox"
              checked={s.features[key]}
              onChange={e => set({ features: { ...s.features, [key]: e.target.checked } })}
            />{' '}
            {text}
          </label>
        ))}
        <div className="row end">
          <button className="primary">Save settings</button>
        </div>
      </form>

      <div className="card">
        <h2>Backup</h2>
        <p className="muted">
          Download all invoices, quotes and records as one file, or restore from a file made here.
        </p>
        <div className="row">
          <button onClick={() => download('/api/backup', 'mavri-backup.json.gz').catch(e => setMsg(errorText(e)))}>
            Download backup
          </button>
          <label className="file">
            Restore from file
            <input type="file" accept=".gz" onChange={e => restore(e.target.files?.[0])} />
          </label>
        </div>
      </div>

      <div className="card">
        <h2>API keys</h2>
        <p className="muted">Keys let scripts and tools read and create invoices. The secret is shown once.</p>
        {secret && (
          <p role="status">
            New key: <code>{secret}</code>
          </p>
        )}
        <div className="row">
          <input placeholder="Key name" value={label} onChange={e => setLabel(e.target.value)} />
          <button onClick={createKey}>Create key</button>
        </div>
        <table>
          <tbody>
            {keys.map(k => (
              <tr key={k.id} className={k.revokedAt ? 'dim' : undefined}>
                <td>{k.label}</td>
                <td>
                  <code>{k.prefix}…</code>
                </td>
                <td>{k.revokedAt ? 'Revoked' : k.lastUsedAt ? `Used ${k.lastUsedAt.slice(0, 10)}` : 'Never used'}</td>
                <td className="actions">
                  {!k.revokedAt && (
                    <button className="danger" onClick={() => api.del(`/api/keys/${k.id}`).then(loadKeys)}>
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
