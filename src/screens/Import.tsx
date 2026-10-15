import { FileUp, Loader2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { bankByCode, detectBank, hasMoney, isSensitive, parseSmsBackupXml, type ImportedSms } from '../lib/parser'
import { isoDate, parseIsoDate } from '../lib/period'
import { BackLink } from './More'
import { Button, Card, cx, Field, Input, inputCls, PageTitle, SectionTitle } from '../ui/ui'

interface Scan {
  total: number
  inRange: number
  sensitive: number
  personal: number
  keep: ImportedSms[]
  bySender: [string, number][]
}

function scan(list: ImportedSms[], from: Date): Scan {
  const inRange = list.filter((s) => new Date(s.received_at) >= from)
  let sensitive = 0
  let personal = 0
  const keep: ImportedSms[] = []
  for (const s of inRange) {
    if (isSensitive(s.body)) sensitive++
    else if (!hasMoney(s.body)) personal++
    else keep.push(s)
  }
  const counts = new Map<string, number>()
  for (const s of keep) {
    const name = detectBank(s.sender, s.body)?.name ?? s.sender ?? 'Unknown'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  keep.sort((a, b) => a.received_at.localeCompare(b.received_at))
  return { total: list.length, inRange: inRange.length, sensitive, personal, keep, bySender: [...counts.entries()].sort((a, b) => b[1] - a[1]) }
}

export function ImportSms() {
  const { db, importSms, toast } = useStore()
  const now = new Date()
  const [from, setFrom] = useState(isoDate(new Date(now.getFullYear(), now.getMonth(), 1)))
  const [file, setFile] = useState<{ name: string; list: ImportedSms[] } | null>(null)
  const [paste, setPaste] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ added: number; alreadyHad: number } | null>(null)

  const result1 = useMemo(() => (file ? scan(file.list, parseIsoDate(from)) : null), [file, from])
  const pending = db.raw_sms.filter((s) => s.status === 'new').length

  async function onFile(f: File | undefined) {
    setError(null)
    setResult(null)
    if (!f) return
    try {
      const text = await f.text()
      const list = parseSmsBackupXml(text)
      if (!list.length) throw new Error('No received messages found in this file.')
      setFile({ name: f.name, list })
    } catch (e) {
      setFile(null)
      setError((e as Error).message)
    }
  }

  async function run(list: ImportedSms[]) {
    if (!list.length) return
    setBusy(`Uploading 0 of ${list.length}…`)
    try {
      const r = await importSms(list, (done) => setBusy(`Uploading ${done} of ${list.length}…`))
      setResult(r)
      toast(r.added ? `Added ${r.added} messages. Logging transactions…` : 'Nothing new to add')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  function importPasted() {
    // One message per block; blocks are separated by a blank line.
    const blocks = paste
      .split(/\n\s*\n/)
      .map((b) => b.trim())
      .filter(Boolean)
    const list = blocks.filter((b) => hasMoney(b) && !isSensitive(b)).map((body) => ({ sender: null, body, received_at: new Date().toISOString() }))
    if (!list.length) return toast('No bank messages with an amount found')
    run(list).then(() => setPaste(''))
  }

  return (
    <div>
      <BackLink />
      <PageTitle title="Import past SMS" sub="Bring in bank messages from before you set up forwarding." />

      {(pending > 0 || busy) && (
        <Card className="mb-5 flex items-center gap-3 p-4">
          <Loader2 className="animate-spin text-kiwi" size={20} />
          <div className="text-sm">{busy ?? `Logging transactions… ${pending} left. Keep Kasi open until this finishes.`}</div>
        </Card>
      )}
      {result && !busy && pending === 0 && (
        <Card className="mb-5 p-4 text-sm">
          ✅ Done. Added <b>{result.added}</b> messages{result.alreadyHad ? ` (skipped ${result.alreadyHad} Kasi already had)` : ''}. Check Timeline, and More → Review for anything unclear.
        </Card>
      )}

      <Card className="p-5">
        <div className="mb-3 font-semibold">From your phone's messages (recommended)</div>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted">
          <li>
            Install <b className="text-ink">SMS Backup &amp; Restore</b> (by SyncTech) from the Play Store.
          </li>
          <li>
            Tap <b className="text-ink">Back up</b>, keep <b className="text-ink">Messages</b> on and turn Calls off. Save to your phone (or Google Drive to use it on the Mac).
          </li>
          <li>Choose the backup file below. It's read on this device. Only bank messages with an amount are sent to Kasi; OTPs and personal texts never leave the phone.</li>
        </ol>

        <div className="mt-5 grid gap-3 sm:grid-cols-[180px_1fr]">
          <Field label="Import messages from">
            <Input type="date" value={from} max={isoDate(now)} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="Backup file (.xml)">
            <label className={cx(inputCls, 'flex cursor-pointer items-center gap-2 text-muted hover:border-kiwi/60')}>
              <FileUp size={18} />
              <span className="truncate">{file ? file.name : 'Choose file…'}</span>
              <input type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
          </Field>
        </div>
        {error && <div className="mt-3 text-sm text-bad">{error}</div>}

        {result1 && (
          <div className="mt-5 rounded-2xl border border-line p-4">
            <div className="text-sm text-muted">
              {result1.total.toLocaleString()} messages in the file · {result1.inRange.toLocaleString()} since {parseIsoDate(from).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
            </div>
            <div className="mt-2 text-lg font-semibold">{result1.keep.length} bank messages to import</div>
            <div className="mt-1 text-xs text-faint">
              Leaving out {result1.sensitive} OTP / security codes and {result1.personal} personal or non-bank messages.
            </div>
            {result1.bySender.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {result1.bySender.slice(0, 10).map(([name, n]) => (
                  <span key={name} className="rounded-full bg-card2 px-3 py-1 text-xs">
                    {name} · {n}
                  </span>
                ))}
              </div>
            )}
            <Button className="mt-4 w-full sm:w-auto" disabled={!result1.keep.length || !!busy} onClick={() => run(result1.keep)}>
              Import {result1.keep.length} messages
            </Button>
          </div>
        )}
      </Card>

      <SectionTitle>Or paste messages</SectionTitle>
      <Card className="p-5">
        <p className="mb-3 text-sm text-muted">Copy bank SMS from your Messages app and paste them here. Leave an empty line between messages.</p>
        <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={6} className={cx(inputCls, 'resize-y')} placeholder={'LKR 2,450.00 debited from AC **1234 …\n\nPurchase at KEELLS SUPER for LKR 3,420.50 …'} />
        <Button variant="soft" className="mt-3" disabled={!paste.trim() || !!busy} onClick={importPasted}>
          Import pasted messages
        </Button>
      </Card>
      <p className="mt-4 text-xs text-faint">
        Already-imported messages are skipped, so running an import twice won't create duplicates. Banks Kasi recognises: {['COMBANK', 'SAMPATH', 'HNB', 'NTB', 'BOC', 'PEOPLES'].map((c) => bankByCode(c)?.name).join(', ')} and more.
      </p>
    </div>
  )
}
