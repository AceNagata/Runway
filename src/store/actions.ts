import type { ID, ReminderKind, StatusTone, Task } from './types';
import type { Subject } from '../domain/reports';

export type TaskDraft = Partial<
  Pick<
    Task,
    'title' | 'body' | 'dueAt' | 'folderId' | 'priority' | 'ownerId' | 'sourceNoteId' | 'sourceLineText'
  >
>;

export type Action =
  | { type: 'task/create'; draft: TaskDraft }
  | { type: 'task/update'; id: ID; patch: TaskDraft }
  | { type: 'task/complete'; id: ID }
  | { type: 'task/reopen'; id: ID }
  | { type: 'task/handoff'; id: ID; toUserId: ID }
  | { type: 'task/schedule'; id: ID; startIso: string; endIso: string }
  | { type: 'task/unschedule'; id: ID }
  | { type: 'task/delete'; id: ID }
  | { type: 'note/create'; folderId?: ID | null }
  | { type: 'note/update'; id: ID; patch: { title?: string; body?: string; folderId?: ID | null; shared?: boolean } }
  | { type: 'note/promote'; noteId: ID; lineText: string }
  | { type: 'note/archive'; id: ID; archived: boolean }
  | { type: 'note/delete'; id: ID }
  | { type: 'folder/create'; name: string; tone: StatusTone }
  | { type: 'folder/update'; id: ID; patch: { name?: string; tone?: StatusTone } }
  /** Contents are kept and simply lose their folder — a folder is a label, not a container. */
  | { type: 'folder/delete'; id: ID }
  | { type: 'notif/read'; id: ID }
  | { type: 'notif/read-all' }
  /** Raised by the due-date watcher, not by a user. Records the reminder key so the same
   *  deadline never alerts twice. */
  | { type: 'notif/remind'; taskId: ID; kind: ReminderKind; text: string; key: string }
  /** Marks notifications as handed to the operating system. */
  | { type: 'notif/surfaced'; ids: ID[] }
  | { type: 'org/invite'; name: string; handle: string; role: string; managerId: ID }
  | { type: 'org/reparent'; memberId: ID; managerId: ID }
  | { type: 'org/set-role'; memberId: ID; role: string; admin: boolean }
  | { type: 'org/remove'; memberId: ID }
  | { type: 'session/switch-user'; userId: ID }
  | { type: 'session/onboarded' }
  | { type: 'queue/flush' }
  /** Loads the demo org, tasks and notes. */
  | { type: 'demo/load' }
  /** Back to one account and an empty board. */
  | { type: 'demo/clear' };

/** Reports are a read model, not state — this only exists so the screen can name its
 *  own selection in a URL-free way. */
export type ReportSelection = { subject: Subject; days: number };
