'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useRef, useCallback } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DARK = '#0d1117'
const SURFACE = '#161b22'
const SURFACE2 = '#21262d'
const BORDER = '#30363d'
const GOLD = '#d4a017'
const TEXT = '#e6e1d6'
const MUTED = '#6b7f99'
const BLUE = '#3b82f6'

const DEFAULT_GOALS = { calories: 1650, protein: 200, carbs: 140, fat: 40, fiber: 33, sodium: 2000 }

interface Entry { id: string; name: string; serving: string; calories: number; protein: number; carbs: number; fat: number; fiber: number; sodium: number; category: string; date: string; created_at: string }
interface Msg { role: 'user' | 'assistant'; content: string }

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [user, setUser] = useState<any>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [goals, setGoals] = useState(DEFAULT_GOALS)
  const [waterOz, setWaterOz] = useState(0)
  const [viewingDate, setViewingDate] = useState(new Date().toISOString().split('T')[0])
  const [frequents, setFrequents] = useState<any[]>([])
  const [library, setLibrary] = useState<any[]>([])
  const [recipes, setRecipes] = useState<any[]>([])
  const [recentEntries, setRecentEntries] = useState<any[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auth
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUser(data.user)
      else window.location.href = '/auth'
    })
  }, [])

  // Listen for date changes from log page
  useEffect(() => {
    const handler = (e: any) => setViewingDate(e.detail)
    window.addEventListener('fueltrack:viewdate', handler)
    return () => window.removeEventListener('fueltrack:viewdate', handler)
  }, [])

  // Parallel data fetch
  const fetchAll = useCallback(async () => {
    if (!user) return
    const today = viewingDate
    const weekAgo = new Date(new Date(today).getTime() - 7 * 86400000).toISOString().split('T')[0]

    const [entriesRes, waterRes, goalsRes, libRes, recRes, recentRes] = await Promise.all([
      supabase.from('food_entries').select('*').eq('user_id', user.id).eq('date', today).order('created_at'),
      supabase.from('water_entries').select('amount_oz').eq('user_id', user.id).eq('date', today),
      supabase.from('user_goals').select('*').eq('user_id', user.id).single(),
      supabase.from('food_library').select('*').eq('user_id', user.id).order('times_logged', { ascending: false }).limit(30),
      supabase.from('recipes').select('*').eq('user_id', user.id).order('name'),
      supabase.from('food_entries').select('*').eq('user_id', user.id).gte('date', weekAgo).order('created_at', { ascending: false }),
    ])

    setEntries(entriesRes.data || [])
    setWaterOz((waterRes.data || []).reduce((s: number, e: any) => s + (e.amount_oz || 0), 0))
    if (goalsRes.data) {
      setGoals({
        calories: goalsRes.data.calories || DEFAULT_GOALS.calories,
        protein: goalsRes.data.protein || DEFAULT_GOALS.protein,
        carbs: goalsRes.data.carbs || DEFAULT_GOALS.carbs,
        fat: goalsRes.data.fat || DEFAULT_GOALS.fat,
        fiber: goalsRes.data.fiber || DEFAULT_GOALS.fiber,
        sodium: goalsRes.data.sodium || DEFAULT_GOALS.sodium,
      })
    }
    setLibrary(libRes.data || [])
    setRecipes(recRes.data || [])
    setRecentEntries(recentRes.data || [])

    // Build frequents from recent
    const freq: Record<string, number> = {}
    ;(recentRes.data || []).forEach((e: any) => { freq[e.name] = (freq[e.name] || 0) + 1 })
    setFrequents(Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name]) => name))
  }, [user, viewingDate])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Listen for refresh events
  useEffect(() => {
    const handler = () => fetchAll()
    window.addEventListener('fueltrack:refresh', handler)
    return () => window.removeEventListener('fueltrack:refresh', handler)
  }, [fetchAll])

  // Load chat history
  useEffect(() => {
    if (!user) return
    supabase.from('chat_messages').select('role,content').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(30)
      .then(({ data }) => {
        if (data && data.length > 0) setMessages(data.reverse() as Msg[])
      })
  }, [user])

  // Scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  // Totals
  const totals = entries.reduce((acc, e) => ({
    calories: acc.calories + e.calories,
    protein: acc.protein + e.protein,
    carbs: acc.carbs + e.carbs,
    fat: acc.fat + e.fat,
    fiber: acc.fiber + e.fiber,
    sodium: acc.sodium + e.sodium,
  }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 })

  const remaining = {
    calories: goals.calories - totals.calories,
    protein: goals.protein - totals.protein,
    carbs: goals.carbs - totals.carbs,
    fat: goals.fat - totals.fat,
  }

  // Parse structured blocks from AI response
  const parseAndExecuteBlocks = async (text: string) => {
    // LOG block
    const logMatch = text.match(/\|\|LOG\|\|([\s\S]+?)\|\|END\|\|/)
    if (logMatch) {
      try {
        const data = JSON.parse(logMatch[1].trim())
        // Optimistic update
        const tempEntry = { ...data, id: 'temp-' + Date.now(), date: viewingDate, created_at: new Date().toISOString() }
        setEntries(prev => [...prev, tempEntry])
        // Save to DB
        const res = await fetch('/api/log-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'log', ...data, date: viewingDate }),
        })
        if (res.ok) {
          const { entry } = await res.json()
          setEntries(prev => prev.map(e => e.id === tempEntry.id ? entry : e))
          // Save to food library
          if (!data.serving?.toLowerCase().includes('half') && !data.serving?.toLowerCase().includes('rest')) {
            await supabase.from('food_library').upsert({
              user_id: user.id, name: data.name, serving_size: data.serving,
              calories: data.calories, protein: data.protein, carbs: data.carbs,
              fat: data.fat, fiber: data.fiber || 0, sodium: data.sodium || 0,
              times_logged: 1,
            }, { onConflict: 'user_id,name' })
          }
        }
        window.dispatchEvent(new Event('fueltrack:refresh'))
      } catch (e) { console.error('LOG parse error:', e) }
    }

    // TALLY block
    const tallyMatch = text.match(/\|\|TALLY\|\|([\s\S]+?)\|\|END\|\|/)
    if (tallyMatch) {
      try {
        const data = JSON.parse(tallyMatch[1].trim())
        const res = await fetch('/api/log-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'tally', ...data, date: viewingDate }),
        })
        if (res.ok) window.dispatchEvent(new Event('fueltrack:refresh'))
      } catch (e) { console.error('TALLY parse error:', e) }
    }

    // RECIPE block
    const recipeMatch = text.match(/\|\|RECIPE\|\|([\s\S]+?)\|\|END\|\|/)
    if (recipeMatch) {
      try {
        const data = JSON.parse(recipeMatch[1].trim())
        const res = await fetch('/api/log-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'recipe', recipe: data }),
        })
        if (res.ok) window.dispatchEvent(new Event('fueltrack:refresh'))
      } catch (e) { console.error('RECIPE parse error:', e) }
    }

    // WATER block
    const waterMatch = text.match(/\|\|WATER\|\|([\s\S]+?)\|\|END\|\|/)
    if (waterMatch) {
      try {
        const data = JSON.parse(waterMatch[1].trim())
        const res = await fetch('/api/log-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'water', ...data, date: viewingDate }),
        })
        if (res.ok) {
          setWaterOz(prev => prev + (data.amount_oz || 0))
          window.dispatchEvent(new Event('fueltrack:refresh'))
        }
      } catch (e) { console.error('WATER parse error:', e) }
    }

    // WEIGHT block
    const weightMatch = text.match(/\|\|WEIGHT\|\|([\s\S]+?)\|\|END\|\|/)
    if (weightMatch) {
      try {
        const data = JSON.parse(weightMatch[1].trim())
        const res = await fetch('/api/log-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'weight', ...data, date: viewingDate }),
        })
        if (res.ok) window.dispatchEvent(new Event('fueltrack:refresh'))
      } catch (e) { console.error('WEIGHT parse error:', e) }
    }

    // GOALS block
    const goalsMatch = text.match(/\|\|GOALS\|\|([\s\S]+?)\|\|END\|\|/)
    if (goalsMatch) {
      try {
        const data = JSON.parse(goalsMatch[1].trim())
        const res = await fetch('/api/log-food', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'goals', ...data }),
        })
        if (res.ok) {
          setGoals(prev => ({ ...prev, [data.field]: Number(data.new_value) }))
          window.dispatchEvent(new Event('fueltrack:refresh'))
        }
      } catch (e) { console.error('GOALS parse error:', e) }
    }
  }

  // Send message
  const sendMessage = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    const newMessages = [...messages, { role: 'user' as const, content: msg }]
    setMessages(newMessages)
    setLoading(true)

    // Save user message to DB
    if (user) {
      supabase.from('chat_messages').insert({ user_id: user.id, role: 'user', content: msg }).then(() => {})
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          date: viewingDate,
          page: pathname,
          todayEntries: entries,
          totals, goals, frequents, recentEntries, library, recipes, waterOz,
          pastMessages: newMessages.slice(-28),
        }),
      })
      const data = await res.json()
      const response = data.response || 'Something went wrong.'

      // Strip blocks from display
      const displayText = response
        .replace(/\|\|LOG\|\|[\s\S]+?\|\|END\|\|/g, '')
        .replace(/\|\|TALLY\|\|[\s\S]+?\|\|END\|\|/g, '')
        .replace(/\|\|RECIPE\|\|[\s\S]+?\|\|END\|\|/g, '')
        .replace(/\|\|WATER\|\|[\s\S]+?\|\|END\|\|/g, '')
        .replace(/\|\|WEIGHT\|\|[\s\S]+?\|\|END\|\|/g, '')
        .replace(/\|\|GOALS\|\|[\s\S]+?\|\|END\|\|/g, '')
        .trim()

      setMessages(prev => [...prev, { role: 'assistant', content: displayText }])

      // Save assistant message
      if (user) {
        supabase.from('chat_messages').insert({ user_id: user.id, role: 'assistant', content: displayText }).then(() => {})
      }

      // Execute blocks
      await parseAndExecuteBlocks(response)
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Connection error. Try again.' }])
    }
    setLoading(false)
  }

  // Quick-log chips (top 5 recent, no AI round-trip)
  const quickLogChips = frequents.slice(0, 5)

  // Format date
  const dateObj = new Date(viewingDate + 'T12:00:00')
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const d = dateObj.getDate()
  const suf = [11,12,13].includes(d) ? 'th' : d%10===1 ? 'st' : d%10===2 ? 'nd' : d%10===3 ? 'rd' : 'th'
  const dateStr = `${dayNames[dateObj.getDay()]}, ${monthNames[dateObj.getMonth()]} ${d}${suf}`
  const isToday = viewingDate === new Date().toISOString().split('T')[0]

  // Macro bar component
  const MacroBar = ({ label, current, goal, color }: { label: string; current: number; goal: number; color: string }) => {
    const pct = Math.min((current / goal) * 100, 100)
    const over = current > goal
    return (
      <div style={{ flex: 1, textAlign: 'center' }}>
        <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: 600, color: over ? '#f87171' : color, lineHeight: 1 }}>
          {Math.round(current)}
        </div>
        <div style={{ height: 3, background: SURFACE2, borderRadius: 2, margin: '3px 0 2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: over ? '#f87171' : color, borderRadius: 2, transition: 'width 0.3s' }} />
        </div>
        <div style={{ fontSize: 9, color: MUTED, fontFamily: "'JetBrains Mono',monospace" }}>/{goal}</div>
        <div style={{ fontSize: 8, color: MUTED, letterSpacing: '0.05em' }}>{label}</div>
      </div>
    )
  }

  if (!user) return <div style={{ minHeight: '100vh', background: DARK }} />

  const tabs = [
    { path: '/log', label: 'Log' },
    { path: '/trends', label: 'Trends' },
    { path: '/recipes', label: 'Recipes' },
    { path: '/profile', label: 'Profile' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: DARK, display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto' }}>
      {/* Macro pill row */}
      <div style={{ padding: '12px 16px 6px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <div style={{ flex: 1, display: 'flex', gap: 6 }}>
          <MacroBar label="CAL" current={totals.calories} goal={goals.calories} color={GOLD} />
          <MacroBar label="P" current={totals.protein} goal={goals.protein} color="#22c55e" />
          <MacroBar label="C" current={totals.carbs} goal={goals.carbs} color={BLUE} />
          <MacroBar label="F" current={totals.fat} goal={goals.fat} color="#f59e0b" />
        </div>
        {/* Water indicator */}
        <div style={{ textAlign: 'center', minWidth: 36 }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11, fontWeight: 600, color: '#38bdf8' }}>
            {waterOz}
          </div>
          <div style={{ fontSize: 8, color: MUTED }}>oz H2O</div>
        </div>
      </div>

      {/* Date label */}
      <div style={{ padding: '0 16px 8px', fontSize: 11, color: MUTED, fontFamily: "'JetBrains Mono',monospace" }}>
        {isToday ? 'Today' : dateStr}
      </div>

      {/* Page content */}
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: 80 }}>
        {children}
      </div>

      {/* Bottom nav with Ask AI in center */}
      <div style={{
        position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: 480, background: SURFACE,
        borderTop: `1px solid ${BORDER}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-around',
        padding: '6px 0 env(safe-area-inset-bottom, 8px)',
        zIndex: 100,
      }}>
        {tabs.slice(0, 2).map(t => (
          <a key={t.path} href={t.path} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            textDecoration: 'none', padding: '4px 12px',
            color: pathname === t.path ? GOLD : MUTED,
            fontSize: 10, fontWeight: pathname === t.path ? 600 : 400,
            letterSpacing: '0.05em',
          }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${pathname === t.path ? GOLD : MUTED}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: pathname === t.path ? GOLD : 'transparent' }} />
            </div>
            {t.label}
          </a>
        ))}

        {/* Ask AI pill - center */}
        <button
          onClick={() => { setChatOpen(true); setTimeout(() => inputRef.current?.focus(), 100) }}
          style={{
            background: GOLD, border: 'none', borderRadius: 20,
            padding: '10px 20px', color: DARK, fontSize: 13, fontWeight: 700,
            cursor: 'pointer', letterSpacing: '0.02em',
            boxShadow: '0 2px 12px rgba(212,160,23,0.3)',
            transform: 'translateY(-8px)',
          }}
        >
          Ask AI
        </button>

        {tabs.slice(2).map(t => (
          <a key={t.path} href={t.path} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            textDecoration: 'none', padding: '4px 12px',
            color: pathname === t.path ? GOLD : MUTED,
            fontSize: 10, fontWeight: pathname === t.path ? 600 : 400,
            letterSpacing: '0.05em',
          }}>
            <div style={{ width: 20, height: 20, borderRadius: '50%', border: `1.5px solid ${pathname === t.path ? GOLD : MUTED}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: pathname === t.path ? GOLD : 'transparent' }} />
            </div>
            {t.label}
          </a>
        ))}
      </div>

      {/* Chat modal */}
      {chatOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 200,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex', flexDirection: 'column',
          animation: 'fadeIn 0.15s ease',
        }} onClick={(e) => { if (e.target === e.currentTarget) setChatOpen(false) }}>
          <div style={{
            marginTop: 'auto', background: DARK,
            borderRadius: '16px 16px 0 0', border: `1px solid ${BORDER}`, borderBottom: 'none',
            width: '100%', maxWidth: 480, margin: '60px auto 0',
            flex: 1, display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            animation: 'slideUp 0.2s ease',
          }}>
            {/* Chat header with macro summary */}
            <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${BORDER}`, flexShrink: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT }}>
                  <span style={{ color: GOLD }}>FuelTrack</span> AI
                </div>
                <button onClick={() => setChatOpen(false)} style={{
                  background: 'none', border: 'none', color: MUTED, fontSize: 20, cursor: 'pointer', padding: '0 4px',
                }}>x</button>
              </div>
              {/* Compact macro bars in chat header */}
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { label: 'Cal', cur: totals.calories, goal: goals.calories, color: GOLD },
                  { label: 'P', cur: totals.protein, goal: goals.protein, color: '#22c55e' },
                  { label: 'C', cur: totals.carbs, goal: goals.carbs, color: BLUE },
                  { label: 'F', cur: totals.fat, goal: goals.fat, color: '#f59e0b' },
                ].map(m => {
                  const pct = Math.min((m.cur / m.goal) * 100, 100)
                  const left = m.goal - m.cur
                  return (
                    <div key={m.label} style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: MUTED, marginBottom: 2 }}>
                        <span>{m.label}</span>
                        <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>{left > 0 ? `${Math.round(left)} left` : `+${Math.abs(Math.round(left))} over`}</span>
                      </div>
                      <div style={{ height: 3, background: SURFACE2, borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: left < 0 ? '#f87171' : m.color, borderRadius: 2 }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 8px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {messages.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px 16px', color: MUTED }}>
                  <div style={{ fontSize: 14, marginBottom: 4 }}>What did you have?</div>
                  <div style={{ fontSize: 12 }}>I know your favorites and what you log. Ask me anything about food, macros, or recipes.</div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-end', gap: 6,
                }}>
                  {m.role === 'assistant' && (
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', background: GOLD,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, fontSize: 10, color: DARK, fontWeight: 700,
                    }}>C</div>
                  )}
                  <div style={{
                    maxWidth: '80%',
                    background: m.role === 'user' ? GOLD : SURFACE2,
                    color: m.role === 'user' ? DARK : TEXT,
                    borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '10px 14px', fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
                  }}>
                    {m.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', background: GOLD,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, color: DARK, fontWeight: 700,
                  }}>C</div>
                  <div style={{ background: SURFACE2, borderRadius: '16px 16px 16px 4px', padding: '12px 16px', display: 'flex', gap: 4 }}>
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

            {/* Quick-log chips */}
            {quickLogChips.length > 0 && messages.length < 3 && (
              <div style={{
                padding: '6px 12px', display: 'flex', gap: 6, overflowX: 'auto',
                flexShrink: 0, WebkitOverflowScrolling: 'touch',
              }}>
                {quickLogChips.map((name, i) => (
                  <button key={i} onClick={() => sendMessage(name)} style={{
                    background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 16,
                    padding: '6px 12px', color: TEXT, fontSize: 12, cursor: 'pointer',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>{name}</button>
                ))}
              </div>
            )}

            {/* Suggestion chips */}
            {messages.length === 0 && (
              <div style={{
                padding: '4px 12px 0', display: 'flex', gap: 6, overflowX: 'auto',
                flexShrink: 0, WebkitOverflowScrolling: 'touch',
              }}>
                {['How am I doing?', 'What should I eat?', 'Log water', 'Weekly summary'].map((chip, i) => (
                  <button key={i} onClick={() => sendMessage(chip)} style={{
                    background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 16,
                    padding: '6px 12px', color: GOLD, fontSize: 11, cursor: 'pointer',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}>{chip}</button>
                ))}
              </div>
            )}

            {/* Input */}
            <div style={{ padding: '8px 12px 12px', display: 'flex', gap: 8, flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom, 12px)' }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendMessage()}
                placeholder="Tell me what you ate..."
                style={{
                  flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 20,
                  padding: '10px 16px', color: TEXT, fontSize: 14, outline: 'none',
                }}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || loading}
                style={{
                  background: input.trim() ? GOLD : SURFACE2,
                  border: 'none', borderRadius: '50%',
                  width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: input.trim() ? 'pointer' : 'default',
                  color: input.trim() ? DARK : MUTED, fontSize: 16, fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {loading ? '...' : '>'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
