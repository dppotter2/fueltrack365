export interface FoodEntry {
  id: string
  user_id: string
  date: string
  name: string
  serving: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
  category: 'meal' | 'drink' | 'snack'
  created_at: string
}

export interface DailyGoals {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
}

export interface MacroTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
}

export interface Recipe {
  id: string
  user_id: string
  name: string
  servings: number
  calories_per_serving: number
  protein_per_serving: number
  carbs_per_serving: number
  fat_per_serving: number
  fiber_per_serving: number
  sodium_per_serving: number
  ingredients: string
  instructions: string
  cooking_method: string
  cuisine: string
  protein_type: string
  carb_type: string
  tags: string
  created_at: string
}

export interface WaterEntry {
  id: string
  user_id: string
  date: string
  amount_oz: number
  created_at: string
}

export interface WeightEntry {
  id: string
  user_id: string
  date: string
  weight: number
  notes: string
  created_at: string
}

export interface ProfileChange {
  id: string
  user_id: string
  field: string
  old_value: string
  new_value: string
  reason: string
  created_at: string
}

export interface ChatMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}
