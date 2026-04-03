import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { findKnownProduct } from '@/lib/known-products'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

function getSupabase(req: NextRequest) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { cookie: req.headers.get('cookie') || '' } } }
  )
}

const SYSTEM_PROMPT = `You are Claude, the AI inside FuelTrack 365 — Patrick Potter's personal macro tracking app.

## PATRICK'S PROFILE
34M, 6'0", current goal: 230 lbs. On Hartford HealthCare Medical & Surgical Weight Loss program.
Lean body mass ~155 lbs. Cooking for himself + one other person.

## DAILY MACRO TARGETS (recalculate every 15-20 lbs)
- Calories: 1,650/day (never below 1,400)
- Protein: 185-215g (protein FIRST at every meal)
- Carbs: 130-150g
- Fat: 35-45g
- Fiber: 30-35g | Sodium: <2,000mg
- Water: 96-112 oz/day (min 64 oz)
- Added sugar: <25g/day

## MEAL STRUCTURE
- Meal 1: 450-475 cal | 50-55g P | 38-42g C | 12-14g F
- Snack 1: 150-175 cal | 15-20g P
- Meal 2: 575-625 cal | 65-75g P | 45-55g C | 12-16g F
- Snack 2: 150-175 cal | 15-20g P

## COOKING PROFILE
Equipment: Weber Searwood pellet smoker/grill, Dutch oven, cast iron, sheet pan, Instant Pot.
Season: May-Oct = smoker/grill. Winter = stovetop/oven/Dutch oven braises.
Style: Medium heat, balanced richness, bright acid finish. Meat rare to medium-rare. Medium smoke.
Loves: mushrooms, roasted root veg, fresh tomatoes, alliums. Dislikes: snow/snap peas, organ meats.
Butter: Kerrygold only. PB: Teddie All Natural Smooth. Ricotta: BelGioioso or Organic Valley.
Cuisines: Italian-American, New England, Mexican, Southern, Tex-Mex (confident). Exploring: French, Spanish, Greek, Japanese, Thai, Brazilian, Cuban, Cajun/Creole, Caribbean, Lebanese.

## RESPONSE RULES
- NO EMOJIS EVER. They look cheap.
- Be concise. 1-3 sentences for food logging. Longer for recipes/analysis.
- Never narrate your search process. Just give the answer.
- All recipes must be for 6 servings.
- Use military time format (e.g., 14:30).
- Date format: "Thursday, April 2nd"
- Macro values must be integers.

## STRUCTURED DATA BLOCKS
When logging food, ALWAYS include at end of response:
||LOG||{"name":"Food Name","serving":"portion","calories":N,"protein":N,"carbs":N,"fat":N,"fiber":N,"sodium":N,"category":"meal|drink|snack"}||END||

When user says "more" or "another" of something already logged today, use TALLY to update existing entry:
||TALLY||{"name":"Exact Name From Log","add_calories":N,"add_protein":N,"add_carbs":N,"add_fat":N,"add_fiber":N,"add_sodium":N}||END||

When saving a recipe:
||RECIPE||{"name":"Recipe Name","servings":6,"calories_per_serving":N,"protein_per_serving":N,"carbs_per_serving":N,"fat_per_serving":N,"fiber_per_serving":N,"sodium_per_serving":N,"ingredients":"ingredient list","instructions":"step by step","cooking_method":"grill|smoke|oven|stovetop|no-cook","cuisine":"Italian|Mexican|etc","protein_type":"chicken|beef|etc","carb_type":"rice|pasta|etc"}||END||

When logging water:
||WATER||{"amount_oz":N}||END||

When logging weight:
||WEIGHT||{"weight":N,"notes":"optional context"}||END||

When updating macro goals:
||GOALS||{"field":"calories|protein|carbs|fat|fiber|sodium","old_value":N,"new_value":N,"reason":"why changed"}||END||
`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { message, date, page, todayEntries, totals, goals, frequents, recentEntries, library, recipes, pastMessages, waterOz } = body

    // Intent detection for fast path
    const lowerMsg = message.toLowerCase().trim()
    const knownProduct = findKnownProduct(lowerMsg)

    // Build frequency map from recent entries
    const freqMap: Record<string, number> = {}
    if (recentEntries && Array.isArray(recentEntries)) {
      recentEntries.forEach((e: any) => {
        freqMap[e.name] = (freqMap[e.name] || 0) + 1
      })
    }
    const freqStr = Object.entries(freqMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([name, count]) => `${name}: ${count}x`)
      .join(', ')

    // Build date context
    const viewDate = new Date(date + 'T12:00:00')
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December']
    const vDay = viewDate.getDate()
    const vSuf = [11,12,13].includes(vDay) ? 'th' : vDay%10===1 ? 'st' : vDay%10===2 ? 'nd' : vDay%10===3 ? 'rd' : 'th'
    const fullDateStr = `${dayNames[viewDate.getDay()]}, ${monthNames[viewDate.getMonth()]} ${vDay}${vSuf}`
    const todayStr = new Date().toISOString().split('T')[0]
    const isToday = date === todayStr
    const dateLabel = isToday ? `TODAY (${fullDateStr} ${date})` : `${fullDateStr} ${date}`
    const now = new Date()
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`

    const remaining = {
      calories: Math.round((goals?.calories || 1650) - (totals?.calories || 0)),
      protein: Math.round((goals?.protein || 200) - (totals?.protein || 0)),
      carbs: Math.round((goals?.carbs || 140) - (totals?.carbs || 0)),
      fat: Math.round((goals?.fat || 40) - (totals?.fat || 0)),
    }

    const todayBlock = todayEntries && todayEntries.length > 0
      ? todayEntries.map((e: any) => `  ${e.name} -- ${e.serving} -- ${e.calories}cal ${e.protein}gP ${e.carbs}gC ${e.fat}gF`).join('\n')
      : 'Nothing logged yet.'

    const libBlock = library && library.length > 0
      ? library.slice(0, 30).map((i: any) => `  ${i.name} -- ${i.serving_size} -- ${i.calories}cal ${i.protein}P ${i.carbs}C ${i.fat}F`).join('\n')
      : ''

    const recBlock = recipes && recipes.length > 0
      ? recipes.map((r: any) => `  ${r.name} -- ${r.servings || 6} servings -- ${r.cooking_method || 'various'} -- ${r.cuisine || 'various'}`).join('\n')
      : ''

    const pageContext = page === '/trends' ? 'User is on TRENDS page. May ask for reports, analysis, data exports.'
      : page === '/recipes' ? 'User is on RECIPES page. May ask to find, filter, build, or scale recipes.'
      : page === '/profile' ? 'User is on PROFILE page. May ask to view/edit macro goals, log weight, review changes.'
      : 'User is on LOG page. Primary use: logging food, checking progress, meal suggestions.'

    const contextBlock = `## ACTIVE DATE: ${dateLabel}
