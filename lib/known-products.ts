export interface KnownProduct {
  name: string
  serving: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
  category: 'food' | 'drink'
  aliases: string[]
}

export const KNOWN_PRODUCTS: KnownProduct[] = [
  {
    name: 'Core Power Elite Chocolate (14 fl oz)',
    serving: '14 fl oz bottle',
    calories: 230, protein: 42, carbs: 9, fat: 8, fiber: 0, sodium: 270,
    category: 'drink',
    aliases: ['core power', 'core power elite', 'protein shake', 'chocolate shake', 'my shake', 'my protein shake', 'chocolate core power'],
  },
  {
    name: 'Core Power Elite Vanilla (14 fl oz)',
    serving: '14 fl oz bottle',
    calories: 230, protein: 42, carbs: 9, fat: 8, fiber: 0, sodium: 270,
    category: 'drink',
    aliases: ['vanilla core power', 'vanilla shake', 'vanilla protein shake'],
  },
  {
    name: 'Kaged Hydration Sugar Free (1 scoop)',
    serving: '1 scoop',
    calories: 5, protein: 0, carbs: 1, fat: 0, fiber: 0, sodium: 105,
    category: 'drink',
    aliases: ['kaged', 'kaged hydration', 'my kaged', 'strawberry kaged', 'kaged drink', 'kaged electrolyte'],
  },
  {
    name: 'Taste Salud Horchata Packet',
    serving: '1 packet',
    calories: 10, protein: 0, carbs: 3, fat: 0, fiber: 0, sodium: 130,
    category: 'drink',
    aliases: ['horchata', 'taste salud', 'horchata packet', 'salud horchata'],
  },
  {
    name: 'Quest Bar',
    serving: '1 bar (60g)',
    calories: 190, protein: 21, carbs: 21, fat: 7, fiber: 14, sodium: 260,
    category: 'food',
    aliases: ['quest bar', 'quest protein bar', 'quest'],
  },
  {
    name: 'Quest Crispy Chocolate Brownie Bar',
    serving: '1 bar (58g)',
    calories: 190, protein: 15, carbs: 26, fat: 6, fiber: 9, sodium: 230,
    category: 'food',
    aliases: ['quest crispy', 'quest crispy brownie', 'quest crispy chocolate brownie'],
  },
  {
    name: 'Quest Overload Chocolate Explosion Bar',
    serving: '1 bar (65g)',
    calories: 230, protein: 20, carbs: 27, fat: 9, fiber: 10, sodium: 170,
    category: 'food',
    aliases: ['quest overload', 'quest chocolate explosion', 'quest overload choc'],
  },
  {
    name: 'Barebells Cookie Dough Bar',
    serving: '1 bar (55g)',
    calories: 200, protein: 20, carbs: 18, fat: 7, fiber: 3, sodium: 170,
    category: 'food',
    aliases: ['barebells', 'barebells cookie dough', 'cookie dough bar'],
  },
  {
    name: 'Halo Mandarin (Clementine)',
    serving: '1 fruit (~74g)',
    calories: 35, protein: 1, carbs: 9, fat: 0, fiber: 1, sodium: 1,
    category: 'food',
    aliases: ['clementine', 'halo', 'halo mandarin', 'mandarin', 'clementines', 'halos'],
  },
]

export function findKnownProduct(query: string): KnownProduct | null {
  const q = query.toLowerCase().trim()
  for (const product of KNOWN_PRODUCTS) {
    if (product.aliases.some(alias => q.includes(alias) || alias.includes(q))) {
      return product
    }
  }
  return null
}
