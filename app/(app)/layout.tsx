'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { DEFAULT_GOALS, MacroGoals, MacroTotals, ChatMessage, FoodEntry } from '@/lib/types'

const GOLD='#d4a017',DARK='#0d1117',SURFACE='#161b22',SURFACE2='#21262d'
const BORDER='#30363d',TEXT='#f0f0f0',MUTED='#8b949e'
const GREEN='#10b981',BLUE='#3b82f6',ORANGE='#f59e0b',RED='#ef4444',PURPLE='#8b5cf6'

function localDate() {
  const d=new Date()
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
}
function fmtDateTime(d: Date) {
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
  const months=['January','February','March','April','May','June','July','August','September','October','November','December']
  const day=d.getDate()
  const h=String(d.getHours()).padStart(2,'0'), m=String(d.getMinutes()).padStart(2,'0')
  return days[d.getDay()]+', '+months[d.getMonth()]+' '+day+'  '+h+':'+m
}

function MacroRing({label,value,goal,color,unit='g'}:{label:string;value:number;goal:number;color:string;unit?:string}) {
  const pct=Math.min(100,(value/Math.max(goal,1))*100),over=value>goal
  const size=72,r=28,circ=2*Math.PI*r,dash=(pct/100)*circ
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:4,flex:1}}>
      <div style={{position:'relative',width:size,height:size}}>
        <svg width={size} height={size} style={{transform:'rotate(-90deg)',display:'block'}}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={SURFACE2} strokeWidth={5}/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={over?RED:color} strokeWidth={5}
            strokeDasharray={dash+' '+circ} strokeLinecap="round"
            style={{transition:'stroke-dasharray 0.5s ease'}}/>
        </svg>
        <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
          <span style={{fontSize:14,fontWeight:800,color:over?RED:TEXT,lineHeight:1}}>{value}</span>
          <span style={{fontSize:9,color:MUTED,lineHeight:1.3}}>{unit}</span>
        </div>
      </div>
      <div style={{textAlign:'center',lineHeight:1.3}}>
        <div style={{fontSize:10,color:MUTED,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600}}>{label}</div>
        <div style={{fontSize:10,color:over?RED:color,fontWeight:700}}>{over?'+':'−'}{Math.abs(goal-value)}{unit}</div>
      </div>
    </div>
  )
}

function NavBar({active}:{active:string}) {
  const router=useRouter()
  const LogIcon=(a:boolean)=>(<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a?GOLD:MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>)
  const TrendsIcon=(a:boolean)=>(<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a?GOLD:MUTED} strokeWidth="2" strokeLinecap="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>)
  const RecipesIcon=(a:boolean)=>(<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a?GOLD:MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/></svg>)
  const ProfileIcon=(a:boolean)=>(<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke={a?GOLD:MUTED} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>)
  const tabs=[{id:'log',label:'Log',icon:LogIcon},{id:'trends',label:'Trends',icon:TrendsIcon},{id:'recipes',label:'Recipes',icon:RecipesIcon},{id:'profile',label:'Profile',icon:ProfileIcon}]
  return (
    <nav style={{position:'fixed',bottom:0,left:0,right:0,zIndex:100,background:SURFACE,borderTop:'1px solid '+BORDER,display:'flex',paddingBottom:'env(safe-area-inset-bottom)'}}>
      {tabs.map(tab=>{const a=active===tab.id;return(
        <button key={tab.id} onClick={()=>router.push('/'+tab.id)} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',padding:'10px 0 8px',background:'none',border:'none',color:a?GOLD:MUTED,fontSize:10,fontWeight:a?700:400,letterSpacing:'0.05em',textTransform:'uppercase',gap:3,cursor:'pointer'}}>
          {tab.icon(a)}{tab.label}
        </button>
      )})}
    </nav>
  )
}

