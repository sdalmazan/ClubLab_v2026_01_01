-- ============================================================
-- ClubLab — Migration 023: Create profiles table
-- Reemplaza los JOIN directos a auth.users para evitar exposicion
-- de datos personales. Se sincroniza via trigger en cada signup.
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT        NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users in the same organization can view each other's profiles
CREATE POLICY "Users can view profiles in their org"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT user_id
      FROM user_organization_roles
      WHERE organization_id = auth_org_id()
    )
    OR id = auth.uid() -- can always see own profile
  );

-- Users can update their own profile only
CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Trigger to sync profile data on auth.users insert/update
CREATE OR REPLACE FUNCTION sync_profile_on_auth_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_sync_profile
  AFTER INSERT OR UPDATE OF email, raw_user_meta_data
  ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_profile_on_auth_change();

-- Backfill existing users
INSERT INTO profiles (id, email, full_name, avatar_url)
SELECT
  id,
  email,
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url'
FROM auth.users
ON CONFLICT (id) DO NOTHING;