Current time: ${timeStr} | Page: ${page}
IMPORTANT: Log ALL food to date ${date}. Do NOT default to today unless ${date} IS today.

GOALS: ${goals?.calories || 1650}cal | ${goals?.protein || 200}gP | ${goals?.carbs || 140}gC | ${goals?.fat || 40}gF
REMAINING: ${remaining.calories}cal | ${remaining.protein}gP | ${remaining.carbs}gC | ${remaining.fat}gF
Water today: ${waterOz || 0} oz / 96-112 oz goal

LOGGED ON ${date} (${todayEntries?.length || 0} entries):
${todayBlock}

${freqStr ? `FREQUENCY (last 7 days): ${freqStr}` : ''}
${libBlock ? `FOOD LIBRARY:\n${libBlock}` : ''}
${recBlock ? `SAVED RECIPES:\n${recBlock}` : ''}

${pageContext}`

    // Known product fast path - no AI call needed
    if (knownProduct) {
      const multiplierMatch = lowerMsg.match(/(\d+)\s*(?:scoop|bottle|bar|packet|serving|mandarin|clementine)/i)
      const multiplier = multiplierMatch ? parseInt(multiplierMatch[1]) : 1
      const cal = Math.round(knownProduct.calories * multiplier)
      const pro = Math.round(knownProduct.protein * multiplier)
      const carb = Math.round(knownProduct.carbs * multiplier)
      const fat = Math.round(knownProduct.fat * multiplier)
      const fib = Math.round(knownProduct.fiber * multiplier)
      const sod = Math.round(knownProduct.sodium * multiplier)
      const servingDesc = multiplier > 1 ? `${multiplier} ${knownProduct.serving.replace('1 ', '')}s` : knownProduct.serving

      // Check if this is a tally addition
      const isTally = lowerMsg.includes('more') || lowerMsg.includes('another') || lowerMsg.includes('again')
      const existingEntry = isTally && todayEntries
        ? todayEntries.find((e: any) => knownProduct.names.some((n: string) => e.name.toLowerCase().includes(n)))
        : null

      if (existingEntry) {
        const displayName = knownProduct.names[0].split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
        const text = `Added ${multiplier} more to your ${existingEntry.name}. Updated total: ${existingEntry.calories + cal}cal, ${existingEntry.protein + pro}gP.

