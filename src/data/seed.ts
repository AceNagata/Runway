import { addDays, atHour, clock, startOfDay } from '../lib/time';
import type { Folder, Note, RunwayState, Section, Task, TaskEvent, User } from '../store/types';

/** The seed is dated relative to whenever the app first runs, so home always answers
 *  "what is today" with something real. */

const sections: Section[] = [
  { id: 'sec_product', name: 'Product', tone: 'accent' },
  { id: 'sec_design', name: 'Design', tone: 'done' },
  { id: 'sec_ops', name: 'Operations', tone: 'due' },
  { id: 'sec_eng', name: 'Engineering', tone: 'idle' },
];

const users: User[] = [
  { id: 'u_maya', name: 'Maya Okonkwo', handle: '@maya', role: 'Head of product', managerId: 'u_dara', admin: true, sectionId: 'sec_product' },
  { id: 'u_dara', name: 'Dara Whitfield', handle: '@dara', role: 'Chief executive', managerId: null, admin: true, sectionId: null },
  { id: 'u_theo', name: 'Theo Lund', handle: '@theo', role: 'Product designer', managerId: 'u_maya', admin: false, sectionId: 'sec_design' },
  { id: 'u_ines', name: 'Ines Ruiz', handle: '@ines', role: 'Design school lead', managerId: 'u_maya', admin: false, sectionId: 'sec_design' },
  { id: 'u_priya', name: 'Priya Nair', handle: '@priya', role: 'Operations', managerId: 'u_maya', admin: false, sectionId: 'sec_ops' },
  { id: 'u_sam', name: 'Sam Adeyemi', handle: '@sam', role: 'Design intern', managerId: 'u_theo', admin: false, sectionId: 'sec_design' },
  { id: 'u_lena', name: 'Lena Bauer', handle: '@lena', role: 'Recruiter', managerId: 'u_priya', admin: false, sectionId: 'sec_ops' },
  { id: 'u_omar', name: 'Omar Haddad', handle: '@omar', role: 'Engineering lead', managerId: 'u_dara', admin: false, sectionId: 'sec_eng' },
];

const folders: Folder[] = [
  { id: 'f_q3', name: 'Q3 roadmap', tone: 'accent' },
  { id: 'f_school', name: 'Design school', tone: 'done' },
  { id: 'f_hiring', name: 'Hiring', tone: 'due' },
  { id: 'f_archive', name: 'Vendors', tone: 'idle' },
];

interface SeedTask {
  id: string;
  title: string;
  body: string;
  ownerId: string;
  originatorId: string;
  folderId: string | null;
  /** Days from today; null for an unscheduled task. */
  dueDay: number | null;
  /** Wall-clock hour on that day — except on day 0, where it is read as hours from now,
   *  so today's content is always on the right side of the current time. */
  dueHour?: number;
  /** Scheduled block, as [dayOffset, startHour, endHour]. Same day-0 rule. */
  block?: [number, number, number];
  priority: Task['priority'];
  doneDaysAgo?: number;
  doneHour?: number;
  handedFrom?: string;
}

