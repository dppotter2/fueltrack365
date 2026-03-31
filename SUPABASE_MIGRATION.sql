-- FuelTrack 365 — Supabase Migration
-- Run this in: https://supabase.com/dashboard/project/laayhugawivxyphystpj/sql/new
-- All tables use Row Level Security. Users can only access their own data.

-- ─── food_entries ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS food_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,  -- YYYY-MM-DD
  meal_slot TEXT DEFAULT 'log',
  name TEXT NOT NULL,
  serving TEXT DEFAULT '1 serving',
  calories NUMERIC DEFAULT 0,
  protein NUMERIC DEFAULT 0,
  carbs NUMERIC DEFAULT 0,
  fat NUMERIC DEFAULT 0,
  fiber NUMERIC DEFAULT 0,
  sodium NUMERIC DEFAULT 0,
  category TEXT DEFAULT 'food',  -- 'food' or 'drink'
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE food_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own food entries" ON food_entries;
CREATE POLICY "Users can manage their own food entries" ON food_entries
  FOR ALL USING (auth.uid() = user_id);

-- ─── food_library ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS food_library (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  serving_size TEXT DEFAULT '1 serving',
  calories NUMERIC DEFAULT 0,
  protein NUMERIC DEFAULT 0,
  carbs NUMERIC DEFAULT 0,
  fat NUMERIC DEFAULT 0,
  fiber NUMERIC DEFAULT 0,
  sodium NUMERIC DEFAULT 0,
  source TEXT DEFAULT 'user',
  times_logged INTEGER DEFAULT 1,
  last_logged TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE food_library ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own food library" ON food_library;
CREATE POLICY "Users can manage their own food library" ON food_library
  FOR ALL USING (auth.uid() = user_id);

-- ─── recipes ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recipes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  servings INTEGER DEFAULT 6,
  macros_per_serving JSONB DEFAULT '{}',
  ingredients JSONB DEFAULT '[]',
  steps JSONB DEFAULT '[]',
  cooking_method TEXT,
  cuisine TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own recipes" ON recipes;
CREATE POLICY "Users can manage their own recipes" ON recipes
  FOR ALL USING (auth.uid() = user_id);

-- ─── chat_messages ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL,  -- 'user' or 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own chat messages" ON chat_messages;
CREATE POLICY "Users can manage their own chat messages" ON chat_messages
  FOR ALL USING (auth.uid() = user_id);

-- Service role can also access (for server-side API writes)
DROP POLICY IF EXISTS "Service role access to chat_messages" ON chat_messages;
CREATE POLICY "Service role access to chat_messages" ON chat_messages
  FOR ALL TO service_role USING (true);

-- ─── weight_log ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS weight_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date TEXT NOT NULL,  -- YYYY-MM-DD
  weight NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE weight_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own weight log" ON weight_log;
CREATE POLICY "Users can manage their own weight log" ON weight_log
  FOR ALL USING (auth.uid() = user_id);

-- ─── profiles (for editable macro goals) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  goals JSONB DEFAULT '{"calories":1650,"protein":200,"carbs":140,"fat":40,"fiber":32,"sodium":2000}',
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own profile" ON profiles;
CREATE POLICY "Users can manage their own profile" ON profiles
  FOR ALL USING (auth.uid() = user_id);

-- ─── Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_food_entries_user_date ON food_entries(user_id, date);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON chat_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weight_log_user_date ON weight_log(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_user ON recipes(user_id);
