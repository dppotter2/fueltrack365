'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

const GOLD='#d4a017',DARK='#0a0a0a',SURFACE='#141414',SURFACE2='#1e1e1e'
const BORDER='#2a2a2a',TEXT='#f0f0f0',MUTED='#888',BLUE='#3b82f6'

function getMacros(recipe) {
  const raw = recipe.macros_per_serving
  if (!raw) return {calories:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}
  const m = (raw.calories !== undefined) ? raw : (raw.macros_per_serving || raw)
  return {calories:Math.round(m.calories||0),protein:Math.round(m.protein||0),carbs:Math.round(m.carbs||0),fat:Math.round(m.fat||0),fiber:Math.round(m.fiber||0),sodium:Math.round(m.sodium||0)}
}

const TAG_COLORS = {
  italian:{bg:'rgba(239,68,68,0.15)',text:'#ef4444'},
  mexican:{bg:'rgba(245,158,11,0.15)',text:'#f59e0b'},
  asian:{bg:'rgba(59,130,246,0.15)',text:'#3b82f6'},
  japanese:{bg:'rgba(139,92,246,0.15)',text:'#8b5cf6'},
  thai:{bg:'rgba(6,182,212,0.15)',text:'#06b6d4'},
  french:{bg:'rgba(236,72,153,0.15)',text:'#ec4899'},
  greek:{bg:'rgba(20,184,166,0.15)',text:'#14b8a6'},
  spanish:{bg:'rgba(251,146,60,0.15)',text:'#fb923c'},
  bbq:{bg:'rgba(249,115,22,0.15)',text:'#f97316'},
  smoker:{bg:'rgba(249,115,22,0.15)',text:'#f97316'},
  american:{bg:'rgba(16,185,129,0.15)',text:'#10b981'},
  mediterranean:{bg:'rgba(99,102,241,0.15)',text:'#6366f1'},
  chicken:{bg:'rgba(212,160,23,0.15)',text:'#d4a017'},
  beef:{bg:'rgba(239,68,68,0.15)',text:'#ef4444'},
  pork:{bg:'rgba(251,191,36,0.15)',text:'#fbbf24'},
  seafood:{bg:'rgba(59,130,246,0.15)',text:'#3b82f6'},
  pasta:{bg:'rgba(239,68,68,0.12)',text:'#ef4444'},
  'high-protein':{bg:'rgba(16,185,129,0.15)',text:'#10b981'},
  'low-carb':{bg:'rgba(139,92,246,0.15)',text:'#8b5cf6'},
  'meal-prep':{bg:'rgba(212,160,23,0.15)',text:'#d4a017'},
}
function tagStyle(tag) {
  const l=tag.toLowerCase()
  for(const [k,v] of Object.entries(TAG_COLORS)) { if(l.includes(k)) return v }
  return {bg:'rgba(136,136,136,0.12)',text:MUTED}
}

