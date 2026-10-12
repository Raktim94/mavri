import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { SignIn } from './components/SignIn';
import { InvoiceEditor } from './pages/InvoiceEditor';
import { InvoicesPage } from './pages/InvoicesPage';
import { InvoiceView } from './pages/InvoiceView';
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
        <NavLink to="/invoices">Invoices</NavLink>
        <NavLink to="/quotes">Quotes</NavLink>
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
          <Route path="/invoices" element={<InvoicesPage kind="invoice" />} />
          <Route path="/invoices/new" element={<InvoiceEditor kind="invoice" />} />
          <Route path="/invoices/:id" element={<InvoiceView kind="invoice" />} />
          <Route path="/invoices/:id/edit" element={<InvoiceEditor kind="invoice" />} />
          <Route path="/quotes" element={<InvoicesPage kind="quotation" />} />
          <Route path="/quotes/new" element={<InvoiceEditor kind="quotation" />} />
          <Route path="/quotes/:id" element={<InvoiceView kind="quotation" />} />
          <Route path="/quotes/:id/edit" element={<InvoiceEditor kind="quotation" />} />
          {resources.map(r => (
            <Route key={r.path} path={`/${r.path}`} element={<ResourcePage res={r} />} />
          ))}
          <Route path="*" element={<Navigate to="/invoices" replace />} />
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
