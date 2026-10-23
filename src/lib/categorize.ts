import type { Category, CategoryKind, Rule } from './types'

export interface CategorySeed {
  key: string
  name: string
  icon: string
  color: string
  kind: CategoryKind
}

export const DEFAULT_CATEGORIES: CategorySeed[] = [
  { key: 'dining', name: 'Food & Dining', icon: '🍽️', color: '#c98500', kind: 'expense' },
  { key: 'groceries', name: 'Groceries', icon: '🛒', color: '#3987e5', kind: 'expense' },
  { key: 'transport', name: 'Transport', icon: '🛺', color: '#199e70', kind: 'expense' },
  { key: 'fuel', name: 'Fuel', icon: '⛽', color: '#d95926', kind: 'expense' },
  { key: 'shopping', name: 'Shopping', icon: '🛍️', color: '#e66767', kind: 'expense' },
  { key: 'bills', name: 'Bills & Utilities', icon: '💡', color: '#9085e9', kind: 'expense' },
  { key: 'subs', name: 'Subscriptions', icon: '🔁', color: '#d55181', kind: 'expense' },
  { key: 'health', name: 'Health', icon: '💊', color: '#008300', kind: 'expense' },
  { key: 'fun', name: 'Entertainment', icon: '🎬', color: '#9085e9', kind: 'expense' },
  { key: 'home', name: 'Family & Home', icon: '🏠', color: '#199e70', kind: 'expense' },
  { key: 'education', name: 'Education', icon: '📚', color: '#3987e5', kind: 'expense' },
  { key: 'care', name: 'Personal Care', icon: '💇', color: '#d55181', kind: 'expense' },
  { key: 'travel', name: 'Travel', icon: '✈️', color: '#3987e5', kind: 'expense' },
  { key: 'gifts', name: 'Gifts & Donations', icon: '🎁', color: '#d55181', kind: 'expense' },
  { key: 'fees', name: 'Fees & Charges', icon: '🏦', color: '#8b949e', kind: 'expense' },
  { key: 'cash', name: 'Cash Withdrawal', icon: '🏧', color: '#8b949e', kind: 'expense' },
  { key: 'other', name: 'Other', icon: '📦', color: '#6e7681', kind: 'expense' },
  { key: 'salary', name: 'Salary', icon: '💼', color: '#008300', kind: 'income' },
  { key: 'income', name: 'Other Income', icon: '💰', color: '#199e70', kind: 'income' },
  { key: 'refund', name: 'Refunds', icon: '↩️', color: '#3987e5', kind: 'income' },
  { key: 'interest', name: 'Interest & Dividends', icon: '📈', color: '#c98500', kind: 'income' },
  { key: 'transfer', name: 'Transfers', icon: '↔️', color: '#8b949e', kind: 'transfer' },
]

