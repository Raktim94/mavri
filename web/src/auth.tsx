import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError, type User } from './api';

type State = 'loading' | 'setup' | 'login' | 'ready';
type Auth = {
  state: State;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<Auth | null>(null);
export const useAuth = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setUser(await api.get<User>('/api/auth/me'));
        setState('ready');
      } catch (e) {
        if (!(e instanceof ApiError) || e.status !== 401) {
          setState('login');
          return;
        }
        const { needsSetup } = await api.get<{ needsSetup: boolean }>('/api/auth/status');
        setState(needsSetup ? 'setup' : 'login');
      }
    })();
  }, []);

  const enter = useCallback((u: User) => {
    setUser(u);
    setState('ready');
  }, []);

  const value: Auth = {
    state,
    user,
    signIn: async (email, password) => enter(await api.post<User>('/api/auth/login', { email, password })),
    signUp: async (email, password) => enter(await api.post<User>('/api/auth/setup', { email, password })),
    signOut: async () => {
      await api.post('/api/auth/logout');
      setUser(null);
      setState('login');
    }
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
