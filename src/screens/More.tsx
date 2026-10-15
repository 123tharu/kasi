import { ArrowLeft, Check, ChevronRight, Copy, Download, LogOut, MessageSquareText, QrCode, RotateCcw, Send } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { DemoBackend } from '../data/backend'
import { DEMO_ONLY, loadConfig, saveConfig, setupLink } from '../data/config'
import { useStore } from '../data/store'
import { repairApp } from '../ui/ErrorBoundary'
import { parseSms, bankByCode } from '../lib/parser'
import { fmt } from '../lib/money'
import { Button, Card, cx, Field, Input, inputCls, PageTitle, Select, SectionTitle } from '../ui/ui'

export function BackLink() {
  const nav = useNavigate()
  return (
    <button onClick={() => nav('/more')} className="-ml-2 mb-1 inline-flex items-center gap-1 rounded-full px-2 py-1 text-sm text-muted hover:text-ink md:hidden">
      <ArrowLeft size={16} /> More
    </button>
  )
}

function Row({ to, icon, title, sub, badge }: { to: string; icon: string; title: string; sub: string; badge?: number }) {
  return (
    <Link to={to} className="flex items-center gap-4 rounded-2xl px-3 py-3 transition hover:bg-card2/60">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card2 text-xl">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <div className="truncate text-sm text-muted">{sub}</div>
      </div>
      {!!badge && <span className="rounded-full bg-warn px-2 py-0.5 text-xs font-bold text-bg">{badge}</span>}
      <ChevronRight size={18} className="text-faint" />
    </Link>
  )
}

export function More() {
  const { db, reviewCount } = useStore()
  const subs = db.subscriptions.filter((s) => s.active).length
  return (
    <div>
      <PageTitle title="More" />
      <Card className="p-2">
        <Row to="/more/review" icon="🔍" title="Review" sub="Uncategorised and unclear transactions" badge={reviewCount} />
        <Row to="/more/budgets" icon="🎯" title="Budgets" sub={`${db.budgets.filter((b) => b.active).length} active`} />
        <Row to="/more/subscriptions" icon="🔁" title="Subscriptions" sub={`${subs} tracked`} />
        <Row to="/more/accounts" icon="🏦" title="Accounts & net worth" sub={`${db.accounts.filter((a) => !a.archived).length} accounts`} />
        <Row to="/more/categories" icon="🏷️" title="Categories & rules" sub={`${db.categories.length} categories · ${db.rules.length} rules`} />
      </Card>
      <Card className="mt-4 p-2">
        <Row to="/more/sms" icon="📲" title="Auto-tracking setup" sub="Forward bank SMS from your phone" />
        <Row to="/more/settings" icon="⚙️" title="Settings" sub="Payday, connect devices, export" />
      </Card>
    </div>
  )
}

function CopyField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [copied, setCopied] = useState(false)
  const [show, setShow] = useState(!secret)
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <div className={cx(inputCls, 'flex-1 truncate font-mono text-[13px]')} onClick={() => setShow(true)}>
          {show ? value : '•'.repeat(24)}
        </div>
        <Button
          variant="soft"
          className="px-4"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            } catch {
              setShow(true)
            }
          }}
          aria-label={`Copy ${label}`}
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
        </Button>
      </div>
    </Field>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kiwi-deep text-sm font-bold text-kiwi">{n}</div>
      <div className="min-w-0 flex-1 pb-6">
        <div className="mb-1.5 font-semibold">{title}</div>
        <div className="space-y-2 text-sm text-muted">{children}</div>
      </div>
    </div>
  )
}

