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

interface Recipe {
  id: string; name: string; servings: number;
  calories_per_serving: number; protein_per_serving: number; carbs_per_serving: number;
  fat_per_serving: number; fiber_per_serving: number; sodium_per_serving: number;
  ingredients: string; instructions: string;
  cooking_method: string; cuisine: string; protein_type: string; carb_type: string; tags: string;
}

const TAG_COLORS: Record<string, string> = {
  grill: '#f59e0b', smoke: '#a78bfa', oven: '#f87171', stovetop: '#38bdf8', 'no-cook': '#34d399',
  italian: '#22c55e', mexican: '#ef4444', french: '#818cf8', greek: '#06b6d4', japanese: '#f472b6',
  thai: '#fb923c', cuban: '#a3e635', cajun: '#e879f9', american: '#60a5fa', spanish: '#fbbf24',
  lebanese: '#2dd4bf', brazilian: '#c084fc', caribbean: '#4ade80',
  chicken: '#fbbf24', beef: '#ef4444', pork: '#f472b6', lamb: '#c084fc', fish: '#38bdf8',
  shrimp: '#fb923c', turkey: '#a3e635', veal: '#e879f9',
  rice: '#d4a017', pasta: '#818cf8', potato: '#f59e0b', farro: '#a78bfa', quinoa: '#34d399',
  bread: '#fbbf24', couscous: '#06b6d4',
}

