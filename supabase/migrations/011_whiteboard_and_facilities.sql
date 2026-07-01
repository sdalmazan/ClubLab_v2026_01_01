-- ============================================================
-- ClubLab v2026.01.01 — Whiteboard & Facilities
-- Migration: 011_whiteboard_and_facilities.sql
-- ============================================================

-- Add whiteboard and space dimensions to session_exercises
ALTER TABLE session_exercises
  ADD COLUMN IF NOT EXISTS whiteboard_data JSONB, -- {strokes: [], shapes: [], texts: [], dimensions: ''}
  ADD COLUMN IF NOT EXISTS whiteboard_zone TEXT, -- 'full_field' | 'half_field' | 'defensive_third' | 'offensive_third' | 'penalty_area' | 'custom_area'
  ADD COLUMN IF NOT EXISTS space_dimensions TEXT, -- e.g. '30x20m',
  ADD COLUMN IF NOT EXISTS facility_id UUID;

-- Add whiteboard to template_exercises
ALTER TABLE template_exercises
  ADD COLUMN IF NOT EXISTS whiteboard_data JSONB,
  ADD COLUMN IF NOT EXISTS whiteboard_zone TEXT,
  ADD COLUMN IF NOT EXISTS space_dimensions TEXT,
  ADD COLUMN IF NOT EXISTS field_zone TEXT; -- optional placement zone for templates

-- Create facilities table
CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'field' CHECK (type IN ('field', 'gym', 'room', 'pool', 'other')),
  surface TEXT, -- 'natural_grass' | 'artificial' | 'indoor' | 'parquet'
  capacity INTEGER,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org_isolation" ON facilities FOR ALL USING (organization_id = auth_org_id());
CREATE INDEX IF NOT EXISTS idx_facilities_org ON facilities(organization_id);
