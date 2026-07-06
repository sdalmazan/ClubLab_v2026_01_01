# Statistics_DB — Scraper de Actas RFCYLF

## ¿Qué es esto?

Scraper que descarga las actas oficiales de partidos de la RFCYLF (rfcylf.es) y las almacena en la base de datos **Statistics_DB** (Supabase Federation Project) para análisis avanzado de rendimiento de jugadores.

## Base de datos

- **Proyecto Supabase**: `https://kifqwsqvwooteqszkhwn.supabase.co`
- **Schema**: ver [`supabase/statistics-db/001_stat_schema.sql`](supabase/statistics-db/001_stat_schema.sql)

### Tablas principales

| Tabla | Descripción |
|-------|-------------|
| `stat_matches` | Un partido por fila. Equipos, resultado, fecha, jornada. |
| `stat_lineups` | Un jugador × partido. Minutos de entrada/salida. |
| `stat_events` | Goles, tarjetas, sustituciones con minuto exacto. |
| `stat_score_timeline` | Marcador en cada minuto con evento. |
| `stat_player_match_influence` | Métricas pre-calculadas de influencia. |

## Cómo funciona el scraper

El scraper usa **HTTP puro** (`fetch` + manejo de cookies) — **sin Playwright ni Chrome**.

El portal rfcylf.es requiere:
1. Visitar la home siguiendo los redirects (hasta 4 saltos) para obtener el `JSESSIONID`
2. Enviar `cookie_aceptada=1` + `JSESSIONID=...` en todas las peticiones siguientes
3. Las páginas de jornada y los PDFs de actas se descargan directamente como respuestas HTTP

No se abre ningún navegador. **El scraper funciona en segundo plano sin intervención manual.**

## Setup inicial

### 1. Aplicar el schema en Statistics_DB

Copia el contenido de `supabase/statistics-db/001_stat_schema.sql` y ejecútalo en el SQL Editor del proyecto Supabase `kifqwsqvwooteqszkhwn`.

### 2. Instalar dependencias

```bash
npm install --save-dev tsx dotenv
npm install pdf-parse
```

> **Nota**: `playwright` ya NO es necesario. El scraper funciona con `fetch` nativo de Node.js 18+.

## Uso del scraper

```bash
# Importar una jornada
npx tsx scripts/run-scraper.ts --jornada=1

# Importar un rango de jornadas
npx tsx scripts/run-scraper.ts --desde=1 --hasta=10

# Importar toda la temporada
npx tsx scripts/run-scraper.ts --all

# Temporada anterior
npx tsx scripts/run-scraper.ts --all --season=2024/2025

# Con tiempos más cortos (para pruebas)
npx tsx scripts/run-scraper.ts --jornada=1 --delay-match=2000

# Ver ayuda completa
npx tsx scripts/run-scraper.ts --help
```

**Primera ejecución**: Chrome se abrirá y te pedirá navegar manualmente a la jornada 1 de rfcylf.es para establecer la sesión. Una vez visible, pulsa ENTER en la terminal.

## Verificar datos

```bash
node scripts/check-stats-db.mjs
```

## Queries de análisis (ejemplos)

### Win-rate de un jugador cuando es titular

```sql
SELECT
  player_name, team_name, season,
  COUNT(*) AS partidos,
  SUM(CASE WHEN team_result = 'win' THEN 1 ELSE 0 END) AS victorias,
  ROUND(AVG(goal_diff_while_on), 2) AS media_diferencia_goles
FROM stat_player_match_influence
WHERE player_name ILIKE '%García%'
  AND is_starter = true
GROUP BY player_name, team_name, season;
```

### Equipos donde más goles se marcan mientras un jugador está en campo

```sql
SELECT
  player_name,
  SUM(goals_for_while_on) AS goles_favor,
  SUM(goals_against_while_on) AS goles_contra,
  SUM(goal_diff_while_on) AS diferencia,
  SUM(minutes_on) AS minutos
FROM stat_player_match_influence
WHERE team_name = 'CF ALMAZ'
GROUP BY player_name
ORDER BY diferencia DESC;
```

### Clasificación real de equipos en la temporada

```sql
SELECT * FROM v_team_season_stats
WHERE season = '2025/2026'
ORDER BY victorias DESC, goles_favor DESC;
```

### ¿Qué pasa en los 15 minutos tras la entrada de un jugador?

```sql
SELECT e.*
FROM stat_events e
JOIN stat_lineups l ON l.match_id = e.match_id
WHERE l.player_name ILIKE '%Pérez%'
  AND e.minute BETWEEN l.substituted_in_min AND l.substituted_in_min + 15
  AND e.event_type IN ('goal', 'penalty_goal', 'own_goal');
```

## Roadmap

- [ ] 2025/2026 — temporada actual
- [ ] 2024/2025 — temporada anterior
- [ ] 10 años históricos de Tercera RFEF Castilla y León
- [ ] Otras comunidades autónomas (RFAF, RFAF, etc.)
- [ ] UI de visualización de estadísticas en ClubLab
