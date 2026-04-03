'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
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

interface Entry { id: string; name: string; serving: string; calories: number; protein: number; carbs: number; fat: number; fiber: number; sodium: number; category: string; date: string; created_at: string }

export default function LogPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [dateStr, setDateStr] = useState(new Date().toISOString().split('T')[0])
  const [loaded, setLoaded] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const fetchEntries = useCallback(async () => {
    if (!user) return
    setLoaded(false)
    const { data } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('date', dateStr)
      .order('created_at', { ascending: true })
    setEntries(data || [])
    setLoaded(true)
  }, [user, dateStr])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  // Listen for refresh events from layout
  useEffect(() => {
    const handler = () => fetchEntries()
    window.addEventListener('fueltrack:refresh', handler)
    return () => window.removeEventListener('fueltrack:refresh', handler)
  }, [fetchEntries])

  // Broadcast date changes
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('fueltrack:viewdate', { detail: dateStr }))
  }, [dateStr])

  const prevDay = () => {
    const d = new Date(dateStr + 'T12:00:00')
    d.setDate(d.getDate() - 1)
    setDateStr(d.toISOString().split('T')[0])
  }

  const nextDay = () => {
    const d = new Date(dateStr + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    const today = new Date().toISOString().split('T')[0]
    const next = d.toISOString().split('T')[0]
    if (next <= today) setDateStr(next)
  }

  const deleteEntry = async (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id))
    setDeleteConfirm(null)
    await fetch('/api/log-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', id }),
    })
    window.dispatchEvent(new Event('fueltrack:refresh'))
  }

  // Format date for display
  const dateObj = new Date(dateStr + 'T12:00:00')
  const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
  const day = dateObj.getDate()
  const suf = [11,12,13].includes(day) ? 'th' : day%10===1 ? 'st' : day%10===2 ? 'nd' : day%10===3 ? 'rd' : 'th'
  const fullDateLabel = `${dayNames[dateObj.getDay()]}, ${monthNames[dateObj.getMonth()]} ${day}${suf}`
  const isToday = dateStr === new Date().toISOString().split('T')[0]

  const foodEntries = entries.filter(e => e.category !== 'drink')
  const drinkEntries = entries.filter(e => e.category === 'drink')

  const EntryRow = ({ entry }: { entry: Entry }) => (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '10px 0',
      borderBottom: `1px solid ${BORDER}`,
      animation: 'fadeUp 0.2s ease',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {entry.name}
        </div>
        <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>
          {entry.serving}
        </div>
      </div>
      <div style={{ textAlign: 'right', marginRight: 8, flexShrink: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: TEXT, fontFamily: "'JetBrains Mono',monospace" }}>
          {entry.calories} cal
        </div>
        <div style={{ fontSize: 10, color: MUTED, fontFamily: "'JetBrains Mono',monospace" }}>
          {entry.protein}P {entry.carbs}C {entry.fat}F
        </div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {deleteConfirm === entry.id ? (
          <>
            <button onClick={() => deleteEntry(entry.id)} style={{
              background: '#dc2626', border: 'none', borderRadius: 8,
              padding: '6px 10px', color: '#fff', fontSize: 11, fontWeight: 600, cursor: 'pointer',
            }}>Delete</button>
            <button onClick={() => setDeleteConfirm(null)} style={{
              background: SURFACE2, border: 'none', borderRadius: 8,
              padding: '6px 8px', color: MUTED, fontSize: 11, cursor: 'pointer',
            }}>Cancel</button>
          </>
        ) : (
          <button onClick={() => setDeleteConfirm(entry.id)} style={{
            background: 'none', border: 'none', color: MUTED, fontSize: 16, cursor: 'pointer',
            padding: '4px 6px', opacity: 0.5,
          }}>x</button>
        )}
      </div>
    </div>
  )

  const Section = ({ label, color, items }: { label: string; color: string; items: Entry[] }) => {
    if (items.length === 0) return null
    const sectionCals = items.reduce((s, e) => s + e.calories, 0)
    const sectionPro = items.reduce((s, e) => s + e.protein, 0)
    return (
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {label}
          </div>
          <div style={{ fontSize: 10, color: MUTED, fontFamily: "'JetBrains Mono',monospace" }}>
            {sectionCals} cal / {sectionPro}g P
          </div>
        </div>
        {items.map(e => <EntryRow key={e.id} entry={e} />)}
      </div>
    )
  }

  return (
    <div style={{ padding: '0 16px' }}>
      {/* Date nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <button onClick={prevDay} style={{
          background: SURFACE2, border: 'none', borderRadius: 8,
          padding: '8px 14px', color: GOLD, fontSize: 16, cursor: 'pointer',
        }}>{'<'}</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>{isToday ? 'Today' : fullDateLabel}</div>
          {!isToday && <div style={{ fontSize: 11, color: MUTED }}>{dateStr}</div>}
        </div>
        <button onClick={nextDay} style={{
          background: SURFACE2, border: 'none', borderRadius: 8,
          padding: '8px 14px', color: isToday ? MUTED : GOLD, fontSize: 16, cursor: isToday ? 'default' : 'pointer',
          opacity: isToday ? 0.3 : 1,
        }} disabled={isToday}>{'>'}</button>
      </div>

      {!loaded ? (
        <div style={{ textAlign: 'center', padding: 40, color: MUTED }}>Loading...</div>
      ) : entries.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 16px' }}>
          <div style={{ fontSize: 14, color: MUTED, marginBottom: 4 }}>No entries for {isToday ? 'today' : 'this date'}.</div>
          <div style={{ fontSize: 12, color: MUTED }}>Tap <span style={{ color: GOLD, fontWeight: 600 }}>Ask AI</span> below to log food.</div>
        </div>
      ) : (
        <>
          <Section label="Food" color={GOLD} items={foodEntries} />
          <Section label="Drinks" color={BLUE} items={drinkEntries} />
        </>
      )}
    </div>
  )
}
