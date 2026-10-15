import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useStore } from '../data/store'
import { INVEST_TYPES, portfolio, valueOf } from '../lib/invest'
import { fmt, parseAmount, pct } from '../lib/money'
import { isoDate, parseIsoDate } from '../lib/period'
import type { Investment, InvestmentType } from '../lib/types'
import { Button, Card, cx, Empty, Field, Input, Money, PageTitle, Sheet, Toggle } from '../ui/ui'

const ORDER: InvestmentType[] = ['fd', 'stock', 'unit_trust', 'gold', 'other']

export function Grow() {
  const { db } = useStore()
  const [edit, setEdit] = useState<Investment | null>(null)
  const [adding, setAdding] = useState<InvestmentType | null>(null)
  const [showClosed, setShowClosed] = useState(false)
  const p = portfolio(db.investments)
  const list = db.investments.filter((i) => showClosed || !i.closed)
  const up = p.gain >= 0

  return (
    <div>
      <PageTitle
        title="Grow"
        sub="Deposits, stocks, gold and funds in one place"
        right={
          <Button variant="soft" className="py-2.5" onClick={() => setAdding('fd')}>
            <Plus size={18} /> Add
          </Button>
        }
      />

      <Card className="p-6 text-center">
        <div className="text-[15px] text-muted">Investments</div>
        <Money value={p.value} className="mt-1 block text-[40px] font-bold leading-tight" cents={false} />
        {p.invested > 0 && (
          <div className={cx('mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-[15px] font-semibold', up ? 'bg-kiwi-deep text-kiwi' : 'bg-bad/15 text-bad')}>
            {up ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
            <span className="num">
              {fmt(Math.abs(p.gain), { cents: false })} · {pct(Math.abs(p.gainPct))}
            </span>
          </div>
        )}
        {p.months > 0 && (
          <div className="mt-3 text-muted">
            Growing for <span className="font-semibold text-ink">{p.months} month{p.months > 1 ? 's' : ''}</span>
          </div>
        )}
        {p.value > 0 && (
          <>
            <div className="mt-6 flex h-3 overflow-hidden rounded-full">
              {ORDER.filter((t) => p.byType[t]).map((t, i) => (
                <div key={t} style={{ width: `${(p.byType[t].value / p.value) * 100}%`, background: INVEST_TYPES[t].color, marginLeft: i ? 2 : 0 }} title={INVEST_TYPES[t].label} />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-muted">
              {ORDER.filter((t) => p.byType[t]).map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: INVEST_TYPES[t].color }} />
                  {INVEST_TYPES[t].icon} {INVEST_TYPES[t].label} {pct((p.byType[t].value / p.value) * 100, 0)}
                </span>
              ))}
            </div>
          </>
        )}
      </Card>

      {!db.investments.length && (
        <Empty icon="🌱" title="Nothing tracked yet">
          Add a fixed deposit, shares, unit trust or gold to see your portfolio grow.
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            {ORDER.map((t) => (
              <Button key={t} variant="soft" className="py-2 text-sm" onClick={() => setAdding(t)}>
                {INVEST_TYPES[t].icon} {INVEST_TYPES[t].label}
              </Button>
            ))}
          </div>
        </Empty>
      )}

      {ORDER.map((type) => {
        const items = list.filter((i) => i.type === type)
        if (!items.length) return null
        const meta = INVEST_TYPES[type]
        const sum = items.filter((i) => !i.closed).reduce((a, i) => a + valueOf(i).value, 0)
        return (
          <div key={type} className="mt-7">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-muted">
                {meta.icon} {meta.label}
              </h2>
              <Money value={sum} className="text-sm text-muted" cents={false} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {items.map((i) => (
                <HoldingCard key={i.id} inv={i} onClick={() => setEdit(i)} />
              ))}
            </div>
          </div>
        )
      })}
      {db.investments.some((i) => i.closed) && (
        <button onClick={() => setShowClosed(!showClosed)} className="mt-6 text-sm text-muted hover:text-ink">
          {showClosed ? 'Hide' : 'Show'} closed holdings
        </button>
      )}
      <div className="mt-8 text-center font-hand text-2xl text-faint">All your wealth in one place</div>

      <InvestmentEditor inv={edit} type={edit?.type ?? adding ?? 'fd'} open={!!edit || !!adding} onClose={() => (setEdit(null), setAdding(null))} />
    </div>
  )
}

