import type { Investment, InvestmentType } from './types'
import { parseIsoDate } from './period'

export const INVEST_TYPES: Record<InvestmentType, { label: string; icon: string; unit: string; color: string }> = {
  fd: { label: 'Fixed Deposits', icon: '🏦', unit: '', color: '#6b8cef' },
  stock: { label: 'Stocks', icon: '📈', unit: 'shares', color: '#7ccf6b' },
  unit_trust: { label: 'Unit Trusts', icon: '🧺', unit: 'units', color: '#58a6ff' },
  gold: { label: 'Gold', icon: '🥇', unit: 'g', color: '#e0b04b' },
  other: { label: 'Other', icon: '💎', unit: '', color: '#c78bef' },
}

export interface Valuation {
  invested: number
  value: number
  gain: number
  gainPct: number
  /** FD only */
  maturityValue?: number
  daysToMaturity?: number
  progress?: number
}

/** FDs in Sri Lanka usually pay simple interest at maturity; accrue linearly. */
export function valueOf(inv: Investment, now = new Date()): Valuation {
  const invested = Number(inv.cost) || 0
  if (inv.type === 'fd') {
    const rate = (Number(inv.rate) || 0) / 100
    const start = inv.start_date ? parseIsoDate(inv.start_date) : now
    const end = inv.maturity_date ? parseIsoDate(inv.maturity_date) : now
    const totalDays = Math.max(1, (end.getTime() - start.getTime()) / 86400000)
    const elapsed = Math.min(totalDays, Math.max(0, (now.getTime() - start.getTime()) / 86400000))
    const maturityValue = invested * (1 + (rate * totalDays) / 365)
    const value = invested * (1 + (rate * elapsed) / 365)
    return {
      invested,
      value,
      gain: value - invested,
      gainPct: invested ? ((value - invested) / invested) * 100 : 0,
      maturityValue,
      daysToMaturity: Math.ceil((end.getTime() - now.getTime()) / 86400000),
      progress: elapsed / totalDays,
    }
  }
  const units = Number(inv.units) || 0
  const price = inv.price === null || inv.price === undefined ? null : Number(inv.price)
  const value = price === null ? invested : units * price
  return { invested, value, gain: value - invested, gainPct: invested ? ((value - invested) / invested) * 100 : 0 }
}

export function portfolio(list: Investment[], now = new Date()) {
  const open = list.filter((i) => !i.closed)
  let invested = 0
  let value = 0
  const byType: Record<string, { invested: number; value: number }> = {}
  for (const i of open) {
    const v = valueOf(i, now)
    invested += v.invested
    value += v.value
    byType[i.type] ??= { invested: 0, value: 0 }
    byType[i.type].invested += v.invested
    byType[i.type].value += v.value
  }
  const earliest = open
    .map((i) => i.start_date)
    .filter(Boolean)
    .sort()[0]
  const months = earliest ? Math.max(0, Math.round((now.getTime() - parseIsoDate(earliest!).getTime()) / (30.44 * 86400000))) : 0
  return { invested, value, gain: value - invested, gainPct: invested ? ((value - invested) / invested) * 100 : 0, byType, months }
}
