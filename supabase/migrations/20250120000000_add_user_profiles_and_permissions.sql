-- ============================================
-- Migration: Add user_profiles table and update photo permissions
--
-- Changes:
-- 1. Creates user_profiles table with can_upload permission
-- 2. Auto-creates profile on user signup
-- 3. Updates photos RLS: all users can VIEW, only uploaders can INSERT
-- ============================================

-- ============================================
-- 1. Create user_profiles table
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  can_upload BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

-- Auto-update timestamp trigger (reuse existing function from schema.sql)
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. Auto-create profile on user signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, can_upload)
  VALUES (NEW.id, NEW.email, false);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 3. Backfill profiles for existing users
-- ============================================
INSERT INTO user_profiles (id, email, can_upload)
SELECT id, email, false
FROM auth.users
WHERE id NOT IN (SELECT id FROM user_profiles)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 4. Update photos RLS policies
-- ============================================

-- Helper function to check upload permission
CREATE OR REPLACE FUNCTION user_can_upload()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_profiles
    WHERE id = auth.uid() AND can_upload = true
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- All authenticated users can view ALL photos
DROP POLICY IF EXISTS "Users can view own photos" ON photos;
CREATE POLICY "Authenticated users can view all photos"
  ON photos FOR SELECT
  TO authenticated
  USING (true);

-- Only users with upload permission can insert
DROP POLICY IF EXISTS "Users can insert own photos" ON photos;
CREATE POLICY "Users with upload permission can insert"
  ON photos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND user_can_upload());

-- UPDATE/DELETE policies stay the same (owner only)
-- These already exist from schema.sql:
-- "Users can update own photos" - USING (auth.uid() = user_id)
-- "Users can delete own photos" - USING (auth.uid() = user_id)
