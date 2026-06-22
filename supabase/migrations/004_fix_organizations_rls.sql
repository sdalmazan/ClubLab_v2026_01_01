-- Migration: Fix Organizations RLS chicken-and-egg selection issue during onboarding
-- Re-creates the SELECT policy to allow users to view organizations they belong to,
-- OR any organization if they don't have any roles assigned yet (e.g. during onboarding).

DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;

CREATE POLICY "Users can view their own organization"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT organization_id 
      FROM public.user_organization_roles 
      WHERE user_id = auth.uid()
    )
    OR
    NOT EXISTS (
      SELECT 1 
      FROM public.user_organization_roles 
      WHERE user_id = auth.uid()
    )
  );
