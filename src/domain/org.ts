import type { ID, RunwayState, User } from '../store/types';

/** The org tree is the permission model, not just a diagram: a user can see and act on
 *  the tasks of anyone below them, and cannot see sideways or upward. §4 */

export function directReports(state: RunwayState, userId: ID): User[] {
  return Object.values(state.users)
    .filter((u) => u.managerId === userId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every descendant of `userId`, excluding the user themselves. */
export function descendants(state: RunwayState, userId: ID): User[] {
  const out: User[] = [];
  const walk = (id: ID) => {
    for (const r of directReports(state, id)) {
      out.push(r);
      walk(r.id);
    }
  };
  walk(userId);
  return out;
}

/** The user plus everyone below them — the full set of people they may act on. */
export function subtree(state: RunwayState, userId: ID): User[] {
  const self = state.users[userId];
  return self ? [self, ...descendants(state, userId)] : [];
}

export function subtreeIds(state: RunwayState, userId: ID): Set<ID> {
  return new Set(subtree(state, userId).map((u) => u.id));
}

export function isBelow(state: RunwayState, candidateId: ID, ofUserId: ID): boolean {
  return descendants(state, ofUserId).some((u) => u.id === candidateId);
}

/** Root-first chain: CEO → … → user. Used by the "Reports to" line. */
export function managerChain(state: RunwayState, userId: ID): User[] {
  const chain: User[] = [];
  let cursor = state.users[userId]?.managerId ?? null;
  const guard = new Set<ID>();
  while (cursor && state.users[cursor] && !guard.has(cursor)) {
    guard.add(cursor);
    chain.unshift(state.users[cursor]);
    cursor = state.users[cursor].managerId;
  }
  return chain;
}

export function depth(state: RunwayState, userId: ID): number {
  return managerChain(state, userId).length;
}

export function rootUser(state: RunwayState): User | undefined {
  return Object.values(state.users).find((u) => u.managerId === null);
}

/** A cycle must be impossible to create; the operation is rejected rather than
 *  partially applied. §4 Returns the reason a re-parent is illegal, or null. */
export function reparentError(
  state: RunwayState,
  memberId: ID,
  nextManagerId: ID | null,
): string | null {
  if (nextManagerId === null) return 'Every member needs a manager.';
  if (memberId === nextManagerId) return 'A member cannot report to themselves.';
  if (!state.users[nextManagerId]) return 'That member is no longer in your team.';
  if (isBelow(state, nextManagerId, memberId)) {
    const m = state.users[nextManagerId].name;
    const who = state.users[memberId].name;
    return `${m} already reports to ${who}. Move ${m} first.`;
  }
  return null;
}

/** Tasks a viewer may see: owned by anyone in their subtree, or work they raised or
 *  handed off themselves (so the originator can still track it after two hops). §4 */
export function visibleTaskIds(state: RunwayState, viewerId: ID): Set<ID> {
  const allowed = subtreeIds(state, viewerId);
  const out = new Set<ID>();
  for (const t of Object.values(state.tasks)) {
    if (allowed.has(t.ownerId) || t.originatorId === viewerId) {
      out.add(t.id);
      continue;
    }
    if (t.history.some((e) => e.actorId === viewerId || e.fromUserId === viewerId)) out.add(t.id);
  }
  return out;
}

/** Hand-off moves ownership *down* the tree: only a direct or indirect report of the
 *  current owner is a legal target. §4 (Sideways hand-off — see decisions.md Q3.) */
export function handoffTargets(state: RunwayState, task: { ownerId: ID }): User[] {
  return descendants(state, task.ownerId);
}
