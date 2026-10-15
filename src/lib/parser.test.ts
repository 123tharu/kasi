import { describe, expect, it } from 'vitest'
import { isSensitive, parseSms } from './parser'

const RX = new Date(2026, 4, 22, 23, 40) // 22 May 2026 23:40 local

function txn(body: string, sender: string | null = null, rx = RX) {
  const r = parseSms(body, sender, rx)
  if (r.kind !== 'txn') throw new Error(`expected txn, got ${r.kind}: ${r.reason}`)
  return r
}

describe('Sampath', () => {
  it('credit with OTP footer is NOT dropped', () => {
    const body = 'LKR 5,000.00 credited to AC **8758 for PICKME - 37419306\n22/05/2026 23:36:52\nTo Inq Call 0112303050\nGet protected -Do not Share OTP'
    expect(isSensitive(body)).toBe(false)
    const r = txn(body, 'SAMPATHTXN')
    expect(r).toMatchObject({ amount: 5000, direction: 'credit', last4: '8758', bank: 'SAMPATH', merchant: 'Pickme' })
    expect(r.occurredAt.getHours()).toBe(23)
    expect(r.occurredAt.getMinutes()).toBe(36)
  })
  it('debit', () => {
    const r = txn('LKR 4,025.00 debited from AC **8758 for WPY_TAOA_041772_WLT@0347310\n22/05/2026 06:56:52\nTo Inq Call 0112303050\nGet protected -Do not Share OTP', 'SAMPATHTXN')
    expect(r).toMatchObject({ amount: 4025, direction: 'debit', last4: '8758' })
    expect(r.merchant).toMatch(/^Wpy/)
  })
  it('credit card purchase ("Cr Crd" is not a credit)', () => {
    const r = txn('Cr Crd no..**0282 Auth Pmt LKR 2,100.00 at SPICE ASIA - DELIVERY Avl Bal LKR 250,000.00 Enq Call 0112300604\n- Sampath Bank 22-MAY', 'SAMPCCTXN')
    expect(r).toMatchObject({ amount: 2100, direction: 'debit', last4: '0282', merchant: 'Spice Asia - Delivery', balance: 250000, bank: 'SAMPATH' })
    expect(r.creditCard).toBe(true)
  })
})

describe('Nations Trust', () => {
  it('card transaction', () => {
    const r = txn('Transaction Approved on your Card 123456******5678 for LKR 771.51 at PICKME RIDE Available Bal LKR 16730.45  Call 0114315315 for any inquiry.', 'NTB')
    expect(r).toMatchObject({ amount: 771.51, direction: 'debit', last4: '5678', merchant: 'Pickme Ride', balance: 16730.45, bank: 'NTB' })
  })
  it('card payment received', () => {
    const r = txn('Thank you for your payment of LKR 57,018.67 made to Card # 123456*****1234 on 22-05-2026.', 'NTB')
    expect(r).toMatchObject({ amount: 57018.67, direction: 'credit', last4: '1234' })
  })
})

describe('NDB / NSB style', () => {
  it('balance without currency + merchant after date', () => {
    const r = txn('LKR 12,724.00 debited from AC XXXXXXXX7497 as POS TXN on 22 May 2026 22:28 at COLOMBAY COLOMBO 2. Avl Bal 2,582.08 Call 94112448888 for info', 'NDB')
    expect(r).toMatchObject({ amount: 12724, direction: 'debit', last4: '7497', merchant: 'Colombay', balance: 2582.08 })
  })
  it('CEFT inward', () => {
    const r = txn('LKR 60,076.25 credited to AC XXXXXXXX1427 on 22 May 2026 21:53 as CEFTS Inward Transfer. Avl Bal 1,789,349.08 Call 94112448888 for info')
    expect(r).toMatchObject({ amount: 60076.25, direction: 'credit', last4: '1427', balance: 1789349.08, merchant: 'CEFT transfer' })
  })
  it('NSB @ merchant', () => {
    const r = txn('Dear MR SAMPLE,LKR 3,216.00 Debited from your A/c XXXXXXXX5678 on 22/05/2026 at 21:14.AvlBal LKR 9,437.61. @ Wetara Pharamcy & Groc Polgasowita. ATM POS Transaction.Thank you for banking with us.Call Centre 1972.', 'NSB')
    expect(r).toMatchObject({ amount: 3216, direction: 'debit', last4: '5678', balance: 9437.61, merchant: 'Wetara Pharamcy & Groc Polgasowita' })
    expect(r.occurredAt.getHours()).toBe(21)
  })
})

