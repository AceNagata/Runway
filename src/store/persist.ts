import { buildFirstRun, buildSeed } from '../data/seed';
import type { RunwayState } from './types';

// v3 added the fired-reminder record. v2 dropped timeEntries when time tracking was removed.
const KEY = 'runway.state.v3';

/** A cache written by an older build is missing whatever collections that build did not have.
 *  Reading it must never crash the app, so every collection is backfilled here rather than
 *  trusted — a version bump alone only helps people who happen to load the new build first. */
function normalise(parsed: Partial<RunwayState>): RunwayState {
  const seed = buildSeed();
  return {
    users: parsed.users ?? seed.users,
    folders: parsed.folders ?? seed.folders,
    tasks: parsed.tasks ?? {},
    notes: parsed.notes ?? {},
    notifications: parsed.notifications ?? {},
    reminders: parsed.reminders ?? {},
    session: parsed.session ?? seed.session,
    queue: parsed.queue ?? [],
  };
}

/** Home renders from cached local state immediately on load and reconciles with the
 *  server in the background — never a full-screen loading state for a returning user. §3 */
export function loadState(): RunwayState {
  // `?demo=1` is checked before the cache, so a demo link works for a returning visitor and
  // not only on a first-ever load. It is the one thing allowed to overwrite existing state,
  // which is why it is an explicit URL flag rather than anything the app does on its own.
  if (new URLSearchParams(location.search).get('demo') === '1') {
    const demo = buildSeed();
    saveState(demo);
    return demo;
  }

  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<RunwayState>;
      if (parsed?.tasks && parsed?.users && parsed?.session) return normalise(parsed);
    }
  } catch {
    // A corrupt cache is not worth a loading screen; fall through to a clean board.
  }

  // Ships empty. The demo org and its tasks are opt-in, so a public build never shows
  // invented work as though it were yours.
  const fresh = buildFirstRun();
  saveState(fresh);
  return fresh;
}

let writeHandle: number | undefined;

export function saveState(state: RunwayState): void {
  if (writeHandle) clearTimeout(writeHandle);
  writeHandle = window.setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked — the in-memory store is still the source of truth.
    }
  }, 120);
}

export function clearState(): void {
  localStorage.removeItem(KEY);
}
