import { useState } from 'react'
import { supabase } from '../lib/supabase'

/** Supabase reports failed sign-in links in the URL, e.g. #error_code=otp_expired. */
function linkErrorFromUrl(): string | null {
  const params = new URLSearchParams(window.location.hash.slice(1) || window.location.search)
  if (!params.get('error') && !params.get('error_code')) return null
  // Clear the error from the address bar but keep anything else (like ?join=).
  const search = new URLSearchParams(window.location.search)
  for (const k of ['error', 'error_code', 'error_description']) search.delete(k)
  const qs = search.toString()
  window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
  return params.get('error_code') === 'otp_expired'
    ? 'That sign-in link had already been used or expired. Work email often "opens" links to scan them, which uses them up. Use the code from the email instead.'
    : params.get('error_description') ?? 'Sign-in failed. Please try again.'
}

export function Login() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(linkErrorFromUrl)
  const invited = new URLSearchParams(window.location.search).has('join')

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      // Come back to this exact URL so an invite (?join=…) survives the login.
      options: { emailRedirectTo: window.location.href.split('#')[0] },
    })
    setBusy(false)
    if (error) setError(error.message)
    else setSent(true)
  }

  const verify = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.replace(/\D/g, ''),
      type: 'email',
    })
    setBusy(false)
    if (error) {
      setError(
        /expired|invalid/i.test(error.message)
          ? "That code didn't work. It may have expired, so check you used the newest email, or send a new one."
          : error.message,
      )
    }
    // On success the session listener in App takes over.
  }

  return (
    <div className="card narrow-card">
      {invited && <p className="notice">You've been invited to join a family list! Sign in to accept.</p>}
      {sent ? (
        <form className="form" onSubmit={verify}>
          <h2>Check your email 📬</h2>
          <p className="muted">
            We sent an email to <strong>{email}</strong>. Type the code from it below.
          </p>
          <input
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="123456"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoFocus
            required
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={busy}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <div className="actions">
            <button
              type="button"
              className="ghost small"
              onClick={() => {
                setSent(false)
                setCode('')
                setError(null)
              }}
            >
              Use a different email / send again
            </button>
          </div>
        </form>
      ) : (
        <form className="form" onSubmit={send}>
          <h2>Sign in</h2>
          <p className="muted">Enter your email and we'll send you a sign-in code. No password needed.</p>
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
            {busy ? 'Sending…' : 'Email me a sign-in code'}
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
