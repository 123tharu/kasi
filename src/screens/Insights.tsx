import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bar as RBar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { useStore } from '../data/store'
import { fmt, fmtShort, pct } from '../lib/money'
import { cycleFor, weekFor, yearFor, type Period } from '../lib/period'
import { byCategory, byDay, topMerchants, totals, type CatTotal } from '../lib/stats'
import { Bar, CatIcon, Card, cx, IconButton, Money, PageTitle, Segmented, SectionTitle } from '../ui/ui'

type Span = 'cycle' | 'week' | 'year'

// Validated categorical order (dark). Segments are drawn in this order so neighbours stay distinguishable.
const SLOT_ORDER = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']
const OTHER = '#55555c'

function DonutTip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; icon: string; total: number; share: number } }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-line bg-[#141415] px-3 py-2 text-sm shadow-xl">
      <div className="font-semibold">
        {p.icon} {p.name}
      </div>
      <div className="num text-muted">
        {fmt(p.total)} · {pct(p.share * 100, 0)}
      </div>
    </div>
  )
}

function DayTip({ active, payload }: { active?: boolean; payload?: { payload: { date: string; total: number } }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  return (
    <div className="rounded-xl border border-line bg-[#141415] px-3 py-2 text-sm shadow-xl">
      <div className="text-muted">{new Date(p.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</div>
      <div className="num font-semibold">{fmt(p.total)}</div>
    </div>
  )
}

export function Insights() {
  const { db, cats } = useStore()
  const nav = useNavigate()
  const [span, setSpan] = useState<Span>('cycle')
  const [offset, setOffset] = useState(0)
  const [kind, setKind] = useState<'spend' | 'income'>('spend')

  const period: Period = useMemo(() => {
    if (span === 'week') return weekFor(new Date(), offset)
    if (span === 'year') return yearFor(new Date(), offset)
    return cycleFor(db.settings!.payday_day, new Date(), offset)
  }, [span, offset, db.settings])
  const prev: Period = useMemo(() => {
    if (span === 'week') return weekFor(new Date(), offset - 1)
    if (span === 'year') return yearFor(new Date(), offset - 1)
    return cycleFor(db.settings!.payday_day, new Date(), offset - 1)
  }, [span, offset, db.settings])

  const t = useMemo(() => totals(db.transactions, cats, period), [db.transactions, cats, period])
  const tp = useMemo(() => totals(db.transactions, cats, prev), [db.transactions, cats, prev])
  const list = useMemo(() => byCategory(db.transactions, cats, period, kind), [db.transactions, cats, period, kind])
  const prevList = useMemo(() => byCategory(db.transactions, cats, prev, kind), [db.transactions, cats, prev, kind])
  const days = useMemo(() => byDay(db.transactions, cats, period), [db.transactions, cats, period])
  const merchants = useMemo(() => topMerchants(db.transactions, cats, period, 6), [db.transactions, cats, period])
  const total = kind === 'spend' ? t.spent : t.income

  const donut = useMemo(() => {
    const top = list.slice(0, 5)
    const rest = list.slice(5).reduce((a, b) => a + b.total, 0)
    const rows = top
      .map((c) => ({ name: c.category?.name ?? 'Uncategorised', icon: c.category?.icon ?? '❔', total: c.total, share: total ? c.total / total : 0, color: c.category?.color ?? OTHER }))
      .sort((a, b) => slot(a.color) - slot(b.color))
    if (rest > 0) rows.push({ name: 'Everything else', icon: '•••', total: rest, share: total ? rest / total : 0, color: OTHER })
    return rows
  }, [list, total])

  const change = tp.spent ? ((t.spent - tp.spent) / tp.spent) * 100 : null
  const avgDay = days.length ? t.spent / days.length : 0
  const maxCat = list[0]?.total ?? 0

  return (
    <div>
      <PageTitle title="Insights" sub="Where your money actually goes" />

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          className="min-w-[240px] flex-1 md:flex-none"
          value={span}
          onChange={(v) => {
            setSpan(v)
            setOffset(0)
          }}
          options={[
            { value: 'week', label: 'Week' },
            { value: 'cycle', label: 'Month' },
            { value: 'year', label: 'Year' },
          ]}
        />
        <div className="flex flex-1 items-center justify-between rounded-full bg-card2 p-1 md:flex-none">
          <IconButton onClick={() => setOffset(offset - 1)} aria-label="Previous">
            <ChevronLeft size={20} />
          </IconButton>
          <div className="min-w-[150px] px-2 text-center text-sm font-semibold">{period.label}</div>
          <IconButton onClick={() => setOffset(offset + 1)} disabled={offset >= 0} className="disabled:opacity-25" aria-label="Next">
            <ChevronRight size={20} />
          </IconButton>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted">Spent</div>
          <div className="mt-1 text-lg font-semibold num md:text-2xl">{fmtShort(t.spent)}</div>
          {change !== null && (
            <div className={cx('mt-1 text-xs', change > 0 ? 'text-bad' : 'text-kiwi')}>
              {change > 0 ? '↑' : '↓'} {pct(Math.abs(change), 0)} vs last
            </div>
          )}
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted">Came in</div>
          <div className="mt-1 text-lg font-semibold text-kiwi num md:text-2xl">{fmtShort(t.income)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted">Saved</div>
          <div className={cx('mt-1 text-lg font-semibold num md:text-2xl', t.net < 0 && 'text-bad')}>{fmtShort(t.net)}</div>
          {t.income > 0 && <div className="mt-1 text-xs text-muted">{pct((t.net / t.income) * 100, 0)} of income</div>}
        </Card>
      </div>

      <div className="mt-4 grid items-start gap-4 md:grid-cols-[1fr_1.1fr]">
        <Card className="p-5 md:sticky md:top-6">
          <Segmented
            value={kind}
            onChange={setKind}
            options={[
              { value: 'spend', label: 'Spending' },
              { value: 'income', label: 'Income' },
            ]}
          />
          {total > 0 ? (
            <div className="relative mx-auto mt-2 h-[260px] max-w-[300px]">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={donut} dataKey="total" innerRadius="62%" outerRadius="96%" startAngle={90} endAngle={-270} stroke="#19191b" strokeWidth={2} cornerRadius={4} isAnimationActive={false}>
                    {donut.map((d, i) => (
                      <Cell key={i} fill={d.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<DonutTip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-xs text-muted">{kind === 'spend' ? 'Total spent' : 'Total in'}</div>
                <Money value={total} className="text-xl font-bold" />
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-sm text-muted">Nothing {kind === 'spend' ? 'spent' : 'received'} in this period.</div>
          )}
        </Card>

        <Card className="p-3">
          {list.map((c) => (
            <CatLine key={c.id} c={c} total={total} max={maxCat} prev={prevList.find((p) => p.id === c.id)?.total ?? 0} onClick={() => nav(`/timeline?category=${c.category?.id ?? 'none'}`)} />
          ))}
          {!list.length && <div className="p-6 text-center text-sm text-muted">No categories yet.</div>}
        </Card>
      </div>

      {kind === 'spend' && (
        <>
          <SectionTitle right={<span className="text-sm text-muted">avg {fmt(avgDay, { cents: false })}/day</span>}>Day by day</SectionTitle>
          <Card className="p-4">
            <div className="h-[180px]">
              <ResponsiveContainer>
                <BarChart data={days} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barCategoryGap={days.length > 40 ? 1 : 2}>
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: '#2b2b2f' }} tick={{ fill: '#66666d', fontSize: 11 }} interval={days.length > 40 ? 30 : days.length > 10 ? 4 : 0} />
                  <Tooltip content={<DayTip />} cursor={{ fill: '#ffffff0a' }} />
                  <RBar dataKey="total" fill="#86d16f" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <SectionTitle>Top merchants</SectionTitle>
          <Card className="p-2">
            {merchants.map((m, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2.5">
                <CatIcon cat={m.category_id ? cats.get(m.category_id) : null} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{m.name}</div>
                  <div className="text-xs text-muted">{m.count} time{m.count > 1 ? 's' : ''}</div>
                </div>
                <Money value={m.total} className="font-semibold" />
              </div>
            ))}
            {!merchants.length && <div className="p-6 text-center text-sm text-muted">No spending in this period.</div>}
          </Card>
        </>
      )}
    </div>
  )
}

function slot(color: string) {
  const i = SLOT_ORDER.indexOf(color.toLowerCase())
  return i < 0 ? 99 : i
}

function CatLine({ c, total, max, prev, onClick }: { c: CatTotal; total: number; max: number; prev: number; onClick: () => void }) {
  const diff = prev ? ((c.total - prev) / prev) * 100 : null
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-card2/60">
      <CatIcon cat={c.category} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <div className="truncate text-[15px] font-semibold">{c.category?.name ?? 'Uncategorised'}</div>
          <Money value={c.total} className="text-[15px] font-semibold" />
        </div>
        <div className="mt-1.5 flex items-center gap-2">
          <Bar value={c.total} max={max} color={c.category?.color ?? OTHER} className="flex-1" />
          <div className="w-24 text-right text-xs text-muted num">
            {pct(total ? (c.total / total) * 100 : 0, 0)}
            {diff !== null && Math.abs(diff) >= 1 && <span className={diff > 0 ? 'text-bad' : 'text-kiwi'}> {diff > 0 ? '↑' : '↓'}{Math.abs(diff).toFixed(0)}%</span>}
          </div>
        </div>
      </div>
    </button>
  )
}
