-- ============================================================
-- Statistics DB — Schema v1
-- Proyecto: ClubLab v2026 — Statistics_DB (Supabase Federation Project)
-- Propósito: Actas de partidos de la RFCYLF para análisis avanzado
--            de influencia de jugadores, rendimiento por equipo, etc.
--
-- EJECUTAR EN: Supabase Federation Project (Statistics_DB)
--   URL: https://kifqwsqvwooteqszkhwn.supabase.co
--
-- Cobertura inicial: Tercera RFEF — Grupo 8 — Castilla y León
-- Objetivo: 10+ temporadas, múltiples comunidades autónomas
-- ============================================================

-- Extensiones necesarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- búsqueda difusa de nombres

-- ============================================================
-- 1. PARTIDOS — stat_matches
-- Una fila por partido scrapeado de un acta oficial
-- ============================================================
CREATE TABLE IF NOT EXISTS stat_matches (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificador de la federación (CodActa de rfcylf.es)
  federation_id     TEXT        NOT NULL UNIQUE,

  -- Metadatos de competición
  competition       TEXT        NOT NULL,   -- "Tercera Federación - Grupo 8"
  competition_code  TEXT,                   -- código interno federación (ej. 22911126)
  group_code        TEXT,                   -- código de grupo (ej. 22911127)
  season            TEXT        NOT NULL,   -- "2025/2026"
  matchday          INTEGER,                -- número de jornada

  -- Datos del partido
  match_date        DATE,
  venue             TEXT,                   -- estadio / campo

  -- Equipos y resultado
  home_team         TEXT        NOT NULL,
  away_team         TEXT        NOT NULL,
  home_score        INTEGER     NOT NULL DEFAULT 0,
  away_score        INTEGER     NOT NULL DEFAULT 0,
  home_score_ht     INTEGER,               -- marcador al descanso (local)
  away_score_ht     INTEGER,               -- marcador al descanso (visitante)

  -- Referencia a la página de jornada (para re-scraping si hace falta)
  matchday_url      TEXT,

  -- Control de scraping
  scraped_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_text_hash     TEXT,                  -- hash del texto del PDF para detectar cambios

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE stat_matches IS
  'Partidos scrapeados de actas oficiales de la RFCYLF. Una fila por acta.';
COMMENT ON COLUMN stat_matches.home_score_ht IS
  'Marcador del equipo local al descanso (minuto 45). NULL si no está en el acta.';
COMMENT ON COLUMN stat_matches.federation_id IS
  'CodActa de rfcylf.es — identificador único del acta en la federación.';

-- ============================================================
-- 2. ALINEACIONES — stat_lineups
-- Una fila por jugador por partido
-- ============================================================
CREATE TABLE IF NOT EXISTS stat_lineups (
  id                    UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id              UUID    NOT NULL REFERENCES stat_matches(id) ON DELETE CASCADE,

  -- Equipo y jugador
  team_name             TEXT    NOT NULL,
  player_name           TEXT    NOT NULL,   -- nombre tal como aparece en el acta
  player_name_normalized TEXT   GENERATED ALWAYS AS (
    lower(regexp_replace(player_name, '[^a-zA-ZáéíóúÁÉÍÓÚñÑüÜ ]', '', 'g'))
  ) STORED,                                 -- para búsqueda difusa

  -- Referencia opcional al Main DB (solo para jugadores del club propio)
  main_db_player_id     UUID,              -- UUID del jugador en la Main DB (nullable)

  -- Datos de la alineación
  shirt_number          INTEGER,
  is_starter            BOOLEAN NOT NULL DEFAULT FALSE,
  position              TEXT,              -- portero, defensa, centrocampista, delantero

  -- Minutos en campo — clave para análisis de influencia
  substituted_in_min    INTEGER NOT NULL DEFAULT 0,    -- 0 si titular desde el inicio
  substituted_out_min   INTEGER NOT NULL DEFAULT 90,   -- 90 si no es sustituido

  -- Minutos efectivos en campo (calculado)
  minutes_on            INTEGER GENERATED ALWAYS AS (
    GREATEST(0, substituted_out_min - substituted_in_min)
  ) STORED,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (match_id, team_name, shirt_number),
  UNIQUE (match_id, team_name, player_name)
);

COMMENT ON TABLE stat_lineups IS
  'Participación de cada jugador en cada partido. Incluye minutos de entrada/salida '
  'para calcular exactamente cuándo estaba en el campo.';
COMMENT ON COLUMN stat_lineups.substituted_in_min IS
  'Minuto en que entró al campo. 0 para titulares. Para suplentes, el minuto real de entrada.';
COMMENT ON COLUMN stat_lineups.substituted_out_min IS
  'Minuto en que salió del campo. 90 si jugó hasta el final. Para expulsados, el minuto de la roja.';
COMMENT ON COLUMN stat_lineups.minutes_on IS
  'Minutos totales jugados, calculado automáticamente como (substituted_out_min - substituted_in_min).';

-- ============================================================
-- 3. EVENTOS — stat_events
-- Una fila por evento: gol, tarjeta, sustitución
-- ============================================================
CREATE TABLE IF NOT EXISTS stat_events (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id          UUID    NOT NULL REFERENCES stat_matches(id) ON DELETE CASCADE,

  -- Tipo de evento
  event_type        TEXT    NOT NULL CHECK (event_type IN (
    'goal',           -- gol normal
    'own_goal',       -- gol en propia
    'penalty_goal',   -- gol de penalti
    'yellow_card',    -- tarjeta amarilla
    'yellow_red_card',-- doble amarilla = roja
    'red_card',       -- tarjeta roja directa
    'substitution_in', -- jugador que entra
    'substitution_out' -- jugador que sale
  )),

  -- Quién y para quién
  team_name         TEXT    NOT NULL,
  player_name       TEXT    NOT NULL,
  main_db_player_id UUID,                 -- nullable, solo si hay match

  -- Cuándo
  minute            INTEGER NOT NULL,
  extra_time        INTEGER NOT NULL DEFAULT 0,  -- minutos de descuento (ej. 90+3 → minute=90, extra_time=3)

  -- Descripción extra (ej. para sustituciones: "entra por NOMBRE APELLIDO")
  detail            TEXT,

  -- Marcador TRAS este evento (solo para goles)
  score_home_after  INTEGER,
  score_away_after  INTEGER,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE stat_events IS
  'Eventos minuto a minuto del partido: goles, tarjetas, sustituciones. '
  'Los campos score_home_after/score_away_after permiten reconstruir el timeline de marcadores.';

-- ============================================================
-- 4. TIMELINE DE MARCADORES — stat_score_timeline
-- Marcador exacto en cada minuto (calculado al guardar)
-- Permite saber "qué marcador había cuando X entró al campo"
-- ============================================================
CREATE TABLE IF NOT EXISTS stat_score_timeline (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id    UUID    NOT NULL REFERENCES stat_matches(id) ON DELETE CASCADE,
  minute      INTEGER NOT NULL,
  home_score  INTEGER NOT NULL DEFAULT 0,
  away_score  INTEGER NOT NULL DEFAULT 0,

  UNIQUE (match_id, minute)
);

COMMENT ON TABLE stat_score_timeline IS
  'Marcador en cada minuto del partido. Calculado a partir de stat_events durante el scraping. '
  'Permite preguntar: "¿cuál era el marcador cuando el jugador X entró?", '
  '"¿cuántos goles se marcaron mientras X estaba en campo?"';

-- ============================================================
-- 5. INFLUENCIA POR JUGADOR Y PARTIDO — stat_player_match_influence
-- Pre-calculada al guardar cada acta para consultas rápidas
-- Esta es la tabla clave para el análisis de rendimiento
-- ============================================================
CREATE TABLE IF NOT EXISTS stat_player_match_influence (
  id                      UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id                UUID    NOT NULL REFERENCES stat_matches(id) ON DELETE CASCADE,
  lineup_id               UUID    NOT NULL REFERENCES stat_lineups(id) ON DELETE CASCADE,

  -- Identificación
  player_name             TEXT    NOT NULL,
  main_db_player_id       UUID,
  team_name               TEXT    NOT NULL,
  season                  TEXT    NOT NULL,   -- desnormalizado para queries más rápidas
  match_date              DATE,               -- desnormalizado

  -- Participación
  is_starter              BOOLEAN NOT NULL,
  minutes_on              INTEGER NOT NULL,
  substituted_in_min      INTEGER NOT NULL,
  substituted_out_min     INTEGER NOT NULL,

  -- Marcador cuando entró / salió (para análisis de impacto)
  score_home_at_entry     INTEGER,
  score_away_at_entry     INTEGER,
  score_home_at_exit      INTEGER,
  score_away_at_exit      INTEGER,

  -- ═══ MÉTRICAS DE INFLUENCIA — cuando el jugador estaba en campo ═══

  -- Goles a favor del equipo del jugador mientras estaba en campo
  goals_for_while_on      INTEGER NOT NULL DEFAULT 0,
  -- Goles en contra del equipo del jugador mientras estaba en campo
  goals_against_while_on  INTEGER NOT NULL DEFAULT 0,
  -- Diferencia de goles mientras estaba en campo (+N = dominó, -N = fue dominado)
  goal_diff_while_on      INTEGER GENERATED ALWAYS AS (
    goals_for_while_on - goals_against_while_on
  ) STORED,

  -- ═══ MÉTRICAS COMPLEMENTARIAS — cuando el jugador NO estaba en campo ═══

  goals_for_while_off     INTEGER NOT NULL DEFAULT 0,
  goals_against_while_off INTEGER NOT NULL DEFAULT 0,
  goal_diff_while_off     INTEGER GENERATED ALWAYS AS (
    goals_for_while_off - goals_against_while_off
  ) STORED,

  -- ═══ EVENTOS PERSONALES ═══

  goals_scored            INTEGER NOT NULL DEFAULT 0,  -- goles marcados por este jugador
  own_goals               INTEGER NOT NULL DEFAULT 0,
  penalties_scored        INTEGER NOT NULL DEFAULT 0,
  yellow_cards            INTEGER NOT NULL DEFAULT 0,
  red_cards               INTEGER NOT NULL DEFAULT 0,

  -- ═══ RESULTADO ═══

  -- Resultado del partido desde la perspectiva del equipo del jugador
  team_result             TEXT    NOT NULL CHECK (team_result IN ('win', 'draw', 'loss')),
  -- Goles marcados por el equipo del jugador en el partido completo
  team_goals_scored       INTEGER NOT NULL DEFAULT 0,
  -- Goles recibidos por el equipo del jugador en el partido completo
  team_goals_conceded     INTEGER NOT NULL DEFAULT 0,

  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (match_id, lineup_id)
);

COMMENT ON TABLE stat_player_match_influence IS
  'Tabla pre-calculada con métricas de influencia por jugador y partido. '
  'Permite responder: "¿cuántos goles marca/recibe el equipo cuando X está en campo?", '
  '"¿cuál es el win-rate del equipo con X de titular?", etc. '
  'Se recalcula automáticamente cada vez que se importa un acta.';

-- ============================================================
-- ÍNDICES — Optimizados para queries de análisis
-- ============================================================

-- stat_matches
CREATE INDEX IF NOT EXISTS idx_stat_matches_season
  ON stat_matches(season);
CREATE INDEX IF NOT EXISTS idx_stat_matches_competition_season
  ON stat_matches(competition, season);
CREATE INDEX IF NOT EXISTS idx_stat_matches_team_home
  ON stat_matches(home_team, season);
CREATE INDEX IF NOT EXISTS idx_stat_matches_team_away
  ON stat_matches(away_team, season);
CREATE INDEX IF NOT EXISTS idx_stat_matches_date
  ON stat_matches(match_date);
CREATE INDEX IF NOT EXISTS idx_stat_matches_federation_id
  ON stat_matches(federation_id);

-- stat_lineups
CREATE INDEX IF NOT EXISTS idx_stat_lineups_match
  ON stat_lineups(match_id);
CREATE INDEX IF NOT EXISTS idx_stat_lineups_player_name
  ON stat_lineups(player_name);
CREATE INDEX IF NOT EXISTS idx_stat_lineups_team
  ON stat_lineups(team_name);
CREATE INDEX IF NOT EXISTS idx_stat_lineups_main_db_player
  ON stat_lineups(main_db_player_id) WHERE main_db_player_id IS NOT NULL;
-- Búsqueda difusa por nombre de jugador
CREATE INDEX IF NOT EXISTS idx_stat_lineups_player_name_trgm
  ON stat_lineups USING GIN (player_name_normalized gin_trgm_ops);

-- stat_events
CREATE INDEX IF NOT EXISTS idx_stat_events_match
  ON stat_events(match_id);
CREATE INDEX IF NOT EXISTS idx_stat_events_type
  ON stat_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stat_events_player
  ON stat_events(player_name);
CREATE INDEX IF NOT EXISTS idx_stat_events_team_type
  ON stat_events(team_name, event_type);
CREATE INDEX IF NOT EXISTS idx_stat_events_minute
  ON stat_events(match_id, minute);
CREATE INDEX IF NOT EXISTS idx_stat_events_main_db_player
  ON stat_events(main_db_player_id) WHERE main_db_player_id IS NOT NULL;

-- stat_score_timeline
CREATE INDEX IF NOT EXISTS idx_stat_timeline_match
  ON stat_score_timeline(match_id);

-- stat_player_match_influence
CREATE INDEX IF NOT EXISTS idx_stat_influence_player_name
  ON stat_player_match_influence(player_name);
CREATE INDEX IF NOT EXISTS idx_stat_influence_main_db_player
  ON stat_player_match_influence(main_db_player_id) WHERE main_db_player_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_stat_influence_team
  ON stat_player_match_influence(team_name);
CREATE INDEX IF NOT EXISTS idx_stat_influence_season
  ON stat_player_match_influence(season);
CREATE INDEX IF NOT EXISTS idx_stat_influence_match
  ON stat_player_match_influence(match_id);
CREATE INDEX IF NOT EXISTS idx_stat_influence_result
  ON stat_player_match_influence(team_result);
CREATE INDEX IF NOT EXISTS idx_stat_influence_team_season
  ON stat_player_match_influence(team_name, season);
-- Índice compuesto para queries de win-rate por jugador
CREATE INDEX IF NOT EXISTS idx_stat_influence_player_season_result
  ON stat_player_match_influence(player_name, season, team_result);

-- ============================================================
-- ROW LEVEL SECURITY — Lectura pública, escritura solo service_role
-- ============================================================

ALTER TABLE stat_matches                ENABLE ROW LEVEL SECURITY;
ALTER TABLE stat_lineups                ENABLE ROW LEVEL SECURITY;
ALTER TABLE stat_events                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE stat_score_timeline         ENABLE ROW LEVEL SECURITY;
ALTER TABLE stat_player_match_influence ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública (anon puede leer stats)
CREATE POLICY "public_read_stat_matches"
  ON stat_matches FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "public_read_stat_lineups"
  ON stat_lineups FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "public_read_stat_events"
  ON stat_events FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "public_read_stat_score_timeline"
  ON stat_score_timeline FOR SELECT TO anon, authenticated
  USING (true);

CREATE POLICY "public_read_stat_player_match_influence"
  ON stat_player_match_influence FOR SELECT TO anon, authenticated
  USING (true);

-- Política de escritura solo para service_role (scraper)
-- El service_role bypassa RLS por defecto en Supabase, pero lo dejamos explícito.
CREATE POLICY "service_role_write_stat_matches"
  ON stat_matches FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_write_stat_lineups"
  ON stat_lineups FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_write_stat_events"
  ON stat_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_write_stat_score_timeline"
  ON stat_score_timeline FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "service_role_write_stat_player_match_influence"
  ON stat_player_match_influence FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- ============================================================
-- VISTAS DE ANÁLISIS — Para consultas frecuentes
-- ============================================================

-- Vista: Resumen de rendimiento de un jugador por temporada
CREATE OR REPLACE VIEW v_player_season_stats AS
SELECT
  player_name,
  main_db_player_id,
  team_name,
  season,
  COUNT(*)                                          AS partidos_jugados,
  SUM(CASE WHEN is_starter THEN 1 ELSE 0 END)      AS titular,
  SUM(CASE WHEN NOT is_starter THEN 1 ELSE 0 END)  AS suplente,
  SUM(minutes_on)                                   AS minutos_totales,
  SUM(goals_scored)                                 AS goles,
  SUM(own_goals)                                    AS goles_propia,
  SUM(yellow_cards)                                 AS amarillas,
  SUM(red_cards)                                    AS rojas,
  SUM(goals_for_while_on)                           AS goles_favor_en_campo,
  SUM(goals_against_while_on)                       AS goles_contra_en_campo,
  SUM(goal_diff_while_on)                           AS diferencia_en_campo,
  ROUND(AVG(goal_diff_while_on)::numeric, 2)        AS media_diferencia_en_campo,
  SUM(CASE WHEN team_result = 'win' THEN 1 ELSE 0 END)  AS victorias,
  SUM(CASE WHEN team_result = 'draw' THEN 1 ELSE 0 END) AS empates,
  SUM(CASE WHEN team_result = 'loss' THEN 1 ELSE 0 END) AS derrotas,
  ROUND(
    (SUM(CASE WHEN team_result = 'win' THEN 1 ELSE 0 END)::numeric / NULLIF(COUNT(*), 0)) * 100,
    1
  )                                                 AS win_rate_pct
FROM stat_player_match_influence
GROUP BY player_name, main_db_player_id, team_name, season;

COMMENT ON VIEW v_player_season_stats IS
  'Resumen de rendimiento de cada jugador por temporada y equipo. '
  'Incluye minutos, goles, tarjetas y métricas de influencia en el marcador.';

-- Vista: Resumen de rendimiento de un equipo por temporada
CREATE OR REPLACE VIEW v_team_season_stats AS
SELECT
  m.competition,
  m.season,
  t.team_name,
  COUNT(DISTINCT m.id)                              AS partidos,
  SUM(CASE
    WHEN (t.is_home AND m.home_score > m.away_score) OR
         (NOT t.is_home AND m.away_score > m.home_score) THEN 1 ELSE 0
  END)                                              AS victorias,
  SUM(CASE WHEN m.home_score = m.away_score THEN 1 ELSE 0 END) AS empates,
  SUM(CASE
    WHEN (t.is_home AND m.home_score < m.away_score) OR
         (NOT t.is_home AND m.away_score < m.home_score) THEN 1 ELSE 0
  END)                                              AS derrotas,
  SUM(CASE WHEN t.is_home THEN m.home_score ELSE m.away_score END) AS goles_favor,
  SUM(CASE WHEN t.is_home THEN m.away_score ELSE m.home_score END) AS goles_contra
FROM stat_matches m
CROSS JOIN LATERAL (
  VALUES
    (m.home_team, true),
    (m.away_team, false)
) AS t(team_name, is_home)
GROUP BY m.competition, m.season, t.team_name;

COMMENT ON VIEW v_team_season_stats IS
  'Clasificación/rendimiento de equipos por temporada. '
  'Cada equipo aparece una vez por temporada con sus totales.';

-- ============================================================
-- FUNCIÓN: Recalcular influencia de un partido
-- Útil para re-procesar sin re-scrapear el PDF
-- ============================================================
CREATE OR REPLACE FUNCTION recalculate_match_influence(p_match_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_home_team TEXT;
  v_away_team TEXT;
  v_home_score INTEGER;
  v_away_score INTEGER;
  v_match_date DATE;
  v_season TEXT;
  rec RECORD;
  v_goals_for_while_on INTEGER;
  v_goals_against_while_on INTEGER;
  v_goals_for_while_off INTEGER;
  v_goals_against_while_off INTEGER;
  v_goals_scored INTEGER;
  v_own_goals INTEGER;
  v_penalty_goals INTEGER;
  v_yellow_cards INTEGER;
  v_red_cards INTEGER;
  v_score_home_at_entry INTEGER;
  v_score_away_at_entry INTEGER;
  v_score_home_at_exit INTEGER;
  v_score_away_at_exit INTEGER;
  v_team_result TEXT;
  v_team_goals_scored INTEGER;
  v_team_goals_conceded INTEGER;
BEGIN
  -- Obtener datos del partido
  SELECT home_team, away_team, home_score, away_score, match_date, season
  INTO v_home_team, v_away_team, v_home_score, v_away_score, v_match_date, v_season
  FROM stat_matches WHERE id = p_match_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Partido % no encontrado', p_match_id;
  END IF;

  -- Borrar influencia anterior para este partido
  DELETE FROM stat_player_match_influence WHERE match_id = p_match_id;

  -- Para cada jugador en la alineación
  FOR rec IN
    SELECT * FROM stat_lineups WHERE match_id = p_match_id
  LOOP
    -- Goles marcados por el equipo del jugador mientras estaba en campo
    SELECT COUNT(*)
    INTO v_goals_for_while_on
    FROM stat_events
    WHERE match_id = p_match_id
      AND team_name = rec.team_name
      AND event_type IN ('goal', 'penalty_goal')
      AND minute >= rec.substituted_in_min
      AND minute < rec.substituted_out_min;

    -- Goles propios que benefician al rival (cuentan como goles recibidos)
    SELECT COUNT(*)
    INTO v_goals_against_while_on
    FROM stat_events
    WHERE match_id = p_match_id
      AND event_type IN ('goal', 'penalty_goal', 'own_goal')
      -- Goles del rival O propias del equipo del jugador
      AND (
        (team_name != rec.team_name AND event_type IN ('goal', 'penalty_goal'))
        OR (team_name = rec.team_name AND event_type = 'own_goal')
      )
      AND minute >= rec.substituted_in_min
      AND minute < rec.substituted_out_min;

    -- Goles marcados mientras estaba FUERA
    SELECT COUNT(*)
    INTO v_goals_for_while_off
    FROM stat_events
    WHERE match_id = p_match_id
      AND team_name = rec.team_name
      AND event_type IN ('goal', 'penalty_goal')
      AND (minute < rec.substituted_in_min OR minute >= rec.substituted_out_min);

    -- Goles recibidos mientras estaba FUERA
    SELECT COUNT(*)
    INTO v_goals_against_while_off
    FROM stat_events
    WHERE match_id = p_match_id
      AND event_type IN ('goal', 'penalty_goal', 'own_goal')
      AND (
        (team_name != rec.team_name AND event_type IN ('goal', 'penalty_goal'))
        OR (team_name = rec.team_name AND event_type = 'own_goal')
      )
      AND (minute < rec.substituted_in_min OR minute >= rec.substituted_out_min);

    -- Eventos personales del jugador
    SELECT
      COALESCE(SUM(CASE WHEN event_type = 'goal' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN event_type = 'own_goal' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN event_type = 'penalty_goal' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN event_type = 'yellow_card' THEN 1 ELSE 0 END), 0),
      COALESCE(SUM(CASE WHEN event_type IN ('red_card', 'yellow_red_card') THEN 1 ELSE 0 END), 0)
    INTO v_goals_scored, v_own_goals, v_penalty_goals, v_yellow_cards, v_red_cards
    FROM stat_events
    WHERE match_id = p_match_id AND player_name = rec.player_name AND team_name = rec.team_name;

    -- Marcador en el momento de entrada/salida
    SELECT home_score, away_score
    INTO v_score_home_at_entry, v_score_away_at_entry
    FROM stat_score_timeline
    WHERE match_id = p_match_id AND minute = rec.substituted_in_min
    ORDER BY minute LIMIT 1;

    SELECT home_score, away_score
    INTO v_score_home_at_exit, v_score_away_at_exit
    FROM stat_score_timeline
    WHERE match_id = p_match_id AND minute <= rec.substituted_out_min
    ORDER BY minute DESC LIMIT 1;

    -- Resultado del partido para el equipo del jugador
    IF rec.team_name = v_home_team THEN
      v_team_goals_scored   := v_home_score;
      v_team_goals_conceded := v_away_score;
      IF v_home_score > v_away_score THEN v_team_result := 'win';
      ELSIF v_home_score = v_away_score THEN v_team_result := 'draw';
      ELSE v_team_result := 'loss';
      END IF;
    ELSE
      v_team_goals_scored   := v_away_score;
      v_team_goals_conceded := v_home_score;
      IF v_away_score > v_home_score THEN v_team_result := 'win';
      ELSIF v_away_score = v_home_score THEN v_team_result := 'draw';
      ELSE v_team_result := 'loss';
      END IF;
    END IF;

    INSERT INTO stat_player_match_influence (
      match_id, lineup_id, player_name, main_db_player_id, team_name,
      season, match_date, is_starter, minutes_on,
      substituted_in_min, substituted_out_min,
      score_home_at_entry, score_away_at_entry,
      score_home_at_exit, score_away_at_exit,
      goals_for_while_on, goals_against_while_on,
      goals_for_while_off, goals_against_while_off,
      goals_scored, own_goals, penalties_scored,
      yellow_cards, red_cards,
      team_result, team_goals_scored, team_goals_conceded
    ) VALUES (
      p_match_id, rec.id, rec.player_name, rec.main_db_player_id, rec.team_name,
      v_season, v_match_date, rec.is_starter, rec.minutes_on,
      rec.substituted_in_min, rec.substituted_out_min,
      v_score_home_at_entry, v_score_away_at_entry,
      v_score_home_at_exit, v_score_away_at_exit,
      v_goals_for_while_on, v_goals_against_while_on,
      v_goals_for_while_off, v_goals_against_while_off,
      v_goals_scored, v_own_goals, v_penalty_goals,
      v_yellow_cards, v_red_cards,
      v_team_result, v_team_goals_scored, v_team_goals_conceded
    );
  END LOOP;
END;
$$;

COMMENT ON FUNCTION recalculate_match_influence(UUID) IS
  'Recalcula stat_player_match_influence para un partido dado. '
  'Útil si se corrigen datos del acta sin re-scrapear.';
