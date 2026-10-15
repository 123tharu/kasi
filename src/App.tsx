import type { Session, SupabaseClient } from '@supabase/supabase-js'
import { Compass, House, PieChart, ReceiptText, Sprout } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { DemoBackend, makeSupabase, SupabaseBackend, type Backend } from './data/backend'
import { loadConfig, saveConfig, type AppConfig } from './data/config'
import { demoDb } from './data/demo'
import { StoreProvider, useStore } from './data/store'
import { Accounts } from './screens/Accounts'
import { Budgets } from './screens/Budgets'
import { Categories } from './screens/Categories'
import { Grow } from './screens/Grow'
import { Home } from './screens/Home'
import { Insights } from './screens/Insights'
import { More, Settings, SmsSetup } from './screens/More'
import { Review } from './screens/Review'
import { Subscriptions } from './screens/Subscriptions'
import { Timeline } from './screens/Timeline'
import { ErrorBoundary, repairApp } from './ui/ErrorBoundary'
import { Button, cx, Field, Input } from './ui/ui'

const NAV = [
  { to: '/', label: 'Home', icon: House, end: true },
  { to: '/insights', label: 'Insights', icon: PieChart },
  { to: '/timeline', label: 'Timeline', icon: ReceiptText },
  { to: '/grow', label: 'Grow', icon: Sprout },
  { to: '/more', label: 'More', icon: Compass },
]

function Logo({ className }: { className?: string }) {
  return <img src="./icon-192.png" alt="" className={cx('rounded-[24%]', className)} />
}

function Shell() {
  const { reviewCount, toastMsg, backend } = useStore()
  const loc = useLocation()
  // Braces matter: newer Chrome returns a Promise from scrollTo, and React would treat it as a cleanup function.
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [loc.pathname])
  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl">
      {/* Laptop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line px-4 py-6 md:flex">
        <div className="mb-8 flex items-center gap-2.5 px-2">
          <Logo className="h-8 w-8" />
          <span className="text-xl font-semibold tracking-tight">Kasi</span>
          {backend.kind === 'demo' && <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold uppercase text-warn">demo</span>}
        </div>
        <nav className="space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('flex items-center gap-3 rounded-full px-4 py-2.5 text-[15px] font-medium transition', isActive ? 'bg-kiwi-deep text-ink' : 'text-muted hover:bg-card2 hover:text-ink')}>
              <Icon size={20} />
              {label}
              {label === 'More' && reviewCount > 0 && <span className="ml-auto rounded-full bg-warn px-2 text-xs font-bold text-bg">{reviewCount}</span>}
            </NavLink>
          ))}
        </nav>
        <div className="mt-6 space-y-0.5 border-t border-line pt-4 text-sm">
          {[
            ['/more/budgets', '🎯 Budgets'],
            ['/more/subscriptions', '🔁 Subscriptions'],
            ['/more/accounts', '🏦 Accounts'],
            ['/more/review', '🔍 Review'],
            ['/more/sms', '📲 Auto-tracking'],
          ].map(([to, l]) => (
            <NavLink key={to} to={to} className={({ isActive }) => cx('block rounded-full px-4 py-2 transition', isActive ? 'text-ink' : 'text-muted hover:text-ink')}>
              {l}
            </NavLink>
          ))}
        </div>
      </aside>

      <main className="safe-top min-w-0 flex-1 px-4 pb-32 pt-4 md:px-10 md:pb-16 md:pt-8">
        <ErrorBoundary resetKey={loc.pathname}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/timeline" element={<Timeline />} />
          <Route path="/grow" element={<Grow />} />
          <Route path="/more" element={<More />} />
          <Route path="/more/budgets" element={<Budgets />} />
          <Route path="/more/subscriptions" element={<Subscriptions />} />
          <Route path="/more/accounts" element={<Accounts />} />
          <Route path="/more/categories" element={<Categories />} />
          <Route path="/more/review" element={<Review />} />
          <Route path="/more/sms" element={<SmsSetup />} />
          <Route path="/more/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        </ErrorBoundary>
      </main>

      {/* Phone bottom bar */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 bg-gradient-to-t from-bg via-bg/95 to-transparent px-3 pt-6 md:hidden">
        <div className="mx-auto mb-3 flex max-w-md items-center justify-between rounded-full border border-line bg-[#161617]/95 p-1.5 backdrop-blur">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => cx('relative flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-medium transition', isActive ? 'bg-kiwi-deep text-ink' : 'text-muted')}>
              <Icon size={22} strokeWidth={2} />
              {label}
              {label === 'More' && reviewCount > 0 && <span className="absolute right-[22%] top-1 h-2 w-2 rounded-full bg-warn" />}
            </NavLink>
          ))}
        </div>
      </nav>

      {toastMsg && (
        <div className="anim-sheet fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4 md:bottom-8">
          <div className="rounded-full bg-ink px-5 py-3 text-sm font-medium text-bg shadow-2xl">{toastMsg}</div>
        </div>
      )}
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}

