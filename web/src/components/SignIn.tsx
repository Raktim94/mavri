import { useState, type FormEvent } from 'react';
import { ApiError } from '../api';
import { useAuth } from '../auth';

const messages: Record<string, string> = {
  'error.invalidCredentials': 'Wrong email or password.',
  'error.accountLocked': 'Too many attempts. Try again in a few minutes.',
  'error.weakPassword': 'Use at least 8 characters with letters and numbers.',
  'error.invalidEmail': 'Enter a valid email address.'
};

export function SignIn() {
  const { state, signIn, signUp } = useAuth();
  const setup = state === 'setup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await (setup ? signUp : signIn)(email, password);
    } catch (err) {
      const key = err instanceof ApiError ? err.key : '';
      setError(messages[key] ?? 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="center">
      <form className="card narrow" onSubmit={submit}>
        <img src="/mavri-logo.png" alt="" width={56} height={56} />
        <h1>{setup ? 'Create your account' : 'Sign in to Mavri'}</h1>
        <label>
          Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete={setup ? 'new-password' : 'current-password'}
            required
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {setup ? 'Create account' : 'Sign in'}
        </button>
      </form>
    </main>
  );
}
