import type { Category, Transaction } from './types'
import { addDays, inPeriod, isoDate, startOfDay, type Period } from './period'

export type CatMap = Map<string, Category>

export function catMap(categories: Category[]): CatMap {
  return new Map(categories.map((c) => [c.id, c]))
}

export function isTransfer(t: Transaction, cats: CatMap): boolean {
  return !!t.category_id && cats.get(t.category_id)?.kind === 'transfer'
}
export function isSpend(t: Transaction, cats: CatMap): boolean {
  return t.direction === 'debit' && t.currency === 'LKR' && !t.pending && !isTransfer(t, cats)
}
export function isIncome(t: Transaction, cats: CatMap): boolean {
  return t.direction === 'credit' && t.currency === 'LKR' && !t.pending && !isTransfer(t, cats)
}

export function isPendingForeign(t: Transaction): boolean {
  return !!t.pending
}

export function totals(txns: Transaction[], cats: CatMap, p: Period) {
  let spent = 0
  let income = 0
  let count = 0
  for (const t of txns) {
    if (!inPeriod(t.occurred_at, p)) continue
    if (isSpend(t, cats)) {
      spent += t.amount
      count++
    } else if (isIncome(t, cats)) income += t.amount
  }
  return { spent, income, net: income - spent, count }
}

export interface CatTotal {
  category: Category | null
  id: string
  total: number
  count: number
}

export function byCategory(txns: Transaction[], cats: CatMap, p: Period, kind: 'spend' | 'income' = 'spend'): CatTotal[] {
  const m = new Map<string, CatTotal>()
  for (const t of txns) {
    if (!inPeriod(t.occurred_at, p)) continue
    if (kind === 'spend' ? !isSpend(t, cats) : !isIncome(t, cats)) continue
    const id = t.category_id ?? 'none'
    const e = m.get(id) ?? { category: t.category_id ? cats.get(t.category_id) ?? null : null, id, total: 0, count: 0 }
    e.total += t.amount
    e.count++
    m.set(id, e)
  }
  return [...m.values()].sort((a, b) => b.total - a.total)
}

export function byDay(txns: Transaction[], cats: CatMap, p: Period) {
  const days: { date: string; label: string; total: number }[] = []
  const idx = new Map<string, number>()
  const end = p.end.getTime() > Date.now() ? addDays(startOfDay(new Date()), 1) : p.end
  for (let d = new Date(p.start); d < end; d = addDays(d, 1)) {
    idx.set(isoDate(d), days.length)
    days.push({ date: isoDate(d), label: String(d.getDate()), total: 0 })
  }
  for (const t of txns) {
    if (!isSpend(t, cats) || !inPeriod(t.occurred_at, p)) continue
    const i = idx.get(isoDate(new Date(t.occurred_at)))
    if (i !== undefined) days[i].total += t.amount
  }
  return days
}

export function topMerchants(txns: Transaction[], cats: CatMap, p: Period, n = 5) {
  const m = new Map<string, { name: string; total: number; count: number; category_id: string | null }>()
  for (const t of txns) {
    if (!isSpend(t, cats) || !inPeriod(t.occurred_at, p)) continue
    const key = (t.merchant ?? 'Unknown').toLowerCase()
    const e = m.get(key) ?? { name: t.merchant ?? 'Unknown', total: 0, count: 0, category_id: t.category_id }
    e.total += t.amount
    e.count++
    m.set(key, e)
  }
  return [...m.values()].sort((a, b) => b.total - a.total).slice(0, n)
}

export function needsReview(t: Transaction, cats: CatMap): boolean {
  if (t.pending || t.needs_review) return true
  if (!t.category_id) return true
  return !cats.has(t.category_id)
}
