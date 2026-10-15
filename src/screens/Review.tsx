import { useMemo, useState } from 'react'
import { useStore } from '../data/store'
import { needsReview } from '../lib/stats'
import type { RawSms, Transaction } from '../lib/types'
import { PendingForeignCard } from '../ui/foreign'
import { TxEditor, TxRow } from '../ui/tx'
import { BackLink } from './More'
import { Button, Card, Empty, PageTitle, SectionTitle } from '../ui/ui'

export function Review() {
  const { db, cats, saveTransaction, update } = useStore()
  const [edit, setEdit] = useState<Transaction | null>(null)
  const [fromSms, setFromSms] = useState<RawSms | null>(null)
  const [showIgnored, setShowIgnored] = useState(false)
  const txns = useMemo(() => db.transactions.filter((t) => needsReview(t, cats) && !t.pending), [db.transactions, cats])
  const failed = db.raw_sms.filter((s) => s.status === 'failed')
  const ignored = db.raw_sms.filter((s) => s.status === 'ignored').slice(0, 30)

  const quick = (t: Transaction) =>
    db.categories
      .filter((c) => !c.archived && (t.direction === 'debit' ? c.kind === 'expense' : c.kind === 'income'))
      .sort((a, b) => a.sort - b.sort)
      .slice(0, 8)

  return (
    <div>
      <BackLink />
      <PageTitle title="Review" sub="Anything Kasi wasn't sure about" />
      <div className="mb-4">
        <PendingForeignCard />
      </div>
      {!txns.length && !failed.length && !db.transactions.some((t) => t.pending) && <Empty icon="✨" title="All caught up">Every transaction has a category and every SMS was understood.</Empty>}

      {failed.length > 0 && (
        <>
          <SectionTitle>SMS Kasi couldn’t read ({failed.length})</SectionTitle>
          <div className="space-y-2">
            {failed.map((s) => (
              <Card key={s.id} className="p-4">
                <div className="mb-1 text-xs text-faint">
                  {s.sender ?? 'Unknown sender'} · {new Date(s.received_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  {s.note ? ` · ${s.note}` : ''}
                </div>
                <div className="whitespace-pre-wrap text-sm text-ink/85">{s.body}</div>
                <div className="mt-3 flex gap-2">
                  <Button variant="soft" className="py-2 text-sm" onClick={() => setFromSms(s)}>
                    Add as transaction
                  </Button>
                  <Button variant="ghost" className="py-2 text-sm" onClick={() => update('raw_sms', s.id, { status: 'dismissed' })}>
                    Dismiss
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {txns.length > 0 && (
        <>
          <SectionTitle>Transactions to check ({txns.length})</SectionTitle>
          <div className="space-y-2">
            {txns.slice(0, 50).map((t) => (
              <Card key={t.id} className="p-2">
                <TxRow tx={t} onClick={() => setEdit(t)} showDate />
                {t.needs_review && t.category_id && <div className="px-3 pb-1 text-xs text-warn">{t.currency !== 'LKR' ? `Paid in ${t.currency}. Waiting for the exchange rate; it converts automatically.` : 'Money in or out? Kasi had to guess.'}</div>}
                <div className="no-scrollbar flex gap-1.5 overflow-x-auto px-2 pb-2 pt-1">
                  {quick(t).map((c) => (
                    <button key={c.id} onClick={() => saveTransaction({ id: t.id, category_id: c.id }, { learn: true })} className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[13px] text-muted hover:border-kiwi hover:text-ink">
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {ignored.length > 0 && (
        <div className="mt-8">
          <button onClick={() => setShowIgnored(!showIgnored)} className="text-sm text-muted hover:text-ink">
            {showIgnored ? 'Hide' : 'Show'} recently ignored SMS ({ignored.length})
          </button>
          {showIgnored && (
            <div className="mt-3 space-y-2">
              {ignored.map((s) => (
                <div key={s.id} className="rounded-2xl border border-line p-3 text-sm">
                  <div className="text-xs text-faint">
                    {s.note} · {s.sender}
                  </div>
                  <div className="mt-1 text-muted">{s.body}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <TxEditor tx={edit} open={!!edit} onClose={() => setEdit(null)} />
      <TxEditor
        tx={null}
        open={!!fromSms}
        preset={fromSms ? { occurred_at: fromSms.received_at, note: null } : undefined}
        onClose={async () => {
          if (fromSms) await update('raw_sms', fromSms.id, { status: 'dismissed' })
          setFromSms(null)
        }}
      />
    </div>
  )
}
