'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
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

interface Change { id: string; field: string; old_value: string; new_value: string; reason: string; created_at: string }

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [goals, setGoals] = useState({ calories: 1650, protein: 200, carbs: 140, fat: 40, fiber: 33, sodium: 2000 })
  const [editing, setEditing] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editReason, setEditReason] = useState('')
  const [changes, setChanges] = useState<Change[]>([])
  const [weightInput, setWeightInput] = useState('')
  const [weightNotes, setWeightNotes] = useState('')
  const [latestWeight, setLatestWeight] = useState<number | null>(null)
  const [showChanges, setShowChanges] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const [goalsRes, changesRes, weightRes] = await Promise.all([
        supabase.from('user_goals').select('*').eq('user_id', user.id).single(),
        supabase.from('profile_changes').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('weight_entries').select('weight,date').eq('user_id', user.id).order('date', { ascending: false }).limit(1).single(),
      ])
      if (goalsRes.data) {
        setGoals({
          calories: goalsRes.data.calories || 1650,
          protein: goalsRes.data.protein || 200,
          carbs: goalsRes.data.carbs || 140,
          fat: goalsRes.data.fat || 40,
          fiber: goalsRes.data.fiber || 33,
          sodium: goalsRes.data.sodium || 2000,
        })
      }
      setChanges(changesRes.data || [])
      if (weightRes.data) setLatestWeight(weightRes.data.weight)
    }
    load()
  }, [user])

  const saveGoal = async (field: string) => {
    const newVal = Number(editValue)
    if (isNaN(newVal) || newVal <= 0) return
    const oldVal = goals[field as keyof typeof goals]
    await fetch('/api/log-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'goals', field, old_value: oldVal, new_value: newVal, reason: editReason }),
    })
    setGoals(prev => ({ ...prev, [field]: newVal }))
    setChanges(prev => [{
      id: 'new', field, old_value: String(oldVal), new_value: String(newVal),
      reason: editReason, created_at: new Date().toISOString()
    }, ...prev])
    setEditing(null)
    setEditValue('')
    setEditReason('')
    window.dispatchEvent(new Event('fueltrack:refresh'))
  }

  const logWeight = async () => {
    const w = parseFloat(weightInput)
    if (isNaN(w) || w <= 0) return
    await fetch('/api/log-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'weight', weight: w, notes: weightNotes }),
    })
    setLatestWeight(w)
    setWeightInput('')
    setWeightNotes('')
    setChanges(prev => [{
      id: 'wt', field: 'weight', old_value: latestWeight ? String(latestWeight) : '-',
      new_value: String(w), reason: weightNotes, created_at: new Date().toISOString()
    }, ...prev])
    window.dispatchEvent(new Event('fueltrack:refresh'))
  }

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${months[d.getMonth()]} ${d.getDate()}, ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const GoalRow = ({ field, label, unit }: { field: string; label: string; unit: string }) => {
    const val = goals[field as keyof typeof goals]
    const isEditing = editing === field
    return (
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: TEXT }}>{label}</div>
        </div>
        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={editValue} onChange={e => setEditValue(e.target.value)}
                placeholder={String(val)} autoFocus
                style={{ width: 70, background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 8px', color: TEXT, fontSize: 13, outline: 'none', textAlign: 'right' }}
              />
              <span style={{ fontSize: 12, color: MUTED, alignSelf: 'center' }}>{unit}</span>
            </div>
            <input
              value={editReason} onChange={e => setEditReason(e.target.value)}
              placeholder="Reason (optional)"
              style={{ width: 180, background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '6px 8px', color: TEXT, fontSize: 11, outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => saveGoal(field)} style={{
                background: GOLD, border: 'none', borderRadius: 6, padding: '4px 12px',
                color: DARK, fontSize: 11, fontWeight: 600, cursor: 'pointer',
              }}>Save</button>
              <button onClick={() => { setEditing(null); setEditValue(''); setEditReason('') }} style={{
                background: SURFACE2, border: 'none', borderRadius: 6, padding: '4px 10px',
                color: MUTED, fontSize: 11, cursor: 'pointer',
              }}>Cancel</button>
            </div>
          </div>
        ) : (
          <button onClick={() => { setEditing(field); setEditValue(String(val)) }} style={{
            background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: GOLD, fontFamily: "'JetBrains Mono',monospace" }}>{val}</span>
            <span style={{ fontSize: 12, color: MUTED }}>{unit}</span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: TEXT, marginBottom: 12 }}>Profile</div>

      {/* Weight entry */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: 8 }}>
          Current Weight: <span style={{ color: GOLD, fontFamily: "'JetBrains Mono',monospace" }}>{latestWeight || '--'} lbs</span>
          <span style={{ fontSize: 11, color: MUTED, marginLeft: 8 }}>Goal: 230 lbs</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={weightInput} onChange={e => setWeightInput(e.target.value)}
            placeholder="Weight (lbs)" type="number"
            style={{ width: 100, background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', color: TEXT, fontSize: 13, outline: 'none' }}
          />
          <input
            value={weightNotes} onChange={e => setWeightNotes(e.target.value)}
            placeholder="Notes (optional)"
            style={{ flex: 1, background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 10px', color: TEXT, fontSize: 13, outline: 'none' }}
          />
          <button onClick={logWeight} disabled={!weightInput} style={{
            background: weightInput ? GOLD : SURFACE2, border: 'none', borderRadius: 8,
            padding: '8px 14px', color: weightInput ? DARK : MUTED, fontSize: 13, fontWeight: 600,
            cursor: weightInput ? 'pointer' : 'default',
          }}>Log</button>
        </div>
      </div>

      {/* Daily macro goals */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: 4 }}>Daily Macro Goals</div>
        <div style={{ fontSize: 11, color: MUTED, marginBottom: 8 }}>Tap a value to edit. Changes are logged.</div>
        <GoalRow field="calories" label="Calories" unit="cal" />
        <GoalRow field="protein" label="Protein" unit="g" />
        <GoalRow field="carbs" label="Carbs" unit="g" />
        <GoalRow field="fat" label="Fat" unit="g" />
        <GoalRow field="fiber" label="Fiber" unit="g" />
        <GoalRow field="sodium" label="Sodium" unit="mg" />
      </div>

      {/* Change log */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
        <button onClick={() => setShowChanges(!showChanges)} style={{
          background: 'none', border: 'none', color: TEXT, fontSize: 13, fontWeight: 500,
          cursor: 'pointer', width: '100%', textAlign: 'left', display: 'flex', justifyContent: 'space-between',
        }}>
          <span>Change Log ({changes.length})</span>
          <span style={{ color: MUTED }}>{showChanges ? 'Hide' : 'Show'}</span>
        </button>

        {showChanges && changes.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {changes.slice(0, 20).map((c, i) => (
              <div key={i} style={{ padding: '6px 0', borderBottom: `1px solid ${BORDER}`, fontSize: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: TEXT, fontWeight: 500 }}>{c.field}</span>
                  <span style={{ color: MUTED, fontSize: 10 }}>{formatDate(c.created_at)}</span>
                </div>
                <div style={{ color: MUTED }}>
                  {c.old_value} {'>'} <span style={{ color: GOLD }}>{c.new_value}</span>
                  {c.reason && <span style={{ fontStyle: 'italic', marginLeft: 6 }}>({c.reason})</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Program info */}
      <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: '12px 14px', marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: TEXT, marginBottom: 4 }}>Program</div>
        <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>
          Hartford HealthCare Medical & Surgical Weight Loss
        </div>
      </div>

      {/* Sign out */}
      <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/auth' }} style={{
        background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 10,
        padding: '12px 16px', color: MUTED, fontSize: 13, cursor: 'pointer', width: '100%',
        marginBottom: 20,
      }}>Sign Out</button>
    </div>
  )
}
