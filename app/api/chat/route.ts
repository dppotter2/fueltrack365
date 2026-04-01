'use server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT = `You are Claude, the AI brain inside FuelTrack 365 for Patrick Potter.

## PATRICK'S PROFILE
34M, Hartford CT. 284 lbs start, goal 230 lbs. Tirzepatide 2.5mg/wk. LBM ~155 lbs.

## MACRO TARGETS
Calories: 1,650/day (never below 1,400) | Protein: 200g (never below 155g) | Carbs: 140g | Fat: 40g | Fiber: 32g | Sodium: <2,000mg

## KNOWN PRODUCTS — NEVER SEARCH THESE
- Core Power Elite 14oz: 230cal 42P 9C 8F (called: my shake, my protein shake, chocolate shake)
- Kaged Hydration 1 scoop: 5cal 0P 1C 0F (called: my kaged, kaged strawberry, strawberry kaged)
- Taste Salud Horchata packet: 10cal 0P 3C 0F
- Quest Bar: 190cal 21P 21C 7F fiber:14
- Quest Crispy Choc Brownie: 190cal 15P 26C 6F
- Quest Overload Choc Explosion: 230cal 20P 27C 9F
- Barebells Cookie Dough: 200cal 20P 18C 7F
- Halo Mandarin/clementine: 35cal 1P 9C 0F

## FOOD RULES
OK: all meats/seafood/eggs/dairy, all veggies except snap+snow peas, all fruits, couscous/farro/oats/orzo/pasta/quinoa, Kerrygold butter ONLY
NEVER: white rice, snap/snow peas, organ meats, cottage cheese
Cooks for 2. Recipes default 6 servings. Veg measurements in oz. Equipment: Weber Searwood smoker, Dutch oven, cast iron, Instant Pot.

## DATA FORMATS
LOG FOOD: emit ||LOG||{"name":"...","serving":"...","calories":N,"protein":N,"carbs":N,"fat":N,"fiber":N,"sodium":N,"category":"food or drink","date":"YYYY-MM-DD"}||END||
   The "date" field MUST match where Patrick wants it logged. Default to the ACTIVE DATE. Change it if Patrick explicitly says a different date ("log to today", "for yesterday", etc.).
RECIPE: emit ||RECIPE||{"name":"...","servings":6,"macros_per_serving":{"calories":N,"protein":N,"carbs":N,"fat":N,"fiber":N,"sodium":N},"ingredients":[{"name":"...","amount":"...","category":"pantry|protein|produce|dairy|spice"}],"steps":["..."],"cuisine":"...","cooking_method":"...","tags":["..."]}||END||
WEIGHT: emit ||WEIGHT||{"weight":N}||END||

## RESPONSE STYLE
- Short for logs: Logged — Kaged strawberry x4. 20 cal. 1,630 left.
- For repeats: Same as usual — then just the impact. No re-explaining.
- Always note remaining macros after logging.
- Never preachy. Never repeat targets back constantly.`

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
      calories: goals.calories - totals.calories, protein: goals.protein - totals.protein,
      carbs: goals.carbs - totals.carbs, fat: goals.fat - totals.fat,
    }

    const freq: Record<string, number> = {}
    for (const e of recentEntries) { const k = e.name.toLowerCase(); freq[k] = (freq[k]||0)+1 }
    const frequents = Object.entries(freq).filter(([,c]) => c >= 2).sort((a,b) => b[1]-a[1])
      .slice(0,12).map(([n,c]) => n + ' (' + c + 'x this week)')

    // Format the viewing date fully for Claude
    const viewDateObj = new Date(date + 'T12:00:00')
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const vDay = viewDateObj.getDate()
    const vSuf = [11,12,13].includes(vDay)?'th':vDay%10===1?'st':vDay%10===2?'nd':vDay%10===3?'rd':'th'
    const fullDateStr = dayNames[viewDateObj.getDay()]+', '+monthNames[viewDateObj.getMonth()]+' '+vDay+vSuf+' '+date
    const todayStr = new Date().toISOString().split('T')[0]
    const isViewingToday = date === todayStr
    const isViewingYesterday = date === new Date(new Date().setDate(new Date().getDate()-1)).toISOString().split('T')[0]
    const dateContext = isViewingToday ? 'TODAY ('+fullDateStr+')' : isViewingYesterday ? 'YESTERDAY ('+fullDateStr+')' : 'PAST DATE ('+fullDateStr+')'
    const now = new Date()
    const timeStr = String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')

    const ctx = '## ACTIVE DATE: '+dateContext+'\n' +
      'Current time: '+timeStr+' | Page: '+currentPage+'\n' +
      'LOGGING RULE: Always emit the LOG block with the date field set to the date Patrick intends.\n' +
      '- Default log date: '+date+' (the date tab Patrick is currently viewing)\n' +
      '- If Patrick says "for today" or "log to today": use '+todayStr+'\n' +
      '- If Patrick says "for yesterday" or "log to yesterday": use date before '+todayStr+'\n' +
      '- The LOG block MUST include: "date":"YYYY-MM-DD" matching the intended date.\n' +
      'Entries on '+date+' ('+todayEntries.length+'): '+(todayEntries.length===0 ? 'none' : (todayEntries as any[]).map(e=>e.name+' '+e.calories+'cal').join(', '))+'\n' +
      'Remaining for '+date+': '+remaining.calories+'cal | '+remaining.protein+'gP | '+remaining.carbs+'gC | '+remaining.fat+'gF\n' +
      'Totals for '+date+': '+totals.calories+'/'+goals.calories+'cal | '+totals.protein+'/'+goals.protein+'gP | fiber:'+totals.fiber+'g | sodium:'+totals.sodium+'mg\n' +
      'Frequent this week: '+(frequents.length>0 ? frequents.join(', ') : 'none')

    const historyMsgs = sessionHistory.slice(-28).map((m: any) => ({ role: m.role as 'user'|'assistant', content: m.content }))
    let messages: any[] = [...historyMsgs, { role: 'user' as const, content: '[CONTEXT]\n' + ctx + '\n[/CONTEXT]\n\n' + message }]

    const tools: any[] = [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }]

    let rawText = ''
    let iterations = 0

    while (iterations < 6) {
      iterations++
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5', max_tokens: 1500,
        system: SYSTEM_PROMPT, messages, tools,
      })

      for (const block of response.content) {
        if (block.type === 'text') rawText += block.text
      }

      if (response.stop_reason !== 'tool_use') break

      messages.push({ role: 'assistant', content: response.content })

      const toolResults: any[] = response.content
        .filter((b: any) => b.type === 'tool_use')
        .map((b: any) => ({ type: 'tool_result', tool_use_id: b.id, content: 'Search executed.' }))

      if (toolResults.length === 0) break
      messages.push({ role: 'user', content: toolResults })
    }

    let logData = null
    const logMatch = rawText.match(/\|\|LOG\|\|([\s\S]+?)\|\|END\|\|/)
    if (logMatch) {
      try {
        logData = JSON.parse(logMatch[1].trim())
        // Only set date if Claude didn't include one in the LOG block
        // Claude sets "date" in the block when Patrick says "log for today/yesterday"
        if (logData && !logData.date) logData.date = date
      } catch {}
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
      .replace(/I'll search[^.]*\.?|Let me search[^.]*\.?|Searching for[^.]*\.?/gi, '')
      .trim()

    if (!displayText && !logData && !recipeData) {
      return NextResponse.json({ reply: "Something went wrong. Please try again.", logData: null, recipeData: null, weightData: null })
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