import { useState, type FormEvent } from 'react';
import { api, errorText } from '../api';
import { blankLine } from '../docs';
import { formatMoney, toMinor } from '../money';
import type { Doc, Line } from '../types';
import { Modal } from './Modal';

/**
 * A credit note takes money off an issued invoice (everything, or some of its lines); a debit note charges extra.
 * Both are documents of their own that point at the invoice, which itself stays as it was issued.
 */
export function CorrectionDialog({
  doc,
  kind,
  onClose,
  onDone
}: {
  doc: Doc;
  kind: 'credit' | 'debit';
  onClose: () => void;
  onDone: (created: Doc) => void;
}) {
  const dec = doc.currency.decimals;
  const [mode, setMode] = useState<'full' | 'lines'>('full');
  const [qty, setQty] = useState<number[]>(doc.lines.map(() => 0));
  const [lines, setLines] = useState<Line[]>([{ ...blankLine(), name: '' }]);
  const [price, setPrice] = useState<string[]>(['']);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const left = doc.totals.totalCents - doc.creditedCents;

  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body =
        kind === 'credit'
          ? {
              kind,
              reason,
              full: mode === 'full',
              credit: qty.map((q, index) => ({ index, quantity: q })).filter(c => c.quantity > 0)
            }
          : { kind, reason, lines: lines.map((l, i) => ({ ...l, unitCents: toMinor(price[i] ?? '', dec) })) };
      onDone(await api.post<Doc>(`/api/documents/${doc.id}/corrections`, body));
    } catch (err) {
      setError(errorText(err, 'Could not issue it.'));
      setBusy(false);
    }
  }

  return (
    <Modal title={kind === 'credit' ? 'Issue a credit note' : 'Issue a debit note'} onClose={onClose} wide>
      <form onSubmit={save} className="dialog-form">
        <p className="muted">
          {doc.fullNumber} was issued, so it stays exactly as it is.{' '}
          {kind === 'credit'
            ? `A credit note reduces what ${doc.customer.name} owes. Up to ${formatMoney(left, doc.currency)} can still be credited.`
            : 'A debit note is a further invoice for extra charges, linked to this one.'}{' '}
          It is issued immediately and cannot be edited.
        </p>
        {kind === 'credit' ? (
          <>
            <div className="row" role="radiogroup" aria-label="What to credit">
              <label className="inline">
                <input type="radio" checked={mode === 'full'} onChange={() => setMode('full')} /> Everything on the
                invoice
              </label>
              <label className="inline">
                <input type="radio" checked={mode === 'lines'} onChange={() => setMode('lines')} /> Some lines
              </label>
            </div>
            {mode === 'lines' && (
              <table className="lines">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th className="num">On the invoice</th>
                    <th>Credit quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.name}</td>
                      <td className="num">{l.quantity}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max={l.quantity}
                          step="any"
                          value={qty[i]}
                          aria-label={`Quantity to credit, ${l.name}`}
                          onChange={e => setQty(qty.map((q, j) => (j === i ? Number(e.target.value) : q)))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <>
            {lines.map((l, i) => (
              <div className="row" key={i}>
                <input
                  className="grow"
                  placeholder="What is charged"
                  aria-label={`Description, line ${i + 1}`}
                  value={l.name}
                  required
                  onChange={e => setLines(lines.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
                <input
                  className="short"
                  type="number"
                  min="0"
                  step="any"
                  aria-label={`Quantity, line ${i + 1}`}
                  value={l.quantity}
                  onChange={e =>
                    setLines(lines.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))
                  }
                />
                <input
                  className="short"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Price"
                  aria-label={`Price, line ${i + 1}`}
                  value={price[i] ?? ''}
                  onChange={e => setPrice(price.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <input
                  className="short"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="Tax %"
                  aria-label={`Tax rate, line ${i + 1}`}
                  value={l.taxRate || ''}
                  onChange={e =>
                    setLines(
                      lines.map((x, j) =>
                        j === i
                          ? { ...x, taxRate: Number(e.target.value), taxMode: Number(e.target.value) > 0 ? 'add' : '' }
                          : x
                      )
                    )
                  }
                />
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setLines([...lines, blankLine()]);
                setPrice([...price, '']);
              }}
            >
              + Add line
            </button>
          </>
        )}
        <label>
          Reason (printed on the note)
          <input value={reason} onChange={e => setReason(e.target.value)} maxLength={300} />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="row end">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Issuing…' : kind === 'credit' ? 'Issue credit note' : 'Issue debit note'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
