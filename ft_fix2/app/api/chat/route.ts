'use server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT = `You are Claude, the AI brain inside FuelTrack 365 for Patrick Potter.

## PATRICK
34M, Hartford CT. 284 lbs to 230 lbs goal. Tirzepatide 2.5mg/wk. LBM ~155 lbs.

## MACRO TARGETS
Calories: 1,650/day | Protein: 200g | Carbs: 140g | Fat: 40g | Fiber: 32g | Sodium: <2,000mg

## KNOWN PRODUCTS — USE EXACT MACROS, NEVER SEARCH
Core Power Elite 14oz: 230cal 42P 9C 8F (my shake, protein shake, chocolate shake, vanilla shake)
Kaged Hydration 1 scoop: 5cal 0P 1C 0F (my kaged, kaged strawberry, strawberry kaged)
Horchata packet: 10cal 0P 3C 0F
Horchata shake (Core Power + horchata): 240cal 42P 12C 8F
Quest Bar: 190cal 21P 21C 7F fiber:14
Quest Crispy Choc Brownie: 190cal 15P 26C 6F
Quest Overload Choc Explosion: 230cal 20P 27C 9F
Barebells Cookie Dough: 200cal 20P 18C 7F
Halo Mandarin/clementine: 35cal 1P 9C 0F

## FOOD PREFERENCES
OK: beef/chicken/lamb/pork/turkey/veal/seafood/eggs/dairy, all veggies except snap+snow peas, fruits, pasta/farro/couscous/oats/orzo/quinoa, Kerrygold butter ONLY
NEVER: white rice, snap/snow peas, organ meats, cottage cheese

## LOGGING — CRITICAL RULES

**ALWAYS emit a ||LOG|| block for EVERY distinct food item. No exceptions.**

**For complex dishes** like "omelet with ham and cheese" or "chicken with rice and broccoli":
- Log as ONE combined entry with the full dish name and combined macros
- Do NOT break into separate components unless they're clearly separate meals

**For multiple separate items** like "2 eggs and a Quest bar" or "shake and kaged":
- Log EACH item as its own ||LOG|| block

**Common food macros** (use these exactly):
- 1 large egg: 70cal 6P 0C 5F
- 2 large eggs: 140cal 12P 0C 10F
- 3 large eggs: 210cal 18P 0C 15F
- 1 oz ham: 45cal 5P 1C 2F
- 2 oz ham: 90cal 10P 2C 4F
- 1 oz cheddar cheese: 115cal 7P 0C 9F
- 1 oz shredded cheddar: 115cal 7P 0C 9F
- 2 eggs + 1oz ham + 1oz cheese omelet: 345cal 25P 1C 24F
- 2 eggs + 2oz ham + 1oz cheese omelet: 390cal 30P 3C 26F
- 6oz sirloin/flank steak: 300cal 45P 0C 12F
- 7oz sirloin/flank steak: 350cal 52P 0C 14F
- 4oz chicken breast: 185cal 35P 0C 4F
- 6oz chicken breast: 280cal 52P 0C 6F
- 1 slice bacon: 45cal 3P 0C 4F
- 3 slices bacon: 135cal 9P 0C 12F
- 1 tbsp Kerrygold butter: 102cal 0P 0C 12F
- 1 tbsp olive oil: 120cal 0P 0C 14F
- 1 cup broccoli: 55cal 4P 11C 1F
- 1 medium sweet potato: 115cal 2P 27C 0F
- 1/2 cup oats dry: 150cal 5P 27C 3F fiber:4
- 1 cup Greek yogurt: 170cal 17P 6C 9F

**LOG format:**
||LOG||{"name":"Food Name","serving":"amount description","calories":N,"protein":N,"carbs":N,"fat":N,"fiber":N,"sodium":N,"category":"food or drink"}||END||

- Whole numbers only
- category = "food" or "drink" exactly
- For dishes: describe clearly e.g. "Ham and cheese omelet (2 eggs, 2oz ham, 1oz cheddar)"

## OTHER FORMATS
RECIPE: ||RECIPE||{"name":"...","servings":6,"macros_per_serving":{"calories":N,"protein":N,"carbs":N,"fat":N,"fiber":N,"sodium":N},"ingredients":[{"name":"...","amount":"..."}],"steps":["..."],"cuisine":"...","cooking_method":"...","tags":["..."]}||END||
WEIGHT: ||WEIGHT||{"weight":N}||END||

