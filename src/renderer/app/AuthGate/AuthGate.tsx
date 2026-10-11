import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
import { useCallback, useEffect, useState, type FC, type FormEvent, type PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { getAuthMe, getAuthStatus, postAuthLogin, postAuthSetup } from '../../shared/api/platformApi';
import { isWebMode } from '../../shared/api/restApi';

type GateState = 'checking' | 'needsSetup' | 'needsLogin' | 'authenticated';

// Web mode (the REST API) requires a session once an owner account exists —
// Electron talks to the database over IPC directly and never hits this.
// This gate is intentionally minimal: it unblocks the web UI rather than
// leaving it unusable behind the new auth requirement, but a fuller
// account/login screen matching the rest of the design system is a good
// follow-up.
export const AuthGate: FC<PropsWithChildren> = ({ children }) => {
  const { t } = useTranslation();
  const [state, setState] = useState<GateState>(isWebMode() ? 'checking' : 'authenticated');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const check = useCallback(async () => {
    if (!isWebMode()) {
      setState('authenticated');
      return;
    }
    const me = await getAuthMe();
    if (me.success) {
      setState('authenticated');
      return;
    }
    const status = await getAuthStatus();
    setState(status.success && status.data?.needsSetup ? 'needsSetup' : 'needsLogin');
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const result =
          state === 'needsSetup' ? await postAuthSetup(email, password) : await postAuthLogin(email, password);
        if (result.success) {
          setState('authenticated');
          return;
        }
        setError(
          result.key ? t(result.key, result.key) : (result.message ?? t('auth.genericError', 'Something went wrong.'))
        );
      } finally {
        setSubmitting(false);
      }
    },
    [email, password, state, t]
  );

  if (state === 'authenticated') return <>{children}</>;
  if (state === 'checking') return null;

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2
      }}
    >
      <Paper sx={{ padding: 4, width: '100%', maxWidth: 400 }} component="form" onSubmit={handleSubmit}>
        <Typography variant="h6" gutterBottom>
          {state === 'needsSetup'
            ? t('auth.createOwnerAccount', 'Create the owner account')
            : t('auth.login', 'Log in')}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {state === 'needsSetup'
            ? t(
                'auth.createOwnerAccountDesc',
                'This is a one-time setup — this account will have full access to this database.'
              )
            : t('auth.loginDesc', 'Sign in to continue.')}
        </Typography>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          label={t('auth.email', 'Email')}
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          fullWidth
          required
          autoFocus
          sx={{ mb: 2 }}
        />
        <TextField
          label={t('auth.password', 'Password')}
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          fullWidth
          required
          helperText={
            state === 'needsSetup'
              ? t('auth.passwordRequirements', 'At least 10 characters, with upper, lower and a number.')
              : undefined
          }
          sx={{ mb: 3 }}
        />
        <Button type="submit" variant="contained" fullWidth disabled={submitting}>
          {state === 'needsSetup' ? t('auth.createAccount', 'Create account') : t('auth.signIn', 'Sign in')}
        </Button>
      </Paper>
    </Box>
  );
};