function MsgContent({text,isUser}:{text:string;isUser:boolean}) {
  if(isUser) return <span style={{fontSize:15,lineHeight:1.5}}>{text}</span>
  const lines=text.split('\n')
  return (
    <div style={{fontSize:14,lineHeight:1.6}}>
      {lines.map((line,i)=>{
        if(!line.trim()) return <div key={i} style={{height:5}}/>
        const bullet=/^[•\-\*] /.test(line.trim())
        const raw=bullet?line.trim().replace(/^[•\-\*] /,''):line
        const parts=raw.split(/(\*\*[^*]+\*\*)/g)
        const rendered=parts.map((p,j)=>p.startsWith('**')&&p.endsWith('**')?<strong key={j} style={{color:GOLD}}>{p.slice(2,-2)}</strong>:<span key={j}>{p}</span>)
        return bullet
          ?<div key={i} style={{display:'flex',gap:7,marginBottom:2}}><span style={{color:GOLD,flexShrink:0}}>&bull;</span><span>{rendered}</span></div>
          :<div key={i}>{rendered}</div>
      })}
    </div>
  )
}

// ClaudeChat receives onLogFood as a REF so send() always calls the latest version
// This prevents stale closure bugs where old user/viewingDate state is captured
function ClaudeChat({todayEntries,recentEntries,totals,goals,date,currentPage,onLogFoodRef,onRefresh}:{
  todayEntries:FoodEntry[];recentEntries:FoodEntry[];totals:MacroTotals;goals:MacroGoals
  date:string;currentPage:string;onLogFoodRef:React.MutableRefObject<(d:any)=>Promise<any>>;onRefresh:()=>void
}) {
  const supabase=createClient()
  const [open,setOpen]=useState(false)
  const [messages,setMessages]=useState<ChatMessage[]>([])
  const [input,setInput]=useState('')
  const [loading,setLoading]=useState(false)
  const [historyLoaded,setHistoryLoaded]=useState(false)
  const bottomRef=useRef<HTMLDivElement>(null)
  const inputRef=useRef<HTMLTextAreaElement>(null)
  const onRefreshRef=useRef(onRefresh)
  useEffect(()=>{ onRefreshRef.current=onRefresh },[onRefresh])

  useEffect(()=>{
    if(!open||historyLoaded) return
    ;(async()=>{
      const {data:{user}}=await supabase.auth.getUser()
      if(!user) return
      const {data}=await supabase.from('chat_messages').select('role,content').eq('user_id',user.id).order('created_at',{ascending:true}).limit(60)
      if(data&&data.length>0) setMessages(data as ChatMessage[])
      else setMessages([{role:'assistant',content:"Hey Patrick. Talk to me:\n\n**\"4 scoops strawberry kaged\"** — logged instantly\n**\"What should I eat?\"** — meal ideas\n**\"Make me a Thai chicken recipe\"** — full recipe\n**\"How am I doing?\"** — today\'s breakdown\n\nWhat\'s up?"}])
      setHistoryLoaded(true)
    })()
  },[open])

  useEffect(()=>{ if(open) setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),80) },[messages,open])

  const resize=()=>{ if(inputRef.current){inputRef.current.style.height='auto';inputRef.current.style.height=Math.min(inputRef.current.scrollHeight,110)+'px'} }

  // send uses refs for onLogFood and onRefresh — never stale
  const send=useCallback(async(override?:string)=>{
    const msg=(override||input).trim()
    if(!msg||loading) return
    setMessages(prev=>[...prev,{role:'user',content:msg}])
    setInput('');setLoading(true)
    if(inputRef.current) inputRef.current.style.height='44px'
    try {
      const res=await fetch('/api/chat',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({message:msg,sessionHistory:messages.slice(-28),todayEntries,recentEntries,goals,totals,currentPage,date})
      })
      const json=await res.json()
      if(json.reply) setMessages(prev=>[...prev,{role:'assistant',content:json.reply}])
      // Use ref — always calls the latest handleLogFood with current state
      if(json.logData){
        await onLogFoodRef.current(json.logData)
        onRefreshRef.current()
      }
      if(json.weightData?.weight){
        const {data:{user}}=await supabase.auth.getUser()
        if(user) await supabase.from('weight_log').insert({user_id:user.id,date:localDate(),weight:json.weightData.weight})
      }
    } catch { setMessages(prev=>[...prev,{role:'assistant',content:'Something went wrong. Try again.'}]) }
    finally { setLoading(false) }
  },[input,messages,loading,todayEntries,recentEntries,goals,totals,currentPage,date])

  const remCal=goals.calories-totals.calories
  const calPct=Math.min(100,Math.round((totals.calories/goals.calories)*100))
  const calColor=calPct>100?RED:calPct>85?ORANGE:GOLD
  const quick=[
    {l:'How am I doing?',m:'How am I doing today?'},
    {l:'What should I eat?',m:'What should I eat next?'},
    {l:'My kaged',m:'My kaged strawberry'},
    {l:'My shake',m:'My protein shake'},
    {l:'This week',m:'How is my week looking?'},
  ]

  return (
    <>
      <button onClick={()=>setOpen(o=>!o)} style={{position:'fixed',bottom:76,right:14,zIndex:200,width:54,height:54,borderRadius:'50%',background:GOLD,border:'none',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 24px rgba(212,160,23,0.4)',transform:open?'scale(0.9)':'scale(1)',transition:'transform 0.2s',cursor:'pointer'}}>
        {open?<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={DARK} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>:<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>}
      </button>

      {open&&<div onClick={()=>setOpen(false)} style={{position:'fixed',inset:0,zIndex:198,background:'rgba(0,0,0,0.65)',backdropFilter:'blur(6px)',WebkitBackdropFilter:'blur(6px)'}}/>}

      <div style={{position:'fixed',left:0,right:0,bottom:0,zIndex:199,height:open?'91vh':0,background:SURFACE,borderRadius:'22px 22px 0 0',display:'flex',flexDirection:'column',overflow:'hidden',transition:'height 0.38s cubic-bezier(0.32,0.72,0,1)',boxShadow:open?'0 -12px 60px rgba(0,0,0,0.7)':'none'}}>

        <div style={{padding:'14px 16px 12px',borderBottom:'1px solid '+BORDER,flexShrink:0}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:14}}>
            <div style={{display:'flex',alignItems:'center',gap:9}}>
              <div style={{width:30,height:30,borderRadius:'50%',background:GOLD,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:900,color:DARK}}>C</div>
              <div>
                <div style={{fontSize:13,fontWeight:800,color:TEXT,lineHeight:1.1}}>Claude</div>
                <div style={{fontSize:10,color:MUTED}}>{fmtDateTime(new Date())}</div>
              </div>
            </div>
            <div style={{padding:'5px 13px',borderRadius:20,background:remCal>0?'rgba(212,160,23,0.1)':'rgba(239,68,68,0.12)',border:'1px solid '+(remCal>0?'rgba(212,160,23,0.3)':'rgba(239,68,68,0.35)')}}>
              <span style={{fontSize:17,fontWeight:900,color:remCal>0?GOLD:RED}}>{Math.abs(remCal)}</span>
              <span style={{fontSize:10,color:MUTED,marginLeft:3}}>cal {remCal>0?'left':'over'}</span>
            </div>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{fontSize:10,color:MUTED,textTransform:'uppercase',letterSpacing:'0.07em',fontWeight:600}}>Calories</span>
              <span style={{fontSize:10,color:MUTED}}>{totals.calories} / {goals.calories}</span>
            </div>
            <div style={{height:6,background:SURFACE2,borderRadius:3,overflow:'hidden'}}>
              <div style={{height:'100%',borderRadius:3,width:calPct+'%',background:calColor,transition:'width 0.4s ease'}}/>
            </div>
          </div>
          <div style={{display:'flex',justifyContent:'space-around',gap:4}}>
            <MacroRing label="Protein" value={totals.protein} goal={goals.protein} color={GREEN} unit="g"/>
            <MacroRing label="Carbs" value={totals.carbs} goal={goals.carbs} color={BLUE} unit="g"/>
            <MacroRing label="Fat" value={totals.fat} goal={goals.fat} color={ORANGE} unit="g"/>
            <MacroRing label="Fiber" value={totals.fiber} goal={goals.fiber} color={PURPLE} unit="g"/>
          </div>
        </div>

        <div style={{flex:1,overflowY:'auto',padding:'12px 12px 0',display:'flex',flexDirection:'column',gap:10,WebkitOverflowScrolling:'touch'}}>
          {messages.map((m,i)=>(
            <div key={i} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start',alignItems:'flex-end',gap:7}}>
              {m.role==='assistant'&&<div style={{width:26,height:26,borderRadius:'50%',background:GOLD,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:11,fontWeight:900,color:DARK,marginBottom:1}}>C</div>}
              <div style={{maxWidth:'82%',background:m.role==='user'?GOLD:SURFACE2,color:m.role==='user'?DARK:TEXT,borderRadius:m.role==='user'?'18px 18px 4px 18px':'18px 18px 18px 4px',padding:'10px 14px',wordBreak:'break-word'}}>
                <MsgContent text={m.content} isUser={m.role==='user'}/>
              </div>
            </div>
          ))}
          {loading&&(
            <div style={{display:'flex',alignItems:'flex-end',gap:7}}>
              <div style={{width:26,height:26,borderRadius:'50%',background:GOLD,display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:900,color:DARK}}>C</div>
              <div style={{background:SURFACE2,borderRadius:'18px 18px 18px 4px',padding:'14px 16px',display:'flex',gap:5,alignItems:'center'}}>
                {[0,1,2].map(j=><div key={j} style={{width:7,height:7,borderRadius:'50%',background:MUTED,animation:'ft-pulse 1.2s ease-in-out '+(j*0.22)+'s infinite'}}/>)}
              </div>
            </div>
          )}
          <div ref={bottomRef} style={{height:4}}/>
        </div>

        <div style={{padding:'8px 10px 4px',display:'flex',gap:6,overflowX:'auto',flexShrink:0,WebkitOverflowScrolling:'touch'}}>
          {quick.map(qa=><button key={qa.m} onClick={()=>send(qa.m)} disabled={loading} style={{flexShrink:0,padding:'6px 13px',background:SURFACE2,border:'1px solid '+BORDER,borderRadius:20,color:TEXT,fontSize:12,whiteSpace:'nowrap',cursor:'pointer',opacity:loading?0.5:1}}>{qa.l}</button>)}
        </div>

        <div style={{padding:'8px 10px',paddingBottom:'calc(10px + env(safe-area-inset-bottom))',borderTop:'1px solid '+BORDER,display:'flex',gap:8,alignItems:'flex-end',flexShrink:0,background:SURFACE}}>
          <textarea ref={inputRef} value={input} onChange={e=>{setInput(e.target.value);resize()}} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}}} placeholder="What did you eat? Ask anything..." rows={1}
            style={{flex:1,background:SURFACE2,border:'1.5px solid '+(input?GOLD:BORDER),borderRadius:22,padding:'11px 16px',color:TEXT,fontSize:15,resize:'none',outline:'none',lineHeight:1.4,height:44,maxHeight:110,fontFamily:'inherit',transition:'border-color 0.2s'}}/>
          <button onClick={()=>send()} disabled={!input.trim()||loading} style={{width:44,height:44,borderRadius:'50%',background:input.trim()&&!loading?GOLD:SURFACE2,border:'none',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',transition:'background 0.2s',cursor:input.trim()&&!loading?'pointer':'default'}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={input.trim()&&!loading?DARK:MUTED} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>

      <style>{`
        @keyframes ft-pulse{0%,60%,100%{opacity:0.25;transform:scale(0.75)}30%{opacity:1;transform:scale(1)}}
        *{-webkit-tap-highlight-color:transparent}
        ::-webkit-scrollbar{display:none}
      `}</style>
    </>
  )
}

