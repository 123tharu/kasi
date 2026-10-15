import { AlertTriangle, CheckCircle2, Globe2, Loader2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../data/store'
import { checkRates, type RateCheck } from '../lib/fx'
import { fmt, parseAmount } from '../lib/money'
import { parseSms } from '../lib/parser'
import type { Transaction } from '../lib/types'
import { Button, cx, Money, Sheet } from './ui'

const EVENT = 'kasi:confirm-foreign'

/** Ask the app to show the confirmation sheet for one foreign payment. */
export function openForeignConfirm(id: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: id }))
}

const money2 = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function ForeignConfirm({ tx, onClose }: { tx: Transaction; onClose: (later?: boolean) => void }) {
  const { db, confirmForeign, deleteTransaction } = useStore()
  const cur = (tx.orig_currency || tx.currency || 'USD').toUpperCase()
  const orig = Number(tx.orig_amount ?? tx.amount)
  const when = new Date(tx.occurred_at)
  const fee = Number(db.settings?.fx_markup ?? 0)
  const acc = db.accounts.find((a) => a.id === tx.account_id)
  const [check, setCheck] = useState<RateCheck | null>(null)
  const [amount, setAmount] = useState('')
  const [busy, setBusy] = useState(false)
  const touched = useRef(false)

  // The rupee figure the bank printed in the SMS, if any.
  const bankLkr = useMemo(() => {
    const sms = tx.raw_sms_id ? db.raw_sms.find((s) => s.id === tx.raw_sms_id) : null
    if (!sms) return null
    const r = parseSms(sms.body, sms.sender, new Date(sms.received_at))
    return r.kind === 'txn' ? r.lkrAmount : null
  }, [tx, db.raw_sms])

  useEffect(() => {
    let alive = true
    setCheck(null)
    checkRates(cur, when).then((c) => alive && setCheck(c))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tx.id])

  const market = check?.rate ? orig * check.rate : null
  const withFee = market !== null ? market * (1 + fee / 100) : null
  const suggested = bankLkr ?? withFee ?? (tx.currency === 'LKR' ? tx.amount : null)

  useEffect(() => {
    if (!touched.current && suggested !== null) setAmount(money2(suggested).replace(/,/g, ''))
  }, [suggested])

  const value = parseAmount(amount)
  const implied = value && orig ? value / orig : null

  async function confirm() {
    if (!value) return
    setBusy(true)
    try {
      await confirmForeign(tx, value)
      onClose()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted">
        <b className="text-ink">{tx.merchant ?? 'Payment'}</b> · {when.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
        {acc ? ` · ${acc.name}` : ''}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card2 p-4">
          <div className="text-xs text-muted">Paid</div>
          <div className="mt-1 text-2xl font-bold num">
            <span className="text-sm font-medium text-muted">{cur} </span>
            {money2(orig)}
          </div>
        </div>
        <div className="rounded-2xl border border-kiwi/40 bg-kiwi-deep p-4">
          <div className="text-xs text-muted">In rupees</div>
          <div className="mt-1 text-2xl font-bold num">{value ? <Money value={value} cents /> : '—'}</div>
        </div>
      </div>

      <div className="rounded-2xl border border-line p-4 text-sm">
        <div className="mb-2 font-semibold">
          Exchange rate on {when.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
        {!check ? (
          <div className="flex items-center gap-2 text-muted">
            <Loader2 size={16} className="animate-spin" /> Checking two rate sources…
          </div>
        ) : check.quotes.length === 0 ? (
          <div className="text-warn">Couldn't reach the rate sources (offline?). Enter the rupee amount from your bank, or try again later.</div>
        ) : (
          <div className="space-y-1.5">
            {check.quotes.map((q) => (
              <div key={q.source} className="flex justify-between">
                <span className="text-muted">{q.source}</span>
                <span className="num">
                  1 {cur} = Rs. {q.rate.toFixed(2)}
                </span>
              </div>
            ))}
            <div className={cx('flex items-center gap-1.5 pt-1 text-xs', check.agreed ? 'text-kiwi' : 'text-warn')}>
              {check.agreed ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
              {check.quotes.length < 2
                ? 'Only one source answered, so this rate is unchecked.'
                : check.agreed
                  ? `Sources agree (${check.spreadPct!.toFixed(2)}% apart).`
                  : `Sources differ by ${check.spreadPct!.toFixed(1)}%. Check against your statement.`}
            </div>
            <div className="mt-2 space-y-1 border-t border-line pt-2">
              <div className="flex justify-between">
                <span className="text-muted">Market value</span>
                <span className="num">Rs. {money2(market!)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">
                  Card fee {fee}%{' '}
                  <Link to="/more/settings" className="underline" onClick={() => onClose(true)}>
                    change
                  </Link>
                </span>
                <span className="num">+ Rs. {money2(market! * (fee / 100))}</span>
              </div>
              {bankLkr !== null && (
                <div className="flex justify-between font-semibold text-ink">
                  <span>Bank's amount (from the SMS)</span>
                  <span className="num">Rs. {money2(bankLkr)}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <label className="block">
        <div className="mb-1.5 text-[13px] font-medium text-muted">Rupee amount to record</div>
        <div className="flex items-center gap-2 rounded-2xl border border-line bg-card2 px-4 py-3 focus-within:border-kiwi/60">
          <span className="text-muted">Rs.</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => {
              touched.current = true
              setAmount(e.target.value)
            }}
            className="num w-full bg-transparent text-lg outline-none"
          />
        </div>
        {implied && check?.rate ? (
          <div className="mt-1 text-xs text-faint num">
            = Rs. {implied.toFixed(2)} per {cur} ({implied >= check.rate ? '+' : '−'}
            {Math.abs(((implied - check.rate) / check.rate) * 100).toFixed(1)}% vs market)
          </div>
        ) : null}
      </label>

      <div className="flex flex-col gap-2 pt-1">
        <Button onClick={confirm} disabled={!value || busy}>
          Confirm and add Rs. {value ? money2(value) : '—'}
        </Button>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => onClose(true)}>
            Later
          </Button>
          <Button
            variant="danger"
            className="flex-1"
            onClick={async () => {
              await deleteTransaction(tx)
              onClose()
            }}
          >
            Not my payment
          </Button>
        </div>
      </div>
    </div>
  )
}

/**
 * Watches for foreign payments waiting for confirmation and pops the sheet up:
 * when Kasi opens with some waiting, and the moment a new one arrives.
 */
export function ForeignWatcher() {
  const { db } = useStore()
  const pending = useMemo(() => db.transactions.filter((t) => t.pending).sort((a, b) => a.occurred_at.localeCompare(b.occurred_at)), [db.transactions])
  const [openId, setOpenId] = useState<string | null>(null)
  const seen = useRef<Set<string> | null>(null)
  const later = useRef<Set<string>>(new Set())

  useEffect(() => {
    try {
      for (const id of JSON.parse(sessionStorage.getItem('kasi-fx-later') || '[]')) later.current.add(id)
    } catch {
      /* ignore */
    }
    const h = (e: Event) => setOpenId((e as CustomEvent<string>).detail)
    window.addEventListener(EVENT, h)
    return () => window.removeEventListener(EVENT, h)
  }, [])

  useEffect(() => {
    const ids = new Set(pending.map((t) => t.id))
    if (seen.current === null) {
      seen.current = ids
      const first = pending.find((t) => !later.current.has(t.id))
      if (first) setOpenId(first.id)
      return
    }
    const fresh = pending.find((t) => !seen.current!.has(t.id))
    seen.current = ids
    if (fresh) setOpenId(fresh.id)
  }, [pending])

  const tx = openId ? db.transactions.find((t) => t.id === openId) : null
  const close = (isLater?: boolean) => {
    if (isLater && openId) {
      later.current.add(openId)
      try {
        sessionStorage.setItem('kasi-fx-later', JSON.stringify([...later.current]))
      } catch {
        /* ignore */
      }
    }
    setOpenId(null)
  }
  return (
    <Sheet
      open={!!tx && !!tx.pending}
      onClose={() => close(true)}
      title={
        <span className="flex items-center gap-2">
          <Globe2 size={20} className="text-kiwi" /> Foreign payment to confirm
        </span>
      }
    >
      {tx && <ForeignConfirm key={tx.id} tx={tx} onClose={close} />}
    </Sheet>
  )
}

/** Home / Review banner listing what's waiting. */
export function PendingForeignCard() {
  const { db } = useStore()
  const pending = db.transactions.filter((t) => t.pending)
  if (!pending.length) return null
  const first = pending[0]
  return (
    <button onClick={() => openForeignConfirm(first.id)} className="flex w-full items-center gap-3 rounded-3xl border border-warn/40 bg-warn/10 p-4 text-left">
      <Globe2 className="shrink-0 text-warn" size={22} />
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-semibold">
          {pending.length === 1 ? 'Foreign payment to confirm' : `${pending.length} foreign payments to confirm`}
        </div>
        <div className="truncate text-xs text-muted">
          {first.merchant ?? 'Payment'} · {first.orig_currency} {money2(Number(first.orig_amount ?? first.amount))}
          {first.currency === 'LKR' ? ` ≈ ${fmt(first.amount, { cents: false })}` : ''}
        </div>
      </div>
      <span className="text-sm font-semibold text-warn">Review</span>
    </button>
  )
}
