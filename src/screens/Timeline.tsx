import { Plus, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../data/store'
import { fmtDay } from '../lib/period'
import { isSpend, needsReview } from '../lib/stats'
import type { Transaction } from '../lib/types'
import { TxEditor, TxRow } from '../ui/tx'
import { Card, cx, IconButton, Money, PageTitle, Select } from '../ui/ui'

type Filter = 'all' | 'out' | 'in' | 'review'

export function Timeline() {
  const { db, cats } = useStore()
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [limit, setLimit] = useState(150)
  const [edit, setEdit] = useState<Transaction | null>(null)
  const [adding, setAdding] = useState(false)
  const account = params.get('account') ?? ''
  const category = params.get('category') ?? ''

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return db.transactions.filter((t) => {
      if (filter === 'out' && t.direction !== 'debit') return false
      if (filter === 'in' && t.direction !== 'credit') return false
      if (filter === 'review' && !needsReview(t, cats)) return false
      if (account && t.account_id !== account) return false
      if (category && (category === 'none' ? t.category_id : t.category_id !== category)) return false
      if (needle) {
        const c = t.category_id ? cats.get(t.category_id)?.name ?? '' : ''
        const hay = `${t.merchant ?? ''} ${t.note ?? ''} ${c} ${t.amount}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [db.transactions, cats, q, filter, account, category])

  const groups = useMemo(() => {
    const out: { key: string; label: string; items: Transaction[]; spent: number }[] = []
    for (const t of list.slice(0, limit)) {
      const d = new Date(t.occurred_at)
      const key = d.toDateString()
      let g = out[out.length - 1]
      if (!g || g.key !== key) {
        g = { key, label: fmtDay(d), items: [], spent: 0 }
        out.push(g)
      }
      g.items.push(t)
      if (isSpend(t, cats)) g.spent += t.amount
    }
    return out
  }, [list, limit, cats])

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v)
    else p.delete(k)
    setParams(p, { replace: true })
  }

  return (
    <div>
      <PageTitle
        title="Timeline"
        sub={`${list.length} transaction${list.length === 1 ? '' : 's'}`}
        right={
          <IconButton onClick={() => setAdding(true)} className="bg-ink text-bg hover:bg-white hover:text-bg" aria-label="Add transaction">
            <Plus size={22} />
          </IconButton>
        }
      />

      <div className="sticky top-0 z-10 -mx-4 bg-bg/95 px-4 pb-3 pt-1 backdrop-blur md:static md:mx-0 md:px-0">
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search merchant, category, amount"
            className="w-full rounded-full border border-line bg-card py-3 pl-11 pr-10 text-ink outline-none placeholder:text-faint focus:border-kiwi/60"
          />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-faint" aria-label="Clear">
              <X size={18} />
            </button>
          )}
        </div>
        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
          {(
            [
              ['all', 'All'],
              ['out', 'Money out'],
              ['in', 'Money in'],
              ['review', 'Needs review'],
            ] as [Filter, string][]
          ).map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={cx('shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition', filter === v ? 'border-ink bg-ink text-bg' : 'border-line text-muted hover:text-ink')}>
              {l}
            </button>
          ))}
          <Select value={account} onChange={(e) => setParam('account', e.target.value)} className="w-auto shrink-0 rounded-full py-1.5 text-sm">
            <option value="">All accounts</option>
            {db.accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
          <Select value={category} onChange={(e) => setParam('category', e.target.value)} className="w-auto shrink-0 rounded-full py-1.5 text-sm">
            <option value="">All categories</option>
            <option value="none">Uncategorised</option>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {groups.length === 0 && <div className="py-16 text-center text-muted">Nothing here.</div>}
      <div className="space-y-5">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="mb-1.5 flex items-baseline justify-between px-2">
              <div className="text-sm font-semibold text-muted">{g.label}</div>
              {g.spent > 0 && <Money value={-g.spent} className="text-sm text-faint" />}
            </div>
            <Card className="p-1.5">
              {g.items.map((t) => (
                <TxRow key={t.id} tx={t} onClick={() => setEdit(t)} />
              ))}
            </Card>
          </div>
        ))}
      </div>
      {list.length > limit && (
        <div className="mt-6 flex justify-center">
          <button onClick={() => setLimit(limit + 200)} className="rounded-full border border-line px-5 py-2.5 text-sm text-muted hover:text-ink">
            Show more ({list.length - limit} older)
          </button>
        </div>
      )}
      <TxEditor tx={edit} open={!!edit} onClose={() => setEdit(null)} />
      <TxEditor tx={null} open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}
