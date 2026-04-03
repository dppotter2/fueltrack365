-- FuelTrack 365 v2.0 Migration
-- Safe to run multiple times (IF NOT EXISTS everywhere)

-- Water tracking
CREATE TABLE IF NOT EXISTS water_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount_oz INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_water_user_date ON water_entries(user_id, date);
ALTER TABLE water_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own water" ON water_entries;
CREATE POLICY "Users manage own water" ON water_entries FOR ALL USING (auth.uid() = user_id);

-- Weight tracking
CREATE TABLE IF NOT EXISTS weight_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight DECIMAL(5,1) NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_weight_user_date ON weight_entries(user_id, date);
ALTER TABLE weight_entries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own weight" ON weight_entries;
CREATE POLICY "Users manage own weight" ON weight_entries FOR ALL USING (auth.uid() = user_id);

-- User goals (editable macro targets)
CREATE TABLE IF NOT EXISTS user_goals (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id),
  calories INTEGER DEFAULT 1650,
  protein INTEGER DEFAULT 200,
  carbs INTEGER DEFAULT 140,
  fat INTEGER DEFAULT 40,
  fiber INTEGER DEFAULT 33,
  sodium INTEGER DEFAULT 2000,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE user_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own goals" ON user_goals;
CREATE POLICY "Users manage own goals" ON user_goals FOR ALL USING (auth.uid() = user_id);

-- Profile change log
CREATE TABLE IF NOT EXISTS profile_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT NOT NULL,
  new_value TEXT NOT NULL,
  reason TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_changes_user ON profile_changes(user_id, created_at DESC);
ALTER TABLE profile_changes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own changes" ON profile_changes;
CREATE POLICY "Users manage own changes" ON profile_changes FOR ALL USING (auth.uid() = user_id);

-- Food library (saved foods for quick access)
CREATE TABLE IF NOT EXISTS food_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  serving_size TEXT DEFAULT '',
  calories INTEGER DEFAULT 0,
  protein INTEGER DEFAULT 0,
  carbs INTEGER DEFAULT 0,
  fat INTEGER DEFAULT 0,
  fiber INTEGER DEFAULT 0,
  sodium INTEGER DEFAULT 0,
  times_logged INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_library_user ON food_library(user_id, times_logged DESC);
ALTER TABLE food_library ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own library" ON food_library;
CREATE POLICY "Users manage own library" ON food_library FOR ALL USING (auth.uid() = user_id);

-- Chat messages (conversation history)
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chat_user ON chat_messages(user_id, created_at DESC);
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own chat" ON chat_messages;
CREATE POLICY "Users manage own chat" ON chat_messages FOR ALL USING (auth.uid() = user_id);

-- Ensure food_entries has category column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'food_entries' AND column_name = 'category') THEN
    ALTER TABLE food_entries ADD COLUMN category TEXT DEFAULT 'snack';
  END IF;
END $$;

-- Ensure recipes table has all needed columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'fiber_per_serving') THEN
    ALTER TABLE recipes ADD COLUMN fiber_per_serving INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'sodium_per_serving') THEN
    ALTER TABLE recipes ADD COLUMN sodium_per_serving INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'tags') THEN
    ALTER TABLE recipes ADD COLUMN tags TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'protein_type') THEN
    ALTER TABLE recipes ADD COLUMN protein_type TEXT DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'recipes' AND column_name = 'carb_type') THEN
    ALTER TABLE recipes ADD COLUMN carb_type TEXT DEFAULT '';
  END IF;
END $$;

-- Materialized daily totals view for performance
CREATE OR REPLACE VIEW daily_totals AS
SELECT
  user_id,
  date,
  SUM(calories) as total_calories,
  SUM(protein) as total_protein,
  SUM(carbs) as total_carbs,
  SUM(fat) as total_fat,
  SUM(fiber) as total_fiber,
  SUM(sodium) as total_sodium,
  COUNT(*) as entry_count
FROM food_entries
GROUP BY user_id, date;
