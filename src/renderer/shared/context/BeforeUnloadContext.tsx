import { createContext, useContext } from 'react';

type BeforeUnloadContextType = {
  attemptNavigation?: (action: () => void) => void;
  setBlocked?: (v: boolean) => void;
};

const emptyContextValue: BeforeUnloadContextType = {};

const BeforeUnloadContext = createContext<BeforeUnloadContextType>(emptyContextValue);

export const BeforeUnloadProvider = BeforeUnloadContext.Provider;

export const useBeforeUnloadContext = () => useContext(BeforeUnloadContext);
