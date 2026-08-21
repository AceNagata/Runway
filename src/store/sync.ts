import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Folder, Note, Notification, RunwayState, Section, Task, User } from './types';

/** Keeps one organisation's board in step with Firestore.
 *
 *  The reducer above this is untouched: it still produces a whole RunwayState, and this layer
 *  works out which documents actually changed and writes only those. That keeps every screen,
 *  action and domain function exactly as it was while the data moves off the device.
 *
 *  Reads come from live listeners, so two people looking at the same org see each other's
 *  edits without refreshing. Conflicts are last-write-wins per document — two people editing
 *  the *same* task within a second of each other, the later write wins. Per document rather
 *  than per board, so ordinary concurrent work does not collide. */

type Entity = { id: string };
type Collections = Pick<
  RunwayState,
  'users' | 'sections' | 'folders' | 'tasks' | 'notes' | 'notifications'
>;

const SYNCED = ['users', 'sections', 'folders', 'tasks', 'notes', 'notifications'] as const;
type SyncedKey = (typeof SYNCED)[number];

/** Firestore has no concept of a member collection called "users". */
const PATH: Record<SyncedKey, string> = {
  users: 'members',
  sections: 'sections',
  folders: 'folders',
  tasks: 'tasks',
  notes: 'notes',
  notifications: 'notifications',
};

/** Firestore rejects undefined. Optional fields simply go missing instead. */
function clean<T extends object>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const byId = <T extends Entity>(docs: T[]): Record<string, T> =>
  Object.fromEntries(docs.map((d) => [d.id, d]));

export interface OrgSnapshot {
  collections: Collections;
  /** True once every collection has reported at least once, so the UI knows the board is
   *  whole rather than half-loaded. */
  ready: boolean;
}

/** Attaches listeners for one org. `uid` scopes the two collections whose security rules
 *  are narrower than "any member": notes you can see, and notifications addressed to you.
 *  Those queries have to match the rules exactly or Firestore rejects the listen. */
export function subscribeOrg(
  slug: string,
  uid: string,
  onChange: (snapshot: OrgSnapshot) => void,
  onError: (message: string) => void,
): () => void {
  const state: Collections = {
    users: {},
    sections: {},
    folders: {},
    tasks: {},
    notes: {},
    notifications: {},
  };
  const seen = new Set<string>();
  // Notes arrive on two listeners; keep them apart so one cannot delete the other's rows.
  const ownNotes: Record<string, Note> = {};
  const sharedNotes: Record<string, Note> = {};

  const emit = () => {
    onChange({
      collections: { ...state, notes: { ...sharedNotes, ...ownNotes } },
      ready: seen.size >= 7,
    });
  };

  const fail = (label: string) => (e: unknown) => {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code: unknown }).code) : '';
    onError(
      code === 'permission-denied'
        ? 'You are not a member of this organisation.'
        : `Lost the connection while loading ${label}.`,
    );
  };

  const plain = <T extends Entity>(key: Exclude<SyncedKey, 'notes' | 'notifications'>) =>
    onSnapshot(
      collection(db, 'orgs', slug, PATH[key]),
      (snap) => {
        (state as unknown as Record<string, Record<string, T>>)[key] = byId(
          snap.docs.map((d) => d.data() as T),
        );
        seen.add(key);
        emit();
      },
      fail(key),
    );

  const unsubs = [
    plain<User>('users'),
    plain<Section>('sections'),
    plain<Folder>('folders'),
    plain<Task>('tasks'),

    onSnapshot(
      query(collection(db, 'orgs', slug, 'notes'), where('ownerId', '==', uid)),
      (snap) => {
        for (const k of Object.keys(ownNotes)) delete ownNotes[k];
        for (const d of snap.docs) ownNotes[d.id] = d.data() as Note;
        seen.add('notes:own');
        emit();
      },
      fail('notes'),
    ),
    onSnapshot(
      query(collection(db, 'orgs', slug, 'notes'), where('shared', '==', true)),
      (snap) => {
        for (const k of Object.keys(sharedNotes)) delete sharedNotes[k];
        for (const d of snap.docs) sharedNotes[d.id] = d.data() as Note;
        seen.add('notes:shared');
        emit();
      },
      fail('notes'),
    ),

    onSnapshot(
      query(collection(db, 'orgs', slug, 'notifications'), where('forUserId', '==', uid)),
      (snap) => {
        state.notifications = byId(snap.docs.map((d) => d.data() as Notification));
        seen.add('notifications');
        emit();
      },
      fail('notifications'),
    ),
  ];

  return () => unsubs.forEach((u) => u());
}

/** Writes the difference between two boards. Returns how many documents were touched, which
 *  is what the unsynced indicator counts. */
export async function pushDiff(
  slug: string,
  prev: Collections,
  next: Collections,
): Promise<number> {
  const batch = writeBatch(db);
  let writes = 0;

  for (const key of SYNCED) {
    const before = prev[key] as Record<string, Entity>;
    const after = next[key] as Record<string, Entity>;

    for (const [id, entity] of Object.entries(after)) {
      const was = before[id];
      if (!was || JSON.stringify(was) !== JSON.stringify(entity)) {
        batch.set(doc(db, 'orgs', slug, PATH[key], id), clean(entity));
        writes += 1;
      }
    }
    for (const id of Object.keys(before)) {
      if (!after[id]) {
        batch.delete(doc(db, 'orgs', slug, PATH[key], id));
        writes += 1;
      }
    }
  }

  if (writes > 0) await batch.commit();
  return writes;
}

/** Leaving an organisation removes only your own membership. */
export const removeSelf = (slug: string, uid: string) =>
  deleteDoc(doc(db, 'orgs', slug, 'members', uid));
