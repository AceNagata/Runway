import { newId } from '../lib/id';
import { nowIso, clock, relDay } from '../lib/time';
import { descendants, directReports, isBelow, reparentError } from '../domain/org';
import { buildFirstRun, buildSeed } from '../data/seed';
import type { Action } from './actions';
import type { ID, Note, RunwayState, Task, TaskEvent, TaskEventType } from './types';

/** One source of truth per object: a task edited in the calendar, the list, the detail
 *  panel or a note issues the same mutation here, and every open view reads the result. §7 */

const event = (
  type: TaskEventType,
  actorId: ID,
  extra: Partial<TaskEvent> = {},
): TaskEvent => ({ id: newId('ev'), type, at: nowIso(), actorId, ...extra });

const appendHistory = (task: Task, ...events: TaskEvent[]): Task => ({
  ...task,
  history: [...task.history, ...events],
});

function queued(state: RunwayState, label: string): RunwayState['queue'] {
  return [...state.queue, { id: newId('op'), at: nowIso(), label }];
}

function notify(
  state: RunwayState,
  forUserId: ID,
  kind: 'assigned' | 'due' | 'handed-off-changed',
  text: string,
  taskId: ID | null,
  actorId: ID | null,
): RunwayState['notifications'] {
  if (forUserId === state.session.currentUserId && kind === 'assigned') {
    // Do not tell someone what they just did themselves.
    return state.notifications;
  }
  const id = newId('nt');
  return {
    ...state.notifications,
    [id]: { id, kind, forUserId, actorId, taskId, text, at: nowIso(), read: false },
  };
}

const firstName = (name: string) => name.split(' ')[0];

/** Keeps a note's promoted-line index honest when the line text is edited away. */
function prunePromotions(note: Note, tasks: Record<ID, Task>): Note {
  const lines = new Set(note.body.split('\n').map((l) => l.trim()));
  const kept = note.promotions.filter((p) => tasks[p.taskId] && lines.has(p.lineText));
  return kept.length === note.promotions.length ? note : { ...note, promotions: kept };
}

