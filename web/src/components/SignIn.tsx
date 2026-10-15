import { useState, type FormEvent } from 'react';
import { ApiError } from '../api';
import { useAuth } from '../auth';
import { PasswordField, passwordRules } from './PasswordField';

const perks = [
  'Invoices and quotes with your logo and colours',
  'Track payments and see what is still owed',
  'Your data stays on your own server'
];

export function SignIn() {
  const { state, signIn, signUp } = useAuth();
  const setup = state === 'setup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = !setup || passwordRules(password).every(r => r.ok);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError('');
    try {
      await (setup ? signUp : signIn)(email.trim(), password);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not reach the server. Check your connection and try again.'
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth">
      <aside className="auth-brand">
        <div className="auth-logo">
          <img src="/mavri-logo.png" alt="" width={40} height={40} /> Mavri
        </div>
        <h2>{setup ? 'Get paid faster, with less admin.' : 'Welcome back.'}</h2>
        {setup && (
          <ul>
            {perks.map(p => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        )}
      </aside>
      <form className="auth-form" onSubmit={submit}>
        {setup && <p className="eyebrow">Step 1 of 2 · Your account</p>}
        <h1>{setup ? 'Create your account' : 'Sign in to Mavri'}</h1>
        <p className="muted">
          {setup
            ? 'You are the owner of this Mavri. Next, we will set up your business so your first invoice takes a minute.'
            : 'Enter your email and password to continue.'}
        </p>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="username"
            autoFocus
            required
          />
        </label>
        <PasswordField value={password} onChange={setPassword} mode={setup ? 'new' : 'current'} showRules={setup} />
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary big-btn" disabled={busy || !ready}>
          {busy ? 'Please wait…' : setup ? 'Create account and continue' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
