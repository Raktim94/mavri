import { useEffect, useState } from 'react';
import { api, errorText } from '../api';
import type { IdCheck, TaxPack } from '../types';

/** What Mavri knows about each tax system, how far it goes, and where it stops. */
export function TaxPage() {
  const [packs, setPacks] = useState<TaxPack[] | null>(null);
  const [error, setError] = useState('');
  const [country, setCountry] = useState('IN');
  const [id, setId] = useState('');
  const [check, setCheck] = useState<IdCheck | null>(null);

  useEffect(() => {
    api
      .get<TaxPack[]>('/api/tax/packs')
      .then(setPacks)
      .catch(e => setError(errorText(e, 'Could not load the tax guidance.')));
  }, []);

  async function validate() {
    setCheck(
      await api.get<IdCheck>(`/api/tax/validate?country=${encodeURIComponent(country)}&id=${encodeURIComponent(id)}`)
    );
  }

  if (!packs) return error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>;
  return (
    <section>
      <header className="bar">
        <h1>Tax guidance</h1>
      </header>
      <p className="muted">
        Mavri explains which tax usually applies and checks the shape of tax numbers. It never applies a rate by itself,
        does not file returns and is not tax advice. A pack is only called <em>reviewed</em> after a person has checked
        it against its official source; none has yet, so check each rate at the source before you rely on it.
      </p>
      <div className="card">
        <h2>Check a tax number</h2>
        <div className="row">
          <label>
            Country
            <select value={country} onChange={e => setCountry(e.target.value)}>
              {['IN', 'GB', 'AE', 'US', 'DE', 'FR', 'ES', 'IT', 'NL', 'IE', 'SE', 'PL', 'AT', 'BE'].map(c => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="grow">
            Number
            <input value={id} onChange={e => setId(e.target.value)} />
          </label>
          <button onClick={validate} disabled={!id.trim()}>
            Check
          </button>
        </div>
        {check && (
          <p className={check.valid ? '' : 'error'} role="status">
            {check.valid ? '✓ ' : '✗ '}
            {check.message}
            {check.level !== 'none' && <small className="muted"> ({check.level} check only)</small>}
          </p>
        )}
      </div>
      <div className="packs">
        {packs.map(p => (
          <article key={p.id} className="card pack">
            <header>
              <h2>{p.name}</h2>
              <span className={`badge pack-${p.status}`}>{p.status}</span>
            </header>
            <p className="muted">
              Version {p.version} · {p.reviewedOn ? `reviewed ${p.reviewedOn}` : 'not independently reviewed'} · owner{' '}
              {p.owner} ·{' '}
              <a href={p.source} target="_blank" rel="noreferrer">
                official source
              </a>
            </p>
            <div className="grid2">
              <div>
                <h3>Covers</h3>
                <ul>
                  {p.covers.map(c => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Does not cover</h3>
                <ul>
                  {p.excludes.map(c => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
            {p.rates.length > 0 && (
              <details>
                <summary>
                  {p.rates.length} rate{p.rates.length === 1 ? '' : 's'} in force today
                </summary>
                <table>
                  <thead>
                    <tr>
                      <th>Rate</th>
                      <th>Usually used for</th>
                      <th>Since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.rates.map(r => (
                      <tr key={r.code}>
                        <td>{r.label}</td>
                        <td>{r.use}</td>
                        <td>{r.from}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
