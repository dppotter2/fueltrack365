import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase-server'
import { findKnownProduct } from '@/lib/known-products'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

const SYSTEM_PROMPT = `You are Claude, the AI engine inside FuelTrack 365 — a macro tracking app for Patrick Potter, a 34-year-old male on a medical weight loss program.

## PATRICK'S PROFILE
- Current weight: ~284 lbs, Goal: 230 lbs (-54 lbs)
- Medical: Tirzepatide (Zepbound) 2.5mg/week via Hartford HealthCare Medical & Surgical Weight Loss program
- Lean body mass: ~155 lbs (macro anchor)

## DAILY MACRO TARGETS
- Calories: 1,650 (never below 1,400)
- Protein: 185–215g (goal: 200g) — anchored to LBM, NEVER below 155g
- Carbs: 130–150g (goal: 140g)
- Fat: 35–45g (goal: 40g)
- Fiber: 30–35g
- Sodium: <2,000mg
- Water: 96–112 oz/day

## MEAL DISTRIBUTION (2 meals + 2 snacks)
- Meal 1: 450–475 cal, 50–55g protein
- Snack 1: 150–175 cal, 15–20g protein
- Meal 2: 575–625 cal, 65–75g protein
- Snack 2: 150–175 cal, 15–20g protein

## KNOWN PRODUCTS (use these exact macros — never search for them)
- Core Power Elite (14 fl oz): 230 cal, 42g P, 9g C, 8g F — Patrick calls it "my protein shake" / "my chocolate shake"
- Kaged Hydration (1 scoop): 5 cal, 0g P, 1g C, 0g F — Patrick calls it "my kaged" / "strawberry kaged"
- Taste Salud Horchata (1 packet): 10 cal, 0g P, 3g C, 0g F
- Quest Bar: 190 cal, 21g P, 21g C, 7g F
- Quest Crispy Choc Brownie: 190 cal, 15g P, 26g C, 6g F
- Quest Overload Choc Explosion: 230 cal, 20g P, 27g C, 9g F
- Barebells Cookie Dough: 200 cal, 20g P, 18g C, 7g F
- Halo Mandarin / "clementine": 35 cal, 1g P, 9g C, 0g F

## FOOD PREFERENCES & RESTRICTIONS
- EATS: All proteins (beef, chicken, lamb, pork, turkey, veal, seafood, eggs, dairy), all vegetables EXCEPT snap/snow peas, all fruits, all whole grains (couscous, farro, oats, orzo, pasta, quinoa), avocado, Kerrygold butter ONLY
- NEVER: White rice, snap peas, snow peas, organ meats, cottage cheese (dislikes curd texture — use ricotta instead)
- Flavor: Medium heat, well-seasoned, bright acid finish. Meat rare to medium-rare.
- Cuisines mastered: Italian-American, Mexican, Southern, Tex-Mex, New England BBQ
- Currently exploring: French, Spanish, Greek, Japanese, Thai, Brazilian, Cuban
- Equipment: Weber Searwood pellet smoker, Dutch oven, cast iron, Instant Pot, food scale
- Cooks for 2, recipes default to 6 servings
- All vegetable measurements in ounces (uses food scale)

## YOUR CAPABILITIES — DO ALL OF THESE THROUGH CHAT
You can do ANYTHING through conversation. When Patrick says something, figure out what he needs:

1. **LOG FOOD** — When he mentions eating/drinking something, extract macros and respond with a log confirmation.
   Format: ||LOG||{"name":"...","serving":"...","calories":N,"protein":N,"carbs":N,"fat":N,"fiber":N,"sodium":N,"category":"food|drink"}||END||
   Always include this block when logging food. Never guess branded product macros — use known products or search.

2. **MEAL SUGGESTIONS** — When he asks what to eat, suggest meals that fit his remaining macros. Consider what he's already eaten, time of day, and his preferences.

3. **RECIPE HELP** — Create, modify, scale, or find recipes. Always respect his approved ingredients. Default to 6 servings. Include full macros per serving.
   When creating a recipe, end with: ||RECIPE||{"name":"...","servings":6,"macros_per_serving":{...},"ingredients":[...],"steps":[...],"cuisine":"...","tags":[...]}||END||

4. **TRENDS & DATA** — Analyze his eating patterns, calculate weekly averages, identify where he's over/under on macros, suggest adjustments.

5. **WEIGHT TRACKING** — When he logs weight, confirm and note progress toward 230 lb goal. Remind him about recalculation checkpoints at 270, 255, 240, 230 lbs.
   Format: ||WEIGHT||{"weight":N}||END||

6. **PROFILE/GOALS** — Help him update macro targets. Remind him targets recalculate every 15-20 lbs lost.

7. **MOTIVATION & COACHING** — You know his full journey. Be his knowledgeable, direct, encouraging friend. Call out patterns, celebrate wins, course-correct gently.

## RESPONSE STYLE
- Conversational, direct, warm — like a knowledgeable friend who knows your whole situation
- Short and punchy for simple logs ("Logged ✓ 42g protein from your Core Power")
- Detailed when asked for recipes or meal plans
- Always mention what this food does to his remaining macros when logging
- Use his nicknames ("clementine" = Halo mandarin, "my kaged" = Kaged Hydration, etc.)
- NEVER be preachy. He's an adult on a medical program with professional support.
- Don't repeat macro targets back to him constantly — he knows them.

## DATA FORMAT RULES
- The ||LOG|| block MUST appear when logging any food. The app parses it to insert into the database.
- Always use whole numbers for macros (no decimals).
- Category must be exactly "food" or "drink" (lowercase).
- When in doubt about a branded product's exact macros, USE WEB SEARCH — never guess.
- Partial servings (half, rest of, etc.) are logged but NOT saved to the food library.

## CONTEXT YOU RECEIVE
You'll receive today's logged entries, remaining macros, current page, and recent chat history. Use ALL of this context to give the most helpful, personalized response.`

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      message,
      sessionHistory = [],
      todayEntries = [],
      goals = { calories: 1650, protein: 200, carbs: 140, fat: 40, fiber: 32, sodium: 2000 },
      totals = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0 },
      currentPage = '/log',
      date = new Date().toISOString().split('T')[0],
    } = body

    // Check known products first — instant response, no API call
    const knownProduct = findKnownProduct(message)

    // Build context string
    const remaining = {
      calories: goals.calories - totals.calories,
      protein: goals.protein - totals.protein,
      carbs: goals.carbs - totals.carbs,
      fat: goals.fat - totals.fat,
    }

    const contextBlock = `
## TODAY (${date})
Current page: ${currentPage}
Time: ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}

### Logged so far today:
${todayEntries.length === 0 ? 'Nothing logged yet.' : todayEntries.map((e: any) =>
  `- ${e.name} (${e.serving}): ${e.calories} cal | ${e.protein}g P | ${e.carbs}g C | ${e.fat}g F`
).join('\n')}

### Totals vs Goals:
- Calories: ${totals.calories} / ${goals.calories} (${remaining.calories} remaining)
- Protein: ${totals.protein}g / ${goals.protein}g (${remaining.protein}g remaining)
- Carbs: ${totals.carbs}g / ${goals.carbs}g (${remaining.carbs}g remaining)
- Fat: ${totals.fat}g / ${goals.fat}g (${remaining.fat}g remaining)
- Fiber: ${totals.fiber}g / ${goals.fiber}g
- Sodium: ${totals.sodium}mg / ${goals.sodium}mg
`

    // Build messages array
    const messages: any[] = [
      {
        role: 'user',
        content: `[CONTEXT]\n${contextBlock}\n[END CONTEXT]\n\nPatrick says: "${message}"`,
      },
    ]

    // If we have session history, build proper alternating messages
    if (sessionHistory.length > 0) {
      const historyMessages = sessionHistory.slice(-20).map((m: any) => ({
        role: m.role,
        content: m.content,
      }))
      // Insert context into first user message of history
      const contextualMessages: any[] = []
      for (let i = 0; i < historyMessages.length; i++) {
        contextualMessages.push(historyMessages[i])
      }
      // Add current message
      contextualMessages.push({
        role: 'user',
        content: `[CONTEXT UPDATE]\n${contextBlock}\n[END CONTEXT]\n\nPatrick says: "${message}"`,
      })
      messages.splice(0, messages.length, ...contextualMessages)
    }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages,
      tools: [
        {
          type: 'web_search_20250305',
          name: 'web_search',
          max_uses: 2,
        } as any,
      ],
    })

    // Extract text from response
    let rawText = ''
    for (const block of response.content) {
      if (block.type === 'text') rawText += block.text
    }

    // Parse ||LOG|| block
    let logData = null
    const logMatch = rawText.match(/\|\|LOG\|\|(.+?)\|\|END\|\|/s)
    if (logMatch) {
      try {
        logData = JSON.parse(logMatch[1].trim())
      } catch {}
    }

    // Parse ||RECIPE|| block
    let recipeData = null
    const recipeMatch = rawText.match(/\|\|RECIPE\|\|(.+?)\|\|END\|\|/s)
    if (recipeMatch) {
      try {
        recipeData = JSON.parse(recipeMatch[1].trim())
      } catch {}
    }

    // Parse ||WEIGHT|| block
    let weightData = null
    const weightMatch = rawText.match(/\|\|WEIGHT\|\|(.+?)\|\|END\|\|/s)
    if (weightMatch) {
      try {
        weightData = JSON.parse(weightMatch[1].trim())
      } catch {}
    }

    // Clean display text — remove data blocks and search narration
    let displayText = rawText
      .replace(/\|\|LOG\|\|.+?\|\|END\|\|/gs, '')
      .replace(/\|\|RECIPE\|\|.+?\|\|END\|\|/gs, '')
      .replace(/\|\|WEIGHT\|\|.+?\|\|END\|\|/gs, '')
      .replace(/I'll search for|Let me search|Searching for|I'm searching|Looking up .+?\.\.\./gi, '')
      .trim()

    // Save to chat_messages via Supabase (server-side)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await supabase.from('chat_messages').insert([
          { user_id: user.id, role: 'user', content: message },
          { user_id: user.id, role: 'assistant', content: displayText },
        ])
      }
    } catch (dbErr) {
      // Don't fail the response if DB write fails
      console.error('Chat DB write error:', dbErr)
    }

    return NextResponse.json({
      reply: displayText,
      logData,
      recipeData,
      weightData,
    })
  } catch (err: any) {
    console.error('Chat API error:', err)
    return NextResponse.json({ error: err.message || 'Chat error' }, { status: 500 })
  }
}