// pattern (lower-case, "contains") → category key. Covers common Sri Lankan merchants.
export const DEFAULT_RULES: [string, string][] = [
  // groceries
  ['keells', 'groceries'], ['cargills', 'groceries'], ['food city', 'groceries'], ['foodcity', 'groceries'],
  ['arpico', 'groceries'], ['glomark', 'groceries'], ['laugfs super', 'groceries'], ['spar', 'groceries'],
  ['sathosa', 'groceries'], ['supermarket', 'groceries'], ['super market', 'groceries'],
  // dining
  ['uber eats', 'dining'], ['pickme food', 'dining'], ['pickmefood', 'dining'], ['kfc', 'dining'], ['pizza hut', 'dining'],
  ['domino', 'dining'], ['mcdonald', 'dining'], ['burger king', 'dining'], ['barista', 'dining'], ['java lounge', 'dining'],
  ['coffee bean', 'dining'], ['perera & sons', 'dining'], ['p&s', 'dining'], ['caravan fresh', 'dining'], ['restaurant', 'dining'],
  ['cafe', 'dining'], ['bakery', 'dining'], ['hotel de pilawoos', 'dining'], ['spice asia', 'dining'], ['delivery', 'dining'],
  ['taco bell', 'dining'], ['subway', 'dining'], ['crepe', 'dining'], ['tea avenue', 'dining'],
  // transport
  ['pickme', 'transport'], ['uber', 'transport'], ['kangaroo', 'transport'], ['parking', 'transport'], ['expressway', 'transport'],
  ['railway', 'transport'], ['sltb', 'transport'],
  // fuel
  ['ceypetco', 'fuel'], ['lanka ioc', 'fuel'], ['ioc', 'fuel'], ['filling station', 'fuel'], ['fuel', 'fuel'], ['petrol', 'fuel'],
  ['sinopec', 'fuel'], ['united petroleum', 'fuel'],
  // bills
  ['dialog', 'bills'], ['mobitel', 'bills'], ['slt', 'bills'], ['hutch', 'bills'], ['airtel', 'bills'], ['ceb', 'bills'],
  ['leco', 'bills'], ['water board', 'bills'], ['nwsdb', 'bills'], ['bill payment', 'bills'], ['insurance', 'bills'],
  ['softlogic life', 'bills'], ['aia', 'bills'], ['ceylinco', 'bills'], ['union assurance', 'bills'],
  // subscriptions
  ['netflix', 'subs'], ['spotify', 'subs'], ['youtube', 'subs'], ['google', 'subs'], ['apple.com', 'subs'], ['icloud', 'subs'],
  ['openai', 'subs'], ['chatgpt', 'subs'], ['anthropic', 'subs'], ['claude', 'subs'], ['adobe', 'subs'], ['dropbox', 'subs'],
  ['discord', 'subs'], ['microsoft', 'subs'], ['canva', 'subs'], ['amazon prime', 'subs'], ['disney', 'subs'], ['notion', 'subs'],
  // shopping
  ['daraz', 'shopping'], ['kapruka', 'shopping'], ['odel', 'shopping'], ['nolimit', 'shopping'], ['no limit', 'shopping'],
  ['fashion bug', 'shopping'], ['cool planet', 'shopping'], ['abans', 'shopping'], ['singer', 'shopping'], ['softlogic', 'shopping'],
  ['damro', 'shopping'], ['amazon', 'shopping'], ['aliexpress', 'shopping'], ['temu', 'shopping'], ['ikman', 'shopping'],
  ['house of fashion', 'shopping'], ['spring and summer', 'shopping'], ['hameedia', 'shopping'], ['bata', 'shopping'],
  // health
  ['pharmacy', 'health'], ['pharmacies', 'health'], ['osu sala', 'health'], ['healthguard', 'health'], ['hospital', 'health'],
  ['asiri', 'health'], ['nawaloka', 'health'], ['durdans', 'health'], ['hemas', 'health'], ['lanka hospitals', 'health'],
  ['channelling', 'health'], ['echannelling', 'health'], ['medical', 'health'], ['dental', 'health'],
  // entertainment
  ['scope cinema', 'fun'], ['pvr', 'fun'], ['cinema', 'fun'], ['steam', 'fun'], ['playstation', 'fun'], ['mytickets', 'fun'],
  // personal care
  ['salon', 'care'], ['spa', 'care'], ['barber', 'care'],
  // travel
  ['srilankan airlines', 'travel'], ['airline', 'travel'], ['booking.com', 'travel'], ['agoda', 'travel'], ['airbnb', 'travel'],
  // education
  ['school', 'education'], ['university', 'education'], ['institute', 'education'], ['udemy', 'education'], ['coursera', 'education'],
  // fees / cash / transfers / income
  ['atm withdrawal', 'cash'], ['cash withdrawal', 'cash'], ['atm', 'cash'],
  ['charges', 'fees'], ['service charge', 'fees'], ['annual fee', 'fees'], ['late payment', 'fees'], ['stamp duty', 'fees'],
  ['ceft transfer', 'transfer'], ['slips transfer', 'transfer'], ['own account', 'transfer'], ['fund transfer', 'transfer'],
  ['salary', 'salary'], ['payroll', 'salary'],
  ['interest', 'interest'], ['dividend', 'interest'],
  ['refund', 'refund'], ['reversal', 'refund'],
]

/** Find the best rule for a merchant (longest matching pattern wins). */
export function matchRule(merchant: string | null | undefined, rules: Rule[]): Rule | null {
  if (!merchant) return null
  const m = merchant.toLowerCase()
  let best: Rule | null = null
  for (const r of rules) {
    const p = r.pattern.toLowerCase().trim()
    if (p && patternMatches(m, p) && (!best || p.length > best.pattern.length)) best = r
  }
  return best
}

/** Pattern must start at a word boundary; short patterns (≤4 chars) must be a whole word,
 *  so "ceb" doesn't match "facebook" and "spar" doesn't match "sparkle". */
export function patternMatches(textLower: string, p: string): boolean {
  let from = 0
  for (;;) {
    const i = textLower.indexOf(p, from)
    if (i < 0) return false
    const before = i === 0 ? ' ' : textLower[i - 1]
    const after = textLower[i + p.length] ?? ' '
    const leftOk = !/[a-z0-9]/.test(before)
    const rightOk = p.length > 4 || !/[a-z0-9]/.test(after)
    if (leftOk && rightOk) return true
    from = i + 1
  }
}

/** Pick a sensible fallback category when no rule matches. */
export function fallbackCategory(direction: 'debit' | 'credit', body: string, categories: Category[]): Category | null {
  const byName = (n: string) => categories.find((c) => c.name === n) ?? null
  if (direction === 'credit') {
    if (/salary|payroll/i.test(body)) return byName('Salary')
    if (/refund|reversal|reversed/i.test(body)) return byName('Refunds')
    if (/interest|dividend/i.test(body)) return byName('Interest & Dividends')
    return null
  }
  if (/\batm\b|cash withdraw|^\s*withdrawal (at|of)\b/i.test(body)) return byName('Cash Withdrawal')
  return null
}

/** A short, reusable pattern to learn from a merchant name, e.g. "Keells Super - Dehiwala" → "keells super". */
export function patternFromMerchant(merchant: string): string {
  const base = merchant.toLowerCase().split(/\s+-\s+|\s*[|,(]/)[0].replace(/[^a-z0-9&.' ]/g, ' ').replace(/\s+/g, ' ').trim()
  const words = base.split(' ').filter((w) => !/^\d+$/.test(w))
  return words.slice(0, 3).join(' ') || merchant.toLowerCase().trim()
}
