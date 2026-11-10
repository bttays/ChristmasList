import { useCallback, useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Family, Person, Profile } from '../types'

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  return { session, loading }
}

export function useFamilies(enabled: boolean) {
  const [families, setFamilies] = useState<Family[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('families')
      .select('id, name, invite_code, created_by, family_members(profiles(id, display_name))')
      .order('name')
    if (error) {
      setError(error.message)
    } else {
      setError(null)
      setFamilies(
        (data ?? []).map((f) => ({
          id: f.id,
          name: f.name,
          invite_code: f.invite_code,
          created_by: f.created_by,
          members: (f.family_members as unknown as { profiles: Profile | null }[])
            .map((m) => m.profiles)
            .filter((p): p is Profile => p !== null)
            .sort((a, b) => a.display_name.localeCompare(b.display_name)),
        })),
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (enabled) reload()
  }, [enabled, reload])

  return { families, loading, error, reload }
}

/** Everyone you share a family with (excluding you), deduplicated across families. */
export function familyPeople(families: Family[], excludeId: string): Person[] {
  const map = new Map<string, Person>()
  for (const f of families) {
    for (const m of f.members) {
      if (m.id === excludeId) continue
      const p = map.get(m.id) ?? { ...m, familyIds: [] }
      p.familyIds.push(f.id)
      map.set(m.id, p)
    }
  }
  return [...map.values()].sort((a, b) => a.display_name.localeCompare(b.display_name))
}

export const inviteLink = (code: string) =>
  `${window.location.origin}${window.location.pathname}?join=${code}`
