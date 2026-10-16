import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Icon } from '../components/Icon';
import { bytes, fmtTime, Modal } from '../components/Modal';
import { useAuth } from '../auth';
import { ReconcileCard } from '../components/ReconcileCard';
import { useUi } from '../components/ui';
import { api, ApiError, download, errorText } from '../api';
import type { BackupConfig, BackupFile, BackupStatus, ImportReport } from '../types';

export function DataPage() {
  const { user } = useAuth();
  return (
    <section className="settings">
      <header className="bar">
        <div>
          <h1>Data & backups</h1>
          <p className="muted sub">Move data in and out as CSV, and keep safe copies of everything.</p>
        </div>
      </header>
      <CsvCard />
      <ReconcileCard />
      {user?.role === 'owner' && <BackupCard />}
    </section>
  );
}

// ---- CSV ---------------------------------------------------------------------

const EXPORTS: [string, string][] = [
  ['customers', 'Customers'],
  ['products', 'Products'],
  ['invoices', 'Invoices and quotes'],
  ['payments', 'Payments']
];

function csvCell(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function CsvCard() {
  const { toast } = useUi();
  const [kind, setKind] = useState<'customers' | 'products' | 'invoices'>('customers');
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function send(dry: boolean): Promise<ImportReport> {
    const form = new FormData();
    form.append('file', file!);
    const res = await fetch(`/api/import/${kind}${dry ? '?dryRun=1' : ''}`, {
      method: 'POST',
      body: form,
      credentials: 'same-origin'
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new ApiError(
        res.status,
        body.error?.code ?? 'error',
        body.error?.message ?? `The server answered ${res.status}.`
      );
    return body as ImportReport;
  }

  async function check() {
    setBusy(true);
    setError('');
    try {
      setReport(await send(true));
    } catch (e) {
      setReport(null);
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    setBusy(true);
    try {
      const r = await send(false);
      toast(`Imported ${r.created} ${kind}`);
      setReport(null);
      setFile(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  function downloadErrors() {
    if (!report) return;
    const rows = [
      ['line', 'problem', ...report.header],
      ...report.errors.map(e => [String(e.line), e.message, ...e.raw])
    ];
    const blob = new Blob(['﻿' + rows.map(r => r.map(csvCell).join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mavri-import-problems-${kind}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const problems = report ? report.errors.filter(e => !e.message.includes('skipped')) : [];
  return (
    <div className="card">
      <h2>CSV import and export</h2>
      <h3>Export</h3>
      <div className="row wrap">
        {EXPORTS.map(([k, l]) => (
          <button
            key={k}
            onClick={() => download(`/api/export/${k}.csv`, `mavri-${k}.csv`).catch(e => setError(errorText(e)))}
          >
            <Icon name="download" /> {l}
          </button>
        ))}
      </div>
      <h3>Import</h3>
      <p className="muted">
        Bring in customers, products or past invoices from a spreadsheet. The first row names the columns:{' '}
        <code>
          {kind === 'customers'
            ? 'name, email, phone, address, tax_id, country, note'
            : kind === 'products'
              ? 'name, description, price, category, unit'
              : 'invoice number, customer, date, currency, description, qty, unit price, tax %'}
        </code>
        {kind === 'invoices' &&
          ' (one row per line item; rows with the same number are one invoice; optional: customer email, due date, total, paid, paid on, issuer)'}
        . Nothing is written until you check the file and confirm.
      </p>
      <div className="row wrap">
        <select
          value={kind}
          onChange={e => {
            setKind(e.target.value as typeof kind);
            setReport(null);
          }}
          aria-label="What to import"
        >
          <option value="customers">Customers</option>
          <option value="products">Products</option>
          <option value="invoices">Invoices</option>
        </select>
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          onChange={e => {
            setFile(e.target.files?.[0] ?? null);
            setReport(null);
          }}
        />
        <button className="primary" disabled={!file || busy} onClick={check}>
          Check file
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {report && (
        <div className="preview-box">
          <p>
            <strong>{report.valid}</strong> of {report.total} rows are ready to import
            {report.skipped > 0 && <>, {report.skipped} already exist and will be skipped</>}
            {problems.length > 0 && (
              <>
                , <strong className="error">{problems.length}</strong> have problems
              </>
            )}
            .
          </p>
          {report.preview.length > 0 && (
            <table>
              <thead>
                <tr>
                  {Object.keys(report.preview[0]).map(k => (
                    <th key={k}>{k}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.preview.map((r, i) => (
                  <tr key={i}>
                    {Object.values(r).map((v, j) => (
                      <td key={j}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {report.errors.length > 0 && (
            <details open={problems.length > 0}>
              <summary>
                {report.errors.length} row{report.errors.length === 1 ? '' : 's'} will not be imported
              </summary>
              <ul className="problems">
                {report.errors.slice(0, 50).map(e => (
                  <li key={e.line}>
                    <strong>Line {e.line}:</strong> {e.message}
                  </li>
                ))}
              </ul>
              {report.errors.length > 50 && (
                <p className="muted small">…and {report.errors.length - 50} more. Download the full list.</p>
              )}
              <button type="button" onClick={downloadErrors}>
                <Icon name="download" /> Download the list (CSV)
              </button>
            </details>
          )}
          <div className="row end">
            <button className="primary" disabled={report.valid === 0 || busy} onClick={commit}>
              Import {report.valid} {kind}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Backups -----------------------------------------------------------------

const EVERY: [number, string][] = [
  [6, 'every 6 hours'],
  [12, 'every 12 hours'],
  [24, 'every day'],
  [72, 'every 3 days'],
  [168, 'every week']
];

function ago(hours: number) {
  if (hours < 1) return 'less than an hour ago';
  if (hours < 48) return `${Math.round(hours)} hour${Math.round(hours) === 1 ? '' : 's'} ago`;
  return `${Math.round(hours / 24)} days ago`;
}

function BackupCard() {
  const { toast } = useUi();
  const [st, setSt] = useState<BackupStatus | null>(null);
  const [cfg, setCfg] = useState<BackupConfig | null>(null);
  const [pass, setPass] = useState('');
  const [secret, setSecret] = useState('');
  const [s3Files, setS3Files] = useState<BackupFile[] | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [restore, setRestore] = useState<{ source: 'upload' | 'local' | 's3'; name?: string } | null>(null);

  const load = useCallback(() => {
    api
      .get<BackupStatus>('/api/backups')
      .then(s => {
        setSt(s);
        setCfg(c => c ?? s.config);
      })
      .catch(e => setError(errorText(e)));
  }, []);
  useEffect(load, [load]);

  if (!st || !cfg)
    return <div className="card">{error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}</div>;
  const set = (p: Partial<BackupConfig>) => setCfg({ ...cfg, ...p });
  const setS3 = (p: Partial<BackupConfig['s3']>) => setCfg({ ...cfg, s3: { ...cfg.s3, ...p } });

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const s = await api.put<BackupStatus>('/api/backups/config', {
        ...cfg,
        passphrase: pass,
        s3: { ...cfg!.s3, secretKey: secret }
      });
      setSt(s);
      setCfg(s.config);
      setPass('');
      setSecret('');
      toast('Backup settings saved');
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function run() {
    setBusy('run');
    setError('');
    try {
      await api.post('/api/backups/run');
      toast('Backup finished');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy('');
      load();
    }
  }

  async function testS3() {
    setBusy('s3');
    setError('');
    try {
      await api.post('/api/backups/test-s3');
      toast('Connected to S3');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy('');
    }
  }

  async function listS3() {
    try {
      setS3Files(await api.get<BackupFile[]>('/api/backups/s3'));
    } catch (e) {
      setError(errorText(e));
    }
  }

  const age = st.ageHours;
  const stale = cfg.enabled && age >= 0 && age > st.config.everyHours * 2;
  const state = !st.lastSuccess
    ? 'bad'
    : stale || (st.lastFailure && st.lastFailure.at > st.lastSuccess.at)
      ? 'warn'
      : 'ok';
  return (
    <div className="card">
      <h2>Backups</h2>
      <div className={`backup-state ${state}`}>
        <Icon name={state === 'ok' ? 'check' : 'bell'} size={22} />
        <div>
          {st.lastSuccess ? (
            <>
              <strong>Last good backup {ago(age)}</strong>
              <div className="muted small">
                {fmtTime(st.lastSuccess.at)} · {st.lastSuccess.name} · {bytes(st.lastSuccess.bytes)}
              </div>
            </>
          ) : (
            <strong>No backup has been made yet</strong>
          )}
          {st.lastFailure && (!st.lastSuccess || st.lastFailure.at > st.lastSuccess.at) && (
            <div className="error small">
              Latest attempt failed ({st.lastFailure.target === 's3' ? 'S3' : 'this server'}): {st.lastFailure.error}
            </div>
          )}
          {stale && <div className="error small">Backups are overdue — check the Health page.</div>}
        </div>
        <div className="grow" />
        <button className="primary" onClick={run} disabled={busy === 'run'}>
          {busy === 'run' ? 'Backing up…' : 'Back up now'}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={save} className="stack">
        <h3>Schedule</h3>
        <label className="inline">
          <input type="checkbox" checked={cfg.enabled} onChange={e => set({ enabled: e.target.checked })} /> Back up
          automatically
        </label>
        <div className="grid2">
          <label>
            How often
            <select value={cfg.everyHours} onChange={e => set({ everyHours: Number(e.target.value) })}>
              {EVERY.map(([h, l]) => (
                <option key={h} value={h}>
                  {l}
                </option>
              ))}
              {!EVERY.some(([h]) => h === cfg.everyHours) && (
                <option value={cfg.everyHours}>every {cfg.everyHours} hours</option>
              )}
            </select>
          </label>
          <label>
            Copies to keep
            <input
              type="number"
              min={1}
              max={365}
              value={cfg.keep}
              onChange={e => set({ keep: Number(e.target.value) })}
            />
          </label>
        </div>
        <label className="inline">
          <input type="checkbox" checked={cfg.encrypt} onChange={e => set({ encrypt: e.target.checked })} /> Encrypt
          backups with a passphrase
        </label>
        {cfg.encrypt && (
          <label>
            Passphrase {cfg.passphraseSet && <span className="muted">(saved — leave empty to keep)</span>}
            <input
              type="password"
              minLength={8}
              value={pass}
              onChange={e => setPass(e.target.value)}
              autoComplete="new-password"
            />
            <span className="muted small">{st.encryptionNote} Write it down somewhere other than this server.</span>
          </label>
        )}

        <h3>Off-site copy (S3-compatible storage)</h3>
        <p className="muted small">
          Works with Amazon S3, Backblaze B2, Cloudflare R2, Wasabi, MinIO and others. Each backup is uploaded after it
          is made.
        </p>
        <label className="inline">
          <input type="checkbox" checked={cfg.s3.enabled} onChange={e => setS3({ enabled: e.target.checked })} /> Also
          upload to S3
        </label>
        {cfg.s3.enabled && (
          <div className="grid2">
            <label>
              Endpoint (empty for Amazon S3)
              <input
                value={cfg.s3.endpoint}
                onChange={e => setS3({ endpoint: e.target.value })}
                placeholder="https://s3.eu-central-003.backblazeb2.com"
              />
            </label>
            <label>
              Region
              <input value={cfg.s3.region} onChange={e => setS3({ region: e.target.value })} placeholder="us-east-1" />
            </label>
            <label>
              Bucket
              <input value={cfg.s3.bucket} onChange={e => setS3({ bucket: e.target.value })} />
            </label>
            <label>
              Folder (optional)
              <input value={cfg.s3.prefix} onChange={e => setS3({ prefix: e.target.value })} placeholder="mavri" />
            </label>
            <label>
              Access key
              <input value={cfg.s3.accessKey} onChange={e => setS3({ accessKey: e.target.value })} autoComplete="off" />
            </label>
            <label>
              Secret key {cfg.s3.secretKeySet && <span className="muted">(saved — leave empty to keep)</span>}
              <input
                type="password"
                value={secret}
                onChange={e => setSecret(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="inline">
              <input
                type="checkbox"
                checked={cfg.s3.pathStyle}
                onChange={e => setS3({ pathStyle: e.target.checked })}
              />{' '}
              Put the bucket in the path (MinIO and most others)
            </label>
          </div>
        )}
        <div className="row end">
          {cfg.s3.enabled && (
            <button type="button" onClick={testS3} disabled={busy === 's3'}>
              Test connection (save first)
            </button>
          )}
          <button className="primary">Save backup settings</button>
        </div>
      </form>

      <h3>What a backup contains</h3>
      <div className="grid2 scope">
        <div>
          <strong className="ok-text">Included</strong>
          <ul>
            {st.included.map(i => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        </div>
        <div>
          <strong className="warn-text">Not included</strong>
          <ul>
            {st.excluded.map(i => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <p className="muted small">
            After restoring on a new server you sign in with that server’s own account, then add API keys, store
            connections, email and webhooks again.
          </p>
        </div>
      </div>

      <h3>Copies on this server</h3>
      {st.files.length === 0 ? (
        <p className="muted">None yet.</p>
      ) : (
        <FileTable
          files={st.files}
          onDownload={f => download(`/api/backups/files/${f.name}`, f.name).catch(e => setError(errorText(e)))}
          onRestore={f => setRestore({ source: 'local', name: f.name })}
        />
      )}
      {cfg.s3.enabled && (
        <>
          <div className="row between">
            <h3>Copies in S3</h3>
            <button onClick={listS3}>{s3Files ? 'Refresh' : 'Show copies'}</button>
          </div>
          {s3Files &&
            (s3Files.length === 0 ? (
              <p className="muted">None found.</p>
            ) : (
              <FileTable files={s3Files} onRestore={f => setRestore({ source: 's3', name: f.name })} />
            ))}
        </>
      )}

      <h3>Restore</h3>
      <p className="muted">
        Restoring replaces your invoices, quotes and records with the ones in a backup. A safety copy of the current
        data is made first. The guide checks the file before anything changes.
      </p>
      <div className="row wrap">
        <button onClick={() => setRestore({ source: 'upload' })}>Restore from a file…</button>
        <button onClick={() => download('/api/backup', 'mavri-backup.json.gz').catch(e => setError(errorText(e)))}>
          <Icon name="download" /> Download a backup file now
        </button>
      </div>
      {st.runs.length > 0 && (
        <details>
          <summary>Backup history</summary>
          <ul className="timeline">
            {st.runs.map(r => (
              <li key={r.id} className={r.ok ? 'sent' : 'failed'}>
                <span className="when">{fmtTime(r.at)}</span>
                <span>
                  {r.target === 's3' ? 'S3' : 'This server'} —{' '}
                  {r.ok ? `${r.name} (${bytes(r.bytes)})` : <em className="error">failed: {r.error}</em>}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {restore && <RestoreGuide {...restore} onClose={() => setRestore(null)} />}
    </div>
  );
}

function FileTable({
  files,
  onDownload,
  onRestore
}: {
  files: BackupFile[];
  onDownload?: (f: BackupFile) => void;
  onRestore: (f: BackupFile) => void;
}) {
  return (
    <table>
      <tbody>
        {files.map(f => (
          <tr key={f.name}>
            <td>
              <code>{f.name}</code>
              {f.encrypted && <span className="badge open"> encrypted</span>}
            </td>
            <td>{bytes(f.bytes)}</td>
            <td className="nowrap">{fmtTime(f.at)}</td>
            <td className="actions">
              {onDownload && <button onClick={() => onDownload(f)}>Download</button>}
              <button onClick={() => onRestore(f)}>Restore…</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type Step = 'choose' | 'check' | 'confirm' | 'done';

function RestoreGuide({
  source,
  name,
  onClose
}: {
  source: 'upload' | 'local' | 's3';
  name?: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('choose');
  const [file, setFile] = useState<File | null>(null);
  const [pass, setPass] = useState('');
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [sure, setSure] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function call(path: string): Promise<Response> {
    if (source === 'upload') {
      const form = new FormData();
      form.append('file', file!);
      form.append('passphrase', pass);
      return fetch(path, { method: 'POST', body: form, credentials: 'same-origin' });
    }
    return fetch(path, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, name, passphrase: pass })
    });
  }

  async function check() {
    setBusy(true);
    setError('');
    const res = await call('/api/backups/verify');
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) return setError(body.error?.message ?? 'That backup could not be read.');
    setCounts(body.counts);
    setStep('confirm');
  }

  async function doRestore() {
    setBusy(true);
    setError('');
    const res = await call('/api/backups/restore?confirm=replace');
    setBusy(false);
    if (res.ok) return setStep('done');
    const body = await res.json().catch(() => ({}));
    setError(body.error?.message ?? 'The restore failed. Nothing was changed.');
  }

  const labels: Record<string, string> = {
    documents: 'invoices and quotes',
    parties: 'customers and businesses',
    products: 'products',
    payments: 'payments',
    recurring: 'schedules',
    audit_log: 'history entries'
  };
  return (
    <Modal title="Restore from a backup" onClose={onClose}>
      <ol className="steps" aria-label="Steps">
        {(['choose', 'check', 'confirm', 'done'] as Step[]).map((s, i) => (
          <li
            key={s}
            className={
              s === step ? 'on' : ['choose', 'check', 'confirm', 'done'].indexOf(step) > i ? 'past' : undefined
            }
          >
            {['Pick', 'Check', 'Confirm', 'Done'][i]}
          </li>
        ))}
      </ol>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {(step === 'choose' || step === 'check') && (
        <div className="stack">
          {source === 'upload' ? (
            <label>
              Backup file
              <input
                type="file"
                accept=".gz,.enc,application/gzip"
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
          ) : (
            <p>
              Backup <code>{name}</code> from {source === 's3' ? 'S3' : 'this server'}.
            </p>
          )}
          <label>
            Passphrase{' '}
            <span className="muted">
              (only if the backup is encrypted{source !== 'upload' ? '; the saved one is used if empty' : ''})
            </span>
            <input type="password" value={pass} onChange={e => setPass(e.target.value)} autoComplete="off" />
          </label>
          <div className="row end">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={busy || (source === 'upload' && !file)} onClick={check}>
              {busy ? 'Checking…' : 'Check this backup'}
            </button>
          </div>
        </div>
      )}
      {step === 'confirm' && counts && (
        <div className="stack">
          <p>
            <Icon name="check" /> The backup is readable. It contains:
          </p>
          <ul className="counts">
            {Object.entries(labels).map(([k, l]) => (
              <li key={k}>
                <strong>{counts[k] ?? 0}</strong> {l}
              </li>
            ))}
          </ul>
          <p className="notice">
            Restoring <strong>replaces</strong> your current invoices, quotes and records with these. Store connections
            are removed. A safety backup of the current data is made first.
          </p>
          <label className="inline">
            <input type="checkbox" checked={sure} onChange={e => setSure(e.target.checked)} /> I understand and want to
            replace my data
          </label>
          <div className="row end">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary danger-fill" disabled={!sure || busy} onClick={doRestore}>
              {busy ? 'Restoring…' : 'Restore now'}
            </button>
          </div>
        </div>
      )}
      {step === 'done' && (
        <div className="stack">
          <p className="notice ok">
            <Icon name="check" /> Restored. Reload the page to see your data.
          </p>
          <div className="row end">
            <button className="primary" onClick={() => location.assign('/dashboard')}>
              Reload
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
