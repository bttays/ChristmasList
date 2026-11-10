import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { inviteLink } from '../lib/data'
import type { Family } from '../types'

export function Families({
  userId,
  families,
  reload,
}: {
  userId: string
  families: Family[]
  reload: () => Promise<void>
}) {
  const [newName, setNewName] = useState('')
  const [code, setCode] = useState('')
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const { error } = await supabase.from('families').insert({ name: newName.trim() })
    if (error) return setError(error.message)
    setNewName('')
    await reload()
  }

  const join = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    // Accept either a bare code or a full invite link.
    const raw = code.trim()
    const parsed = raw.match(/join=([a-z0-9]+)/i)?.[1] ?? raw
    const { error } = await supabase.rpc('join_family', { code: parsed })
    if (error) return setError(error.message)
    setCode('')
    await reload()
  }

  const copy = async (f: Family) => {
    await navigator.clipboard.writeText(inviteLink(f.invite_code))
    setCopied(f.id)
    setTimeout(() => setCopied(null), 2000)
  }

  const leave = async (f: Family) => {
    if (!confirm(`Leave the ${f.name} family? You'll stop seeing their lists, and they'll stop seeing yours.`)) return
    const { error } = await supabase.from('family_members').delete().eq('family_id', f.id).eq('user_id', userId)
    if (error) return setError(error.message)
    await reload()
  }

  return (
    <section>
      {error && <p className="error">{error}</p>}

      {families.length === 0 && (
        <p className="notice">
          Start by creating a family (like "Sills Family"), then send the invite link to everyone. If someone already
          made one, ask them for the link.
        </p>
      )}

      <div className="people">
        {families.map((f) => (
          <article key={f.id} className="card">
            <header className="card-head">
              <h3>{f.name}</h3>
              <button className="ghost small danger" onClick={() => leave(f)}>
                Leave
              </button>
            </header>
            <p className="muted small-text">
              {f.members.length} {f.members.length === 1 ? 'member' : 'members'}
            </p>
            <ul className="members">
              {f.members.map((m) => (
                <li key={m.id}>{m.id === userId ? `${m.display_name} (you)` : m.display_name}</li>
              ))}
            </ul>
            <button className="small" onClick={() => copy(f)}>
              {copied === f.id ? 'Copied!' : 'Copy invite link'}
            </button>
          </article>
        ))}
      </div>

      <div className="two-col">
        <form className="card form" onSubmit={create}>
          <h2>Create a family</h2>
          <input placeholder="e.g. Taylor Family" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <button type="submit">Create</button>
        </form>
        <form className="card form" onSubmit={join}>
          <h2>Join a family</h2>
          <input placeholder="Paste an invite link or code" value={code} onChange={(e) => setCode(e.target.value)} required />
          <button type="submit">Join</button>
        </form>
      </div>
    </section>
  )
}
