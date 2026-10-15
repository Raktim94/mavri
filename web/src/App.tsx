import { useEffect, useState } from 'react';
import { BrowserRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { api } from './api';
import { useAuth } from './auth';
import { Icon } from './components/Icon';
import { Onboarding, ONBOARDING_KEY } from './components/Onboarding';
import { UpdateButton } from './components/Updates';
import { SignIn } from './components/SignIn';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentEditor } from './pages/DocumentEditor';
import { DocumentsPage } from './pages/DocumentsPage';
import { DocumentView } from './pages/DocumentView';
import { ReportsPage } from './pages/ReportsPage';
import { ResourcePage } from './pages/ResourcePage';
import { SettingsPage } from './pages/SettingsPage';
import { ShopsPage } from './pages/ShopsPage';
import { resources } from './resources';
import { defaultSettings, SettingsContext } from './settings';
import type { Party, Settings } from './types';

function Shell() {
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  useEffect(() => {
    api
      .get<Settings>('/api/settings')
      .then(setSettings)
      .catch(() => undefined);
  }, []);
  const [onboarding, setOnboarding] = useState(false);
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(ONBOARDING_KEY) === 'done';
    } catch {
      // storage blocked: fall through and decide from the data
    }
    if (dismissed) return;
    api
      .get<Party[]>('/api/parties?kind=issuer')
      .then(rows => setOnboarding(rows.length === 0))
      .catch(() => undefined);
  }, []);
  const pages = resources.filter(r => !r.feature || settings.features[r.feature]);
  const { features } = settings;
  const { pathname } = useLocation();
  useEffect(() => setMenu(false), [pathname]);

  return (
    <SettingsContext.Provider value={settings}>
      <div className="shell">
        <header className="topbar">
          <button aria-label="Menu" aria-expanded={menu} onClick={() => setMenu(m => !m)}>
            <Icon name={menu ? 'close' : 'menu'} />
          </button>
          <img src="/mavri-logo.png" alt="" width={24} height={24} /> Mavri
        </header>
        <nav className={menu ? 'open' : undefined}>
          <div className="brand">
            <img src="/mavri-logo.png" alt="" width={28} height={28} /> Mavri
          </div>
          <p className="nav-label">Workspace</p>
          <NavLink to="/dashboard">
            <Icon name="dashboard" /> Dashboard
          </NavLink>
          <NavLink to="/invoices">
            <Icon name="invoices" /> Invoices
          </NavLink>
          {features.quotes && (
            <NavLink to="/quotes">
              <Icon name="quotes" /> Quotes
            </NavLink>
          )}
          {features.reports && (
            <NavLink to="/reports">
              <Icon name="reports" /> Reports
            </NavLink>
          )}
          <NavLink to="/stores">
            <Icon name="stores" /> Stores
          </NavLink>
          <p className="nav-label">Records</p>
          {pages.map(r => (
            <NavLink key={r.id} to={`/${r.id}`}>
              <Icon name={r.id} /> {r.title}
            </NavLink>
          ))}
          <p className="nav-label">System</p>
          <NavLink to="/settings">
            <Icon name="settings" /> Settings
          </NavLink>
          <div className="grow" />
          <UpdateButton />
          <small className="muted">{user?.email}</small>
          <button className="logout" onClick={signOut}>
            <Icon name="logout" /> Log out
          </button>
        </nav>
        {onboarding && <Onboarding onClose={() => setOnboarding(false)} />}
        <main>
          <div className="page" key={pathname.split('/').slice(0, 3).join('/')}>
            <Routes>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/invoices" element={<DocumentsPage kind="invoice" />} />
              <Route path="/invoices/new" element={<DocumentEditor kind="invoice" />} />
              <Route path="/invoices/:id" element={<DocumentView kind="invoice" />} />
              <Route path="/invoices/:id/edit" element={<DocumentEditor kind="invoice" />} />
              <Route path="/quotes" element={<DocumentsPage kind="quote" />} />
              <Route path="/quotes/new" element={<DocumentEditor kind="quote" />} />
              <Route path="/quotes/:id" element={<DocumentView kind="quote" />} />
              <Route path="/quotes/:id/edit" element={<DocumentEditor kind="quote" />} />
              {pages.map(r => (
                <Route key={r.id} path={`/${r.id}`} element={<ResourcePage res={r} />} />
              ))}
              <Route path="/reports" element={<ReportsPage />} />
              <Route path="/stores" element={<ShopsPage />} />
              <Route path="/settings" element={<SettingsPage onSaved={setSettings} />} />
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </div>
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
