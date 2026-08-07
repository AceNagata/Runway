import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarCheck, CheckCircle2, Coffee, FileText, Plus, UserPlus } from 'lucide-react';
import { Button, Card, EmptyState, Eyebrow, ICON, Mono } from '../components/ui';
import { LoadBar, Sparkline } from '../components/ui/Charts';
import { TaskRow } from '../components/TaskRow';
import { InviteDialog } from './Team';
import { useStore } from '../store/StoreContext';
import { lastSevenDays } from '../domain/reports';
import { derivedStatus, groupOf, isOnToday, sortTasks } from '../domain/tasks';
import { visibleTaskIds } from '../domain/org';
import { PLACEHOLDER_NAME, QUOTES } from '../data/seed';
import { absDate, greetingEyebrow, lateness, partOfDay, weekdayShort } from '../lib/time';
import type { Task } from '../store/types';

/** The quote is decorative, rotates daily, loads independently and must never delay the
 *  regions below it. Its absence is not an error state. §3 */
function useDailyQuote() {
  const [quote, setQuote] = useState<{ text: string; source: string } | null>(null);
  useEffect(() => {
    let alive = true;
    const day = Math.floor(Date.now() / 86_400_000);
    // Resolved off the render path, exactly as a fetch would be.
    const id = window.setTimeout(() => {
      if (alive) setQuote(QUOTES[day % QUOTES.length]);
    }, 90);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, []);
  return quote;
}

export function Home({
  now,
  onOpenTask,
  onAddTask,
}: {
  now: Date;
  onOpenTask: (id: string) => void;
  onAddTask: () => void;
}) {
  const { state, me, dispatch } = useStore();
  const navigate = useNavigate();
  const quote = useDailyQuote();

  const { overdue, today, closedToday, week } = useMemo(() => {
    const visible = visibleTaskIds(state, me.id);
    const mine: Task[] = [];
    for (const id of visible) {
      const t = state.tasks[id];
      if (t && t.ownerId === me.id) mine.push(t);
    }
    return {
      // The only past-dated content home ever shows.
      overdue: mine.filter((t) => derivedStatus(t, now) === 'overdue').sort(sortTasks),
      today: mine
        .filter((t) => !t.completedAt && groupOf(t, now) === 'today')
        .sort(sortTasks),
      closedToday: mine
        .filter((t) => t.completedAt && isOnToday(t, now))
        .sort(sortTasks),
      week: lastSevenDays(state, me.id, now),
    };
  }, [state, me.id, now]);

  const openToday = today.length;
  const closedTodayCount = closedToday.length;

  // First run gets a distinct onboarding pass rather than four empty regions at once, and
  // graduates the moment there is real work to report. §3
  const hasOwnWork =
    Object.values(state.tasks).some((t) => t.ownerId === me.id) ||
    Object.values(state.notes).some((n) => n.ownerId === me.id);
  if (!state.session.onboarded && !hasOwnWork) {
    return <FirstRun onAddTask={onAddTask} onDone={() => dispatch({ type: 'session/onboarded' })} />;
  }

  const summary =
    openToday === 0 && overdue.length === 0
      ? "Nothing due today — enjoy it."
      : openToday === 0
        ? `Nothing due today. ${overdue.length} ${overdue.length === 1 ? 'task is' : 'tasks are'} still overdue from earlier.`
        : `${openToday} ${openToday === 1 ? 'task' : 'tasks'} due today${
            overdue.length ? `, ${overdue.length} overdue` : ''
          }. You closed ${week.closed} this week.`;

  return (
    <div className="screen rise">
      {/* 1 — Greeting and quote */}
      <div className="hero">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', maxWidth: 560 }}>
          <Eyebrow>{greetingEyebrow(now)}</Eyebrow>
          {/* No name to greet until there is a real account, so the greeting drops it
              rather than saying "Good morning, You". */}
          <h2 className="h1">
            Good {partOfDay(now)}
            {me.name !== PLACEHOLDER_NAME && `, ${me.name.split(' ')[0]}`}
          </h2>
          <p className="muted" style={{ fontSize: 'var(--fs-body)', lineHeight: 1.5, textWrap: 'pretty' }}>
            {summary}
          </p>
        </div>
        <div className="hero-actions" style={{ display: 'flex', gap: 'var(--sp-4)' }}>
          <Button variant="primary" size="lg" onClick={onAddTask}>
            Add task
          </Button>
          <Button variant="secondary" size="lg" onClick={() => navigate('/notes/new')}>
            Take a note
          </Button>
        </div>
      </div>

      {quote && (
        <div className="quote">
          <span className="quote-text">{quote.text}</span>
          <Mono className="faint">
            {quote.source} · {absDate(now)}
          </Mono>
        </div>
      )}

      {/* 2 — Recent performance. A summary, not a dashboard: it links through to Reports. */}
      <div className="stat-grid">
        <Card tab="accent">
          <Eyebrow>Due today</Eyebrow>
          <div className="stat-value" style={{ marginTop: 'var(--sp-5)' }}>
            {openToday}
          </div>
          <div className="stat-note">
            {openToday === 0
              ? closedTodayCount > 0
                ? `${closedTodayCount} closed already today.`
                : 'Your day is clear.'
              : `${closedTodayCount} closed already today.`}
          </div>
        </Card>

        <Card tab="done">
          <Eyebrow>Closed this week</Eyebrow>
          <div className="stat-value" style={{ marginTop: 'var(--sp-5)' }}>
            {week.closed} / {week.closed + week.openLoad.overdue + week.openLoad.due}
          </div>
          <div className="stat-note">
            {week.closed === 0
              ? 'Nothing closed in the last seven days.'
              : `${week.openLoad.overdue + week.openLoad.due} still open.`}
          </div>
        </Card>

        <Card tab={overdue.length ? 'overdue' : 'idle'}>
          <Eyebrow>Overdue</Eyebrow>
          <div className="stat-value" style={{ marginTop: 'var(--sp-5)' }}>
            {overdue.length}
          </div>
          <div className="stat-note">
            {overdue.length === 0
              ? 'Nothing is past its due time.'
              : `The oldest is ${lateness(overdue[0].dueAt!, now)}.`}
          </div>
        </Card>

        <Card tab="due">
          <Eyebrow>On time</Eyebrow>
          <div className="stat-value" style={{ marginTop: 'var(--sp-5)' }}>
            {week.onTimeRate === null ? '—' : `${Math.round(week.onTimeRate * 100)}%`}
          </div>
          <div className="stat-note">
            {week.onTimeRate === null
              ? 'Nothing with a due date closed yet.'
              : `${week.onTimeClosed} of ${week.onTimeEligible} closed before their due time.`}
          </div>
        </Card>
      </div>

      <div
        className="home-columns"
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1.45fr) minmax(0,1fr)',
          gap: 'var(--sp-6)',
          alignItems: 'start',
        }}
      >
        {/* 3 — Today's task summary. Overdue surfaces at the top. */}
        <Card className="card-flush">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 'var(--sp-5)',
              padding: 'var(--sp-7) var(--sp-7) var(--sp-5)',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              <Eyebrow>Today's tasks</Eyebrow>
              <span className="h3">
                {openToday === 0 && overdue.length === 0
                  ? "You're all caught up"
                  : `${openToday + overdue.length} still open`}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')}>
              See all tasks
              <ArrowRight size={16} {...ICON} />
            </Button>
          </div>

          {overdue.length === 0 && today.length === 0 && closedToday.length === 0 ? (
            <EmptyState
              icon={<Coffee size={24} {...ICON} />}
              line="Nothing due today — enjoy it."
              action={
                <Button variant="ghost" size="sm" onClick={onAddTask}>
                  <Plus size={16} {...ICON} />
                  Add task
                </Button>
              }
            />
          ) : (
            <>
              {overdue.length > 0 && (
                <Section label="Overdue" count={overdue.length}>
                  {overdue.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      now={now}
                      onOpen={() => onOpenTask(t.id)}
                      onToggle={() => dispatch({ type: 'task/complete', id: t.id })}
                    />
                  ))}
                </Section>
              )}
              {today.length > 0 && (
                <Section label="Due today" count={today.length}>
                  {today.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      now={now}
                      onOpen={() => onOpenTask(t.id)}
                      onToggle={() => dispatch({ type: 'task/complete', id: t.id })}
                    />
                  ))}
                </Section>
              )}
              {closedToday.length > 0 && (
                <Section label="Closed today" count={closedToday.length}>
                  {closedToday.map((t) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      now={now}
                      onOpen={() => onOpenTask(t.id)}
                      onToggle={() => dispatch({ type: 'task/reopen', id: t.id })}
                    />
                  ))}
                </Section>
              )}
            </>
          )}
        </Card>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <Card>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 'var(--sp-6)',
              }}
            >
              <Eyebrow>Last 7 days</Eyebrow>
              <Mono className="faint">tasks closed</Mono>
            </div>
            {week.closed === 0 ? (
              <EmptyState
                icon={<CheckCircle2 size={24} {...ICON} />}
                line="Nothing closed yet. The line starts when you do."
              />
            ) : (
              <Sparkline
                values={week.byDay.map((d) => d.closed)}
                labels={week.byDay.map((d) => weekdayShort(d.day))}
                ariaLabel={`Tasks closed over the last seven days, ${week.closed} in total`}
              />
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/reports')}
              style={{ marginTop: 'var(--sp-5)' }}
            >
              Open reports
              <ArrowRight size={16} {...ICON} />
            </Button>
          </Card>

          {/* The fixed bar already answers "what is next", so this slot carries the shape
              of the open pile instead of repeating it. */}
          <Card tab={week.openLoad.overdue ? 'overdue' : 'accent'} tabSide="right">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <Eyebrow>Open load</Eyebrow>
              <Mono className="faint">
                {week.openLoad.overdue + week.openLoad.due + week.openLoad.unscheduled} open
              </Mono>
            </div>
            {week.openLoad.overdue + week.openLoad.due + week.openLoad.unscheduled === 0 ? (
              <EmptyState
                icon={<CalendarCheck size={24} {...ICON} />}
                line="Nothing open. You're all caught up."
              />
            ) : (
              <>
                <div style={{ marginTop: 'var(--sp-7)' }}>
                  <LoadBar {...week.openLoad} />
                </div>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--sp-4)',
                    marginTop: 'var(--sp-6)',
                  }}
                >
                  {(
                    [
                      ['overdue', 'Overdue', week.openLoad.overdue, '/tasks?group=overdue'],
                      ['due', 'Due', week.openLoad.due, '/tasks'],
                      ['idle', 'Unscheduled', week.openLoad.unscheduled, '/tasks?group=unscheduled'],
                    ] as const
                  ).map(([tone, label, count, to]) => (
                    <button
                      key={label}
                      className="folder-link"
                      style={{ minHeight: 28 }}
                      onClick={() => navigate(to)}
                    >
                      <span className={`dot dot-${tone}`} />
                      {label}
                      <Mono style={{ marginLeft: 'auto', color: 'var(--text-body)' }}>{count}</Mono>
                    </button>
                  ))}
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Section({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="group-head" style={{ padding: '0 var(--sp-7)', marginTop: 'var(--sp-5)' }}>
        <Eyebrow>{label}</Eyebrow>
        <Mono className="faint">{count}</Mono>
        <span className="group-rule" />
      </div>
      <div className="rows">{children}</div>
    </>
  );
}

/** First run: one thing to do, not four empty regions. §3 */
function FirstRun({ onAddTask, onDone }: { onAddTask: () => void; onDone: () => void }) {
  const { me } = useStore();
  const navigate = useNavigate();
  const [inviting, setInviting] = useState(false);

  // Each step ends in the action that step describes, all three styled the same.
  const stepCard = { display: 'flex', flexDirection: 'column' } as const;
  const stepAction = { marginTop: 'auto', paddingTop: 'var(--sp-6)', alignSelf: 'flex-start' };

  return (
    <div className="screen rise">
      <div className="hero">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)', maxWidth: 620 }}>
          <Eyebrow>First run</Eyebrow>
          <h2 className="h1">
            Welcome{me.name !== PLACEHOLDER_NAME && `, ${me.name.split(' ')[0]}`}
          </h2>
          <p className="muted" style={{ fontSize: 16, lineHeight: 1.5, textWrap: 'pretty' }}>
            Runway holds your notes, your tasks and your calendar in one place. Add the first
            thing on your mind and home will start answering what today is.
          </p>
        </div>
      </div>

      <div className="stat-grid">
        <Card tab="accent" style={stepCard}>
          <Eyebrow>Step one</Eyebrow>
          <p className="h3" style={{ margin: 'var(--sp-5) 0' }}>
            Add a task
          </p>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
            Give it a due time and it lands on today. Leave the time off and it waits in the
            unscheduled bucket.
          </p>
          <div style={stepAction}>
            <Button variant="primary" onClick={onAddTask}>
              <Plus size={16} {...ICON} />
              Add task
            </Button>
          </div>
        </Card>

        <Card tab="due" style={stepCard}>
          <Eyebrow>Step two</Eyebrow>
          <p className="h3" style={{ margin: 'var(--sp-5) 0' }}>
            Take a note
          </p>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
            No title, no folder, no save button. Any line in it can become a task without
            leaving the page.
          </p>
          <div style={stepAction}>
            <Button variant="primary" onClick={() => navigate('/notes/new')}>
              <FileText size={16} {...ICON} />
              Take a note
            </Button>
          </div>
        </Card>

        <Card tab="done" style={stepCard}>
          <Eyebrow>Step three</Eyebrow>
          <p className="h3" style={{ margin: 'var(--sp-5) 0' }}>
            Hand work off
          </p>
          <p className="muted" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5 }}>
            Pass a task to anyone who reports to you. The due date travels with it and you
            stay on the record.
          </p>
          {/* Hand-off needs somebody below you, and a fresh account has nobody — so the
              action here is the one that makes hand-off possible at all. */}
          <div style={stepAction}>
            <Button variant="primary" onClick={() => setInviting(true)}>
              <UserPlus size={16} {...ICON} />
              Send invite
            </Button>
          </div>
        </Card>
      </div>

      <div>
        <Button variant="ghost" onClick={onDone}>
          Skip the tour
        </Button>
      </div>

      {inviting && <InviteDialog onClose={() => setInviting(false)} />}
    </div>
  );
}
