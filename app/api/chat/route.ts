'use server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT = `You are Claude, the AI brain inside FuelTrack 365 for Patrick Potter.

## PATRICK
34M, Hartford CT. 284 lbs start, goal 230 lbs. Tirzepatide 2.5mg/wk. LBM ~155 lbs.

## MACRO TARGETS
Calories: 1,650/day (never below 1,400) | Protein: 200g (never below 155g)
Carbs: 140g | Fat: 40g | Fiber: 32g | Sodium: <2,000mg

## KNOWN PRODUCTS — NEVER SEARCH THESE
Core Power Elite 14oz: 230cal 42P 9C 8F (my shake, protein shake, chocolate shake)
Kaged Hydration 1 scoop: 5cal 0P 1C 0F (my kaged, kaged strawberry, strawberry kaged)
Taste Salud Horchata packet: 10cal 0P 3C 0F — mixed with Core Power = 240cal 42P 12C 8F (horchata shake)
Quest Bar: 190cal 21P 21C 7F fiber:14
Quest Crispy Choc Brownie: 190cal 15P 26C 6F
Quest Overload Choc Explosion: 230cal 20P 27C 9F
Barebells Cookie Dough: 200cal 20P 18C 7F
Halo Mandarin/clementine: 35cal 1P 9C 0F

## FOOD RULES
OK: all meats/seafood/eggs/dairy, all veggies except snap+snow peas, all fruits, couscous/farro/oats/orzo/pasta/quinoa, Kerrygold butter ONLY
NEVER: white rice, snap/snow peas, organ meats, cottage cheese

## LOG FOOD — CRITICAL FORMAT
When logging food ALWAYS emit:
||LOG||{"name":"Food Name","serving":"amount","calories":N,"protein":N,"carbs":N,"fat":N,"fiber":N,"sodium":N,"category":"food or drink"}||END||

RULES:
- Do NOT put a "date" field in the LOG block — the server handles this automatically
- Whole numbers only (no decimals)
- category = exactly "food" or "drink"
- Emit LOG block for every food item logged
- For known products use exact macros above, never search

## OTHER FORMATS
RECIPE: ||RECIPE||{"name":"...","servings":6,"macros_per_serving":{"calories":N,"protein":N,"carbs":N,"fat":N,"fiber":N,"sodium":N},"ingredients":[{"name":"...","amount":"..."}],"steps":["..."],"cuisine":"...","cooking_method":"...","tags":["..."]}||END||
WEIGHT: ||WEIGHT||{"weight":N}||END||

