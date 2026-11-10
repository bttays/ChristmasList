import { useState } from 'react'
import type { Priority, WishItem } from '../types'
import { formatMoney, newId, parseMoney, usePersistentState } from '../storage'

const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 }

const emptyForm = { name: '', url: '', price: '', priority: 'medium' as Priority, notes: '' }

export function Wishlist() {
  const [items, setItems] = usePersistentState<WishItem[]>('wishlist', [])
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    const fields = {
      name: form.name.trim(),
      url: form.url.trim() || undefined,
      price: parseMoney(form.price),
      priority: form.priority,
      notes: form.notes.trim() || undefined,
    }
    if (editingId) {
      setItems(items.map((i) => (i.id === editingId ? { ...i, ...fields } : i)))
    } else {
      setItems([...items, { id: newId(), createdAt: Date.now(), ...fields }])
    }
    setForm(emptyForm)
    setEditingId(null)
  }

  const edit = (item: WishItem) => {
    setEditingId(item.id)
    setForm({
      name: item.name,
      url: item.url ?? '',
      price: item.price?.toString() ?? '',
      priority: item.priority,
      notes: item.notes ?? '',
    })
  }

  const cancel = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const remove = (id: string) => {
    setItems(items.filter((i) => i.id !== id))
    if (editingId === id) cancel()
  }

  const sorted = [...items].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.createdAt - b.createdAt,
  )
  const total = items.reduce((sum, i) => sum + (i.price ?? 0), 0)

  return (
    <section>
      <form className="card form" onSubmit={submit}>
        <h2>{editingId ? 'Edit item' : 'Add to my wishlist'}</h2>
        <input
          placeholder="What do you want?"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <div className="row">
          <input
            placeholder="Link (optional)"
            type="url"
            value={form.url}
            onChange={(e) => setForm({ ...form, url: e.target.value })}
          />
          <input
            placeholder="Price"
            inputMode="decimal"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <select
            value={form.priority}
            onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}
          >
            <option value="high">Really want</option>
            <option value="medium">Would like</option>
            <option value="low">Nice to have</option>
          </select>
        </div>
        <textarea
          placeholder="Notes: size, color, model…"
          rows={2}
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <div className="actions">
          {editingId && (
            <button type="button" className="ghost" onClick={cancel}>
              Cancel
            </button>
          )}
          <button type="submit">{editingId ? 'Save' : 'Add'}</button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="empty">Your wishlist is empty. Add the first thing you're hoping for.</p>
      ) : (
        <>
          <p className="summary">
            {items.length} {items.length === 1 ? 'item' : 'items'}
            {total > 0 && <> · about {formatMoney(total)}</>}
          </p>
          <ul className="list">
            {sorted.map((item) => (
              <li key={item.id} className="card item">
                <div className="item-main">
                  <span className={`badge ${item.priority}`}>
                    {item.priority === 'high' ? 'Really want' : item.priority === 'medium' ? 'Would like' : 'Nice to have'}
                  </span>
                  <h3>
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer">
                        {item.name}
                      </a>
                    ) : (
                      item.name
                    )}
                  </h3>
                  {item.notes && <p className="notes">{item.notes}</p>}
                </div>
                <div className="item-side">
                  {item.price !== undefined && <span className="price">{formatMoney(item.price)}</span>}
                  <button className="ghost small" onClick={() => edit(item)}>
                    Edit
                  </button>
                  <button className="ghost small danger" onClick={() => remove(item.id)}>
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
