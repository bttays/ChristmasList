import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const invited = new URLSearchParams(window.location.search).has('join')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // Come back to this exact URL so an invite (?join=…) survives the login.
      options: { emailRedirectTo: window.location.href },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  return (
    <div className="card narrow-card">
      {invited && <p className="notice">You've been invited to join a family list! Sign in to accept.</p>}
      {sent ? (
        <>
          <h2>Check your email 📬</h2>
          <p>
            We sent a sign-in link to <strong>{email}</strong>. Open it on this device to sign in.
          </p>
          <button className="ghost" onClick={() => setSent(false)}>
            Use a different email
          </button>
        </>
      ) : (
        <form className="form" onSubmit={submit}>
          <h2>Sign in</h2>
          <p className="muted">Enter your email and we'll send you a link to sign in. No password needed.</p>
          <input
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? 'Sending…' : 'Email me a sign-in link'}
          </button>
        </form>
      )}
    </div>
  )
}

export function NamePrompt({ userId, onDone }: { userId: string; onDone: () => void }) {
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('profiles').upsert({ id: userId, display_name: name.trim() })
    if (error) setError(error.message)
    else onDone()
  }

  return (
    <form className="card narrow-card form" onSubmit={submit}>
      <h2>Welcome! What's your name?</h2>
      <p className="muted">This is how your family will see you.</p>
      <input placeholder="e.g. Aunt Linda" value={name} onChange={(e) => setName(e.target.value)} required />
      {error && <p className="error">{error}</p>}
      <button type="submit">Continue</button>
    </form>
  )
}
