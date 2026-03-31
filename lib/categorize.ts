const DRINK_KEYWORDS = [
  'drink', 'beverage', 'juice', 'smoothie', 'shake', 'hydration',
  'electrolyte', 'kaged', 'core power', 'horchata', 'coffee', 'latte',
  'espresso', 'tea', 'water', 'milk', 'soda', 'sparkling', 'broth',
]

// NOTE: kombucha is NOT in this list — it's a food, not a drink

export function categorizeFood(
  name: string,
  calories: number,
  protein: number
): 'food' | 'drink' {
  const lower = name.toLowerCase()
  if (DRINK_KEYWORDS.some(kw => lower.includes(kw))) return 'drink'
  return 'food'
}