function Loading({ error, onRetry }: { error?: string | null; onRetry?: () => void }) {
  return (
    <Centered>
      <div className="flex flex-col items-center text-center">
        <Logo className={cx('h-14 w-14', !error && 'animate-pulse')} />
        {error ? (
          <>
            <div className="mt-5 font-semibold">Couldn't load your data</div>
            <div className="mt-2 break-words text-sm text-muted">{error}</div>
            {/relation|does not exist|schema cache/i.test(error) && <div className="mt-3 text-sm text-warn">The database tables aren't set up yet. Run schema.sql in the Supabase SQL editor.</div>}
            <Button className="mt-5" onClick={onRetry ?? (() => location.reload())}>
              Try again
            </Button>
            <button className="mt-3 text-sm text-muted underline" onClick={repairApp}>
              Repair app
            </button>
          </>
        ) : (
          <div className="mt-4 text-sm text-muted">Loading…</div>
        )}
      </div>
    </Centered>
  )
}

function Welcome({ onConfig }: { onConfig: (c: AppConfig) => void }) {
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [connect, setConnect] = useState(false)
  return (
    <Centered>
      <div className="text-center">
        <Logo className="mx-auto h-16 w-16" />
        <h1 className="mt-6 text-3xl font-semibold tracking-tight">Kasi</h1>
        <p className="mt-2 text-muted">Every transaction, logged the second your bank texts you.</p>
      </div>
      {!connect ? (
        <div className="mt-10 space-y-3">
          <Button className="w-full" onClick={() => setConnect(true)}>
            Connect my database
          </Button>
          <Button variant="soft" className="w-full" onClick={() => onConfig({ mode: 'demo' })}>
            Look around with demo data
          </Button>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          <p className="text-sm text-muted">In Supabase: Project Settings → API. Copy the Project URL and the anon / publishable key.</p>
          <Field label="Project URL">
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://abcd1234.supabase.co" autoCapitalize="off" autoCorrect="off" />
          </Field>
          <Field label="Anon / publishable key">
            <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="eyJhbGciOi… or sb_publishable_…" autoCapitalize="off" autoCorrect="off" />
          </Field>
          <Button className="w-full" disabled={!/^https:\/\/.+/.test(url.trim()) || key.trim().length < 20} onClick={() => onConfig({ mode: 'supabase', url: url.trim().replace(/\/$/, ''), key: key.trim() })}>
            Continue
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => setConnect(false)}>
            Back
          </Button>
        </div>
      )}
    </Centered>
  )
}

function SignIn({ sb, onReset }: { sb: SupabaseClient; onReset: () => void }) {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function go() {
    setBusy(true)
    setMsg(null)
    const r = mode === 'in' ? await sb.auth.signInWithPassword({ email, password: pw }) : await sb.auth.signUp({ email, password: pw, options: { emailRedirectTo: location.origin + location.pathname } })
    setBusy(false)
    if (r.error) return setMsg(r.error.message)
    if (mode === 'up' && !r.data.session) setMsg('Check your email to confirm, then sign in here.')
  }
  return (
    <Centered>
      <div className="text-center">
        <Logo className="mx-auto h-14 w-14" />
        <h1 className="mt-5 text-2xl font-semibold">{mode === 'in' ? 'Sign in' : 'Create your account'}</h1>
        <p className="mt-1 text-sm text-muted">{mode === 'in' ? 'Same email on your phone and laptop.' : 'Only you will use this. Your data stays in your own database.'}</p>
      </div>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          go()
        }}
      >
        <Field label="Email">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </Field>
        <Field label="Password">
          <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} minLength={8} />
        </Field>
        {msg && <div className="text-sm text-warn">{msg}</div>}
        <Button className="w-full" disabled={busy || !email || pw.length < 6}>
          {mode === 'in' ? 'Sign in' : 'Create account'}
        </Button>
      </form>
      <div className="mt-4 flex flex-col items-center gap-1">
        <Button variant="ghost" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? 'First time? Create account' : 'Have an account? Sign in'}
        </Button>
        <button className="text-xs text-faint hover:text-muted" onClick={onReset}>
          Use a different database
        </button>
      </div>
    </Centered>
  )
}

function SupabaseGate({ cfg, onReset }: { cfg: Extract<AppConfig, { mode: 'supabase' }>; onReset: () => void }) {
  const sb = useMemo(() => makeSupabase(cfg.url, cfg.key), [cfg.url, cfg.key])
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [sb])
  const backend = useMemo(() => (session ? new SupabaseBackend(sb, cfg.url, cfg.key) : null), [session?.user.id, sb]) // eslint-disable-line react-hooks/exhaustive-deps
  if (session === undefined) return <Loading />
  if (!session || !backend) return <SignIn sb={sb} onReset={onReset} />
  return <App2 backend={backend} />
}

function App2({ backend }: { backend: Backend }) {
  return (
    <StoreProvider backend={backend} fallback={(err) => <Loading error={err} />}>
      <HashRouter>
        <Shell />
      </HashRouter>
    </StoreProvider>
  )
}

export default function App() {
  const [cfg, setCfg] = useState<AppConfig | null>(() => loadConfig())
  const demo = useMemo(() => (cfg?.mode === 'demo' ? new DemoBackend(demoDb) : null), [cfg?.mode])
  const choose = (c: AppConfig | null) => {
    saveConfig(c)
    setCfg(c)
  }
  if (!cfg) return <Welcome onConfig={choose} />
  if (cfg.mode === 'demo') return <App2 backend={demo!} />
  return <SupabaseGate cfg={cfg} onReset={() => choose(null)} />
}