const seedTasks: SeedTask[] = [
  {
    id: 't_recap', title: 'Send the sprint recap',
    body: 'Recap went out to the whole team. Two follow-ups are already raised separately.',
    ownerId: 'u_maya', originatorId: 'u_maya', folderId: 'f_q3',
    dueDay: 0, dueHour: -1, block: [0, -2.5, -1.5], priority: 'mid',
    doneDaysAgo: 0, doneHour: -1.4,
  },
  {
    id: 't_roadmap', title: 'Q3 roadmap review',
    body: 'Pricing tiers and the migration window are still open — decide both before the panel meets.',
    ownerId: 'u_theo', originatorId: 'u_maya', folderId: 'f_q3',
    dueDay: 0, dueHour: 1, block: [0, -0.5, 1], priority: 'high',
    handedFrom: 'u_maya',
  },
  {
    id: 't_school', title: 'Design school review',
    body: 'Week 4 typography exercise. Bring the specimen sheets.',
    ownerId: 'u_maya', originatorId: 'u_ines', folderId: 'f_school',
    dueDay: 0, dueHour: 3, block: [0, 2, 3], priority: 'mid',
  },
  {
    id: 't_vendor', title: 'Close out vendor contracts',
    body: 'Net 30 across all three. The renewal date moved, so the reminder needs pushing back a month.',
    ownerId: 'u_theo', originatorId: 'u_maya', folderId: 'f_archive',
    dueDay: 0, dueHour: 6, block: [0, 5, 6], priority: 'low',
    handedFrom: 'u_maya',
  },
  {
    id: 't_debrief', title: 'Debrief the senior designer loop',
    body: 'Panel needs a written debrief before the offer call.',
    ownerId: 'u_ines', originatorId: 'u_maya', folderId: 'f_hiring',
    dueDay: -2, dueHour: 17, priority: 'high',
    handedFrom: 'u_maya',
  },
  {
    id: 't_handoffdoc', title: 'Update the hand-off doc',
    body: 'The ownership section is still empty.',
    ownerId: 'u_priya', originatorId: 'u_maya', folderId: 'f_q3',
    dueDay: -1, dueHour: 12, priority: 'mid',
    handedFrom: 'u_maya',
  },
  {
    id: 't_invoices', title: 'Approve the August invoices',
    body: 'Three invoices are waiting on your approval.',
    ownerId: 'u_maya', originatorId: 'u_priya', folderId: 'f_archive',
    dueDay: -1, dueHour: 18, priority: 'mid',
  },
  {
    id: 't_q4hiring', title: 'Draft the Q4 hiring plan',
    body: 'Headcount numbers land on Friday.',
    ownerId: 'u_priya', originatorId: 'u_maya', folderId: 'f_hiring',
    dueDay: 3, dueHour: 17, block: [3, 10, 12], priority: 'mid',
    handedFrom: 'u_maya',
  },
  {
    id: 't_onboarding', title: 'Rewrite the onboarding notes',
    body: 'The current version is three product versions out of date.',
    ownerId: 'u_ines', originatorId: 'u_maya', folderId: 'f_school',
    dueDay: 4, dueHour: 17, priority: 'low', handedFrom: 'u_maya',
  },
  {
    id: 't_pricing', title: 'Decide the pricing tiers',
    body: 'Three tiers or two. Blocks the roadmap review either way.',
    ownerId: 'u_maya', originatorId: 'u_maya', folderId: 'f_q3',
    dueDay: null, priority: 'high',
  },
  {
    id: 't_specimen', title: 'Print the specimen sheets',
    body: '',
    ownerId: 'u_maya', originatorId: 'u_maya', folderId: 'f_school',
    dueDay: null, priority: 'low',
  },
  {
    id: 't_deepwork', title: 'Deep work — migration window',
    body: 'Two uninterrupted hours to map the migration window against support cover.',
    ownerId: 'u_maya', originatorId: 'u_maya', folderId: 'f_q3',
    dueDay: 1, dueHour: 13, block: [1, 10, 12], priority: 'mid',
  },
  {
    id: 't_offer', title: 'Send the offer letter',
    body: '',
    ownerId: 'u_lena', originatorId: 'u_priya', folderId: 'f_hiring',
    dueDay: 1, dueHour: 15, priority: 'high',
  },
  {
    id: 't_portfolio', title: 'Review Sam’s portfolio walkthrough',
    body: 'Strong systems thinking, thin on motion.',
    ownerId: 'u_sam', originatorId: 'u_theo', folderId: 'f_school',
    dueDay: 2, dueHour: 11, block: [2, 9, 10], priority: 'mid',
    handedFrom: 'u_theo',
  },
  // Closed work across the past week so the trend line and reports have history.
  { id: 't_h1', title: 'Ship the settings panel', body: '', ownerId: 'u_maya', originatorId: 'u_maya', folderId: 'f_q3', dueDay: -6, dueHour: 17, priority: 'mid', doneDaysAgo: 6, doneHour: 15 },
  { id: 't_h2', title: 'Write the migration brief', body: '', ownerId: 'u_maya', originatorId: 'u_maya', folderId: 'f_q3', dueDay: -5, dueHour: 17, priority: 'mid', doneDaysAgo: 5, doneHour: 11 },
  { id: 't_h3', title: 'Review the type specimens', body: '', ownerId: 'u_maya', originatorId: 'u_ines', folderId: 'f_school', dueDay: -5, dueHour: 12, priority: 'low', doneDaysAgo: 5, doneHour: 16 },
  { id: 't_h4', title: 'Interview the ops candidate', body: '', ownerId: 'u_maya', originatorId: 'u_priya', folderId: 'f_hiring', dueDay: -4, dueHour: 15, priority: 'mid', doneDaysAgo: 4, doneHour: 14 },
  { id: 't_h5', title: 'Cut the release notes', body: '', ownerId: 'u_maya', originatorId: 'u_maya', folderId: 'f_q3', dueDay: -3, dueHour: 17, priority: 'mid', doneDaysAgo: 3, doneHour: 16 },
  { id: 't_h6', title: 'Close the vendor renewal', body: '', ownerId: 'u_maya', originatorId: 'u_maya', folderId: 'f_archive', dueDay: -3, dueHour: 12, priority: 'low', doneDaysAgo: 3, doneHour: 11 },
  { id: 't_h7', title: 'Plan the design school week', body: '', ownerId: 'u_maya', originatorId: 'u_maya', folderId: 'f_school', dueDay: -2, dueHour: 17, priority: 'mid', doneDaysAgo: 2, doneHour: 12 },
  { id: 't_h8', title: 'Update the roadmap deck', body: '', ownerId: 'u_maya', originatorId: 'u_maya', folderId: 'f_q3', dueDay: -1, dueHour: 17, priority: 'high', doneDaysAgo: 1, doneHour: 17 },
  { id: 't_h9', title: 'Answer the support backlog', body: '', ownerId: 'u_theo', originatorId: 'u_theo', folderId: null, dueDay: -2, dueHour: 17, priority: 'low', doneDaysAgo: 2, doneHour: 16 },
  { id: 't_h10', title: 'Fix the calendar drag target', body: '', ownerId: 'u_theo', originatorId: 'u_maya', folderId: 'f_q3', dueDay: -4, dueHour: 17, priority: 'mid', doneDaysAgo: 4, doneHour: 18, handedFrom: 'u_maya' },
  { id: 't_h11', title: 'Book the school studio', body: '', ownerId: 'u_ines', originatorId: 'u_ines', folderId: 'f_school', dueDay: -6, dueHour: 12, priority: 'low', doneDaysAgo: 6, doneHour: 10 },
  { id: 't_h12', title: 'Reconcile the ops spend', body: '', ownerId: 'u_priya', originatorId: 'u_priya', folderId: 'f_archive', dueDay: -3, dueHour: 17, priority: 'mid', doneDaysAgo: 2, doneHour: 15 },
];

