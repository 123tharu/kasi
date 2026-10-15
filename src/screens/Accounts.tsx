import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../data/store'
import { portfolio } from '../lib/invest'
import { parseAmount } from '../lib/money'
import { BANKS, bankByCode } from '../lib/parser'
import type { Account } from '../lib/types'
import { AccountCard } from './Home'
import { BackLink } from './More'
import { Button, Card, Field, Input, Money, PageTitle, Select, Sheet, Toggle } from '../ui/ui'

export function Accounts() {
  const { db } = useStore()
  const nav = useNavigate()
  const [edit, setEdit] = useState<Account | null>(null)
  const [adding, setAdding] = useState(false)
  const active = db.accounts.filter((a) => !a.archived)
  const cash = active.filter((a) => a.type !== 'credit').reduce((x, a) => x + (a.balance ?? 0), 0)
  const owed = active.filter((a) => a.type === 'credit').reduce((x, a) => x + (a.balance ?? 0), 0)
  const inv = portfolio(db.investments).value

  return (
    <div>
      <BackLink />
      <PageTitle
        title="Accounts"
        sub="Balances update from your bank SMS"
        right={
          <Button variant="soft" className="py-2.5" onClick={() => setAdding(true)}>
            <Plus size={18} /> Add
          </Button>
        }
      />
      <Card className="mb-6 p-5">
        <div className="text-sm text-muted">Net worth</div>
        <Money value={cash - owed + inv} className="text-3xl font-bold" cents={false} />
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div>
            <div className="text-xs text-muted">In accounts</div>
            <Money value={cash} cents={false} className="font-semibold" />
          </div>
          <div>
            <div className="text-xs text-muted">Investments</div>
            <Money value={inv} cents={false} className="font-semibold" />
          </div>
          <div>
            <div className="text-xs text-muted">Card debt</div>
            <Money value={-owed} cents={false} className="font-semibold text-bad" />
          </div>
        </div>
      </Card>
      <div className="flex flex-wrap gap-3">
        {db.accounts.map((a) => (
          <div key={a.id} className={a.archived ? 'opacity-40' : ''}>
            <AccountCard a={a} onClick={() => setEdit(a)} />
            <button onClick={() => nav(`/timeline?account=${a.id}`)} className="mt-1.5 w-full text-center text-xs text-muted hover:text-ink">
              {db.transactions.filter((t) => t.account_id === a.id).length} transactions →
            </button>
          </div>
        ))}
      </div>
      <p className="mt-6 text-sm text-faint">
        New accounts appear automatically the first time your bank texts about them. If one account shows up twice (e.g. its debit card has different digits), open it and use “Merge into”.
      </p>
      <AccountEditor a={edit} open={!!edit || adding} onClose={() => (setEdit(null), setAdding(false))} />
    </div>
  )
}

function AccountEditor({ a, open, onClose }: { a: Account | null; open: boolean; onClose: () => void }) {
  const { db, insert, update, remove, mergeAccounts, toast } = useStore()
  const [f, setF] = useState({ name: '', type: 'bank' as Account['type'], bank: '', last4: '', balance: '', limit: '', archived: false })
  const [mergeTo, setMergeTo] = useState('')
  useEffect(() => {
    if (!open) return
    setF({
      name: a?.name ?? '',
      type: a?.type ?? 'bank',
      bank: a?.bank ?? '',
      last4: a?.last4 ?? '',
      balance: a?.balance != null ? String(a.balance) : '',
      limit: a?.credit_limit != null ? String(a.credit_limit) : '',
      archived: a?.archived ?? false,
    })
    setMergeTo('')
  }, [open, a])

  async function save() {
    if (!f.name.trim()) return toast('Give it a name')
    const balance = f.balance.trim() === '' ? null : parseAmount(f.balance)
    const row: Partial<Account> = {
      name: f.name.trim(),
      type: f.type,
      bank: f.bank || null,
      last4: f.last4.replace(/[^0-9,]/g, '').replace(/,+/g, ', ') || null,
      credit_limit: f.limit.trim() === '' ? null : parseAmount(f.limit),
      archived: f.archived,
      color: bankByCode(f.bank)?.color ?? a?.color ?? null,
    }
    if (!a || balance !== a.balance) {
      row.balance = balance
      row.balance_at = new Date().toISOString()
    }
    if (a) await update('accounts', a.id, row)
    else await insert('accounts', [row])
    onClose()
  }

  async function merge() {
    const into = db.accounts.find((x) => x.id === mergeTo)
    if (!a || !into) return
    await mergeAccounts(a, into)
    toast(`Merged into ${into.name}`)
    onClose()
  }

  const used = a ? db.transactions.some((t) => t.account_id === a.id) : false
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={a ? a.name : 'Add account'}
      footer={
        <div className="flex gap-2">
          {a && !used && (
            <Button variant="danger" onClick={async () => (await remove('accounts', a.id), onClose())} aria-label="Delete">
              <Trash2 size={18} />
            </Button>
          )}
          <Button className="flex-1" onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Salary account" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Type">
            <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as Account['type'] })}>
              <option value="bank">Bank account</option>
              <option value="credit">Credit card</option>
              <option value="cash">Cash</option>
              <option value="wallet">Wallet / e-money</option>
            </Select>
          </Field>
          <Field label="Bank">
            <Select value={f.bank} onChange={(e) => setF({ ...f, bank: e.target.value })}>
              <option value="">—</option>
              <option value="CASH">Cash</option>
              {BANKS.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Last digits" hint="Last 4 digits as they appear in SMS. Add the account and its cards, comma-separated: 7842, 0291">
          <Input value={f.last4} onChange={(e) => setF({ ...f, last4: e.target.value })} placeholder="7842" />
        </Field>
        <Field label={f.type === 'credit' ? 'Amount owed now' : 'Current balance'} hint="Kasi keeps this up to date from the balance in each SMS.">
          <Input inputMode="decimal" value={f.balance} onChange={(e) => setF({ ...f, balance: e.target.value })} placeholder="Unknown" />
        </Field>
        {f.type === 'credit' && (
          <Field label="Credit limit" hint="With the limit, the “available balance” in card SMS tells Kasi how much you owe.">
            <Input inputMode="decimal" value={f.limit} onChange={(e) => setF({ ...f, limit: e.target.value })} />
          </Field>
        )}
        {a && <Toggle checked={f.archived} onChange={(v) => setF({ ...f, archived: v })} label="Hide (closed account)" />}
        {a && db.accounts.length > 1 && (
          <div className="rounded-2xl border border-line p-4">
            <div className="mb-2 text-sm font-medium">Merge into another account</div>
            <div className="mb-3 text-xs text-muted">Moves all its transactions and card numbers over, then removes this one.</div>
            <div className="flex gap-2">
              <Select value={mergeTo} onChange={(e) => setMergeTo(e.target.value)}>
                <option value="">Choose…</option>
                {db.accounts
                  .filter((x) => x.id !== a.id)
                  .map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
              </Select>
              <Button variant="soft" onClick={merge} disabled={!mergeTo}>
                Merge
              </Button>
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
