import { AlertCircle, MessageSquareText, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { patternFromMerchant } from '../lib/categorize'
import { parseAmount } from '../lib/money'
import { fmtTime } from '../lib/period'
import { needsReview } from '../lib/stats'
import type { Category, Direction, Transaction } from '../lib/types'
import { Button, CatIcon, cx, Field, Input, inputCls, Money, Segmented, Select, Sheet, Toggle } from './ui'

export function TxRow({ tx, onClick, showDate }: { tx: Transaction; onClick?: () => void; showDate?: boolean }) {
  const { cats, db } = useStore()
  const cat = tx.category_id ? cats.get(tx.category_id) : null
  const acc = db.accounts.find((a) => a.id === tx.account_id)
  const review = needsReview(tx, cats)
  const d = new Date(tx.occurred_at)
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-card2/60 active:bg-card2">
      <CatIcon cat={cat} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{tx.merchant || (tx.direction === 'credit' ? 'Money in' : 'Payment')}</div>
        <div className="flex items-center gap-1.5 truncate text-[13px] text-muted">
          {review && <AlertCircle size={13} className="shrink-0 text-warn" />}
          <span className="truncate">{cat?.name ?? 'Uncategorised'}{acc ? ` · ${acc.name}` : ''}</span>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <Money value={tx.direction === 'credit' ? tx.amount : tx.amount} sign={tx.direction === 'credit'} currency={tx.currency} className={cx('text-[15px] font-semibold', tx.direction === 'credit' && 'text-kiwi')} />
        <div className="text-[12px] text-faint">{showDate ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : fmtTime(d)}</div>
      </div>
    </button>
  )
}

export function CategoryPicker({ value, onChange, direction }: { value: string | null; onChange: (id: string) => void; direction: Direction }) {
  const { db } = useStore()
  const [all, setAll] = useState(false)
  const list = db.categories
    .filter((c) => !c.archived)
    .filter((c) => all || c.kind === 'transfer' || (direction === 'debit' ? c.kind === 'expense' : c.kind === 'income'))
    .sort((a, b) => a.sort - b.sort)
  return (
    <div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {list.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            className={cx('flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-center transition', value === c.id ? 'border-kiwi bg-kiwi-deep' : 'border-transparent bg-card2 hover:border-line')}
          >
            <span className="text-xl">{c.icon}</span>
            <span className="line-clamp-2 text-[11px] leading-tight text-ink/85">{c.name}</span>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setAll(!all)} className="mt-2 text-xs text-muted underline-offset-2 hover:underline">
        {all ? 'Show fewer categories' : 'Show all categories'}
      </button>
    </div>
  )
}

function toLocalInput(iso: string) {
  const d = new Date(iso)
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16)
}

export function TxEditor({ tx, open, onClose, preset }: { tx: Transaction | null; open: boolean; onClose: () => void; preset?: Partial<Transaction> }) {
  const { db, saveTransaction, deleteTransaction, toast } = useStore()
  const isNew = !tx
  const [direction, setDirection] = useState<Direction>('debit')
  const [amount, setAmount] = useState('')
  const [merchant, setMerchant] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [accountId, setAccountId] = useState<string>('')
  const [when, setWhen] = useState('')
  const [note, setNote] = useState('')
  const [learn, setLearn] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const src = tx ?? preset ?? {}
    setDirection(src.direction ?? 'debit')
    setAmount(src.amount ? String(src.amount) : '')
    setMerchant(src.merchant ?? '')
    setCategoryId(src.category_id ?? null)
    setAccountId(src.account_id ?? db.accounts.find((a) => a.type === 'cash')?.id ?? db.accounts[0]?.id ?? '')
    setWhen(toLocalInput(src.occurred_at ?? new Date().toISOString()))
    setNote(src.note ?? '')
    setLearn(true)
  }, [open, tx, preset, db.accounts])

  const sms = useMemo(() => (tx?.raw_sms_id ? db.raw_sms.find((s) => s.id === tx.raw_sms_id) : null), [tx, db.raw_sms])
  const categoryChanged = !!tx && categoryId !== tx.category_id
  const pattern = merchant ? patternFromMerchant(merchant) : ''

  async function save() {
    const amt = parseAmount(amount)
    if (!amt) return toast('Enter an amount')
    setBusy(true)
    try {
      await saveTransaction(
        {
          ...(tx ? { id: tx.id } : {}),
          amount: amt,
          direction,
          merchant: merchant.trim() || null,
          category_id: categoryId,
          account_id: accountId || null,
          occurred_at: new Date(when).toISOString(),
          note: note.trim() || null,
          ...(tx && tx.currency !== 'LKR' ? { currency: 'LKR' } : {}),
        },
        { learn: learn && !!merchant && !!categoryId && (isNew || categoryChanged) },
      )
      onClose()
    } catch (e) {
      toast(`Couldn't save: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  async function del() {
    if (!tx) return
    setBusy(true)
    try {
      await deleteTransaction(tx)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isNew ? 'Add transaction' : 'Transaction'}
      footer={
        <div className="flex gap-2">
          {!isNew && (
            <Button variant="danger" onClick={del} disabled={busy} aria-label="Delete">
              <Trash2 size={18} />
            </Button>
          )}
          <Button className="flex-1" onClick={save} disabled={busy}>
            {isNew ? 'Add' : 'Save'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Segmented
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'debit', label: 'Money out' },
            { value: 'credit', label: 'Money in' },
          ]}
        />
        <div className="flex items-baseline justify-center gap-2 py-2">
          <span className="text-xl text-muted">Rs.</span>
          <input
            inputMode="decimal"
            autoFocus={isNew}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            style={{ width: `${Math.max(1, amount.length) + 0.6}ch` }}
            className="num max-w-[70vw] bg-transparent text-left text-5xl font-semibold outline-none placeholder:text-faint"
          />
        </div>
        {tx && tx.currency !== 'LKR' && (
          <div className="rounded-2xl bg-warn/10 px-4 py-3 text-sm text-warn">
            Charged as {tx.currency} {tx.amount}. Enter the rupee amount from your statement; saving marks it as LKR.
          </div>
        )}
        <Field label="Merchant / description">
          <Input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Keells Super" />
        </Field>
        <Field label="Category">
          <CategoryPicker value={categoryId} onChange={setCategoryId} direction={direction} />
        </Field>
        {merchant && categoryId && (isNew || categoryChanged) && (
          <Toggle checked={learn} onChange={setLearn} label={<>Always put <b>“{pattern}”</b> in this category</>} />
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Account">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">None</option>
              {db.accounts
                .filter((a) => !a.archived || a.id === accountId)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="When">
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputCls} />
          </Field>
        </div>
        <Field label="Note">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </Field>
        {sms && (
          <div className="rounded-2xl border border-line p-4">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-faint">
              <MessageSquareText size={14} /> Original SMS {sms.sender ? `· ${sms.sender}` : ''}
            </div>
            <div className="whitespace-pre-wrap text-sm text-muted">{sms.body}</div>
          </div>
        )}
      </div>
    </Sheet>
  )
}

export function catName(c: Category | null | undefined) {
  return c?.name ?? 'Uncategorised'
}