## RESPONSE STYLE
Short and direct: "Logged — ham & cheese omelet. 390 cal, 30g P. 1,260 left."
For multiple items: list each one. Always note remaining macros.
Never preachy. Never repeat targets.`

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
      .slice(0,10).map(([n,c]) => n + ' (' + c + 'x)')

    const todayStr = new Date().toISOString().split('T')[0]
    const viewObj = new Date(date + 'T12:00:00')
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const fullDate = dayNames[viewObj.getDay()] + ', ' + monthNames[viewObj.getMonth()] + ' ' + viewObj.getDate()
    const yDate = new Date(); yDate.setDate(yDate.getDate()-1)
    const isToday = date === todayStr
    const isYest = date === yDate.toISOString().split('T')[0]
    const dateLabel = isToday ? 'TODAY (' + fullDate + ')' : isYest ? 'YESTERDAY (' + fullDate + ')' : fullDate
    const now = new Date()
    const timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0')

    const ctx = `VIEWING: ${dateLabel} | ${date} | ${timeStr}
Logged (${todayEntries.length}): ${todayEntries.length===0 ? 'none' : (todayEntries as any[]).map(e=>e.name+' '+e.calories+'cal').join(', ')}
Remaining: ${remaining.calories}cal | ${remaining.protein}gP | ${remaining.carbs}gC | ${remaining.fat}gF
Totals: ${totals.calories}/${goals.calories}cal | ${totals.protein}/${goals.protein}gP | fiber:${totals.fiber}g
Frequent: ${frequents.length > 0 ? frequents.join(', ') : 'none'}`

    const historyMsgs = sessionHistory.slice(-20).map((m: any) => ({
      role: m.role as 'user'|'assistant',
      content: m.content,
    }))

    const messages: any[] = [
      ...historyMsgs,
      { role: 'user' as const, content: '[CTX]\n' + ctx + '\n[/CTX]\n\n' + message }
    ]

    // Single API call — web search limited to prevent freezing on common foods
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 } as any],
    })

    let rawText = ''

    if (response.stop_reason === 'tool_use') {
      const msgs2: any[] = [...messages, { role: 'assistant', content: response.content }]
      const toolResults: any[] = response.content
        .filter((b: any) => b.type === 'tool_use')
        .map((b: any) => ({ type: 'tool_result', tool_use_id: b.id, content: 'Search completed.' }))
      if (toolResults.length > 0) {
        msgs2.push({ role: 'user', content: toolResults })
        const r2 = await anthropic.messages.create({
          model: 'claude-haiku-4-5', max_tokens: 1200, system: SYSTEM_PROMPT, messages: msgs2,
          tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 } as any],
        })
        for (const b of r2.content) { if (b.type === 'text') rawText += b.text }
      }
    } else {
      for (const b of response.content) { if (b.type === 'text') rawText += b.text }
    }

    if (!rawText) {
      for (const b of response.content) { if (b.type === 'text') rawText += b.text }
    }

    // Parse ALL LOG blocks
    const logDataArray: any[] = []
    const logRegex = /\|\|LOG\|\|([\s\S]+?)\|\|END\|\|/g
    let logMatch
    while ((logMatch = logRegex.exec(rawText)) !== null) {
      try {
        const item = JSON.parse(logMatch[1].trim())
        item.date = date
        logDataArray.push(item)
      } catch(e) {
        console.error('LOG parse error:', logMatch[1].slice(0,100))
      }
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

    if (!displayText && logDataArray.length === 0 && !recipeData) {
      return NextResponse.json({ reply: 'Something went wrong. Try again.', logData: null, logDataArray: [], recipeData: null, weightData: null })
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
    } catch(e) { console.error('chat persist error:', e) }

    return NextResponse.json({
      reply: displayText || null,
      logData: logDataArray[0] || null,
      logDataArray,
      recipeData,
      weightData,
    })

  } catch (err: any) {
    console.error('Chat API error:', err)
    return NextResponse.json({
      reply: 'Something went wrong. Try again.',
      error: err.message,
      logData: null, logDataArray: [], recipeData: null, weightData: null
    }, { status: 500 })
  }
}
