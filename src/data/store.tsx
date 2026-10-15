import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { DEFAULT_CATEGORIES, DEFAULT_RULES, matchRule, patternFromMerchant, patternMatches } from '../lib/categorize'
import { catMap, needsReview, type CatMap } from '../lib/stats'
import type { Account, DB, Row, Settings, TableName, Transaction } from '../lib/types'
import type { Backend } from './backend'
import { planSms } from './engine'

interface StoreValue {
  db: DB
  cats: CatMap
  backend: Backend
  reviewCount: number
  insert<T extends TableName>(t: T, rows: Partial<Row<T>>[]): Promise<Row<T>[]>
  update<T extends TableName>(t: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>
  remove(t: TableName, id: string): Promise<void>
  updateSettings(p: Partial<Settings>): Promise<void>
  saveTransaction(tx: Partial<Transaction>, opts?: { learn?: boolean }): Promise<Transaction>
  deleteTransaction(tx: Transaction): Promise<void>
  learnRule(merchant: string, categoryId: string): Promise<number>
  addSms(body: string, sender?: string | null): Promise<void>
  importSms(list: { sender: string | null; body: string; received_at: string }[], onProgress?: (done: number) => void): Promise<{ added: number; alreadyHad: number }>
  processInbox(): Promise<void>
  mergeAccounts(from: Account, into: Account): Promise<void>
  reload(): Promise<void>
  toast(msg: string): void
  toastMsg: string | null
}

const Ctx = createContext<StoreValue | null>(null)

export function useStore() {
  const v = useContext(Ctx)
  if (!v) throw new Error('useStore outside provider')
  return v
}

export function StoreProvider({ backend, children, fallback }: { backend: Backend; children: ReactNode; fallback: (err: string | null) => ReactNode }) {
  const [db, setDb] = useState<DB | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const dbRef = useRef<DB | null>(null)
  dbRef.current = db
  const processing = useRef(false)

  const toast = useCallback((msg: string) => {
    setToastMsg(msg)
    window.setTimeout(() => setToastMsg((m) => (m === msg ? null : m)), 2600)
  }, [])

  // Apply synchronously to the ref so long-running loops (SMS processing) always see fresh data.
  const patch = useCallback((fn: (d: DB) => DB) => {
    const cur = dbRef.current
    if (!cur) return
    const next = fn(cur)
    dbRef.current = next
    setDb(next)
  }, [])

  // ---------------- generic CRUD (state updates after the backend confirms) ----------------
  const insert = useCallback(
    async <T extends TableName>(t: T, rows: Partial<Row<T>>[]) => {
      const out = await backend.insert(t, rows)
      patch((d) => ({ ...d, [t]: [...out, ...(d[t] as Row<T>[]).filter((x) => !out.some((o) => o.id === x.id))] }))
      return out
    },
    [backend, patch],
  )
  const update = useCallback(
    async <T extends TableName>(t: T, id: string, p: Partial<Row<T>>) => {
      const row = await backend.update(t, id, p)
      patch((d) => ({ ...d, [t]: (d[t] as Row<T>[]).map((x) => (x.id === id ? row : x)) }))
      return row
    },
    [backend, patch],
  )
  const remove = useCallback(
    async (t: TableName, id: string) => {
      await backend.remove(t, id)
      patch((d) => ({ ...d, [t]: (d[t] as { id: string }[]).filter((x) => x.id !== id) }))
    },
    [backend, patch],
  )
  const updateSettings = useCallback(
    async (p: Partial<Settings>) => {
      const s = await backend.updateSettings(p)
      patch((d) => ({ ...d, settings: s }))
    },
    [backend, patch],
  )

  // ---------------- first-run defaults ----------------
  const seedDefaults = useCallback(
    async (d: DB) => {
      if (d.categories.length) return d
      const cats = await backend.insert(
        'categories',
        DEFAULT_CATEGORIES.map((c, i) => ({ name: c.name, icon: c.icon, color: c.color, kind: c.kind, sort: i })),
      )
      const byKey = new Map(DEFAULT_CATEGORIES.map((c) => [c.key, cats.find((x) => x.name === c.name)!]))
      const rules = await backend.insert(
        'rules',
        DEFAULT_RULES.map(([pattern, key]) => ({ pattern, category_id: byKey.get(key)!.id })),
      )
      const accounts = d.accounts.length ? d.accounts : await backend.insert('accounts', [{ name: 'Cash', bank: 'CASH', type: 'cash', balance: 0, color: '#7ccf6b' }])
      return { ...d, categories: cats, rules, accounts }
    },
    [backend],
  )

  // ---------------- SMS inbox → transactions ----------------
  const processInbox = useCallback(async () => {
    if (processing.current) return
    processing.current = true
    let added = 0
    const seen = new Set<string>()
    try {
      for (;;) {
        const d = dbRef.current
        if (!d) break
        const sms = [...d.raw_sms]
          .filter((s) => s.status === 'new' && !seen.has(s.id))
          .sort((a, b) => a.received_at.localeCompare(b.received_at))[0]
        if (!sms) break
        seen.add(sms.id)
        const plan = planSms(sms, d)
        try {
          if (plan.status === 'parsed' && plan.txn) {
            let accountId = plan.accountId
            if (plan.createAccount) {
              const [acc] = await insert('accounts', [plan.createAccount])
              accountId = acc.id
            }
            try {
              await insert('transactions', [{ ...plan.txn, account_id: accountId ?? null }])
              added++
              if (plan.accountPatch) await update('accounts', plan.accountPatch.id, plan.accountPatch.patch)
              if (plan.subscriptionPatch) await update('subscriptions', plan.subscriptionPatch.id, plan.subscriptionPatch.patch)
            } catch (e) {
              // Another device already turned this SMS into a transaction — that's fine.
              if ((e as { code?: string }).code !== '23505') throw e
            }
          }
          await update('raw_sms', sms.id, { status: plan.status, note: plan.note })
        } catch (e) {
          console.error('SMS processing failed', e)
          await update('raw_sms', sms.id, { status: 'failed', note: String((e as Error).message ?? e) }).catch(() => {})
        }
      }
    } finally {
      processing.current = false
    }
    if (added) toast(added === 1 ? 'New transaction logged from SMS' : `${added} new transactions logged from SMS`)
  }, [insert, update, toast])

  // ---------------- load + live sync ----------------
  // One load at a time (StrictMode / focus events can fire twice; seeding defaults must never run twice).
  const inflight = useRef<Promise<void> | null>(null)
  const reload = useCallback(() => {
    if (inflight.current) return inflight.current
    inflight.current = (async () => {
      try {
        let d = await backend.loadAll()
        d = await seedDefaults(d)
        dbRef.current = d
        setDb(d)
        setErr(null)
      } catch (e) {
        setErr((e as Error).message ?? String(e))
      } finally {
        inflight.current = null
      }
    })()
    return inflight.current
  }, [backend, seedDefaults])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    if (db) processInbox()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db?.raw_sms])

  useEffect(() => {
    const timers = new Map<string, number>()
    const unsub = backend.subscribe((t) => {
      window.clearTimeout(timers.get(t))
      timers.set(
        t,
        window.setTimeout(async () => {
          if (t === 'settings') return reload()
          try {
            const rows = await backend.reloadTable(t)
            patch((d) => ({ ...d, [t]: rows }))
          } catch {
            /* offline: next focus reload will catch up */
          }
        }, 400),
      )
    })
    const onVis = () => {
      if (document.visibilityState === 'visible') reload()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      unsub()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [backend, patch, reload])

  // ---------------- higher-level actions ----------------
  const adjustCash = useCallback(
    async (accountId: string | null | undefined, delta: number) => {
      const acc = dbRef.current?.accounts.find((a) => a.id === accountId)
      if (!acc || (acc.type !== 'cash' && acc.type !== 'wallet') || acc.balance === null) return
      await update('accounts', acc.id, { balance: Math.round((acc.balance + delta) * 100) / 100, balance_at: new Date().toISOString() })
    },
    [update],
  )

  const learnRule = useCallback(
    async (merchant: string, categoryId: string) => {
      const d = dbRef.current!
      const pattern = patternFromMerchant(merchant)
      if (!pattern) return 0
      const existing = d.rules.find((r) => r.pattern === pattern)
      if (existing) {
        if (existing.category_id !== categoryId) await update('rules', existing.id, { category_id: categoryId })
      } else await insert('rules', [{ pattern, category_id: categoryId }])
      // apply to other uncategorised transactions from the same merchant
      const others = d.transactions.filter((t) => !t.category_id && t.merchant && patternMatches(t.merchant.toLowerCase(), pattern))
      for (const t of others) await update('transactions', t.id, { category_id: categoryId })
      return others.length
    },
    [insert, update],
  )

  const saveTransaction = useCallback(
    async (tx: Partial<Transaction>, opts: { learn?: boolean } = {}) => {
      const d = dbRef.current!
      let saved: Transaction
      if (tx.id) {
        const before = d.transactions.find((t) => t.id === tx.id)
        saved = await update('transactions', tx.id, { ...tx, needs_review: false })
        if (before && before.source === 'manual') {
          const sign = (t: Transaction) => (t.direction === 'credit' ? t.amount : -t.amount)
          if (before.account_id === saved.account_id) await adjustCash(saved.account_id, sign(saved) - sign(before))
          else {
            await adjustCash(before.account_id, -sign(before))
            await adjustCash(saved.account_id, sign(saved))
          }
        }
      } else {
        const rule = !tx.category_id ? matchRule(tx.merchant, d.rules) : null
        ;[saved] = await insert('transactions', [{ source: 'manual', currency: 'LKR', ...tx, category_id: tx.category_id ?? rule?.category_id ?? null }])
        await adjustCash(saved.account_id, saved.direction === 'credit' ? saved.amount : -saved.amount)
      }
      if (opts.learn && saved.merchant && saved.category_id) {
        const n = await learnRule(saved.merchant, saved.category_id)
        if (n) toast(`Also categorised ${n} other ${saved.merchant} transaction${n > 1 ? 's' : ''}`)
      }
      return saved
    },
    [insert, update, adjustCash, learnRule, toast],
  )

  const deleteTransaction = useCallback(
    async (tx: Transaction) => {
      await remove('transactions', tx.id)
      if (tx.source === 'manual') await adjustCash(tx.account_id, tx.direction === 'credit' ? -tx.amount : tx.amount)
    },
    [remove, adjustCash],
  )

  const addSms = useCallback(
    async (body: string, sender?: string | null) => {
      await insert('raw_sms', [{ body: body.trim(), sender: sender ?? null, status: 'new', received_at: new Date().toISOString() }])
    },
    [insert],
  )

  /** Adds past bank SMS (already filtered for money / OTPs by the caller). Skips ones Kasi already has. */
  const importSms = useCallback(
    async (list: { sender: string | null; body: string; received_at: string }[], onProgress?: (done: number) => void) => {
      const key = (s: { sender: string | null; body: string }) => `${(s.sender ?? '').toLowerCase()}|${s.body.replace(/\s+/g, ' ').trim()}`
      const have = new Set((dbRef.current?.raw_sms ?? []).map(key))
      const fresh: typeof list = []
      for (const s of list) {
        const k = key(s)
        if (have.has(k)) continue
        have.add(k)
        fresh.push(s)
      }
      for (let i = 0; i < fresh.length; i += 100) {
        await insert(
          'raw_sms',
          fresh.slice(i, i + 100).map((s) => ({ ...s, body: s.body.trim().slice(0, 2000), status: 'new' as const })),
        )
        onProgress?.(Math.min(fresh.length, i + 100))
      }
      return { added: fresh.length, alreadyHad: list.length - fresh.length }
    },
    [insert],
  )

  const mergeAccounts = useCallback(
    async (from: Account, into: Account) => {
      const d = dbRef.current!
      for (const t of d.transactions.filter((t) => t.account_id === from.id)) await update('transactions', t.id, { account_id: into.id })
      const nums = new Set([...(into.last4 ?? '').split(','), ...(from.last4 ?? '').split(',')].map((s) => s.trim()).filter(Boolean))
      await update('accounts', into.id, { last4: [...nums].join(', ') || null, bank: into.bank ?? from.bank })
      await remove('accounts', from.id)
    },
    [update, remove],
  )

  const cats = useMemo(() => catMap(db?.categories ?? []), [db?.categories])
  const reviewCount = useMemo(() => {
    if (!db) return 0
    return db.transactions.filter((t) => needsReview(t, cats)).length + db.raw_sms.filter((s) => s.status === 'failed').length
  }, [db, cats])

  if (!db) return <>{fallback(err)}</>

  const value: StoreValue = {
    db,
    cats,
    backend,
    reviewCount,
    insert,
    update,
    remove,
    updateSettings,
    saveTransaction,
    deleteTransaction,
    learnRule,
    addSms,
    importSms,
    processInbox,
    mergeAccounts,
    reload,
    toast,
    toastMsg,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
