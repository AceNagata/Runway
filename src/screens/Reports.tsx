import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BarChart3 } from 'lucide-react';
import { Avatar, Button, Card, EmptyState, Eyebrow, ICON, Mono, Select, Tabs } from '../components/ui';
import { Gauge, LoadBar, Sparkline } from '../components/ui/Charts';
import { useStore } from '../store/StoreContext';
import { subtree } from '../domain/org';
import { measure, pct, subjectUserIds, type Subject } from '../domain/reports';
import { absDateShort, addDays, dateRange, startOfDay, weekdayShort } from '../lib/time';

/** Generated on demand over a chosen range and subject: yourself, one report, or your whole
 *  subtree. Access follows the same tree rule as hand-off. Every measure is derived from
 *  task history and computed client-side, so the personal case is instant. §5 */
export function Reports({ now }: { now: Date }) {
  const { state, me } = useStore();
  const [params, setParams] = useSearchParams();
  const [days, setDays] = useState(30);
  const personParam = params.get('person');

  const [subject, setSubject] = useState<Subject>(
    personParam ? { kind: 'person', userId: personParam } : { kind: 'self' },
  );

  const team = subtree(state, me.id);
  const reports = team.filter((u) => u.id !== me.id);

  const { from, to } = useMemo(
    () => ({ from: startOfDay(addDays(now, -(days - 1))), to: now }),
    [now, days],
  );

  const userIds = useMemo(() => subjectUserIds(state, me.id, subject), [state, me.id, subject]);
  const m = useMemo(() => measure(state, userIds, from, to, now), [state, userIds, from, to, now]);

  // Current open load per folder, so the range view says where the work is sitting.
  const byFolder = useMemo(() => {
    const counts = new Map<string, number>();
    for (const t of Object.values(state.tasks)) {
      if (!userIds.has(t.ownerId) || t.completedAt) continue;
      const key = t.folderId ?? 'none';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const rows = [...counts.entries()]
      .map(([key, count]) => ({
        key,
        label: key === 'none' ? 'No folder' : (state.folders[key]?.name ?? 'No folder'),
        count,
      }))
      .sort((a, b) => b.count - a.count);
    return { rows, max: Math.max(...rows.map((r) => r.count), 1) };
  }, [state, userIds]);

  const subjectLabel =
    subject.kind === 'self'
      ? 'You'
      : subject.kind === 'subtree'
        ? 'Your whole team'
        : (state.users[subject.userId]?.name ?? 'Nobody');

  const empty = m.closed === 0 && m.opened === 0;

  return (
    <div className="screen screen-wide rise">
      <div className="screen-head">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-5)', flexWrap: 'wrap' }}>
          <span className="h3">{subjectLabel}</span>
          <Mono className="faint">{dateRange(from.toISOString(), to.toISOString())}</Mono>
        </div>
        <div style={{ display: 'flex', gap: 'var(--sp-4)', alignItems: 'center' }}>
          <Select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={{ width: 160 }}
            aria-label="Date range"
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </Select>
          {reports.length > 0 && (
            <Select
              value={subject.kind === 'person' ? subject.userId : ''}
              aria-label="One of your reports"
              style={{ width: 190 }}
              onChange={(e) => {
                const v = e.target.value;
                setSubject(v ? { kind: 'person', userId: v } : { kind: 'self' });
                setParams(v ? new URLSearchParams({ person: v }) : new URLSearchParams(), {
                  replace: true,
                });
              }}
            >
              <option value="">Pick one of your team</option>
              {reports.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <Tabs<'self' | 'subtree'>
        value={subject.kind === 'subtree' ? 'subtree' : 'self'}
        onChange={(v) => {
          setSubject(v === 'subtree' ? { kind: 'subtree' } : { kind: 'self' });
          setParams(new URLSearchParams(), { replace: true });
        }}
        items={[
          { value: 'self', label: 'You' },
          { value: 'subtree', label: 'Your whole team', count: team.length },
        ]}
      />

      {empty ? (
        <Card>
          <EmptyState
            icon={<BarChart3 size={24} {...ICON} />}
            line="Nothing to report over this range. Close some work and the numbers follow."
          />
        </Card>
      ) : (
        <>
          <div className="stat-grid">
            <Card tab="done">
              <Eyebrow>Tasks closed</Eyebrow>
              <div className="stat-value" style={{ marginTop: 'var(--sp-5)' }}>
                {m.closed}
              </div>
              <div className="stat-note">
                {(m.closed / Math.max(1, days)).toFixed(1)} a day across {days} days.
              </div>
            </Card>
            <Card tab="accent">
              <Eyebrow>Tasks opened</Eyebrow>
              <div className="stat-value" style={{ marginTop: 'var(--sp-5)' }}>
                {m.opened}
              </div>
              <div className="stat-note">
                {m.closed >= m.opened
                  ? 'You closed at least as much as you took on.'
                  : `${m.opened - m.closed} more than you closed.`}
              </div>
            </Card>
            <Card tab="due">
              <Eyebrow>On time</Eyebrow>
              <div className="stat-value" style={{ marginTop: 'var(--sp-5)' }}>
                {pct(m.onTimeRate)}
              </div>
              <div className="stat-note">
                {m.onTimeClosed} of {m.onTimeEligible} closed before their due time.
              </div>
            </Card>
            <Card tab={m.openLoad.overdue ? 'overdue' : 'idle'}>
              <Eyebrow>Open load</Eyebrow>
              <div className="stat-value" style={{ marginTop: 'var(--sp-5)' }}>
                {m.openLoad.overdue + m.openLoad.due + m.openLoad.unscheduled}
              </div>
              <div style={{ marginTop: 'var(--sp-5)' }}>
                <LoadBar {...m.openLoad} />
              </div>
              <div className="stat-note">
                {m.openLoad.overdue} overdue · {m.openLoad.due} due · {m.openLoad.unscheduled}{' '}
                unscheduled
              </div>
            </Card>
          </div>

          <div
            className="reports-columns"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,260px) minmax(0,1fr)',
              gap: 'var(--sp-6)',
              alignItems: 'stretch',
            }}
          >
            <Card style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-6)' }}>
              <span style={{ alignSelf: 'flex-start' }}>
                <Eyebrow>On-time completion</Eyebrow>
              </span>
              <Gauge rate={m.onTimeRate} caption="on time" />
              <span className="muted" style={{ fontSize: 'var(--fs-sm)', lineHeight: 1.5, textAlign: 'center' }}>
                {m.onTimeEligible === 0
                  ? 'Nothing with a due time closed in this range.'
                  : `${m.onTimeClosed} of ${m.onTimeEligible} tasks closed before their due time.`}
              </span>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--sp-7)' }}>
                <Eyebrow>Tasks closed by day</Eyebrow>
                <Mono className="faint">{m.closed} total</Mono>
              </div>
              <Sparkline
                values={m.byDay.map((d) => d.closed)}
                labels={sparseLabels(m.byDay.map((d) => d.day))}
                height={176}
                ariaLabel={`Tasks closed by day, ${m.closed} in total`}
              />
            </Card>
          </div>

          <div
            className="reports-columns"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)',
              gap: 'var(--sp-6)',
              alignItems: 'start',
            }}
          >
            <Card>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--sp-7)' }}>
                <Eyebrow>Tasks opened by day</Eyebrow>
                <Mono className="faint">{m.opened} total</Mono>
              </div>
              <Sparkline
                values={m.byDay.map((d) => d.opened)}
                labels={sparseLabels(m.byDay.map((d) => d.day))}
                ariaLabel={`Tasks opened by day, ${m.opened} in total`}
              />
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 'var(--sp-7)' }}>
                <Eyebrow>Open work by folder</Eyebrow>
                <Mono className="faint">
                  {m.openLoad.overdue + m.openLoad.due + m.openLoad.unscheduled} open
                </Mono>
              </div>
              {byFolder.rows.length === 0 ? (
                <EmptyState
                  icon={<BarChart3 size={24} {...ICON} />}
                  line="Nothing is open. There is nowhere for it to sit."
                />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
                  {byFolder.rows.map((r) => (
                    <div key={r.key} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-5)' }}>
                        <span className="row-title" style={{ fontSize: 'var(--fs-sm)' }}>
                          {r.label}
                        </span>
                        <Mono className="faint">{r.count}</Mono>
                      </div>
                      <span className="bar-track">
                        <span className="bar-fill" style={{ width: `${(r.count / byFolder.max) * 100}%` }} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Per person is a record of each person's own trend, never a league table. */}
          {subject.kind === 'subtree' && m.perPerson.length > 1 && (
            <Card>
              <div style={{ marginBottom: 'var(--sp-5)' }}>
                <Eyebrow>Each person's own record</Eyebrow>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Person</th>
                    <th>Closed</th>
                    <th>Overdue</th>
                    <th>On time</th>
                  </tr>
                </thead>
                <tbody>
                  {m.perPerson.map((r) => {
                    const u = state.users[r.userId];
                    if (!u) return null;
                    return (
                      <tr key={r.userId}>
                        <td className="cell-name">
                          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)' }}>
                            <Avatar user={u} size="xs" decorative />
                            {u.name}
                          </span>
                        </td>
                        <td>{r.closed}</td>
                        <td className={r.overdue > 0 ? 'tone-overdue' : ''}>{r.overdue}</td>
                        <td>{pct(r.onTimeRate)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}

          <div>
            <Button variant="ghost" size="sm" onClick={() => setDays(days === 7 ? 30 : 7)}>
              {days === 7 ? 'Widen to 30 days' : 'Narrow to 7 days'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

/** Axis labels stay readable by thinning out as the range grows. */
function sparseLabels(days: Date[]): string[] {
  if (days.length <= 8) return days.map((d) => weekdayShort(d));
  const step = Math.ceil(days.length / 7);
  return days.map((d, i) => (i % step === 0 ? absDateShort(d) : ''));
}
