-- ============================================================
-- ClubLab — Migration 021: Fix RLS on organizations
-- Elimina la cláusula NOT EXISTS que permitía a usuarios sin rol
-- ver todas las organizaciones durante el onboarding.
-- ============================================================

-- Drop the permissive policy
DROP POLICY IF EXISTS "Users can view their own organization" ON organizations;

-- Corrected policy: only users with an assigned role can see their org
CREATE POLICY "Users can view their own organization"
  ON organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id
      FROM user_organization_roles
      WHERE user_id = auth.uid()
    )
  );
