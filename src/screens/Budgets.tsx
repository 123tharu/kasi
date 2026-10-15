import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { fmt, fmtShort, parseAmount } from '../lib/money'
import { cycleFor, daysLeft, inPeriod, weekFor, yearFor, type Period } from '../lib/period'
import { byCategory, isSpend } from '../lib/stats'
import type { Budget } from '../lib/types'
import { BackLink } from './More'
import { Bar, Button, Card, cx, Empty, Field, Input, Money, PageTitle, Segmented, Sheet, Toggle } from '../ui/ui'

export function periodOf(b: Budget, payday: number, offset = 0): Period {
  return b.period === 'week' ? weekFor(new Date(), offset) : b.period === 'year' ? yearFor(new Date(), offset) : cycleFor(payday, new Date(), offset)
}

export function Budgets() {
  const { db, cats, insert } = useStore()
  const nav = useNavigate()
  const [edit, setEdit] = useState<Budget | null>(null)
  const [adding, setAdding] = useState(false)
  const payday = db.settings!.payday_day
  const budgets = db.budgets.filter((b) => b.active)
  const paused = db.budgets.filter((b) => !b.active)

  const spentFor = (b: Budget) => {
    const p = periodOf(b, payday)
    const ids = new Set(b.category_ids)
    return db.transactions.filter((t) => isSpend(t, cats) && t.category_id && ids.has(t.category_id) && inPeriod(t.occurred_at, p)).reduce((a, t) => a + t.amount, 0)
  }

  const totalBudget = budgets.filter((b) => b.period === 'cycle').reduce((a, b) => a + b.amount, 0)
  const totalSpent = budgets.filter((b) => b.period === 'cycle').reduce((a, b) => a + spentFor(b), 0)
  const cycle = cycleFor(payday)

  async function suggest() {
    const last = cycleFor(payday, new Date(), -1)
    const top = byCategory(db.transactions, cats, last).filter((c) => c.category && c.category.kind === 'expense' && !db.budgets.some((b) => b.category_ids.includes(c.id)))
    const rows = top.slice(0, 6).map((c) => ({ name: c.category!.name, amount: Math.ceil((c.total * 1.05) / 1000) * 1000, category_ids: [c.id], period: 'cycle' as const }))
    if (rows.length) await insert('budgets', rows)
  }

  return (
    <div>
      <BackLink />
      <PageTitle
        title="Budgets"
        sub={`${cycle.label} · ${daysLeft(cycle)} days left`}
        right={
          <Button variant="soft" className="py-2.5" onClick={() => setAdding(true)}>
            <Plus size={18} /> New
          </Button>
        }
      />
      {totalBudget > 0 && (
        <Card className="mb-4 p-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm text-muted">{totalSpent > totalBudget ? 'Over budget this month by' : 'Left to spend this month'}</div>
              <Money value={Math.abs(totalBudget - totalSpent)} className={cx('text-3xl font-bold', totalSpent > totalBudget && 'text-bad')} cents={false} />
            </div>
            <div className="text-right text-sm text-muted">
              {daysLeft(cycle) > 0 && totalBudget > totalSpent && <div className="num">≈ {fmt((totalBudget - totalSpent) / daysLeft(cycle), { cents: false })} / day</div>}
              <div className="num">
                {fmtShort(totalSpent)} of {fmtShort(totalBudget)}
              </div>
            </div>
          </div>
          <Bar value={totalSpent} max={totalBudget} className="mt-4 h-2.5" color={totalSpent > totalBudget ? 'var(--color-bad)' : undefined} />
        </Card>
      )}

      {!budgets.length && (
        <Empty icon="🎯" title="No budgets yet">
          Set a limit for a category and watch it fill up as your bank texts you.
          <div className="mt-5 flex justify-center gap-2">
            <Button variant="soft" onClick={suggest}>
              <Sparkles size={16} /> Suggest from last month
            </Button>
          </div>
        </Empty>
      )}

      <div className="grid gap-3 md:grid-cols-2">
        {budgets.map((b) => {
          const spent = spentFor(b)
          const p = periodOf(b, payday)
          const left = b.amount - spent
          const over = left < 0
          const ratio = spent / b.amount
          const first = b.category_ids.map((id) => cats.get(id)).filter(Boolean)
          return (
            <Card key={b.id} className="p-4" onClick={() => setEdit(b)}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-xl">{first[0]?.icon ?? '🎯'}</span>
                  <div className="min-w-0">
                    <div className="truncate font-semibold">{b.name}</div>
                    <div className="truncate text-xs text-muted">
                      {b.period === 'week' ? 'Weekly' : b.period === 'year' ? 'Yearly' : 'Monthly'} · {first.map((c) => c!.name).join(', ')}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={cx('text-sm font-semibold num', over ? 'text-bad' : ratio > 0.85 ? 'text-warn' : 'text-ink')}>{over ? `${fmt(-left, { cents: false })} over` : `${fmt(left, { cents: false })} left`}</div>
                  <div className="text-xs text-muted num">of {fmt(b.amount, { cents: false })}</div>
                </div>
              </div>
              <Bar value={spent} max={b.amount} className="mt-3" color={over ? 'var(--color-bad)' : ratio > 0.85 ? 'var(--color-warn)' : undefined} />
              <div className="mt-1.5 flex justify-between text-[11px] text-faint">
                <span className="num">{fmt(spent, { cents: false })} spent</span>
                <button
                  className="hover:text-ink"
                  onClick={(e) => {
                    e.stopPropagation()
                    nav(`/timeline?category=${b.category_ids[0] ?? ''}`)
                  }}
                >
                  {daysLeft(p)} days left →
                </button>
              </div>
            </Card>
          )
        })}
      </div>
      {budgets.length > 0 && (
        <button onClick={suggest} className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
          <Sparkles size={14} /> Suggest budgets for other categories
        </button>
      )}
      {paused.length > 0 && (
        <div className="mt-6">
          <div className="mb-2 text-sm text-muted">Paused</div>
          {paused.map((b) => (
            <button key={b.id} onClick={() => setEdit(b)} className="mr-2 mt-2 rounded-full border border-line px-4 py-1.5 text-sm text-muted">
              {b.name}
            </button>
          ))}
        </div>
      )}
      <BudgetEditor b={edit} open={!!edit || adding} onClose={() => (setEdit(null), setAdding(false))} />
    </div>
  )
}

