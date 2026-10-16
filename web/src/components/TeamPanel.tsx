import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorText } from '../api';
import { useAuth } from '../auth';
import { useUi } from './ui';

interface Member {
  id: number;
  email: string;
  role: 'owner' | 'staff' | 'viewer';
  lastLoginAt: string;
}

const ROLES: Array<[Member['role'], string, string]> = [
  ['owner', 'Owner', 'Everything, including settings, payments, backups, API keys and people'],
  ['staff', 'Staff', 'Invoices, quotes and records; not settings, payments, backups, keys or people'],
  ['viewer', 'Viewer', 'Can look at everything they are shown and change nothing']
];

/** Who can sign in, and what each person may do. */
export function TeamPanel() {
  const { user } = useAuth();
  const { toast, confirm } = useUi();
  const [rows, setRows] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Member['role']>('staff');
  const [error, setError] = useState('');

  const load = useCallback(() => {
    api
      .get<Member[]>('/api/users')
      .then(setRows)
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/api/users', { email, password, role });
      setEmail('');
      setPassword('');
      toast('Person added. Tell them the password; they can change it after signing in.');
      load();
    } catch (err) {
      setError(errorText(err, 'Could not add this person.'));
    }
  }

  async function change(m: Member, patch: { role?: string; password?: string }) {
    try {
      await api.put(`/api/users/${m.id}`, patch);
      toast(patch.password ? 'Password reset; they are signed out everywhere' : 'Role changed');
      load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function remove(m: Member) {
    if (
      !(await confirm({
        title: `Remove ${m.email}?`,
        body: 'They can no longer sign in.',
        confirm: 'Remove',
        danger: true
      }))
    )
      return;
    try {
      await api.del(`/api/users/${m.id}`);
      load();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <div className="card">
      <h2>People</h2>
      <p className="muted">
        {ROLES.map(([, name, text]) => (
          <span key={name}>
            <strong>{name}</strong>: {text}.{' '}
          </span>
        ))}
      </p>
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Role</th>
            <th>Last sign-in</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(m => (
            <tr key={m.id}>
              <td>
                {m.email}
                {m.id === user?.id && <small className="muted"> (you)</small>}
              </td>
              <td>
                <select
                  value={m.role}
                  aria-label={`Role of ${m.email}`}
                  onChange={e => change(m, { role: e.target.value })}
                  disabled={m.id === user?.id}
                >
                  {ROLES.map(([v, name]) => (
                    <option key={v} value={v}>
                      {name}
                    </option>
                  ))}
                </select>
              </td>
              <td>{m.lastLoginAt ? m.lastLoginAt.slice(0, 10) : 'never'}</td>
              <td className="row">
                <button
                  type="button"
                  onClick={() => {
                    const p = window.prompt(`New password for ${m.email} (8 or more characters, letters and numbers)`);
                    if (p) void change(m, { password: p });
                  }}
                >
                  Reset password
                </button>
                {m.id !== user?.id && (
                  <button type="button" className="danger" onClick={() => remove(m)}>
                    Remove
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <form className="row" onSubmit={add}>
        <label className="grow">
          Email
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </label>
        <label>
          First password
          <input
            type="text"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
            autoComplete="off"
          />
        </label>
        <label>
          Role
          <select value={role} onChange={e => setRole(e.target.value as Member['role'])}>
            {ROLES.map(([v, name]) => (
              <option key={v} value={v}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary">Add person</button>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

/** A person changes their own password. */
export function PasswordForm() {
  const { toast } = useUi();
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function save(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/api/session/password', { current, password });
      setCurrent('');
      setPassword('');
      toast('Password changed. Your other sessions were signed out.');
    } catch (err) {
      setError(errorText(err, 'Could not change the password.'));
    }
  }
  return (
    <form className="card" onSubmit={save}>
      <h2>Your password</h2>
      <div className="row">
        <label>
          Current password
          <input
            type="password"
            value={current}
            onChange={e => setCurrent(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="new-password"
            required
            minLength={8}
          />
        </label>
        <button className="primary">Change password</button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