const seedNotes: Array<Omit<Note, 'createdAt' | 'updatedAt'> & { ageDays: number }> = [
  {
    id: 'n_q3', title: 'Q3 roadmap — open questions',
    body: `Three things are still unresolved before the review.\n\nDecide the pricing tiers\nAgree the migration window with support\nName an owner for the hand-off doc\n\nDara wants a single sentence on what we do that the incumbents don't. That comes first — the scope calls below depend on it.`,
    ownerId: 'u_maya', folderId: 'f_q3', shared: true, archived: false,
    promotions: [{ taskId: 't_pricing', lineText: 'Decide the pricing tiers' }],
    ageDays: 0,
  },
  {
    id: 'n_school', title: 'Design school — week 4',
    body: `Typography exercise notes.\n\nTightening tracking as type grows is the single change that made the specimens read. At 44px, -0.02em; at body, nothing.\n\nPrint the specimen sheets\nBring the loupe`,
    ownerId: 'u_maya', folderId: 'f_school', shared: false, archived: false,
    promotions: [{ taskId: 't_specimen', lineText: 'Print the specimen sheets' }],
    ageDays: 1,
  },
  {
    id: 'n_debrief', title: 'Debrief — senior designer loop',
    body: `Strong systems thinking, thin on motion.\n\nAsk for a second portfolio walkthrough before the panel meets. Theo has the exercise brief.`,
    ownerId: 'u_maya', folderId: 'f_hiring', shared: true, archived: false,
    promotions: [], ageDays: 3,
  },
  {
    id: 'n_vendor', title: 'Vendor contracts — terms',
    body: `Net 30 across all three.\n\nThe renewal date moved to November, so the reminder needs pushing back a month.`,
    ownerId: 'u_maya', folderId: 'f_archive', shared: false, archived: true,
    promotions: [], ageDays: 7,
  },
  {
    id: 'n_standup', title: '',
    body: `Standup — quick capture\n\nOmar is blocked on the migration window\nLena has two offers out\nSam starts the motion module Monday`,
    ownerId: 'u_maya', folderId: null, shared: false, archived: false,
    promotions: [], ageDays: 0,
  },
];

