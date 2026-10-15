import { DEFAULT_CATEGORIES, DEFAULT_RULES } from '../lib/categorize'
import { addDays, isoDate } from '../lib/period'
import type { Account, Budget, Category, DB, Investment, RawSms, Rule, Subscription, Transaction } from '../lib/types'

let seed = 42
const rnd = () => {
  seed = (seed * 16807) % 2147483647
  return (seed - 1) / 2147483646
}
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)]
const id = () => crypto.randomUUID()

export function buildCategoriesAndRules() {
  const categories: Category[] = DEFAULT_CATEGORIES.map((c, i) => ({ id: id(), name: c.name, icon: c.icon, color: c.color, kind: c.kind, sort: i, archived: false }))
  const byKey = new Map(DEFAULT_CATEGORIES.map((c, i) => [c.key, categories[i]]))
  const rules: Rule[] = DEFAULT_RULES.map(([pattern, key]) => ({ id: id(), pattern, category_id: byKey.get(key)!.id, rename_to: null }))
  return { categories, rules, byKey }
}

export function demoDb(): DB {
  seed = 42
  const now = new Date()
  const { categories, rules, byKey } = buildCategoriesAndRules()
  const cat = (k: string) => byKey.get(k)!.id

  const accounts: Account[] = [
    { id: id(), name: 'Personal spending', bank: 'COMBANK', last4: '7842', type: 'bank', balance: 86450.25, balance_at: now.toISOString(), credit_limit: null, color: '#1f6fb5', archived: false },
    { id: id(), name: 'Salary account', bank: 'SAMPATH', last4: '3401', type: 'bank', balance: 185000, balance_at: now.toISOString(), credit_limit: null, color: '#e2771d', archived: false },
    { id: id(), name: 'Amex card', bank: 'NTB', last4: '1009', type: 'credit', balance: 42310, balance_at: now.toISOString(), credit_limit: 300000, color: '#2e7d32', archived: false },
    { id: id(), name: 'Cash', bank: 'CASH', last4: null, type: 'cash', balance: 6500, balance_at: now.toISOString(), credit_limit: null, color: '#7ccf6b', archived: false },
  ]
  const [combank, sampath, amex, cash] = accounts

  const spendPool: [string, string, number, number, Account][] = [
    ['Keells Super', 'groceries', 1800, 9500, combank],
    ['Cargills Food City', 'groceries', 1200, 7800, combank],
    ['Uber Eats', 'dining', 1400, 4200, amex],
    ['PickMe Food', 'dining', 1100, 3600, amex],
    ['Barista', 'dining', 900, 2600, combank],
    ['Perera & Sons', 'dining', 600, 2200, cash],
    ['PickMe', 'transport', 350, 2400, combank],
    ['Uber', 'transport', 450, 2800, amex],
    ['Lanka IOC', 'fuel', 4500, 9000, combank],
    ['Daraz', 'shopping', 1500, 18000, amex],
    ['Odel', 'shopping', 3500, 14000, amex],
    ['Healthguard Pharmacy', 'health', 800, 5200, combank],
    ['Scope Cinemas', 'fun', 1800, 4000, amex],
  ]

  const transactions: Transaction[] = []
  const tx = (d: Date, merchant: string, k: string, amount: number, acc: Account, direction: 'debit' | 'credit' = 'debit', source: 'sms' | 'manual' = 'sms'): Transaction => ({
    id: id(),
    account_id: acc.id,
    category_id: cat(k),
    amount: Math.round(amount * 100) / 100,
    direction,
    occurred_at: d.toISOString(),
    merchant,
    note: null,
    source,
    raw_sms_id: null,
    needs_review: false,
    currency: 'LKR',
  })

  for (let back = 100; back >= 0; back--) {
    const day = addDays(now, -back)
    const n = back === 0 ? 3 : Math.floor(rnd() * 4) + (day.getDay() === 6 ? 2 : 0)
    for (let i = 0; i < n; i++) {
      const [m, k, lo, hi, acc] = pick(spendPool)
      const d = new Date(day)
      d.setHours(8 + Math.floor(rnd() * 13), Math.floor(rnd() * 60))
      if (d > now) d.setTime(now.getTime() - (i + 1) * 3600000)
      transactions.push(tx(d, m, k, lo + rnd() * (hi - lo), acc, 'debit', acc === cash ? 'manual' : 'sms'))
    }
    if (day.getDate() === 25) {
      const d = new Date(day)
      d.setHours(9, 30)
      transactions.push(tx(d, 'CEFT transfer - Salary', 'salary', 250000, sampath, 'credit'))
      const d2 = new Date(day)
      d2.setHours(18, 5)
      transactions.push(tx(d2, 'Own account transfer', 'transfer', 120000, sampath, 'debit'))
      transactions.push(tx(d2, 'Own account transfer', 'transfer', 120000, combank, 'credit'))
    }
    if (day.getDate() === 3) {
      const d = new Date(day)
      d.setHours(10, 12)
      transactions.push(tx(d, 'Dialog Axiata', 'bills', 4890, combank))
      transactions.push(tx(d, 'CEB Bill Payment', 'bills', 7340, combank))
    }
    if (day.getDate() === 14) transactions.push(tx(day, 'Spotify', 'subs', 649, amex))
    if (day.getDate() === 18) transactions.push(tx(day, 'Netflix', 'subs', 2650, amex))
    if (day.getDate() === 9) transactions.push(tx(day, 'ATM withdrawal', 'cash', 10000, combank))
  }
  // a couple that need review
  transactions.push({ ...tx(addDays(now, -1), 'Wpy_taoa_041772_wlt', 'other', 4025, combank), category_id: null })
  transactions.push({ ...tx(addDays(now, -2), 'Card payment', 'other', 1250, amex), category_id: null, needs_review: true })
  transactions.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))

  const minute = (m: number) => new Date(now.getTime() - m * 60000).toISOString()
  const raw_sms: RawSms[] = [
    { id: id(), sender: 'NTB', body: 'Transaction Approved on your Card 377412******1009 for LKR 2,250.00 at UBER EATS Available Bal LKR 255,440.00  Call 0114315315 for any inquiry.', received_at: minute(4), status: 'new', note: null },
    { id: id(), sender: 'COMBANK', body: 'Purchase at KEELLS SUPER - HAVELOCK for LKR 3,420.50 on ' + fmtD(now) + ' from card ending #7842. Avl Bal LKR 83,029.75', received_at: minute(2), status: 'new', note: null },
    { id: id(), sender: 'SAMPATHTXN', body: 'Your one-time password is 448210. Do not share it with anyone.', received_at: minute(1), status: 'new', note: null },
  ]

  const budgets: Budget[] = [
    { id: id(), name: 'Eating out', amount: 35000, category_ids: [cat('dining')], period: 'cycle', active: true },
    { id: id(), name: 'Groceries', amount: 40000, category_ids: [cat('groceries')], period: 'cycle', active: true },
    { id: id(), name: 'Getting around', amount: 25000, category_ids: [cat('transport'), cat('fuel')], period: 'cycle', active: true },
    { id: id(), name: 'Shopping', amount: 20000, category_ids: [cat('shopping')], period: 'cycle', active: true },
  ]

  const nextOn = (day: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), day)
    if (d < now) d.setMonth(d.getMonth() + 1)
    return isoDate(d)
  }
  const subscriptions: Subscription[] = [
    { id: id(), name: 'Spotify', amount: 649, currency: 'LKR', cycle: 'monthly', next_date: nextOn(14), icon: '🎧', match: 'spotify', category_id: cat('subs'), active: true },
    { id: id(), name: 'Netflix', amount: 2650, currency: 'LKR', cycle: 'monthly', next_date: nextOn(18), icon: '🎬', match: 'netflix', category_id: cat('subs'), active: true },
    { id: id(), name: 'Dialog Fibre', amount: 4890, currency: 'LKR', cycle: 'monthly', next_date: nextOn(3), icon: '📶', match: 'dialog', category_id: cat('bills'), active: true },
    { id: id(), name: 'iCloud+ 200GB', amount: 1100, currency: 'LKR', cycle: 'monthly', next_date: nextOn(21), icon: '☁️', match: 'icloud', category_id: cat('subs'), active: true },
  ]

  const d = (monthsAgo: number, days = 0) => isoDate(addDays(new Date(now.getFullYear(), now.getMonth() - monthsAgo, now.getDate()), days))
  const investments: Investment[] = [
    { id: id(), type: 'fd', name: '12-month FD', institution: 'Sampath Bank', units: null, cost: 500000, price: null, price_at: null, rate: 9.5, start_date: d(8), maturity_date: d(-4), notes: null, closed: false },
    { id: id(), type: 'fd', name: '6-month FD', institution: 'HNB', units: null, cost: 250000, price: null, price_at: null, rate: 8.25, start_date: d(2), maturity_date: d(-4), notes: null, closed: false },
    { id: id(), type: 'stock', name: 'JKH.N0000', institution: 'CSE', units: 12000, cost: 236400, price: 21.4, price_at: now.toISOString(), rate: null, start_date: d(6), maturity_date: null, notes: null, closed: false },
    { id: id(), type: 'unit_trust', name: 'CAL Money Market Fund', institution: 'CAL', units: 4100, cost: 150000, price: 39.12, price_at: now.toISOString(), rate: null, start_date: d(5), maturity_date: null, notes: null, closed: false },
    { id: id(), type: 'gold', name: '22K gold chain', institution: null, units: 8, cost: 215000, price: 29850, price_at: now.toISOString(), rate: null, start_date: d(7), maturity_date: null, notes: '22K, per gram', closed: false },
  ]

  return {
    settings: { user_id: 'demo', display_name: 'Tharindu', payday_day: 25, currency: 'LKR', ingest_token: 'demo-token' },
    accounts,
    categories,
    transactions,
    rules,
    raw_sms,
    budgets,
    subscriptions,
    investments,
  }
}

function fmtD(d: Date) {
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getFullYear()).slice(2)} ${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`
}
