import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { familyPeople } from '../lib/data'
import { NEXT_STATUS, STATUS_LABEL, formatMoney, parseMoney } from '../lib/format'
import type { Budget, Family, Gift } from '../types'

/** Money counts as spent once a gift is bought (or wrapped). */
const spent = (gifts: Gift[]) => gifts.filter((g) => g.status !== 'planned').reduce((s, g) => s + (g.price ?? 0), 0)
const planned = (gifts: Gift[]) => gifts.reduce((s, g) => s + (g.price ?? 0), 0)

export function Gifts({ userId, families }: { userId: string; families: Family[] }) {
  const people = useMemo(() => familyPeople(families, userId), [families, userId])
  const [gifts, setGifts] = useState<Gift[]>([])
  const [budgets, setBudgets] = useState<Budget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [g, b] = await Promise.all([
      supabase.from('gifts').select('*').eq('giver_id', userId).order('created_at'),
      supabase.from('budgets').select('recipient_id, amount').eq('owner_id', userId),
    ])
    if (g.error || b.error) setError((g.error ?? b.error)!.message)
    else {
      setGifts(g.data as Gift[])
      setBudgets(b.data as Budget[])
    }
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  const run = async (p: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await p
    if (error) setError(error.message)
    await load()
  }

  const budgetFor = (recipientId: string | null) => budgets.find((b) => b.recipient_id === recipientId)?.amount ?? null

  const saveBudget = async (recipientId: string | null, value: string) => {
    const amount = parseMoney(value)
    if (amount === budgetFor(recipientId)) return
    let del = supabase.from('budgets').delete().eq('owner_id', userId)
    del = recipientId ? del.eq('recipient_id', recipientId) : del.is('recipient_id', null)
    const { error } = await del
    if (error) return setError(error.message)
    if (amount !== null) await run(supabase.from('budgets').insert({ recipient_id: recipientId, amount }))
    else await load()
  }

  const overall = budgetFor(null)
  const totalSpent = spent(gifts)
  const totalPlanned = planned(gifts)
  const bought = gifts.filter((g) => g.status !== 'planned').length

  // Include anyone you have gifts for, even if they've since left your families.
  const recipients = [
    ...people,
    ...[...new Set(gifts.map((g) => g.recipient_id))]
      .filter((id) => !people.some((p) => p.id === id))
      .map((id) => ({ id, display_name: 'Former family member', familyIds: [] })),
  ]

  if (loading) return null
  if (recipients.length === 0) {
    return <p className="empty">Once family members join, you can plan gifts and budgets for them here.</p>
  }

  return (
    <section>
      <div className="card totals">
        <div>
          <span className="big">{formatMoney(totalSpent)}</span>
          <span className="muted">spent</span>
        </div>
        <div>
          <span className="big">{formatMoney(totalPlanned)}</span>
          <span className="muted">planned in total</span>
        </div>
        <div>
          <span className="big">
            {bought}/{gifts.length}
          </span>
          <span className="muted">gifts bought</span>
        </div>
        <label className="budget-input">
          <span className="muted">Overall budget</span>
          <MoneyInput value={overall} onSave={(v) => saveBudget(null, v)} />
        </label>
        {overall !== null && <BudgetBar spent={totalSpent} budget={overall} />}
      </div>

      {error && <p className="error">{error}</p>}

      <div className="people">
        {recipients.map((p) => (
          <PersonCard
            key={p.id}
            name={p.display_name}
            gifts={gifts.filter((g) => g.recipient_id === p.id)}
            budget={budgetFor(p.id)}
            canAdd={p.familyIds.length > 0}
            onBudget={(v) => saveBudget(p.id, v)}
            onAdd={(name, price) => run(supabase.from('gifts').insert({ recipient_id: p.id, name, price }))}
            onUpdate={(id, fields) => run(supabase.from('gifts').update(fields).eq('id', id))}
            onRemove={(g) => {
              const msg = g.item_id
                ? `Remove "${g.name}"? This also un-claims it from their wishlist.`
                : `Remove "${g.name}"?`
              if (confirm(msg)) run(supabase.from('gifts').delete().eq('id', g.id))
            }}
          />
        ))}
      </div>
    </section>
  )
}

function BudgetBar({ spent, budget }: { spent: number; budget: number }) {
  const over = spent > budget
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : over ? 100 : 0
  return (
    <div className="budget">
      <div className="bar">
        <div className={`fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={over ? 'over-text' : ''}>
        {over ? `${formatMoney(spent - budget)} over` : `${formatMoney(budget - spent)} left`}
      </span>
    </div>
  )
}

/** A price field that saves when you leave it or press Enter. */
function MoneyInput({ value, onSave, placeholder = '$' }: { value: number | null; onSave: (v: string) => void; placeholder?: string }) {
  const [text, setText] = useState(value?.toString() ?? '')
  // Reset the field when the saved value changes (e.g. after a reload).
  const [saved, setSaved] = useState(value)
  if (saved !== value) {
    setSaved(value)
    setText(value?.toString() ?? '')
  }
  return (
    <input
      className="money"
      inputMode="decimal"
      placeholder={placeholder}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onSave(text)}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
    />
  )
}

function PersonCard({
  name,
  gifts,
  budget,
  canAdd,
  onBudget,
  onAdd,
  onUpdate,
  onRemove,
}: {
  name: string
  gifts: Gift[]
  budget: number | null
  canAdd: boolean
  onBudget: (v: string) => void
  onAdd: (name: string, price: number | null) => void
  onUpdate: (id: string, fields: Partial<Gift>) => void
  onRemove: (g: Gift) => void
}) {
  const [idea, setIdea] = useState('')
  const [price, setPrice] = useState('')

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    if (!idea.trim()) return
    onAdd(idea.trim(), parseMoney(price))
    setIdea('')
    setPrice('')
  }

  return (
    <article className="card person">
      <header className="card-head">
        <h3>{name}</h3>
        <label className="budget-input inline">
          <span className="muted small-text">Budget</span>
          <MoneyInput value={budget} onSave={onBudget} />
        </label>
      </header>

      {budget !== null && <BudgetBar spent={spent(gifts)} budget={budget} />}

      {gifts.length === 0 ? (
        <p className="muted small-text">No gifts yet. Claim something from their list, or add your own idea.</p>
      ) : (
        <ul className="gifts">
          {gifts.map((g) => (
            <li key={g.id} className={g.status}>
              <button
                className={`status ${g.status}`}
                onClick={() => onUpdate(g.id, { status: NEXT_STATUS[g.status] })}
                title="Click to change status"
              >
                {STATUS_LABEL[g.status]}
              </button>
              <span className="gift-name">
                {g.name}
                {g.item_id && <span className="from-list" title="Claimed from their wishlist"> ★</span>}
              </span>
              <MoneyInput value={g.price} onSave={(v) => onUpdate(g.id, { price: parseMoney(v) })} />
              <button className="ghost small danger" onClick={() => onRemove(g)} aria-label={`Remove ${g.name}`}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {canAdd && (
        <form className="row compact" onSubmit={add}>
          <input placeholder="Add a gift idea" value={idea} onChange={(e) => setIdea(e.target.value)} />
          <input placeholder="$" inputMode="decimal" className="money" value={price} onChange={(e) => setPrice(e.target.value)} />
          <button type="submit" className="small">
            Add
          </button>
        </form>
      )}
    </article>
  )
}
