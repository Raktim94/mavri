import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { SignIn } from './components/SignIn';
import { ResourcePage } from './pages/ResourcePage';
import { resources } from './resources';

function Shell() {
  const { user, signOut } = useAuth();
  return (
    <div className="shell">
      <nav>
        <div className="brand">
          <img src="/mavri-logo.png" alt="" width={28} height={28} /> Mavri
        </div>
        {resources.map(r => (
          <NavLink key={r.path} to={`/${r.path}`}>
            {r.title}
          </NavLink>
        ))}
        <div className="grow" />
        <small className="muted">{user?.email}</small>
        <button onClick={signOut}>Log out</button>
      </nav>
      <main>
        <Routes>
          {resources.map(r => (
            <Route key={r.path} path={`/${r.path}`} element={<ResourcePage res={r} />} />
          ))}
          <Route path="*" element={<Navigate to={`/${resources[0].path}`} replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  const { state } = useAuth();
  if (state === 'loading') return <p className="center muted">Loading…</p>;
  if (state !== 'ready') return <SignIn />;
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
