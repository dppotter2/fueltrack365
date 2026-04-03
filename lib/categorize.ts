const DRINK_KEYWORDS = [
  'kaged', 'hydration', 'core power', 'fairlife', 'protein shake',
  'coffee', 'tea', 'juice', 'water', 'soda', 'smoothie', 'milk',
  'lemonade', 'horchata', 'salud', 'drink', 'kombucha', 'seltzer'
]

export function categorizeFood(name: string, calories: number, protein: number): 'meal' | 'drink' | 'snack' {
  const lower = name.toLowerCase()
  if (DRINK_KEYWORDS.some(k => lower.includes(k))) return 'drink'
  if (calories >= 300 || protein >= 30) return 'meal'
  return 'snack'
}