export function reducer(state: RunwayState, action: Action): RunwayState {
  const me = state.session.currentUserId;

  switch (action.type) {
    case 'task/create': {
      const id = newId('t');
      const at = nowIso();
      const ownerId = action.draft.ownerId ?? me;
      const task: Task = {
        id,
        title: action.draft.title?.trim() || 'Untitled task',
        body: action.draft.body ?? '',
        ownerId,
        originatorId: me,
        folderId: action.draft.folderId ?? null,
        dueAt: action.draft.dueAt ?? null,
        scheduledStart: null,
        scheduledEnd: null,
        completedAt: null,
        createdAt: at,
        priority: action.draft.priority ?? 'mid',
        sourceNoteId: action.draft.sourceNoteId ?? null,
        sourceLineText: action.draft.sourceLineText ?? null,
        history: [event('created', me)],
      };
      const withAssign =
        ownerId === me
          ? task
          : appendHistory(task, event('assigned', me, { fromUserId: me, toUserId: ownerId }));
      const notifications =
        ownerId === me
          ? state.notifications
          : notify(
              state,
              ownerId,
              'assigned',
              `${firstName(state.users[me].name)} assigned you ${task.title}.`,
              id,
              me,
            );
      return {
        ...state,
        tasks: { ...state.tasks, [id]: withAssign },
        notifications,
        queue: queued(state, `Add task — ${task.title}`),
      };
    }

    case 'task/update': {
      const task = state.tasks[action.id];
      if (!task) return state;
      const events: TaskEvent[] = [];
      if ('dueAt' in action.patch && action.patch.dueAt !== task.dueAt) {
        events.push(
          event('due-changed', me, {
            detail: action.patch.dueAt ? `${relDay(action.patch.dueAt)}, ${clock(action.patch.dueAt)}` : 'cleared',
          }),
        );
      }
      // Ownership only moves through task/handoff, so the tree rule cannot be bypassed here.
      const { ownerId: _ignored, ...patch } = action.patch;
      const next = appendHistory({ ...task, ...patch }, ...events);
      // A promoted line whose task was retitled keeps its link; the note reads the task.
      return {
        ...state,
        tasks: { ...state.tasks, [action.id]: next },
        queue: queued(state, `Edit task — ${next.title}`),
      };
    }

    case 'task/complete': {
      const task = state.tasks[action.id];
      if (!task || task.completedAt) return state;
      const completedAt = nowIso();
      const next = appendHistory({ ...task, completedAt }, event('completed', me));
      // Something you handed off changed state. §2.4
      const notifications =
        task.originatorId !== me
          ? notify(
              state,
              task.originatorId,
              'handed-off-changed',
              `${firstName(state.users[me].name)} closed ${task.title}.`,
              task.id,
              me,
            )
          : state.notifications;
      return {
        ...state,
        tasks: { ...state.tasks, [task.id]: next },
        notifications,
        queue: queued(state, `Complete — ${task.title}`),
      };
    }

    case 'task/reopen': {
      const task = state.tasks[action.id];
      if (!task || !task.completedAt) return state;
      const next = appendHistory({ ...task, completedAt: null }, event('reopened', me));
      return {
        ...state,
        tasks: { ...state.tasks, [task.id]: next },
        queue: queued(state, `Reopen — ${task.title}`),
      };
    }

    case 'task/handoff': {
      const task = state.tasks[action.id];
      const to = state.users[action.toUserId];
      if (!task || !to) return state;
      // Downward-only: a task can only be handed to a report of the current owner. §4
      if (!isBelow(state, to.id, task.ownerId)) return state;
      const from = task.ownerId;
      // Due dates travel with the task — nothing here touches dueAt.
      const next = appendHistory(
        { ...task, ownerId: to.id },
        event(task.history.some((e) => e.type === 'assigned') ? 'reassigned' : 'assigned', me, {
          fromUserId: from,
          toUserId: to.id,
        }),
      );
      let notifications = notify(
        state,
        to.id,
        'assigned',
        `${firstName(state.users[me].name)} handed you ${task.title}.${
          task.dueAt ? ` It is due ${relDay(task.dueAt).toLowerCase()} at ${clock(task.dueAt)}.` : ''
        }`,
        task.id,
        me,
      );
      if (task.originatorId !== me && task.originatorId !== to.id) {
        const withChain = { ...state, notifications };
        notifications = notify(
          withChain,
          task.originatorId,
          'handed-off-changed',
          `${firstName(state.users[me].name)} handed ${task.title} to ${to.name}.`,
          task.id,
          me,
        );
      }
      return {
        ...state,
        tasks: { ...state.tasks, [task.id]: next },
        notifications,
        queue: queued(state, `Hand off — ${task.title} to ${to.name}`),
      };
    }

    case 'task/schedule': {
      const task = state.tasks[action.id];
      if (!task) return state;
      // A task cannot be placed on the calendar without a due date. §2.2
      if (!task.dueAt) return state;
      const next = appendHistory(
        { ...task, scheduledStart: action.startIso, scheduledEnd: action.endIso },
        event('scheduled', me, { detail: clock(action.startIso) }),
      );
      const notifications =
        task.originatorId !== me
          ? notify(
              state,
              task.originatorId,
              'handed-off-changed',
              `${firstName(state.users[me].name)} scheduled ${task.title} for ${clock(action.startIso)} ${relDay(action.startIso).toLowerCase()}.`,
              task.id,
              me,
            )
          : state.notifications;
      return {
        ...state,
        tasks: { ...state.tasks, [task.id]: next },
        notifications,
        queue: queued(state, `Schedule — ${task.title}`),
      };
    }

    case 'task/unschedule': {
      const task = state.tasks[action.id];
      if (!task) return state;
      const next = appendHistory(
        { ...task, scheduledStart: null, scheduledEnd: null },
        event('unscheduled', me),
      );
      return {
        ...state,
        tasks: { ...state.tasks, [task.id]: next },
        queue: queued(state, `Unschedule — ${task.title}`),
      };
    }

    case 'task/delete': {
      const task = state.tasks[action.id];
      if (!task) return state;
      const tasks = { ...state.tasks };
      delete tasks[action.id];
      const notes = Object.fromEntries(
        Object.entries(state.notes).map(([id, n]) => [
          id,
          n.promotions.some((p) => p.taskId === action.id)
            ? { ...n, promotions: n.promotions.filter((p) => p.taskId !== action.id) }
            : n,
        ]),
      );
      // Drop the task's fired-reminder keys so the record cannot grow without bound.
      const reminders = Object.fromEntries(
        Object.entries(state.reminders).filter(([key]) => !key.startsWith(`${action.id}:`)),
      );
      return {
        ...state,
        tasks,
        notes,
        reminders,
        queue: queued(state, `Delete task — ${task.title}`),
      };
    }

    case 'note/create': {
      const id = newId('n');
      const at = nowIso();
      // No title required, no folder required, no save action. §2.1
      const note: Note = {
        id,
        title: '',
        body: '',
        ownerId: me,
        folderId: action.folderId ?? null,
        shared: false,
        archived: false,
        createdAt: at,
        updatedAt: at,
        promotions: [],
      };
      return { ...state, notes: { ...state.notes, [id]: note }, queue: queued(state, 'Take a note') };
    }

    case 'note/update': {
      const note = state.notes[action.id];
      if (!note) return state;
      const next = prunePromotions(
        { ...note, ...action.patch, updatedAt: nowIso() },
        state.tasks,
      );
      return {
        ...state,
        notes: { ...state.notes, [action.id]: next },
        queue: queued(state, `Autosave note — ${next.title || 'Untitled'}`),
      };
    }

    case 'note/promote': {
      const note = state.notes[action.noteId];
      const lineText = action.lineText.trim();
      if (!note || !lineText) return state;
      if (note.promotions.some((p) => p.lineText === lineText)) return state;
      const id = newId('t');
      const task: Task = {
        id,
        title: lineText,
        body: '',
        ownerId: me,
        originatorId: me,
        folderId: note.folderId,
        dueAt: null,
        scheduledStart: null,
        scheduledEnd: null,
        completedAt: null,
        createdAt: nowIso(),
        priority: 'mid',
        // The back-reference to the source note. §2.1
        sourceNoteId: note.id,
        sourceLineText: lineText,
        history: [event('created', me, { detail: 'promoted from a note' })],
      };
      return {
        ...state,
        tasks: { ...state.tasks, [id]: task },
        notes: {
          ...state.notes,
          [note.id]: { ...note, promotions: [...note.promotions, { taskId: id, lineText }] },
        },
        queue: queued(state, `Add task — ${lineText}`),
      };
    }

    case 'note/archive': {
      const note = state.notes[action.id];
      if (!note) return state;
      return {
        ...state,
        notes: { ...state.notes, [action.id]: { ...note, archived: action.archived } },
        queue: queued(state, action.archived ? 'Archive note' : 'Restore note'),
      };
    }

    case 'note/delete': {
      const note = state.notes[action.id];
      if (!note) return state;
      const notes = { ...state.notes };
      delete notes[action.id];
      return { ...state, notes, queue: queued(state, 'Delete note') };
    }

    case 'folder/create': {
      const id = newId('f');
      return {
        ...state,
        folders: { ...state.folders, [id]: { id, name: action.name.trim(), tone: action.tone } },
        queue: queued(state, `Add folder — ${action.name.trim()}`),
      };
    }

    case 'folder/update': {
      const folder = state.folders[action.id];
      if (!folder) return state;
      const next = { ...folder, ...action.patch };
      if (action.patch.name !== undefined) next.name = action.patch.name.trim() || folder.name;
      return {
        ...state,
        folders: { ...state.folders, [action.id]: next },
        queue: queued(state, `Rename folder — ${next.name}`),
      };
    }

    case 'folder/delete': {
      const folder = state.folders[action.id];
      if (!folder) return state;
      const folders = { ...state.folders };
      delete folders[action.id];
      // A folder is a label. Deleting it never deletes the work inside it.
      const tasks = Object.fromEntries(
        Object.entries(state.tasks).map(([id, t]) => [
          id,
          t.folderId === action.id ? { ...t, folderId: null } : t,
        ]),
      );
      const notes = Object.fromEntries(
        Object.entries(state.notes).map(([id, n]) => [
          id,
          n.folderId === action.id ? { ...n, folderId: null } : n,
        ]),
      );
      return {
        ...state,
        folders,
        tasks,
        notes,
        queue: queued(state, `Delete folder — ${folder.name}`),
      };
    }

    case 'notif/read': {
      const n = state.notifications[action.id];
      if (!n) return state;
      return {
        ...state,
        notifications: { ...state.notifications, [action.id]: { ...n, read: true } },
      };
    }

    case 'notif/remind': {
      const task = state.tasks[action.taskId];
      if (!task || state.reminders[action.key]) return state;
      const id = newId('nt');
      return {
        ...state,
        notifications: {
          ...state.notifications,
          [id]: {
            id,
            kind: 'due',
            forUserId: task.ownerId,
            actorId: null,
            taskId: task.id,
            text: action.text,
            at: nowIso(),
            read: false,
          },
        },
        reminders: { ...state.reminders, [action.key]: nowIso() },
      };
    }

    case 'notif/surfaced': {
      const notifications = { ...state.notifications };
      let touched = false;
      for (const id of action.ids) {
        const n = notifications[id];
        if (n && !n.surfaced) {
          notifications[id] = { ...n, surfaced: true };
          touched = true;
        }
      }
      return touched ? { ...state, notifications } : state;
    }

    case 'notif/read-all': {
      const notifications = Object.fromEntries(
        Object.entries(state.notifications).map(([id, n]) => [
          id,
          n.forUserId === me ? { ...n, read: true } : n,
        ]),
      );
      return { ...state, notifications };
    }

    case 'org/invite': {
      const id = newId('u');
      const handle = action.handle.startsWith('@') ? action.handle : `@${action.handle}`;
      return {
        ...state,
        users: {
          ...state.users,
          [id]: {
            id,
            name: action.name.trim(),
            handle,
            role: action.role.trim() || 'Team member',
            managerId: action.managerId,
            admin: false,
            sectionId: action.sectionId,
          },
        },
        queue: queued(state, `Send invite — ${action.name}`),
      };
    }

    case 'org/set-section': {
      const member = state.users[action.memberId];
      if (!member) return state;
      return {
        ...state,
        users: { ...state.users, [member.id]: { ...member, sectionId: action.sectionId } },
        queue: queued(
          state,
          action.sectionId
            ? `Move ${member.name} to ${state.sections[action.sectionId]?.name ?? 'a section'}`
            : `Take ${member.name} out of their section`,
        ),
      };
    }

    case 'section/create': {
      const id = newId('s');
      return {
        ...state,
        sections: { ...state.sections, [id]: { id, name: action.name.trim(), tone: action.tone } },
        queue: queued(state, `Add section — ${action.name.trim()}`),
      };
    }

    case 'section/update': {
      const section = state.sections[action.id];
      if (!section) return state;
      const next = { ...section, ...action.patch };
      if (action.patch.name !== undefined) next.name = action.patch.name.trim() || section.name;
      return {
        ...state,
        sections: { ...state.sections, [action.id]: next },
        queue: queued(state, `Rename section — ${next.name}`),
      };
    }

    case 'section/delete': {
      const section = state.sections[action.id];
      if (!section) return state;
      const sections = { ...state.sections };
      delete sections[action.id];
      // A section is a label. Deleting it never removes anybody from the organisation, and
      // never touches the reporting tree, which is what actually governs access.
      const users = Object.fromEntries(
        Object.entries(state.users).map(([id, u]) => [
          id,
          u.sectionId === action.id ? { ...u, sectionId: null } : u,
        ]),
      );
      return {
        ...state,
        sections,
        users,
        queue: queued(state, `Delete section — ${section.name}`),
      };
    }

    case 'org/reparent': {
      // Transactional: a cycle is rejected outright rather than partially applied. §4
      if (reparentError(state, action.memberId, action.managerId)) return state;
      const member = state.users[action.memberId];
      return {
        ...state,
        users: { ...state.users, [member.id]: { ...member, managerId: action.managerId } },
        queue: queued(state, `Move ${member.name} under ${state.users[action.managerId].name}`),
      };
    }

    case 'org/set-role': {
      const member = state.users[action.memberId];
      if (!member) return state;
      return {
        ...state,
        users: {
          ...state.users,
          [member.id]: { ...member, role: action.role, admin: action.admin },
        },
        queue: queued(state, `Update role — ${member.name}`),
      };
    }

    case 'org/remove': {
      const member = state.users[action.memberId];
      if (!member || member.managerId === null) return state;
      const manager = member.managerId;
      // Reports re-parent to the manager; open tasks reassign upward. Never an orphan. §4
      const users = { ...state.users };
      for (const r of directReports(state, member.id)) {
        users[r.id] = { ...r, managerId: manager };
      }
      delete users[member.id];

      const tasks = { ...state.tasks };
      for (const t of Object.values(state.tasks)) {
        if (t.ownerId !== member.id) continue;
        if (t.completedAt) {
          // Closed work keeps its record; ownership still moves so nothing is orphaned.
          tasks[t.id] = { ...t, ownerId: manager };
          continue;
        }
        tasks[t.id] = appendHistory(
          { ...t, ownerId: manager },
          event('reassigned', me, { fromUserId: member.id, toUserId: manager, detail: 'member removed' }),
        );
      }
      const notifications = Object.fromEntries(
        Object.entries(state.notifications).filter(([, n]) => n.forUserId !== member.id),
      );
      const session =
        state.session.currentUserId === member.id
          ? { ...state.session, currentUserId: manager }
          : state.session;
      return {
        ...state,
        users,
        tasks,
        notifications,
        session,
        queue: queued(state, `Remove member — ${member.name}`),
      };
    }

    case 'session/switch-user': {
      if (!state.users[action.userId]) return state;
      return { ...state, session: { ...state.session, currentUserId: action.userId } };
    }

    case 'session/onboarded':
      return { ...state, session: { ...state.session, onboarded: true } };

    case 'queue/flush':
      return state.queue.length === 0 ? state : { ...state, queue: [] };

    case 'sync/replace': {
      // Firestore is the source of truth for these; everything else is this device's.
      return {
        ...state,
        ...action.collections,
        session: { ...state.session, currentUserId: action.currentUserId },
      };
    }

    case 'demo/load':
      return buildSeed();

    case 'demo/clear':
      return buildFirstRun();

    default:
      return state;
  }
}

/** Guard used by the UI so an illegal hand-off is never offered in the first place. */
export function canHandOff(state: RunwayState, taskId: ID, toUserId: ID): boolean {
  const task = state.tasks[taskId];
  return !!task && descendants(state, task.ownerId).some((u) => u.id === toUserId);
}
