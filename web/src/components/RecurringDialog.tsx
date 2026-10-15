import { useEffect, useState, type FormEvent } from 'react';
import { api, errorText } from '../api';
import { formatMoney } from '../money';
import type { Doc, SchedulePreview } from '../types';
import { Modal } from './Modal';
import { useUi } from './ui';

// The invoice being repeated already covers today, so the first copy defaults to a month from now.
const nextMonth = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
};

/** Repeat an invoice on a schedule, showing exactly which invoices will be issued before anything starts. */
export function RecurringDialog({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [every, setEvery] = useState<'week' | 'month' | 'quarter' | 'year'>('month');
  const [interval, setInterval] = useState(1);
  const [startOn, setStartOn] = useState(nextMonth);
  const [endOn, setEndOn] = useState('');
  const [autoSend, setAutoSend] = useState(false);
  const [preview, setPreview] = useState<SchedulePreview | null>(null);
  const [error, setError] = useState('');
  const { toast } = useUi();

  useEffect(() => {
    let live = true;
    api
      .post<SchedulePreview>('/api/recurring/preview?n=6', { documentId: doc.id, every, interval, startOn, endOn })
      .then(p => live && (setPreview(p), setError('')))
      .catch(e => live && (setPreview(null), setError(errorText(e))));
    return () => {
      live = false;
    };
  }, [doc.id, every, interval, startOn, endOn]);

  async function start(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/recurring', { documentId: doc.id, every, interval, startOn, endOn, autoSend });
      toast('Schedule started');
      onClose();
    } catch (err) {
      setError(errorText(err, 'Could not start the schedule.'));
    }
  }

  return (
    <Modal title={`Repeat invoice ${doc.fullNumber}`} onClose={onClose} wide>
      <form onSubmit={start} className="stack">
        <p className="muted">
          Mavri copies this invoice (lines, customer, notes and payment terms) on each date and gives every copy the
          next number. This invoice stays as it is. Copies are normal invoices you can edit, send or void.
        </p>
        <div className="grid2">
          <label>
            Repeat every
            <span className="row">
              <input
                type="number"
                min={1}
                max={120}
                value={interval}
                onChange={e => setInterval(Math.max(1, Number(e.target.value) || 1))}
                aria-label="Number of periods"
              />
              <select value={every} onChange={e => setEvery(e.target.value as typeof every)} aria-label="Period">
                <option value="week">week(s)</option>
                <option value="month">month(s)</option>
                <option value="quarter">quarter(s)</option>
                <option value="year">year(s)</option>
              </select>
            </span>
          </label>
          <label>
            First invoice on
            <input type="date" required value={startOn} onChange={e => setStartOn(e.target.value)} />
          </label>
          <label>
            Stop after (optional)
            <input type="date" value={endOn} onChange={e => setEndOn(e.target.value)} />
          </label>
          <label className="inline">
            <input type="checkbox" checked={autoSend} onChange={e => setAutoSend(e.target.checked)} /> Email each new
            invoice to the customer
          </label>
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {preview && (
          <div className="preview-box">
            <h3>Next invoices</h3>
            <ul className="upcoming">
              {preview.upcoming.map(u => (
                <li key={u.issuedOn}>
                  <strong>{u.issuedOn}</strong>
                  {u.dueOn && <span className="muted"> · due {u.dueOn}</span>}
                  <span className="grow" />
                  {formatMoney(preview.template.totalCents, doc.currency)}
                </li>
              ))}
            </ul>
            <p className="muted small">
              Each is a copy of {preview.template.number} ({preview.template.lines} line
              {preview.template.lines === 1 ? '' : 's'}) for {preview.template.customer}. Dates in the past are issued
              straight away.
            </p>
          </div>
        )}
        <div className="row end">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={!preview}>
            Start schedule
          </button>
        </div>
      </form>
    </Modal>
  );
}
