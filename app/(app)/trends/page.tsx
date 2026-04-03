'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, ReferenceLine } from 'recharts'

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

const CHECKPOINTS = [
  { weight: 270, label: '270' },
  { weight: 255, label: '255' },
  { weight: 240, label: '240' },
  { weight: 230, label: '230 (Goal)' },
]

export default function TrendsPage() {
  const [user, setUser] = useState<any>(null)
  const [weekData, setWeekData] = useState<any[]>([])
  const [weightData, setWeightData] = useState<any[]>([])
  const [heatData, setHeatData] = useState<any[]>([])
  const [goals, setGoals] = useState({ calories: 1650, protein: 200, carbs: 140, fat: 40 })

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  useEffect(() => {
    if (!user) return
    const load = async () => {
      const today = new Date()
      const days7 = new Date(today.getTime() - 7 * 86400000).toISOString().split('T')[0]
      const days30 = new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0]
      const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

      const [entriesRes, weightRes, goalsRes] = await Promise.all([
        supabase.from('food_entries').select('date,calories,protein,carbs,fat').eq('user_id', user.id).gte('date', days7),
        supabase.from('weight_entries').select('date,weight').eq('user_id', user.id).order('date', { ascending: true }).limit(90),
        supabase.from('user_goals').select('*').eq('user_id', user.id).single(),
      ])

      if (goalsRes.data) {
        setGoals({
          calories: goalsRes.data.calories || 1650,
          protein: goalsRes.data.protein || 200,
          carbs: goalsRes.data.carbs || 140,
          fat: goalsRes.data.fat || 40,
        })
      }

      // Build 7-day chart data
      const byDate: Record<string, any> = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000)
        const ds = d.toISOString().split('T')[0]
        byDate[ds] = { date: ds, day: dayNames[d.getDay()], calories: 0, protein: 0, carbs: 0, fat: 0 }
      }
      ;(entriesRes.data || []).forEach((e: any) => {
        if (byDate[e.date]) {
          byDate[e.date].calories += e.calories || 0
          byDate[e.date].protein += e.protein || 0
          byDate[e.date].carbs += e.carbs || 0
          byDate[e.date].fat += e.fat || 0
        }
      })
      setWeekData(Object.values(byDate))

      // Weight data with forecast
      const wData: any[] = (weightRes.data || []).map((w: any) => ({ date: w.date, weight: w.weight }))
      if (wData.length >= 2) {
        const last = wData[wData.length - 1]
        const first = wData[Math.max(0, wData.length - 14)]
        const daysSpan = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000
        const rate = daysSpan > 0 ? (first.weight - last.weight) / daysSpan : 0
        if (rate > 0) {
          for (let i = 1; i <= 30; i++) {
            const d = new Date(new Date(last.date).getTime() + i * 86400000)
            wData.push({ date: d.toISOString().split('T')[0], forecast: Math.round((last.weight - rate * i) * 10) / 10 })
          }
        }
      }
      setWeightData(wData)

      // Heat map: last 30 days compliance
      const entries30 = await supabase.from('food_entries').select('date,calories,protein').eq('user_id', user.id).gte('date', days30)
      const dailyTotals: Record<string, { cal: number; pro: number }> = {}
      ;(entries30.data || []).forEach((e: any) => {
        if (!dailyTotals[e.date]) dailyTotals[e.date] = { cal: 0, pro: 0 }
        dailyTotals[e.date].cal += e.calories || 0
        dailyTotals[e.date].pro += e.protein || 0
      })
      const heat = []
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000)
        const ds = d.toISOString().split('T')[0]
        const t = dailyTotals[ds]
        let score = 0
        if (t) {
          const calPct = t.cal / (goalsRes.data?.calories || 1650)
          const proPct = t.pro / (goalsRes.data?.protein || 200)
          if (calPct >= 0.85 && calPct <= 1.1) score += 1
          if (proPct >= 0.85) score += 1
        }
        heat.push({ date: ds, day: d.getDate(), score, dow: d.getDay() })
      }
      setHeatData(heat)
    }
    load()
  }, [user])

  const heatColor = (score: number) => {
    if (score === 0) return SURFACE2
    if (score === 1) return '#d4a01744'
    return '#22c55e88'
  }

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ fontSize: 16, fontWeight: 600, color: TEXT, marginBottom: 12 }}>Trends</div>

      {/* 7-Day Macro Chart */}
      <div style={{ background: SURFACE, borderRadius: 12, padding: '12px 8px', marginBottom: 16, border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: MUTED, marginBottom: 8, paddingLeft: 8 }}>7-Day Calories</div>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={weekData}>
            <XAxis dataKey="day" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip
              contentStyle={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, color: TEXT }}
              labelStyle={{ color: GOLD }}
            />
            <Bar dataKey="calories" fill={GOLD} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Protein trend */}
      <div style={{ background: SURFACE, borderRadius: 12, padding: '12px 8px', marginBottom: 16, border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: MUTED, marginBottom: 8, paddingLeft: 8 }}>7-Day Protein (g)</div>
        <ResponsiveContainer width="100%" height={120}>
          <BarChart data={weekData}>
            <XAxis dataKey="day" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis hide />
            <Tooltip contentStyle={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, color: TEXT }} />
            <ReferenceLine y={goals.protein} stroke="#22c55e44" strokeDasharray="3 3" />
            <Bar dataKey="protein" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Weight Chart with Forecast */}
      {weightData.length > 0 && (
        <div style={{ background: SURFACE, borderRadius: 12, padding: '12px 8px', marginBottom: 16, border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 12, fontWeight: 500, color: MUTED, marginBottom: 8, paddingLeft: 8 }}>Weight Trend</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={weightData}>
              <XAxis dataKey="date" tick={{ fill: MUTED, fontSize: 9 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis domain={['auto', 'auto']} tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} width={35} />
              <Tooltip contentStyle={{ background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8, fontSize: 12, color: TEXT }} />
              <Line type="monotone" dataKey="weight" stroke={GOLD} strokeWidth={2} dot={{ r: 3, fill: GOLD }} connectNulls={false} />
              <Line type="monotone" dataKey="forecast" stroke={GOLD} strokeWidth={1.5} strokeDasharray="4 4" dot={false} connectNulls={false} />
              {CHECKPOINTS.map(cp => (
                <ReferenceLine key={cp.weight} y={cp.weight} stroke="#22c55e44" strokeDasharray="3 3" label={{ value: cp.label, fill: MUTED, fontSize: 9, position: 'right' }} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Compliance Heat Map */}
      <div style={{ background: SURFACE, borderRadius: 12, padding: '12px 12px', marginBottom: 16, border: `1px solid ${BORDER}` }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: MUTED, marginBottom: 8 }}>30-Day Compliance</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
          {heatData.map((d, i) => (
            <div key={i} title={`${d.date}: ${d.score === 0 ? 'No data' : d.score === 1 ? 'Partial' : 'On target'}`} style={{
              width: 18, height: 18, borderRadius: 3,
              background: heatColor(d.score),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 8, color: d.score > 0 ? TEXT : MUTED,
            }}>
              {d.day}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 9, color: MUTED }}>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: SURFACE2, marginRight: 3, verticalAlign: 'middle' }} />No data</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#d4a01744', marginRight: 3, verticalAlign: 'middle' }} />Partial</span>
          <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#22c55e88', marginRight: 3, verticalAlign: 'middle' }} />On target</span>
        </div>
      </div>
    </div>
  )
}
