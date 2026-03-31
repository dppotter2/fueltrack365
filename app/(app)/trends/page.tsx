'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { DEFAULT_GOALS } from '@/lib/types'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from 'recharts'

const GOLD = '#d4a017'
const DARK = '#0a0a0a'
const SURFACE = '#141414'
const SURFACE2 = '#1e1e1e'
const BORDER = '#2a2a2a'
const TEXT = '#f0f0f0'
const MUTED = '#888'

function localDate(offset = 0): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function shortDay(dateStr: string): string {
  const [y, m, day] = dateStr.split('-').map(Number)
  const d = new Date(y, m - 1, day)
  return ['Su','Mo','Tu','We','Th','Fr','Sa'][d.getDay()]
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: SURFACE2, border: `1px solid ${BORDER}`,
      borderRadius: 10, padding: '8px 12px', fontSize: 12,
    }}>
      <div style={{ color: TEXT, fontWeight: 700, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color, marginBottom: 1 }}>
          {p.name}: {Math.round(p.value)}{p.name === 'Calories' ? '' : 'g'}
        </div>
      ))}
    </div>
  )
}

export default function TrendsPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [weekData, setWeekData] = useState<any[]>([])
  const [weightData, setWeightData] = useState<any[]>([])
  const [weekAvg, setWeekAvg] = useState({ calories: 0, protein: 0, carbs: 0, fat: 0 })
  const [weightInput, setWeightInput] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)
  const goals = DEFAULT_GOALS

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const load = useCallback(async () => {
    if (!user) return

    // Last 7 days of food entries
    const dates = Array.from({ length: 7 }, (_, i) => localDate(i - 6))
    const startDate = dates[0]

    const { data: entries } = await supabase
      .from('food_entries')
      .select('date, calories, protein, carbs, fat')
      .eq('user_id', user.id)
      .gte('date', startDate)

    const byDate: Record<string, { calories: number; protein: number; carbs: number; fat: number; count: number }> = {}
    dates.forEach(d => { byDate[d] = { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 } })

    for (const e of (entries || [])) {
      if (byDate[e.date]) {
        byDate[e.date].calories += e.calories || 0
        byDate[e.date].protein += e.protein || 0
        byDate[e.date].carbs += e.carbs || 0
        byDate[e.date].fat += e.fat || 0
        byDate[e.date].count++
      }
    }

    const chart = dates.map(d => ({
      day: shortDay(d),
      date: d,
      Calories: Math.round(byDate[d].calories),
      Protein: Math.round(byDate[d].protein),
      Carbs: Math.round(byDate[d].carbs),
      Fat: Math.round(byDate[d].fat),
      hasData: byDate[d].count > 0,
    }))
    setWeekData(chart)

    const daysWithData = chart.filter(d => d.hasData)
    if (daysWithData.length > 0) {
      setWeekAvg({
        calories: Math.round(daysWithData.reduce((s, d) => s + d.Calories, 0) / daysWithData.length),
        protein: Math.round(daysWithData.reduce((s, d) => s + d.Protein, 0) / daysWithData.length),
        carbs: Math.round(daysWithData.reduce((s, d) => s + d.Carbs, 0) / daysWithData.length),
        fat: Math.round(daysWithData.reduce((s, d) => s + d.Fat, 0) / daysWithData.length),
      })
    }

    // Weight log (last 30 days)
    const thirtyAgo = localDate(-29)
    const { data: weights } = await supabase
      .from('weight_log')
      .select('date, weight')
      .eq('user_id', user.id)
      .gte('date', thirtyAgo)
      .order('date', { ascending: true })

    setWeightData((weights || []).map(w => ({
      date: w.date.slice(5), // MM-DD
      weight: w.weight,
    })))
  }, [user])

  useEffect(() => { load() }, [load])

  const logWeight = async () => {
    if (!weightInput || !user) return
    const w = parseFloat(weightInput)
    if (isNaN(w) || w < 50 || w > 500) return
    setSavingWeight(true)
    await supabase.from('weight_log').upsert({
      user_id: user.id,
      date: localDate(),
      weight: w,
    }, { onConflict: 'user_id,date' })
    setWeightInput('')
    setSavingWeight(false)
    load()
  }

  const StatCard = ({ label, value, goal, unit = '', color = TEXT }: any) => (
    <div style={{ flex: 1, background: SURFACE2, borderRadius: 12, padding: '12px 10px', textAlign: 'center' }}>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}{unit}</div>
      <div style={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{label}</div>
      {goal && <div style={{ fontSize: 10, color: MUTED, marginTop: 1 }}>goal: {goal}{unit}</div>}
    </div>
  )

  return (
    <div style={{ minHeight: '100%', background: DARK, paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ padding: '20px 16px 8px' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: TEXT }}>Trends</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
          7-day overview · ask Claude for deeper analysis
        </p>
      </div>

      {/* 7-Day Averages */}
      <div style={{ margin: '12px 12px', background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '14px 12px' }}>
        <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10, fontWeight: 600 }}>
          7-Day Daily Average
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <StatCard label="Calories" value={weekAvg.calories} goal={goals.calories} color={GOLD} />
          <StatCard label="Protein" value={weekAvg.protein} unit="g" goal={goals.protein} color="#10b981" />
          <StatCard label="Carbs" value={weekAvg.carbs} unit="g" goal={goals.carbs} color="#3b82f6" />
          <StatCard label="Fat" value={weekAvg.fat} unit="g" goal={goals.fat} color="#f59e0b" />
        </div>
      </div>

      {/* Calorie Bar Chart */}
      <div style={{ margin: '12px 12px', background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '14px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Calories — Last 7 Days
          </div>
          <div style={{ fontSize: 10, color: MUTED }}>goal: {goals.calories}</div>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={weekData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="Calories" fill={GOLD} radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
        {/* Goal line indicator */}
        <div style={{ fontSize: 10, color: MUTED, textAlign: 'center', marginTop: 4 }}>
          Dashed = {goals.calories} cal goal
        </div>
      </div>

      {/* Protein Bar Chart */}
      <div style={{ margin: '12px 12px', background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '14px 12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Protein — Last 7 Days
          </div>
          <div style={{ fontSize: 10, color: MUTED }}>goal: {goals.protein}g</div>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={weekData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <XAxis dataKey="day" tick={{ fill: MUTED, fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Bar dataKey="Protein" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weight Tracker */}
      <div style={{ margin: '12px 12px', background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`, padding: '14px 12px' }}>
        <div style={{ fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 12 }}>
          Weight — Last 30 Days
        </div>

        {/* Log weight input */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
          <input
            type="number"
            value={weightInput}
            onChange={e => setWeightInput(e.target.value)}
            placeholder="Today's weight (lbs)"
            style={{
              flex: 1, background: SURFACE2, border: `1px solid ${BORDER}`,
              borderRadius: 10, padding: '10px 14px', color: TEXT, fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            onClick={logWeight}
            disabled={savingWeight || !weightInput}
            style={{
              padding: '10px 16px', background: GOLD, border: 'none',
              borderRadius: 10, color: DARK, fontWeight: 700, fontSize: 14,
              cursor: weightInput ? 'pointer' : 'default',
              opacity: weightInput ? 1 : 0.5,
            }}
          >
            {savingWeight ? '...' : 'Log'}
          </button>
        </div>

        {weightData.length > 1 ? (
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={weightData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={BORDER} strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fill: MUTED, fontSize: 10 }}
                axisLine={false} tickLine={false}
                domain={['dataMin - 2', 'dataMax + 2']}
              />
              <Tooltip
                contentStyle={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 10 }}
                labelStyle={{ color: TEXT }}
                itemStyle={{ color: GOLD }}
              />
              <Line
                type="monotone" dataKey="weight" stroke={GOLD}
                strokeWidth={2} dot={{ fill: GOLD, r: 3 }} activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', color: MUTED, fontSize: 13 }}>
            {weightData.length === 1
              ? `Current: ${weightData[0].weight} lbs · Log more days to see trend`
              : 'Log your weight to track progress toward 230 lbs'}
          </div>
        )}

        {weightData.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, padding: '0 4px' }}>
            <div style={{ fontSize: 12, color: MUTED }}>
              Current: <span style={{ color: GOLD, fontWeight: 700 }}>{weightData[weightData.length - 1]?.weight} lbs</span>
            </div>
            <div style={{ fontSize: 12, color: MUTED }}>
              Goal: <span style={{ color: '#10b981', fontWeight: 700 }}>230 lbs</span>
            </div>
          </div>
        )}
      </div>

      {/* Ask Claude CTA */}
      <div style={{
        margin: '12px 12px', background: 'rgba(212,160,23,0.06)',
        border: `1px solid rgba(212,160,23,0.2)`, borderRadius: 16,
        padding: '14px 16px', textAlign: 'center',
      }}>
        <div style={{ fontSize: 14, color: TEXT, fontWeight: 600, marginBottom: 4 }}>
          Want deeper analysis?
        </div>
        <div style={{ fontSize: 13, color: MUTED }}>
          Tap the gold bubble and ask: <em style={{ color: GOLD }}>"How's my week looking?"</em> or <em style={{ color: GOLD }}>"Export my data"</em>
        </div>
      </div>
    </div>
  )
}