function BudgetEditor({ b, open, onClose }: { b: Budget | null; open: boolean; onClose: () => void }) {
  const { db, insert, update, remove, toast } = useStore()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState<Budget['period']>('cycle')
  const [ids, setIds] = useState<string[]>([])
  const [active, setActive] = useState(true)
  useEffect(() => {
    if (!open) return
    setName(b?.name ?? '')
    setAmount(b ? String(b.amount) : '')
    setPeriod(b?.period ?? 'cycle')
    setIds(b?.category_ids ?? [])
    setActive(b?.active ?? true)
  }, [open, b])
  const expense = useMemo(() => db.categories.filter((c) => c.kind === 'expense' && !c.archived), [db.categories])

  async function save() {
    const amt = parseAmount(amount)
    if (!amt || !ids.length) return toast('Pick at least one category and an amount')
    const row = { name: name.trim() || db.categories.find((c) => c.id === ids[0])!.name, amount: amt, period, category_ids: ids, active }
    if (b) await update('budgets', b.id, row)
    else await insert('budgets', [row])
    onClose()
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={b ? 'Edit budget' : 'New budget'}
      footer={
        <div className="flex gap-2">
          {b && (
            <Button variant="danger" onClick={async () => (await remove('budgets', b.id), onClose())} aria-label="Delete">
              <Trash2 size={18} />
            </Button>
          )}
          <Button className="flex-1" onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Limit">
          <Input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Rs. 30,000" autoFocus={!b} />
        </Field>
        <Field label="Resets every">
          <Segmented
            value={period}
            onChange={setPeriod}
            options={[
              { value: 'week', label: 'Week' },
              { value: 'cycle', label: 'Month (payday)' },
              { value: 'year', label: 'Year' },
            ]}
          />
        </Field>
        <Field label="Categories">
          <div className="flex flex-wrap gap-2">
            {expense.map((c) => {
              const on = ids.includes(c.id)
              return (
                <button key={c.id} type="button" onClick={() => setIds(on ? ids.filter((x) => x !== c.id) : [...ids, c.id])} className={cx('rounded-full border px-3 py-1.5 text-sm', on ? 'border-kiwi bg-kiwi-deep text-ink' : 'border-line text-muted')}>
                  {c.icon} {c.name}
                </button>
              )
            })}
          </div>
        </Field>
        <Field label="Name (optional)">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Eating out" />
        </Field>
        {b && <Toggle checked={active} onChange={setActive} label="Active" />}
      </div>
    </Sheet>
  )
}
