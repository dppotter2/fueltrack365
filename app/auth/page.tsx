'use client'

export const dynamic = 'force-dynamic'


import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const GOLD = '#d4a017'
const DARK = '#0a0a0a'
const SURFACE = '#141414'
const SURFACE2 = '#1e1e1e'
const BORDER = '#2a2a2a'
const TEXT = '#f0f0f0'
const MUTED = '#888'

export default function AuthPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')

  const handleAuth = async () => {
    if (!email || !password) return
    setLoading(true)
    setError('')

    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
      }
      router.push('/log')
    } catch (err: any) {
      setError(err.message || 'Authentication failed')
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: DARK, display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%', background: GOLD,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px', fontSize: 28,
        }}>
          ✦
        </div>
        <div style={{ fontSize: 28, fontWeight: 900, color: TEXT, letterSpacing: '-0.5px' }}>
          FuelTrack <span style={{ color: GOLD }}>365</span>
        </div>
        <div style={{ fontSize: 13, color: MUTED, marginTop: 4 }}>
          Claude-powered macro tracking
        </div>
      </div>

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 360,
        background: SURFACE, border: `1px solid ${BORDER}`,
        borderRadius: 20, padding: '28px 24px',
      }}>
        <h2 style={{ margin: '0 0 20px', fontSize: 20, fontWeight: 700, color: TEXT }}>
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h2>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 10, padding: '10px 14px', marginBottom: 16,
            fontSize: 13, color: '#ef4444',
          }}>
            {error}
          </div>
        )}

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            style={{
              display: 'block', width: '100%', marginTop: 6,
              background: SURFACE2, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: '12px 14px',
              color: TEXT, fontSize: 15, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}>
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onKeyDown={e => e.key === 'Enter' && handleAuth()}
            style={{
              display: 'block', width: '100%', marginTop: 6,
              background: SURFACE2, border: `1px solid ${BORDER}`,
              borderRadius: 12, padding: '12px 14px',
              color: TEXT, fontSize: 15, outline: 'none', boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          onClick={handleAuth}
          disabled={loading || !email || !password}
          style={{
            width: '100%', padding: '14px',
            background: email && password ? GOLD : SURFACE2,
            border: 'none', borderRadius: 14,
            color: email && password ? DARK : MUTED,
            fontWeight: 800, fontSize: 16, cursor: email && password ? 'pointer' : 'default',
            transition: 'background 0.2s',
          }}
        >
          {loading ? 'Loading...' : mode === 'login' ? 'Sign In' : 'Create Account'}
        </button>

        <button
          onClick={() => { setMode(m => m === 'login' ? 'signup' : 'login'); setError('') }}
          style={{
            width: '100%', marginTop: 14, background: 'none', border: 'none',
            color: MUTED, fontSize: 13, cursor: 'pointer', padding: '4px',
          }}
        >
          {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  )
}
