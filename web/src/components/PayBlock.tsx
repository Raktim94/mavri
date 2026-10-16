import { formatMoney } from '../money';
import type { Currency, PaymentOption } from '../types';
import { QrCode } from './QrCode';

/**
 * How to pay what is owed: a QR code where one exists, always the same details as text. A payment
 * QR code is not the signed e-invoice code some tax authorities require, and scanning it never marks anything paid.
 */
export function PayBlock({
  options,
  currency,
  title = 'How to pay'
}: {
  options: PaymentOption[];
  currency: Currency;
  title?: string;
}) {
  if (options.length === 0) return null;
  return (
    <div className="paper-card payblock">
      <h3>{title}</h3>
      <div className="pay-options">
        {options.map(o => (
          <section key={o.kind} className="pay-option">
            <h4>{o.label}</h4>
            <div className="pay-body">
              {o.payload && (
                <QrCode
                  text={o.payload}
                  label={`${o.label}: payment QR code for ${formatMoney(o.amountCents, currency)}`}
                />
              )}
              <dl>
                {o.lines.map(l => (
                  <div key={l.label}>
                    <dt>{l.label}</dt>
                    <dd>{l.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {o.kind === 'upi' && o.payload && (
              <a className="noprint upi-link" href={o.payload}>
                Open in a UPI app
              </a>
            )}
            <p className="muted pay-note">{o.note}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
