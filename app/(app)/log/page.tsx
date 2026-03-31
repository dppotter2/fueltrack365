'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FoodEntry, MacroTotals, DEFAULT_GOALS } from '@/lib/types'

const GOLD = '#d4a017'
const DARK = '#0a0a0a'
const SURFACE = '#141414'
const SURFACE2 = '#1e1e1e'
const BORDER = '#2a2a2a'
const TEXT = '#f0f0f0'
const MUTED = '#888'
const BLUE = '#3b82f6'

function localDate(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function formatDisplayDate(dateStr: string): string {
  const [y, m, day] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1, day)
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const today = localDate()
  const yesterday = localDate(-1)
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return `${days[d.getDay()]} ${months[d.getMonth()]} ${day}`
}

function MacroChip({ label, value, goal, color }: { label: string; value: number; goal: number; color: string }) {
  const pct = Math.min(100, Math.round((value / goal) * 100))
  const over = value > goal
  return (
    <div style={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: over ? '#ef4444' : TEXT }}>{value}</div>
      <div style={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>{label}</div>
      <div style={{ height: 3, background: SURFACE2, borderRadius: 2 }}>
        <div style={{ height: '100%', width: `${pct}%`, background: over ? '#ef4444' : color, borderRadius: 2, transition: 'width 0.4s' }} />
      </div>
      <div style={{ fontSize: 9, color: MUTED, marginTop: 3 }}>/{goal}</div>
    </div>
  )
}

