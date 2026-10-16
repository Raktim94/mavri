import { useCallback, useEffect, useState } from 'react';
import { api, errorText } from '../api';
import type { Party } from '../types';

interface Check {
  id: number;
  provider: string;
  taxId: string;
  result: 'valid' | 'invalid' | 'unavailable';
  name: string;
  message: string;
  checkedAt: string;
}

const EU = [
  'AT',
  'BE',
  'BG',
  'HR',
  'CY',
  'CZ',
  'DK',
  'EE',
  'FI',
  'FR',
  'DE',
  'GR',
  'HU',
  'IE',
  'IT',
  'LV',
  'LT',
  'LU',
  'MT',
  'NL',
  'PL',
  'PT',
  'RO',
  'SK',
  'SI',
  'ES',
  'SE'
];

/**
 * The last official check of a customer's tax number, and a button to run one. It is explicit: the number is sent to
 * the European Commission's VIES service when you press it, and the answer, who gave it and when are kept.
 */
export function TaxCheck({ party }: { party: Party }) {
  const [checks, setChecks] = useState<Check[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const canAsk = Boolean(party.taxId) && EU.includes((party.country ?? '').toUpperCase());

  const load = useCallback(() => {
    api
      .get<Check[]>(`/api/parties/${party.id}/tax-checks`)
      .then(setChecks)
      .catch(() => setChecks([]));
  }, [party.id]);
  useEffect(load, [load]);

  async function run() {
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/parties/${party.id}/verify-tax`);
      load();
    } catch (e) {
      setError(errorText(e, 'The check could not be made.'));
    } finally {
      setBusy(false);
    }
  }

  const last = checks.find(c => c.taxId === party.taxId);
  return (
    <div className="taxcheck">
      {last ? (
        <p>
          <span className={`badge check-${last.result}`}>
            {last.result === 'valid' ? 'Active' : last.result === 'invalid' ? 'Not active' : 'No answer'}
          </span>{' '}
          {last.provider} said so on {last.checkedAt.slice(0, 10)}
          {last.name && ` (${last.name})`}.{' '}
          {last.result === 'unavailable' && <span className="muted">{last.message}</span>}
        </p>
      ) : (
        <p className="muted">This tax number has not been checked with an official service.</p>
      )}
      {canAsk && (
        <button type="button" disabled={busy} onClick={run}>
          {busy ? 'Asking VIES…' : last ? 'Check again with VIES' : 'Check with VIES'}
        </button>
      )}
      {canAsk && <small className="muted"> Sends this VAT number to the European Commission’s VIES service.</small>}
      {!canAsk && party.taxId && (
        <small className="muted">
          Mavri can only ask VIES for EU VAT numbers. For other countries check the number on the tax authority’s own
          site.
        </small>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
