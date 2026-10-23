// Sri Lankan bank SMS parser.
// Turns an alert like
//   "Purchase at KEELLS SUPER for LKR 2,450.00 on 12/06/26 from card ending 1234. Avl Bal LKR 45,000.00"
// into { amount: 2450, direction: 'debit', merchant: 'Keells Super', last4: '1234', balance: 45000, ... }

import type { Direction } from './types'

export interface BankInfo {
  code: string
  name: string
  color: string
  match: RegExp
}

export const BANKS: BankInfo[] = [
  { code: 'COMBANK', name: 'Commercial Bank', color: '#1f6fb5', match: /com\s*bank|commercial\s*bank|combnk/i },
  { code: 'SAMPATH', name: 'Sampath Bank', color: '#e2771d', match: /sampath|\bsamp(cc|txn)/i },
  { code: 'HNB', name: 'HNB', color: '#f2b705', match: /\bhnb\b|hatton\s*national/i },
  { code: 'NTB', name: 'Nations Trust', color: '#2e7d32', match: /\bntb\b|ntbank|nations\s*trust|\bamex\b|american express/i },
  { code: 'BOC', name: 'Bank of Ceylon', color: '#f5c518', match: /\bboc\b|bank\s*of\s*ceylon/i },
  { code: 'PEOPLES', name: "People's Bank", color: '#c62828', match: /people'?s\s*(bank|bnk|bk)|peoples?bn?k|\bpbank\b|\bpeoples\b/i },
  { code: 'SEYLAN', name: 'Seylan Bank', color: '#8e1b4a', match: /seylan/i },
  { code: 'DFCC', name: 'DFCC Bank', color: '#004b8d', match: /\bdfcc\b/i },
  { code: 'NDB', name: 'NDB Bank', color: '#00529b', match: /\bndb\b|national development bank/i },
  { code: 'NSB', name: 'NSB', color: '#ef6c00', match: /\bnsb\b|national savings bank/i },
  { code: 'PABC', name: 'Pan Asia Bank', color: '#0d47a1', match: /pan\s*asia|\bpabc\b/i },
  { code: 'UNION', name: 'Union Bank', color: '#1565c0', match: /union\s*bank|\bubc\b/i },
  { code: 'AMANA', name: 'Amana Bank', color: '#00897b', match: /amana/i },
  { code: 'CARGILLS', name: 'Cargills Bank', color: '#d32f2f', match: /cargills\s*bank/i },
  { code: 'HSBC', name: 'HSBC', color: '#db0011', match: /\bhsbc\b/i },
  { code: 'SCB', name: 'Standard Chartered', color: '#0072aa', match: /standard\s*chartered|\bscb\b|\bstanchart\b/i },
  { code: 'FRIMI', name: 'FriMi', color: '#e91e63', match: /frimi/i },
  { code: 'GENIE', name: 'Genie', color: '#6a1b9a', match: /\bgenie\b/i },
  { code: 'EZCASH', name: 'eZ Cash', color: '#ff6f00', match: /ez\s*cash/i },
]

export function detectBank(sender: string | null | undefined, body: string): BankInfo | null {
  if (sender) {
    const s = BANKS.find((b) => b.match.test(sender) || b.code.toLowerCase() === sender.toLowerCase())
    if (s) return s
  }
  return BANKS.find((b) => b.match.test(body)) ?? null
}

export function bankByCode(code: string | null | undefined): BankInfo | null {
  if (!code) return null
  return BANKS.find((b) => b.code === code) ?? null
}

export type ParseResult =
  | { kind: 'ignore'; reason: string }
  | { kind: 'fail'; reason: string }
  | {
      kind: 'txn'
      amount: number
      currency: string
      /** When a foreign-currency SMS also states the rupee amount, e.g. "USD 11.99 (LKR 3,650.00)" */
      lkrAmount: number | null
      direction: Direction
      directionGuessed: boolean
      merchant: string | null
      last4: string | null
      bank: string | null
      balance: number | null
      availableLimit: number | null
      occurredAt: Date
      creditCard: boolean
    }

// ---------- helpers ----------

const CUR = String.raw`(?:LKR|SLR|Rs\.?|USD|US\$|\$|EUR|GBP|AUD|SGD|INR|AED|JPY|CAD)`
const NUM = String.raw`(\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)`
const MONEY_A = new RegExp(String.raw`(?<![A-Za-z])(${CUR})\s*[:.]?\s*${NUM}`, 'gi')
const MONEY_B = new RegExp(String.raw`${NUM}\s*(LKR|SLR|USD|EUR|GBP|AUD|SGD|INR|AED)\b`, 'gi')

interface Money {
  index: number
  end: number
  value: number
  currency: string
  label: 'amount' | 'balance' | 'limit' | 'due'
}

function normCurrency(c: string): string {
  const u = c.toUpperCase().replace(/\./g, '')
  if (u === 'RS' || u === 'SLR' || u === 'LKR') return 'LKR'
  if (u === '$' || u === 'US$') return 'USD'
  return u
}

function findMoney(body: string): Money[] {
  const out: Money[] = []
  for (const m of body.matchAll(MONEY_A)) {
    out.push({ index: m.index!, end: m.index! + m[0].length, value: parseFloat(m[2].replace(/,/g, '')), currency: normCurrency(m[1]), label: 'amount' })
  }
  for (const m of body.matchAll(MONEY_B)) {
    const overlaps = out.some((o) => m.index! < o.end && m.index! + m[0].length > o.index)
    if (!overlaps) out.push({ index: m.index!, end: m.index! + m[0].length, value: parseFloat(m[1].replace(/,/g, '')), currency: normCurrency(m[2]), label: 'amount' })
  }
  // Balances printed without a currency, e.g. "Avl Bal 2,582.08"
  for (const m of body.matchAll(new RegExp(String.raw`(?:bal|balance)\s*[:.]?\s*${NUM}`, 'gi'))) {
    const start = m.index! + m[0].length - m[1].length
    const overlaps = out.some((o) => start < o.end && m.index! + m[0].length > o.index)
    if (!overlaps) out.push({ index: start, end: m.index! + m[0].length, value: parseFloat(m[1].replace(/,/g, '')), currency: 'LKR', label: 'balance' })
  }
  out.sort((a, b) => a.index - b.index)
  for (const m of out) {
    const before = body.slice(Math.max(0, m.index - 40), m.index).toLowerCase()
    if (/(limit|avl\.?\s*cr|available\s*credit|credit\s*available)[\s.:\-]*(is|of|:)?[\s.:\-]*$/.test(before)) m.label = 'limit'
    else if (/(bal|balance|bal\.)[\s.:\-]*(is|of|:|now)?[\s.:\-]*$/.test(before) || /(avl|available)[\s.:\-]*$/.test(before)) m.label = 'balance'
    else if (/(due|outstanding|o\/s|statement balance|min(imum)?\.?\s*(amount|payment)?)[\s.:\-]*(is|of|:)?[\s.:\-]*$/.test(before)) m.label = 'due'
  }
  return out.filter((m) => !isNaN(m.value))
}

const MERCHANT_STOP = String.raw`(?=\s+(?:on|for|from|using|with|via|by|card|a\/c|ac|acc|account|ref|reference|dated|date|avl|available|bal|balance|is|has|was|of|amount|amt|txn|\d{1,2}[\/\-.]\d{1,2})\b|\s*[,;]|\.\s|\.$|\s+-\s+(?:avl|bal|ref)|$)`

function cleanMerchant(raw: string): string | null {
  let s = raw.replace(/\s+/g, ' ').trim()
  s = s.replace(/^(the|merchant|m\/s)\s+/i, '')
  s = s.replace(/[\s.,:;\-*]+$/, '')
  s = s.replace(/\s*@\s*\d+$/, '').replace(/\s+-\s*\d{4,}$/, '')
  s = s.replace(/\s+(lk|lka|sri\s*lanka|colombo\s*\d{1,2})$/i, '')
  // phone numbers and country codes: "GOOGLE ONE 650-2530000 US", "MOBITEL (PVT) LTD 0712755777 LK"
  s = s.replace(/\s+(LK|US|SE|IE|GB|UK|SG|IN|AE|AU|NL|DE|FR|HK|CA|JP|LU|CY|MT)$/i, '')
  s = s.replace(/\s+\+?\d[\d\s-]{6,}\d$/, '')
  // store / terminal codes at the end: "UBER EATS 852" → "UBER EATS"
  s = s.replace(/(\s+#?\d{2,8})+$/, '')
  // payment-processor codes: "SPOTIFY P2F3", "UBER *TRIP X7Q2"
  s = s.replace(/\s+(LK|US|SE|IE|GB|UK|SG|IN|AE|AU|NL|DE|FR|HK|CA|JP|LU|CY|MT)$/i, '')
  // processor code (+ the city after it): "SPOTIFY P47EA6D4BC STOCKHOLM" → "SPOTIFY"
  s = s.replace(/\s+(?=[a-z*]*\d)(?=\d*[a-z])[a-z0-9*]{3,12}(\s+[a-z]+)?$/i, '').replace(/\*\s*$/, '')
  s = s.replace(/\s{2,}/g, ' ').trim()
  if (s.length < 2) return null
  if (/^(your|a\/c|ac\b|acc|account|card|crd|cardholder|customer|x{2,}|\*|\d|lkr|rs\.?\b|usd|any\b|more\b|info|inquir|enquir|further|details|banking|us\b|inq|enq|call\b|get\b|for\b)/i.test(s)) return null
  if (s.length > 48) s = s.slice(0, 48).trim()
  return titleCase(s)
}

export function titleCase(s: string): string {
  // Leave mixed-case strings alone; title-case SHOUTING ones.
  if (s !== s.toUpperCase()) return s
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(Atm|Pos|Ceb|Leco|Slt|Kfc|Usd|Lkr|Hnb|Boc|Ntb|Dfcc|Ndb|Nsb|Ceft|Slips|Lanka Qr|Qr)\b/g, (w) => w.toUpperCase())
    .replace(/\.(Com|Lk|Net|Org|Io)\b/g, (w) => w.toLowerCase())
}

function findMerchant(body: string, direction: Direction | null): string | null {
  const patterns: RegExp[] = [
    new RegExp(String.raw`merchant(?:\s*name)?\s*[:\-]\s*(.+?)${MERCHANT_STOP}`, 'i'),
    new RegExp(String.raw`\bat\s+(?!\d{1,2}[:.]\d{2})(.+?)${MERCHANT_STOP}`, 'i'),
    new RegExp(String.raw`@\s*(?!\d{1,2}[:.]\d{2})(.+?)${MERCHANT_STOP}`, 'i'),
  ]
  if (direction === 'credit') {
    patterns.push(new RegExp(String.raw`\b(?:from|by)\s+(.+?)${MERCHANT_STOP}`, 'i'))
  } else {
    patterns.push(new RegExp(String.raw`\b(?:paid\s+to|transfer(?:red)?\s+to|payment\s+to|to)\s+(.+?)${MERCHANT_STOP}`, 'i'))
  }
  // "... credited to AC **8758 for PICKME - 37419306"
  patterns.push(new RegExp(String.raw`\bfor\s+(.+?)${MERCHANT_STOP}`, 'i'))
  for (const p of patterns) {
    for (const m of body.matchAll(new RegExp(p.source, 'gi'))) {
      const c = cleanMerchant(m[1])
      if (c) return c
    }
  }
  if (/\batm\b|cash\s*withdraw/i.test(body)) return 'ATM withdrawal'
  if (/\bcefts?\b/i.test(body)) return 'CEFT transfer'
  if (/\bslips\b/i.test(body)) return 'SLIPS transfer'
  if (/\blanka\s*qr\b/i.test(body)) return 'LankaQR payment'
  return null
}

function findLast4(body: string): string | null {
  const kw = /(card|\bcrd\b|a\/c|\bac\b|\bacc\b|account|acct)/gi
  for (const k of body.matchAll(kw)) {
    const rest = body.slice(k.index! + k[0].length, k.index! + k[0].length + 50)
    const m = rest.match(/^([^\d*xX•]{0,25}?)([0-9Xx*•#.\-]{3,26})/)
    if (!m) continue
    if (/lkr|rs\b|rs\.|usd|\bon\b|\bat\b|\bfor\b/i.test(m[1])) continue
    const run = m[2].replace(/[.\-]+$/, '')
    if (/^\d+\.\d{1,2}$/.test(run)) continue // an amount like 2450.00
    const d = run.match(/(\d{3,4})$/)
    if (!d) continue
    return d[1]
  }
  return null
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']

function findDate(body: string, received: Date): Date {
  const candidates: Date[] = []
  const year4 = (y: number) => (y < 100 ? 2000 + y : y)
  for (const m of body.matchAll(/\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g)) {
    candidates.push(new Date(+m[1], +m[2] - 1, +m[3]))
  }
  for (const m of body.matchAll(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/g)) {
    const a = +m[1], b = +m[2], y = year4(+m[3])
    if (b <= 12) candidates.push(new Date(y, b - 1, a)) // dd/mm (Sri Lanka)
    if (a <= 12 && b <= 31) candidates.push(new Date(y, a - 1, b)) // mm/dd fallback
  }
  for (const m of body.matchAll(/\b(\d{1,2})[\s\-]?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*[\s\-,]*(\d{2,4})?\b/gi)) {
    const y = m[3] ? year4(+m[3]) : received.getFullYear()
    candidates.push(new Date(y, MONTHS.indexOf(m[2].toLowerCase()), +m[1]))
  }
  // Trust the date printed in the SMS when it's plausible: up to 60 days old (forwarded or pasted
  // late) and at most a day ahead of when we received it.
  const valid = candidates.filter((d) => {
    const diff = d.getTime() - received.getTime()
    return !isNaN(d.getTime()) && diff > -60 * 86400000 && diff < 86400000
  })
  if (!valid.length) return received
  valid.sort((x, y) => Math.abs(x.getTime() - received.getTime()) - Math.abs(y.getTime() - received.getTime()))
  const d = valid[0]
  // A time is hh:mm[:ss] [am/pm], or hh.mm only with am/pm. Never part of an amount ("LKR 1.00").
  let t: RegExpMatchArray | null = null
  for (const m of body.matchAll(/\b(\d{1,2})(?::(\d{2})(?::(\d{2}))?\s*(am|pm)?|\.(\d{2})\s*(am|pm))\b/gi)) {
    const before = body.slice(Math.max(0, m.index! - 6), m.index!)
    if (/(lkr|rs\.?|usd|[,.])\s*$/i.test(before)) continue
    t = [m[0], m[1], m[2] ?? m[5], m[3], m[4] ?? m[6]] as unknown as RegExpMatchArray
    break
  }
  if (t) {
    let h = +t[1]
    const min = +t[2]
    if (t[4]) {
      const pm = t[4].toLowerCase() === 'pm'
      if (pm && h < 12) h += 12
      if (!pm && h === 12) h = 0
    }
    if (h < 24 && min < 60) {
      d.setHours(h, min, t[3] ? +t[3] : 0, 0)
      return d.getTime() > received.getTime() + 5 * 60000 ? received : d
    }
  }
  if (d.toDateString() === received.toDateString()) return received
  d.setHours(12, 0, 0, 0)
  return d
}

function findDirection(lower: string): { dir: Direction | null } {
  const t = lower
    .replace(/credit\s*card|\bcr\.?\s*crd\b|\bcr\.?\s*card\b/g, 'cc-card')
    .replace(/debit\s*card|\bdr\.?\s*crd\b/g, 'dc-card')
    .replace(/credit\s*limit/g, 'cc-limit')
    .replace(/available\s*credit/g, 'avl-cc')

  const cr = t.search(/\b(credited|has been credited)/)
  const dr = t.search(/\b(debited|has been debited)/)
  if (cr >= 0 && (dr < 0 || cr < dr)) return { dir: 'credit' }
  if (dr >= 0) return { dir: 'debit' }

  if (/\b(refund(ed)?|reversal|reversed|received|deposit(ed)?|inward|remittance|salary|cashback credited|thank you for (your )?payment)\b/.test(t)) return { dir: 'credit' }
  if (/\b(purchase[d]?|spent|used|payment|pmt|paid|withdraw(n|al)?|atm|transferred to|transfer to|fund transfer|outward|charged|pos|e-?commerce|online (txn|transaction)|txn|transaction|approved|bill pay)/.test(t)) return { dir: 'debit' }
  return { dir: null }
}

// An OTP / verification message carries an actual code. A transaction alert that merely
// says "Do not share OTP" in its footer is NOT sensitive. Mirrors kasi_is_sensitive() in SQL.
const SENSITIVE = [
  /(otp|one[ -]?time ?(password|pin|code)?|verification ?code|security ?code|passcode|auth(entication)? ?code)[\s\S]{0,90}?(\bis\b|:|=)\s*\d{4,8}\b(?![.,]\d)/i,
  /(otp|one[ -]?time password)\s*[:\-=]?\s*\d{4,8}\b(?![.,]\d)/i,
  /\b\d{4,8}\b\s*(is|as) (your|the) (otp|one[ -]?time|verification|security|pin|password|code)/i,
]
export function isSensitive(text: string): boolean {
  return SENSITIVE.some((r) => r.test(text))
}

/** Wording that only a real transaction alert uses. */
const STRONG = /(debited|credited|purchase (at|of)|withdrawal (at|of)|cash withdrawal|transaction (approved|of)|\btxn (of|at)|auth(orised|orized)? pmt|paid to|transferred|transfer (to|from|of)|payment of|has been (debited|credited|authori[sz]ed)|deposit(ed)? (to|of|in)|used for|spent|ceft|slips)/i

const BANKISH = /(debit|credit|card|a\/c|\bacc?\b|account|purchase|transaction|\btxn|withdraw|transfer|payment|\bpmt\b|deposit|remittance|balance|\bbal\b|\bavl|authori[sz]ed|approved|ceft|slips)/i

/** Same rule as the server: an amount AND bank wording. "Bring Rs.500 for the cake" is not a bank alert. */
export function hasMoney(text: string): boolean {
  const amount = /(?<![a-z])(lkr|slr|rs\.?|usd|us\$|eur|gbp|aud|sgd|inr|aed)\s*[:.]?\s*\d/i.test(text) || /\d(\.\d{1,2})?\s*(lkr|usd)\b/i.test(text)
  return amount && BANKISH.test(text)
}

export interface ImportedSms {
  sender: string | null
  body: string
  received_at: string
}

/** Reads an "SMS Backup & Restore" XML export (received messages only). */
export function parseSmsBackupXml(xml: string): ImportedSms[] {
  const doc = new DOMParser().parseFromString(xml, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) throw new Error('This file is not an SMS Backup & Restore XML file.')
  const out: ImportedSms[] = []
  for (const el of Array.from(doc.getElementsByTagName('sms'))) {
    if (el.getAttribute('type') && el.getAttribute('type') !== '1') continue // 1 = received
    const body = el.getAttribute('body') ?? ''
    const ms = Number(el.getAttribute('date'))
    if (!body || !ms) continue
    out.push({ sender: el.getAttribute('address'), body, received_at: new Date(ms).toISOString() })
  }
  return out
}

// ---------- main ----------

export function parseSms(body: string, sender: string | null, received: Date = new Date()): ParseResult {
  const text = body.replace(/\s+/g, ' ').trim()
  const lower = text.toLowerCase()

  if (isSensitive(text)) return { kind: 'ignore', reason: 'Security code' }
  if (/\b(declined|unsuccessful|not successful|failed|insufficient|rejected|could not be processed)\b/i.test(text)) {
    return { kind: 'ignore', reason: 'Declined / failed transaction' }
  }

  if (!BANKISH.test(text)) return { kind: 'ignore', reason: 'Not a bank alert' }

  // Who sent it? Telecoms, shops and apps (SLT-Mobitel, Pizza Hut…) are never bank alerts, even when
  // they mention rupees. Phone numbers / unknown senders must read like a real transaction.
  const senderBank = sender ? BANKS.find((b) => b.match.test(sender) || b.code.toLowerCase() === sender.toLowerCase()) ?? null : null
  const phoneSender = !!sender && /^\+?[\d\s-]{6,}$/.test(sender)
  const strong = STRONG.test(text)
  if (sender && !senderBank && !phoneSender) return { kind: 'ignore', reason: `Not from a bank (${sender})` }
  if ((!sender || phoneSender) && !strong) return { kind: 'ignore', reason: 'Not a transaction alert' }

  const money = findMoney(text)
  const amounts = money.filter((m) => m.label === 'amount')
  const { dir } = findDirection(lower)

  const isStatement = /(e-?statement|statement (is )?(ready|generated|date)|minimum (amount )?due|min\.? (amt|amount|payment)? ?due|payment due|due date)/i.test(text)
  if (isStatement && !/(debited|credited)/i.test(text)) return { kind: 'ignore', reason: 'Statement / due-date reminder' }

  const promo = /(offer|discount|promo|%\s*off|cashback|\bwin\b|apply now|visit us|t&c|conditions apply|exclusive|enjoy|instalment plan|easy payment plan|\bepp\b|loan|leasing)/i.test(text)

  if (!amounts.length) {
    if (promo || !money.length) return { kind: 'ignore', reason: 'No transaction amount' }
    // Only a balance is mentioned, e.g. "Your balance is LKR 5,000"
    return { kind: 'fail', reason: 'Balance-only message' }
  }
  // Bank marketing ("Pay Bills. Collect Cashback! … up to Rs1,500") has no real transaction verb.
  if (promo && (!dir || !strong)) return { kind: 'ignore', reason: 'Promotion' }

  const main = amounts[0]
  const lkrEquivalent = main.currency !== 'LKR' ? amounts.find((m) => m.index > main.index && m.currency === 'LKR') ?? null : null
  const balance = money.find((m) => m.label === 'balance' && m.index > main.index) ?? money.find((m) => m.label === 'balance')
  const limit = money.find((m) => m.label === 'limit')
  const bank = detectBank(sender, text)

  return {
    kind: 'txn',
    amount: main.value,
    currency: main.currency,
    lkrAmount: lkrEquivalent ? lkrEquivalent.value : null,
    direction: dir ?? 'debit',
    directionGuessed: dir === null,
    merchant: findMerchant(text, dir),
    last4: findLast4(text),
    bank: bank?.code ?? null,
    balance: balance ? balance.value : null,
    availableLimit: limit ? limit.value : null,
    occurredAt: findDate(text, received),
    creditCard: /credit\s*card|\bcr\.?\s*cr?d\b|\bamex\b|american express|avl\.?\s*cr|available\s*credit|credit\s*limit/i.test(text),
  }
}
