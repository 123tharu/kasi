// Exchange rates to LKR, by date. Free, no key: the daily currency-api dataset served from jsDelivr,
// with its Cloudflare mirror and open.er-api.com as fallbacks. Results are cached on the device.
import { isoDate, startOfDay } from './period'

const LS_KEY = 'kasi-fx-cache'
let cache: Record<string, number> | null = null

function load(): Record<string, number> {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(LS_KEY) || '{}')
  } catch {
    cache = {}
  }
  return cache!
}
function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(cache))
  } catch {
    /* ignore */
  }
}

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 8000)
  try {
    const r = await fetch(url, { signal: ctrl.signal })
    if (!r.ok) throw new Error(String(r.status))
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

/** How many rupees one unit of `currency` was worth on `when`. Null if offline / unknown. */
export async function lkrPer(currency: string, when: Date = new Date()): Promise<number | null> {
  const cur = currency.toLowerCase()
  if (cur === 'lkr') return 1
  const today = startOfDay(new Date())
  const day = startOfDay(when) >= today ? 'latest' : isoDate(when)
  const key = `${cur}@${day === 'latest' ? isoDate(today) : day}`
  const c = load()
  if (c[key]) return c[key]

  const tries = [
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${day}/v1/currencies/${cur}.json`,
    `https://${day}.currency-api.pages.dev/v1/currencies/${cur}.json`,
    `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${cur}.json`,
  ]
  for (const url of tries) {
    try {
      const j = (await getJson(url)) as Record<string, Record<string, number>>
      const rate = j?.[cur]?.lkr
      if (rate && isFinite(rate)) {
        c[key] = rate
        save()
        return rate
      }
    } catch {
      /* try next */
    }
  }
  try {
    const j = (await getJson(`https://open.er-api.com/v6/latest/${cur.toUpperCase()}`)) as { rates?: Record<string, number> }
    const rate = j?.rates?.LKR
    if (rate) {
      c[key] = rate
      save()
      return rate
    }
  } catch {
    /* offline */
  }
  return null
}

export const CURRENCIES = ['LKR', 'USD', 'EUR', 'GBP', 'AUD', 'SGD', 'INR', 'AED', 'JPY', 'CAD']

// ---------------------------------------------------------------- double check

export interface RateQuote {
  source: string
  rate: number
}
export interface RateCheck {
  quotes: RateQuote[]
  /** average of the sources that answered */
  rate: number | null
  /** largest difference between sources, in % */
  spreadPct: number | null
  /** true when two independent sources agree within 1% */
  agreed: boolean
}

/** Second, independent provider (FXRatesAPI) with dated history. */
async function fxratesApi(cur: string, when: Date): Promise<number | null> {
  const today = startOfDay(new Date())
  const key = `fxr:${cur}@${isoDate(startOfDay(when) >= today ? today : when)}`
  const c = load()
  if (c[key]) return c[key]
  const url =
    startOfDay(when) >= today
      ? `https://api.fxratesapi.com/latest?base=${cur.toUpperCase()}&currencies=LKR`
      : `https://api.fxratesapi.com/historical?date=${isoDate(when)}&base=${cur.toUpperCase()}&currencies=LKR`
  try {
    const j = (await getJson(url)) as { rates?: Record<string, number> }
    const rate = j?.rates?.LKR
    if (rate && isFinite(rate)) {
      c[key] = rate
      save()
      return rate
    }
  } catch {
    /* unavailable */
  }
  return null
}

/** Gets the rate for that day from two independent providers and says whether they agree. */
export async function checkRates(currency: string, when: Date): Promise<RateCheck> {
  const cur = currency.toLowerCase()
  const [a, b] = await Promise.all([lkrPer(cur, when), fxratesApi(cur, when)])
  const quotes: RateQuote[] = []
  if (a) quotes.push({ source: 'currency-api', rate: a })
  if (b) quotes.push({ source: 'FXRatesAPI', rate: b })
  if (!quotes.length) return { quotes, rate: null, spreadPct: null, agreed: false }
  const rate = quotes.reduce((s, q) => s + q.rate, 0) / quotes.length
  const spreadPct = quotes.length > 1 ? (Math.abs(quotes[0].rate - quotes[1].rate) / rate) * 100 : null
  return { quotes, rate, spreadPct, agreed: spreadPct !== null && spreadPct <= 1 }
}
