import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { PRIORITY_ORDER, formatMoney, isHttpUrl, parseMoney, storeFromUrl } from '../lib/format'
import type { Family, Priority, WishItem } from '../types'
import { ItemCard } from './ItemCard'

const emptyForm = {
  url: '',
  name: '',
  price: '',
  store: '',
  image_url: '',
  priority: 'medium' as Priority,
  notes: '',
}

interface ProductInfo {
  name?: string
  price?: number
  image?: string
  store?: string
  error?: string
}

export function MyWishlist({ userId, families }: { userId: string; families: Family[] }) {
  const [items, setItems] = useState<WishItem[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [fetching, setFetching] = useState(false)
  const [fetchNote, setFetchNote] = useState<string | null>(null)
  const [lastLookup, setLastLookup] = useState('')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('wish_items').select('*').eq('owner_id', userId)
    if (error) setError(error.message)
    else setItems(data as WishItem[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
  }, [load])

  // Fill in name / price / photo / store from the product page.
  const lookup = async (raw: string) => {
    const url = raw.trim()
    if (!isHttpUrl(url) || url === lastLookup) return
    setLastLookup(url)
    setFetching(true)
    setFetchNote(null)
    const { data, error } = await supabase.functions.invoke<ProductInfo>('fetch-product', { body: { url } })
    setFetching(false)
    const info: ProductInfo = error || !data ? {} : data
    setForm((f) => ({
      ...f,
      name: f.name || info.name || '',
      price: f.price || (info.price != null ? String(info.price) : ''),
      store: f.store || info.store || storeFromUrl(url),
      image_url: info.image || f.image_url,
    }))
    if (error || info.error || (!info.name && info.price == null)) {
      setFetchNote("This store didn't share the details, so fill in the rest below.")
    } else if (info.price == null) {
      setFetchNote("Got it! The price wasn't on the page, so add it if you know it.")
    }
  }

  const reset = () => {
    setForm(emptyForm)
    setEditingId(null)
    setFetchNote(null)
    setLastLookup('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const fields = {
      url: form.url.trim() || null,
      name: form.name.trim(),
      price: parseMoney(form.price),
      store: form.store.trim() || (form.url ? storeFromUrl(form.url) : '') || null,
      image_url: form.image_url || null,
      priority: form.priority,
      notes: form.notes.trim() || null,
    }
    const { error } = editingId
      ? await supabase.from('wish_items').update(fields).eq('id', editingId)
      : await supabase.from('wish_items').insert(fields)
    if (error) return setError(error.message)
    reset()
    await load()
  }

  const edit = (item: WishItem) => {
    setEditingId(item.id)
    setLastLookup(item.url ?? '')
    setFetchNote(null)
    setForm({
      url: item.url ?? '',
      name: item.name,
      price: item.price?.toString() ?? '',
      store: item.store ?? '',
      image_url: item.image_url ?? '',
      priority: item.priority,
      notes: item.notes ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const remove = async (item: WishItem) => {
    if (!confirm(`Remove "${item.name}" from your wishlist?`)) return
    const { error } = await supabase.from('wish_items').delete().eq('id', item.id)
    if (error) return setError(error.message)
    if (editingId === item.id) reset()
    await load()
  }

  const sorted = [...items].sort(
    (a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] || a.created_at.localeCompare(b.created_at),
  )
  const total = items.reduce((sum, i) => sum + (i.price ?? 0), 0)
  const sharedWith = families.map((f) => f.name).join(' and ')

  return (
    <section>
      <form className="card form" onSubmit={submit}>
        <h2>{editingId ? 'Edit item' : 'Add to my wishlist'}</h2>
        <input
          type="url"
          placeholder="Paste a link from any store (optional)"
          value={form.url}
          onChange={(e) => setForm({ ...form, url: e.target.value })}
          onPaste={(e) => lookup(e.clipboardData.getData('text'))}
          onBlur={(e) => lookup(e.target.value)}
        />
        {fetching && <p className="muted small-text">Looking up that item…</p>}
        {fetchNote && <p className="muted small-text">{fetchNote}</p>}

        <div className="row">
          {form.image_url && (
            <div className="thumb">
              <img src={form.image_url} alt="" referrerPolicy="no-referrer" />
            </div>
          )}
          <input
            placeholder="What do you want?"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
        <div className="row">
          <input placeholder="Store" value={form.store} onChange={(e) => setForm({ ...form, store: e.target.value })} />
          <input
            placeholder="Price"
            inputMode="decimal"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
          />
          <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as Priority })}>
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
        {error && <p className="error">{error}</p>}
        <div className="actions">
          {(editingId || form.url || form.name) && (
            <button type="button" className="ghost" onClick={reset}>
              Cancel
            </button>
          )}
          <button type="submit" disabled={fetching}>
            {editingId ? 'Save' : 'Add'}
          </button>
        </div>
      </form>

      {loading ? null : items.length === 0 ? (
        <p className="empty">Your wishlist is empty. Paste a link from any store to add the first thing.</p>
      ) : (
        <>
          <p className="summary">
            {items.length} {items.length === 1 ? 'item' : 'items'}
            {total > 0 && <> · about {formatMoney(total)}</>}
            {sharedWith ? <> · shared with {sharedWith}</> : <> · join a family to share your list</>}
          </p>
          <ul className="list">
            {sorted.map((item) => (
              <ItemCard key={item.id} item={item}>
                <button className="ghost small" onClick={() => edit(item)}>
                  Edit
                </button>
                <button className="ghost small danger" onClick={() => remove(item)}>
                  Remove
                </button>
              </ItemCard>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}
