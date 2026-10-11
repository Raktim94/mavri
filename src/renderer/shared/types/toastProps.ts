export interface ToastProps {
  message: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  variant?: 'filled' | 'outlined' | 'standard';
  vertical?: 'top' | 'bottom';
  horizontal?: 'left' | 'center' | 'right';
  autoHideDuration?: number;
  onClose?: () => void;
  offset?: number;
}
