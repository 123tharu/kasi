import { AlertCircle, ChevronRight, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { bankByCode } from '../lib/parser'
import { fmtShort } from '../lib/money'
import { cycleFor, daysLeft, daysUntil, inPeriod, startOfDay } from '../lib/period'
import { byCategory, isSpend, totals } from '../lib/stats'
import { portfolio } from '../lib/invest'
import { TxEditor, TxRow } from '../ui/tx'
import { Bar, Card, cx, Money, SectionTitle } from '../ui/ui'
import type { Account, Transaction } from '../lib/types'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function AccountCard({ a, onClick }: { a: Account; onClick?: () => void }) {
  const bank = bankByCode(a.bank)
  const ago = a.balance_at ? relTime(new Date(a.balance_at)) : null
  return (
    <Card onClick={onClick} className="w-[230px] shrink-0 p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: a.color ?? bank?.color ?? '#444' }}>
          {a.type === 'cash' ? '💵' : (bank?.code ?? a.name).slice(0, 3)}
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{a.name}</div>
          <div className="truncate text-xs text-muted">
            {a.last4 ? `${a.last4.split(',')[0].trim()} · ` : ''}
            {a.type === 'credit' ? 'Credit card' : a.type === 'cash' ? 'Cash' : bank?.name ?? 'Account'}
          </div>
        </div>
      </div>
      <div className="mt-5">
        <Money value={a.balance} className={cx('text-xl font-semibold', a.type === 'credit' && a.balance ? 'text-bad' : '')} />
        <div className="mt-0.5 text-[11px] text-faint">{a.type === 'credit' ? 'owed' : 'balance'}{ago ? ` · ${ago}` : ''}</div>
      </div>
    </Card>
  )
}

export function relTime(d: Date) {
  const m = Math.round((Date.now() - d.getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.round(h / 24)
  return days < 30 ? `${days}d ago` : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function Home() {
  const { db, cats, reviewCount, backend } = useStore()
  const nav = useNavigate()
  const [edit, setEdit] = useState<Transaction | null>(null)
  const [adding, setAdding] = useState(false)
  const s = db.settings!
  const cycle = cycleFor(s.payday_day)
  const today = { start: startOfDay(new Date()), end: new Date(startOfDay(new Date()).getTime() + 86400000), label: 'Today' }

  const t = useMemo(() => totals(db.transactions, cats, cycle), [db.transactions, cats, cycle.start.getTime()])
  const todayTx = useMemo(() => db.transactions.filter((x) => inPeriod(x.occurred_at, today) && isSpend(x, cats)), [db.transactions, cats])
  const todaySpent = todayTx.reduce((a, b) => a + b.amount, 0)
  const todayTop = useMemo(() => byCategory(db.transactions, cats, today)[0], [db.transactions, cats])
  const budgetTotal = db.budgets.filter((b) => b.active && b.period === 'cycle').reduce((a, b) => a + b.amount, 0)
  const budgetSpent = useMemo(() => {
    const ids = new Set(db.budgets.filter((b) => b.active && b.period === 'cycle').flatMap((b) => b.category_ids))
    return db.transactions.filter((x) => isSpend(x, cats) && x.category_id && ids.has(x.category_id) && inPeriod(x.occurred_at, cycle)).reduce((a, b) => a + b.amount, 0)
  }, [db.transactions, db.budgets, cats])
  const upcoming = db.subscriptions.filter((x) => x.active && daysUntil(x.next_date) <= 7 && daysUntil(x.next_date) >= 0).sort((a, b) => a.next_date.localeCompare(b.next_date))
  const accounts = db.accounts.filter((a) => !a.archived)
  const cashLike = accounts.filter((a) => a.type !== 'credit').reduce((x, a) => x + (a.balance ?? 0), 0)
  const owed = accounts.filter((a) => a.type === 'credit').reduce((x, a) => x + (a.balance ?? 0), 0)
  const invest = portfolio(db.investments)
  const netWorth = cashLike - owed + invest.value
  const recent = db.transactions.slice(0, 6)
  const dayName = new Date().toLocaleDateString('en-GB', { weekday: 'long' })
  const busy = todayTx.length >= 5

  return (
    <div>
      <div className="mb-5 flex items-center justify-between pt-2">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted">
            {greeting()},
            {backend.kind === 'demo' && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warn">Demo data</span>}
          </div>
          <h1 className="text-[28px] font-semibold tracking-tight">{s.display_name || 'there'}</h1>
        </div>
        <button onClick={() => setAdding(true)} className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-bg transition active:scale-95 md:hidden" aria-label="Add transaction">
          <Plus size={22} />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Today */}
        <Card className="p-5" onClick={() => nav('/timeline')}>
          <div className="flex items-center justify-between text-[15px]">
            <div className="font-medium">{busy ? '🔥 Busy' : todayTx.length ? '☀️' : '🌱 Quiet'} {dayName}</div>
            <div className="text-muted">{todayTx.length} transaction{todayTx.length === 1 ? '' : 's'}</div>
          </div>
          <div className="mt-6 flex items-end justify-between">
            <div>
              <Money value={todaySpent} cents className="text-[34px] font-bold leading-none" />
              <div className="mt-1.5 text-[15px] text-muted">Spent today</div>
            </div>
            {todayTop?.category && (
              <div className="text-right text-sm text-muted">
                Mostly on <span className="text-2xl">{todayTop.category.icon}</span>
              </div>
            )}
          </div>
        </Card>

        {/* This cycle */}
        <Card className="p-5" onClick={() => nav('/insights')}>
          <div className="flex items-center justify-between text-[15px]">
            <div className="font-medium">This month</div>
            <div className="text-muted">{cycle.label} · {daysLeft(cycle)}d left</div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-muted">Spent</div>
              <Money value={t.spent} className="text-xl font-semibold" />
            </div>
            <div>
              <div className="text-xs text-muted">Came in</div>
              <Money value={t.income} className="text-xl font-semibold text-kiwi" />
            </div>
          </div>
          {budgetTotal > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs text-muted">
                <span>Budgets</span>
                <span className="num">
                  {fmtShort(budgetSpent)} of {fmtShort(budgetTotal)}
                </span>
              </div>
              <Bar value={budgetSpent} max={budgetTotal} color={budgetSpent > budgetTotal ? 'var(--color-bad)' : budgetSpent > budgetTotal * 0.85 ? 'var(--color-warn)' : undefined} />
            </div>
          )}
        </Card>
      </div>

      {(reviewCount > 0 || upcoming.length > 0) && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {reviewCount > 0 && (
            <Link to="/more/review">
              <Card className="flex items-center gap-3 p-4" onClick={() => {}}>
                <AlertCircle className="text-warn" size={22} />
                <div className="flex-1">
                  <div className="text-[15px] font-semibold">{reviewCount} to review</div>
                  <div className="text-xs text-muted">Uncategorised or unclear transactions</div>
                </div>
                <ChevronRight size={18} className="text-faint" />
              </Card>
            </Link>
          )}
          {upcoming.slice(0, reviewCount > 0 ? 1 : 2).map((x) => (
            <Link to="/more/subscriptions" key={x.id}>
              <Card className="flex items-center gap-3 p-4" onClick={() => {}}>
                <span className="text-2xl">{x.icon}</span>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold">
                    {x.name} <span className="font-normal text-muted">→</span> <Money value={x.amount} className="font-normal text-muted" />
                  </div>
                  <div className="text-xs text-muted">{daysUntil(x.next_date) === 0 ? 'Renews today' : `Renews in ${daysUntil(x.next_date)} day${daysUntil(x.next_date) === 1 ? '' : 's'}`}</div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <SectionTitle right={<Link to="/more/accounts" className="text-sm text-muted hover:text-ink">Net worth <Money value={netWorth} className="font-semibold text-ink" /></Link>}>Accounts</SectionTitle>
      <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
        {accounts.map((a) => (
          <AccountCard key={a.id} a={a} onClick={() => nav('/more/accounts')} />
        ))}
      </div>

      <SectionTitle right={<Link to="/timeline" className="text-sm text-muted hover:text-ink">See all</Link>}>Recent</SectionTitle>
      <Card className="p-2">
        {recent.length ? recent.map((x) => <TxRow key={x.id} tx={x} onClick={() => setEdit(x)} showDate />) : <div className="p-6 text-center text-sm text-muted">No transactions yet. They'll appear here as your bank texts you.</div>}
      </Card>

      <TxEditor tx={edit} open={!!edit} onClose={() => setEdit(null)} />
      <TxEditor tx={null} open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}
