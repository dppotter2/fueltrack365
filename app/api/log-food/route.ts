import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { categorizeFood } from '@/lib/categorize'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { name, serving, calories, protein, carbs, fat, fiber, sodium, category, date } = body
    const logDate = date || new Date().toLocaleDateString('en-CA')
    const cat = category || categorizeFood(name, calories, protein)
    const { data, error } = await supabase.from('food_entries').insert({
      user_id: user.id, date: logDate,
      name, serving: serving || '1 serving',
      calories: Math.round(calories || 0), protein: Math.round(protein || 0),
      carbs: Math.round(carbs || 0), fat: Math.round(fat || 0),
      fiber: Math.round(fiber || 0), sodium: Math.round(sodium || 0),
      category: cat, meal_slot: 'log',
    }).select().single()
    if (error) throw error
    return NextResponse.json({ success: true, entry: data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { id } = await req.json()
    const { error } = await supabase.from('food_entries').delete().eq('id', id).eq('user_id', user.id)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}

// Save recipe - writes to real DB schema with flat columns
export async function PUT(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const { name, servings = 6, macros_per_serving, ingredients, steps, cuisine, cooking_method, tags } = body
    const m = macros_per_serving || {}
    const { data, error } = await supabase.from('recipes').insert({
      user_id: user.id, name,
      servings: 6,
      calories_per_serving: Math.round(m.calories || 0),
      protein_per_serving: Math.round(m.protein || 0),
      carbs_per_serving: Math.round(m.carbs || 0),
      fat_per_serving: Math.round(m.fat || 0),
      fiber_per_serving: Math.round(m.fiber || 0),
      sodium_per_serving: Math.round(m.sodium || 0),
      ingredients: ingredients || [],
      steps: steps || [],
      cuisine: cuisine || '',
      cooking_method: cooking_method || '',
      tags: tags || [],
    }).select().single()
    if (error) throw error
    return NextResponse.json({ success: true, recipe: data })
  } catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }) }
}