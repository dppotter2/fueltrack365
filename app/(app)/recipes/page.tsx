'use client'
export const dynamic = 'force-dynamic'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

const GOLD='#d4a017',DARK='#0d1117',SURFACE='#161b22',SURFACE2='#21262d'
const BORDER='#30363d',TEXT='#f0f0f0',MUTED='#8b949e'
const BLUE='#3b82f6',GREEN='#10b981',RED='#ef4444',ORANGE='#f59e0b'

// Patrick's known pantry items - these don't need to be purchased
const PANTRY_STAPLES = [
  'olive oil','avocado oil','canola oil','vegetable oil','peanut oil',
  'salt','pepper','black pepper','kosher salt','sea salt',
  'garlic','ginger','onion','shallot',
  'soy sauce','fish sauce','worcestershire','hot sauce','sriracha',
  'chicken broth','beef broth','vegetable broth',
  'flour','cornstarch','baking powder','baking soda',
  'sugar','honey','maple syrup','brown sugar',
  'rice vinegar','apple cider vinegar','red wine vinegar','white wine vinegar','balsamic',
  'tomato paste','diced tomatoes','crushed tomatoes',
  'cumin','paprika','chili powder','oregano','thyme','rosemary','bay leaves',
  'red pepper flakes','cayenne','coriander','turmeric','cinnamon',
  'dijon mustard','whole grain mustard',
  'kerrygold butter','heavy cream',
  'olive oil cooking spray',
  'lime','lemon',
  'scallion','green onion',
]

function isPantry(name: string): boolean {
  const lower = name.toLowerCase()
  return PANTRY_STAPLES.some(s => lower.includes(s) || s.includes(lower.split(' ')[0]))
}

function getMacros(recipe: any) {
  // Real DB schema uses flat columns: calories_per_serving, protein_per_serving, etc.
  // Also support macros_per_serving object (for newly saved recipes)
  const raw = recipe.macros_per_serving
  if (raw && typeof raw === 'object' && raw.calories !== undefined) {
    return {
      calories: Math.round(Number(raw.calories)||0),
      protein: Math.round(Number(raw.protein)||0),
      carbs: Math.round(Number(raw.carbs)||0),
      fat: Math.round(Number(raw.fat)||0),
      fiber: Math.round(Number(raw.fiber)||0),
      sodium: Math.round(Number(raw.sodium)||0),
    }
  }
  // Flat columns (original DB schema)
  return {
    calories: Math.round(Number(recipe.calories_per_serving)||0),
    protein: Math.round(Number(recipe.protein_per_serving)||0),
    carbs: Math.round(Number(recipe.carbs_per_serving)||0),
    fat: Math.round(Number(recipe.fat_per_serving)||0),
    fiber: Math.round(Number(recipe.fiber_per_serving)||0),
    sodium: Math.round(Number(recipe.sodium_per_serving)||0),
  }
}