## STYLE
Short for logs: "Logged — Core Power Elite. 230 cal, 42g P. 460 left."
For repeats: just impact, no re-explaining.
Always note remaining after logging. Never preachy.`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      message, sessionHistory = [], todayEntries = [], recentEntries = [],
      goals = { calories: 1650, protein: 200, carbs: 140, fat: 40, fiber: 32, sodium: 2000 },
      totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 },
      currentPage = '/log', date = new Date().toISOString().split('T')[0],
    } = body

    const remaining = {
      calories: goals.calories - totals.calories,
      protein: goals.protein - totals.protein,
      carbs: goals.carbs - totals.carbs,
      fat: goals.fat - totals.fat,
    }

    const freq: Record<string, number> = {}
    for (const e of recentEntries) { const k = e.name.toLowerCase(); freq[k] = (freq[k]||0)+1 }
    const frequents = Object.entries(freq).filter(([,c]) => c >= 2).sort((a,b) => b[1]-a[1])
      .slice(0,12).map(([n,c]) => n + ' (' + c + 'x this week)')

    const todayStr = new Date().toISOString().split('T')[0]
    const viewDateObj = new Date(date + 'T12:00:00')
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const fullDateStr = dayNames[viewDateObj.getDay()] + ', ' + monthNames[viewDateObj.getMonth()] + ' ' + viewDateObj.getDate()
    const isToday = date === todayStr
    const yDate = new Date(); yDate.setDate(yDate.getDate()-1)
    const isYesterday = date === yDate.toISOString().split('T')[0]
    const dateLabel = isToday ? 'TODAY (' + fullDateStr + ')' : isYesterday ? 'YESTERDAY (' + fullDateStr + ')' : fullDateStr + ' (past)'
    const now = new Date()
    const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0')

    const ctx = 'VIEWING: ' + dateLabel + ' | date=' + date + '\nTime: ' + timeStr + ' | Page: ' + currentPage + '\nEntries on ' + date + ' (' + todayEntries.length + '): ' + (todayEntries.length===0 ? 'none' : (todayEntries as any[]).map(e=>e.name+' '+e.calories+'cal').join(', ')) + '\nRemaining: ' + remaining.calories + 'cal | ' + remaining.protein + 'gP | ' + remaining.carbs + 'gC | ' + remaining.fat + 'gF\nTotals: ' + totals.calories + '/' + goals.calories + 'cal | ' + totals.protein + '/' + goals.protein + 'gP | fiber:' + totals.fiber + 'g | sodium:' + totals.sodium + 'mg\nFrequent: ' + (frequents.length>0 ? frequents.join(', ') : 'none')

    const historyMsgs = sessionHistory.slice(-28).map((m: any) => ({ role: m.role as 'user'|'assistant', content: m.content }))
    let messages: any[] = [...historyMsgs, { role: 'user' as const, content: '[CTX]\n' + ctx + '\n[/CTX]\n\n' + message }]
    const tools: any[] = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]

    let rawText = ''
    let iter = 0
    while (iter < 6) {
      iter++
      const response = await anthropic.messages.create({ model: 'claude-haiku-4-5', max_tokens: 1500, system: SYSTEM_PROMPT, messages, tools })
      for (const block of response.content) { if (block.type === 'text') rawText += block.text }
      if (response.stop_reason !== 'tool_use') break
      messages.push({ role: 'assistant', content: response.content })
      const tr: any[] = response.content.filter((b:any)=>b.type==='tool_use').map((b:any)=>({type:'tool_result',tool_use_id:b.id,content:'Search done.'}))
      if (tr.length === 0) break
      messages.push({ role: 'user', content: tr })
    }

    let logData = null
    const logMatch = rawText.match(/\|\|LOG\|\|([\s\S]+?)\|\|END\|\|/)
    if (logMatch) {
      try {
        logData = JSON.parse(logMatch[1].trim())
        // Server always stamps the viewing date — never trust a date from Claude's LOG block
        if (logData) logData.date = date
      } catch(e) { console.error('LOG parse fail:', e, logMatch[1].slice(0,100)) }
    }

    let recipeData = null
    const recipeMatch = rawText.match(/\|\|RECIPE\|\|([\s\S]+?)\|\|END\|\|/)
    if (recipeMatch) { try { recipeData = JSON.parse(recipeMatch[1].trim()) } catch {} }

    let weightData = null
    const weightMatch = rawText.match(/\|\|WEIGHT\|\|([\s\S]+?)\|\|END\|\|/)
    if (weightMatch) { try { weightData = JSON.parse(weightMatch[1].trim()) } catch {} }

    const displayText = rawText
      .replace(/\|\|LOG\|\|[\s\S]+?\|\|END\|\|/g, '')
      .replace(/\|\|RECIPE\|\|[\s\S]+?\|\|END\|\|/g, '')
      .replace(/\|\|WEIGHT\|\|[\s\S]+?\|\|END\|\|/g, '')
      .replace(/I'll search[^.]*\.?|Let me search[^.]*\.?/gi, '')
      .trim()

    if (!displayText && !logData && !recipeData) {
      return NextResponse.json({ reply: 'Something went wrong. Try again.', logData: null, recipeData: null, weightData: null })
    }

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user && displayText) {
        await supabase.from('chat_messages').insert([
          { user_id: user.id, role: 'user', content: message },
          { user_id: user.id, role: 'assistant', content: displayText },
        ])
      }
    } catch(e) { console.error('persist error', e) }

    return NextResponse.json({ reply: displayText || null, logData, recipeData, weightData })

  } catch (err: any) {
    console.error('Chat API error:', err)
    return NextResponse.json({ reply: 'Something went wrong. Try again.', error: err.message }, { status: 500 })
  }
}