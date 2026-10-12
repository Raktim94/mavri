import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { api, type Row } from './api';
import { useAuth } from './auth';
import { SignIn } from './components/SignIn';
import { IntegrationsPage } from './pages/IntegrationsPage';
import { InvoiceEditor } from './pages/InvoiceEditor';
import { InvoicesPage } from './pages/InvoicesPage';
import { InvoiceView } from './pages/InvoiceView';
import { ReportsPage } from './pages/ReportsPage';
import { ResourcePage } from './pages/ResourcePage';
import { SettingsPage } from './pages/SettingsPage';
import { resources } from './resources';
import { featureOn, SettingsContext } from './settings';

// Pages that the Settings page can switch off.
const gate: Record<string, string> = { presets: 'presetsON', styleProfiles: 'styleProfilesON' };

function Shell() {
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState<Row>({});
  useEffect(() => {
    api
      .get<Row>('/api/settings')
      .then(s => s && setSettings(s))
      .catch(() => undefined);
  }, []);
  const on = (key?: string) => !key || featureOn(settings, key);
  const pages = resources.filter(r => on(gate[r.path]));

  return (
    <SettingsContext.Provider value={settings}>
      <div className="shell">
        <nav>
          <div className="brand">
            <img src="/mavri-logo.png" alt="" width={28} height={28} /> Mavri
          </div>
          <NavLink to="/invoices">Invoices</NavLink>
          {on('quotesON') && <NavLink to="/quotes">Quotes</NavLink>}
          {pages.map(r => (
            <NavLink key={r.path} to={`/${r.path}`}>
              {r.title}
            </NavLink>
          ))}
          {on('reportsON') && <NavLink to="/reports">Reports</NavLink>}
          <NavLink to="/integrations">Integrations</NavLink>
          <NavLink to="/settings">Settings</NavLink>
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
            {pages.map(r => (
              <Route key={r.path} path={`/${r.path}`} element={<ResourcePage res={r} />} />
            ))}
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/integrations" element={<IntegrationsPage />} />
            <Route path="/settings" element={<SettingsPage onSaved={setSettings} />} />
            <Route path="*" element={<Navigate to="/invoices" replace />} />
          </Routes>
        </main>
      </div>
    </SettingsContext.Provider>
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
