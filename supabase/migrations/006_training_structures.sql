-- ============================================================
-- ClubLab v2026.01.01 — Training Structures
-- Migration: 006_training_structures
-- ============================================================

-- 1. Create session_attendance table
CREATE TABLE IF NOT EXISTS session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present' CHECK (status IN ('present', 'absent', 'injured', 'rest', 'other')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (session_id, player_id)
);

-- Enable RLS on session_attendance
ALTER TABLE session_attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON session_attendance FOR ALL
  USING (organization_id = auth_org_id());

-- Create indexes on session_attendance
CREATE INDEX IF NOT EXISTS idx_session_attendance_session ON session_attendance(session_id);
CREATE INDEX IF NOT EXISTS idx_session_attendance_player ON session_attendance(player_id);


-- 2. Create session_exercises table
CREATE TABLE IF NOT EXISTS session_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES training_sessions(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL DEFAULT 15,
  recovery_min INTEGER NOT NULL DEFAULT 2,
  pitch_zones TEXT[] DEFAULT '{}', -- List of grid tactical coordinates (e.g. ['A1', 'B2'])
  equipment JSONB DEFAULT '[]'::jsonb, -- Array of objects: [{"name": "porterias", "quantity": 2}, {"name": "chinos", "quantity": 15}]
  group_setup JSONB DEFAULT '{}', -- Player divisions: {"groups": [{"name": "Equipo Verde", "players": ["uuid1", ...]}, ...]}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on session_exercises
ALTER TABLE session_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON session_exercises FOR ALL
  USING (organization_id = auth_org_id());

-- Create indexes on session_exercises
CREATE INDEX IF NOT EXISTS idx_session_exercises_session ON session_exercises(session_id);


-- 3. Create template_exercises table
CREATE TABLE IF NOT EXISTS template_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES session_templates(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  duration_min INTEGER NOT NULL DEFAULT 15,
  recovery_min INTEGER NOT NULL DEFAULT 2,
  pitch_zones TEXT[] DEFAULT '{}',
  equipment JSONB DEFAULT '[]'::jsonb,
  group_setup JSONB DEFAULT '{}', -- Default generic setup: {"groups": [{"name": "Grupo A"}, {"name": "Grupo B"}]}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS on template_exercises
ALTER TABLE template_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_isolation" ON template_exercises FOR ALL
  USING (organization_id = auth_org_id());

-- Create indexes on template_exercises
CREATE INDEX IF NOT EXISTS idx_template_exercises_template ON template_exercises(template_id);


-- 4. Create SQL helper to seed default exercises in the library
CREATE OR REPLACE FUNCTION seed_default_exercises(org_id UUID, user_id UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  INSERT INTO exercises (organization_id, created_by, title, description, category, difficulty, is_shared, tags)
  VALUES
    (org_id, user_id, 'Rondo 4v4 + 2 Comodines', 'Rondo de posesión en espacio reducido con 2 comodines interiores. Foco en tercer hombre y velocidad de circulación.', 'Posesión', 'intermediate', true, ARRAY['Rondo', 'Posesión', 'Táctica']),
    (org_id, user_id, 'Rueda de Pase en Y', 'Rueda de pases continua trabajando desmarques de apoyo y ruptura. Control orientado y pase tenso.', 'Técnica', 'beginner', true, ARRAY['Pase', 'Control', 'Calentamiento']),
    (org_id, user_id, 'Partido Aplicado 8v8 con Transición', 'Partido en campo reducido donde el gol tras recuperación rápida vale doble. Foco en repliegue y presión tras pérdida.', 'Táctico', 'advanced', true, ARRAY['Partido', 'Transición', 'Táctica']),
    (org_id, user_id, 'Circuito de Fuerza Explosiva y Velocidad', 'Estaciones de fuerza explosiva (saltos, gomas) seguidas de aceleraciones lineales y cambios de dirección.', 'Físico', 'intermediate', true, ARRAY['Fuerza', 'Velocidad', 'Físico'])
  ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
