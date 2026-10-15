import { useState } from 'react';

// Mirrors the server rule (auth.StrongEnough): 8+ characters, a letter and a digit.
export const passwordRules = (pw: string) => [
  { label: 'At least 8 characters', ok: pw.length >= 8 },
  { label: 'A letter', ok: /\p{L}/u.test(pw) },
  { label: 'A number', ok: /\p{N}/u.test(pw) }
];

function strength(pw: string): { level: number; label: string } {
  if (!pw) return { level: 0, label: '' };
  const met = passwordRules(pw).filter(r => r.ok).length;
  if (met < 3) return { level: 1, label: 'Too weak' };
  const extra =
    Number(pw.length >= 12) + Number(/[^\p{L}\p{N}]/u.test(pw)) + Number(/\p{Lu}/u.test(pw) && /\p{Ll}/u.test(pw));
  return extra >= 2
    ? { level: 4, label: 'Strong' }
    : extra === 1
      ? { level: 3, label: 'Good' }
      : { level: 2, label: 'Okay' };
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  mode: 'new' | 'current';
  showRules?: boolean;
}

export function PasswordField({ value, onChange, mode, showRules }: Props) {
  const [shown, setShown] = useState(false);
  const s = strength(value);
  return (
    <div className="pw">
      <label>
        Password
        <span className="pw-input">
          <input
            type={shown ? 'text' : 'password'}
            value={value}
            onChange={e => onChange(e.target.value)}
            autoComplete={mode === 'new' ? 'new-password' : 'current-password'}
            required
          />
          <button type="button" className="pw-toggle" onClick={() => setShown(v => !v)} aria-pressed={shown}>
            {shown ? 'Hide' : 'Show'}
          </button>
        </span>
      </label>
      {showRules && (
        <>
          <div className={`meter l${s.level}`} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </div>
          <ul className="rules" aria-live="polite">
            {passwordRules(value).map(r => (
              <li key={r.label} className={r.ok ? 'ok' : ''}>
                {r.ok ? '✓' : '○'} {r.label}
              </li>
            ))}
            {s.label && <li className="strength">{s.label}</li>}
          </ul>
        </>
      )}
    </div>
  );
}
