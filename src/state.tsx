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
    if (parsed.version === 4) return parsed;
    if (parsed.version === 2 || parsed.version === 3) {
      const upgraded = createDemoState();
      return {
        ...upgraded,
        ...parsed,
        version: 4,
        community: {
          ...parsed.community,
          role: parsed.community.role ?? 'admin' as const,
          memberCount: Math.max(parsed.community.memberCount ?? 0, upgraded.community.memberCount),
        },
        books: [
          ...parsed.books,
          ...upgraded.books.filter((book) => !parsed.books.some((existing) => existing.id === book.id)),
        ],
        loans: [
          ...parsed.loans,
          ...upgraded.loans.filter((loan) => !parsed.loans.some((existing) => existing.id === loan.id)),
        ],
        circleInvitations: parsed.circleInvitations ?? upgraded.circleInvitations,
        circleMembers: [
          ...(parsed.circleMembers ?? []),
          ...upgraded.circleMembers.filter((member) => !(parsed.circleMembers ?? []).some((existing) => existing.id === member.id)),
        ],
        circleJoinRequests: parsed.circleJoinRequests ?? upgraded.circleJoinRequests,
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
