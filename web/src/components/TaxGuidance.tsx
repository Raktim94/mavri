import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Party, TaxExplanation, TaxRate } from '../types';

/**
 * Explains which tax usually applies to this sale, from the facts Mavri has. It never applies a rate:
 * a person picks one, and anything that depends on facts Mavri lacks is listed as missing or as a decision.
 */
export function TaxGuidance({
  issuer,
  customer,
  date,
  onResult,
  onPick
}: {
  issuer?: Party;
  customer?: Party;
  date: string;
  onResult: (r: TaxExplanation | null) => void;
  onPick: (r: TaxRate) => void;
}) {
  const [r, setR] = useState<TaxExplanation | null>(null);
  const [failed, setFailed] = useState(false);
  const key = JSON.stringify([
    issuer?.country,
    issuer?.taxId,
    customer?.country,
    customer?.taxId,
    customer?.taxExempt,
    date
  ]);

  useEffect(() => {
    if (!issuer) {
      setR(null);
      onResult(null);
      return;
    }
    const t = setTimeout(() => {
      api
        .post<TaxExplanation>('/api/tax/explain', {
          issuerCountry: issuer.country,
          issuerTaxId: issuer.taxId,
          customerCountry: customer?.country ?? '',
          customerTaxId: customer?.taxId ?? '',
          customerTaxExempt: customer?.taxExempt ?? false,
          date
        })
        .then(x => {
          setR(x);
          setFailed(false);
          onResult(x);
        })
        .catch(() => setFailed(true));
    }, 300);
    return () => clearTimeout(t);
    // key stands for the individual facts; onResult is stable enough for this one-way report
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!issuer) return <p className="muted">Choose your business to see tax guidance.</p>;
  if (failed)
    return (
      <p className="muted">Tax guidance is not available right now. Enter the rates your tax authority requires.</p>
    );
  if (!r) return <p className="muted">Reading the tax facts…</p>;

  return (
    <div className={`guidance ${r.confidence}`} aria-live="polite">
      <p className="g-title">
        <strong>{r.title}</strong>
        {r.pack && (
          <span className={`badge pack-${r.pack.status}`}>
            {r.pack.name} · {r.pack.status}
          </span>
        )}
      </p>
      {r.trace.length > 0 && (
        <ul className="facts">
          {r.trace.map(t => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      )}
      {r.warnings.map(w => (
        <p key={w} className="error" role="alert">
          {w}
        </p>
      ))}
      {r.missing.length > 0 && (
        <div className="g-missing">
          <strong>Missing facts</strong>
          <ul>
            {r.missing.map(m => (
              <li key={m}>
                {m} · <Link to={m.toLowerCase().includes('customer') ? '/customers' : '/issuers'}>Add it</Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.decisions.length > 0 && (
        <div className="g-decide">
          <strong>For you to decide</strong>
          <ul>
            {r.decisions.map(d => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
      )}
      {r.suggested.length > 0 && (
        <div className="row g-rates" role="group" aria-label="Rates you can apply">
          <small className="muted">Apply to all lines:</small>
          {r.suggested.map(s => (
            <button type="button" key={s.code} className="chip" title={s.use} onClick={() => onPick(s)}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      {r.pack && (
        <p className="muted g-source">
          Rules version {r.pack.version},{' '}
          {r.pack.reviewedOn ? `last reviewed ${r.pack.reviewedOn}` : 'not independently reviewed'}. Check rates at the{' '}
          <a href={r.pack.source} target="_blank" rel="noreferrer">
            official source
          </a>
          . Mavri guides; it does not file returns or give tax advice.
        </p>
      )}
    </div>
  );
}
