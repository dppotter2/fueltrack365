'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { DEFAULT_GOALS } from '@/lib/types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts'

const GOLD='#d4a017',DARK='#0d1117',SURFACE='#161b22',SURFACE2='#21262d'
const BORDER='#30363d',TEXT='#f0f0f0',MUTED='#8b949e'

function localDate(offset=0) {
  const d=new Date(); d.setDate(d.getDate()+offset)
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
}
function shortDay(s:string) {
  const [y,m,day]=s.split('-').map(Number)
  return ['Su','Mo','Tu','We','Th','Fr','Sa'][new Date(y,m-1,day).getDay()]
}
const TT=({active,payload,label}:any)=>{
  if(!active||!payload?.length) return null
  return (
    <div style={{background:SURFACE2,border:'1px solid '+BORDER,borderRadius:10,padding:'8px 12px',fontSize:12}}>
      <div style={{color:TEXT,fontWeight:700,marginBottom:4}}>{label}</div>
      {payload.map((p:any,i:number)=><div key={i} style={{color:p.color,marginBottom:1}}>{p.name}: {Math.round(p.value)}{p.name==='Calories'?'':'g'}</div>)}
    </div>
  )
}
const StatCard=({label,value,goal,unit=''}:any)=>(
  <div style={{flex:1,background:SURFACE2,borderRadius:12,padding:'12px 10px',textAlign:'center'}}>
    <div style={{fontSize:20,fontWeight:800,color:GOLD}}>{value}{unit}</div>
    <div style={{fontSize:9,color:MUTED,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:2}}>{label}</div>
    {goal&&<div style={{fontSize:10,color:MUTED,marginTop:1}}>goal: {goal}{unit}</div>}
  </div>
)
export default function TrendsPage() {
  const supabase=createClient()
  const [user,setUser]=useState<any>(null)
  const [weekData,setWeekData]=useState<any[]>([])
  const [weightData,setWeightData]=useState<any[]>([])
  const [weekAvg,setWeekAvg]=useState({calories:0,protein:0,carbs:0,fat:0})
  const [weightInput,setWeightInput]=useState('')
  const [saving,setSaving]=useState(false)
  const goals=DEFAULT_GOALS

  useEffect(()=>{ supabase.auth.getUser().then(({data:{user}})=>setUser(user)) },[])

  const load=useCallback(async()=>{
    if(!user) return
    const dates=Array.from({length:7},(_,i)=>localDate(i-6))
    const {data:entries}=await supabase.from('food_entries').select('date,calories,protein,carbs,fat').eq('user_id',user.id).gte('date',dates[0])
    const byDate:Record<string,any>={}
    dates.forEach(d=>{byDate[d]={calories:0,protein:0,carbs:0,fat:0,count:0}})
    for(const e of (entries||[])){if(byDate[e.date]){byDate[e.date].calories+=e.calories||0;byDate[e.date].protein+=e.protein||0;byDate[e.date].carbs+=e.carbs||0;byDate[e.date].fat+=e.fat||0;byDate[e.date].count++}}
    const chart=dates.map(d=>({day:shortDay(d),Calories:Math.round(byDate[d].calories),Protein:Math.round(byDate[d].protein),Carbs:Math.round(byDate[d].carbs),Fat:Math.round(byDate[d].fat),hasData:byDate[d].count>0}))
    setWeekData(chart)
    const dwd=chart.filter(d=>d.hasData)
    if(dwd.length>0) setWeekAvg({calories:Math.round(dwd.reduce((s,d)=>s+d.Calories,0)/dwd.length),protein:Math.round(dwd.reduce((s,d)=>s+d.Protein,0)/dwd.length),carbs:Math.round(dwd.reduce((s,d)=>s+d.Carbs,0)/dwd.length),fat:Math.round(dwd.reduce((s,d)=>s+d.Fat,0)/dwd.length)})
    const d30=new Date();d30.setDate(d30.getDate()-29)
    const d30s=d30.getFullYear()+'-'+String(d30.getMonth()+1).padStart(2,'0')+'-'+String(d30.getDate()).padStart(2,'0')
    const {data:wt}=await supabase.from('weight_log').select('date,weight').eq('user_id',user.id).gte('date',d30s).order('date',{ascending:true})
    setWeightData((wt||[]).map(w=>({date:w.date.slice(5),weight:w.weight})))
  },[user])
  useEffect(()=>{load()},[load])

  const logWeight=async()=>{
    if(!weightInput||!user) return; const w=parseFloat(weightInput); if(isNaN(w)) return
    setSaving(true)
    await supabase.from('weight_log').upsert({user_id:user.id,date:localDate(),weight:w},{onConflict:'user_id,date'})
    setWeightInput('');setSaving(false);load()
  }
  return (
    <div style={{minHeight:'100%',background:DARK,paddingBottom:32}}>
      <div style={{padding:'20px 16px 8px'}}>
        <h1 style={{margin:0,fontSize:24,fontWeight:800,color:TEXT}}>Trends</h1>
        <p style={{margin:'4px 0 0',fontSize:13,color:MUTED}}>7-day overview · ask Claude for deeper analysis</p>
      </div>
      <div style={{margin:'12px',background:SURFACE,borderRadius:16,border:'1px solid '+BORDER,padding:'14px 12px'}}>
        <div style={{fontSize:11,color:MUTED,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10,fontWeight:600}}>7-Day Average</div>
        <div style={{display:'flex',gap:8}}>
          <StatCard label="Calories" value={weekAvg.calories} goal={goals.calories}/>
          <StatCard label="Protein" value={weekAvg.protein} unit="g" goal={goals.protein}/>
          <StatCard label="Carbs" value={weekAvg.carbs} unit="g" goal={goals.carbs}/>
          <StatCard label="Fat" value={weekAvg.fat} unit="g" goal={goals.fat}/>
        </div>
      </div>
      <div style={{margin:'12px',background:SURFACE,borderRadius:16,border:'1px solid '+BORDER,padding:'14px 12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
          <span style={{fontSize:11,color:MUTED,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>Calories — 7 Days</span>
          <span style={{fontSize:10,color:MUTED}}>goal: {goals.calories}</span>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={weekData} margin={{top:0,right:0,left:-20,bottom:0}}>
            <XAxis dataKey="day" tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:MUTED,fontSize:10}} axisLine={false} tickLine={false}/>
            <Tooltip content={<TT/>} cursor={{fill:'rgba(255,255,255,0.03)'}}/>
            <Bar dataKey="Calories" fill={GOLD} radius={[4,4,0,0]} maxBarSize={32}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{margin:'12px',background:SURFACE,borderRadius:16,border:'1px solid '+BORDER,padding:'14px 12px'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
          <span style={{fontSize:11,color:MUTED,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>Protein — 7 Days</span>
          <span style={{fontSize:10,color:MUTED}}>goal: {goals.protein}g</span>
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={weekData} margin={{top:0,right:0,left:-20,bottom:0}}>
            <XAxis dataKey="day" tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tick={{fill:MUTED,fontSize:10}} axisLine={false} tickLine={false}/>
            <Tooltip content={<TT/>} cursor={{fill:'rgba(255,255,255,0.03)'}}/>
            <Bar dataKey="Protein" fill="#10b981" radius={[4,4,0,0]} maxBarSize={32}/>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{margin:'12px',background:SURFACE,borderRadius:16,border:'1px solid '+BORDER,padding:'14px 12px'}}>
        <div style={{fontSize:11,color:MUTED,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600,marginBottom:12}}>Weight — 30 Days</div>
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          <input type="number" value={weightInput} onChange={e=>setWeightInput(e.target.value)} placeholder="Today's weight (lbs)" style={{flex:1,background:SURFACE2,border:'1px solid '+BORDER,borderRadius:10,padding:'10px 14px',color:TEXT,fontSize:14,outline:'none'}}/>
          <button onClick={logWeight} disabled={saving||!weightInput} style={{padding:'10px 16px',background:GOLD,border:'none',borderRadius:10,color:DARK,fontWeight:700,fontSize:14,cursor:weightInput?'pointer':'default',opacity:weightInput?1:0.5}}>{saving?'...':'Log'}</button>
        </div>
        {weightData.length>1?(
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={weightData} margin={{top:4,right:4,left:-20,bottom:0}}>
              <CartesianGrid stroke={BORDER} strokeDasharray="3 3" vertical={false}/>
              <XAxis dataKey="date" tick={{fill:MUTED,fontSize:10}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fill:MUTED,fontSize:10}} axisLine={false} tickLine={false} domain={['dataMin - 2','dataMax + 2']}/>
              <Tooltip contentStyle={{background:SURFACE2,border:'1px solid '+BORDER,borderRadius:10}} labelStyle={{color:TEXT}} itemStyle={{color:GOLD}}/>
              <Line type="monotone" dataKey="weight" stroke={GOLD} strokeWidth={2} dot={{fill:GOLD,r:3}} activeDot={{r:5}}/>
            </LineChart>
          </ResponsiveContainer>
        ):<div style={{textAlign:'center',padding:'24px 0',color:MUTED,fontSize:13}}>{weightData.length===1?'Current: '+weightData[0].weight+' lbs · Log more to see trend':'Log weight to track progress toward 230 lbs'}</div>}
        {weightData.length>0&&<div style={{display:'flex',justifyContent:'space-between',marginTop:10,padding:'0 4px'}}>
          <div style={{fontSize:12,color:MUTED}}>Current: <span style={{color:GOLD,fontWeight:700}}>{weightData[weightData.length-1]?.weight} lbs</span></div>
          <div style={{fontSize:12,color:MUTED}}>Goal: <span style={{color:'#10b981',fontWeight:700}}>230 lbs</span></div>
        </div>}
      </div>
      <div style={{margin:'12px',background:'rgba(212,160,23,0.06)',border:'1px solid rgba(212,160,23,0.2)',borderRadius:16,padding:'14px 16px',textAlign:'center'}}>
        <div style={{fontSize:13,color:MUTED}}>Ask: <em style={{color:GOLD}}>"How's my week?"</em> or <em style={{color:GOLD}}>"Export my data"</em></div>
      </div>
    </div>
  )
}