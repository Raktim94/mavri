import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorText } from '../api';
import { today } from '../docs';
import type { FollowUp } from '../types';
import { fmtTime } from './Modal';
import { useUi } from './ui';

const LABEL: Record<FollowUp['kind'], string> = {
  promise: 'Promise to pay',
  dispute: 'Dispute',
  snooze: 'Reminders paused',
  note: 'Note'
};

const plusDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

/** What was agreed with the client about this invoice. Nothing here sends a message or adds a fee. */
export function FollowUps({ docId, onChange }: { docId: number; onChange?: () => void }) {
  const [rows, setRows] = useState<FollowUp[]>([]);
  const [kind, setKind] = useState<FollowUp['kind']>('promise');
  const [dueOn, setDueOn] = useState(plusDays(7));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useUi();

  const load = useCallback(() => {
    api
      .get<FollowUp[]>(`/api/documents/${docId}/follow-ups`)
      .then(setRows)
      .catch(() => undefined);
  }, [docId]);
  useEffect(load, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post(`/api/documents/${docId}/follow-ups`, {
        kind,
        dueOn: kind === 'promise' || kind === 'snooze' ? dueOn : '',
        note
      });
      setNote('');
      toast(`${LABEL[kind]} saved`);
      load();
      onChange?.();
    } catch (err) {
      setError(errorText(err, 'Could not save.'));
    } finally {
      setBusy(false);
    }
  }

  async function resolve(id: number) {
    try {
      await api.post(`/api/follow-ups/${id}/resolve`);
      load();
      onChange?.();
    } catch (err) {
      setError(errorText(err));
    }
  }

  const needsDate = kind === 'promise' || kind === 'snooze';
  return (
    <div className="card followups noprint">
      <h2>Collections</h2>
      <p className="muted">
        Record what the client said. A dispute, a pause or a promise that is not due yet stops automatic reminders for
        this invoice. Mavri never adds late fees.
      </p>
      <form onSubmit={add} className="followup-form">
        <label>
          What happened
          <select value={kind} onChange={e => setKind(e.target.value as FollowUp['kind'])}>
            <option value="promise">The client promised to pay by a date</option>
            <option value="snooze">Pause automatic reminders</option>
            <option value="dispute">The client disputes this invoice</option>
            <option value="note">Just a note</option>
          </select>
        </label>
        {needsDate && (
          <label>
            {kind === 'promise' ? 'Pay by' : 'Pause until'}
            <input type="date" value={dueOn} min={today()} onChange={e => setDueOn(e.target.value)} required />
          </label>
        )}
        <label className="grow">
          Note{kind === 'dispute' || kind === 'note' ? '' : ' (optional)'}
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={1000}
            required={kind === 'dispute' || kind === 'note'}
          />
        </label>
        <button className="primary" disabled={busy}>
          Save
        </button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {rows.length > 0 && (
        <ul className="timeline">
          {rows.map(f => (
            <li key={f.id} className={f.status === 'resolved' ? 'resolved' : ''}>
              <span className="when">{fmtTime(f.createdAt)}</span>
              <span>
                <strong>{LABEL[f.kind]}</strong>
                {f.dueOn && <span> until {f.dueOn}</span>}
                {f.note && <span className="muted"> — {f.note}</span>}
                <small className="muted">
                  {' '}
                  · {f.source === 'public' ? 'from the client link' : 'recorded here'}
                  {f.status === 'resolved' ? ' · closed' : ''}
                </small>
                {f.status === 'open' && f.kind !== 'note' && (
                  <button type="button" className="link" onClick={() => resolve(f.id)}>
                    {f.kind === 'dispute' ? ' Mark settled' : ' Close'}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
