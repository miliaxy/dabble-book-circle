import {
  createContext,
  type Dispatch,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react';
import { createDemoState } from './data';
import { appReducer } from './domain';
import type { AppAction, AppState } from './types';

const STORAGE_KEY = 'dabble-book-circle-preview-v1';

interface AppContextValue {
  state: AppState;
  dispatch: Dispatch<AppAction>;
  resetDemo: () => void;
}

const AppContext = createContext<AppContextValue | null>(null);

function readInitialState() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return createDemoState();
    const parsed = JSON.parse(stored) as AppState;
    if (parsed.version === 3) return parsed;
    if (parsed.version === 2) {
      const upgraded = createDemoState();
      return {
        ...upgraded,
        ...parsed,
        version: 3,
        community: { ...parsed.community, role: 'admin' as const },
        circleInvitations: upgraded.circleInvitations,
        circleMembers: upgraded.circleMembers,
        circleJoinRequests: upgraded.circleJoinRequests,
      };
    }
    return createDemoState();
  } catch {
    return createDemoState();
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, readInitialState);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const value = useMemo(
    () => ({
      state,
      dispatch,
      resetDemo: () => dispatch({ type: 'RESET_DEMO', state: createDemoState() }),
    }),
    [state],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used inside AppProvider');
  return context;
}

export function newId(prefix: string) {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `${prefix}-${random}`;
}
