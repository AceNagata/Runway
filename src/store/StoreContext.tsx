import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { reducer } from './reducer';
import { loadState, saveState } from './persist';
import type { Action } from './actions';
import type { RunwayState, User } from './types';

/** The sync layer is deliberately thin and swappable. v1 has no backend (see
 *  decisions.md Q8): writes land in local state immediately, queue, and drain against a
 *  local adapter. A real API implements the same drain and nothing above here changes. */

interface StoreValue {
  state: RunwayState;
  dispatch: (action: Action) => void;
  me: User;
  online: boolean;
  /** Writes waiting to replay. The user is told, never blocked. §7 */
  pending: number;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({
  children,
  ownerName,
}: {
  children: ReactNode;
  /** The signed-in account's name, used only when seeding a brand-new empty board. */
  ownerName?: string;
}) {
  const [state, dispatch] = useReducer(reducer, ownerName, loadState);
  const [online, setOnline] = useState(() => navigator.onLine);
  const drainRef = useRef<number | undefined>(undefined);

  useEffect(() => saveState(state), [state]);

  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);

  // Drain the write queue in the background whenever there is something to replay.
  useEffect(() => {
    if (!online || state.queue.length === 0) return;
    if (drainRef.current) clearTimeout(drainRef.current);
    drainRef.current = window.setTimeout(() => dispatch({ type: 'queue/flush' }), 900);
    return () => {
      if (drainRef.current) clearTimeout(drainRef.current);
    };
  }, [online, state.queue.length]);

  const me = state.users[state.session.currentUserId];

  const value = useMemo<StoreValue>(
    () => ({ state, dispatch, me, online, pending: state.queue.length }),
    [state, me, online],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export function useDispatch(): (action: Action) => void {
  return useStore().dispatch;
}

/** A clock that ticks only as often as the UI needs, so the live timer and the
 *  derived "overdue" status stay honest without re-rendering the tree every frame. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Debounced autosave — the note is never in an unsaved state the user has to think
 *  about, and never issues a write per keystroke. §2.1 */
export function useDebouncedCallback<A extends unknown[]>(
  fn: (...args: A) => void,
  delay: number,
): (...args: A) => void {
  const timer = useRef<number | undefined>(undefined);
  const latest = useRef(fn);
  latest.current = fn;
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  return useCallback(
    (...args: A) => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = window.setTimeout(() => latest.current(...args), delay);
    },
    [delay],
  );
}
