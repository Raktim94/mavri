import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, errorText } from '../api';
import type { Doc, MailPreview } from '../types';
import { Modal } from './Modal';
import { useUi } from './ui';

/** Review and send the email for a document (or a payment reminder). Placeholders are filled in on the server. */
export function EmailDialog({
  doc,
  kind,
  onClose,
  onSent
}: {
  doc: Doc;
  kind: 'send' | 'reminder';
  onClose: () => void;
  onSent: () => void;
}) {
  const [pre, setPre] = useState<MailPreview | null>(null);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const { toast } = useUi();

  useEffect(() => {
    api
      .post<MailPreview>(`/api/documents/${doc.id}/email/preview`, { kind })
      .then(p => {
        setPre(p);
        setTo(p.to);
        setSubject(p.subject);
        setBody(p.body);
      })
      .catch(e => setError(errorText(e, 'Could not prepare the email.')));
  }, [doc.id, kind]);

  async function send(e: FormEvent) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await api.post(`/api/documents/${doc.id}/email`, { kind, to, subject, body });
      toast(`Email sent to ${to}`);
      onSent();
      onClose();
    } catch (err) {
      setError(errorText(err, 'The email could not be sent.'));
      setSending(false);
    }
  }

  const what = kind === 'reminder' ? 'Payment reminder' : doc.kind === 'invoice' ? 'Email invoice' : 'Email quote';
  return (
    <Modal title={`${what} ${doc.fullNumber}`} onClose={onClose} wide>
      {pre && !pre.configured && (
        <p className="notice">
          Email is not set up yet. <Link to="/automation">Add your SMTP server</Link> to send from Mavri, or use Share
          to send the link from your own email or WhatsApp.
        </p>
      )}
      {!pre && !error && <p className="muted">Preparing…</p>}
      {pre && (
        <form onSubmit={send} className="stack">
          <label>
            To
            <input
              type="email"
              required
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="client@example.com"
            />
          </label>
          <label>
            Subject
            <input required value={subject} onChange={e => setSubject(e.target.value)} />
          </label>
          <label>
            Message
            <textarea rows={10} value={body} onChange={e => setBody(e.target.value)} />
          </label>
          <p className="muted small">
            <code>{'{{link}}'}</code> becomes the secure link to the {doc.kind}. The client sees the current version and
            can print it or save it as a PDF.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="row end">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={sending || !pre.configured}>
              {sending ? 'Sending…' : 'Send email'}
            </button>
          </div>
        </form>
      )}
      {!pre && error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