let evSeq = 0;
const ev = (
  type: TaskEvent['type'],
  at: string,
  actorId: string,
  extra: Partial<TaskEvent> = {},
): TaskEvent => {
  evSeq += 1;
  return { id: `ev_seed_${evSeq}`, type, at, actorId, ...extra };
};

export function buildSeed(now = new Date()): RunwayState {
  const today = startOfDay(now);
  const tasks: Record<string, Task> = {};

  // Day-0 hours are offsets from the current time, clamped inside today, so a load at any
  // hour finds closed work behind it and due work ahead of it.
  const elapsed = now.getHours() + now.getMinutes() / 60;
  const resolveHour = (dayOffset: number, hour: number) =>
    dayOffset === 0 ? Math.min(23.5, Math.max(0.25, elapsed + hour)) : hour;

  const hourToIso = (dayOffset: number, hour: number) => {
    const h = resolveHour(dayOffset, hour);
    return atHour(addDays(today, dayOffset), Math.floor(h), Math.round((h % 1) * 60));
  };

  seedTasks.forEach((s) => {
    const createdAt = atHour(addDays(today, (s.dueDay ?? 0) - 3), 9, 15);
    const dueAt = s.dueDay === null ? null : hourToIso(s.dueDay, s.dueHour ?? 17);
    const history: TaskEvent[] = [ev('created', createdAt, s.originatorId)];

    if (s.handedFrom && s.handedFrom !== s.ownerId) {
      history.push(
        ev('assigned', atHour(addDays(today, (s.dueDay ?? 0) - 2), 11), s.handedFrom, {
          fromUserId: s.handedFrom,
          toUserId: s.ownerId,
        }),
      );
    }
    const blockStart = s.block ? hourToIso(s.block[0], s.block[1]) : null;
    if (s.block && blockStart) {
      history.push(
        ev('scheduled', atHour(addDays(today, s.block[0] - 1), 16), s.ownerId, {
          detail: clock(blockStart),
        }),
      );
    }
    const completedAt =
      s.doneDaysAgo === undefined
        ? null
        : hourToIso(-s.doneDaysAgo, s.doneHour ?? 17);
    if (completedAt) history.push(ev('completed', completedAt, s.ownerId));

    tasks[s.id] = {
      id: s.id,
      title: s.title,
      body: s.body,
      ownerId: s.ownerId,
      originatorId: s.originatorId,
      folderId: s.folderId,
      dueAt,
      scheduledStart: blockStart,
      scheduledEnd: s.block ? hourToIso(s.block[0], s.block[2]) : null,
      completedAt,
      createdAt,
      priority: s.priority,
      sourceNoteId: null,
      sourceLineText: null,
      history: history.sort((a, b) => (a.at < b.at ? -1 : 1)),
    };

  });

  // Promoted tasks carry their back-reference to the note line. §2.1
  const notes: Record<string, Note> = {};
  for (const n of seedNotes) {
    const stamp = atHour(addDays(today, -n.ageDays), 9, 40);
    notes[n.id] = {
      ...n,
      createdAt: stamp,
      updatedAt: n.ageDays === 0 ? atHour(today, 8, 12) : stamp,
    };
    for (const p of n.promotions) {
      const t = tasks[p.taskId];
      if (t) {
        t.sourceNoteId = n.id;
        t.sourceLineText = p.lineText;
      }
    }
  }

  // Copy is composed from the resolved tasks, so a notification never quotes a time the
  // task no longer has. Each leads with the actor and stops at two sentences.
  const dueClock = (id: string) => clock(tasks[id].dueAt!);
  const blockClock = (id: string) => clock(tasks[id].scheduledStart!);

  const notifSeed = [
    { id: 'nt_1', kind: 'assigned' as const, actorId: 'u_maya', taskId: 't_roadmap', text: `Maya assigned you Q3 roadmap review. It is due today at ${dueClock('t_roadmap')}.`, hoursAgo: 20, read: false, forUserId: 'u_theo' },
    { id: 'nt_2', kind: 'due' as const, actorId: null, taskId: 't_school', text: `Design school review is due today at ${dueClock('t_school')}.`, hoursAgo: 2, read: false, forUserId: 'u_maya' },
    { id: 'nt_3', kind: 'handed-off-changed' as const, actorId: 'u_theo', taskId: 't_vendor', text: `Theo scheduled Close out vendor contracts for ${blockClock('t_vendor')} today.`, hoursAgo: 5, read: false, forUserId: 'u_maya' },
    { id: 'nt_4', kind: 'due' as const, actorId: null, taskId: 't_invoices', text: 'Approve the August invoices is past its due time.', hoursAgo: 14, read: true, forUserId: 'u_maya' },
    { id: 'nt_5', kind: 'handed-off-changed' as const, actorId: 'u_priya', taskId: 't_handoffdoc', text: 'Priya has not started Update the hand-off doc. It is a day past due.', hoursAgo: 9, read: false, forUserId: 'u_maya' },
  ];

  const notifications: RunwayState['notifications'] = {};
  for (const n of notifSeed) {
    notifications[n.id] = {
      id: n.id,
      kind: n.kind,
      forUserId: n.forUserId,
      actorId: n.actorId,
      taskId: n.taskId,
      text: n.text,
      at: new Date(now.getTime() - n.hoursAgo * 3_600_000).toISOString(),
      read: n.read,
      // Seeded notifications are history, so they never pop as fresh alerts on first load.
      surfaced: true,
    };
  }

  // Pre-arm the due reminders for work that is already past due at seed time. The seeded
  // notifications above already cover that ground, so the watcher must not repeat it.
  const reminders: RunwayState['reminders'] = {};
  for (const t of Object.values(tasks)) {
    if (t.completedAt || !t.dueAt) continue;
    if (new Date(t.dueAt) <= now) reminders[`${t.id}:${t.dueAt}:due`] = now.toISOString();
  }

  return {
    users: Object.fromEntries(users.map((u) => [u.id, u])),
    sections: Object.fromEntries(sections.map((x) => [x.id, x])),
    folders: Object.fromEntries(folders.map((f) => [f.id, f])),
    tasks,
    notes,
    notifications,
    reminders,
    session: { currentUserId: 'u_maya', onboarded: true },
    queue: [],
  };
}

