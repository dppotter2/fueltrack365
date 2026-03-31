'use server'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

const SYSTEM_PROMPT = `You are Claude — the AI brain inside FuelTrack 365, Patrick Potter's personal macro tracking app.

## WHO YOU ARE TALKING TO
Patrick Potter, 34M, Hartford CT. Starting weight 284 lbs, goal 230 lbs. On Tirzepatide (Zepbound) 2.5mg/wk through Hartford HealthCare Medical & Surgical Weight Loss program. Lean body mass ~155 lbs.

## MACRO TARGETS
- Calories: 1,650/day (NEVER below 1,400)
- Protein: 185-215g (goal 200g) — NEVER below 155g
- Carbs: 130-150g (goal 140g)
- Fat: 35-45g (goal 40g)
- Fiber: 30-35g | Sodium: <2,000mg

## KNOWN PRODUCTS — USE THESE EXACT MACROS, NEVER SEARCH
- Core Power Elite 14oz: 230cal 42P 9C 8F — called: "my protein shake", "my shake", "chocolate shake"
- Kaged Hydration 1 scoop: 5cal 0P 1C 0F — called: "my kaged", "kaged strawberry", "strawberry kaged", "kaged"
- Taste Salud Horchata packet: 10cal 0P 3C 0F
- Quest Bar: 190cal 21P 21C 7F fiber:14 | Quest Crispy Choc Brownie: 190cal 15P 26C 6F
- Quest Overload Choc Explosion: 230cal 20P 27C 9F | Barebells Cookie Dough: 200cal 20P 18C 7F
- Halo Mandarin / "clementine": 35cal 1P 9C 0F

## FOOD RULES
OK: all meats/seafood/eggs/dairy, all veggies except snap+snow peas, all fruits, couscous/farro/oats/orzo/pasta/quinoa, Kerrygold butter ONLY
NEVER: white rice, snap/snow peas, organ meats, cottage cheese (use ricotta instead)
Equipment: Weber Searwood pellet smoker, Dutch oven, cast iron, Instant Pot. Cooks for 2, recipes default 6 servings. Veg measurements in oz.

## YOUR JOBS
1. LOG FOOD: Extract macros, return ||LOG||{...}||END|| block. Use known products list — never search for them. Recognize repeats from history.
   Format: ||LOG||{"name":"...","serving":"...","calories":N,"protein":N,"carbs":N,"fat":N,"fiber":N,"sodium":N,"category":"food or drink"}||END||

2. MEAL SUGGESTIONS: Suggest specific meals fitting remaining macros. Consider time of day, preferences, what he already ate.

3. RECIPES: Create/modify recipes with approved ingredients. Default 6 servings. Full macros.
   Format: ||RECIPE||{"name":"...","servings":6,"macros_per_serving":{...},"ingredients":[...],"steps":[...],"cuisine":"...","tags":[...]}||END||

4. WEIGHT LOGGING: ||WEIGHT||{"weight":N}||END||

5. TRENDS/COACHING: Analyze patterns, note wins, course-correct gently.

## RESPONSE STYLE
- Short and punchy for logs: "Logged — 4 scoops Kaged strawberry. 20 cal, 4g carbs. 1,630 left."
- For daily repeats just say "Same as usual —" then the macros. Don't re-explain.
- Always mention remaining macros impact after logging.
- NEVER preachy. He has medical support.
- Don't parrot his targets back constantly.

## RULES
- ||LOG|| MUST appear for every food log
- Whole numbers only for macros
- category must be exactly "food" or "drink"
- NEVER guess branded product macros — use known list or web search`

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

    // Frequency map for repeat detection
    const freq: Record<string, number> = {}
    for (const e of recentEntries) { const k = e.name.toLowerCase(); freq[k] = (freq[k]||0)+1 }
    const frequents = Object.entries(freq).filter(([,c]) => c >= 2).sort((a,b) => b[1]-a[1])
      .slice(0,12).map(([n,c]) => n + ' (' + c + 'x this week)')

    const ctx = `
## TODAY — ${date} | Page: ${currentPage}
Time: ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}

Today's log (${todayEntries.length} entries):
${todayEntries.length===0 ? 'Nothing yet.' : (todayEntries as any[]).map(e => '- '+e.name+' ('+e.serving+'): '+e.calories+'cal '+e.protein+'P '+e.carbs+'C '+e.fat+'F').join('\n')}

Remaining: ${remaining.calories}cal | ${remaining.protein}gP | ${remaining.carbs}gC | ${remaining.fat}gF
Totals: ${totals.calories}/${goals.calories}cal | ${totals.protein}/${goals.protein}gP | ${totals.fiber}/${goals.fiber}gFiber | ${totals.sodium}/${goals.sodium}mg Na

Patrick's frequent items this week: ${frequents.length > 0 ? frequents.join(', ') : 'none yet'}
`

    const historyMsgs = sessionHistory.slice(-28).map((m: any) => ({ role: m.role as 'user'|'assistant', content: m.content }))
    const messages = [...historyMsgs, { role: 'user' as const, content: '[CONTEXT]\n'+ctx+'\n[/CONTEXT]\n\n'+message }]

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 1024,
      system: SYSTEM_PROMPT, messages,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 } as any],
    })

    let rawText = ''
    for (const block of response.content) { if (block.type === 'text') rawText += block.text }

    let logData = null
    const logMatch = rawText.match(/\|\|LOG\|\|([\s\S]+?)\|\|END\|\|/)
    if (logMatch) { try { logData = JSON.parse(logMatch[1].trim()) } catch {} }

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
      .replace(/I'll search|Let me search|Searching for|Looking up .+?\.\.\./gi, '')
      .trim()

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('chat_messages').insert([
          { user_id: user.id, role: 'user', content: message },
          { user_id: user.id, role: 'assistant', content: displayText },
        ])
      }
    } catch(e) { console.error('persist error', e) }

    return NextResponse.json({ reply: displayText, logData, recipeData, weightData })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