function RecipeCard({recipe,onLog,onDelete}) {
  const [exp,setExp] = useState(false)
  const m = getMacros(recipe)
  const del = () => { if(window.confirm('Delete "'+recipe.name+'"?')) onDelete(recipe.id) }

  return (
    <div style={{margin:'0 12px 10px',background:SURFACE,borderRadius:16,border:'1px solid '+BORDER,overflow:'hidden'}}>
      <div onClick={()=>setExp(e=>!e)} style={{padding:'14px 14px 12px',cursor:'pointer'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
          <div style={{flex:1,minWidth:0,paddingRight:8}}>
            <div style={{fontSize:16,fontWeight:700,color:TEXT,marginBottom:3,lineHeight:1.2}}>{recipe.name}</div>
            <div style={{fontSize:11,color:MUTED}}>{recipe.servings||6} servings{recipe.cooking_method?' · '+recipe.cooking_method:''}{recipe.cuisine?' · '+recipe.cuisine:''}</div>
          </div>
          <div style={{fontSize:18,color:MUTED,flexShrink:0,marginTop:2}}>{exp?'▲':'▼'}</div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',background:SURFACE2,borderRadius:12,overflow:'hidden',marginBottom:m.fiber>0||m.sodium>0?8:0}}>
          {[{l:'Calories',v:m.calories,u:'',c:GOLD},{l:'Protein',v:m.protein,u:'g',c:'#10b981'},{l:'Carbs',v:m.carbs,u:'g',c:BLUE},{l:'Fat',v:m.fat,u:'g',c:'#f59e0b'}].map((s,i)=>(
            <div key={s.l} style={{padding:'10px 6px',textAlign:'center',borderLeft:i>0?'1px solid '+BORDER:'none'}}>
              <div style={{fontSize:17,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}{s.u}</div>
              <div style={{fontSize:9,color:MUTED,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:3}}>{s.l}</div>
            </div>
          ))}
        </div>

        {(m.fiber>0||m.sodium>0) && (
          <div style={{display:'flex',gap:6,marginBottom:recipe.tags&&recipe.tags.length>0?8:0}}>
            {m.fiber>0 && <div style={{flex:1,background:SURFACE2,borderRadius:8,padding:'5px 8px',display:'flex',justifyContent:'space-between'}}><span style={{fontSize:10,color:MUTED}}>Fiber</span><span style={{fontSize:10,fontWeight:700,color:TEXT}}>{m.fiber}g</span></div>}
            {m.sodium>0 && <div style={{flex:1,background:SURFACE2,borderRadius:8,padding:'5px 8px',display:'flex',justifyContent:'space-between'}}><span style={{fontSize:10,color:MUTED}}>Sodium</span><span style={{fontSize:10,fontWeight:700,color:TEXT}}>{m.sodium}mg</span></div>}
          </div>
        )}

        {recipe.tags&&recipe.tags.length>0 && (
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginTop:4}}>
            {recipe.tags.map(tag=>{const s=tagStyle(tag);return(<span key={tag} style={{fontSize:10,fontWeight:700,color:s.text,background:s.bg,padding:'3px 9px',borderRadius:20,textTransform:'uppercase',letterSpacing:'0.06em'}}>{tag}</span>)})}
          </div>
        )}
      </div>

      {exp && (
        <div style={{borderTop:'1px solid '+BORDER}}>
          {recipe.ingredients&&recipe.ingredients.length>0 && (
            <div style={{padding:'12px 14px'}}>
              <div style={{fontSize:10,color:MUTED,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700,marginBottom:8}}>Ingredients — serves {recipe.servings||6}</div>
              {recipe.ingredients.map((ing,i)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:i<recipe.ingredients.length-1?'1px solid '+BORDER:'none'}}>
                  <span style={{fontSize:13,color:TEXT}}>{ing.name}</span>
                  <span style={{fontSize:13,color:MUTED}}>{ing.amount}</span>
                </div>
              ))}
            </div>
          )}
          {recipe.steps&&recipe.steps.length>0 && (
            <div style={{padding:'0 14px 12px',borderTop:'1px solid '+BORDER}}>
              <div style={{fontSize:10,color:MUTED,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700,marginBottom:8,marginTop:12}}>Steps</div>
              {recipe.steps.map((step,i)=>(
                <div key={i} style={{display:'flex',gap:10,marginBottom:8}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:GOLD,color:DARK,fontSize:11,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>{i+1}</div>
                  <span style={{fontSize:13,color:TEXT,lineHeight:1.5}}>{typeof step==='string'?step:(step.description||JSON.stringify(step))}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{padding:'10px 14px 14px',display:'flex',gap:8,borderTop:'1px solid '+BORDER}}>
            <button onClick={()=>onLog(recipe)} style={{flex:1,padding:'11px',background:GOLD,border:'none',borderRadius:12,color:DARK,fontWeight:700,fontSize:14,cursor:'pointer'}}>Log 1 Serving</button>
            <button onClick={del} style={{padding:'11px 16px',background:SURFACE2,border:'1px solid '+BORDER,borderRadius:12,color:'#ef4444',fontSize:13,cursor:'pointer'}}>Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RecipesPage() {
  const supabase = createClient()
  const [user,setUser] = useState(null)
  const [recipes,setRecipes] = useState([])
  const [search,setSearch] = useState('')
  const [loading,setLoading] = useState(true)
  const [msg,setMsg] = useState('')

  useEffect(()=>{ supabase.auth.getUser().then(({data:{user}})=>setUser(user)) },[])

  const load = useCallback(async()=>{
    if(!user) return
    setLoading(true)
    const {data} = await supabase.from('recipes').select('*').eq('user_id',user.id).order('name',{ascending:true})
    setRecipes(data||[])
    setLoading(false)
  },[user])

  useEffect(()=>{ load() },[load])

  const filtered = recipes.filter(r=>!search||r.name.toLowerCase().includes(search.toLowerCase())||(r.tags||[]).some(t=>t.toLowerCase().includes(search.toLowerCase()))||(r.cuisine||'').toLowerCase().includes(search.toLowerCase()))

  const logRecipe = async(recipe) => {
    if(!user) return
    const m=getMacros(recipe)
    const d=new Date()
    const date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
    await fetch('/api/log-food',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:recipe.name,serving:'1 serving',...m,category:'food',date})})
    setMsg('Logged '+recipe.name)
    setTimeout(()=>setMsg(''),2500)
  }

  const deleteRecipe = async(id) => {
    if(!user) return
    await supabase.from('recipes').delete().eq('id',id).eq('user_id',user.id)
    load()
  }

  return (
    <div style={{minHeight:'100%',background:DARK,paddingBottom:32}}>
      <div style={{padding:'20px 16px 12px'}}>
        <h1 style={{margin:0,fontSize:24,fontWeight:800,color:TEXT}}>Recipes</h1>
        <p style={{margin:'4px 0 0',fontSize:13,color:MUTED}}>Ask Claude to create, find, or scale any recipe</p>
      </div>
      <div style={{padding:'0 12px 12px'}}>
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, tag, cuisine..." style={{width:'100%',background:SURFACE,border:'1px solid '+BORDER,borderRadius:12,padding:'12px 16px',color:TEXT,fontSize:14,outline:'none',boxSizing:'border-box'}}/>
      </div>
      {msg && <div style={{margin:'0 12px 10px',background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:12,padding:'10px 16px',fontSize:13,color:'#10b981',textAlign:'center',fontWeight:600}}>{msg}</div>}
      {loading && <div style={{textAlign:'center',padding:'48px',color:MUTED}}>Loading...</div>}
      {!loading&&filtered.length===0 && <div style={{textAlign:'center',padding:'48px 24px',color:MUTED}}>
        <div style={{fontSize:16,fontWeight:600,color:TEXT,marginBottom:6}}>{search?'No recipes matching "'+search+'"':'No recipes yet'}</div>
        <div style={{fontSize:13}}>Ask Claude to build a recipe</div>
      </div>}
      {filtered.map(r=><RecipeCard key={r.id} recipe={r} onLog={logRecipe} onDelete={deleteRecipe}/>)}
      {!loading&&recipes.length>0 && <div style={{margin:'12px 12px 0',background:'rgba(212,160,23,0.06)',border:'1px solid rgba(212,160,23,0.2)',borderRadius:16,padding:'14px 16px',textAlign:'center'}}>
        <div style={{fontSize:13,color:MUTED}}>Try: <em style={{color:GOLD}}>"Make me a Thai chicken recipe"</em> or <em style={{color:GOLD}}>"Show me my smoker recipes"</em></div>
      </div>}
    </div>
  )
}