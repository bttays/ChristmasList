import { useState } from 'react'
import type { Gift, GiftStatus, Recipient } from '../types'
import { formatMoney, newId, parseMoney, usePersistentState } from '../storage'

const STATUS_LABEL: Record<GiftStatus, string> = {
  idea: 'Idea',
  bought: 'Bought',
  wrapped: 'Wrapped',
}
const NEXT_STATUS: Record<GiftStatus, GiftStatus> = {
  idea: 'bought',
  bought: 'wrapped',
  wrapped: 'idea',
}

const spentOn = (r: Recipient) =>
  r.gifts.filter((g) => g.status !== 'idea').reduce((s, g) => s + (g.price ?? 0), 0)

export function GiftTracker() {
  const [people, setPeople] = usePersistentState<Recipient[]>('recipients', [])
  const [name, setName] = useState('')
  const [budget, setBudget] = useState('')

  const addPerson = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setPeople([...people, { id: newId(), name: name.trim(), budget: parseMoney(budget), gifts: [] }])
    setName('')
    setBudget('')
  }

  const updatePerson = (id: string, fn: (r: Recipient) => Recipient) =>
    setPeople(people.map((p) => (p.id === id ? fn(p) : p)))

  const removePerson = (id: string) => {
    if (confirm('Remove this person and all their gift ideas?')) {
      setPeople(people.filter((p) => p.id !== id))
    }
  }

  const totalBudget = people.reduce((s, p) => s + (p.budget ?? 0), 0)
  const totalSpent = people.reduce((s, p) => s + spentOn(p), 0)
  const giftCount = people.reduce((s, p) => s + p.gifts.length, 0)
  const doneCount = people.reduce((s, p) => s + p.gifts.filter((g) => g.status !== 'idea').length, 0)

  return (
    <section>
      <form className="card form" onSubmit={addPerson}>
        <h2>Who are you shopping for?</h2>
        <div className="row">
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input
            placeholder="Budget (optional)"
            inputMode="decimal"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
          <button type="submit">Add person</button>
        </div>
      </form>

      {people.length === 0 ? (
        <p className="empty">Add the people on your list to start tracking gift ideas.</p>
      ) : (
        <>
          <p className="summary">
            {doneCount} of {giftCount} gifts bought · {formatMoney(totalSpent)} spent
            {totalBudget > 0 && <> of {formatMoney(totalBudget)}</>}
          </p>
          <div className="people">
            {people.map((p) => (
              <PersonCard
                key={p.id}
                person={p}
                onChange={(fn) => updatePerson(p.id, fn)}
                onRemove={() => removePerson(p.id)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

function PersonCard({
  person,
  onChange,
  onRemove,
}: {
  person: Recipient
  onChange: (fn: (r: Recipient) => Recipient) => void
  onRemove: () => void
}) {
  const [gift, setGift] = useState('')
  const [price, setPrice] = useState('')

  const spent = spentOn(person)
  const over = person.budget !== undefined && spent > person.budget
  const pct = person.budget ? Math.min(100, (spent / person.budget) * 100) : 0

  const addGift = (e: React.FormEvent) => {
    e.preventDefault()
    if (!gift.trim()) return
    const g: Gift = { id: newId(), name: gift.trim(), price: parseMoney(price), status: 'idea' }
    onChange((r) => ({ ...r, gifts: [...r.gifts, g] }))
    setGift('')
    setPrice('')
  }

  const cycle = (id: string) =>
    onChange((r) => ({
      ...r,
      gifts: r.gifts.map((g) => (g.id === id ? { ...g, status: NEXT_STATUS[g.status] } : g)),
    }))

  const removeGift = (id: string) =>
    onChange((r) => ({ ...r, gifts: r.gifts.filter((g) => g.id !== id) }))

  return (
    <article className="card person">
      <header>
        <h3>{person.name}</h3>
        <button className="ghost small danger" onClick={onRemove} aria-label={`Remove ${person.name}`}>
          ✕
        </button>
      </header>

      {person.budget !== undefined && (
        <div className="budget">
          <div className="bar">
            <div className={`fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} />
          </div>
          <span className={over ? 'over-text' : ''}>
            {formatMoney(spent)} / {formatMoney(person.budget)}
          </span>
        </div>
      )}

      <ul className="gifts">
        {person.gifts.map((g) => (
          <li key={g.id} className={g.status}>
            <button className={`status ${g.status}`} onClick={() => cycle(g.id)} title="Click to change status">
              {STATUS_LABEL[g.status]}
            </button>
            <span className="gift-name">{g.name}</span>
            {g.price !== undefined && <span className="price">{formatMoney(g.price)}</span>}
            <button className="ghost small danger" onClick={() => removeGift(g.id)} aria-label="Remove gift">
              ✕
            </button>
          </li>
        ))}
      </ul>

      <form className="row compact" onSubmit={addGift}>
        <input placeholder="Gift idea" value={gift} onChange={(e) => setGift(e.target.value)} />
        <input
          placeholder="$"
          inputMode="decimal"
          className="narrow"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <button type="submit" className="small">
          Add
        </button>
      </form>
    </article>
  )
}
