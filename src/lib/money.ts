export function fmt(n: number | null | undefined, opts: { cents?: boolean; sign?: boolean; currency?: string } = {}): string {
  if (n === null || n === undefined || isNaN(n)) return '—'
  const cents = opts.cents ?? Math.abs(n) < 1000
  const s = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })
  const sign = n < 0 ? '−' : opts.sign && n > 0 ? '+' : ''
  const cur = opts.currency && opts.currency !== 'LKR' ? `${opts.currency} ` : 'Rs. '
  return `${sign}${cur}${s}`
}

/** Compact: Rs. 1.25M, Rs. 85K */
export function fmtShort(n: number): string {
  const a = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (a >= 1e6) return `${sign}Rs. ${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2).replace(/\.?0+$/, '')}M`
  if (a >= 1e4) return `${sign}Rs. ${(a / 1e3).toFixed(0)}K`
  return fmt(n, { cents: false })
}

export function pct(n: number, digits = 1): string {
  if (!isFinite(n)) return '—'
  return `${n >= 0 ? '' : '−'}${Math.abs(n).toFixed(digits)}%`
}

export function parseAmount(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? 0 : n
}