// Tag styling by category
function tagStyle(tag: string) {
  const t = tag.toLowerCase()
  // Cooking method tags
  if (['smoker','grilled','smoked','bbq','barbecue'].some(k=>t.includes(k))) return {bg:'rgba(249,115,22,0.15)',text:'#f97316',group:'method'}
  if (['dutch oven','braised','braise','slow cook','instant pot'].some(k=>t.includes(k))) return {bg:'rgba(99,102,241,0.15)',text:'#818cf8',group:'method'}
  if (['roasted','roast','baked','oven'].some(k=>t.includes(k))) return {bg:'rgba(245,158,11,0.15)',text:'#f59e0b',group:'method'}
  if (['pan','seared','sear','cast iron','stir fry','stir-fry'].some(k=>t.includes(k))) return {bg:'rgba(236,72,153,0.15)',text:'#ec4899',group:'method'}
  if (['no cook','raw','cold'].some(k=>t.includes(k))) return {bg:'rgba(16,185,129,0.15)',text:'#10b981',group:'method'}
  // Cuisine tags
  if (['italian','pasta','roman','sicilian'].some(k=>t.includes(k))) return {bg:'rgba(239,68,68,0.15)',text:'#ef4444',group:'cuisine'}
  if (['mexican','tex-mex','taco'].some(k=>t.includes(k))) return {bg:'rgba(245,158,11,0.15)',text:'#f59e0b',group:'cuisine'}
  if (['asian','chinese','korean'].some(k=>t.includes(k))) return {bg:'rgba(59,130,246,0.15)',text:'#3b82f6',group:'cuisine'}
  if (['japanese'].some(k=>t.includes(k))) return {bg:'rgba(139,92,246,0.15)',text:'#8b5cf6',group:'cuisine'}
  if (['thai'].some(k=>t.includes(k))) return {bg:'rgba(6,182,212,0.15)',text:'#06b6d4',group:'cuisine'}
  if (['french'].some(k=>t.includes(k))) return {bg:'rgba(236,72,153,0.15)',text:'#ec4899',group:'cuisine'}
  if (['greek','mediterranean'].some(k=>t.includes(k))) return {bg:'rgba(20,184,166,0.15)',text:'#14b8a6',group:'cuisine'}
  if (['spanish'].some(k=>t.includes(k))) return {bg:'rgba(251,146,60,0.15)',text:'#fb923c',group:'cuisine'}
  if (['american','southern','new england','cajun'].some(k=>t.includes(k))) return {bg:'rgba(16,185,129,0.15)',text:'#10b981',group:'cuisine'}
  if (['cuban','brazilian'].some(k=>t.includes(k))) return {bg:'rgba(251,191,36,0.15)',text:'#fbbf24',group:'cuisine'}
  // Protein/meat tags
  if (['chicken','poultry'].some(k=>t.includes(k))) return {bg:'rgba(212,160,23,0.15)',text:'#d4a017',group:'protein'}
  if (['beef','steak','brisket'].some(k=>t.includes(k))) return {bg:'rgba(239,68,68,0.15)',text:'#ef4444',group:'protein'}
  if (['pork','pulled pork','ribs'].some(k=>t.includes(k))) return {bg:'rgba(251,191,36,0.15)',text:'#fbbf24',group:'protein'}
  if (['lamb'].some(k=>t.includes(k))) return {bg:'rgba(139,92,246,0.15)',text:'#8b5cf6',group:'protein'}
  if (['fish','salmon','seafood','shrimp'].some(k=>t.includes(k))) return {bg:'rgba(59,130,246,0.15)',text:'#3b82f6',group:'protein'}
  // Carb tags
  if (['pasta','noodle'].some(k=>t.includes(k))) return {bg:'rgba(239,68,68,0.12)',text:'#fca5a5',group:'carb'}
  if (['rice','grain','farro','couscous','quinoa','oat'].some(k=>t.includes(k))) return {bg:'rgba(16,185,129,0.12)',text:'#6ee7b7',group:'carb'}
  if (['potato','sweet potato'].some(k=>t.includes(k))) return {bg:'rgba(245,158,11,0.12)',text:'#fcd34d',group:'carb'}
  // Other
  if (['high-protein','high protein'].some(k=>t.includes(k))) return {bg:'rgba(16,185,129,0.15)',text:'#10b981',group:'other'}
  if (['low-carb','low carb'].some(k=>t.includes(k))) return {bg:'rgba(139,92,246,0.15)',text:'#8b5cf6',group:'other'}
  if (['meal-prep','meal prep'].some(k=>t.includes(k))) return {bg:'rgba(212,160,23,0.15)',text:'#d4a017',group:'other'}
  return {bg:'rgba(139,145,153,0.12)',text:MUTED,group:'other'}
}

// Tag group label colors
const GROUP_LABELS: Record<string,{label:string,color:string}> = {
  method: {label:'Method',color:ORANGE},
  cuisine: {label:'Cuisine',color:BLUE},
  protein: {label:'Protein',color:'#ef4444'},
  carb: {label:'Carb',color:GREEN},
  other: {label:'',color:MUTED},
}

interface CartItem { recipeId: string; recipeName: string; ingredient: string; amount: string; checked: boolean }

