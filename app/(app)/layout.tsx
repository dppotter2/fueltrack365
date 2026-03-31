'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { DEFAULT_GOALS, MacroGoals, MacroTotals, ChatMessage, FoodEntry } from '@/lib/types'

const GOLD = '#d4a017'
const DARK = '#0a0a0a'
const SURFACE = '#141414'
const SURFACE2 = '#1e1e1e'
const BORDER = '#2a2a2a'
const TEXT = '#f0f0f0'
const MUTED = '#888'

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const day = d.getDate()
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th'
  const hrs = d.getHours()
  const mins = String(d.getMinutes()).padStart(2,'0')
  const ampm = hrs >= 12 ? 'PM' : 'AM'
  const h12 = hrs % 12 || 12
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${day}${suffix} ${h12}:${mins} ${ampm}`
}

function localDate(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ─── MacroBar ────────────────────────────────────────────────────────────────

function MacroBar({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = Math.min(100, Math.round((value / goal) * 100))
  const over = value > goal
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
        <span style={{ fontSize: 10, color: MUTED, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{label}</span>
        <span style={{ fontSize: 11, color: over ? '#ef4444' : TEXT, fontWeight: 600 }}>
          {value}<span style={{ color: MUTED, fontWeight: 400 }}>/{goal}</span>
        </span>
      </div>
      <div style={{ height: 4, background: SURFACE2, borderRadius: 2, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 2,
          background: over ? '#ef4444' : color,
          transition: 'width 0.3s ease',
        }} />
      </div>
    </div>
  )
}

// ─── NavBar ──────────────────────────────────────────────────────────────────

function NavBar({ active }: { active: string }) {
  const router = useRouter()
  const tabs = [
    { id: 'log', label: 'Log', icon: '📋' },
    { id: 'trends', label: 'Trends', icon: '📊' },
    { id: 'recipes', label: 'Recipes', icon: '🍳' },
    { id: 'profile', label: 'Profile', icon: '👤' },
  ]
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100,
      background: SURFACE, borderTop: `1px solid ${BORDER}`,
      display: 'flex',
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {tabs.map(tab => {
        const isActive = active === tab.id
        return (
          <button
            key={tab.id}
            onClick={() => router.push('/' + tab.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: '10px 0 8px',
              background: 'none', border: 'none', color: isActive ? GOLD : MUTED,
              fontSize: 10, fontWeight: isActive ? 700 : 400, letterSpacing: '0.05em',
              textTransform: 'uppercase', gap: 3,
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: 20 }}>{tab.icon}</span>
            {tab.label}
          </button>
        )
      })}
    </nav>
  )
}

// ─── Claude Chat Bubble + Modal ───────────────────────────────────────────────

function ClaudeChat({
  todayEntries, totals, goals, date, currentPage, onLogFood, onRefresh,
}: {
  todayEntries: FoodEntry[]
  totals: MacroTotals
  goals: MacroGoals
  date: string
  currentPage: string
  onLogFood: (data: any) => Promise<void>
  onRefresh: () => void
}) {
  const supabase = createClient()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load chat history from Supabase on first open
  useEffect(() => {
    if (!open || historyLoaded) return
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('chat_messages')
        .select('role, content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true })
        .limit(50)
      if (data && data.length > 0) {
        setMessages(data.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })))
      } else {
        // Welcome message on first open
        setMessages([{
          role: 'assistant',
          content: `Hey Patrick! I'm your FuelTrack AI. I know your goals, your foods, your preferences — everything. Just talk to me naturally:\n\n• *"Had 4 scoops strawberry kaged"* → logged instantly\n• *"What should I eat for dinner?"* → meal suggestions\n• *"Make me a Thai chicken recipe"* → full recipe with macros\n• *"How am I doing today?"* → macro breakdown\n\nWhat's up?`,
        }])
      }
      setHistoryLoaded(true)
    })()
  }, [open])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (open) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
    }
  }, [messages, open])

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
  }

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim()
    if (!msg || loading) return

    const userMessage: ChatMessage = { role: 'user', content: msg }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setLoading(true)

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = '44px'
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          sessionHistory: messages.slice(-20),
          todayEntries,
          goals,
          totals,
          currentPage,
          date,
        }),
      })

      const json = await res.json()

      if (json.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: json.reply }])
      }

      // Handle food logging
      if (json.logData) {
        await onLogFood(json.logData)
        onRefresh()
      }

      // Handle recipe saving (could add a "Save Recipe" button here)
      // json.recipeData is available if needed

      // Handle weight logging
      if (json.weightData?.weight) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          await supabase.from('weight_log').insert({
            user_id: user.id,
            date: localDate(),
            weight: json.weightData.weight,
          })
        }
      }

    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Something went wrong. Try again?',
      }])
    } finally {
      setLoading(false)
    }
  }, [input, messages, loading, todayEntries, goals, totals, currentPage, date, onLogFood, onRefresh])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Format assistant messages with basic markdown
  const renderContent = (content: string) => {
    const lines = content.split('\n')
    return lines.map((line, i) => {
      // Bold
      const parts = line.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
      return (
        <div key={i} style={{ marginBottom: line === '' ? 6 : 0 }}>
          {parts.map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return <strong key={j}>{part.slice(2,-2)}</strong>
            }
            if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
              return <em key={j} style={{ color: GOLD }}>{part.slice(1,-1)}</em>
            }
            // Bullet points
            if (part.startsWith('• ')) {
              return <span key={j} style={{ color: GOLD }}>• </span>
            }
            return <span key={j}>{part}</span>
          })}
        </div>
      )
    })
  }

  const remainingCal = goals.calories - totals.calories

  return (
    <>
      {/* Floating Bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 80, right: 16, zIndex: 200,
          width: 52, height: 52, borderRadius: '50%',
          background: GOLD, border: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(212,160,23,0.4)',
          transition: 'transform 0.2s, box-shadow 0.2s',
          transform: open ? 'scale(0.92)' : 'scale(1)',
        }}
        aria-label="Open Claude chat"
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={DARK} strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 198,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* Chat Sheet */}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 199,
        height: open ? '88vh' : '0',
        background: SURFACE,
        borderRadius: '20px 20px 0 0',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        transition: 'height 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
        boxShadow: open ? '0 -8px 40px rgba(0,0,0,0.6)' : 'none',
      }}>

        {/* Header */}
        <div style={{
          padding: '16px 16px 12px',
          borderBottom: `1px solid ${BORDER}`,
          flexShrink: 0,
        }}>
          {/* Date + Title row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: GOLD,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ fontSize: 14 }}>✦</span>
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>Claude</div>
                <div style={{ fontSize: 10, color: MUTED }}>{formatDate(new Date())}</div>
              </div>
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700, color: remainingCal > 0 ? GOLD : '#ef4444',
              background: 'rgba(212,160,23,0.1)', padding: '3px 8px', borderRadius: 20,
            }}>
              {remainingCal > 0 ? `${remainingCal} cal left` : `${Math.abs(remainingCal)} over`}
            </div>
          </div>

          {/* Macro progress bars */}
          <div style={{ display: 'flex', gap: 8 }}>
            <MacroBar label="Cal" value={totals.calories} goal={goals.calories} color={GOLD} />
            <MacroBar label="Pro" value={totals.protein} goal={goals.protein} color="#10b981" />
            <MacroBar label="Carb" value={totals.carbs} goal={goals.carbs} color="#3b82f6" />
            <MacroBar label="Fat" value={totals.fat} goal={goals.fat} color="#f59e0b" />
          </div>
        </div>

        {/* Messages */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '12px 12px 0',
          display: 'flex', flexDirection: 'column', gap: 8,
          WebkitOverflowScrolling: 'touch',
        }}>
          {messages.map((m, i) => (
            <div key={i} style={{
              display: 'flex',
              justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              alignItems: 'flex-end',
              gap: 6,
            }}>
              {m.role === 'assistant' && (
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: GOLD,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 11, marginBottom: 1,
                }}>✦</div>
              )}
              <div style={{
                maxWidth: '80%',
                background: m.role === 'user' ? GOLD : SURFACE2,
                color: m.role === 'user' ? DARK : TEXT,
                borderRadius: m.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                padding: '10px 14px',
                fontSize: 14, lineHeight: 1.5,
                wordBreak: 'break-word',
              }}>
                {m.role === 'assistant' ? renderContent(m.content) : m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
              <div style={{
                width: 24, height: 24, borderRadius: '50%', background: GOLD,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11,
              }}>✦</div>
              <div style={{
                background: SURFACE2, borderRadius: '18px 18px 18px 4px',
                padding: '12px 16px', display: 'flex', gap: 4, alignItems: 'center',
              }}>
                {[0,1,2].map(j => (
                  <div key={j} style={{
                    width: 6, height: 6, borderRadius: '50%', background: MUTED,
                    animation: `pulse 1.2s ease-in-out ${j * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Quick actions */}
        <div style={{
          padding: '8px 12px 0',
          display: 'flex', gap: 6, overflowX: 'auto',
          flexShrink: 0,
          WebkitOverflowScrolling: 'touch',
        }}>
          {[
            'How am I doing today?',
            'What should I eat?',
            'Log a Quest bar',
            'My kaged',
          ].map(q => (
            <button
              key={q}
              onClick={() => send(q)}
              disabled={loading}
              style={{
                flexShrink: 0, padding: '6px 12px',
                background: SURFACE2, border: `1px solid ${BORDER}`,
                borderRadius: 20, color: TEXT, fontSize: 12,
                whiteSpace: 'nowrap', cursor: 'pointer',
              }}
            >
              {q}
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{
          padding: '8px 12px',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
          borderTop: `1px solid ${BORDER}`,
          display: 'flex', gap: 8, alignItems: 'flex-end',
          flexShrink: 0, marginTop: 4,
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Tell Claude what you ate, or ask anything..."
            rows={1}
            style={{
              flex: 1, background: SURFACE2, border: `1px solid ${BORDER}`,
              borderRadius: 22, padding: '11px 16px',
              color: TEXT, fontSize: 15, resize: 'none',
              outline: 'none', lineHeight: 1.4,
              height: 44, maxHeight: 120,
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            style={{
              width: 44, height: 44, borderRadius: '50%',
              background: input.trim() && !loading ? GOLD : SURFACE2,
              border: 'none', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s',
              cursor: input.trim() && !loading ? 'pointer' : 'default',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={input.trim() && !loading ? DARK : MUTED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 60%, 100% { opacity: 0.3; transform: scale(0.8); }
          30% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  )
}

// ─── Main Layout ──────────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [goals] = useState<MacroGoals>(DEFAULT_GOALS)
  const [todayEntries, setTodayEntries] = useState<FoodEntry[]>([])
  const [totals, setTotals] = useState<MacroTotals>({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 })
  const [refreshKey, setRefreshKey] = useState(0)

  const activeTab = pathname.replace('/', '') || 'log'

  // Auth check
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.push('/auth')
      else setUser(user)
    })
  }, [])

  // Load today's entries
  const loadEntries = useCallback(async () => {
    if (!user) return
    const today = localDate()
    const { data } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', today)
      .order('created_at', { ascending: true })

    const entries = (data || []) as FoodEntry[]
    setTodayEntries(entries)

    const t = entries.reduce((acc, e) => ({
      calories: acc.calories + (e.calories || 0),
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
      fiber: acc.fiber + (e.fiber || 0),
      sodium: acc.sodium + (e.sodium || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 })
    setTotals(t)
  }, [user])

  useEffect(() => { loadEntries() }, [user, refreshKey])

  // Log food from chat
  const handleLogFood = async (data: any) => {
    if (!user) return
    await fetch('/api/log-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, date: localDate() }),
    })
  }

  if (!user) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: MUTED }}>
      Loading...
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: DARK }}>
      <main style={{
        flex: 1, overflowY: 'auto', overflowX: 'hidden',
        paddingBottom: 60,
        WebkitOverflowScrolling: 'touch',
      }}>
        {children}
      </main>

      <NavBar active={activeTab} />

      <ClaudeChat
        todayEntries={todayEntries}
        totals={totals}
        goals={goals}
        date={localDate()}
        currentPage={pathname}
        onLogFood={handleLogFood}
        onRefresh={() => setRefreshKey(k => k + 1)}
      />
    </div>
  )
}
