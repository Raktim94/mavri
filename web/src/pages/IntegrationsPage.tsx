import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { copyText, fmtTime } from '../components/Modal';
import { useUi } from '../components/ui';
import { api, errorText } from '../api';
import type { WebhookDelivery, WebhookEndpoint } from '../types';

const verify = `// Node.js: verify a Mavri webhook
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verify(rawBody, header, secret, toleranceSeconds = 300) {
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')));
  const expected = createHmac('sha256', secret).update(parts.t + '.' + rawBody).digest('hex');
  const fresh = Math.abs(Date.now() / 1000 - Number(parts.t)) < toleranceSeconds;
  return fresh && timingSafeEqual(Buffer.from(expected), Buffer.from(parts.v1));
}`;

const curl = `curl -H "Authorization: Bearer mvr_YOUR_KEY" \\
  "${location.origin}/api/v1/documents?kind=invoice&status=unpaid&limit=20"`;

const tsExample = `const res = await fetch('${location.origin}/api/documents', {
  method: 'POST',
  headers: { Authorization: 'Bearer mvr_YOUR_KEY', 'Content-Type': 'application/json' },
  body: JSON.stringify({
    kind: 'invoice', issuerId: 1, customerId: 2, currencyId: 1, issuedOn: '2026-11-01',
    lines: [{ name: 'Consulting', quantity: 3, unitCents: 15000 }]
  })
});
const invoice = await res.json();`;

