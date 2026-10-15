import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { bytes, fmtTime } from '../components/Modal';
import { api, errorText } from '../api';
import type { Health } from '../types';

type Tone = 'ok' | 'warn' | 'bad';

function Tile({ title, tone, children, to }: { title: string; tone: Tone; children: ReactNode; to?: string }) {
  return (
    <div className={`health-tile ${tone}`}>
      <div className="health-title">
        <span className="dot" aria-hidden="true" />
        <h2>{title}</h2>
        <span className="sr-only">{tone === 'ok' ? 'healthy' : tone === 'warn' ? 'needs attention' : 'problem'}</span>
      </div>
      <div className="health-body">{children}</div>
      {to && (
        <Link className="health-link" to={to}>
          Open
        </Link>
      )}
    </div>
  );
}

function uptime(s: number) {
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} days`;
}

export function HealthPage() {
  const [h, setH] = useState<Health | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const load = () =>
      api
        .get<Health>('/api/admin/health')
        .then(setH)
        .catch(e => setError(errorText(e)));
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, []);

  if (!h) return <p className={error ? 'error' : 'muted'}>{error || 'Loading…'}</p>;
  const b = h.backup;
  const backupTone: Tone = !b?.lastSuccess ? 'bad' : b.enabled && b.ageHours > 72 ? 'warn' : !b.enabled ? 'warn' : 'ok';
  return (
    <section>
      <header className="bar">
        <div>
          <h1>Health</h1>
          <p className="muted sub">
            Version {h.version} · running for {uptime(h.uptimeSeconds)} · schema {h.schema.replace('.sql', '')}
          </p>
        </div>
      </header>
      <div className="health-grid">
        <Tile title="Database" tone={h.databaseCheck === 'ok' ? 'ok' : 'bad'}>
          <p>{h.databaseCheck === 'ok' ? 'Integrity check passed.' : `Integrity check: ${h.databaseCheck}`}</p>
          <p className="muted">
            {bytes(h.databaseBytes)} · {h.counts.documents} documents, {h.counts.parties} customers and businesses,{' '}
            {h.counts.payments} payments
          </p>
        </Tile>
        <Tile title="Storage" tone="ok">
          <p>{bytes(h.dataFolderBytes)} in the data folder (database, keys and local backups).</p>
        </Tile>
        <Tile title="Backups" tone={backupTone} to="/data">
          {b?.lastSuccess ? (
            <p>
              Last good backup {fmtTime(b.lastSuccess.at)} (
              {b.ageHours < 1 ? 'under an hour' : `${Math.round(b.ageHours)} h`} ago). {b.copies} cop
              {b.copies === 1 ? 'y' : 'ies'} on this server.
            </p>
          ) : (
            <p>No backup has been made yet.</p>
          )}
          {!b?.enabled && <p className="warn-text">Automatic backups are off.</p>}
          {b?.lastFailure && (!b.lastSuccess || b.lastFailure.at > b.lastSuccess.at) && (
            <p className="error">Latest attempt failed: {b.lastFailure.error}</p>
          )}
        </Tile>
        <Tile title="Webhooks" tone={h.webhooks.failed24h > 0 ? 'warn' : 'ok'} to="/integrations">
          <p>
            {h.webhooks.delivered24h} delivered, {h.webhooks.pending} waiting, {h.webhooks.failed24h} failed in the last
            24 hours.
          </p>
        </Tile>
        <Tile
          title="Email"
          tone={!h.email.configured ? 'warn' : h.email.failed24h > 0 ? 'warn' : 'ok'}
          to="/automation"
        >
          <p>
            {h.email.configured
              ? `${h.email.sent24h} sent, ${h.email.failed24h} failed in the last 24 hours.`
              : 'Email is not set up, so invoices and reminders cannot be sent from Mavri.'}
          </p>
        </Tile>
        <Tile
          title="Automation"
          tone={
            h.automation && (h.automation.reminders || h.automation.recurringActive > 0) && !h.automation.publicUrlSet
              ? 'warn'
              : 'ok'
          }
          to="/automation"
        >
          <p>
            Reminders {h.automation?.reminders ? 'on' : 'off'} · {h.automation?.recurringActive ?? 0} active recurring
            schedule
            {h.automation?.recurringActive === 1 ? '' : 's'} · {h.overdueInvoices ?? 0} overdue invoice
            {h.overdueInvoices === 1 ? '' : 's'}.
          </p>
          {h.automation && !h.automation.publicUrlSet && (
            <p className="warn-text">Set the public address so automatic emails contain a working link.</p>
          )}
        </Tile>
      </div>
      <div className="card">
        <h2>
          <Icon name="bell" /> Recent warnings and errors
        </h2>
        {h.recentErrors.length === 0 ? (
          <p className="muted">Nothing since the server started.</p>
        ) : (
          <ul className="timeline">
            {h.recentErrors.map((e, i) => (
              <li key={i} className={e.level === 'ERROR' ? 'failed' : undefined}>
                <span className="when">{fmtTime(e.at)}</span>
                <span>
                  <strong>{e.message}</strong>
                  {e.detail && <span className="muted"> — {e.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
