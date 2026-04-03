'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function AuthPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleAuth = async () => {
    setLoading(true)
    setError('')
    const fn = isSignUp ? supabase.auth.signUp : supabase.auth.signInWithPassword
    const { error } = await fn.call(supabase.auth, { email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = '/log'
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0d1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 380, textAlign: 'center',
      }}>
        <div style={{ fontSize: 32, fontWeight: 700, color: '#d4a017', marginBottom: 4 }}>
          FuelTrack 365
        </div>
        <div style={{ fontSize: 13, color: '#6b7f99', marginBottom: 32 }}>
          AI-Powered Macro Tracking
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)}
            style={{
              background: '#161b22', border: '1px solid #21262d', borderRadius: 10,
              padding: '14px 16px', color: '#e6e1d6', fontSize: 15, outline: 'none',
            }}
          />
          <input
            type="password" placeholder="Password" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            style={{
              background: '#161b22', border: '1px solid #21262d', borderRadius: 10,
              padding: '14px 16px', color: '#e6e1d6', fontSize: 15, outline: 'none',
            }}
          />
          {error && <div style={{ color: '#f87171', fontSize: 13 }}>{error}</div>}
          <button
            onClick={handleAuth} disabled={loading}
            style={{
              background: '#d4a017', border: 'none', borderRadius: 10,
              padding: '14px 16px', color: '#0d1117', fontSize: 15, fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? '...' : isSignUp ? 'Sign Up' : 'Sign In'}
          </button>
        </div>

        <button
          onClick={() => setIsSignUp(!isSignUp)}
          style={{
            background: 'none', border: 'none', color: '#6b7f99',
            fontSize: 13, marginTop: 16, cursor: 'pointer',
          }}
        >
          {isSignUp ? 'Already have an account? Sign In' : 'Need an account? Sign Up'}
        </button>
      </div>
    </div>
  )
}
