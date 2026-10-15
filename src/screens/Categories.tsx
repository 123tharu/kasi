import { Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '../data/store'
import type { Category, CategoryKind } from '../lib/types'
import { BackLink } from './More'
import { Button, CatIcon, Card, cx, Field, Input, PageTitle, Segmented, Select, SectionTitle, Sheet, Toggle } from '../ui/ui'

const COLORS = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767', '#8b949e']
const EMOJI = '🍽️ 🛒 🛺 ⛽ 🛍️ 💡 🔁 💊 🎬 🏠 📚 💇 ✈️ 🎁 🏦 🏧 📦 💼 💰 ↩️ 📈 ↔️ 👶 🐶 🏋️ ☕ 🍺 🎮 🚗 🧾 🛠️ 🙏 💍 🧒 📱 💻'.split(' ')

export function Categories() {
  const { db, insert, remove } = useStore()
  const [edit, setEdit] = useState<Category | null>(null)
  const [adding, setAdding] = useState(false)
  const [pattern, setPattern] = useState('')
  const [ruleCat, setRuleCat] = useState('')
  const [q, setQ] = useState('')
  const groups: [CategoryKind, string][] = [
    ['expense', 'Spending'],
    ['income', 'Income'],
    ['transfer', 'Not counted (transfers)'],
  ]
  const rules = useMemo(
    () => db.rules.filter((r) => !q || r.pattern.includes(q.toLowerCase())).sort((a, b) => a.pattern.localeCompare(b.pattern)),
    [db.rules, q],
  )

  return (
    <div>
      <BackLink />
      <PageTitle
        title="Categories"
        sub="And the rules that sort transactions into them"
        right={
          <Button variant="soft" className="py-2.5" onClick={() => setAdding(true)}>
            <Plus size={18} /> New
          </Button>
        }
      />
      {groups.map(([kind, label]) => (
        <div key={kind} className="mb-6">
          <div className="mb-2 text-sm font-semibold text-muted">{label}</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {db.categories
              .filter((c) => c.kind === kind)
              .sort((a, b) => a.sort - b.sort)
              .map((c) => (
                <button key={c.id} onClick={() => setEdit(c)} className={cx('flex items-center gap-2.5 rounded-2xl border border-line bg-card p-2.5 text-left hover:border-[#3a3a3f]', c.archived && 'opacity-40')}>
                  <CatIcon cat={c} size="sm" />
                  <span className="truncate text-sm font-medium">{c.name}</span>
                </button>
              ))}
          </div>
        </div>
      ))}

      <SectionTitle right={<span className="text-sm text-faint">{db.rules.length} rules</span>}>Auto-categorise rules</SectionTitle>
      <p className="-mt-1 mb-3 text-sm text-muted">If the merchant name contains the text, the transaction goes into that category. Kasi adds rules for you whenever you re-categorise something.</p>
      <Card className="mb-3 p-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input value={pattern} onChange={(e) => setPattern(e.target.value)} placeholder="Merchant text, e.g. keells" className="flex-1" />
          <Select value={ruleCat} onChange={(e) => setRuleCat(e.target.value)} className="sm:w-56">
            <option value="">Category…</option>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon} {c.name}
              </option>
            ))}
          </Select>
          <Button
            disabled={!pattern.trim() || !ruleCat}
            onClick={async () => {
              const p = pattern.trim().toLowerCase()
              const existing = db.rules.find((r) => r.pattern === p)
              if (existing) await remove('rules', existing.id)
              await insert('rules', [{ pattern: p, category_id: ruleCat }])
              setPattern('')
            }}
          >
            Add
          </Button>
        </div>
      </Card>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search rules" className="mb-2" />
      <Card className="max-h-[420px] overflow-y-auto p-1.5">
        {rules.map((r) => {
          const c = db.categories.find((x) => x.id === r.category_id)
          return (
            <div key={r.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-card2/60">
              <code className="flex-1 truncate text-sm">{r.pattern}</code>
              <span className="truncate text-sm text-muted">
                {c?.icon} {c?.name}
              </span>
              <button onClick={() => remove('rules', r.id)} className="p-1 text-faint hover:text-bad" aria-label="Delete rule">
                <X size={16} />
              </button>
            </div>
          )
        })}
      </Card>
      <CategoryEditor c={edit} open={!!edit || adding} onClose={() => (setEdit(null), setAdding(false))} />
    </div>
  )
}

function CategoryEditor({ c, open, onClose }: { c: Category | null; open: boolean; onClose: () => void }) {
  const { db, insert, update, remove, toast } = useStore()
  const [f, setF] = useState({ name: '', icon: '📦', color: COLORS[0], kind: 'expense' as CategoryKind, archived: false })
  useEffect(() => {
    if (open) setF({ name: c?.name ?? '', icon: c?.icon ?? '📦', color: c?.color ?? COLORS[0], kind: c?.kind ?? 'expense', archived: c?.archived ?? false })
  }, [open, c])
  const used = c ? db.transactions.some((t) => t.category_id === c.id) : false
  async function save() {
    if (!f.name.trim()) return toast('Name it')
    const row = { ...f, name: f.name.trim(), sort: c?.sort ?? db.categories.length }
    if (c) await update('categories', c.id, row)
    else await insert('categories', [row])
    onClose()
  }
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={c ? 'Edit category' : 'New category'}
      footer={
        <div className="flex gap-2">
          {c && !used && (
            <Button variant="danger" onClick={async () => (await remove('categories', c.id), onClose())} aria-label="Delete">
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
        <div className="flex items-center gap-3">
          <CatIcon cat={{ ...f, id: '', sort: 0 } as Category} size="lg" />
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Category name" className="flex-1" />
        </div>
        <Field label="Counts as">
          <Segmented
            value={f.kind}
            onChange={(v) => setF({ ...f, kind: v })}
            options={[
              { value: 'expense', label: 'Spending' },
              { value: 'income', label: 'Income' },
              { value: 'transfer', label: 'Neither' },
            ]}
          />
        </Field>
        <Field label="Icon">
          <div className="grid grid-cols-9 gap-1.5">
            {EMOJI.map((e) => (
              <button key={e} onClick={() => setF({ ...f, icon: e })} className={cx('flex aspect-square items-center justify-center rounded-xl text-lg', f.icon === e ? 'bg-kiwi-deep ring-1 ring-kiwi' : 'bg-card2')}>
                {e}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Colour">
          <div className="flex gap-2">
            {COLORS.map((col) => (
              <button key={col} onClick={() => setF({ ...f, color: col })} className={cx('h-9 w-9 rounded-full', f.color === col && 'ring-2 ring-ink ring-offset-2 ring-offset-[#141415]')} style={{ background: col }} aria-label={col} />
            ))}
          </div>
        </Field>
        {c && <Toggle checked={f.archived} onChange={(v) => setF({ ...f, archived: v })} label="Hide from pickers" />}
      </div>
    </Sheet>
  )
}
