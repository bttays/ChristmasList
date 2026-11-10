import { useCallback, useEffect, useState } from 'react'
import { isConfigured, supabase } from './lib/supabase'
import { useFamilies, useSession } from './lib/data'
import type { Profile } from './types'
import { Login, NamePrompt } from './components/Login'
import { MyWishlist } from './components/MyWishlist'
import { FamilyLists } from './components/FamilyLists'
import { Gifts } from './components/Gifts'
import { Families } from './components/Families'

type Tab = 'mine' | 'family' | 'gifts' | 'families'

const TABS: { id: Tab; label: string }[] = [
  { id: 'mine', label: 'My list' },
  { id: 'family', label: 'Family lists' },
  { id: 'gifts', label: 'Gifts & budget' },
  { id: 'families', label: 'Families' },
]

function daysUntilChristmas() {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let xmas = new Date(now.getFullYear(), 11, 25)
  if (today > xmas) xmas = new Date(now.getFullYear() + 1, 11, 25)
  return Math.round((xmas.getTime() - today.getTime()) / 86_400_000)
}

export default function App() {
  const days = daysUntilChristmas()
  return (
    <div className="app">
      <header className="top">
        <h1>🎄 Christmas List</h1>
        <p className="countdown">
          {days === 0 ? 'Merry Christmas!' : `${days} ${days === 1 ? 'day' : 'days'} until Christmas`}
        </p>
      </header>
      {isConfigured ? (
        <Main />
      ) : (
        <p className="card notice">
          The app isn't connected to its database yet. Copy <code>.env.example</code> to <code>.env.local</code> and
          fill in your Supabase project URL and anon key (see the README).
        </p>
      )}
    </div>
  )
}

function Main() {
  const { session, loading } = useSession()
  if (loading) return null
  if (!session) return <Login />
  return <SignedIn userId={session.user.id} />
}

function SignedIn({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined)
  const [tab, setTab] = useState<Tab>('mine')
  const [notice, setNotice] = useState<string | null>(null)
  const { families, loading: familiesLoading, error, reload } = useFamilies(!!profile)

  const loadProfile = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('id, display_name').eq('id', userId).maybeSingle()
    setProfile(data)
  }, [userId])

  useEffect(() => {
    loadProfile()
  }, [loadProfile])

  // Accept an invite link (?join=CODE) once the profile exists.
  useEffect(() => {
    if (!profile) return
    const params = new URLSearchParams(window.location.search)
    const code = params.get('join')
    if (!code) return
    params.delete('join')
    const qs = params.toString()
    window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
    supabase.rpc('join_family', { code }).then(({ error }) => {
      if (error) setNotice(`Couldn't join that family: ${error.message}`)
      else {
        setNotice('You joined the family! 🎉')
        setTab('family')
      }
      reload()
    })
  }, [profile, reload])

  // New users with no family land on the Families tab.
  useEffect(() => {
    if (!familiesLoading && families.length === 0) setTab('families')
  }, [familiesLoading, families.length])

  if (profile === undefined) return null
  if (profile === null) return <NamePrompt userId={userId} onDone={loadProfile} />

  return (
    <>
      <div className="whoami">
        Signed in as <strong>{profile.display_name}</strong>
        <button className="ghost small" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      </div>

      <nav className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>

      {notice && (
        <p className="notice" onClick={() => setNotice(null)}>
          {notice}
        </p>
      )}
      {error && <p className="error">{error}</p>}

      <main>
        {tab === 'mine' && <MyWishlist userId={userId} families={families} />}
        {tab === 'family' && <FamilyLists userId={userId} families={families} />}
        {tab === 'gifts' && <Gifts userId={userId} families={families} />}
        {tab === 'families' && <Families userId={userId} families={families} reload={reload} />}
      </main>
    </>
  )
}
