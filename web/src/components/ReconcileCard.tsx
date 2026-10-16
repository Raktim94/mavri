import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ApiError, errorText } from '../api';
import { formatMoney } from '../money';
import { useUi } from './ui';

interface Row {
  line: number;
  date: string;
  description: string;
  amountCents: number;
  status: 'matched' | 'ambiguous' | 'unmatched' | 'overpaid' | 'duplicate' | 'ignored';
  invoiceId?: number;
  number?: string;
  customer?: string;
  balanceCents?: number;
  currency?: string;
  reason: string;
  key: string;
}
interface Report {
  rows: Row[];
  matched: number;
  needsAttention: number;
  duplicate: number;
}

const LABEL: Record<Row['status'], string> = {
  matched: 'Matches',
  ambiguous: 'Could be several',
  unmatched: 'No match',
  overpaid: 'More than owed',
  duplicate: 'Already recorded',
  ignored: 'Not money in'
};

/** Match the money on a bank statement to unpaid invoices. Mavri suggests; nothing is recorded until you confirm. */
export function ReconcileCard() {
  const { toast } = useUi();
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function post(path: string, body: BodyInit, json = false) {
    const res = await fetch(path, {
      method: 'POST',
      body,
      credentials: 'same-origin',
      headers: json ? { 'Content-Type': 'application/json' } : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok)
      throw new ApiError(
        res.status,
        data.error?.code ?? 'error',
        data.error?.message ?? `The server answered ${res.status}.`
      );
    return data;
  }

  async function check() {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const r = (await post('/api/reconcile', form)) as Report;
      setReport(r);
      setPicked(new Set(r.rows.filter(x => x.status === 'matched').map(x => x.key)));
    } catch (e) {
      setError(errorText(e, 'Could not read the statement.'));
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!report) return;
    setBusy(true);
    setError('');
    try {
      const matches = report.rows
        .filter(r => picked.has(r.key))
        .map(r => ({
          key: r.key,
          invoiceId: r.invoiceId,
          date: r.date,
          amountCents: r.amountCents,
          note: r.description
        }));
      const out = (await post('/api/reconcile/apply', JSON.stringify({ matches }), true)) as {
        recorded: number;
        results: Array<{ ok: boolean; message: string }>;
      };
      const failed = out.results.filter(r => !r.ok).length;
      toast(`${out.recorded} payment${out.recorded === 1 ? '' : 's'} recorded${failed ? `, ${failed} refused` : ''}`);
      await check();
    } catch (e) {
      setError(errorText(e, 'Could not record the payments.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <h2>Match a bank statement</h2>
      <p className="muted">
        Upload your bank's statement as a CSV (columns for the date, the narration and the amount received). Mavri
        suggests which unpaid invoice each line of money received pays: the invoice number in the reference, or the
        exact amount owed with the customer's name. You confirm each match; nothing is recorded until you do, and a line
        that is already recorded is recognised, so the same statement can be checked twice.
      </p>
      <div className="row wrap">
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="Bank statement CSV"
          onChange={e => {
            setFile(e.target.files?.[0] ?? null);
            setReport(null);
          }}
        />
        <button className="primary" disabled={!file || busy} onClick={check}>
          Check statement
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
            <strong>{report.matched}</strong> match an invoice, <strong>{report.needsAttention}</strong> need a look
            {report.duplicate > 0 && <>, {report.duplicate} already recorded</>}.
          </p>
          <div className="scroll">
            <table>
              <thead>
                <tr>
                  <th />
                  <th>Date</th>
                  <th>Reference</th>
                  <th className="num">Received</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {report.rows
                  .filter(r => r.status !== 'ignored')
                  .map(r => (
                    <tr key={r.key || r.line}>
                      <td>
                        {r.status === 'matched' && (
                          <input
                            type="checkbox"
                            aria-label={`Record line ${r.line}`}
                            checked={picked.has(r.key)}
                            onChange={() =>
                              setPicked(p => {
                                const n = new Set(p);
                                if (n.has(r.key)) n.delete(r.key);
                                else n.add(r.key);
                                return n;
                              })
                            }
                          />
                        )}
                      </td>
                      <td>{r.date}</td>
                      <td>{r.description}</td>
                      <td className="num">
                        {formatMoney(r.amountCents, {
                          symbol: '',
                          pattern: '{amount} {code}',
                          decimals: 2,
                          code: r.currency ?? ''
                        })}
                      </td>
                      <td>
                        <span className={`badge recon-${r.status}`}>{LABEL[r.status]}</span>
                        {r.invoiceId && (
                          <>
                            {' '}
                            <Link to={`/invoices/${r.invoiceId}`}>{r.number}</Link> · {r.customer}
                          </>
                        )}
                        <br />
                        <small className="muted">{r.reason}</small>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="row end">
            <button className="primary" disabled={busy || picked.size === 0} onClick={apply}>
              Record {picked.size} payment{picked.size === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
