import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, HashRouter } from 'react-router-dom';
import { App } from './app/App';
import './globalErrorHandlers';
import './i18n';
import reportWebVitals from './reportWebVitals';
import { isWebMode } from './shared/api/restApi';
import { GlobalErrorBoundaryWrapper } from './shared/components/feedback/globalErrorBoundaryWrapper/GlobalErrorBoundaryWrapper';
import { ThemeProviderWrapper } from './shared/components/layout/theme/ThemeProviderWrapper';
import { store } from './state/configureStore';

const mockEnabled = import.meta.env.VITE_ENABLE_MOCKS;

const Router = isWebMode() ? BrowserRouter : HashRouter;

const startApp = async () => {
  if (mockEnabled === 'true' || mockEnabled === true) {
    try {
      const { worker } = await import('./mocks/browser');
      await worker.start();
    } catch (err) {
      console.error('Failed to load mocks:', err);
    }
  }

  const root = createRoot(document.getElementById('root') as HTMLElement);
  root.render(
    <StrictMode>
      <Provider store={store}>
        <GlobalErrorBoundaryWrapper>
          <Router>
            <ThemeProviderWrapper>
              <App />
            </ThemeProviderWrapper>
          </Router>
        </GlobalErrorBoundaryWrapper>
      </Provider>
    </StrictMode>
  );

  reportWebVitals();
};

startApp();
