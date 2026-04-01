'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { DEFAULT_GOALS, MacroGoals } from '@/lib/types'

const GOLD='#d4a017',DARK='#0d1117',SURFACE='#161b22',SURFACE2='#21262d'
const BORDER='#30363d',TEXT='#f0f0f0',MUTED='#8b949e'

export default function ProfilePage() {
  const router=useRouter(), supabase=createClient()
  const [user,setUser]=useState<any>(null)
  const [goals,setGoals]=useState<MacroGoals>(DEFAULT_GOALS)
  const [editGoals,setEditGoals]=useState<MacroGoals>(DEFAULT_GOALS)
  const [editing,setEditing]=useState(false), [saving,setSaving]=useState(false), [savedMsg,setSavedMsg]=useState('')
  const [stats,setStats]=useState({totalEntries:0,totalDays:0,avgCalories:0,avgProtein:0})
  const [weightHistory,setWeightHistory]=useState<{date:string;weight:number}[]>([])

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{ if(!user){router.push('/auth');return}; setUser(user) })
  },[])

  const load=useCallback(async()=>{
    if(!user) return
    const {data:profile}=await supabase.from('profiles').select('goals').eq('user_id',user.id).single()
    if(profile?.goals){const g={...DEFAULT_GOALS,...profile.goals};setGoals(g);setEditGoals(g)}
    const {data:entries}=await supabase.from('food_entries').select('date,calories,protein').eq('user_id',user.id)
    if(entries&&entries.length>0){
      const ud=new Set(entries.map((e:any)=>e.date)).size
      setStats({totalEntries:entries.length,totalDays:ud,avgCalories:Math.round(entries.reduce((s:number,e:any)=>s+(e.calories||0),0)/ud),avgProtein:Math.round(entries.reduce((s:number,e:any)=>s+(e.protein||0),0)/ud)})
    }
    const {data:wt}=await supabase.from('weight_log').select('date,weight').eq('user_id',user.id).order('date',{ascending:false}).limit(5)
    setWeightHistory(wt||[])
  },[user])
  useEffect(()=>{load()},[load])

  const saveGoals=async()=>{
    if(!user) return; setSaving(true)
    await supabase.from('profiles').upsert({user_id:user.id,goals:editGoals,updated_at:new Date().toISOString()},{onConflict:'user_id'})
    setGoals(editGoals);setEditing(false);setSaving(false);setSavedMsg('Saved!');setTimeout(()=>setSavedMsg(''),2500)
  }
  const signOut=async()=>{await supabase.auth.signOut();router.push('/auth')}

  const GoalRow=({label,field,unit}:{label:string;field:keyof MacroGoals;unit:string})=>(
    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 0',borderBottom:'1px solid '+BORDER}}>
      <span style={{fontSize:14,color:TEXT}}>{label}</span>
      <div style={{display:'flex',alignItems:'center',gap:6}}>
        {editing
          ?<input type="number" value={editGoals[field]} onChange={e=>setEditGoals(g=>({...g,[field]:parseInt(e.target.value)||0}))} style={{width:80,background:SURFACE2,border:'1px solid '+GOLD,borderRadius:8,padding:'6px 10px',color:TEXT,fontSize:14,textAlign:'right',outline:'none'}}/>
          :<span style={{fontSize:16,fontWeight:700,color:GOLD}}>{goals[field]}</span>
        }
        <span style={{fontSize:12,color:MUTED}}>{unit}</span>
      </div>
    </div>
  )
  const SC=({label,value}:{label:string;value:string})=>(
    <div style={{flex:1,background:SURFACE2,borderRadius:12,padding:'12px 10px',textAlign:'center'}}>
      <div style={{fontSize:20,fontWeight:800,color:GOLD}}>{value}</div>
      <div style={{fontSize:10,color:MUTED,marginTop:2,textTransform:'uppercase',letterSpacing:'0.05em'}}>{label}</div>
    </div>
  )
  return (
    <div style={{minHeight:'100%',background:DARK,paddingBottom:40}}>
      <div style={{padding:'20px 16px 0'}}><h1 style={{margin:0,fontSize:24,fontWeight:800,color:TEXT}}>Profile</h1></div>
      <div style={{margin:'16px 12px',background:SURFACE,borderRadius:16,border:'1px solid '+BORDER,padding:'16px'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}>
          <div style={{width:52,height:52,borderRadius:'50%',background:GOLD,display:'flex',alignItems:'center',justifyContent:'center',fontSize:22,fontWeight:800,color:DARK}}>P</div>
          <div>
            <div style={{fontSize:17,fontWeight:700,color:TEXT}}>Patrick Potter</div>
            <div style={{fontSize:12,color:MUTED}}>{user?.email}</div>
            <div style={{fontSize:11,color:MUTED,marginTop:2}}>Hartford HealthCare · Tirzepatide 2.5mg/wk</div>
          </div>
        </div>
      </div>
      <div style={{margin:'0 12px 12px',background:SURFACE,borderRadius:16,border:'1px solid '+BORDER,padding:'14px 12px'}}>
        <div style={{fontSize:11,color:MUTED,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600,marginBottom:10}}>Progress</div>
        <div style={{display:'flex',gap:8,marginBottom:8}}><SC label="Days Tracked" value={String(stats.totalDays)}/><SC label="Entries" value={String(stats.totalEntries)}/></div>
        <div style={{display:'flex',gap:8}}><SC label="Avg Cal/Day" value={stats.avgCalories>0?String(stats.avgCalories):'—'}/><SC label="Avg Protein" value={stats.avgProtein>0?stats.avgProtein+'g':'—'}/></div>
        {weightHistory.length>0&&(
          <div style={{marginTop:12,padding:'10px 12px',background:SURFACE2,borderRadius:12}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <div><div style={{fontSize:11,color:MUTED,textTransform:'uppercase'}}>Current</div><div style={{fontSize:22,fontWeight:800,color:GOLD}}>{weightHistory[0].weight} lbs</div></div>
              <div style={{textAlign:'right'}}><div style={{fontSize:11,color:MUTED,textTransform:'uppercase'}}>Goal</div><div style={{fontSize:22,fontWeight:800,color:'#10b981'}}>230 lbs</div></div>
            </div>
            <div style={{marginTop:8}}>
              <div style={{height:6,background:BORDER,borderRadius:3}}><div style={{height:'100%',width:Math.min(100,Math.max(0,((284-weightHistory[0].weight)/(284-230))*100))+'%',background:GOLD,borderRadius:3}}/></div>
              <div style={{fontSize:10,color:MUTED,marginTop:4}}>{weightHistory[0].weight>230?(weightHistory[0].weight-230).toFixed(1)+' lbs to goal · ':'Goal reached! · '}Next: {weightHistory[0].weight>270?270:weightHistory[0].weight>255?255:weightHistory[0].weight>240?240:230} lbs</div>
            </div>
          </div>
        )}
      </div>
      <div style={{margin:'0 12px 12px',background:SURFACE,borderRadius:16,border:'1px solid '+BORDER,padding:'14px 16px'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
          <div style={{fontSize:11,color:MUTED,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>Macro Goals</div>
          {!editing
            ?<button onClick={()=>{setEditing(true);setEditGoals(goals)}} style={{background:'none',border:'none',color:GOLD,fontSize:13,fontWeight:600,cursor:'pointer'}}>Edit</button>
            :<div style={{display:'flex',gap:10}}>
              <button onClick={()=>setEditing(false)} style={{background:'none',border:'none',color:MUTED,fontSize:13,cursor:'pointer'}}>Cancel</button>
              <button onClick={saveGoals} disabled={saving} style={{background:'none',border:'none',color:GOLD,fontSize:13,fontWeight:700,cursor:'pointer'}}>{saving?'Saving...':'Save'}</button>
            </div>
          }
        </div>
        {savedMsg&&<div style={{fontSize:12,color:'#10b981',marginBottom:6,fontWeight:600}}>{savedMsg}</div>}
        <GoalRow label="Calories" field="calories" unit="cal"/>
        <GoalRow label="Protein" field="protein" unit="g"/>
        <GoalRow label="Carbs" field="carbs" unit="g"/>
        <GoalRow label="Fat" field="fat" unit="g"/>
        <GoalRow label="Fiber" field="fiber" unit="g"/>
        <GoalRow label="Sodium" field="sodium" unit="mg"/>
        {editing&&<div style={{marginTop:10,fontSize:11,color:MUTED}}>Recalculate at 270, 255, 240, 230 lbs</div>}
      </div>
      <div style={{margin:'0 12px 12px',background:SURFACE,borderRadius:16,border:'1px solid '+BORDER,padding:'14px 16px'}}>
        <div style={{fontSize:11,color:MUTED,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600,marginBottom:10}}>Program Notes</div>
        {[['Starting Weight','284 lbs'],['Goal Weight','230 lbs (-54 lbs)'],['Lean Body Mass','~155 lbs'],['Medication','Tirzepatide 2.5mg/wk'],['Protein Floor','155g (LBM anchored)'],['Calorie Floor','1,400 cal (never below)']].map(([l,v])=>(
          <div key={l} style={{display:'flex',justifyContent:'space-between',padding:'7px 0',borderBottom:'1px solid '+BORDER,fontSize:13}}>
            <span style={{color:MUTED}}>{l}</span><span style={{color:TEXT,fontWeight:600}}>{v}</span>
          </div>
        ))}
      </div>
      <div style={{margin:'0 12px'}}>
        <button onClick={signOut} style={{width:'100%',padding:'14px',background:SURFACE,border:'1px solid '+BORDER,borderRadius:14,color:'#ef4444',fontWeight:700,fontSize:15,cursor:'pointer'}}>Sign Out</button>
      </div>
    </div>
  )
}