describe('Generic formats (ComBank / HNB / BOC / People\'s style)', () => {
  it('purchase at merchant with card ending', () => {
    const r = txn('Purchase at KEELLS SUPER - DEHIWALA for LKR 2,450.00 on 22/05/26 10:23 AM from card ending #1234. Avl Bal LKR 45,000.00', 'COMBANK')
    expect(r).toMatchObject({ amount: 2450, direction: 'debit', last4: '1234', merchant: 'Keells Super - Dehiwala', balance: 45000, bank: 'COMBANK' })
    expect(r.occurredAt.getHours()).toBe(10)
  })
  it('Rs. amounts and A/C number', () => {
    const r = txn('Dear Customer, Rs.1,500.00 debited from A/C No.XXXX1234 on 22/05/2026 for ATM withdrawal. Bal: Rs.12,000.00', 'BOC')
    expect(r).toMatchObject({ amount: 1500, direction: 'debit', last4: '1234', balance: 12000, bank: 'BOC' })
  })
  it('salary credit', () => {
    const r = txn('Your A/C 8001234567 has been credited with LKR 150,000.00 on 22-05-2026 by ABC COMPANY PVT LTD. Available balance LKR 185,000.00', 'HNB')
    expect(r).toMatchObject({ amount: 150000, direction: 'credit', last4: '4567', merchant: 'Abc Company Pvt Ltd', balance: 185000 })
  })
  it('amount after currency-less card txn does not become last4', () => {
    const r = txn('Your card was used for LKR 2450.00 at UBER EATS on 22/05/2026', 'PEOPLESBANK')
    expect(r.last4).toBeNull()
    expect(r).toMatchObject({ amount: 2450, merchant: 'Uber Eats', bank: 'PEOPLES' })
  })
  it('USD transaction keeps currency', () => {
    const r = txn('Transaction Approved on your Card 4111******1234 for USD 11.99 at SPOTIFY P2F3 STOCKHOLM Available Bal LKR 80,000.00', 'NTB')
    expect(r).toMatchObject({ amount: 11.99, currency: 'USD', merchant: 'Spotify P2f3 Stockholm', lkrAmount: null })
    expect(txn('Transaction Approved on your Card 4111******1234 for USD 11.99 at SPOTIFY P2F3 Available Bal LKR 80,000.00', 'NTB').merchant).toBe('Spotify')
  })
  it('USD with the rupee amount stated uses the bank figure', () => {
    const r = txn('Purchase at NETFLIX.COM for USD 9.99 (LKR 3,312.45) on 22/05/26 from card ending #5370. Avl Bal LKR 80,000.00', 'COMBANK')
    expect(r).toMatchObject({ amount: 9.99, currency: 'USD', lkrAmount: 3312.45, balance: 80000, last4: '5370', merchant: 'Netflix.com' })
  })
  it('EUR purchase', () => {
    const r = txn('Transaction Approved on your Card 377412******1009 for EUR 25.00 at BOOKING.COM Available Bal LKR 200,000.00', 'NTB')
    expect(r).toMatchObject({ amount: 25, currency: 'EUR', lkrAmount: null, balance: 200000 })
  })
})

describe('Real samples from your phone', () => {
  it('ComBank debit card purchase, forwarded 5 days later', () => {
    const rx = new Date(2026, 9, 15, 13, 31, 42)
    const r = txn('Dear Cardholder, Purchase at UBER EATS 852 LK for LKR 2,765.62 on 10/10/26 01:23 PM has been authorised on your debit card ending #5370.', 'COMBANK', rx)
    expect(r).toMatchObject({ amount: 2765.62, direction: 'debit', merchant: 'Uber Eats', last4: '5370', bank: 'COMBANK' })
    expect(r.occurredAt.getDate()).toBe(10)
    expect(r.occurredAt.getMonth()).toBe(9)
    expect(r.occurredAt.getHours()).toBe(13)
    expect(r.occurredAt.getMinutes()).toBe(23)
  })
  it('an amount like 1.00 is not read as a time', () => {
    const rx = new Date(2026, 9, 15, 12, 18, 30)
    const r = txn('LKR 1.00 debited from AC **0000 for TEST SHOP\n15/10/2026 12:18:00\nTo Inq Call 0112303050', 'SAMPATHTXN', rx)
    expect(r.occurredAt.getHours()).toBe(12)
    expect(r.occurredAt.getMinutes()).toBe(18)
  })
})

describe('Ignored messages', () => {
  const ignored = [
    'Your OTP for the transaction of LKR 5,000.00 at DARAZ is 482913. Do not share this with anyone.',
    '482913 is your one time password for HNB online banking.',
    'OTP: 553201. Valid for 5 minutes.',
    'Transaction of LKR 15,000.00 at ABANS was declined due to insufficient funds.',
    'Enjoy 20% off at Pizza Hut with your Sampath card! T&C apply.',
    'Your credit card statement is ready. Total due LKR 45,000.00, minimum due LKR 2,250.00. Payment due date 05/06/2026.',
  ]
  for (const b of ignored) {
    it(b.slice(0, 50), () => {
      expect(parseSms(b, null, RX).kind).toBe('ignore')
    })
  }
  it('call-centre number after "OTP" footer is not a code', () => {
    expect(isSensitive('Do not share OTP. Call 1972 for help')).toBe(false)
  })
})