/** What a real visitor gets: one account, an empty board, no invented work.
 *
 *  This is the default state — the demo org above is only loaded on request, so nothing
 *  presents made-up tasks as if they were the user's own. The single member exists because
 *  the reporting tree *is* the permission model (§4) and there is no sign-up without a
 *  backend (DECISIONS.md Q8); it is a placeholder, not a person. Invite real people from
 *  Team, or load the demo from Menu to see hand-off and reports with data in them. */
export function buildFirstRun(): RunwayState {
  const you: User = {
    id: 'u_you',
    name: PLACEHOLDER_NAME,
    handle: '@you',
    role: 'Owner',
    managerId: null,
    admin: true,
    sectionId: null,
  };
  return {
    users: { [you.id]: you },
    sections: {},
    folders: {},
    tasks: {},
    notes: {},
    notifications: {},
    reminders: {},
    session: { currentUserId: you.id, onboarded: false },
    queue: [],
  };
}

/** The stand-in for a name we cannot know without auth. Consumers check against it rather
 *  than greeting somebody "Good morning, You". */
export const PLACEHOLDER_NAME = 'You';

/** The quote is decorative, rotates daily, and its absence is not an error state. §3 */
export const QUOTES: Array<{ text: string; source: string }> = [
  { text: 'Slow is smooth, and smooth is fast.', source: 'Daily note' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', source: 'Daily note' },
  { text: 'The work you finish is the only work that counts.', source: 'Daily note' },
  { text: 'Amateurs talk strategy. Professionals talk logistics.', source: 'Daily note' },
  { text: 'A plan is a hypothesis about where the day goes.', source: 'Daily note' },
  { text: 'Start where you are. Use what you have.', source: 'Daily note' },
  { text: 'Attention is the rarest form of generosity.', source: 'Daily note' },
];
