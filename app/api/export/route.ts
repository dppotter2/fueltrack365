import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { cookie: req.headers.get('cookie') || '' } } }
    )
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'food'
    const days = parseInt(searchParams.get('days') || '7')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startStr = startDate.toISOString().split('T')[0]

    if (type === 'food') {
      const { data } = await supabase
        .from('food_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startStr)
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
      return NextResponse.json({ entries: data || [] })
    }

    if (type === 'weight') {
      const { data } = await supabase
        .from('weight_entries')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false })
        .limit(90)
      return NextResponse.json({ entries: data || [] })
    }

    if (type === 'water') {
      const { data } = await supabase
        .from('water_entries')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startStr)
        .order('date', { ascending: false })
      return NextResponse.json({ entries: data || [] })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
