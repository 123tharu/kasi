import { describe, expect, it } from 'vitest'
import { planSms } from './engine'
import type { DB } from '../lib/types'

const db = (): DB => ({
  settings: { user_id: 'u', display_name: null, payday_day: 25, currency: 'LKR', ingest_token: 't', fx_markup: 0 },
  accounts: [],
  categories: [{ id: 'subs', name: 'Subscriptions', icon: '🔁', color: '#000', kind: 'expense', sort: 0, archived: false }],
  transactions: [],
  rules: [{ id: 'r1', pattern: 'netflix', category_id: 'subs', rename_to: null }],
  raw_sms: [],
  budgets: [],
  subscriptions: [],
  investments: [],
})
const sms = (body: string, sender = 'COMBANK') => ({ id: 's1', sender, body, received_at: new Date(2026, 4, 22, 10, 0).toISOString(), status: 'new' as const, note: null })

describe('foreign currency in planSms', () => {
  it('uses the rupee amount from the SMS and keeps the original', () => {
    const p = planSms(sms('Purchase at NETFLIX.COM for USD 9.99 (LKR 3,312.45) on 22/05/26 from card ending #5370.'), db())
    expect(p.txn).toMatchObject({ amount: 3312.45, currency: 'LKR', orig_amount: 9.99, orig_currency: 'USD', category_id: 'subs', needs_review: false })
    expect(p.txn!.fx_rate).toBeCloseTo(331.58, 1)
  })
  it('leaves USD for the store to convert when no rupee amount is given', () => {
    const p = planSms(sms('Transaction Approved on your Card 4111******1234 for USD 11.99 at SPOTIFY', 'NTB'), db())
    expect(p.txn).toMatchObject({ amount: 11.99, currency: 'USD', orig_amount: 11.99, orig_currency: 'USD', fx_rate: null })
  })
})
