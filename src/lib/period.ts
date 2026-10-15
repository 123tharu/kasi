// Payday-based "months". If payday_day = 25, the cycle runs 25 Sep → 24 Oct.

export interface Period {
  start: Date // inclusive
  end: Date // exclusive
  label: string
}

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function startOfDay(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

/** Cycle containing `ref`, shifted by `offset` cycles (−1 = previous). */
export function cycleFor(paydayDay: number, ref = new Date(), offset = 0): Period {
  const day = Math.min(Math.max(paydayDay || 1, 1), 28)
  let y = ref.getFullYear()
  let m = ref.getMonth()
  if (ref.getDate() < day) m -= 1
  m += offset
  const start = new Date(y, m, day)
  const end = new Date(y, m + 1, day)
  y = start.getFullYear()
  const label =
    day === 1
      ? `${MONTH[start.getMonth()]} ${start.getFullYear()}`
      : `${start.getDate()} ${MONTH[start.getMonth()]} – ${addDays(end, -1).getDate()} ${MONTH[addDays(end, -1).getMonth()]}`
  return { start, end, label }
}

export function weekFor(ref = new Date(), offset = 0): Period {
  const d = startOfDay(ref)
  const dow = (d.getDay() + 6) % 7 // Monday = 0
  const start = addDays(d, -dow + offset * 7)
  const end = addDays(start, 7)
  return { start, end, label: `Week of ${start.getDate()} ${MONTH[start.getMonth()]}` }
}

export function yearFor(ref = new Date(), offset = 0): Period {
  const y = ref.getFullYear() + offset
  return { start: new Date(y, 0, 1), end: new Date(y + 1, 0, 1), label: String(y) }
}

export function inPeriod(iso: string, p: Period): boolean {
  const t = new Date(iso).getTime()
  return t >= p.start.getTime() && t < p.end.getTime()
}

export function daysLeft(p: Period, now = new Date()): number {
  return Math.max(0, Math.ceil((p.end.getTime() - now.getTime()) / 86400000))
}

export function fmtDay(d: Date, now = new Date()): string {
  const a = startOfDay(d).getTime()
  const b = startOfDay(now).getTime()
  if (a === b) return 'Today'
  if (a === b - 86400000) return 'Yesterday'
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
}

export function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function isoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function parseIsoDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function daysUntil(dateStr: string, now = new Date()): number {
  return Math.round((parseIsoDate(dateStr).getTime() - startOfDay(now).getTime()) / 86400000)
}

export function advanceDate(dateStr: string, cycle: 'weekly' | 'monthly' | 'yearly'): string {
  const d = parseIsoDate(dateStr)
  if (cycle === 'weekly') d.setDate(d.getDate() + 7)
  else if (cycle === 'monthly') {
    const day = d.getDate()
    d.setDate(1)
    d.setMonth(d.getMonth() + 1)
    d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  } else d.setFullYear(d.getFullYear() + 1)
  return isoDate(d)
}
