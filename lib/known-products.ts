export interface KnownProduct {
  names: string[]
  serving: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
  category: 'meal' | 'drink' | 'snack'
}

export const KNOWN_PRODUCTS: KnownProduct[] = [
  {
    names: ['fairlife core power elite', 'core power elite', 'core power', 'fairlife', 'protein shake'],
    serving: '1 bottle (14 fl oz)',
    calories: 230, protein: 42, carbs: 9, fat: 8, fiber: 0, sodium: 270,
    category: 'drink'
  },
  {
    names: ['kaged hydration', 'kaged', 'kaged strawberry', 'kaged lemonade', 'kaged sugar free', 'hydration'],
    serving: '1 scoop',
    calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 0, sodium: 105,
    category: 'drink'
  },
  {
    names: ['taste salud horchata', 'salud horchata', 'horchata packet', 'horchata'],
    serving: '1 packet',
    calories: 10, protein: 0, carbs: 3, fat: 0, fiber: 0, sodium: 130,
    category: 'drink'
  },
  {
    names: ['quest bar', 'quest protein bar'],
    serving: '1 bar',
    calories: 200, protein: 21, carbs: 22, fat: 8, fiber: 14, sodium: 280,
    category: 'snack'
  },
  {
    names: ['quest crispy', 'quest crispy bar'],
    serving: '1 bar',
    calories: 240, protein: 20, carbs: 26, fat: 10, fiber: 2, sodium: 250,
    category: 'snack'
  },
  {
    names: ['barebells cookie dough', 'barebells', 'barebells bar'],
    serving: '1 bar',
    calories: 210, protein: 20, carbs: 18, fat: 9, fiber: 3, sodium: 150,
    category: 'snack'
  },
  {
    names: ['halo mandarin', 'halo mandarins', 'clementine', 'clementines', 'mandarin', 'mandarins'],
    serving: '2 mandarins',
    calories: 80, protein: 1, carbs: 18, fat: 0, fiber: 3, sodium: 0,
    category: 'snack'
  },
  {
    names: ['taste flavor co korean bbq', 'korean bbq sauce'],
    serving: '1 tbsp', calories: 10, protein: 0, carbs: 2, fat: 0, fiber: 0, sodium: 180,
    category: 'meal'
  },
  {
    names: ['taste flavor co chipotle ranch', 'chipotle ranch'],
    serving: '1 tbsp', calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 0, sodium: 160,
    category: 'meal'
  },
  {
    names: ['taste flavor co garlic parm', 'garlic parm sauce'],
    serving: '1 tbsp', calories: 10, protein: 0, carbs: 2, fat: 0, fiber: 0, sodium: 170,
    category: 'meal'
  },
  {
    names: ['taste flavor co buffalo', 'buffalo sauce'],
    serving: '1 tbsp', calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 0, sodium: 200,
    category: 'meal'
  },
  {
    names: ['taste flavor co teriyaki', 'teriyaki sauce'],
    serving: '1 tbsp', calories: 15, protein: 0, carbs: 3, fat: 0, fiber: 0, sodium: 190,
    category: 'meal'
  },
  {
    names: ['taste flavor co honey mustard', 'honey mustard sauce'],
    serving: '1 tbsp', calories: 10, protein: 0, carbs: 2, fat: 0, fiber: 0, sodium: 150,
    category: 'meal'
  },
  {
    names: ['taste flavor co sweet chili', 'sweet chili sauce'],
    serving: '1 tbsp', calories: 15, protein: 0, carbs: 3, fat: 0, fiber: 0, sodium: 160,
    category: 'meal'
  },
  {
    names: ['a taste of thai rice noodles', 'rice noodles linguine', 'thai rice noodles'],
    serving: '2 oz dry',
    calories: 190, protein: 4, carbs: 45, fat: 0, fiber: 0, sodium: 30,
    category: 'meal'
  },
]

export function findKnownProduct(query: string): KnownProduct | null {
  const q = query.toLowerCase().trim()
  for (const p of KNOWN_PRODUCTS) {
    for (const name of p.names) {
      if (q.includes(name) || name.includes(q)) return p
    }
  }
  return null
}