export function SmsSetup() {
  const { db, backend, addSms, toast } = useStore()
  const [text, setText] = useState('')
  const [sender, setSender] = useState('')
  const [sending, setSending] = useState(false)
  const token = db.settings!.ingest_token
  // Everything MacroDroid needs lives in the URL and the body, so no headers have to be typed on the phone.
  const url = backend.ingestUrl
    ? `${backend.ingestUrl.replace(/ingest_sms$/, 'ingest_sms_raw')}?apikey=${backend.anonKey}`
    : 'https://<your-project>.supabase.co/rest/v1/rpc/ingest_sms_raw?apikey=<key>'
  const bodyTemplate = `${token}|[sms_number]|[sms_message]`
  const preview = text.trim() ? parseSms(text, sender || null, new Date()) : null
  const lastSms = db.raw_sms[0]

  async function sendTest() {
    if (!text.trim()) return
    setSending(true)
    try {
      if (backend.kind === 'supabase' && backend.ingestUrl) {
        // Same request MacroDroid will make, so this proves the whole pipe works.
        const r = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: `${token}|${sender || 'TEST'}|${text}`,
        })
        const body = await r.text()
        if (!r.ok) throw new Error(body)
        toast(`Server says: ${body.replace(/"/g, '')}`)
      } else {
        await addSms(text, sender || null)
        toast('Added. Check your timeline')
      }
      setText('')
    } catch (e) {
      toast(`Failed: ${(e as Error).message.slice(0, 80)}`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <BackLink />
      <PageTitle title="Auto-tracking" sub="Your Samsung forwards bank SMS to Kasi. Both devices update instantly." />
      {lastSms && (
        <Card className="mb-5 flex items-center gap-3 p-4">
          <MessageSquareText className="text-kiwi" size={22} />
          <div className="text-sm">
            Last SMS received <b>{new Date(lastSms.received_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</b>
            {lastSms.sender ? ` from ${lastSms.sender}` : ''}
          </div>
        </Card>
      )}
      {backend.kind === 'demo' && <div className="mb-5 rounded-2xl bg-warn/10 p-4 text-sm text-warn">You're in demo mode. Connect your Supabase database in Settings to get your real forwarding link.</div>}

      <Card className="p-5">
        <Step n={1} title="Install MacroDroid on your Samsung">
          <p>Free on the Play Store. It runs in the background and forwards matching SMS. Allow its SMS permission when asked.</p>
        </Step>
        <Step n={2} title="Create a macro: trigger">
          <p>
            Add Macro → <b>Triggers</b> → Phone → <b>SMS Received</b> → From: <b>Any number</b>, Content: <b>Any</b>.
          </p>
          <p>One macro covers every bank and card. Kasi keeps only messages with an amount; personal texts, promos and OTPs are dropped before anything is saved.</p>
        </Step>
        <Step n={3} title="Action: send it to Kasi">
          <p>
            <b>Actions</b> → Web Interactions (or Connectivity) → <b>HTTP Request</b>. Method <b>POST</b>, then fill in:
          </p>
          <CopyField label="1 · URL (paste into Request URL)" value={url} />
          <p>
            Open <b>Content body</b>, set the content type to <b>text/plain</b>, and paste this as the body. Paste it exactly: MacroDroid swaps the parts in [brackets] for the real sender and message.
          </p>
          <CopyField label="2 · Body (contains your private token)" value={bodyTemplate} secret />
          <p>
            Nothing else is needed. Leave <b>Headers</b> and <b>Query parameters</b> empty.
          </p>
        </Step>
        <Step n={4} title="Keep it running">
          <p>
            Settings → Apps → MacroDroid → Battery → <b>Unrestricted</b>. Samsung otherwise puts it to sleep and forwarding stops.
          </p>
        </Step>
        <div className="flex gap-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-kiwi-deep text-sm font-bold text-kiwi">5</div>
          <div className="text-sm text-muted">
            <div className="mb-1.5 font-semibold text-ink">Done</div>
            Kasi drops one-time passwords and verification codes before anything is saved. It only stores messages that contain an amount.
          </div>
        </div>
      </Card>

      <SectionTitle>Test with a real SMS</SectionTitle>
      <Card className="p-5">
        <p className="mb-3 text-sm text-muted">Paste a bank SMS. You'll see what Kasi reads before sending it, using the same request MacroDroid makes.</p>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} placeholder="LKR 2,450.00 debited from AC **1234 for KEELLS…" className={cx(inputCls, 'resize-none')} />
        <div className="mt-2 flex gap-2">
          <Input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="Sender (e.g. COMBANK)" className="flex-1" />
          <Button onClick={sendTest} disabled={!text.trim() || sending}>
            <Send size={16} /> Send
          </Button>
        </div>
        {preview && (
          <div className="mt-4 rounded-2xl border border-line p-4 text-sm">
            {preview.kind === 'txn' ? (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                <span className="text-muted">Amount</span>
                <span className="num font-semibold">{fmt(preview.amount, { currency: preview.currency, cents: true })}</span>
                <span className="text-muted">Direction</span>
                <span>{preview.direction === 'debit' ? 'Money out' : 'Money in'}{preview.directionGuessed ? ' (guessed)' : ''}</span>
                <span className="text-muted">Merchant</span>
                <span>{preview.merchant ?? '—'}</span>
                <span className="text-muted">Bank · card</span>
                <span>
                  {bankByCode(preview.bank)?.name ?? '—'} · {preview.last4 ? `••${preview.last4}` : '—'}
                </span>
                <span className="text-muted">Balance after</span>
                <span className="num">{preview.balance !== null ? fmt(preview.balance, { cents: true }) : '—'}</span>
                <span className="text-muted">When</span>
                <span>{preview.occurredAt.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ) : (
              <div className="text-muted">
                {preview.kind === 'ignore' ? 'Will be ignored: ' : 'Can’t read this: '}
                {preview.reason}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  )
}

export function Settings() {
  const { db, backend, updateSettings, toast } = useStore()
  const s = db.settings!
  const [name, setName] = useState(s.display_name ?? '')
  const [payday, setPayday] = useState(String(s.payday_day))
  const [showQr, setShowQr] = useState(false)
  const cfg = loadConfig()

  function exportCsv() {
    const cat = new Map(db.categories.map((c) => [c.id, c.name]))
    const acc = new Map(db.accounts.map((a) => [a.id, a.name]))
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = [['Date', 'Merchant', 'Category', 'Account', 'Direction', 'Amount', 'Currency', 'Note', 'Source']]
    for (const t of db.transactions) rows.push([t.occurred_at, t.merchant ?? '', cat.get(t.category_id ?? '') ?? '', acc.get(t.account_id ?? '') ?? '', t.direction, String(t.amount), t.currency, t.note ?? '', t.source])
    const blob = new Blob([rows.map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `kasi-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  async function signOut() {
    if (backend.kind === 'supabase') await (backend as unknown as { sb: { auth: { signOut(): Promise<unknown> } } }).sb.auth.signOut()
    location.reload()
  }

  return (
    <div>
      <BackLink />
      <PageTitle title="Settings" />
      <Card className="space-y-4 p-5">
        <Field label="Your name">
          <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name !== s.display_name && updateSettings({ display_name: name.trim() || null })} />
        </Field>
        <Field label="Payday" hint="Your “month” runs from this day to the day before it next month, so budgets and insights line up with your salary.">
          <Select
            value={payday}
            onChange={(e) => {
              setPayday(e.target.value)
              updateSettings({ payday_day: Number(e.target.value) }).then(() => toast('Payday updated'))
            }}
          >
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d === 1 ? '1st (calendar month)' : `${d}${d === 2 || d === 22 ? 'nd' : d === 3 || d === 23 ? 'rd' : d === 21 ? 'st' : 'th'} of the month`}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      {cfg?.mode === 'supabase' && (
        <>
          <SectionTitle>Connect your other device</SectionTitle>
          <Card className="p-5">
            <p className="text-sm text-muted">Open this link on your phone (or scan the code) to connect it to the same database. Then sign in with the same email.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="soft" onClick={() => setShowQr(!showQr)}>
                <QrCode size={16} /> {showQr ? 'Hide' : 'Show'} QR code
              </Button>
              <Button
                variant="soft"
                onClick={async () => {
                  await navigator.clipboard.writeText(setupLink(cfg)).catch(() => {})
                  toast('Setup link copied')
                }}
              >
                <Copy size={16} /> Copy link
              </Button>
            </div>
            {showQr && (
              <div className="mt-4 inline-block rounded-2xl bg-white p-4">
                <QRCodeSVG value={setupLink(cfg)} size={200} />
              </div>
            )}
          </Card>
        </>
      )}

      <SectionTitle>Your data</SectionTitle>
      <Card className="p-2">
        <button onClick={exportCsv} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-card2/60">
          <Download size={18} className="text-muted" /> Export transactions (CSV)
        </button>
        <button onClick={repairApp} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-card2/60">
          <RotateCcw size={18} className="text-muted" /> Repair app (load the latest version)
        </button>
        {backend.kind === 'demo' ? (
          <>
            <button
              onClick={() => {
                DemoBackend.reset()
                location.reload()
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-card2/60"
            >
              <RotateCcw size={18} className="text-muted" /> Reset demo data
            </button>
            {!DEMO_ONLY && (
              <button
                onClick={() => {
                  saveConfig(null)
                  location.reload()
                }}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-card2/60"
              >
                <LogOut size={18} className="text-muted" /> Leave demo and connect my database
              </button>
            )}
          </>
        ) : (
          <>
            <button onClick={signOut} className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-card2/60">
              <LogOut size={18} className="text-muted" /> Sign out
            </button>
            <button
              onClick={() => {
                saveConfig(null)
                signOut()
              }}
              className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left text-bad hover:bg-card2/60"
            >
              <LogOut size={18} /> Disconnect this device from the database
            </button>
          </>
        )}
      </Card>
      <div className="mt-8 text-center text-xs text-faint">Kasi · personal edition</div>
    </div>
  )
}
