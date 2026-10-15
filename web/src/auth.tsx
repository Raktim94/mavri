import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, ApiError } from './api';
import type { User } from './types';

type State = 'loading' | 'setup' | 'login' | 'ready';
interface Auth {
  state: State;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Auth | null>(null);

export function useAuth(): Auth {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth outside AuthProvider');
  return v;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>('loading');
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setUser(await api.get<User>('/api/session'));
        setState('ready');
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          const { needsSetup } = await api.get<{ needsSetup: boolean }>('/api/setup');
          setState(needsSetup ? 'setup' : 'login');
        } else {
          setState('login');
        }
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
    signIn: async (email, password) => enter(await api.post<User>('/api/session', { email, password })),
    signUp: async (email, password) => enter(await api.post<User>('/api/setup', { email, password })),
    signOut: async () => {
      await api.del('/api/session');
      setUser(null);
      setState('login');
    }
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
