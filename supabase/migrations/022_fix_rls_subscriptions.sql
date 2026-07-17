-- ============================================================
-- ClubLab — Migration 022: Fix RLS on subscriptions
-- Elimina la política que permitía a cualquier usuario autenticado
-- crear suscripciones con cualquier plan (incluyendo planes de pago).
-- La creación de suscripciones se mueve a Server Actions con service_role.
-- ============================================================

-- Drop the open INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create subscriptions" ON subscriptions;

-- Only org admins can UPDATE their own subscription (for cancellations, etc.)
-- Creation is exclusively via service_role (Stripe webhook or Server Action)
CREATE POLICY "Orgs can update their own subscription"
  ON subscriptions FOR UPDATE
  USING (
    organization_id = auth_org_id()
    AND auth_user_role() IN ('club_admin', 'super_admin')
  );
