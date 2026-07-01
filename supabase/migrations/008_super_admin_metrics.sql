-- ============================================================
-- ClubLab v2026.01.01 — Super Admin Analytics & Telemetry
-- Migration: 008_super_admin_metrics
-- ============================================================

-- 1. Create page views table
CREATE TABLE IF NOT EXISTS platform_page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  path TEXT NOT NULL,
  viewed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  organization_id UUID
);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_platform_page_views_viewed_at ON platform_page_views(viewed_at);
CREATE INDEX IF NOT EXISTS idx_platform_page_views_user_id ON platform_page_views(user_id);

-- 2. Create feature usage table
CREATE TABLE IF NOT EXISTS platform_feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_name TEXT NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  organization_id UUID
);

CREATE INDEX IF NOT EXISTS idx_platform_feature_usage_used_at ON platform_feature_usage(used_at);

-- 3. Create online users snapshots table
CREATE TABLE IF NOT EXISTS platform_online_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  online_count INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_platform_online_users_checked_at ON platform_online_users(checked_at);

-- 4. Create daily usage aggregation table
CREATE TABLE IF NOT EXISTS platform_daily_usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE UNIQUE NOT NULL,
  active_users INTEGER NOT NULL DEFAULT 0,
  total_page_views INTEGER NOT NULL DEFAULT 0,
  most_viewed_screen TEXT,
  least_viewed_screen TEXT,
  most_used_feature TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_daily_usage_stats_date ON platform_daily_usage_stats(date);
