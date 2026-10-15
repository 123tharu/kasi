// Pure logic: turn a raw SMS into the changes we need to make. No I/O here, so it is easy to test.
import { fallbackCategory, matchRule, patternMatches } from '../lib/categorize'
import { bankByCode, parseSms } from '../lib/parser'
import { advanceDate, daysUntil, isoDate } from '../lib/period'
import type { Account, DB, RawSms, Subscription, Transaction } from '../lib/types'

export interface SmsPlan {
  status: RawSms['status']
  note: string | null
  createAccount?: Partial<Account>
  accountId?: string
  accountPatch?: { id: string; patch: Partial<Account> }
  txn?: Partial<Transaction>
  subscriptionPatch?: { id: string; patch: Partial<Subscription> }
}

function last4List(a: Account): string[] {
  return (a.last4 ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function findAccount(accounts: Account[], bank: string | null, last4: string | null): { account: Account | null; adoptLast4?: boolean } {
  const active = accounts.filter((a) => !a.archived)
  if (last4) {
    const hit = active.find((a) => last4List(a).includes(last4) && (!bank || !a.bank || a.bank === bank))
    if (hit) return { account: hit }
  }
  if (bank) {
    const same = active.filter((a) => a.bank === bank)
    if (!last4 && same.length) return { account: same.find((a) => a.type !== 'credit') ?? same[0] }
    if (last4 && same.length === 1 && last4List(same[0]).length === 0) return { account: same[0], adoptLast4: true }
  }
  return { account: null }
}

export function balanceAfter(
  acc: Pick<Account, 'type' | 'balance' | 'balance_at' | 'credit_limit'>,
  r: { amount: number; direction: 'debit' | 'credit'; balance: number | null; availableLimit: number | null; currency: string },
  when: Date,
): Partial<Account> | null {
  if (acc.balance_at && new Date(acc.balance_at).getTime() > when.getTime()) return null // older message
  const at = when.toISOString()
  const lkr = r.currency === 'LKR'
  if (acc.type === 'credit') {
    const avl = r.availableLimit ?? r.balance
    if (avl !== null && acc.credit_limit) return { balance: round(acc.credit_limit - avl), balance_at: at }
    if (acc.balance !== null && lkr) return { balance: round(acc.balance + (r.direction === 'debit' ? r.amount : -r.amount)), balance_at: at }
    return null
  }
  if (r.balance !== null) return { balance: r.balance, balance_at: at }
  if (acc.balance !== null && lkr) return { balance: round(acc.balance + (r.direction === 'credit' ? r.amount : -r.amount)), balance_at: at }
  return null
}

const round = (n: number) => Math.round(n * 100) / 100

export function planSms(sms: RawSms, db: DB): SmsPlan {
  const received = new Date(sms.received_at)
  const r = parseSms(sms.body, sms.sender, received)
  if (r.kind === 'ignore') return { status: 'ignored', note: r.reason }
  if (r.kind === 'fail') return { status: 'failed', note: r.reason }

  const plan: SmsPlan = { status: 'parsed', note: null }
  const bank = bankByCode(r.bank)
  const { account, adoptLast4 } = findAccount(db.accounts, r.bank, r.last4)

  if (account) {
    plan.accountId = account.id
    const patch: Partial<Account> = {}
    if (adoptLast4 && r.last4) patch.last4 = r.last4
    const bal = balanceAfter(account, r, r.occurredAt)
    if (bal) Object.assign(patch, bal)
    if (Object.keys(patch).length) plan.accountPatch = { id: account.id, patch }
  } else {
    const type = r.creditCard ? 'credit' : 'bank'
    plan.createAccount = {
      name: `${bank?.name ?? r.bank ?? 'Bank'}${r.creditCard ? ' Card' : ''}${r.last4 ? ` ••${r.last4}` : ''}`,
      bank: r.bank,
      last4: r.last4,
      type,
      color: bank?.color ?? null,
      balance: type === 'bank' && r.balance !== null ? r.balance : null,
      balance_at: type === 'bank' && r.balance !== null ? r.occurredAt.toISOString() : null,
    }
  }

  const rule = matchRule(r.merchant, db.rules)
  const fallback = rule ? null : fallbackCategory(r.direction, sms.body, db.categories)
  const merchant = rule?.rename_to || r.merchant || (r.direction === 'credit' ? 'Money in' : 'Card payment')

  plan.txn = {
    amount: r.amount,
    direction: r.direction,
    occurred_at: r.occurredAt.toISOString(),
    merchant,
    category_id: rule?.category_id ?? fallback?.id ?? null,
    source: 'sms',
    raw_sms_id: sms.id,
    needs_review: r.directionGuessed || r.currency !== 'LKR',
    currency: r.currency,
    note: r.currency !== 'LKR' ? `Charged in ${r.currency}. Edit to the rupee amount once your bank posts it.` : null,
  }

  // A matching subscription renewal → move its next date forward
  if (r.direction === 'debit' && r.merchant) {
    const m = r.merchant.toLowerCase()
    const sub = db.subscriptions.find(
      (s) => s.active && s.match && patternMatches(m, s.match.toLowerCase()) && Math.abs(daysUntil(s.next_date, r.occurredAt)) <= 10,
    )
    if (sub) {
      let next = sub.next_date
      while (daysUntil(next, r.occurredAt) <= 3) next = advanceDate(next, sub.cycle)
      plan.subscriptionPatch = { id: sub.id, patch: { next_date: next } }
      if (!plan.txn.category_id && sub.category_id) plan.txn.category_id = sub.category_id
    }
  }
  return plan
}

export { isoDate }
