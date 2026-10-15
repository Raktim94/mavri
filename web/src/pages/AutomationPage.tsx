import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { fmtTime } from '../components/Modal';
import { Icon } from '../components/Icon';
import { useUi } from '../components/ui';
import { api, errorText } from '../api';
import { formatMoney } from '../money';
import { copyText } from '../components/Modal';
import type { AutomationConfig, MailConfig, MailLogRow, PaymentsConfig, Schedule, SchedulePreview } from '../types';

const days = (list: number[]) => list.join(', ');
const parseDays = (s: string) =>
  s
    .split(/[,\s]+/)
    .map(Number)
    .filter(n => Number.isInteger(n) && n > 0);

export function AutomationPage() {
  const { toast, confirm } = useUi();
  const [auto, setAuto] = useState<AutomationConfig | null>(null);
  const [mail, setMail] = useState<MailConfig | null>(null);
  const [before, setBefore] = useState('');
  const [after, setAfter] = useState('');
  const [password, setPassword] = useState('');
  const [testTo, setTestTo] = useState('');
  const [log, setLog] = useState<MailLogRow[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [opened, setOpened] = useState<SchedulePreview | null>(null);
  const [pay, setPay] = useState<PaymentsConfig | null>(null);
  const [payEnabled, setPayEnabled] = useState(false);
  const [stripeKey, setStripeKey] = useState('');
  const [stripeHook, setStripeHook] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get<AutomationConfig>('/api/automation')
      .then(a => {
        setAuto(a);
        setBefore(days(a.remindBefore));
        setAfter(days(a.remindAfter));
      })
      .catch(e => setError(errorText(e)));
    api
      .get<MailConfig>('/api/mail/config')
      .then(setMail)
      .catch(e => setError(errorText(e)));
    api
      .get<MailLogRow[]>('/api/mail/log?limit=15')
      .then(setLog)
      .catch(() => undefined);
    api
      .get<Schedule[]>('/api/recurring')
      .then(setSchedules)
      .catch(() => undefined);
    api
      .get<PaymentsConfig>('/api/payments/config')
      .then(p => {
        setPay(p);
        setPayEnabled(p.config.enabled);
      })
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  if (!auto || !mail) return <p className="muted">{error || 'Loading…'}</p>;
  const setA = (p: Partial<AutomationConfig>) => setAuto({ ...auto, ...p });
  const setM = (p: Partial<MailConfig>) => setMail({ ...mail, ...p });

  async function saveAuto(e?: FormEvent) {
    e?.preventDefault();
    setError('');
    try {
      const saved = await api.put<AutomationConfig>('/api/automation', {
        ...auto,
        remindBefore: parseDays(before),
        remindAfter: parseDays(after)
      });
      setAuto(saved);
      setBefore(days(saved.remindBefore));
      setAfter(days(saved.remindAfter));
      toast('Automation saved');
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function saveMail(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      setMail(await api.put<MailConfig>('/api/mail/config', { ...mail, password }));
      setPassword('');
      toast('Email settings saved');
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function savePay(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const p = await api.put<PaymentsConfig>('/api/payments/config', {
        enabled: payEnabled,
        secretKey: stripeKey,
        webhookSecret: stripeHook
      });
      setPay(p);
      setStripeKey('');
      setStripeHook('');
      toast('Online payment settings saved');
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function sendTest() {
    setError('');
    try {
      await api.post('/api/mail/test', { to: testTo });
      toast(`Test email sent to ${testTo}`);
      load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function openSchedule(s: Schedule) {
    try {
      setOpened(await api.get<SchedulePreview>(`/api/recurring/${s.id}/preview?n=6`));
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function toggle(s: Schedule) {
    await api.put(`/api/recurring/${s.id}`, { active: !s.active, endOn: s.endOn, autoSend: s.autoSend });
    load();
  }

  async function remove(s: Schedule) {
    if (
      !(await confirm({
        title: 'Stop this schedule?',
        body: 'Invoices it already issued stay as they are.',
        confirm: 'Stop schedule',
        danger: true
      }))
    )
      return;
    await api.del(`/api/recurring/${s.id}`);
    setOpened(null);
    load();
  }

  return (
    <section className="settings">
      <header className="bar">
        <div>
          <h1>Automation</h1>
          <p className="muted sub">Email, payment reminders, rules and recurring invoices.</p>
        </div>
      </header>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <form className="card" onSubmit={saveAuto}>
        <h2>Public address</h2>
        <p className="muted">
          The address clients use to reach this Mavri. Links in emails and reminders point here, so it must work from
          the outside (for example your domain behind HTTPS).
        </p>
        <div className="copy-row">
          <input
            type="url"
            placeholder="https://invoices.example.com"
            value={auto.publicUrl}
            onChange={e => setA({ publicUrl: e.target.value })}
          />
          <button type="button" onClick={() => setA({ publicUrl: location.origin })}>
            Use {location.origin}
          </button>
        </div>
        <div className="row end">
          <button className="primary">Save</button>
        </div>
      </form>

      <form className="card" onSubmit={saveMail}>
        <h2>Email</h2>
        <p className="muted">
          Mavri sends mail through your own SMTP server (your email provider, or a service like Postmark or Amazon SES).
          Nothing is sent until you switch this on.
        </p>
        <label className="inline">
          <input type="checkbox" checked={mail.enabled} onChange={e => setM({ enabled: e.target.checked })} /> Send
          email from Mavri
        </label>
        <div className="grid2">
          <label>
            SMTP server
            <input value={mail.host} onChange={e => setM({ host: e.target.value })} placeholder="smtp.example.com" />
          </label>
          <label>
            Port
            <input type="number" value={mail.port} onChange={e => setM({ port: Number(e.target.value) })} />
          </label>
          <label>
            Security
            <select value={mail.security} onChange={e => setM({ security: e.target.value as MailConfig['security'] })}>
              <option value="starttls">STARTTLS (usually port 587)</option>
              <option value="tls">TLS (usually port 465)</option>
              <option value="none">None (only on a trusted network)</option>
            </select>
          </label>
          <label>
            Username
            <input value={mail.username} onChange={e => setM({ username: e.target.value })} autoComplete="off" />
          </label>
          <label>
            Password {mail.passwordSet && <span className="muted">(saved — leave empty to keep)</span>}
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label>
            From address
            <input
              type="email"
              value={mail.from}
              onChange={e => setM({ from: e.target.value })}
              placeholder="billing@example.com"
            />
          </label>
          <label>
            From name
            <input value={mail.fromName} onChange={e => setM({ fromName: e.target.value })} />
          </label>
          <label>
            Reply-to (optional)
            <input type="email" value={mail.replyTo} onChange={e => setM({ replyTo: e.target.value })} />
          </label>
        </div>
        <h3>Message templates</h3>
        <p className="muted small">
          Placeholders:{' '}
          <code>{'{{customer}} {{number}} {{total}} {{balance}} {{due}} {{when}} {{link}} {{business}}'}</code>. You can
          still edit every email before it goes out.
        </p>
        {(
          [
            ['Invoice', 'subjectInvoice', 'bodyInvoice'],
            ['Quote', 'subjectQuote', 'bodyQuote'],
            ['Payment reminder', 'subjectReminder', 'bodyReminder']
          ] as const
        ).map(([title, sKey, bKey]) => (
          <details key={sKey}>
            <summary>{title}</summary>
            <label>
              Subject
              <input value={mail[sKey]} onChange={e => setM({ [sKey]: e.target.value })} />
            </label>
            <label>
              Message
              <textarea rows={7} value={mail[bKey]} onChange={e => setM({ [bKey]: e.target.value })} />
            </label>
          </details>
        ))}
        <div className="row end">
          <input
            type="email"
            placeholder="Send a test to…"
            value={testTo}
            onChange={e => setTestTo(e.target.value)}
            aria-label="Test recipient"
          />
          <button type="button" disabled={!testTo} onClick={sendTest}>
            Send test
          </button>
          <button className="primary">Save email settings</button>
        </div>
        {log.length > 0 && (
          <>
            <h3>Recent emails</h3>
            <ul className="timeline">
              {log.map(m => (
                <li key={m.id} className={m.status}>
                  <span className="when">{fmtTime(m.at)}</span>
                  <span>
                    {m.kind === 'reminder' ? 'Reminder' : m.kind === 'send' ? 'Sent' : m.kind} to{' '}
                    <strong>{m.to}</strong> — {m.subject}
                    {m.status === 'failed' && <em className="error"> failed: {m.error}</em>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </form>

      {pay && (
        <form className="card" onSubmit={savePay}>
          <h2>Online payments (Stripe)</h2>
          <p className="muted">
            Clients get a <strong>Pay</strong> button on the page they open from your link, and pay on Stripe’s own page
            — card details never touch Mavri. When Stripe confirms, Mavri records the payment and marks the invoice
            paid. You need a Stripe account.
          </p>
          <ol className="how">
            <li>
              In the Stripe Dashboard open <em>Developers → Webhooks → Add endpoint</em> and use this URL:
              <div className="copy-row">
                <input readOnly value={pay.webhookUrl} onFocus={e => e.target.select()} aria-label="Webhook URL" />
                <button type="button" onClick={async () => (await copyText(pay.webhookUrl)) && toast('Copied')}>
                  <Icon name="copy" /> Copy
                </button>
              </div>
            </li>
            <li>
              Select these events: <code>{pay.events.join(', ')}</code>.
            </li>
            <li>Paste the endpoint’s signing secret and your secret API key below.</li>
          </ol>
          <div className="grid2">
            <label>
              Secret API key {pay.config.secretKeySet && <span className="muted">(saved — leave empty to keep)</span>}
              <input
                type="password"
                value={stripeKey}
                onChange={e => setStripeKey(e.target.value)}
                placeholder="sk_live_… or rk_live_…"
                autoComplete="off"
              />
            </label>
            <label>
              Webhook signing secret{' '}
              {pay.config.webhookSecretSet && <span className="muted">(saved — leave empty to keep)</span>}
              <input
                type="password"
                value={stripeHook}
                onChange={e => setStripeHook(e.target.value)}
                placeholder="whsec_…"
                autoComplete="off"
              />
            </label>
          </div>
          <label className="inline">
            <input type="checkbox" checked={payEnabled} onChange={e => setPayEnabled(e.target.checked)} /> Let clients
            pay invoices online
          </label>
          <p className="muted small">
            Needs the public address above to be an HTTPS address that Stripe can reach. Test first with Stripe’s test
            keys.
          </p>
          <div className="row end">
            <button className="primary">Save online payments</button>
          </div>
        </form>
      )}

      <form className="card" onSubmit={saveAuto}>
        <h2>Payment reminders</h2>
        <p className="muted">
          Mavri emails customers about unpaid invoices on the days you choose, once per invoice and day. Switch it off
          for a single customer in their record. Needs email and a public address above.
        </p>
        <label className="inline">
          <input
            type="checkbox"
            checked={auto.remindersEnabled}
            onChange={e => setA({ remindersEnabled: e.target.checked })}
          />{' '}
          Send reminders automatically
        </label>
        <div className="grid2">
          <label>
            Days before the due date
            <input value={before} onChange={e => setBefore(e.target.value)} placeholder="3" />
          </label>
          <label>
            Days after the due date
            <input value={after} onChange={e => setAfter(e.target.value)} placeholder="3, 7, 14" />
          </label>
          <label className="inline">
            <input type="checkbox" checked={auto.remindOnDue} onChange={e => setA({ remindOnDue: e.target.checked })} />{' '}
            Also on the due date
          </label>
        </div>
        <p className="muted small">
          You can always remind one customer by hand with the Remind button on an unpaid invoice. Reminders go out
          around the clock on the server’s calendar day (UTC).
        </p>
        <div className="row end">
          <button className="primary">Save reminders</button>
        </div>
      </form>

      <form className="card" onSubmit={saveAuto}>
        <h2>Rules</h2>
        <label className="inline">
          <input
            type="checkbox"
            checked={auto.quoteAcceptedMakesInvoice}
            onChange={e => setA({ quoteAcceptedMakesInvoice: e.target.checked })}
          />{' '}
          When a quote is accepted, draft an invoice from it
        </label>
        <p className="muted small">
          The invoice is created but not sent. It appears in your invoice list for you to review.
        </p>
        <div className="row end">
          <button className="primary">Save rules</button>
        </div>
      </form>

      <div className="card">
        <h2>Recurring invoices</h2>
        <p className="muted">
          Open an invoice and choose Repeat to start one. Each copy is a normal invoice with the next number.
        </p>
        {schedules.length === 0 ? (
          <p className="muted">No schedules yet.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th>Repeats</th>
                <th>Next</th>
                <th>Issued</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {schedules.map(s => (
                <tr key={s.id} className={s.active ? undefined : 'dim'}>
                  <td>
                    <Link to={`/invoices/${s.documentId}`}>{s.number}</Link>
                  </td>
                  <td>{s.customer}</td>
                  <td>
                    every {s.interval > 1 ? `${s.interval} ` : ''}
                    {s.every}
                    {s.interval > 1 ? 's' : ''}
                  </td>
                  <td>{s.active ? s.nextOn : s.nextOn ? 'Paused' : 'Finished'}</td>
                  <td>{s.issuedCount}</td>
                  <td className="actions">
                    <button type="button" onClick={() => openSchedule(s)}>
                      Preview
                    </button>
                    {s.nextOn && (
                      <button type="button" onClick={() => toggle(s)}>
                        {s.active ? 'Pause' : 'Resume'}
                      </button>
                    )}
                    <button type="button" className="danger" onClick={() => remove(s)}>
                      Stop
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {opened && (
          <div className="preview-box">
            <h3>Next invoices from {opened.template.number}</h3>
            <ul className="upcoming">
              {opened.upcoming.map(u => (
                <li key={u.issuedOn}>
                  <strong>{u.issuedOn}</strong>
                  {u.dueOn && <span className="muted"> · due {u.dueOn}</span>}
                  <span className="grow" />
                  {formatMoney(opened.template.totalCents, {
                    symbol: opened.template.currency,
                    code: opened.template.currency,
                    pattern: '{amount} {symbol}',
                    decimals: 2
                  })}
                </li>
              ))}
              {opened.upcoming.length === 0 && <li className="muted">Nothing more is scheduled.</li>}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