function EntryRow({ entry, onDelete, onDuplicate }: {
  entry: FoodEntry
  onDelete: (id: string) => void
  onDuplicate: (entry: FoodEntry) => void
}) {
  const isDrink = entry.category === 'drink'
  const dot = isDrink ? BLUE : GOLD

  return (
    <div style={{
      display: 'flex', alignItems: 'center',
      padding: '10px 12px',
      borderBottom: `1px solid ${BORDER}`,
      gap: 10,
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {entry.name}
        </div>
        <div style={{ fontSize: 11, color: MUTED }}>
          {entry.serving} · {entry.calories} cal · {entry.protein}g P · {entry.carbs}g C · {entry.fat}g F
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button
          onClick={() => onDuplicate(entry)}
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: SURFACE2, border: `1px solid ${BORDER}`,
            color: MUTED, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Duplicate"
        >+</button>
        <button
          onClick={() => onDelete(entry.id)}
          style={{
            width: 28, height: 28, borderRadius: 8,
            background: SURFACE2, border: `1px solid ${BORDER}`,
            color: '#ef4444', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Delete"
        >×</button>
      </div>
    </div>
  )
}

export default function LogPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [dateOffset, setDateOffset] = useState(0)
  const [entries, setEntries] = useState<FoodEntry[]>([])
  const [totals, setTotals] = useState<MacroTotals>({ calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 })
  const [loading, setLoading] = useState(true)
  const goals = DEFAULT_GOALS
  const date = localDate(dateOffset)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('created_at', { ascending: true })

    const rows = (data || []) as FoodEntry[]
    setEntries(rows)

    const t = rows.reduce((acc, e) => ({
      calories: acc.calories + (e.calories || 0),
      protein: acc.protein + (e.protein || 0),
      carbs: acc.carbs + (e.carbs || 0),
      fat: acc.fat + (e.fat || 0),
      fiber: acc.fiber + (e.fiber || 0),
      sodium: acc.sodium + (e.sodium || 0),
    }), { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 })
    setTotals(t)
    setLoading(false)
  }, [user, date])

  useEffect(() => { load() }, [load])

  // Listen for refresh events from chat
  useEffect(() => {
    const handler = () => { if (dateOffset === 0) load() }
    window.addEventListener('fueltrack:refresh', handler)
    return () => window.removeEventListener('fueltrack:refresh', handler)
  }, [load, dateOffset])

  const handleDelete = async (id: string) => {
    await fetch('/api/log-food', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    load()
  }

  const handleDuplicate = async (entry: FoodEntry) => {
    await fetch('/api/log-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: entry.name, serving: entry.serving,
        calories: entry.calories, protein: entry.protein,
        carbs: entry.carbs, fat: entry.fat,
        fiber: entry.fiber, sodium: entry.sodium,
        category: entry.category, date,
      }),
    })
    load()
  }

  const foods = entries.filter(e => e.category !== 'drink')
  const drinks = entries.filter(e => e.category === 'drink')

  const remaining = goals.calories - totals.calories
  const isToday = dateOffset === 0

  return (
    <div style={{ minHeight: '100%', background: DARK }}>

      {/* Date nav */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 16px 8px',
      }}>
        <button
          onClick={() => setDateOffset(d => d - 1)}
          style={{ background: 'none', border: 'none', color: MUTED, fontSize: 20, padding: '4px 8px', cursor: 'pointer' }}
        >‹</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: TEXT }}>{formatDisplayDate(date)}</div>
          <div style={{ fontSize: 11, color: MUTED }}>{date}</div>
        </div>
        <button
          onClick={() => setDateOffset(d => Math.min(0, d + 1))}
          disabled={dateOffset === 0}
          style={{ background: 'none', border: 'none', color: dateOffset === 0 ? SURFACE2 : MUTED, fontSize: 20, padding: '4px 8px', cursor: dateOffset === 0 ? 'default' : 'pointer' }}
        >›</button>
      </div>

      {/* Macro summary card */}
      <div style={{
        margin: '0 12px 12px',
        background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`,
        padding: '16px 12px 12px',
      }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <MacroChip label="Cal" value={totals.calories} goal={goals.calories} color={GOLD} />
          <div style={{ width: 1, background: BORDER }} />
          <MacroChip label="Protein" value={totals.protein} goal={goals.protein} color="#10b981" />
          <div style={{ width: 1, background: BORDER }} />
          <MacroChip label="Carbs" value={totals.carbs} goal={goals.carbs} color={BLUE} />
          <div style={{ width: 1, background: BORDER }} />
          <MacroChip label="Fat" value={totals.fat} goal={goals.fat} color="#f59e0b" />
        </div>

        {/* Fiber + Sodium */}
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{
            flex: 1, background: SURFACE2, borderRadius: 10, padding: '8px 10px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, color: MUTED }}>Fiber</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: totals.fiber >= goals.fiber ? '#10b981' : TEXT }}>
              {totals.fiber}g <span style={{ color: MUTED, fontWeight: 400 }}>/ {goals.fiber}g</span>
            </span>
          </div>
          <div style={{
            flex: 1, background: SURFACE2, borderRadius: 10, padding: '8px 10px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, color: MUTED }}>Sodium</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: totals.sodium > goals.sodium ? '#ef4444' : TEXT }}>
              {totals.sodium}mg <span style={{ color: MUTED, fontWeight: 400 }}>/ {goals.sodium}mg</span>
            </span>
          </div>
        </div>

        {/* Remaining callout */}
        {isToday && (
          <div style={{
            marginTop: 10, textAlign: 'center',
            fontSize: 12, color: remaining > 0 ? GOLD : '#ef4444',
            fontWeight: 600,
          }}>
            {remaining > 0 ? `${remaining} calories remaining today` : `${Math.abs(remaining)} calories over goal`}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!loading && entries.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: MUTED }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍽️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: TEXT, marginBottom: 6 }}>
            {isToday ? 'Nothing logged yet today' : 'No entries for this day'}
          </div>
          {isToday && (
            <div style={{ fontSize: 13, color: MUTED }}>
              Tap the gold bubble → tell Claude what you ate
            </div>
          )}
        </div>
      )}

      {/* Food section */}
      {foods.length > 0 && (
        <div style={{ margin: '0 12px 12px', background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
          <div style={{
            padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6,
            borderBottom: `1px solid ${BORDER}`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: GOLD }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Food
            </span>
          </div>
          {foods.map(e => (
            <EntryRow key={e.id} entry={e} onDelete={handleDelete} onDuplicate={handleDuplicate} />
          ))}
        </div>
      )}

      {/* Drinks section */}
      {drinks.length > 0 && (
        <div style={{ margin: '0 12px 12px', background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`, overflow: 'hidden' }}>
          <div style={{
            padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6,
            borderBottom: `1px solid ${BORDER}`,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Drinks
            </span>
          </div>
          {drinks.map(e => (
            <EntryRow key={e.id} entry={e} onDelete={handleDelete} onDuplicate={handleDuplicate} />
          ))}
        </div>
      )}

      {/* Bottom hint */}
      {isToday && entries.length > 0 && (
        <div style={{ textAlign: 'center', padding: '8px 24px 24px', color: MUTED, fontSize: 12 }}>
          Tap <span style={{ color: GOLD }}>✦</span> to log more food or ask Claude anything
        </div>
      )}
    </div>
  )
}
