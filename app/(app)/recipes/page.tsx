'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { Recipe } from '@/lib/types'

const GOLD = '#d4a017'
const DARK = '#0a0a0a'
const SURFACE = '#141414'
const SURFACE2 = '#1e1e1e'
const BORDER = '#2a2a2a'
const TEXT = '#f0f0f0'
const MUTED = '#888'

function MacroBadge({ label, value, unit = 'g', color }: { label: string; value: number; unit?: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}{unit}</div>
      <div style={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  )
}

function RecipeCard({ recipe, onLog, onDelete }: {
  recipe: Recipe
  onLog: (recipe: Recipe) => void
  onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const m = recipe.macros_per_serving

  const cuisineColors: Record<string, string> = {
    italian: '#ef4444', mexican: '#f59e0b', asian: '#3b82f6', american: '#10b981',
    japanese: '#8b5cf6', thai: '#06b6d4', french: '#ec4899', greek: '#14b8a6',
    bbq: '#f97316', mediterranean: '#6366f1',
  }
  const tagColor = (tag: string) => {
    const lower = tag.toLowerCase()
    for (const [k, v] of Object.entries(cuisineColors)) {
      if (lower.includes(k)) return v
    }
    return MUTED
  }

  return (
    <div style={{
      margin: '0 12px 10px',
      background: SURFACE, borderRadius: 16, border: `1px solid ${BORDER}`,
      overflow: 'hidden',
    }}>
      {/* Card header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ padding: '14px 14px 12px', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 3 }}>
              {recipe.name}
            </div>
            <div style={{ fontSize: 11, color: MUTED }}>
              {recipe.servings} servings
              {recipe.cooking_method && ` · ${recipe.cooking_method}`}
              {recipe.cuisine && ` · ${recipe.cuisine}`}
            </div>
          </div>
          <div style={{ fontSize: 16, color: MUTED, marginLeft: 8 }}>
            {expanded ? '▲' : '▼'}
          </div>
        </div>

        {/* Macros per serving */}
        <div style={{
          display: 'flex', justifyContent: 'space-around',
          background: SURFACE2, borderRadius: 12, padding: '10px 8px',
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: GOLD }}>{m?.calories || 0}</div>
            <div style={{ fontSize: 9, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cal</div>
          </div>
          <div style={{ width: 1, background: BORDER }} />
          <MacroBadge label="Protein" value={m?.protein || 0} color="#10b981" />
          <div style={{ width: 1, background: BORDER }} />
          <MacroBadge label="Carbs" value={m?.carbs || 0} color="#3b82f6" />
          <div style={{ width: 1, background: BORDER }} />
          <MacroBadge label="Fat" value={m?.fat || 0} color="#f59e0b" />
        </div>

        {/* Tags */}
        {recipe.tags && recipe.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {recipe.tags.map(tag => (
              <span key={tag} style={{
                fontSize: 10, fontWeight: 600,
                color: tagColor(tag),
                background: `${tagColor(tag)}18`,
                padding: '2px 8px', borderRadius: 20,
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Expanded: ingredients + steps */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}` }}>
          {recipe.ingredients && recipe.ingredients.length > 0 && (
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>
                Ingredients (serves {recipe.servings})
              </div>
              {recipe.ingredients.map((ing, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '5px 0', borderBottom: i < recipe.ingredients.length - 1 ? `1px solid ${BORDER}` : 'none',
                }}>
                  <span style={{ fontSize: 13, color: TEXT }}>{ing.name}</span>
                  <span style={{ fontSize: 13, color: MUTED }}>{ing.amount}</span>
                </div>
              ))}
            </div>
          )}

          {recipe.steps && recipe.steps.length > 0 && (
            <div style={{ padding: '0 14px 12px', borderTop: `1px solid ${BORDER}` }}>
              <div style={{ fontSize: 10, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8, marginTop: 12 }}>
                Steps
              </div>
              {recipe.steps.map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', background: GOLD,
                    color: DARK, fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, marginTop: 1,
                  }}>{i + 1}</div>
                  <span style={{ fontSize: 13, color: TEXT, lineHeight: 1.5 }}>{step}</span>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{
            padding: '10px 14px 14px',
            display: 'flex', gap: 8,
            borderTop: `1px solid ${BORDER}`,
          }}>
            <button
              onClick={() => onLog(recipe)}
              style={{
                flex: 1, padding: '10px', background: GOLD, border: 'none',
                borderRadius: 10, color: DARK, fontWeight: 700, fontSize: 13,
                cursor: 'pointer',
              }}
            >
              Log 1 Serving
            </button>
            <button
              onClick={() => onDelete(recipe.id)}
              style={{
                padding: '10px 14px', background: SURFACE2,
                border: `1px solid ${BORDER}`, borderRadius: 10,
                color: '#ef4444', fontSize: 13, cursor: 'pointer',
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function RecipesPage() {
  const supabase = createClient()
  const [user, setUser] = useState<any>(null)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [logMsg, setLogMsg] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', user.id)
      .order('name', { ascending: true })
    setRecipes((data || []) as Recipe[])
    setLoading(false)
  }, [user])

  useEffect(() => { load() }, [load])

  const filtered = recipes.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.tags?.some(t => t.toLowerCase().includes(search.toLowerCase())) ||
    r.cuisine?.toLowerCase().includes(search.toLowerCase())
  )

  const logRecipe = async (recipe: Recipe) => {
    if (!user) return
    const m = recipe.macros_per_serving
    const today = new Date()
    const date = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

    await fetch('/api/log-food', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: recipe.name,
        serving: '1 serving',
        calories: m?.calories || 0,
        protein: m?.protein || 0,
        carbs: m?.carbs || 0,
        fat: m?.fat || 0,
        fiber: m?.fiber || 0,
        sodium: m?.sodium || 0,
        category: 'food',
        date,
      }),
    })

    setLogMsg(`✓ Logged ${recipe.name}`)
    setTimeout(() => setLogMsg(''), 2500)
  }

  const deleteRecipe = async (id: string) => {
    if (!confirm('Delete this recipe?')) return
    await supabase.from('recipes').delete().eq('id', id).eq('user_id', user.id)
    load()
  }

  return (
    <div style={{ minHeight: '100%', background: DARK, paddingBottom: 32 }}>

      {/* Header */}
      <div style={{ padding: '20px 16px 12px' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: TEXT }}>Recipes</h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: MUTED }}>
          Ask Claude to create, find, or scale any recipe
        </p>
      </div>

      {/* Search */}
      <div style={{ padding: '0 12px 12px' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search recipes, tags, cuisine..."
          style={{
            width: '100%', background: SURFACE, border: `1px solid ${BORDER}`,
            borderRadius: 12, padding: '12px 16px', color: TEXT, fontSize: 14,
            outline: 'none', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Log confirmation */}
      {logMsg && (
        <div style={{
          margin: '0 12px 10px', background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12,
          padding: '10px 16px', fontSize: 13, color: '#10b981', textAlign: 'center', fontWeight: 600,
        }}>
          {logMsg}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '48px', color: MUTED }}>Loading recipes...</div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: MUTED }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🍳</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: TEXT, marginBottom: 6 }}>
            {search ? `No recipes matching "${search}"` : 'No recipes yet'}
          </div>
          <div style={{ fontSize: 13, color: MUTED }}>
            Tap the gold bubble → ask Claude to build a recipe
          </div>
        </div>
      )}

      {/* Recipe list */}
      {filtered.map(recipe => (
        <RecipeCard
          key={recipe.id}
          recipe={recipe}
          onLog={logRecipe}
          onDelete={deleteRecipe}
        />
      ))}

      {/* Ask Claude CTA */}
      {!loading && recipes.length > 0 && (
        <div style={{
          margin: '12px 12px 0', background: 'rgba(212,160,23,0.06)',
          border: `1px solid rgba(212,160,23,0.2)`, borderRadius: 16,
          padding: '14px 16px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: MUTED }}>
            Try: <em style={{ color: GOLD }}>"Make me a Thai chicken recipe"</em> or <em style={{ color: GOLD }}>"Show me my smoker recipes"</em>
          </div>
        </div>
      )}
    </div>
  )
}
