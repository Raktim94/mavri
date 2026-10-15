import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, errorText } from '../api';
import type { Bank, Currency, Party } from '../types';
import { LogoPicker } from './LogoPicker';

export const ONBOARDING_KEY = 'mavri.onboarding';

const currencies = [
  { code: 'USD', symbol: '$', name: 'US dollar', pattern: '{symbol}{amount}' },
  { code: 'EUR', symbol: '€', name: 'Euro', pattern: '{amount} {symbol}' },
  { code: 'GBP', symbol: '£', name: 'Pound sterling', pattern: '{symbol}{amount}' },
  { code: 'INR', symbol: '₹', name: 'Indian rupee', pattern: '{symbol}{amount}' },
  { code: 'AUD', symbol: 'A$', name: 'Australian dollar', pattern: '{symbol}{amount}' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian dollar', pattern: '{symbol}{amount}' },
  { code: 'AED', symbol: 'AED', name: 'UAE dirham', pattern: '{symbol} {amount}' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore dollar', pattern: '{symbol}{amount}' },
  { code: 'JPY', symbol: '¥', name: 'Japanese yen', pattern: '{symbol}{amount}', decimals: 0 }
];

const steps = ['Your business', 'Currency and payment', 'First customer'];

export function markOnboardingDone() {
  try {
    localStorage.setItem(ONBOARDING_KEY, 'done');
  } catch {
    // private mode: the wizard may show again, which is harmless
  }
}

export function Onboarding({ onClose }: { onClose: () => void }) {
  const nav = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ids = useRef<{ issuer?: number; currency?: number; bank?: number; customer?: number }>({});

  const [biz, setBiz] = useState({ name: '', email: '', phone: '', address: '', taxId: '', logo: '', logoType: '' });
  const [code, setCode] = useState('USD');
  const [bank, setBank] = useState({ bankName: '', holder: '', accountNumber: '', swift: '' });
  const [cust, setCust] = useState({ name: '', email: '' });

  const [existing, setExisting] = useState<string[]>([]);
  useEffect(() => {
    api
      .get<Currency[]>('/api/currencies')
      .then(rows => setExisting(rows.map(r => r.code)))
      .catch(() => undefined);
  }, []);

  const hasBank = Object.values(bank).some(v => v.trim());
  const upsert = async <T extends { id: number }>(path: string, key: keyof typeof ids.current, body: object) => {
    const id = ids.current[key];
    const saved = id ? await api.put<T>(`${path}/${id}`, { ...body, id }) : await api.post<T>(path, body);
    ids.current[key] = saved.id;
  };

  async function next(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (step === 0) {
        await upsert<Party>('/api/parties', 'issuer', { kind: 'issuer', ...biz });
      } else if (step === 1) {
        const c = currencies.find(x => x.code === code)!;
        // Fresh installs already ship common currencies; only add a missing one.
        if (!existing.includes(c.code)) await upsert<Currency>('/api/currencies', 'currency', { decimals: 2, ...c });
        if (hasBank) {
          await upsert<Bank>('/api/banks', 'bank', { label: bank.bankName.trim() || 'Main account', ...bank });
        }
      } else if (cust.name.trim()) {
        await upsert<Party>('/api/parties', 'customer', { kind: 'customer', ...cust });
      }
      if (step < 2) setStep(step + 1);
      else {
        setStep(3);
        markOnboardingDone();
      }
    } catch (err) {
      setError(errorText(err, 'Could not save. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  function skipAll() {
    markOnboardingDone();
    onClose();
  }

  if (step === 3) {
    return (
      <div className="wizard">
        <div className="wizard-card done">
          <div className="tick" aria-hidden="true">
            ✓
          </div>
          <h1>You are all set</h1>
          <p className="muted">
            {biz.name} is ready. Your first invoice takes about a minute, and you can change anything later in Settings
            and Businesses.
          </p>
          <button
            className="primary big-btn"
            onClick={() => {
              onClose();
              nav('/invoices/new');
            }}
          >
            Create your first invoice
          </button>
          <button onClick={onClose}>Go to the dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard">
      <form className="wizard-card" onSubmit={next} key={step}>
        <p className="eyebrow">Step 2 of 2 · Set up Mavri</p>
        <ol className="stepper">
          {steps.map((s, i) => (
            <li key={s} className={i === step ? 'now' : i < step ? 'past' : ''}>
              <span>{i < step ? '✓' : i + 1}</span> {s}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <>
            <h1>Tell us about your business</h1>
            <p className="muted">This appears at the top of every invoice and quote.</p>
            <LogoPicker
              logo={biz.logo}
              logoType={biz.logoType}
              onChange={(logo, logoType) => setBiz(b => ({ ...b, logo, logoType }))}
            />
            <label>
              Business name
              <input value={biz.name} onChange={e => setBiz({ ...biz, name: e.target.value })} autoFocus required />
            </label>
            <div className="two">
              <label>
                Email
                <input type="email" value={biz.email} onChange={e => setBiz({ ...biz, email: e.target.value })} />
              </label>
              <label>
                Phone
                <input value={biz.phone} onChange={e => setBiz({ ...biz, phone: e.target.value })} />
              </label>
            </div>
            <label>
              Address
              <textarea
                rows={3}
                placeholder="Street, then postcode and city"
                value={biz.address}
                onChange={e => setBiz({ ...biz, address: e.target.value })}
              />
            </label>
            <label>
              <span>
                Tax ID <span className="muted">(optional, e.g. GSTIN or VAT number)</span>
              </span>
              <input value={biz.taxId} onChange={e => setBiz({ ...biz, taxId: e.target.value })} />
            </label>
          </>
        )}

        {step === 1 && (
          <>
            <h1>Currency and how you get paid</h1>
            <p className="muted">
              Pick the currency you invoice in. Bank details are optional and print on the invoice.
            </p>
            <label>
              Currency
              <select value={code} onChange={e => setCode(e.target.value)}>
                {currencies.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.code} · {c.name} ({c.symbol})
                  </option>
                ))}
              </select>
            </label>
            <p className="muted small">Need another currency? Add it later under Currencies.</p>
            <div className="two">
              <label>
                Bank name
                <input value={bank.bankName} onChange={e => setBank({ ...bank, bankName: e.target.value })} />
              </label>
              <label>
                Account holder
                <input value={bank.holder} onChange={e => setBank({ ...bank, holder: e.target.value })} />
              </label>
              <label>
                Account number or IBAN
                <input value={bank.accountNumber} onChange={e => setBank({ ...bank, accountNumber: e.target.value })} />
              </label>
              <label>
                SWIFT / BIC
                <input value={bank.swift} onChange={e => setBank({ ...bank, swift: e.target.value })} />
              </label>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1>Add your first customer</h1>
            <p className="muted">Optional. You can also add customers while writing an invoice.</p>
            <label>
              Customer name
              <input value={cust.name} onChange={e => setCust({ ...cust, name: e.target.value })} autoFocus />
            </label>
            <label>
              Customer email
              <input type="email" value={cust.email} onChange={e => setCust({ ...cust, email: e.target.value })} />
            </label>
          </>
        )}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="wizard-actions">
          {step > 0 ? (
            <button type="button" onClick={() => setStep(step - 1)} disabled={busy}>
              Back
            </button>
          ) : (
            <button type="button" className="link" onClick={skipAll}>
              Skip setup
            </button>
          )}
          <span className="grow" />
          {step > 0 && (
            <button
              type="button"
              className="link"
              onClick={() => {
                if (step === 2) {
                  setStep(3);
                  markOnboardingDone();
                } else setStep(step + 1);
              }}
              disabled={busy}
            >
              Skip this step
            </button>
          )}
          <button className="primary" disabled={busy}>
            {busy ? 'Saving…' : step === 2 ? (cust.name.trim() ? 'Save and finish' : 'Finish') : 'Continue'}
          </button>
        </div>
      </form>
    </div>
  );
}
