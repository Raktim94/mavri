import { useState, type FormEvent } from 'react';
import { api, errorText } from '../api';
import { today } from '../docs';
import { formatMoney, toMajor, toMinor } from '../money';
import type { Doc } from '../types';
import { Modal } from './Modal';

/** Record money received. This is a manual entry: nothing here confirms that a bank or gateway paid. */
export function RecordPayment({ doc, onClose, onSaved }: { doc: Doc; onClose: () => void; onSaved: (d: Doc) => void }) {
  const dec = doc.currency.decimals;
  const due = Math.max(doc.totals.totalCents - doc.paidCents, 0);
  const [amount, setAmount] = useState(toMajor(due, dec));
  const [paidOn, setPaidOn] = useState(today());
  const [method, setMethod] = useState('bank');
  const [note, setNote] = useState('');
  const [kind, setKind] = useState<'payment' | 'refund'>('payment');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    const cents = toMinor(amount, dec);
    if (cents <= 0) return setError('Enter the amount received.');
    setBusy(true);
    try {
      const updated = await api.put<Doc>(`/api/documents/${doc.id}`, {
        ...doc,
        payments: [...doc.payments, { amountCents: cents, paidOn, method, note, kind }]
      });
      onSaved(updated);
    } catch (err) {
      setError(errorText(err, 'Could not record the payment.'));
      setBusy(false);
    }
  }

  return (
    <Modal title={kind === 'refund' ? 'Record a refund' : 'Record a payment'} onClose={onClose}>
      <form onSubmit={save} className="dialog-form">
        <p className="muted">
          {doc.fullNumber}: {formatMoney(due, doc.currency)} is still owed. Record money only when you have received it.
        </p>
        <div className="row" role="radiogroup" aria-label="Payment or refund">
          <label className="inline">
            <input type="radio" checked={kind === 'payment'} onChange={() => setKind('payment')} /> Money received
          </label>
          <label className="inline">
            <input
              type="radio"
              checked={kind === 'refund'}
              onChange={() => {
                setKind('refund');
                setAmount(toMajor(Math.max(doc.receivedCents ?? 0, 0), dec));
              }}
            />{' '}
            Money paid back
          </label>
        </div>
        <label>
          {kind === 'refund' ? 'Amount refunded' : 'Amount received'}
          <input type="number" step="any" min="0" value={amount} onChange={e => setAmount(e.target.value)} required />
        </label>
        <label>
          Date
          <input type="date" value={paidOn} onChange={e => setPaidOn(e.target.value)} required />
        </label>
        <label>
          Method
          <select value={method} onChange={e => setMethod(e.target.value)}>
            <option value="bank">Bank transfer</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
            <option value="cash">Cash</option>
            <option value="cheque">Cheque</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label>
          Reference or note
          <input value={note} onChange={e => setNote(e.target.value)} />
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
            {busy ? 'Saving…' : kind === 'refund' ? 'Record refund' : 'Record payment'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
