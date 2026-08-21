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
import { pushDiff, subscribeOrg } from './sync';
import type { Action } from './actions';
import type { RunwayState, User } from './types';

/** Two ways to hold a board, behind one identical interface.
 *
 *  **An organisation** (`slug` given) lives in Firestore: live listeners bring other people's
 *  edits in, and every dispatch writes back the documents that actually changed. Reads still
 *  land instantly because the reducer applies the change locally first — Firestore confirms
 *  it a moment later (§3's "never a full-screen loading state").
 *
 *  **The demo** (no slug) stays entirely in this browser, so the public demo link needs no
 *  account, writes nothing to anyone's data, and still exercises every screen. */

interface StoreValue {
  state: RunwayState;
  dispatch: (action: Action) => void;
  me: User;
  online: boolean;
  /** Writes in flight. The user is told, never blocked. §7 */
  pending: number;
  /** False only while an organisation's first snapshot is still arriving. */
  ready: boolean;
  /** True for a real, shared organisation; false for the local demo. Anything that rewrites
   *  the whole board wholesale is demo-only — doing it to an org would wipe shared work. */
  isOrg: boolean;
}

/** Only the collections that live in Firestore. Session, queue and fired reminders are
 *  per-device by design and never leave this browser. */
const pick = (s: RunwayState) => ({
  users: s.users,
  sections: s.sections,
  folders: s.folders,
  tasks: s.tasks,
  notes: s.notes,
  notifications: s.notifications,
});

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({
  children,
  ownerName,
  org,
  onError,
}: {
  children: ReactNode;
  /** The signed-in account's name, used only when seeding a brand-new local board. */
  ownerName?: string;
  /** Set for a real organisation. Omitted by the demo, which stays local. */
  org?: { slug: string; uid: string };
  onError?: (message: string) => void;
}) {
  const [state, dispatch] = useReducer(reducer, ownerName, loadState);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pendingWrites, setPendingWrites] = useState(0);
  const [ready, setReady] = useState(!org);
  const drainRef = useRef<number | undefined>(undefined);

  /** What Firestore last told us, and what we last sent it. Diffing against these is what
   *  stops a listener echo being mistaken for a local edit and written straight back. */
  const remote = useRef<RunwayState | null>(null);
  const pushing = useRef(false);

  // The demo keeps its board in this browser. An organisation never touches localStorage.
  useEffect(() => {
    if (!org) saveState(state);
  }, [state, org]);

  // Live reads.
  useEffect(() => {
    if (!org) return;
    return subscribeOrg(
      org.slug,
      org.uid,
      ({ collections, ready: whole }) => {
        dispatch({ type: 'sync/replace', collections, currentUserId: org.uid });
        remote.current = null; // recomputed below, once the reducer has applied it
        if (whole) setReady(true);
      },
      (message) => onError?.(message),
    );
  }, [org?.slug, org?.uid, onError]);

  // Writes. Anything the reducer changed that Firestore has not seen goes up.
  useEffect(() => {
    if (!org || !ready || pushing.current) return;
    const snapshot = remote.current;
    remote.current = state;
    if (!snapshot) return;

    const changed =
      JSON.stringify(pick(snapshot)) !== JSON.stringify(pick(state));
    if (!changed) return;

    pushing.current = true;
    setPendingWrites((n) => n + 1);
    void pushDiff(org.slug, pick(snapshot), pick(state))
      .catch(() => onError?.('That change could not be saved.'))
      .finally(() => {
        pushing.current = false;
        setPendingWrites((n) => Math.max(0, n - 1));
      });
  }, [state, org, ready, onError]);

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

  // Until the first snapshot lands there may be no member document yet.
  const me = state.users[state.session.currentUserId];

  const value = useMemo<StoreValue>(
    () => ({
      state,
      dispatch,
      me,
      online,
      pending: org ? pendingWrites : state.queue.length,
      ready,
      isOrg: Boolean(org),
    }),
    [state, me, online, org, pendingWrites, ready],
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
