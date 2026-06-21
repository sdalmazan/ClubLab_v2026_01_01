-- ============================================================
-- ClubLab v2026.01.01 — Seed Data
-- Migration: 003_seed_plans
-- ============================================================
-- Creates the 4 subscription plans and their features.
-- SD Almazán beta organization is created via onboarding UI.
-- ============================================================

-- ── PLANS ────────────────────────────────────────────────────

INSERT INTO plans (name, slug, description, price_monthly, price_yearly) VALUES
  ('Free',
   'free',
   'Para probar ClubLab. 1 equipo, funcionalidades básicas.',
   0, 0),

  ('Coach Pro',
   'coach_pro',
   'Para un entrenador o equipo. Histórico completo, planificación avanzada, estadísticas.',
   2900, 29000),   -- 29€/mes, 290€/año

  ('Performance',
   'performance',
   'Para cuerpos técnicos. Wellness, cargas, alertas, fisioterapia, tests físicos.',
   7900, 79000),   -- 79€/mes, 790€/año

  ('Academy',
   'academy',
   'Para academias. Múltiples equipos, metodología compartida, visión global.',
   19900, 199000)  -- 199€/mes, 1990€/año

ON CONFLICT (slug) DO NOTHING;

-- ── FEATURES ─────────────────────────────────────────────────

INSERT INTO features (key, name, category) VALUES
  ('unlimited_players',       'Jugadores ilimitados',              'core'),
  ('multiple_teams',          'Múltiples equipos',                 'core'),
  ('full_season_history',     'Histórico completo de temporada',   'core'),
  ('collaborators',           'Colaboradores',                     'core'),
  ('session_templates',       'Plantillas de sesión',              'planning'),
  ('advanced_planning',       'Planificación avanzada',            'planning'),
  ('microcycle_view',         'Vista de microciclo',               'planning'),
  ('shared_library',          'Biblioteca compartida',             'planning'),
  ('wellness_checkin',        'Check-in bienestar',                'performance'),
  ('rpe_tracking',            'Seguimiento RPE',                   'performance'),
  ('load_calculation',        'Cálculo de cargas',                 'performance'),
  ('acwr_monitoring',         'Monitorización ACWR',               'performance'),
  ('performance_alerts',      'Alertas de rendimiento',            'performance'),
  ('configurable_thresholds', 'Umbrales configurables',            'performance'),
  ('injury_tracking',         'Registro de lesiones',              'health'),
  ('rehab_plans',             'Planes de readaptación',            'health'),
  ('physio_access',           'Acceso fisioterapeuta',             'health'),
  ('medical_notes',           'Notas médicas sensibles',           'health'),
  ('physical_tests',          'Tests físicos',                     'tests'),
  ('test_history',            'Histórico de tests',                'tests'),
  ('match_stats',             'Estadísticas de partidos',          'matches'),
  ('season_analytics',        'Analítica de temporada',            'matches'),
  ('federation_import',       'Importar actas federativas',        'matches'),
  ('video_references',        'Referencias de vídeo',              'video'),
  ('video_clips',             'Clips de vídeo',                    'video'),
  ('video_analysis',          'Análisis de vídeo',                 'video'),
  ('academy_dashboard',       'Dashboard de academia',             'academy'),
  ('cross_team_analytics',    'Analítica entre equipos',           'academy'),
  ('methodology_library',     'Biblioteca metodológica',           'academy'),
  ('coordinator_roles',       'Roles de coordinador',              'academy'),
  ('ai_reports',              'Informes con IA',                   'ai'),
  ('ai_planning_assistant',   'Asistente de planificación IA',     'ai'),
  ('admin_panel',             'Panel de administración',           'admin'),
  ('data_export',             'Exportación de datos',              'admin'),
  ('api_access',              'Acceso API',                        'admin')
ON CONFLICT (key) DO NOTHING;
