import { useEffect, useState, type FormEvent } from 'react';
import { useUi } from '../components/ui';
import { api, errorText } from '../api';
import type { Bank, Currency, Party, Shop } from '../types';

const platforms = ['shopify', 'woocommerce', 'generic'] as const;
type Draft = Partial<Shop> & { platform: Shop['platform'] };

export function ShopsPage() {
  const { confirm } = useUi();
  const [shops, setShops] = useState<Shop[]>([]);
  const [issuers, setIssuers] = useState<Party[]>([]);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [created, setCreated] = useState<{ webhookUrl: string; secret: string } | null>(null);
  const [error, setError] = useState('');

  const load = () =>
    api
      .get<Shop[]>('/api/shops')
      .then(setShops)
      .catch(e => setError(errorText(e, 'Could not load the connections.')));
  useEffect(() => {
    load();
    api.get<Party[]>('/api/parties?kind=issuer').then(r => setIssuers(r.filter(x => !x.archived)));
    api.get<Currency[]>('/api/currencies').then(r => setCurrencies(r.filter(x => !x.archived)));
    api.get<Bank[]>('/api/banks').then(r => setBanks(r.filter(x => !x.archived)));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    try {
      const res = await api.post<{ shop: Shop; secret: string }>('/api/shops', draft);
      setCreated({ webhookUrl: res.shop.webhookUrl, secret: res.secret });
      setDraft(null);
      setError('');
      load();
    } catch (err) {
      setError(errorText(err, 'Could not create the connection.'));
    }
  }

  const num = (v: string) => (v === '' ? undefined : Number(v));

  return (
    <section>
      <header className="bar">
        <h1>Stores</h1>
        <button className="primary" onClick={() => setDraft({ platform: 'generic', markPaid: true, defaultTax: 0 })}>
          Connect a store
        </button>
      </header>
      <p className="muted">
        A store sends each order to a webhook address, signed with a secret. Mavri turns it into an invoice, once per
        order.
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {created && (
        <div className="card" role="status">
          <p>
            Webhook URL: <code>{created.webhookUrl}</code>
          </p>
          <p>
            Signing secret (shown once): <code>{created.secret}</code>
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
            {shops.map(s => (
              <tr key={s.id} className={s.active ? undefined : 'dim'}>
                <td>{s.name}</td>
                <td>{s.platform}</td>
                <td>
                  <code>{s.webhookUrl}</code>
                </td>
                <td>{s.active ? 'Active' : 'Paused'}</td>
                <td className="actions">
                  {s.active && <button onClick={() => api.post(`/api/shops/${s.id}/pause`).then(load)}>Pause</button>}
                  <button
                    className="danger"
                    onClick={async () =>
                      (await confirm({
                        title: `Delete ${s.name}?`,
                        body: 'The connection stops receiving orders. Invoices it already made stay.',
                        confirm: 'Delete',
                        danger: true
                      })) && api.del(`/api/shops/${s.id}`).then(load)
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
      {draft && (
        <div className="backdrop" onClick={() => setDraft(null)}>
          <form className="card dialog" onClick={e => e.stopPropagation()} onSubmit={create}>
            <h2>Connect a store</h2>
            <label>
              Name
              <input required value={draft.name ?? ''} onChange={e => setDraft({ ...draft, name: e.target.value })} />
            </label>
            <label>
              Platform
              <select
                value={draft.platform}
                onChange={e => setDraft({ ...draft, platform: e.target.value as Shop['platform'] })}
              >
                {platforms.map(p => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label>
              Business that sends the invoices
              <select
                required
                value={draft.issuerId ?? ''}
                onChange={e => setDraft({ ...draft, issuerId: Number(e.target.value) })}
              >
                <option value="">Choose…</option>
                {issuers.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Currency
              <select
                required
                value={draft.currencyId ?? ''}
                onChange={e => setDraft({ ...draft, currencyId: Number(e.target.value) })}
              >
                <option value="">Choose…</option>
                {currencies.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.code}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Bank account
              <select
                value={draft.bankId ?? ''}
                onChange={e => setDraft({ ...draft, bankId: num(e.target.value) ?? null })}
              >
                <option value="">None</option>
                {banks.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Tax % when an order has none
              <input
                type="number"
                step="any"
                min="0"
                max="100"
                value={draft.defaultTax ?? 0}
                onChange={e => setDraft({ ...draft, defaultTax: Number(e.target.value) })}
              />
            </label>
            <label className="inline">
              <input
                type="checkbox"
                checked={Boolean(draft.markPaid)}
                onChange={e => setDraft({ ...draft, markPaid: e.target.checked })}
              />{' '}
              Record a payment when the store says the order is paid
            </label>
            <div className="row end">
              <button type="button" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button className="primary">Connect</button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
