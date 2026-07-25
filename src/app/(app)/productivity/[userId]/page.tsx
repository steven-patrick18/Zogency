// Per-member productivity drill-down: everything collected for one day —
// agent screen-time (hourly active/idle, app usage) + CRM signals (audit
// actions, calls, tasks) + attendance punch. Reached by clicking a row on
// /productivity. ?date=YYYY-MM-DD selects the day (default today).
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requirePermission, withTenant } from '@/lib/authz'
import { getMemberActivityDetail } from '@/modules/productivity/service'

function fmtMin(min: number): string {
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h ${min % 60}m`
}

function fmtTime(d: Date | null): string {
  return d ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—'
}

// Humanize audit actions: "lead.status_change" → "Lead · status change".
function humanize(action: string): string {
  const [entity, ...rest] = action.split('.')
  const verb = rest.join('.').replace(/_/g, ' ')
  return `${entity.charAt(0).toUpperCase()}${entity.slice(1)} · ${verb || action}`
}

export default async function MemberProductivityPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ date?: string; hour?: string; app?: string }>
}) {
  const session = await requirePermission('reports.view')
  const canDeep = session.user.permissions.includes('monitoring.deep')
  const { userId } = await params
  const { date, hour: hourParam, app: appParam } = await searchParams
  const hourFilter = hourParam !== undefined && /^\d+$/.test(hourParam) ? Number(hourParam) : null
  const appFilter = appParam || null

  // Selected day at local midnight (default today); clamp bad input to today.
  const parsed = date ? new Date(date) : new Date()
  const day = Number.isNaN(parsed.getTime()) ? new Date() : parsed
  day.setHours(0, 0, 0, 0)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const prev = new Date(day.getTime() - 86_400_000)
  const next = new Date(day.getTime() + 86_400_000)
  const isToday = iso(day) === iso(new Date())

  const detail = await withTenant(() => getMemberActivityDetail(userId, day, canDeep))
  if (!detail) notFound()

  const maxHourTotal = Math.max(1, ...detail.hours.map((h) => h.activeMin + h.idleMin))
  const totalAppMin = Math.max(1, detail.apps.reduce((s, a) => s + a.minutes, 0))

  // Deep-monitoring filters (clickable hour bars / app rows).
  const base = `/productivity/${userId}?date=${iso(day)}`
  const withFilter = (h: number | null, a: string | null) =>
    `${base}${h !== null ? `&hour=${h}` : ''}${a ? `&app=${encodeURIComponent(a)}` : ''}`
  const matches = (at: Date, app: string | null) =>
    (hourFilter === null || at.getHours() === hourFilter) &&
    (appFilter === null || (app ?? '') === appFilter)
  const titles = detail.titles.filter((t) => matches(t.at, t.app))
  const screenshots = detail.screenshots.filter((s) => matches(s.at, s.app))
  const filtered = hourFilter !== null || appFilter !== null

  return (
    <div className="max-w-5xl">
      <Link href="/productivity" className="text-sm text-indigo-600 hover:underline">
        ← Productivity
      </Link>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{detail.name}</h1>
          <p className="text-sm text-slate-500">
            {detail.designation ?? '—'}
            {detail.department ? ` · ${detail.department}` : ''}
            {detail.agentIssued && (
              <span className="ml-2 rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                agent token issued
              </span>
            )}
          </p>
        </div>
        {/* Day navigation */}
        <div className="flex items-center gap-2 text-sm">
          <Link href={`/productivity/${userId}?date=${iso(prev)}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-100">
            ← {iso(prev)}
          </Link>
          <span className="font-semibold text-slate-900">{day.toDateString()}</span>
          {!isToday && (
            <Link href={`/productivity/${userId}?date=${iso(next)}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-600 hover:bg-slate-100">
              {iso(next)} →
            </Link>
          )}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          ['Active', detail.hasPings ? fmtMin(detail.activeMin) : '—'],
          ['Idle', detail.hasPings ? fmtMin(detail.idleMin) : '—'],
          ['First seen', fmtTime(detail.firstPingAt)],
          ['Last seen', fmtTime(detail.lastPingAt)],
          ['CRM actions', String(detail.actions)],
          ['Calls', String(detail.callCount)],
          ['Tasks done', String(detail.tasksDone)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-0.5 text-lg font-semibold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {detail.punch && (
        <p className="mt-3 text-sm text-slate-500">
          Attendance: punched in {fmtTime(detail.punch.inAt)}
          {detail.punch.outAt ? `, out ${fmtTime(detail.punch.outAt)}` : ' (not punched out)'} ·{' '}
          <span className="uppercase">{detail.punch.mode}</span>
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Hourly screen-time timeline */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">Screen-time by hour</h2>
          <p className="text-xs text-slate-400">From the desktop agent — green active, amber idle.</p>
          {detail.hours.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No agent data for this day{detail.agentIssued ? '.' : ' — no agent token issued yet (HR profile → Issue agent token).'}
            </p>
          ) : (
            <div className="mt-4 space-y-1.5">
              {detail.hours.map((h) => (
                <Link
                  key={h.hour}
                  href={withFilter(hourFilter === h.hour ? null : h.hour, appFilter)}
                  className={`flex items-center gap-2 rounded text-xs hover:bg-slate-50 ${hourFilter === h.hour ? 'bg-indigo-50 ring-1 ring-indigo-200' : ''}`}
                  title="Filter titles & screenshots to this hour"
                >
                  <span className="w-12 text-right font-mono text-slate-500">
                    {String(h.hour).padStart(2, '0')}:00
                  </span>
                  <div className="flex h-4 flex-1 overflow-hidden rounded bg-slate-100">
                    <div className="bg-emerald-500" style={{ width: `${(h.activeMin / maxHourTotal) * 100}%` }} />
                    <div className="bg-amber-400" style={{ width: `${(h.idleMin / maxHourTotal) * 100}%` }} />
                  </div>
                  <span className="w-24 text-slate-500">
                    {h.activeMin}m active{h.idleMin > 0 ? ` · ${h.idleMin}m idle` : ''}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* App usage */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">App usage</h2>
          <p className="text-xs text-slate-400">Foreground app per agent sample (no content is captured).</p>
          {detail.apps.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No app data for this day.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {detail.apps.map((a) => (
                <li key={a.app}>
                  <Link
                    href={withFilter(hourFilter, appFilter === a.app ? null : a.app)}
                    className={`flex items-center gap-2 rounded text-sm hover:bg-slate-50 ${appFilter === a.app ? 'bg-indigo-50 ring-1 ring-indigo-200' : ''}`}
                    title="Filter titles & screenshots to this app"
                  >
                    <span className="w-40 truncate text-slate-700">{a.app}</span>
                    <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
                      <div className="h-3 rounded bg-indigo-500" style={{ width: `${(a.minutes / totalAppMin) * 100}%` }} />
                    </div>
                    <span className="w-16 text-right text-xs text-slate-500">{fmtMin(a.minutes)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Deep monitoring: window titles + screenshots (monitoring.deep only). */}
        {canDeep && (
          <div className="rounded-xl border border-slate-200 bg-white p-5 lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-semibold text-slate-900">Deep monitoring</h2>
                <p className="text-xs text-slate-400">
                  Window titles, browser URLs (where the OS exposes them) and periodic screenshots from the
                  agent — for reviewing whether company data is being taken outside approved tools. The
                  screenshots capture the on-screen address bar, so you can see the exact URL even on Windows.
                  Captured with signed employee consent; screenshots are kept 14 days.
                </p>
              </div>
              {filtered && (
                <Link href={base} className="rounded-lg border border-indigo-300 px-3 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
                  Filter: {hourFilter !== null ? `${String(hourFilter).padStart(2, '0')}:00 ` : ''}
                  {appFilter ?? ''} ✕ clear
                </Link>
              )}
            </div>

            <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Window-title trail */}
              <div>
                <h3 className="text-sm font-medium text-slate-700">Window titles ({titles.length})</h3>
                {titles.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">No window titles captured{filtered ? ' for this filter' : ' this day'}.</p>
                ) : (
                  <ul className="mt-2 max-h-96 space-y-1 overflow-y-auto text-sm">
                    {titles.map((t, i) => (
                      <li key={i} className="rounded-lg bg-slate-50 px-3 py-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-slate-700" title={t.title}>{t.title}</span>
                          <span className="shrink-0 font-mono text-xs text-slate-400">{fmtTime(t.at)}</span>
                        </div>
                        {t.url ? (
                          <a href={t.url} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-indigo-500 hover:underline" title={t.url}>
                            {t.url}
                          </a>
                        ) : (
                          t.app && <span className="text-[11px] text-slate-400">{t.app}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Screenshot gallery */}
              <div>
                <h3 className="text-sm font-medium text-slate-700">Screenshots ({screenshots.length})</h3>
                {screenshots.length === 0 ? (
                  <p className="mt-2 text-sm text-slate-400">No screenshots captured{filtered ? ' for this filter' : ' this day'}.</p>
                ) : (
                  <div className="mt-2 grid max-h-96 grid-cols-2 gap-2 overflow-y-auto">
                    {screenshots.map((s) => (
                      <a
                        key={s.id}
                        href={`/api/monitoring/screenshot/${s.id}`}
                        target="_blank"
                        className="group relative overflow-hidden rounded-lg border border-slate-200"
                        title="Open full size"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={s.image} alt={`Screen at ${fmtTime(s.at)}`} className="w-full" />
                        <span className="absolute bottom-0 left-0 right-0 bg-slate-900/70 px-2 py-0.5 text-[11px] text-white">
                          {fmtTime(s.at)}{s.app ? ` · ${s.app}` : ''}
                        </span>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* CRM activity feed */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-900">CRM activity</h2>
          <p className="text-xs text-slate-400">Every audited action this member performed.</p>
          {detail.auditTrail.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No CRM actions this day.</p>
          ) : (
            <ul className="mt-3 max-h-96 space-y-1.5 overflow-y-auto text-sm">
              {detail.auditTrail.map((a, i) => (
                <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                  <span className="text-slate-700">{humanize(a.action)}</span>
                  <span className="font-mono text-xs text-slate-400">{fmtTime(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Calls + tasks */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Calls</h2>
            {detail.calls.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No calls this day.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {detail.calls.map((c, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                    <span className="text-slate-700">
                      {c.direction === 'inbound' ? '↓' : '↑'} {c.leadName}
                      {c.disposition && <span className="text-xs text-slate-400"> · {c.disposition}</span>}
                    </span>
                    <span className="font-mono text-xs text-slate-400">
                      {c.durationSec ? `${Math.round(c.durationSec / 60)}m · ` : ''}
                      {fmtTime(c.at)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="font-semibold text-slate-900">Tasks completed</h2>
            {detail.completedTasks.length === 0 ? (
              <p className="mt-3 text-sm text-slate-400">No tasks completed this day.</p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {detail.completedTasks.map((t, i) => (
                  <li key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5">
                    <span className="text-slate-700">✓ {t.title}</span>
                    <span className="font-mono text-xs text-slate-400">{fmtTime(t.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
