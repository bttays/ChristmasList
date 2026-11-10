import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { familyPeople } from '../lib/data'
import { PRIORITY_ORDER } from '../lib/format'
import type { Family, WishItem } from '../types'
import { ItemCard } from './ItemCard'

type SortKey = 'priority' | 'price-asc' | 'price-desc' | 'newest'
type GroupKey = 'person' | 'store' | 'none'

interface Claim {
  id: string
  giver_id: string
  item_id: string
}

const NO_STORE = 'Other / no store'

export function FamilyLists({ userId, families }: { userId: string; families: Family[] }) {
  const people = useMemo(() => familyPeople(families, userId), [families, userId])
  const personById = useMemo(() => new Map(people.map((p) => [p.id, p])), [people])

  const [items, setItems] = useState<WishItem[]>([])
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [familyFilter, setFamilyFilter] = useState('all')
  const [personFilter, setPersonFilter] = useState('all')
  const [storeFilter, setStoreFilter] = useState('all')
  const [groupBy, setGroupBy] = useState<GroupKey>('person')
  const [sortBy, setSortBy] = useState<SortKey>('priority')
  const [hideClaimed, setHideClaimed] = useState(false)

  const load = useCallback(async () => {
    const ids = people.map((p) => p.id)
    if (ids.length === 0) {
      setItems([])
      setLoading(false)
      return
    }
    const [itemsRes, claimsRes] = await Promise.all([
      supabase.from('wish_items').select('*').in('owner_id', ids),
      // Row-level security only returns claims on other people's items.
      supabase.from('gifts').select('id, giver_id, item_id').not('item_id', 'is', null),
    ])
    if (itemsRes.error || claimsRes.error) {
      setError((itemsRes.error ?? claimsRes.error)!.message)
    } else {
      setItems(itemsRes.data as WishItem[])
      setClaims(claimsRes.data as Claim[])
    }
    setLoading(false)
  }, [people])

  useEffect(() => {
    load()
  }, [load])

  const claimByItem = useMemo(() => new Map(claims.map((c) => [c.item_id, c])), [claims])

  const claim = async (item: WishItem) => {
    setError(null)
    const { error } = await supabase
      .from('gifts')
      .insert({ recipient_id: item.owner_id, item_id: item.id, name: item.name, price: item.price })
    if (error) setError(error.code === '23505' ? 'Someone else just claimed that one!' : error.message)
    await load()
  }

  const unclaim = async (c: Claim) => {
    if (!confirm("Un-claim this item? It'll come off your gift list.")) return
    const { error } = await supabase.from('gifts').delete().eq('id', c.id)
    if (error) setError(error.message)
    await load()
  }

  const peopleInFamily = people.filter((p) => familyFilter === 'all' || p.familyIds.includes(familyFilter))
  const stores = [...new Set(items.map((i) => i.store || NO_STORE))].sort()

  const visible = items
    .filter((i) => {
      const p = personById.get(i.owner_id)
      if (!p) return false
      if (familyFilter !== 'all' && !p.familyIds.includes(familyFilter)) return false
      if (personFilter !== 'all' && i.owner_id !== personFilter) return false
      if (storeFilter !== 'all' && (i.store || NO_STORE) !== storeFilter) return false
      const c = claimByItem.get(i.id)
      if (hideClaimed && c && c.giver_id !== userId) return false
      return true
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'price-asc':
          return (a.price ?? Infinity) - (b.price ?? Infinity)
        case 'price-desc':
          return (b.price ?? -1) - (a.price ?? -1)
        case 'newest':
          return b.created_at.localeCompare(a.created_at)
        default:
          return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]
      }
    })

  const groups = new Map<string, WishItem[]>()
  for (const i of visible) {
    const key =
      groupBy === 'person'
        ? personById.get(i.owner_id)!.display_name
        : groupBy === 'store'
          ? i.store || NO_STORE
          : ''
    groups.set(key, [...(groups.get(key) ?? []), i])
  }
  const groupKeys = [...groups.keys()].sort((a, b) =>
    a === NO_STORE ? 1 : b === NO_STORE ? -1 : a.localeCompare(b),
  )

  if (people.length === 0) {
    return (
      <p className="empty">
        Nobody else is in your families yet. Go to the Families tab and send them an invite link.
      </p>
    )
  }

  return (
    <section>
      <div className="card toolbar">
        {families.length > 1 && (
          <label>
            Family
            <select
              value={familyFilter}
              onChange={(e) => {
                setFamilyFilter(e.target.value)
                setPersonFilter('all')
              }}
            >
              <option value="all">All families</option>
              {families.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Person
          <select value={personFilter} onChange={(e) => setPersonFilter(e.target.value)}>
            <option value="all">Everyone</option>
            {peopleInFamily.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Store
          <select value={storeFilter} onChange={(e) => setStoreFilter(e.target.value)}>
            <option value="all">All stores</option>
            {stores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label>
          Group by
          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as GroupKey)}>
            <option value="person">Person</option>
            <option value="store">Store</option>
            <option value="none">Nothing</option>
          </select>
        </label>
        <label>
          Sort
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)}>
            <option value="priority">Most wanted</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
            <option value="newest">Newest</option>
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={hideClaimed} onChange={(e) => setHideClaimed(e.target.checked)} />
          Hide items others claimed
        </label>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? null : visible.length === 0 ? (
        <p className="empty">No items match. Try changing the filters.</p>
      ) : (
        groupKeys.map((key) => (
          <div key={key} className="group">
            {key && <h2 className="group-title">{key}</h2>}
            <ul className="list">
              {groups.get(key)!.map((item) => {
                const c = claimByItem.get(item.id)
                const mine = c?.giver_id === userId
                const owner = personById.get(item.owner_id)!.display_name
                return (
                  <ItemCard key={item.id} item={item} dim={!!c && !mine}>
                    {groupBy !== 'person' && <span className="for">For {owner}</span>}
                    {!c && (
                      <button className="small" onClick={() => claim(item)}>
                        I'll get this
                      </button>
                    )}
                    {mine && (
                      <>
                        <span className="claimed mine">✓ You're getting this</span>
                        <button className="ghost small" onClick={() => unclaim(c)}>
                          Undo
                        </button>
                      </>
                    )}
                    {c && !mine && (
                      <span className="claimed">
                        {personById.get(c.giver_id)?.display_name ?? 'Someone'} is getting this
                      </span>
                    )}
                  </ItemCard>
                )
              })}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
