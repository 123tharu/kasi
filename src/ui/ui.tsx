import { X } from 'lucide-react'
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { fmt } from '../lib/money'
import type { Category } from '../lib/types'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function Card({ children, className, onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx('rounded-3xl border border-line bg-card', onClick && 'cursor-pointer transition active:scale-[0.99] hover:border-[#3a3a3f]', className)}
    >
      {children}
    </div>
  )
}

export function Money({ value, className, sign, cents, currency }: { value: number | null | undefined; className?: string; sign?: boolean; cents?: boolean; currency?: string }) {
  if (value === null || value === undefined) return <span className={cx('num', className)}>—</span>
  const s = fmt(value, { sign, cents, currency })
  const m = s.match(/^([−+]?)(Rs\. |[A-Z]{3} )(.*)$/)
  if (!m) return <span className={cx('num', className)}>{s}</span>
  return (
    <span className={cx('num whitespace-nowrap', className)}>
      {m[1]}
      <span className="text-[0.72em] font-medium opacity-80">{m[2]}</span>
      {m[3]}
    </span>
  )
}

export function CatIcon({ cat, size = 'md' }: { cat: Category | null | undefined; size?: 'sm' | 'md' | 'lg' }) {
  const s = size === 'sm' ? 'h-8 w-8 text-base rounded-xl' : size === 'lg' ? 'h-14 w-14 text-2xl rounded-2xl' : 'h-11 w-11 text-xl rounded-2xl'
  return (
    <div className={cx('flex shrink-0 items-center justify-center', s)} style={{ background: cat ? `${cat.color}22` : '#ffffff0d' }}>
      <span>{cat?.icon ?? '❔'}</span>
    </div>
  )
}

export function Button({ variant = 'primary', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' | 'soft' }) {
  return (
    <button
      {...p}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-semibold transition active:scale-[0.98] disabled:opacity-40',
        variant === 'primary' && 'bg-ink text-bg hover:bg-white',
        variant === 'soft' && 'bg-card2 text-ink hover:bg-[#2b2b2f]',
        variant === 'ghost' && 'text-muted hover:text-ink',
        variant === 'danger' && 'bg-bad/15 text-bad hover:bg-bad/25',
        className,
      )}
    />
  )
}

export function IconButton({ className, ...p }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...p} className={cx('flex h-10 w-10 items-center justify-center rounded-full text-muted transition hover:bg-card2 hover:text-ink active:scale-95', className)} />
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-[13px] font-medium text-muted">{label}</div>
      {children}
      {hint && <div className="mt-1 text-xs text-faint">{hint}</div>}
    </label>
  )
}

export const inputCls = 'w-full rounded-2xl border border-line bg-card2 px-4 py-3 text-ink outline-none placeholder:text-faint focus:border-kiwi/60'

export function Input(p: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...p} className={cx(inputCls, p.className)} />
}

export function Select({ children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...p} className={cx(inputCls, 'appearance-none bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10', p.className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%239b9ba1' stroke-width='1.6' fill='none'/%3E%3C/svg%3E\")" }}>
      {children}
    </select>
  )
}

export function Segmented<T extends string>({ value, onChange, options, className }: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; className?: string }) {
  return (
    <div className={cx('flex rounded-full bg-card2 p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx('flex-1 rounded-full px-3 py-2 text-sm font-semibold transition', value === o.value ? 'bg-ink text-bg' : 'text-muted hover:text-ink')}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 py-1 text-left">
      <span className="text-sm text-ink/90">{label}</span>
      <span className={cx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-kiwi' : 'bg-line')}>
        <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-white transition-all', checked ? 'left-6' : 'left-1')} />
      </span>
    </button>
  )
}

/** Bottom sheet on phones, centred dialog on laptops. */
export function Sheet({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.body.style.overflow = prev
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center" onClick={onClose}>
      <div
        className="anim-sheet flex max-h-[92dvh] w-full flex-col rounded-t-[28px] border border-line bg-[#141415] md:max-w-lg md:rounded-[28px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-4">
          <div className="text-lg font-semibold">{title}</div>
          <IconButton onClick={onClose} aria-label="Close">
            <X size={20} />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-5">{children}</div>
        {footer && <div className="safe-bottom border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export function PageTitle({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-5 flex items-end justify-between gap-3 pt-2">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        {sub && <div className="mt-0.5 text-sm text-muted">{sub}</div>}
      </div>
      {right}
    </div>
  )
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between">
      <h2 className="text-[15px] font-semibold text-muted">{children}</h2>
      {right}
    </div>
  )
}

export function Empty({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <div className="mb-4 text-5xl">{icon}</div>
      <div className="text-lg font-semibold">{title}</div>
      {children && <div className="mt-2 max-w-sm text-sm text-muted">{children}</div>}
    </div>
  )
}

export function Bar({ value, max, color = 'var(--color-kiwi)', className }: { value: number; max: number; color?: string; className?: string }) {
  const p = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className={cx('h-2 overflow-hidden rounded-full bg-line', className)}>
      <div className="h-full rounded-full transition-all" style={{ width: `${p}%`, background: color }} />
    </div>
  )
}

export function Hand({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('font-hand text-2xl text-muted', className)}>{children}</div>
}
