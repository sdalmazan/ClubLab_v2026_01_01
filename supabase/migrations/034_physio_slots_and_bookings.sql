-- ============================================================
-- Migración 034: Módulo de Fisioterapia — Slots, Reservas y RPC Atómico
-- Proyecto: ClubLab v2026
-- ============================================================

-- 1. TABLA: physio_slots
CREATE TABLE IF NOT EXISTS physio_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  physio_name TEXT NOT NULL DEFAULT 'Fisioterapeuta del Club',
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_capacity INT NOT NULL DEFAULT 1,
  is_cancelled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE physio_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_view_org_physio_slots" ON physio_slots
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "staff_manage_physio_slots" ON physio_slots
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
    )
  );

-- 2. TABLA: physio_bookings
CREATE TABLE IF NOT EXISTS physio_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES physio_slots(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (slot_id, player_id)
);

ALTER TABLE physio_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players_view_own_physio_bookings" ON physio_bookings
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM user_organization_roles WHERE user_id = auth.uid()
    )
  );

-- 3. FUNCION RPC ATOMICA EN POSTGRESQL CONTRA OVERBOOKING Y PARAMETER TAMPERING
CREATE OR REPLACE FUNCTION book_physio_slot(
  p_slot_id UUID,
  p_notes TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_player_id UUID;
  v_org_id UUID;
  v_team_id UUID;
  v_slot physio_slots%ROWTYPE;
  v_current_bookings INT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
  END IF;

  -- 1. Resolver player_id y organization_id a nivel de servidor desde auth.uid()
  SELECT p.id, p.organization_id INTO v_player_id, v_org_id
  FROM players p
  WHERE p.user_id = v_user_id OR p.email = (SELECT email FROM auth.users WHERE id = v_user_id LIMIT 1)
  LIMIT 1;

  IF v_player_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se encontró perfil de jugador asociado a la cuenta');
  END IF;

  -- 2. Bloqueo de fila FOR UPDATE para evitar condiciones de carrera simultáneas
  SELECT * INTO v_slot FROM physio_slots WHERE id = p_slot_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'El turno de fisioterapia no existe');
  END IF;

  IF v_slot.organization_id != v_org_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Acceso no autorizado a esta organización');
  END IF;

  IF v_slot.is_cancelled THEN
    RETURN jsonb_build_object('success', false, 'error', 'Este turno de fisioterapia ha sido cancelado');
  END IF;

  -- 3. Contar reservas confirmadas
  SELECT COUNT(*) INTO v_current_bookings
  FROM physio_bookings
  WHERE slot_id = p_slot_id AND status = 'confirmed';

  IF v_current_bookings >= v_slot.max_capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'El turno ya se encuentra completo');
  END IF;

  -- 4. Inserción / Actualización atómica de reserva
  INSERT INTO physio_bookings (slot_id, player_id, organization_id, team_id, notes, status)
  VALUES (p_slot_id, v_player_id, v_org_id, v_slot.team_id, p_notes, 'confirmed')
  ON CONFLICT (slot_id, player_id) DO UPDATE SET status = 'confirmed', notes = EXCLUDED.notes;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. FUNCION RPC PARA CANCELAR RESERVA PROPIS
CREATE OR REPLACE FUNCTION cancel_physio_booking(
  p_slot_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_player_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Usuario no autenticado');
  END IF;

  SELECT id INTO v_player_id
  FROM players
  WHERE user_id = v_user_id OR email = (SELECT email FROM auth.users WHERE id = v_user_id LIMIT 1)
  LIMIT 1;

  UPDATE physio_bookings
  SET status = 'cancelled'
  WHERE slot_id = p_slot_id AND player_id = v_player_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
