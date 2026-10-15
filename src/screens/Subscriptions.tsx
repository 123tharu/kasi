import { Check, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { patternFromMerchant } from '../lib/categorize'
import { fmt, parseAmount } from '../lib/money'
import { addDays, advanceDate, daysUntil, isoDate, parseIsoDate } from '../lib/period'
import type { Subscription, Transaction } from '../lib/types'
import { BackLink } from './More'
import { Button, Card, cx, Empty, Field, Input, Money, PageTitle, Segmented, Select, Sheet, Toggle } from '../ui/ui'

const monthly = (s: Subscription) => (s.cycle === 'monthly' ? s.amount : s.cycle === 'yearly' ? s.amount / 12 : (s.amount * 52) / 12)

/** Merchants charged a similar amount in ≥2 different months, not already tracked. */
function detect(txns: Transaction[], subs: Subscription[]) {
  const cutoff = addDays(new Date(), -120).toISOString()
  const groups = new Map<string, Transaction[]>()
  for (const t of txns) {
    if (t.direction !== 'debit' || !t.merchant || t.occurred_at < cutoff) continue
    const key = patternFromMerchant(t.merchant)
    if (!key || subs.some((s) => s.match && key.includes(s.match.toLowerCase()))) continue
    groups.set(key, [...(groups.get(key) ?? []), t])
  }
  const out: { name: string; amount: number; match: string; last: string; category_id: string | null }[] = []
  for (const [key, list] of groups) {
    const months = new Set(list.map((t) => t.occurred_at.slice(0, 7)))
    if (months.size < 2 || list.length > months.size * 2) continue
    const amounts = list.map((t) => t.amount)
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
    if (amounts.some((a) => Math.abs(a - avg) / avg > 0.15)) continue
    out.push({ name: list[0].merchant!, amount: Math.round(avg), match: key, last: list[0].occurred_at, category_id: list[0].category_id })
  }
  return out.slice(0, 5)
}

export function Subscriptions() {
  const { db, insert, update } = useStore()
  const [edit, setEdit] = useState<Subscription | null>(null)
  const [adding, setAdding] = useState(false)
  const active = db.subscriptions.filter((s) => s.active).sort((a, b) => a.next_date.localeCompare(b.next_date))
  const inactive = db.subscriptions.filter((s) => !s.active)
  const perMonth = active.reduce((a, s) => a + monthly(s), 0)
  const found = useMemo(() => detect(db.transactions, db.subscriptions), [db.transactions, db.subscriptions])

  return (
    <div>
      <BackLink />
      <PageTitle
        title="Subscriptions"
        sub="Recurring bills and renewals"
        right={
          <Button variant="soft" className="py-2.5" onClick={() => setAdding(true)}>
            <Plus size={18} /> Add
          </Button>
        }
      />
      {active.length > 0 && (
        <Card className="mb-4 flex items-end justify-between p-5">
          <div>
            <div className="text-sm text-muted">Per month</div>
            <Money value={perMonth} className="text-3xl font-bold" cents={false} />
          </div>
          <div className="text-right text-sm text-muted num">{fmt(perMonth * 12, { cents: false })} a year</div>
        </Card>
      )}
      {!active.length && <Empty icon="🔁" title="No subscriptions yet">Add Netflix, Spotify, your phone bill… Kasi reminds you before they renew and marks them paid when the SMS arrives.</Empty>}

      <div className="space-y-2.5">
        {active.map((s) => {
          const d = daysUntil(s.next_date)
          return (
            <Card key={s.id} className="flex items-center gap-3 p-4" onClick={() => setEdit(s)}>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-card2 text-2xl">{s.icon}</div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[17px] font-semibold">{s.name}</div>
                <div className={cx('text-sm', d < 0 ? 'text-bad' : d <= 3 ? 'text-warn' : 'text-muted')}>
                  {d < 0 ? `Overdue by ${-d} day${d === -1 ? '' : 's'}` : d === 0 ? 'Renews today' : `Renews in ${d} day${d === 1 ? '' : 's'}`}
                </div>
              </div>
              <div className="text-right">
                <Money value={s.amount} className="text-[17px] font-semibold" currency={s.currency} />
                <div className="text-sm text-muted capitalize">{s.cycle}</div>
              </div>
              {d <= 3 && (
                <button
                  title="Mark paid"
                  onClick={(e) => {
                    e.stopPropagation()
                    let n = s.next_date
                    do n = advanceDate(n, s.cycle)
                    while (daysUntil(n) < 0)
                    update('subscriptions', s.id, { next_date: n })
                  }}
                  className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-kiwi-deep text-kiwi"
                >
                  <Check size={18} />
                </button>
              )}
            </Card>
          )
        })}
      </div>

      {found.length > 0 && (
        <div className="mt-7">
          <div className="mb-3 text-[15px] font-semibold text-muted">Looks recurring</div>
          <div className="space-y-2">
            {found.map((f) => (
              <Card key={f.match} className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{f.name}</div>
                  <div className="text-xs text-muted num">≈ {fmt(f.amount, { cents: false })} each month</div>
                </div>
                <Button
                  variant="soft"
                  className="py-2 text-sm"
                  onClick={() =>
                    insert('subscriptions', [
                      { name: f.name, amount: f.amount, match: f.match, category_id: f.category_id, cycle: 'monthly', next_date: advanceDate(isoDate(new Date(f.last)), 'monthly') },
                    ])
                  }
                >
                  Track
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}
      {inactive.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {inactive.map((s) => (
            <button key={s.id} onClick={() => setEdit(s)} className="rounded-full border border-line px-4 py-1.5 text-sm text-muted line-through">
              {s.icon} {s.name}
            </button>
          ))}
        </div>
      )}
      <SubEditor s={edit} open={!!edit || adding} onClose={() => (setEdit(null), setAdding(false))} />
    </div>
  )
}

const ICONS = ['🔁', '🎧', '🎬', '📺', '☁️', '📶', '📱', '💡', '💧', '🏋️', '🛡️', '🤖', '🎮', '📰', '🏠', '🚗']

function SubEditor({ s, open, onClose }: { s: Subscription | null; open: boolean; onClose: () => void }) {
  const { db, insert, update, remove, toast } = useStore()
  const [f, setF] = useState({ name: '', amount: '', cycle: 'monthly' as Subscription['cycle'], next: '', icon: '🔁', match: '', category: '', currency: 'LKR', active: true })
  useEffect(() => {
    if (!open) return
    setF({
      name: s?.name ?? '',
      amount: s ? String(s.amount) : '',
      cycle: s?.cycle ?? 'monthly',
      next: s?.next_date ?? isoDate(addDays(new Date(), 30)),
      icon: s?.icon ?? '🔁',
      match: s?.match ?? '',
      category: s?.category_id ?? db.categories.find((c) => c.name === 'Subscriptions')?.id ?? '',
      currency: s?.currency ?? 'LKR',
      active: s?.active ?? true,
    })
  }, [open, s, db.categories])

  async function save() {
    if (!f.name.trim() || !parseAmount(f.amount)) return toast('Add a name and amount')
    const row = {
      name: f.name.trim(),
      amount: parseAmount(f.amount),
      cycle: f.cycle,
      next_date: f.next,
      icon: f.icon,
      match: (f.match.trim() || f.name.trim()).toLowerCase(),
      category_id: f.category || null,
      currency: f.currency,
      active: f.active,
    }
    if (s) await update('subscriptions', s.id, row)
    else await insert('subscriptions', [row])
    onClose()
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={s ? s.name : 'Add subscription'}
      footer={
        <div className="flex gap-2">
          {s && (
            <Button variant="danger" onClick={async () => (await remove('subscriptions', s.id), onClose())} aria-label="Delete">
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
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {ICONS.map((i) => (
            <button key={i} onClick={() => setF({ ...f, icon: i })} className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl', f.icon === i ? 'bg-kiwi-deep ring-1 ring-kiwi' : 'bg-card2')}>
              {i}
            </button>
          ))}
        </div>
        <Field label="Name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Netflix" />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Amount">
            <Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} />
          </Field>
          <Field label="Currency">
            <Select value={f.currency} onChange={(e) => setF({ ...f, currency: e.target.value })}>
              {['LKR', 'USD', 'EUR', 'GBP'].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Repeats">
          <Segmented
            value={f.cycle}
            onChange={(v) => setF({ ...f, cycle: v })}
            options={[
              { value: 'weekly', label: 'Weekly' },
              { value: 'monthly', label: 'Monthly' },
              { value: 'yearly', label: 'Yearly' },
            ]}
          />
        </Field>
        <Field label="Next renewal">
          <Input type="date" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} />
        </Field>
        <Field label="Bank SMS shows it as" hint="When a payment with this text arrives near the renewal date, Kasi marks it paid and moves the date forward.">
          <Input value={f.match} onChange={(e) => setF({ ...f, match: e.target.value })} placeholder={f.name.toLowerCase() || 'netflix'} />
        </Field>
        <Field label="Category">
          <Select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>
            <option value="">None</option>
            {db.categories
              .filter((c) => c.kind === 'expense')
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
          </Select>
        </Field>
        {s && <Toggle checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Active (turn off if cancelled)" />}
        {s && f.next && <div className="text-xs text-faint">Following renewal: {parseIsoDate(advanceDate(f.next, f.cycle)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
      </div>
    </Sheet>
  )
}