function RecipeCard({recipe, onLog, onDelete, cartItems, onToggleCart}: {
  recipe: any; onLog: (r:any)=>void; onDelete: (id:string)=>void
  cartItems: CartItem[]; onToggleCart: (recipeId:string, ing:string, amount:string, recipeName:string)=>void
}) {
  const [exp, setExp] = useState(false)
  const m = getMacros(recipe)
  const ings = recipe.ingredients || []

  // Split ingredients into pantry vs shopping
  const pantryIngs = ings.filter((i:any) => isPantry(i.name))
  const shopIngs = ings.filter((i:any) => !isPantry(i.name))

  const del = () => { if(window.confirm('Delete "'+recipe.name+'"?')) onDelete(recipe.id) }

  // Group tags by type
  const tagsByGroup: Record<string,string[]> = {}
  const tags = recipe.tags || []
  tags.forEach((tag:string) => {
    const s = tagStyle(tag)
    if (!tagsByGroup[s.group]) tagsByGroup[s.group] = []
    tagsByGroup[s.group].push(tag)
  })

  const inCartCount = cartItems.filter(c => c.recipeId === recipe.id).length

  return (
    <div style={{margin:'0 12px 10px',background:SURFACE,borderRadius:16,border:'1px solid '+BORDER,overflow:'hidden'}}>
      
      {/* Header */}
      <div onClick={()=>setExp(e=>!e)} style={{padding:'14px 14px 12px',cursor:'pointer'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:10}}>
          <div style={{flex:1,minWidth:0,paddingRight:8}}>
            <div style={{fontSize:16,fontWeight:700,color:TEXT,marginBottom:3,lineHeight:1.2}}>{recipe.name}</div>
            <div style={{fontSize:11,color:MUTED}}>
              {recipe.servings||6} servings
              {recipe.cooking_method ? ' · '+recipe.cooking_method : ''}
              {recipe.cuisine ? ' · '+recipe.cuisine : ''}
            </div>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:6,flexShrink:0}}>
            {inCartCount > 0 && (
              <div style={{background:'rgba(16,185,129,0.15)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:12,padding:'2px 8px',fontSize:10,color:GREEN,fontWeight:700}}>
                {inCartCount} in cart
              </div>
            )}
            <div style={{fontSize:18,color:MUTED}}>{exp?'▲':'▼'}</div>
          </div>
        </div>

        {/* Macro grid */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',background:SURFACE2,borderRadius:12,overflow:'hidden',marginBottom:tags.length>0?10:0}}>
          {[{l:'Calories',v:m.calories,u:'',c:GOLD},{l:'Protein',v:m.protein,u:'g',c:GREEN},{l:'Carbs',v:m.carbs,u:'g',c:BLUE},{l:'Fat',v:m.fat,u:'g',c:ORANGE}].map((s,i)=>(
            <div key={s.l} style={{padding:'10px 6px',textAlign:'center',borderLeft:i>0?'1px solid '+BORDER:'none'}}>
              <div style={{fontSize:17,fontWeight:800,color:s.c,lineHeight:1}}>{s.v}{s.u}</div>
              <div style={{fontSize:9,color:MUTED,textTransform:'uppercase',letterSpacing:'0.06em',marginTop:3}}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Secondary macros */}
        {(m.fiber>0||m.sodium>0) && (
          <div style={{display:'flex',gap:6,marginBottom:tags.length>0?8:0}}>
            {m.fiber>0&&<div style={{flex:1,background:SURFACE2,borderRadius:8,padding:'5px 8px',display:'flex',justifyContent:'space-between'}}><span style={{fontSize:10,color:MUTED}}>Fiber</span><span style={{fontSize:10,fontWeight:700,color:TEXT}}>{m.fiber}g</span></div>}
            {m.sodium>0&&<div style={{flex:1,background:SURFACE2,borderRadius:8,padding:'5px 8px',display:'flex',justifyContent:'space-between'}}><span style={{fontSize:10,color:MUTED}}>Sodium</span><span style={{fontSize:10,fontWeight:700,color:TEXT}}>{m.sodium}mg</span></div>}
          </div>
        )}

        {/* Tags grouped by type */}
        {tags.length>0 && (
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            {Object.entries(tagsByGroup).filter(([g])=>g!=='other'||tagsByGroup[g].length>0).map(([group,groupTags])=>(
              <div key={group} style={{display:'flex',alignItems:'center',gap:4,flexWrap:'wrap'}}>
                {GROUP_LABELS[group]?.label && (
                  <span style={{fontSize:9,color:GROUP_LABELS[group].color,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700,marginRight:2}}>{GROUP_LABELS[group].label}</span>
                )}
                {(groupTags as string[]).map((tag:string)=>{const s=tagStyle(tag);return(
                  <span key={tag} style={{fontSize:10,fontWeight:700,color:s.text,background:s.bg,padding:'3px 9px',borderRadius:20,textTransform:'uppercase',letterSpacing:'0.05em'}}>{tag}</span>
                )})}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Expanded */}
      {exp && (
        <div style={{borderTop:'1px solid '+BORDER}}>

          {/* Shopping ingredients */}
          {shopIngs.length > 0 && (
            <div style={{padding:'12px 14px'}}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
                <div style={{fontSize:10,color:RED,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700}}>Need to Purchase ({shopIngs.length})</div>
                <button onClick={(e)=>{e.stopPropagation();shopIngs.forEach((ing:any)=>onToggleCart(recipe.id,ing.name,ing.amount,recipe.name))}} style={{fontSize:10,color:GREEN,background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:12,padding:'3px 8px',cursor:'pointer',fontWeight:600}}>
                  + Add all to cart
                </button>
              </div>
              {shopIngs.map((ing:any,i:number)=>{
                const inCart = cartItems.some(c=>c.recipeId===recipe.id&&c.ingredient===ing.name)
                return (
                  <div key={i} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'6px 0',borderBottom:i<shopIngs.length-1?'1px solid '+BORDER:'none'}}>
                    <div style={{display:'flex',alignItems:'center',gap:8}}>
                      <button onClick={(e)=>{e.stopPropagation();onToggleCart(recipe.id,ing.name,ing.amount,recipe.name)}} style={{width:20,height:20,borderRadius:4,border:'1px solid '+(inCart?GREEN:BORDER),background:inCart?GREEN:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
                        {inCart&&<svg width="10" height="10" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round"/></svg>}
                      </button>
                      <span style={{fontSize:13,color:inCart?MUTED:TEXT,textDecoration:inCart?'line-through':'none'}}>{ing.name}</span>
                    </div>
                    <span style={{fontSize:13,color:MUTED}}>{ing.amount}</span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Pantry ingredients */}
          {pantryIngs.length > 0 && (
            <div style={{padding:'12px 14px',borderTop:shopIngs.length>0?'1px solid '+BORDER:'none'}}>
              <div style={{fontSize:10,color:MUTED,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700,marginBottom:8}}>From Pantry ({pantryIngs.length})</div>
              {pantryIngs.map((ing:any,i:number)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:i<pantryIngs.length-1?'1px solid '+BORDER:'none'}}>
                  <span style={{fontSize:13,color:MUTED}}>{ing.name}</span>
                  <span style={{fontSize:13,color:MUTED}}>{ing.amount}</span>
                </div>
              ))}
            </div>
          )}

          {/* Fallback if no ingredient categories */}
          {shopIngs.length===0 && pantryIngs.length===0 && ings.length>0 && (
            <div style={{padding:'12px 14px'}}>
              <div style={{fontSize:10,color:MUTED,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700,marginBottom:8}}>Ingredients — {recipe.servings||6} servings</div>
              {ings.map((ing:any,i:number)=>(
                <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:i<ings.length-1?'1px solid '+BORDER:'none'}}>
                  <span style={{fontSize:13,color:TEXT}}>{ing.name||ing}</span>
                  <span style={{fontSize:13,color:MUTED}}>{ing.amount||''}</span>
                </div>
              ))}
            </div>
          )}

          {/* Steps */}
          {recipe.steps && recipe.steps.length>0 && (
            <div style={{padding:'0 14px 12px',borderTop:'1px solid '+BORDER}}>
              <div style={{fontSize:10,color:MUTED,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700,marginBottom:8,marginTop:12}}>Steps</div>
              {recipe.steps.map((step:any,i:number)=>(
                <div key={i} style={{display:'flex',gap:10,marginBottom:8}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:GOLD,color:DARK,fontSize:11,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>{i+1}</div>
                  <span style={{fontSize:13,color:TEXT,lineHeight:1.5}}>{typeof step==='string'?step:(step.description||step.step||JSON.stringify(step))}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{padding:'10px 14px 14px',display:'flex',gap:8,borderTop:'1px solid '+BORDER}}>
            <button onClick={()=>onLog(recipe)} style={{flex:1,padding:'11px',background:GOLD,border:'none',borderRadius:12,color:DARK,fontWeight:700,fontSize:13,cursor:'pointer'}}>Log 1 Serving</button>
            <button onClick={(e)=>{e.stopPropagation();shopIngs.forEach((ing:any)=>onToggleCart(recipe.id,ing.name,ing.amount,recipe.name))}} style={{flex:1,padding:'11px',background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:12,color:GREEN,fontWeight:700,fontSize:13,cursor:'pointer'}}>Add to Cart</button>
            <button onClick={del} style={{padding:'11px 14px',background:SURFACE2,border:'1px solid '+BORDER,borderRadius:12,color:RED,fontSize:13,cursor:'pointer'}}>Delete</button>
          </div>
        </div>
      )}
    </div>
  )
}

function ShoppingCart({items, onToggle, onClear, onRemove}: {
  items: CartItem[]; onToggle: (recipeId:string,ing:string)=>void; onClear:()=>void; onRemove:(recipeId:string,ing:string)=>void
}) {
  const [open, setOpen] = useState(false)
  const unchecked = items.filter(i=>!i.checked).length
  const byRecipe: Record<string, CartItem[]> = {}
  items.forEach(item => {
    if (!byRecipe[item.recipeName]) byRecipe[item.recipeName] = []
    byRecipe[item.recipeName].push(item)
  })

  if (items.length === 0) return null

  return (
    <div style={{margin:'0 12px 12px',background:SURFACE,borderRadius:16,border:'1px solid rgba(16,185,129,0.3)',overflow:'hidden'}}>
      <div onClick={()=>setOpen(o=>!o)} style={{padding:'12px 14px',cursor:'pointer',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          <span style={{fontSize:13,fontWeight:700,color:TEXT}}>Shopping Cart</span>
          {unchecked > 0 && <span style={{background:GREEN,color:DARK,borderRadius:10,padding:'1px 7px',fontSize:11,fontWeight:800}}>{unchecked}</span>}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <button onClick={(e)=>{e.stopPropagation();onClear()}} style={{fontSize:11,color:MUTED,background:'none',border:'none',cursor:'pointer'}}>Clear all</button>
          <span style={{color:MUTED}}>{open?'▲':'▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{borderTop:'1px solid '+BORDER}}>
          {Object.entries(byRecipe).map(([recipeName, recipeItems])=>(
            <div key={recipeName} style={{padding:'10px 14px',borderBottom:'1px solid '+BORDER}}>
              <div style={{fontSize:10,color:GOLD,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:700,marginBottom:8}}>{recipeName}</div>
              {recipeItems.map((item,i)=>(
                <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'5px 0',borderBottom:i<recipeItems.length-1?'1px solid '+BORDER:'none'}}>
                  <button onClick={()=>onToggle(item.recipeId,item.ingredient)} style={{width:22,height:22,borderRadius:'50%',border:'1px solid '+(item.checked?GREEN:BORDER),background:item.checked?GREEN:'transparent',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',flexShrink:0}}>
                    {item.checked&&<svg width="10" height="10" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" fill="none" stroke={DARK} strokeWidth="2" strokeLinecap="round"/></svg>}
                  </button>
                  <span style={{flex:1,fontSize:13,color:item.checked?MUTED:TEXT,textDecoration:item.checked?'line-through':'none'}}>{item.ingredient}</span>
                  <span style={{fontSize:12,color:MUTED,marginRight:4}}>{item.amount}</span>
                  <button onClick={()=>onRemove(item.recipeId,item.ingredient)} style={{color:MUTED,background:'none',border:'none',cursor:'pointer',fontSize:14,lineHeight:1}}>×</button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RecipesPage() {
  const supabase = createClient()
  const [user,setUser] = useState<any>(null)
  const [recipes,setRecipes] = useState<any[]>([])
  const [search,setSearch] = useState('')
  const [loading,setLoading] = useState(true)
  const [msg,setMsg] = useState('')
  const [cart,setCart] = useState<CartItem[]>([])

  useEffect(()=>{ supabase.auth.getUser().then(({data:{user}})=>setUser(user)) },[])

  const load = useCallback(async()=>{
    if(!user) return
    setLoading(true)
    const {data} = await supabase.from('recipes').select('*').eq('user_id',user.id).order('name',{ascending:true})
    setRecipes(data||[])
    setLoading(false)
  },[user])
  useEffect(()=>{ load() },[load])

  const filtered = recipes.filter(r=>!search||r.name.toLowerCase().includes(search.toLowerCase())||(r.tags||[]).some((t:string)=>t.toLowerCase().includes(search.toLowerCase()))||(r.cuisine||'').toLowerCase().includes(search.toLowerCase())||(r.cooking_method||'').toLowerCase().includes(search.toLowerCase()))

  const logRecipe = async(recipe:any) => {
    if(!user) return
    const m=getMacros(recipe)
    const d=new Date()
    const date=d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')
    await fetch('/api/log-food',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:recipe.name,serving:'1 serving',...m,category:'food',date})})
    setMsg('Logged '+recipe.name)
    setTimeout(()=>setMsg(''),2500)
  }

  const deleteRecipe = async(id:string) => {
    if(!user) return
    await supabase.from('recipes').delete().eq('id',id).eq('user_id',user.id)
    load()
  }

  const toggleCart = (recipeId:string, ingredient:string, amount:string, recipeName:string) => {
    setCart(prev => {
      const exists = prev.find(c=>c.recipeId===recipeId&&c.ingredient===ingredient)
      if (exists) return prev.filter(c=>!(c.recipeId===recipeId&&c.ingredient===ingredient))
      return [...prev, {recipeId,ingredient,amount,recipeName,checked:false}]
    })
  }
  const toggleCartCheck = (recipeId:string, ingredient:string) => {
    setCart(prev => prev.map(c=>c.recipeId===recipeId&&c.ingredient===ingredient?{...c,checked:!c.checked}:c))
  }
  const removeFromCart = (recipeId:string, ingredient:string) => {
    setCart(prev => prev.filter(c=>!(c.recipeId===recipeId&&c.ingredient===ingredient)))
  }

  return (
    <div style={{minHeight:'100%',background:DARK,paddingBottom:32}}>
      <div style={{padding:'20px 16px 12px'}}>
        <h1 style={{margin:0,fontSize:24,fontWeight:800,color:TEXT}}>Recipes</h1>
        <p style={{margin:'4px 0 0',fontSize:13,color:MUTED}}>Ask Claude to create, find, or scale any recipe</p>
      </div>
      <div style={{padding:'0 12px 12px'}}>
        <input type="text" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search by name, tag, cuisine, method..." style={{width:'100%',background:SURFACE,border:'1px solid '+BORDER,borderRadius:12,padding:'12px 16px',color:TEXT,fontSize:14,outline:'none',boxSizing:'border-box' as any}}/>
      </div>
      {msg&&<div style={{margin:'0 12px 10px',background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.3)',borderRadius:12,padding:'10px 16px',fontSize:13,color:GREEN,textAlign:'center',fontWeight:600}}>{msg}</div>}
      
      <ShoppingCart items={cart} onToggle={toggleCartCheck} onClear={()=>setCart([])} onRemove={removeFromCart}/>
      
      {loading&&<div style={{textAlign:'center',padding:'48px',color:MUTED}}>Loading...</div>}
      {!loading&&filtered.length===0&&<div style={{textAlign:'center',padding:'48px 24px',color:MUTED}}>
        <div style={{fontSize:16,fontWeight:600,color:TEXT,marginBottom:6}}>{search?'No recipes matching "'+search+'"':'No recipes yet'}</div>
        <div style={{fontSize:13}}>Ask Claude to build a recipe</div>
      </div>}
      {filtered.map(r=><RecipeCard key={r.id} recipe={r} onLog={logRecipe} onDelete={deleteRecipe} cartItems={cart} onToggleCart={toggleCart}/>)}
      {!loading&&recipes.length>0&&<div style={{margin:'12px 12px 0',background:'rgba(212,160,23,0.06)',border:'1px solid rgba(212,160,23,0.2)',borderRadius:16,padding:'14px 16px',textAlign:'center'}}>
        <div style={{fontSize:13,color:MUTED}}>Try: <em style={{color:GOLD}}>"Make me a Thai chicken recipe"</em> or <em style={{color:GOLD}}>"Show me my smoker recipes"</em></div>
      </div>}
    </div>
  )
}