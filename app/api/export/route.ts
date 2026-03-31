import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(req.url)
    const days = parseInt(url.searchParams.get('days') || '7')
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const startStr = startDate.toISOString().split('T')[0]

    const { data: entries, error } = await supabase
      .from('food_entries')
      .select('*')
      .eq('user_id', user.id)
      .gte('date', startStr)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) throw error

    const headers = ['Date', 'Name', 'Serving', 'Calories', 'Protein', 'Carbs', 'Fat', 'Fiber', 'Sodium', 'Category']
    const rows = (entries || []).map(e => [
      e.date, `"${e.name}"`, `"${e.serving}"`,
      e.calories, e.protein, e.carbs, e.fat, e.fiber, e.sodium, e.category
    ].join(','))

    const csv = [headers.join(','), ...rows].join('\n')

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="fueltrack-${days}days.csv"`,
      },
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
