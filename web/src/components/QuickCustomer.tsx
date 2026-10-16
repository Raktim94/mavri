import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from './Modal';
import { CountryPicker } from './CountryPicker';
import { api, errorText } from '../api';
import type { Party } from '../types';

/** Add a customer without leaving the document being written. Not a <form>: it sits inside the editor's form. */
export function QuickCustomer({ onSaved, onClose }: { onSaved: (p: Party) => void; onClose: () => void }) {
  const [v, setV] = useState({ name: '', email: '', phone: '', address: '', taxId: '', country: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (patch: Partial<typeof v>) => setV({ ...v, ...patch });

  async function save() {
    if (!v.name.trim()) return setError('Enter the customer’s name.');
    setBusy(true);
    setError('');
    try {
      onSaved(await api.post<Party>('/api/parties', { ...v, name: v.name.trim(), kind: 'customer' }));
    } catch (e) {
      setError(errorText(e, 'Could not save the customer.'));
      setBusy(false);
    }
  }

  const enter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      void save();
    }
  };

  return createPortal(
    <Modal title="Add customer" onClose={onClose}>
      <div className="stack" onKeyDown={enter}>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <label>
          Name
          <input value={v.name} onChange={e => set({ name: e.target.value })} required />
        </label>
        <div className="grid2">
          <label>
            Email
            <input type="email" value={v.email} onChange={e => set({ email: e.target.value })} />
          </label>
          <label>
            Phone
            <input value={v.phone} onChange={e => set({ phone: e.target.value })} />
          </label>
        </div>
        <label>
          Address (street first, then postcode and city)
          <textarea rows={3} value={v.address} onChange={e => set({ address: e.target.value })} />
        </label>
        <div className="grid2">
          <label>
            Tax ID
            <input value={v.taxId} onChange={e => set({ taxId: e.target.value })} />
          </label>
          <label>
            Country
            <CountryPicker value={v.country} onChange={country => set({ country })} />
          </label>
        </div>
        <div className="row">
          <button type="button" className="primary" disabled={busy} onClick={() => void save()}>
            {busy ? 'Saving…' : 'Save customer'}
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>,
    document.body
  );
}
