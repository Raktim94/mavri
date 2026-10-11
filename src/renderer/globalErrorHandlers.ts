import { store } from './state/configureStore';
import { addToast } from './state/pageSlice';

const pushErrorToast = (message: string) => {
  store.dispatch(addToast({ message, severity: 'error' }));
};

window.addEventListener('unhandledrejection', event => {
  pushErrorToast(String(event.reason));
});

window.addEventListener('error', event => {
  pushErrorToast(event.error?.message || event.message);
});