export default function RecipesPage() {
  const [user, setUser] = useState<any>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [cookMode, setCookMode] = useState<{ recipe: Recipe; step: number } | null>(null)
  const [cart, setCart] = useState<Record<string, string[]>>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [scaleServings, setScaleServings] = useState<Record<string, number>>({})

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
  }, [])

  const fetchRecipes = async () => {
    if (!user) return
    const { data } = await supabase.from('recipes').select('*').eq('user_id', user.id).order('name')
    setRecipes(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchRecipes() }, [user])

  useEffect(() => {
    const handler = () => fetchRecipes()
    window.addEventListener('fueltrack:refresh', handler)
    return () => window.removeEventListener('fueltrack:refresh', handler)
  }, [user])

  const deleteRecipe = async (id: string) => {
    setRecipes(prev => prev.filter(r => r.id !== id))
    await supabase.from('recipes').delete().eq('id', id)
  }

  const logRecipe = async (recipe: Recipe) => {
    const servings = scaleServings[recipe.id] || 1
    await fetch('/api/log-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'log',
        name: recipe.name,
        serving: `${servings} serving${servings > 1 ? 's' : ''}`,
        calories: Math.round(recipe.calories_per_serving * servings),
        protein: Math.round(recipe.protein_per_serving * servings),
        carbs: Math.round(recipe.carbs_per_serving * servings),
        fat: Math.round(recipe.fat_per_serving * servings),
        fiber: Math.round((recipe.fiber_per_serving || 0) * servings),
        sodium: Math.round((recipe.sodium_per_serving || 0) * servings),
        category: 'meal',
      }),
    })
    window.dispatchEvent(new Event('fueltrack:refresh'))
  }

  const toggleCart = (recipeName: string, ingredient: string) => {
    setCart(prev => {
      const items = prev[recipeName] || []
      if (items.includes(ingredient)) {
        const next = items.filter(i => i !== ingredient)
        if (next.length === 0) { const { [recipeName]: _, ...rest } = prev; return rest }
        return { ...prev, [recipeName]: next }
      }
      return { ...prev, [recipeName]: [...items, ingredient] }
    })
  }

  const addAllToCart = (recipe: Recipe) => {
    const ings = (recipe.ingredients || '').split('\n').filter(Boolean)
    setCart(prev => ({ ...prev, [recipe.name]: ings }))
  }

  const cartTotal = Object.values(cart).reduce((s, a) => s + a.length, 0)

  const filtered = recipes.filter(r => {
    const q = search.toLowerCase()
    if (!q) return true
    return r.name.toLowerCase().includes(q) ||
      (r.tags || '').toLowerCase().includes(q) ||
      (r.cooking_method || '').toLowerCase().includes(q) ||
      (r.cuisine || '').toLowerCase().includes(q) ||
      (r.protein_type || '').toLowerCase().includes(q)
  })

  const getTags = (r: Recipe) => {
    const tags: string[] = []
    if (r.cooking_method) tags.push(r.cooking_method.toLowerCase())
    if (r.cuisine) tags.push(r.cuisine.toLowerCase())
    if (r.protein_type) tags.push(r.protein_type.toLowerCase())
    if (r.carb_type) tags.push(r.carb_type.toLowerCase())
    return tags.filter(Boolean)
  }

  // Cook mode
  if (cookMode) {
    const { recipe, step } = cookMode
    const steps = (recipe.instructions || '').split('\n').filter(Boolean)
    const currentStep = steps[step] || 'Done!'
    const isLast = step >= steps.length - 1

    return (
      <div style={{ padding: 16, minHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button onClick={() => setCookMode(null)} style={{
            background: SURFACE2, border: 'none', borderRadius: 8, padding: '8px 14px',
            color: MUTED, fontSize: 13, cursor: 'pointer',
          }}>Exit Cook Mode</button>
          <div style={{ fontSize: 12, color: MUTED }}>{step + 1} / {steps.length}</div>
        </div>

        <div style={{ fontSize: 18, fontWeight: 600, color: GOLD, marginBottom: 8 }}>{recipe.name}</div>

        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 20, lineHeight: 1.6, color: TEXT, textAlign: 'center', maxWidth: 400 }}>
            {currentStep}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ height: 4, background: SURFACE2, borderRadius: 2, marginBottom: 16, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${((step + 1) / steps.length) * 100}%`, background: GOLD, borderRadius: 2, transition: 'width 0.3s' }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          {step > 0 && (
            <button onClick={() => setCookMode({ recipe, step: step - 1 })} style={{
              background: SURFACE2, border: 'none', borderRadius: 10, padding: '14px 20px',
              color: TEXT, fontSize: 15, cursor: 'pointer', flex: 1,
            }}>Previous</button>
          )}
          {!isLast ? (
            <button onClick={() => setCookMode({ recipe, step: step + 1 })} style={{
              background: GOLD, border: 'none', borderRadius: 10, padding: '14px 20px',
              color: DARK, fontSize: 15, fontWeight: 600, cursor: 'pointer', flex: 2,
            }}>Next Step</button>
          ) : (
            <button onClick={() => { logRecipe(recipe); setCookMode(null) }} style={{
              background: '#22c55e', border: 'none', borderRadius: 10, padding: '14px 20px',
              color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', flex: 2,
            }}>Log 1 Serving</button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: TEXT }}>Recipes</div>
        {cartTotal > 0 && (
          <button onClick={() => setCartOpen(!cartOpen)} style={{
            background: GOLD, border: 'none', borderRadius: 16, padding: '6px 14px',
            color: DARK, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>Cart ({cartTotal})</button>
        )}
      </div>

      {/* Search */}
      <input
        value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by name, cuisine, method, protein..."
        style={{
          width: '100%', background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 10,
          padding: '10px 14px', color: TEXT, fontSize: 14, outline: 'none', marginBottom: 12,
        }}
      />

      {/* Shopping cart dropdown */}
      {cartOpen && cartTotal > 0 && (
        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: GOLD, marginBottom: 8 }}>Shopping List</div>
          {Object.entries(cart).map(([recipeName, items]) => (
            <div key={recipeName} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: MUTED, fontWeight: 500, marginBottom: 4 }}>{recipeName}</div>
              {items.map((item, i) => (
                <div key={i} onClick={() => toggleCart(recipeName, item)} style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', cursor: 'pointer',
                }}>
                  <div style={{
                    width: 16, height: 16, borderRadius: '50%', border: `1.5px solid ${BORDER}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }} />
                  <div style={{ fontSize: 13, color: TEXT }}>{item}</div>
                </div>
              ))}
            </div>
          ))}
          <button onClick={() => { setCart({}); setCartOpen(false) }} style={{
            background: SURFACE2, border: 'none', borderRadius: 8, padding: '6px 12px',
            color: MUTED, fontSize: 11, cursor: 'pointer', marginTop: 4,
          }}>Clear Cart</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: MUTED }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ color: MUTED, fontSize: 14 }}>{search ? 'No recipes matching "' + search + '"' : 'No recipes yet'}</div>
          <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>Ask AI to build a recipe</div>
        </div>
      ) : (
        filtered.map(r => {
          const isExpanded = expanded === r.id
          const tags = getTags(r)
          const servings = scaleServings[r.id] || 1
          const ingredients = (r.ingredients || '').split('\n').filter(Boolean)

          return (
            <div key={r.id} style={{
              background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12,
              marginBottom: 10, overflow: 'hidden',
            }}>
              {/* Card header */}
              <div
                onClick={() => setExpanded(isExpanded ? null : r.id)}
                style={{ padding: '12px 14px', cursor: 'pointer' }}
              >
                <div style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginBottom: 4 }}>{r.name}</div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                    {tags.map((tag, i) => (
                      <span key={i} style={{
                        background: (TAG_COLORS[tag] || MUTED) + '22',
                        color: TAG_COLORS[tag] || MUTED,
                        borderRadius: 10, padding: '2px 8px', fontSize: 10, fontWeight: 500,
                      }}>{tag}</span>
                    ))}
                  </div>
                )}

                {/* Macro grid */}
                <div style={{ display: 'flex', gap: 12, fontSize: 12, fontFamily: "'JetBrains Mono',monospace" }}>
                  <span style={{ color: GOLD }}>{r.calories_per_serving || 0} cal</span>
                  <span style={{ color: '#22c55e' }}>{r.protein_per_serving || 0}g P</span>
                  <span style={{ color: '#3b82f6' }}>{r.carbs_per_serving || 0}g C</span>
                  <span style={{ color: '#f59e0b' }}>{r.fat_per_serving || 0}g F</span>
                </div>
                <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>
                  {r.servings || 6} servings {r.fiber_per_serving ? `/ ${r.fiber_per_serving}g fiber` : ''} {r.sodium_per_serving ? `/ ${r.sodium_per_serving}mg sodium` : ''}
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div style={{ padding: '0 14px 14px', borderTop: `1px solid ${BORDER}` }}>
                  {/* Serving scaler */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 0' }}>
                    <span style={{ fontSize: 12, color: MUTED }}>Servings:</span>
                    {[1, 2, 3, 4].map(n => (
                      <button key={n} onClick={() => setScaleServings(prev => ({ ...prev, [r.id]: n }))} style={{
                        background: servings === n ? GOLD : SURFACE2,
                        color: servings === n ? DARK : TEXT,
                        border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12,
                        fontWeight: servings === n ? 600 : 400, cursor: 'pointer',
                      }}>{n}</button>
                    ))}
                    <span style={{ fontSize: 11, color: GOLD, fontFamily: "'JetBrains Mono',monospace", marginLeft: 'auto' }}>
                      {Math.round((r.calories_per_serving || 0) * servings)} cal total
                    </span>
                  </div>

                  {/* Ingredients */}
                  {ingredients.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 4, letterSpacing: '0.05em' }}>INGREDIENTS</div>
                      {ingredients.map((ing, i) => (
                        <div key={i} style={{ fontSize: 13, color: TEXT, padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <button onClick={() => toggleCart(r.name, ing)} style={{
                            width: 14, height: 14, borderRadius: 3, flexShrink: 0, cursor: 'pointer',
                            background: (cart[r.name] || []).includes(ing) ? GOLD : 'transparent',
                            border: `1.5px solid ${(cart[r.name] || []).includes(ing) ? GOLD : BORDER}`,
                          }} />
                          {ing}
                        </div>
                      ))}
                      <button onClick={() => addAllToCart(r)} style={{
                        background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8,
                        padding: '6px 12px', color: GOLD, fontSize: 11, cursor: 'pointer', marginTop: 6,
                      }}>+ Add all to cart</button>
                    </div>
                  )}

                  {/* Instructions preview */}
                  {r.instructions && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: MUTED, marginBottom: 4, letterSpacing: '0.05em' }}>INSTRUCTIONS</div>
                      <div style={{ fontSize: 13, color: TEXT, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                        {r.instructions.split('\n').slice(0, 3).join('\n')}
                        {r.instructions.split('\n').length > 3 && '...'}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button onClick={() => logRecipe(r)} style={{
                      background: GOLD, border: 'none', borderRadius: 8, padding: '8px 16px',
                      color: DARK, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    }}>Log {servings} Serving{servings > 1 ? 's' : ''}</button>
                    {r.instructions && (
                      <button onClick={() => setCookMode({ recipe: r, step: 0 })} style={{
                        background: SURFACE2, border: `1px solid ${BORDER}`, borderRadius: 8,
                        padding: '8px 16px', color: TEXT, fontSize: 12, cursor: 'pointer',
                      }}>Cook Mode</button>
                    )}
                    <button onClick={() => { if (confirm('Delete this recipe?')) deleteRecipe(r.id) }} style={{
                      background: 'none', border: 'none', color: MUTED, fontSize: 12, cursor: 'pointer',
                      marginLeft: 'auto',
                    }}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Hint */}
      {!loading && recipes.length > 0 && (
        <div style={{ margin: '12px 0', background: `${GOLD}08`, border: `1px solid ${GOLD}33`, borderRadius: 12, padding: '10px 14px', textAlign: 'center' }}>
          <div style={{ fontSize: 12, color: MUTED }}>
            Try: "Make me a Thai chicken recipe" or "Show my smoker recipes"
          </div>
        </div>
      )}
    </div>
  )
}
