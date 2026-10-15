import { useEffect, useState } from 'react';
import { api, errorText } from '../api';
import { formatMoney } from '../money';
import type { Doc, ShareLink } from '../types';
import { Icon } from './Icon';
import { copyText, fmtTime, Modal } from './Modal';
import { useUi } from './ui';

/**
 * Share a document: a secure link that opens a read-only page for the client. Nothing is sent from here;
 * every option opens the chosen app (or the system share sheet) so the person reviews the message first.
 */
export function ShareDialog({ doc, onClose, onEmail }: { doc: Doc; onClose: () => void; onEmail: () => void }) {
  const [link, setLink] = useState<ShareLink | null>(null);
  const [error, setError] = useState('');
  const { toast, confirm } = useUi();

  useEffect(() => {
    api
      .post<{ link: ShareLink }>(`/api/documents/${doc.id}/share`)
      .then(r => setLink(r.link))
      .catch(e => setError(errorText(e, 'Could not create the link.')));
  }, [doc.id]);

  const label = doc.kind === 'invoice' ? 'Invoice' : 'Quote';
  const headline = `${label} ${doc.fullNumber} from ${doc.issuer.name}`;
  const amount = formatMoney(doc.totals.totalCents, doc.currency);
  const message = (url: string) => `${headline} (${amount}): ${url}`;
  const canShare = typeof navigator.share === 'function';
  const phone = doc.customer.phone.replace(/[^\d]/g, '');

  async function copy() {
    if (link && (await copyText(link.url))) toast('Link copied');
  }

  async function nativeShare() {
    if (!link) return;
    try {
      await navigator.share({ title: headline, text: `${headline} (${amount})`, url: link.url });
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError('The share menu could not be opened. Copy the link instead.');
    }
  }

  async function revoke() {
    const ok = await confirm({
      title: 'Turn off this link?',
      body: 'Anyone who has it will no longer be able to open the document. You can create a new link later.',
      confirm: 'Turn off link',
      danger: true
    });
    if (!ok) return;
    try {
      await api.del(`/api/documents/${doc.id}/share`);
      toast('Link turned off');
      onClose();
    } catch (e) {
      setError(errorText(e));
    }
  }

  return (
    <Modal title={`Share ${label.toLowerCase()} ${doc.fullNumber}`} onClose={onClose}>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!link && !error && <p className="muted">Creating a secure link…</p>}
      {link && (
        <>
          <p className="muted">
            Your client opens this link to view the {label.toLowerCase()}, print it or save it as a PDF
            {doc.kind === 'quote' ? ', and accept or decline it' : ''}. They need no account.
          </p>
          <div className="copy-row">
            <input readOnly value={link.url} aria-label="Secure link" onFocus={e => e.target.select()} />
            <button type="button" className="primary" onClick={copy}>
              <Icon name="copy" /> Copy link
            </button>
          </div>
          <p className="muted small">
            {link.views === 0
              ? 'Not opened yet.'
              : `Opened ${link.views} time${link.views === 1 ? '' : 's'}, last on ${fmtTime(link.lastViewedAt)}.`}
          </p>
          <div className="share-grid">
            {canShare && (
              <button type="button" onClick={nativeShare}>
                <Icon name="share" /> Share…
              </button>
            )}
            <a
              href={`https://wa.me/${phone.length >= 8 ? phone : ''}?text=${encodeURIComponent(message(link.url))}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="link" /> WhatsApp
            </a>
            <a
              href={`mailto:${encodeURIComponent(doc.customer.email)}?subject=${encodeURIComponent(headline)}&body=${encodeURIComponent(
                `Hello ${doc.customer.name},\n\n${label} ${doc.fullNumber} (${amount}) is ready:\n${link.url}\n\n${doc.issuer.name}`
              )}`}
            >
              <Icon name="mail" /> Email app
            </a>
            <button type="button" onClick={onEmail}>
              <Icon name="mail" /> Send from Mavri
            </button>
            <button type="button" onClick={() => window.print()}>
              <Icon name="download" /> Save as PDF
            </button>
          </div>
          <p className="muted small">
            Nothing is sent automatically: WhatsApp and your email app open with the message ready for you to check and
            send. “Save as PDF” uses your browser’s print dialog.
          </p>
          <div className="row end">
            <button type="button" className="danger" onClick={revoke}>
              Turn off link
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
