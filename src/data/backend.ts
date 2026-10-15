import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { DB, Row, Settings, TableName } from '../lib/types'

export const TABLES: TableName[] = ['accounts', 'categories', 'transactions', 'rules', 'raw_sms', 'budgets', 'subscriptions', 'investments']

export interface Backend {
  kind: 'supabase' | 'demo'
  loadAll(): Promise<DB>
  insert<T extends TableName>(table: T, rows: Partial<Row<T>>[]): Promise<Row<T>[]>
  update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>>
  remove(table: TableName, id: string): Promise<void>
  updateSettings(patch: Partial<Settings>): Promise<Settings>
  /** Calls back with the table name whenever another device changes it. */
  subscribe(onChange: (table: TableName | 'settings') => void): () => void
  reloadTable<T extends TableName>(table: T): Promise<Row<T>[]>
  ingestUrl?: string
  anonKey?: string
}

// numeric columns come back from Postgres as strings — coerce them
const NUMERIC: Partial<Record<TableName, string[]>> = {
  accounts: ['balance', 'credit_limit'],
  transactions: ['amount'],
  budgets: ['amount'],
  subscriptions: ['amount'],
  investments: ['units', 'cost', 'price', 'rate'],
}
function coerce<T extends TableName>(table: T, rows: Record<string, unknown>[]): Row<T>[] {
  const cols = NUMERIC[table]
  if (!cols) return rows as unknown as Row<T>[]
  for (const r of rows) for (const c of cols) if (r[c] !== null && r[c] !== undefined) r[c] = Number(r[c])
  return rows as unknown as Row<T>[]
}

// ------------------------------------------------------------------ Supabase

export function makeSupabase(url: string, key: string): SupabaseClient {
  return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'kasi-auth' } })
}

export class SupabaseBackend implements Backend {
  kind = 'supabase' as const
  sb: SupabaseClient
  ingestUrl: string
  anonKey: string
  constructor(sb: SupabaseClient, url: string, key: string) {
    this.sb = sb
    this.ingestUrl = `${url.replace(/\/$/, '')}/rest/v1/rpc/ingest_sms`
    this.anonKey = key
  }

  private async all<T extends TableName>(table: T): Promise<Row<T>[]> {
    const out: Record<string, unknown>[] = []
    const page = 1000
    for (let from = 0; ; from += page) {
      const order = table === 'transactions' ? 'occurred_at' : table === 'raw_sms' ? 'received_at' : 'created_at'
      const { data, error } = await this.sb
        .from(table)
        .select('*')
        .order(order, { ascending: false })
        .range(from, from + page - 1)
      if (error) throw error
      out.push(...(data as Record<string, unknown>[]))
      if (!data || data.length < page) break
    }
    return coerce(table, out)
  }

  reloadTable<T extends TableName>(table: T) {
    return this.all(table)
  }

  async loadAll(): Promise<DB> {
    let { data: settings, error } = await this.sb.from('settings').select('*').maybeSingle()
    if (error) throw error
    if (!settings) {
      const r = await this.sb.from('settings').insert({}).select().single()
      if (r.error) throw r.error
      settings = r.data
    }
    const results = await Promise.all(TABLES.map((t) => this.all(t)))
    const db = { settings } as DB
    TABLES.forEach((t, i) => ((db as unknown as Record<string, unknown>)[t] = results[i]))
    return db
  }

  async insert<T extends TableName>(table: T, rows: Partial<Row<T>>[]): Promise<Row<T>[]> {
    if (!rows.length) return []
    const { data, error } = await this.sb.from(table).insert(rows as never).select()
    if (error) throw error
    return coerce(table, data as Record<string, unknown>[])
  }

  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>): Promise<Row<T>> {
    const { data, error } = await this.sb.from(table).update(patch as never).eq('id', id).select().single()
    if (error) throw error
    return coerce(table, [data as Record<string, unknown>])[0]
  }

  async remove(table: TableName, id: string) {
    const { error } = await this.sb.from(table).delete().eq('id', id)
    if (error) throw error
  }

  async updateSettings(patch: Partial<Settings>): Promise<Settings> {
    const { data: u } = await this.sb.auth.getUser()
    const { data, error } = await this.sb.from('settings').update(patch).eq('user_id', u.user!.id).select().single()
    if (error) throw error
    return data as Settings
  }

  subscribe(onChange: (table: TableName | 'settings') => void) {
    const ch = this.sb.channel('kasi-sync')
    for (const t of [...TABLES, 'settings'] as const) {
      ch.on('postgres_changes', { event: '*', schema: 'public', table: t }, () => onChange(t))
    }
    ch.subscribe()
    return () => {
      this.sb.removeChannel(ch)
    }
  }
}

