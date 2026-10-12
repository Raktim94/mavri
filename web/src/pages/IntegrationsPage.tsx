import { useEffect, useState, type FormEvent } from 'react';
import { api, type Row } from '../api';
import { text } from '../invoiceTypes';

const platforms = ['shopify', 'woocommerce', 'generic'];

export function IntegrationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [businesses, setBusinesses] = useState<Row[]>([]);
  const [currencies, setCurrencies] = useState<Row[]>([]);
  const [form, setForm] = useState<Row | null>(null);
  const [created, setCreated] = useState<{ webhookSecret: string; webhookUrl: string } | null>(null);
  const [error, setError] = useState('');

  const load = () =>
    api
      .get<Row[]>('/api/ecommerce/integrations')
      .then(setRows)
      .catch(() => setError('Could not load integrations.'));
  useEffect(() => {
    load();
    api.get<Row[]>('/api/businesses').then(r => setBusinesses(r.filter(x => !x.isArchived)));
    api.get<Row[]>('/api/currencies').then(r => setCurrencies(r.filter(x => !x.isArchived)));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      setCreated(await api.post('/api/ecommerce/integrations', form));
      setForm(null);
      load();
    } catch {
      setError('Could not create the integration. Check every field.');
    }
  }

  return (
    <section>
      <header className="bar">
        <h1>Store integrations</h1>
        <button className="primary" onClick={() => setForm({ platform: 'generic', autoIssue: false })}>
          New integration
        </button>
      </header>
      <p className="muted">
        A store sends each paid order to a webhook address, signed with a secret. Mavri turns it into an invoice.
      </p>
      {error && <p className="error">{error}</p>}
      {created && (
        <div className="card" role="status">
          <p>
            Webhook URL: <code>{created.webhookUrl}</code>
          </p>
          <p>
            Secret (shown once): <code>{created.webhookSecret}</code>
          </p>
          <button onClick={() => setCreated(null)}>Done</button>
        </div>
      )}
      <div className="scroll">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Platform</th>
              <th>Webhook URL</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={String(r.id)} className={r.isActive ? undefined : 'dim'}>
                <td>{text(r.name)}</td>
                <td>{text(r.platform)}</td>
                <td>
                  <code>{text(r.webhookUrl)}</code>
                </td>
                <td>{r.isActive ? 'Active' : 'Paused'}</td>
                <td className="actions">
                  {Boolean(r.isActive) && (
                    <button onClick={() => api.post(`/api/ecommerce/integrations/${r.id}/deactivate`).then(load)}>
                      Pause
                    </button>
                  )}
                  <button
                    className="danger"
                    onClick={() =>
                      window.confirm('Delete this integration?') &&
                      api.del(`/api/ecommerce/integrations/${r.id}`).then(load)
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {form && (
        <div className="backdrop" onClick={() => setForm(null)}>
          <form className="card dialog" onClick={e => e.stopPropagation()} onSubmit={create}>
            <h2>New integration</h2>
            <label>
              Name
              <input required value={text(form.name)} onChange={e => setForm({ ...form, name: e.target.value })} />
            </label>
            <label>
              Platform
              <select value={text(form.platform)} onChange={e => setForm({ ...form, platform: e.target.value })}>
                {platforms.map(p => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Business
              <select
                required
                value={text(form.businessId)}
                onChange={e => setForm({ ...form, businessId: Number(e.target.value) })}
              >
                <option value="">Choose…</option>
                {businesses.map(b => (
                  <option key={String(b.id)} value={String(b.id)}>
                    {text(b.name)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Currency
              <select
                required
                value={text(form.currencyId)}
                onChange={e => setForm({ ...form, currencyId: Number(e.target.value) })}
              >
                <option value="">Choose…</option>
                {currencies.map(b => (
                  <option key={String(b.id)} value={String(b.id)}>
                    {text(b.code)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Default tax %
              <input
                type="number"
                step="any"
                min="0"
                onChange={e =>
                  setForm({ ...form, defaultTaxRate: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </label>
            <label className="inline">
              <input
                type="checkbox"
                checked={Boolean(form.autoIssue)}
                onChange={e => setForm({ ...form, autoIssue: e.target.checked })}
              />{' '}
              Issue invoices automatically
            </label>
            <div className="row end">
              <button type="button" onClick={() => setForm(null)}>
                Cancel
              </button>
              <button className="primary">Create</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
