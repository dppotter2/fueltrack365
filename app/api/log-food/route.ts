import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { cookie: req.headers.get('cookie') || '' } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const body = await req.json()
    const { action } = body

    if (action === 'log') {
      const { name, serving, calories, protein, carbs, fat, fiber, sodium, category, date } = body
      const { data, error } = await supabase.from('food_entries').insert({
        user_id: user.id,
        date: date || new Date().toISOString().split('T')[0],
        name, serving,
        calories: Math.round(Number(calories) || 0),
        protein: Math.round(Number(protein) || 0),
        carbs: Math.round(Number(carbs) || 0),
        fat: Math.round(Number(fat) || 0),
        fiber: Math.round(Number(fiber) || 0),
        sodium: Math.round(Number(sodium) || 0),
        category: category || 'snack',
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ entry: data })
    }

    if (action === 'tally') {
      const { name, add_calories, add_protein, add_carbs, add_fat, add_fiber, add_sodium, date } = body
      const targetDate = date || new Date().toISOString().split('T')[0]
      const { data: existing } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', targetDate)
        .ilike('name', `%${name}%`)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (existing) {
        const { data, error } = await supabase.from('food_entries').update({
          calories: existing.calories + Math.round(Number(add_calories) || 0),
          protein: existing.protein + Math.round(Number(add_protein) || 0),
          carbs: existing.carbs + Math.round(Number(add_carbs) || 0),
          fat: existing.fat + Math.round(Number(add_fat) || 0),
          fiber: existing.fiber + Math.round(Number(add_fiber) || 0),
          sodium: existing.sodium + Math.round(Number(add_sodium) || 0),
        }).eq('id', existing.id).select().single()
        if (error) return NextResponse.json({ error: error.message }, { status: 400 })
        return NextResponse.json({ entry: data, tallied: true })
      }
      return NextResponse.json({ error: 'Entry not found for tally' }, { status: 404 })
    }

    if (action === 'delete') {
      const { id } = body
      const { error } = await supabase.from('food_entries').delete().eq('id', id).eq('user_id', user.id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ deleted: true })
    }

    if (action === 'water') {
      const { amount_oz, date } = body
      const { data, error } = await supabase.from('water_entries').insert({
        user_id: user.id,
        date: date || new Date().toISOString().split('T')[0],
        amount_oz: Math.round(Number(amount_oz) || 0),
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ entry: data })
    }

    if (action === 'weight') {
      const { weight, notes, date } = body
      const { data, error } = await supabase.from('weight_entries').insert({
        user_id: user.id,
        date: date || new Date().toISOString().split('T')[0],
        weight: Number(weight),
        notes: notes || '',
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ entry: data })
    }

    if (action === 'recipe') {
      const recipe = body.recipe
      const { data, error } = await supabase.from('recipes').insert({
        user_id: user.id,
        name: recipe.name,
        servings: recipe.servings || 6,
        calories_per_serving: Math.round(Number(recipe.calories_per_serving) || 0),
        protein_per_serving: Math.round(Number(recipe.protein_per_serving) || 0),
        carbs_per_serving: Math.round(Number(recipe.carbs_per_serving) || 0),
        fat_per_serving: Math.round(Number(recipe.fat_per_serving) || 0),
        fiber_per_serving: Math.round(Number(recipe.fiber_per_serving) || 0),
        sodium_per_serving: Math.round(Number(recipe.sodium_per_serving) || 0),
        ingredients: recipe.ingredients || '',
        instructions: recipe.instructions || '',
        cooking_method: recipe.cooking_method || '',
        cuisine: recipe.cuisine || '',
        protein_type: recipe.protein_type || '',
        carb_type: recipe.carb_type || '',
        tags: [recipe.cooking_method, recipe.cuisine, recipe.protein_type, recipe.carb_type].filter(Boolean).join(','),
      }).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ recipe: data })
    }

    if (action === 'goals') {
      const { field, old_value, new_value, reason } = body
      // Log the change
      await supabase.from('profile_changes').insert({
        user_id: user.id,
        field, old_value: String(old_value), new_value: String(new_value), reason: reason || '',
      })
      // Update the goals
      await supabase.from('user_goals').upsert({
        user_id: user.id,
        [field]: Number(new_value),
      }, { onConflict: 'user_id' })
      return NextResponse.json({ updated: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error: any) {
    console.error('Log food error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