// ------------------------------------------------------------------ Demo (stored in this browser only)

const DEMO_KEY = 'kasi-demo-db'

export class DemoBackend implements Backend {
  kind = 'demo' as const
  db: DB
  private listeners = new Set<(t: TableName | 'settings') => void>()
  constructor(seed: () => DB) {
    let stored: DB | null = null
    try {
      const raw = localStorage.getItem(DEMO_KEY)
      stored = raw ? JSON.parse(raw) : null
    } catch {
      stored = null
    }
    this.db = stored ?? seed()
    this.save()
  }
  private save() {
    try {
      localStorage.setItem(DEMO_KEY, JSON.stringify(this.db))
    } catch {
      /* storage full or blocked — demo keeps working in memory */
    }
  }
  static reset() {
    try {
      localStorage.removeItem(DEMO_KEY)
    } catch {
      /* ignore */
    }
  }
  async loadAll() {
    return structuredClone(this.db)
  }
  async reloadTable<T extends TableName>(table: T) {
    return structuredClone(this.db[table]) as Row<T>[]
  }
  async insert<T extends TableName>(table: T, rows: Partial<Row<T>>[]) {
    const list = this.db[table] as unknown as Record<string, unknown>[]
    const out = rows.map((r) => {
      const rr = r as Record<string, unknown>
      if (table === 'transactions' && rr.raw_sms_id && list.some((x) => x.raw_sms_id === rr.raw_sms_id)) {
        throw Object.assign(new Error('duplicate'), { code: '23505' })
      }
      return { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...defaults(table), ...rr }
    })
    list.unshift(...out)
    this.save()
    return structuredClone(out) as unknown as Row<T>[]
  }
  async update<T extends TableName>(table: T, id: string, patch: Partial<Row<T>>) {
    const list = this.db[table] as unknown as Record<string, unknown>[]
    const i = list.findIndex((x) => x.id === id)
    if (i < 0) throw new Error('not found')
    list[i] = { ...list[i], ...patch }
    this.save()
    return structuredClone(list[i]) as unknown as Row<T>
  }
  async remove(table: TableName, id: string) {
    const list = this.db[table] as unknown as Record<string, unknown>[]
    const i = list.findIndex((x) => x.id === id)
    if (i >= 0) list.splice(i, 1)
    this.save()
  }
  async updateSettings(patch: Partial<Settings>) {
    this.db.settings = { ...this.db.settings!, ...patch }
    this.save()
    return structuredClone(this.db.settings)
  }
  subscribe(cb: (t: TableName | 'settings') => void) {
    this.listeners.add(cb)
    return () => {
      this.listeners.delete(cb)
    }
  }
}

function defaults(table: TableName): Record<string, unknown> {
  switch (table) {
    case 'transactions':
      return { account_id: null, category_id: null, merchant: null, note: null, source: 'manual', raw_sms_id: null, needs_review: false, currency: 'LKR', occurred_at: new Date().toISOString() }
    case 'accounts':
      return { bank: null, last4: null, type: 'bank', balance: null, balance_at: null, credit_limit: null, color: null, archived: false }
    case 'categories':
      return { icon: '📦', color: '#8b949e', kind: 'expense', sort: 0, archived: false }
    case 'raw_sms':
      return { sender: null, status: 'new', note: null, received_at: new Date().toISOString() }
    case 'budgets':
      return { category_ids: [], period: 'cycle', active: true }
    case 'subscriptions':
      return { currency: 'LKR', cycle: 'monthly', icon: '🔁', match: null, category_id: null, active: true }
    case 'investments':
      return { institution: null, units: null, cost: 0, price: null, price_at: null, rate: null, start_date: null, maturity_date: null, notes: null, closed: false }
    default:
      return {}
  }
}
