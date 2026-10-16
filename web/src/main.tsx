import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { PublicDocument } from './pages/PublicDocument';
import { AuthProvider } from './auth';
import { UiProvider } from './components/ui';
import './styles.css';
import './templates.css';

// A client link (/d/<token>) needs no sign-in, so it skips the account setup and the app shell.
const link = /^\/d\/([\w-]{16,64})\/?$/.exec(location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {link ? (
      <PublicDocument token={link[1]} />
    ) : (
      <AuthProvider>
        <UiProvider>
          <App />
        </UiProvider>
      </AuthProvider>
    )}
  </StrictMode>
);
