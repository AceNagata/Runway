export type ID = string;

/** Status hues are the only chroma outside the accent. Kept as a closed set so no
 *  component can invent a colour outside the token file. */
export type StatusTone = 'overdue' | 'due' | 'done' | 'idle' | 'accent';

export interface User {
  id: ID;
  name: string;
  handle: string;
  role: string;
  /** Exactly one manager; null only for the root of the org tree. §4 */
  managerId: ID | null;
  /** Permits the admin surface (member + manager editing). */
  admin: boolean;
  /** User-supplied only. No stock photography anywhere in this product. */
  avatarUrl?: string;
}

export interface Folder {
  id: ID;
  name: string;
  tone: StatusTone;
}

export type TaskEventType =
  | 'created'
  | 'assigned'
  | 'reassigned'
  | 'scheduled'
  | 'unscheduled'
  | 'due-changed'
  | 'completed'
  | 'reopened';

/** Append-only. This is what makes hand-off auditable and reports derivable. §2.2 */
export interface TaskEvent {
  id: ID;
  type: TaskEventType;
  /** UTC ISO. Rendered in the viewing user's zone. §7 */
  at: string;
  actorId: ID;
  toUserId?: ID;
  fromUserId?: ID;
  detail?: string;
}

export interface Task {
  id: ID;
  title: string;
  body: string;
  ownerId: ID;
  /** Hand-off never clears this. Chain of custody is derived from history. §4 */
  originatorId: ID;
  folderId: ID | null;
  /** A due date is a date-*time*, stored UTC, so hand-off across zones cannot move it. §7 */
  dueAt: string | null;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  completedAt: string | null;
  createdAt: string;
  priority: 'high' | 'mid' | 'low';
  /** Back-reference to the note line this task was promoted from. §2.1 */
  sourceNoteId: ID | null;
  sourceLineText: string | null;
  history: TaskEvent[];
}

/** A promoted line inside a note. Resolved by line text so inserting lines above
 *  does not break the link (documented assumption — see decisions.md Q1). */
export interface NotePromotion {
  taskId: ID;
  lineText: string;
}

export interface Note {
  id: ID;
  /** Optional — a note never requires a title, a folder, or a save action. §2.1 */
  title: string;
  body: string;
  ownerId: ID;
  folderId: ID | null;
  shared: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  promotions: NotePromotion[];
}

/** Three event classes only. §2.4 */
export type NotificationKind = 'assigned' | 'due' | 'handed-off-changed';

export interface Notification {
  id: ID;
  kind: NotificationKind;
  forUserId: ID;
  actorId: ID | null;
  taskId: ID | null;
  /** Leads with the actor, two sentences maximum. */
  text: string;
  at: string;
  read: boolean;
  /** Whether this has already been handed to the operating system. Persisted, so a reload
   *  does not replay every past notification as a fresh alert. */
  surfaced?: boolean;
}

/** A queued write. Replayed when connectivity returns; the user is told it is
 *  unsynced but never blocked from working. §7 */
export interface QueuedOp {
  id: ID;
  at: string;
  label: string;
}

export interface Session {
  currentUserId: ID;
  /** First run gets a distinct onboarding pass rather than four empty regions. §3 */
  onboarded: boolean;
}

export interface RunwayState {
  users: Record<ID, User>;
  folders: Record<ID, Folder>;
  tasks: Record<ID, Task>;
  notes: Record<ID, Note>;
  notifications: Record<ID, Notification>;
  /** Fired due-date reminders, keyed `taskId:dueAt:kind` so moving a due date re-arms them
   *  and a given reminder never fires twice. Value is when it fired. */
  reminders: Record<string, string>;
  session: Session;
  queue: QueuedOp[];
}

/** Approaching, then past. Two shots per due date and no more. §2.4 */
export type ReminderKind = 'soon' | 'due';