function HoldingCard({ inv, onClick }: { inv: Investment; onClick: () => void }) {
  const v = valueOf(inv)
  const up = v.gain >= 0
  return (
    <Card className={cx('p-4', inv.closed && 'opacity-50')} onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold">{inv.name}</div>
          <div className="truncate text-xs text-muted">
            {inv.institution ?? ''}
            {inv.type === 'fd' && inv.rate ? `${inv.institution ? ' · ' : ''}${inv.rate}% p.a.` : ''}
            {inv.type !== 'fd' && inv.units ? `${inv.institution ? ' · ' : ''}${Number(inv.units).toLocaleString()} ${INVEST_TYPES[inv.type].unit}` : ''}
            {inv.closed ? ' · closed' : ''}
          </div>
        </div>
        <div className="text-right">
          <Money value={v.value} className="font-semibold" cents={false} />
          <div className={cx('text-xs num', up ? 'text-kiwi' : 'text-bad')}>
            {up ? '+' : '−'}
            {fmt(Math.abs(v.gain), { cents: false }).replace('Rs. ', '')} ({pct(Math.abs(v.gainPct))})
          </div>
        </div>
      </div>
      {inv.type === 'fd' && v.daysToMaturity !== undefined && (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-[#6b8cef]" style={{ width: `${(v.progress ?? 0) * 100}%` }} />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted">
            <span>{v.daysToMaturity > 0 ? `Matures in ${v.daysToMaturity} days` : 'Matured'}</span>
            <span className="num">at maturity {fmt(v.maturityValue!, { cents: false })}</span>
          </div>
        </div>
      )}
      {inv.type !== 'fd' && inv.price_at && <div className="mt-2 text-[11px] text-faint">Price updated {new Date(inv.price_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>}
    </Card>
  )
}

function InvestmentEditor({ inv, type: initialType, open, onClose }: { inv: Investment | null; type: InvestmentType; open: boolean; onClose: () => void }) {
  const { insert, update, remove, toast } = useStore()
  const [type, setType] = useState<InvestmentType>(initialType)
  const [f, setF] = useState<Record<string, string>>({})
  const [closed, setClosed] = useState(false)
  const set = (k: string) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))

  useEffect(() => {
    if (!open) return
    setType(inv?.type ?? initialType)
    setClosed(inv?.closed ?? false)
    const unitCost = inv && inv.units ? inv.cost / Number(inv.units) : null
    setF({
      name: inv?.name ?? '',
      institution: inv?.institution ?? '',
      cost: inv ? String(inv.cost) : '',
      units: inv?.units != null ? String(inv.units) : '',
      buy: unitCost ? String(Math.round(unitCost * 100) / 100) : '',
      price: inv?.price != null ? String(inv.price) : '',
      rate: inv?.rate != null ? String(inv.rate) : '',
      start: inv?.start_date ?? isoDate(new Date()),
      maturity: inv?.maturity_date ?? '',
      months: '12',
      notes: inv?.notes ?? '',
    })
  }, [open, inv, initialType])

  const meta = INVEST_TYPES[type]
  const priced = type === 'stock' || type === 'unit_trust' || type === 'gold'

  async function save() {
    const row: Partial<Investment> = {
      type,
      name: f.name.trim() || meta.label,
      institution: f.institution.trim() || null,
      notes: f.notes.trim() || null,
      closed,
      start_date: f.start || null,
    }
    if (type === 'fd') {
      row.cost = parseAmount(f.cost)
      row.rate = parseAmount(f.rate)
      let maturity = f.maturity
      if (!maturity && f.start) {
        const d = parseIsoDate(f.start)
        d.setMonth(d.getMonth() + (parseInt(f.months) || 12))
        maturity = isoDate(d)
      }
      row.maturity_date = maturity || null
      row.units = null
      row.price = null
    } else if (priced) {
      const units = parseAmount(f.units)
      row.units = units
      row.cost = f.buy ? Math.round(units * parseAmount(f.buy) * 100) / 100 : parseAmount(f.cost)
      const price = f.price ? parseAmount(f.price) : null
      row.price = price
      if (!inv || price !== inv.price) row.price_at = new Date().toISOString()
    } else {
      row.cost = parseAmount(f.cost)
      row.units = 1
      row.price = f.price ? parseAmount(f.price) : row.cost
      row.price_at = new Date().toISOString()
    }
    if (!row.cost) return toast('Enter the amount invested')
    if (inv) await update('investments', inv.id, row)
    else await insert('investments', [row])
    onClose()
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={inv ? inv.name : `Add ${meta.label.replace(/s$/, '').toLowerCase()}`}
      footer={
        <div className="flex gap-2">
          {inv && (
            <Button variant="danger" onClick={async () => (await remove('investments', inv.id), onClose())} aria-label="Delete">
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
        {!inv && (
          <div className="grid grid-cols-5 gap-2">
            {ORDER.map((t) => (
              <button key={t} onClick={() => setType(t)} className={cx('flex flex-col items-center gap-1 rounded-2xl border py-2.5 text-[11px]', type === t ? 'border-kiwi bg-kiwi-deep' : 'border-transparent bg-card2')}>
                <span className="text-xl">{INVEST_TYPES[t].icon}</span>
                {INVEST_TYPES[t].label.replace(/s$/, '').replace('Fixed Deposit', 'FD')}
              </button>
            ))}
          </div>
        )}
        <Field label={type === 'stock' ? 'Ticker / company' : type === 'unit_trust' ? 'Fund name' : 'Name'}>
          <Input value={f.name ?? ''} onChange={set('name')} placeholder={type === 'stock' ? 'JKH.N0000' : type === 'gold' ? '22K chain' : type === 'fd' ? '12-month FD' : ''} />
        </Field>
        <Field label={type === 'fd' ? 'Bank / finance company' : type === 'stock' ? 'Broker' : type === 'unit_trust' ? 'Fund manager' : 'Where held'}>
          <Input value={f.institution ?? ''} onChange={set('institution')} placeholder="Optional" />
        </Field>

        {type === 'fd' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Amount deposited">
                <Input inputMode="decimal" value={f.cost ?? ''} onChange={set('cost')} placeholder="500000" />
              </Field>
              <Field label="Interest rate % p.a.">
                <Input inputMode="decimal" value={f.rate ?? ''} onChange={set('rate')} placeholder="9.5" />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Start date">
                <Input type="date" value={f.start ?? ''} onChange={set('start')} />
              </Field>
              {f.maturity || inv ? (
                <Field label="Maturity date">
                  <Input type="date" value={f.maturity ?? ''} onChange={set('maturity')} />
                </Field>
              ) : (
                <Field label="Term (months)">
                  <Input inputMode="numeric" value={f.months ?? ''} onChange={set('months')} />
                </Field>
              )}
            </div>
          </>
        )}

        {priced && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label={type === 'gold' ? 'Weight (grams)' : type === 'stock' ? 'Shares' : 'Units'}>
                <Input inputMode="decimal" value={f.units ?? ''} onChange={set('units')} />
              </Field>
              <Field label={type === 'gold' ? 'Bought at (per g)' : 'Average buy price'} hint={f.units && f.buy ? `Invested ${fmt(parseAmount(f.units) * parseAmount(f.buy), { cents: false })}` : undefined}>
                <Input inputMode="decimal" value={f.buy ?? ''} onChange={set('buy')} />
              </Field>
            </div>
            <Field label={type === 'gold' ? 'Today’s price per gram' : type === 'unit_trust' ? 'Current NAV / unit price' : 'Current share price'} hint="Update this whenever you check the market. Value and gain are calculated from it.">
              <Input inputMode="decimal" value={f.price ?? ''} onChange={set('price')} />
            </Field>
            <Field label="Bought on">
              <Input type="date" value={f.start ?? ''} onChange={set('start')} />
            </Field>
          </>
        )}

        {type === 'other' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount invested">
              <Input inputMode="decimal" value={f.cost ?? ''} onChange={set('cost')} />
            </Field>
            <Field label="Current value">
              <Input inputMode="decimal" value={f.price ?? ''} onChange={set('price')} />
            </Field>
          </div>
        )}
        <Field label="Notes">
          <Input value={f.notes ?? ''} onChange={set('notes')} placeholder="Optional" />
        </Field>
        {inv && <Toggle checked={closed} onChange={setClosed} label="Closed / sold (keep for history)" />}
      </div>
    </Sheet>
  )
}