export function IntegrationsPage() {
  const { toast, confirm } = useUi();
  const [eps, setEps] = useState<WebhookEndpoint[] | null>(null);
  const [events, setEvents] = useState<string[]>([]);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [filter, setFilter] = useState('');
  const [url, setUrl] = useState('');
  const [desc, setDesc] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [secret, setSecret] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get<{ endpoints: WebhookEndpoint[]; events: string[] }>('/api/webhooks')
      .then(r => {
        setEps(r.endpoints);
        setEvents(r.events);
      })
      .catch(e => setError(errorText(e)));
    api
      .get<WebhookDelivery[]>(`/api/webhooks/deliveries?limit=50${filter ? `&status=${filter}` : ''}`)
      .then(setDeliveries)
      .catch(() => undefined);
  }, [filter]);
  useEffect(() => {
    load();
    const t = setInterval(load, 5000); // pending deliveries settle within seconds
    return () => clearInterval(t);
  }, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const r = await api.post<{ secret: string }>('/api/webhooks', { url, description: desc, events: picked });
      setSecret(r.secret);
      setUrl('');
      setDesc('');
      setPicked([]);
      load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function act(fn: () => Promise<unknown>, done?: string) {
    try {
      await fn();
      if (done) toast(done);
      load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  const label = (id: number) => eps?.find(x => x.id === id)?.url ?? `#${id}`;
  return (
    <section className="settings">
      <header className="bar">
        <div>
          <h1>Integrations</h1>
          <p className="muted sub">
            Webhooks let other systems react to what happens in Mavri. The REST API lets them act on it.
          </p>
        </div>
        <a className="btn" href="/api/openapi.yaml" target="_blank" rel="noreferrer">
          <Icon name="link" /> OpenAPI description
        </a>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <form className="card" onSubmit={add}>
        <h2>Add a webhook</h2>
        <p className="muted">
          Mavri sends a signed JSON message to your URL when something happens. If your server does not answer with a
          2xx status it is retried after 1 minute, 5 minutes, 30 minutes, 2 hours and 6 hours.
        </p>
        <div className="grid2">
          <label>
            URL
            <input
              type="url"
              required
              placeholder="https://example.com/mavri-hook"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          </label>
          <label>
            Description (optional)
            <input value={desc} onChange={e => setDesc(e.target.value)} />
          </label>
        </div>
        <fieldset className="chips">
          <legend>Events (none selected means all)</legend>
          {events.map(ev => (
            <label key={ev} className={`chip ${picked.includes(ev) ? 'on' : ''}`}>
              <input
                type="checkbox"
                checked={picked.includes(ev)}
                onChange={e => setPicked(e.target.checked ? [...picked, ev] : picked.filter(x => x !== ev))}
              />
              {ev}
            </label>
          ))}
        </fieldset>
        <div className="row end">
          <button className="primary">Add webhook</button>
        </div>
        {secret && (
          <div className="notice ok" role="status">
            <p>
              <strong>Signing secret — shown once.</strong> Use it to check the <code>Mavri-Signature</code> header.
            </p>
            <div className="copy-row">
              <input readOnly value={secret} onFocus={e => e.target.select()} aria-label="Signing secret" />
              <button type="button" onClick={async () => (await copyText(secret)) && toast('Secret copied')}>
                <Icon name="copy" /> Copy
              </button>
            </div>
          </div>
        )}
      </form>

      <div className="card">
        <h2>Your webhooks</h2>
        {eps && eps.length === 0 && <p className="muted">None yet.</p>}
        {eps?.map(ep => (
          <div key={ep.id} className={`hook ${ep.active ? '' : 'dim'}`}>
            <div className="hook-main">
              <strong className="break">{ep.url}</strong>
              <div className="muted small">
                {ep.description && <>{ep.description} · </>}
                {ep.events[0] === '*' ? 'all events' : ep.events.join(', ')}
              </div>
              {ep.failing > 0 && (
                <div className="error small">
                  {ep.failing} delivery(ies) gave up — replay them below once the problem is fixed.
                </div>
              )}
            </div>
            <div className="actions">
              <button onClick={() => act(() => api.post(`/api/webhooks/${ep.id}/test`), 'Test event queued')}>
                Send test
              </button>
              <button
                onClick={() =>
                  act(
                    () => api.put(`/api/webhooks/${ep.id}`, { ...ep, active: !ep.active }),
                    ep.active ? 'Paused' : 'Resumed'
                  )
                }
              >
                {ep.active ? 'Pause' : 'Resume'}
              </button>
              <button
                className="danger"
                onClick={async () =>
                  (await confirm({
                    title: 'Remove this webhook?',
                    body: 'Its delivery log is removed too.',
                    confirm: 'Remove',
                    danger: true
                  })) && act(() => api.del(`/api/webhooks/${ep.id}`))
                }
              >
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="row between">
          <h2>Deliveries</h2>
          <select value={filter} onChange={e => setFilter(e.target.value)} aria-label="Filter deliveries">
            <option value="">All</option>
            <option value="failed">Failed</option>
            <option value="pending">Waiting</option>
            <option value="delivered">Delivered</option>
          </select>
        </div>
        {deliveries.length === 0 ? (
          <p className="muted">No deliveries yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Event</th>
                <th>To</th>
                <th>Result</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {deliveries.map(d => (
                <tr key={d.id}>
                  <td className="nowrap">{fmtTime(d.createdAt)}</td>
                  <td>
                    <code>{d.event}</code>
                  </td>
                  <td className="break small">{label(d.endpointId)}</td>
                  <td>
                    <span className={`badge dl-${d.status}`}>{d.status === 'pending' ? 'waiting' : d.status}</span>
                    <div className="muted small">
                      {d.attempts} attempt{d.attempts === 1 ? '' : 's'}
                      {d.responseCode ? ` · HTTP ${d.responseCode}` : ''}
                      {d.status !== 'delivered' && d.error ? ` · ${d.error}` : ''}
                      {d.status === 'pending' && d.nextAttemptAt ? ` · next ${fmtTime(d.nextAttemptAt)}` : ''}
                    </div>
                  </td>
                  <td className="actions">
                    <button
                      onClick={() => act(() => api.post(`/api/webhooks/deliveries/${d.id}/replay`), 'Queued again')}
                    >
                      Replay
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>Examples</h2>
        <p className="muted">
          Create an API key in Settings, then try these. Amounts are in minor units (cents). Every endpoint is described
          in the{' '}
          <a href="/api/openapi.yaml" target="_blank" rel="noreferrer">
            OpenAPI file
          </a>{' '}
          — import it into Postman, Insomnia or a code generator.
        </p>
        <Snippet title="List unpaid invoices (curl)" code={curl} />
        <Snippet title="Create an invoice (JavaScript)" code={tsExample} />
        <Snippet title="Verify a webhook signature (Node.js)" code={verify} />
      </div>
    </section>
  );
}

function Snippet({ title, code }: { title: string; code: string }) {
  const { toast } = useUi();
  return (
    <div className="snippet">
      <div className="row between">
        <strong>{title}</strong>
        <button type="button" onClick={async () => (await copyText(code)) && toast('Copied')}>
          <Icon name="copy" /> Copy
        </button>
      </div>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}