||TALLY||{"name":"${existingEntry.name}","add_calories":${cal},"add_protein":${pro},"add_carbs":${carb},"add_fat":${fat},"add_fiber":${fib},"add_sodium":${sod}}||END||`
        return NextResponse.json({ response: text })
      }

      const displayName = knownProduct.names[0].split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      const text = `Logged ${servingDesc} ${displayName} -- ${cal}cal, ${pro}gP, ${carb}gC, ${fat}gF.${remaining.calories - cal < 300 ? ` Heads up: only ${remaining.calories - cal}cal remaining after this.` : ''}

||LOG||{"name":"${displayName}","serving":"${servingDesc}","calories":${cal},"protein":${pro},"carbs":${carb},"fat":${fat},"fiber":${fib},"sodium":${sod},"category":"${knownProduct.category}"}||END||`
      return NextResponse.json({ response: text })
    }

    // Full AI path
    const messages: any[] = [
      ...(pastMessages || []).slice(-28),
      { role: 'user', content: message }
    ]

    let response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      tools: [{ type: 'web_search_20250305' as any, name: 'web_search' } as any],
      system: SYSTEM_PROMPT + '\n\n' + contextBlock,
      messages,
    })

    // Agentic loop for tool_use
    let attempts = 0
    while (response.stop_reason === 'tool_use' && attempts < 5) {
      attempts++
      const toolBlocks = response.content.filter((b: any) => b.type === 'tool_use')
      const resultBlocks = toolBlocks.map((b: any) => ({
        type: 'tool_result' as const,
        tool_use_id: b.id,
        content: 'Search completed. Provide your answer now.'
      }))

      messages.push({ role: 'assistant', content: response.content })
      messages.push({ role: 'user', content: resultBlocks })

      response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        tools: [{ type: 'web_search_20250305' as any, name: 'web_search' } as any],
        system: SYSTEM_PROMPT + '\n\n' + contextBlock,
        messages,
      })
    }

    // Extract text from response
    let rawText = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('\n')

    // Clean search narration
    rawText = rawText
      .replace(/Let me (search|look|find|check)[\s\S]*?(?=\n\n|\.|$)/gi, '')
      .replace(/I found (solid |good |some )?data[\s\S]*?(?=\n\n|\.|$)/gi, '')
      .replace(/Based on (multiple |my |the )?search[\s\S]*?(?=\n\n|\.|$)/gi, '')
      .replace(/^(Perfect!|Great!|Sure!|Absolutely!)\s*/gm, '')
      .trim()

    return NextResponse.json({ response: rawText })

  } catch (error: any) {
    console.error('Chat API error:', error)
    return NextResponse.json({ response: 'Something went wrong. Try again.' }, { status: 500 })
  }
}
