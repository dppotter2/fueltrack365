'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { FoodEntry, MacroTotals, DEFAULT_GOALS } from '@/lib/types'

const GOLD = '#d4a017', DARK = '#0a0a0a', SURFACE = '#141414', SURFACE2 = '#1e1e1e'
const BORDER = '#2a2a2a', TEXT = '#f0f0f0', MUTED = '#888', BLUE = '#3b82f6'

function localDate(offset = 0) {
  const d = new Date(); d.setDate(d.getDate() + offset)
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
}
function fmtDate(s) {
  const [y,m,day] = s.split('-').map(Number), d = new Date(y,m-1,day)
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  if (s === localDate(0)) return 'Today'
  if (s === localDate(-1)) return 'Yesterday'
  return days[d.getDay()]+' '+months[d.getMonth()]+' '+day
}
function MacroChip({label,value,goal,color}) {
  const pct=Math.min(100,Math.round((value/goal)*100)), over=value>goal
  return (
    <div style={{flex:1,minWidth:0,textAlign:'center'}}>
      <div style={{fontSize:19,fontWeight:800,color:over?'#ef4444':TEXT,lineHeight:1}}>{value}</div>
      <div style={{fontSize:9,color:MUTED,textTransform:'uppercase',letterSpacing:'0.06em',margin:'3px 0 4px'}}>{label}</div>
      <div style={{height:3,background:SURFACE2,borderRadius:2}}>
        <div style={{height:'100%',width:pct+'%',background:over?'#ef4444':color,borderRadius:2,transition:'width 0.4s'}}/>
      </div>
      <div style={{fontSize:9,color:MUTED,marginTop:2}}>/{goal}</div>
    </div>
  )
}
function EntryRow({entry,onDelete,onDuplicate}) {
  const del = () => { if(window.confirm('Delete "'+entry.name+'"?')) onDelete(entry.id) }
  return (
    <div style={{display:'flex',alignItems:'center',padding:'11px 14px',borderBottom:'1px solid '+BORDER,gap:10}}>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:14,fontWeight:600,color:TEXT,marginBottom:2,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{entry.name}</div>
        <div style={{fontSize:11,color:MUTED}}>{entry.serving} &middot; {entry.calories} cal &middot; {entry.protein}g P &middot; {entry.carbs}g C &middot; {entry.fat}g F</div>
      </div>
      <div style={{display:'flex',gap:6,flexShrink:0,alignItems:'center'}}>
        <button onClick={()=>onDuplicate(entry)} title="Add again" style={{width:34,height:34,borderRadius:10,background:SURFACE2,border:'1px solid '+BORDER,color:GOLD,fontSize:20,fontWeight:300,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',lineHeight:1}}>+</button>
        <button onClick={del} title="Delete" style={{width:28,height:28,borderRadius:8,background:SURFACE2,border:'1px solid '+BORDER,color:MUTED,fontSize:16,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',lineHeight:1}}>&times;</button>
      </div>
    </div>
  )
}
export default function LogPage() {
  const supabase = createClient()
  const [user,setUser] = useState(null)
  const [offset,setOffset] = useState(0)
  const [entries,setEntries] = useState([])
  const [totals,setTotals] = useState({calories:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0})
  const goals = DEFAULT_GOALS
  const date = localDate(offset)

  useEffect(()=>{ supabase.auth.getUser().then(({data:{user}})=>setUser(user)) },[])

  const load = useCallback(async()=>{
    if(!user) return
    const {data} = await supabase.from('food_entries').select('*').eq('user_id',user.id).eq('date',date).order('created_at',{ascending:true})
    const rows = data||[]
    setEntries(rows)
    setTotals(rows.reduce((a,e)=>({calories:a.calories+(e.calories||0),protein:a.protein+(e.protein||0),carbs:a.carbs+(e.carbs||0),fat:a.fat+(e.fat||0),fiber:a.fiber+(e.fiber||0),sodium:a.sodium+(e.sodium||0)}),{calories:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}))
  },[user,date])

  useEffect(()=>{ load() },[load])
  useEffect(()=>{
    const h=()=>{ if(offset===0) load() }
    window.addEventListener('fueltrack:refresh',h)
    return ()=>window.removeEventListener('fueltrack:refresh',h)
  },[load,offset])

  const del = async(id)=>{ await fetch('/api/log-food',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id})}); load() }
  const dup = async(e)=>{ await fetch('/api/log-food',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:e.name,serving:e.serving,calories:e.calories,protein:e.protein,carbs:e.carbs,fat:e.fat,fiber:e.fiber,sodium:e.sodium,category:e.category,date})}); load() }

  const foods=entries.filter(e=>e.category!=='drink'), drinks=entries.filter(e=>e.category==='drink')
  const rem=goals.calories-totals.calories, isToday=offset===0

  return (
    <div style={{minHeight:'100%',background:DARK}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 16px 8px'}}>
        <button onClick={()=>setOffset(d=>d-1)} style={{background:'none',border:'none',color:MUTED,fontSize:22,padding:'4px 10px',cursor:'pointer'}}>&lsaquo;</button>
        <div style={{textAlign:'center'}}>
          <div style={{fontSize:17,fontWeight:700,color:TEXT}}>{fmtDate(date)}</div>
          <div style={{fontSize:11,color:MUTED}}>{date}</div>
        </div>
        <button onClick={()=>setOffset(d=>Math.min(0,d+1))} disabled={offset===0} style={{background:'none',border:'none',color:offset===0?SURFACE2:MUTED,fontSize:22,padding:'4px 10px',cursor:offset===0?'default':'pointer'}}>&rsaquo;</button>
      </div>

      <div style={{margin:'0 12px 12px',background:SURFACE,borderRadius:16,border:'1px solid '+BORDER,padding:'16px 12px 12px'}}>
        <div style={{display:'flex',gap:8,marginBottom:14}}>
          <MacroChip label="Cal" value={totals.calories} goal={goals.calories} color={GOLD}/>
          <div style={{width:1,background:BORDER}}/>
          <MacroChip label="Protein" value={totals.protein} goal={goals.protein} color="#10b981"/>
          <div style={{width:1,background:BORDER}}/>
          <MacroChip label="Carbs" value={totals.carbs} goal={goals.carbs} color={BLUE}/>
          <div style={{width:1,background:BORDER}}/>
          <MacroChip label="Fat" value={totals.fat} goal={goals.fat} color="#f59e0b"/>
        </div>
        <div style={{display:'flex',gap:8}}>
          <div style={{flex:1,background:SURFACE2,borderRadius:10,padding:'8px 10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:11,color:MUTED}}>Fiber</span>
            <span style={{fontSize:12,fontWeight:700,color:totals.fiber>=goals.fiber?'#10b981':TEXT}}>{totals.fiber}g <span style={{color:MUTED,fontWeight:400}}>/ {goals.fiber}g</span></span>
          </div>
          <div style={{flex:1,background:SURFACE2,borderRadius:10,padding:'8px 10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:11,color:MUTED}}>Sodium</span>
            <span style={{fontSize:12,fontWeight:700,color:totals.sodium>goals.sodium?'#ef4444':TEXT}}>{totals.sodium}mg <span style={{color:MUTED,fontWeight:400}}>/ {goals.sodium}mg</span></span>
          </div>
        </div>
        {isToday && <div style={{marginTop:10,textAlign:'center',fontSize:12,fontWeight:600,color:rem>0?GOLD:'#ef4444'}}>{rem>0?rem+' calories remaining':Math.abs(rem)+' calories over goal'}</div>}
      </div>

      {entries.length===0 && <div style={{textAlign:'center',padding:'52px 24px',color:MUTED}}>
        <div style={{fontSize:16,fontWeight:600,color:TEXT,marginBottom:6}}>{isToday?'Nothing logged yet':'No entries for this day'}</div>
        {isToday && <div style={{fontSize:13}}>Tap the gold bubble and tell Claude what you ate</div>}
      </div>}

      {foods.length>0 && <div style={{margin:'0 12px 10px',background:SURFACE,borderRadius:16,border:'1px solid '+BORDER,overflow:'hidden'}}>
        <div style={{padding:'8px 14px',borderBottom:'1px solid '+BORDER}}>
          <span style={{fontSize:10,fontWeight:700,color:GOLD,textTransform:'uppercase',letterSpacing:'0.1em'}}>Food</span>
        </div>
        {foods.map(e=><EntryRow key={e.id} entry={e} onDelete={del} onDuplicate={dup}/>)}
      </div>}

      {drinks.length>0 && <div style={{margin:'0 12px 10px',background:SURFACE,borderRadius:16,border:'1px solid '+BORDER,overflow:'hidden'}}>
        <div style={{padding:'8px 14px',borderBottom:'1px solid '+BORDER}}>
          <span style={{fontSize:10,fontWeight:700,color:BLUE,textTransform:'uppercase',letterSpacing:'0.1em'}}>Drinks</span>
        </div>
        {drinks.map(e=><EntryRow key={e.id} entry={e} onDelete={del} onDuplicate={dup}/>)}
      </div>}

      {isToday && entries.length>0 && <div style={{textAlign:'center',padding:'8px 24px 28px',color:MUTED,fontSize:12}}>Tap the gold bubble to log more or ask Claude anything</div>}
    </div>
  )
}