export default function AppLayout({children}:{children:React.ReactNode}) {
  const router=useRouter()
  const pathname=usePathname()
  const supabase=createClient()

  const [user,setUser]=useState<any>(null)
  const [goals]=useState<MacroGoals>(DEFAULT_GOALS)
  const [todayEntries,setTodayEntries]=useState<FoodEntry[]>([])
  const [recentEntries,setRecentEntries]=useState<FoodEntry[]>([])
  const [totals,setTotals]=useState<MacroTotals>({calories:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0})
  const [refreshKey,setRefreshKey]=useState(0)
  const [viewingDate,setViewingDate]=useState(localDate())

  // Ref for viewingDate so callbacks always see latest value
  const viewingDateRef=useRef(viewingDate)
  useEffect(()=>{ viewingDateRef.current=viewingDate },[viewingDate])

  const activeTab=pathname.split('/')[1]||'log'

  // Reset viewingDate to today when not on log page
  useEffect(()=>{ if(pathname!=='/log') setViewingDate(localDate()) },[pathname])

  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{
      if(!user) router.push('/auth')
      else setUser(user)
    })
  },[])

  const loadEntries=useCallback(async()=>{
    if(!user) return
    const today=localDate()
    const {data:td}=await supabase.from('food_entries').select('*').eq('user_id',user.id).eq('date',today).order('created_at',{ascending:true})
    const entries=(td||[]) as FoodEntry[]
    setTodayEntries(entries)
    setTotals(entries.reduce((a,e)=>({
      calories:a.calories+(e.calories||0),protein:a.protein+(e.protein||0),
      carbs:a.carbs+(e.carbs||0),fat:a.fat+(e.fat||0),
      fiber:a.fiber+(e.fiber||0),sodium:a.sodium+(e.sodium||0),
    }),{calories:0,protein:0,carbs:0,fat:0,fiber:0,sodium:0}))
    const d7=new Date();d7.setDate(d7.getDate()-7)
    const d7s=d7.getFullYear()+'-'+String(d7.getMonth()+1).padStart(2,'0')+'-'+String(d7.getDate()).padStart(2,'0')
    const {data:rd}=await supabase.from('food_entries').select('name,calories,protein,carbs,fat,date').eq('user_id',user.id).gte('date',d7s).order('created_at',{ascending:false}).limit(150)
    setRecentEntries((rd||[]) as FoodEntry[])
  },[user])

  useEffect(()=>{loadEntries()},[user,refreshKey])

  useEffect(()=>{
    const h=()=>setRefreshKey(k=>k+1)
    window.addEventListener('fueltrack:refresh',h)
    return ()=>window.removeEventListener('fueltrack:refresh',h)
  },[])

  useEffect(()=>{
    const h=(e:any)=>{ if(e.detail?.date) setViewingDate(e.detail.date) }
    window.addEventListener('fueltrack:viewdate',h)
    return ()=>window.removeEventListener('fueltrack:viewdate',h)
  },[])

  // handleLogFood wrapped in useCallback with ALL deps listed
  // This ensures it always has the latest user, viewingDate, todayEntries
  const handleLogFood=useCallback(async(data:any)=>{
    if(!user) { console.error('handleLogFood: no user'); return null }
    // Use viewingDateRef so this always has the current date even if called from stale closure
    const logDate=data.date||viewingDateRef.current||localDate()
    const isLoggingToday=logDate===localDate()

    console.log('handleLogFood called:', data.name, 'logDate:', logDate, 'isToday:', isLoggingToday)

    // Tally: merge into existing entry only when logging to today
    if(isLoggingToday) {
      const existing=todayEntries.find(e=>
        e.name.toLowerCase()===(data.name||'').toLowerCase()&&
        e.category===(data.category||'food')
      )
      if(existing){
        const updated={
          calories:(existing.calories||0)+(data.calories||0),
          protein:(existing.protein||0)+(data.protein||0),
          carbs:(existing.carbs||0)+(data.carbs||0),
          fat:(existing.fat||0)+(data.fat||0),
          fiber:(existing.fiber||0)+(data.fiber||0),
          sodium:(existing.sodium||0)+(data.sodium||0),
        }
        const newServing=existing.serving!==data.serving?existing.serving+' + '+data.serving:existing.serving
        await supabase.from('food_entries').update({...updated,serving:newServing}).eq('id',existing.id).eq('user_id',user.id)
        console.log('handleLogFood: tallied into existing entry', existing.id)
        return existing.id
      }
    }

    // Insert new entry
    const res=await fetch('/api/log-food',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({...data,date:logDate})
    })
    const json=await res.json()
    console.log('handleLogFood: inserted new entry', JSON.stringify(json).slice(0,100))
    return json.entry?.id||null
  },[user,todayEntries])

  // Ref always points to latest handleLogFood — ClaudeChat uses this ref
  // so its stale send() closure always calls the current version
  const onLogFoodRef=useRef(handleLogFood)
  useEffect(()=>{ onLogFoodRef.current=handleLogFood },[handleLogFood])

  if(!user) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',background:DARK,color:MUTED,fontSize:14}}>Loading...</div>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',height:'100vh',background:DARK,overflow:'hidden'}}>
      <main style={{flex:1,overflowY:'auto',overflowX:'hidden',paddingBottom:60,WebkitOverflowScrolling:'touch'}}>
        {children}
      </main>
      <NavBar active={activeTab}/>
      <ClaudeChat
        todayEntries={todayEntries}
        recentEntries={recentEntries}
        totals={totals}
        goals={goals}
        date={viewingDate}
        currentPage={pathname}
        onLogFoodRef={onLogFoodRef}
        onRefresh={()=>setRefreshKey(k=>k+1)}
      />
    </div>
  )
}