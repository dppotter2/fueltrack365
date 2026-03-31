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
  category: 'food' | 'drink'
  created_at: string
}

export interface MacroTotals {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
}

export interface MacroGoals {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
}

export const DEFAULT_GOALS: MacroGoals = {
  calories: 1650,
  protein: 200,
  carbs: 140,
  fat: 40,
  fiber: 32,
  sodium: 2000,
}

export interface Recipe {
  id: string
  user_id: string
  name: string
  servings: number
  macros_per_serving: MacroTotals
  ingredients: { name: string; amount: string }[]
  steps: string[]
  cooking_method?: string
  cuisine?: string
  tags?: string[]
  created_at?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ParsedMacros {
  name: string
  serving: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sodium: number
  category: 'food' | 'drink'
}

export interface WeightEntry {
  id: string
  user_id: string
  date: string
  weight: number
  created_at: string
}
