import { useMemo, useState } from 'react';
import { CalendarOff, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { Button, Card, EmptyState, Eyebrow, ICON, IconButton, Mono, useToast } from '../components/ui';
import { useStore } from '../store/StoreContext';
import { visibleTaskIds } from '../domain/org';
import { derivedStatus, layoutDay, scheduleBlockedReason, STATUS_TONE } from '../domain/tasks';
import {
  absDateShort,
  addDays,
  atHour,
  clockRange,
  dateRange,
  isoWeek,
  sameDay,
  startOfWeek,
  weekdayShort,
} from '../lib/time';
import type { Task } from '../store/types';

/** The scheduler and the calendar are two presentations of one dataset. Dragging a block
 *  here issues the same write as editing the schedule in the detail panel. §2.3 */

const DEFAULT_START_HOUR = 7;
const DEFAULT_END_HOUR = 21;
const HOUR_H = 56;
const SNAP_MINUTES = 15;

export function Schedule({
  now,
  onOpenTask,
}: {
  now: Date;
  onOpenTask: (id: string) => void;
}) {
  const { state, me, dispatch } = useStore();
  const toast = useToast();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(now));
  const [dragging, setDragging] = useState<{ id: string; minutes: number } | null>(null);
  const [dropCol, setDropCol] = useState<number | null>(null);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const { scheduled, unscheduled } = useMemo(() => {
    const ids = visibleTaskIds(state, me.id);
    const sched: Task[] = [];
    const unsched: Task[] = [];
    for (const id of ids) {
      const t = state.tasks[id];
      if (!t) continue;
      if (t.scheduledStart && t.scheduledEnd) sched.push(t);
      else if (!t.completedAt && t.ownerId === me.id) unsched.push(t);
    }
    return { scheduled: sched, unscheduled: unsched };
  }, [state, me.id]);

  const perDay = useMemo(
    () =>
      days.map((day) =>
        layoutDay(scheduled.filter((t) => sameDay(new Date(t.scheduledStart!), day))),
      ),
    [days, scheduled],
  );

  // The visible range opens up to whatever the week actually holds, so no block is ever
  // scheduled outside the grid that shows it.
  const { START_HOUR, END_HOUR } = useMemo(() => {
    const inWeek = perDay.flat().map(({ task }) => task);
    let earliest = DEFAULT_START_HOUR;
    let latest = DEFAULT_END_HOUR;
    for (const t of inWeek) {
      const s = new Date(t.scheduledStart!);
      const e = new Date(t.scheduledEnd!);
      earliest = Math.min(earliest, s.getHours());
      latest = Math.max(latest, e.getHours() + (e.getMinutes() > 0 ? 1 : 0));
    }
    return { START_HOUR: Math.max(0, earliest), END_HOUR: Math.min(24, latest) };
  }, [perDay]);

  const place = (taskId: string, day: Date, hourFloat: number, minutes: number) => {
    const task = state.tasks[taskId];
    if (!task) return;
    const blocked = scheduleBlockedReason(task);
    if (blocked) {
      // Errors state the problem and the fix, with no apology.
      toast(blocked, {
        label: 'Open the task',
        run: () => onOpenTask(task.id),
      });
      return;
    }
    const snapped =
      Math.round((hourFloat * 60) / SNAP_MINUTES) * SNAP_MINUTES;
    const clamped = Math.max(START_HOUR * 60, Math.min(snapped, END_HOUR * 60 - minutes));
    const startIso = atHour(day, Math.floor(clamped / 60), clamped % 60);
    const endIso = new Date(new Date(startIso).getTime() + minutes * 60_000).toISOString();
    dispatch({ type: 'task/schedule', id: task.id, startIso, endIso });
  };

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);
  const todayIndex = days.findIndex((d) => sameDay(d, now));
  const nowOffset =
    todayIndex >= 0
      ? (now.getHours() + now.getMinutes() / 60 - START_HOUR) * HOUR_H
      : -1;

  return (
    <div className="screen screen-wide rise">
      <div className="screen-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)' }}>
          <span className="h3">Week {isoWeek(weekStart)}</span>
          <Mono className="faint">
            {dateRange(weekStart.toISOString(), addDays(weekStart, 6).toISOString())}
          </Mono>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
          <IconButton label="Previous week" small onClick={() => setWeekStart((w) => addDays(w, -7))}>
            <ChevronLeft size={20} {...ICON} />
          </IconButton>
          <Button variant="ghost" size="sm" onClick={() => setWeekStart(startOfWeek(now))}>
            Today
          </Button>
          <IconButton label="Next week" small onClick={() => setWeekStart((w) => addDays(w, 7))}>
            <ChevronRight size={20} {...ICON} />
          </IconButton>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 268px',
          gap: 'var(--sp-6)',
          alignItems: 'start',
        }}
        className="home-columns"
      >
        <div className="cal-scroll">
          <div className="cal" style={{ '--cal-hour-h': `${HOUR_H}px` } as React.CSSProperties}>
            <div className="cal-head">
              <div />
              {days.map((d, i) => (
                <div key={d.toISOString()} className={`cal-day-head ${i === todayIndex ? 'today' : ''}`}>
                  <Eyebrow>
                    {weekdayShort(d)} {absDateShort(d).slice(0, 2)}
                  </Eyebrow>
                </div>
              ))}
            </div>

            <div className="cal-grid">
              <div className="cal-hours">
                {hours.map((h) => (
                  <div key={h} className="cal-hour">
                    {String(h).padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {days.map((day, colIndex) => (
                <div
                  key={day.toISOString()}
                  className={`cal-col ${colIndex === todayIndex ? 'today' : ''} ${
                    dropCol === colIndex ? 'drop' : ''
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDropCol(colIndex);
                  }}
                  onDragLeave={() => setDropCol((c) => (c === colIndex ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDropCol(null);
                    const raw = e.dataTransfer.getData('text/runway-task');
                    if (!raw) return;
                    const { id, minutes } = JSON.parse(raw) as { id: string; minutes: number };
                    const rect = e.currentTarget.getBoundingClientRect();
                    const hourFloat = START_HOUR + (e.clientY - rect.top) / HOUR_H;
                    place(id, day, hourFloat, minutes);
                    setDragging(null);
                  }}
                >
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="cal-slot"
                      onDoubleClick={() => {
                        // Double-click an empty slot to place the first unscheduled task.
                        const candidate = unscheduled.find((t) => t.dueAt);
                        if (candidate) place(candidate.id, day, h, 60);
                      }}
                    />
                  ))}

                  {perDay[colIndex].map(({ task, lane, lanes }) => {
                    const start = new Date(task.scheduledStart!);
                    const end = new Date(task.scheduledEnd!);
                    const top =
                      (start.getHours() + start.getMinutes() / 60 - START_HOUR) * HOUR_H;
                    const height = Math.max(
                      26,
                      ((end.getTime() - start.getTime()) / 3_600_000) * HOUR_H - 4,
                    );
                    const widthPct = 100 / lanes;
                    return (
                      <button
                        key={task.id}
                        className={`cal-block ${task.ownerId === me.id ? 'mine' : ''} ${
                          task.completedAt ? 'done' : ''
                        } ${dragging?.id === task.id ? 'dragging' : ''}`}
                        style={{
                          top: top + 2,
                          height,
                          left: `calc(${lane * widthPct}% + 4px)`,
                          width: `calc(${widthPct}% - 8px)`,
                        }}
                        draggable
                        onDragStart={(e) => {
                          const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
                          e.dataTransfer.setData(
                            'text/runway-task',
                            JSON.stringify({ id: task.id, minutes }),
                          );
                          e.dataTransfer.effectAllowed = 'move';
                          setDragging({ id: task.id, minutes });
                        }}
                        onDragEnd={() => setDragging(null)}
                        onClick={() => onOpenTask(task.id)}
                      >
                        {/* The folder tab is what gives a block its edge on this surface,
                            and it carries the same status tone as the task's row. */}
                        {task.ownerId !== me.id && (
                          <span
                            className={`folder-tab folder-tab--narrow tab-${STATUS_TONE[derivedStatus(task, now)]}`}
                            style={{ left: 12 }}
                          />
                        )}
                        <span className="cal-block-title">{task.title}</span>
                        <span className="cal-block-time">
                          {clockRange(task.scheduledStart!, task.scheduledEnd!)}
                        </span>
                      </button>
                    );
                  })}

                  {colIndex === todayIndex && nowOffset > 0 && (
                    <div className="now-line" style={{ top: nowOffset }} aria-hidden="true" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Everything you own that has no block yet. A task without a due date cannot be
            placed on the calendar at all. §2.2 */}
        <Card>
          <div className="card-head" style={{ marginBottom: 'var(--sp-5)' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              <Eyebrow>Not on the calendar</Eyebrow>
              <span className="h3">{unscheduled.length}</span>
            </div>
          </div>
          {unscheduled.length === 0 ? (
            <EmptyState
              icon={<CalendarOff size={24} {...ICON} />}
              line="Everything you own has a place in the week."
            />
          ) : (
            <div className="tray">
              {unscheduled.map((t) => (
                <div
                  key={t.id}
                  className="tray-item"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(
                      'text/runway-task',
                      JSON.stringify({ id: t.id, minutes: 60 }),
                    );
                    setDragging({ id: t.id, minutes: 60 });
                  }}
                  onDragEnd={() => setDragging(null)}
                  onClick={() => onOpenTask(t.id)}
                >
                  <span className={`dot dot-${t.dueAt ? 'due' : 'idle'}`} />
                  <span className="row-main">
                    <span className="row-title">{t.title}</span>
                    <span className="row-sub">
                      {t.dueAt ? `Due ${absDateShort(t.dueAt)}` : 'Needs a due date first'}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
          <p className="caption" style={{ marginTop: 'var(--sp-6)' }}>
            Drag a task onto the week to schedule it. Drag a block to move it.
          </p>
        </Card>
      </div>

      {scheduled.length === 0 && (
        <Card>
          <EmptyState
            icon={<Inbox size={24} {...ICON} />}
            line="Nothing is on the calendar this week. Drag something across from the unscheduled list."
          />
        </Card>
      )}
    </div>
  );
}
