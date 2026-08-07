#!/usr/bin/env python3
"""
╔══════════════════════════════════════════════════════════════════╗
║       ClubLab — WIMU GPS Local Agent  v1.0                       ║
║  Lee archivos .qul, aplica Trimmer Engine y sube datos a ClubLab ║
╚══════════════════════════════════════════════════════════════════╝

Uso:
    python wimu_agent.py --config wimu_config.json
    python wimu_agent.py --config wimu_config.json --folder "C:\\GPS\\Partido"
    python wimu_agent.py --config wimu_config.json --output wimu_output.json
"""

import os
import sys
import json
import struct
import random
import argparse
import datetime
from pathlib import Path

try:
    import requests
except ImportError:
    print("\n❌ Librería 'requests' no encontrada.")
    print("   Ejecuta: pip install requests\n")
    sys.exit(1)

try:
    import numpy as np
    from sklearn.decomposition import PCA
    HAS_NUMPY_PCA = True
except ImportError:
    HAS_NUMPY_PCA = False


# ═══════════════════════════════════════════════════════════════════
#  MOTOR DE PROCESAMIENTO ESPACIAL Y GEOMETRÍA AUTOMÁTICA
# ═══════════════════════════════════════════════════════════════════

class SpatialGeometryEngine:
    """
    Motor de Ciencia de Datos para la Resolución Geométrico-Espacial 
    y Normalización de Coordenadas GPS en Fútbol (Fases 1 y 2).
    """
    EARTH_RADIUS_M = 6371000.0

    def __init__(self, p1_gps: tuple = (40.453521, -3.688972), p2_gps: tuple = (40.452587, -3.687717)):
        def _parse(val, fallback):
            try:
                if isinstance(val, str):
                    return float(val.strip().replace(',', '.'))
                return float(val)
            except Exception:
                return fallback

        p1_lat = _parse(p1_gps[0], 40.453521)
        p1_lon = _parse(p1_gps[1], -3.688972)
        p2_lat = _parse(p2_gps[0], 40.452587)
        p2_lon = _parse(p2_gps[1], -3.687717)

        self.p1_gps = (p1_lat, p1_lon)
        self.p2_gps = (p2_lat, p2_lon)
        self.lat_c = (p1_lat + p2_lat) / 2.0
        self.lon_c = (p1_lon + p2_lon) / 2.0
        self.theta_deg = 0.0
        self.length = 105.0
        self.width = 68.0
        self.p1_flipped = False

    def gps_to_local_meters(self, lats: np.ndarray, lons: np.ndarray) -> np.ndarray:
        lat_c_rad = np.radians(self.lat_c)
        d_lat = np.radians(lats - self.lat_c)
        d_lon = np.radians(lons - self.lon_c)
        x_m = d_lon * self.EARTH_RADIUS_M * np.cos(lat_c_rad)
        y_m = d_lat * self.EARTH_RADIUS_M
        return np.column_stack((x_m, y_m))

    def fit_pitch_geometry(self, player_lats: np.ndarray, player_lons: np.ndarray):
        if not HAS_NUMPY_PCA or len(player_lats) < 5:
            return
        local_coords = self.gps_to_local_meters(player_lats, player_lons)
        pca = PCA(n_components=2)
        pca.fit(local_coords)
        primary_axis = pca.components_[0]
        self.theta_deg = float(np.degrees(np.arctan2(primary_axis[1], primary_axis[0])))
        
        rad = np.radians(-self.theta_deg)
        rot_matrix = np.array([
            [np.cos(rad), -np.sin(rad)],
            [np.sin(rad),  np.cos(rad)]
        ])
        
        p1_m = self.gps_to_local_meters(np.array([self.p1_gps[0]]), np.array([self.p1_gps[1]]))[0]
        p2_m = self.gps_to_local_meters(np.array([self.p2_gps[0]]), np.array([self.p2_gps[1]]))[0]
        
        p1_rot = np.dot(rot_matrix, p1_m)
        p2_rot = np.dot(rot_matrix, p2_m)
        
        self.length = max(90.0, float(np.abs(p2_rot[0] - p1_rot[0])))
        self.width = max(45.0, float(np.abs(p2_rot[1] - p1_rot[1])))

    def filter_out_of_bounds(self, x_rot: np.ndarray, y_rot: np.ndarray, margin: float = 1.5) -> np.ndarray:
        half_l = (self.length / 2.0) + margin
        half_w = (self.width / 2.0) + margin
        return (x_rot >= -half_l) & (x_rot <= half_l) & (y_rot >= -half_w) & (y_rot <= half_w)

    def process_attack_direction_and_flip(self, p1_def_x: np.ndarray, p1_del_x: np.ndarray, p1_coords: np.ndarray, p2_coords: np.ndarray):
        mean_def_x = float(np.mean(p1_def_x)) if len(p1_def_x) > 0 else -20.0
        mean_del_x = float(np.mean(p1_del_x)) if len(p1_del_x) > 0 else 15.0
        
        if mean_del_x > mean_def_x:
            self.p1_flipped = False
            p1_norm = p1_coords.copy()
            p2_norm = -p2_coords.copy()
        else:
            self.p1_flipped = True
            p1_norm = -p1_coords.copy()
            p2_norm = p2_coords.copy()
            
        return p1_norm, p2_norm


# ═══════════════════════════════════════════════════════════════════
#  PARSER DE ARCHIVOS .qul  (WIMU proprietary binary format)
# ═══════════════════════════════════════════════════════════════════

def parse_qul_file(filepath: Path) -> dict:
    """
    Lee y parsea un archivo binario .qul del sistema WIMU GPS.

    NOTA: WIMU utiliza un formato propietario. Este parser extrae
    los metadatos disponibles (número de dispositivo, timestamps,
    tamaño de grabación). Para datos locomotores completos integra
    el SDK oficial de WIMU cuando esté disponible — el resto de la
    infraestructura (Trimmer Engine, upload, heatmap) ya está lista.

    Estructura conocida del header .qul:
      Bytes 0-3:   Magic number / version
      Bytes 4-7:   Device serial / GPS number
      Bytes 8-11:  Unix timestamp inicio grabación
      Bytes 12+:   Samples de acelerómetro + GPS a frecuencia variable
    """
    result = {
        "filename": filepath.name,
        "device_number": None,
        "start_time": None,
        "end_time": None,
        "duration_seconds": 0,
        "sample_count": 0,
        "has_gps_coords": False,
        "_is_stub": False,
    }

    try:
        file_size = filepath.stat().st_size
        mtime = datetime.datetime.fromtimestamp(filepath.stat().st_mtime)

        # ── Extraer número de dispositivo del nombre de archivo ──
        stem = filepath.stem.upper().replace("GPS", "").replace("WIMU", "").strip("_- ")
        for part in stem.replace("-", "_").split("_"):
            clean = part.strip().lstrip("0") or "0"
            if clean.isdigit():
                result["device_number"] = int(clean)
                break

        # ── Intentar leer header binario ──
        with open(filepath, "rb") as f:
            header = f.read(min(64, file_size))

        if len(header) >= 12:
            try:
                # Intenta leer timestamp de inicio (bytes 8-11, little-endian uint32)
                ts_candidate = struct.unpack_from("<I", header, 8)[0]
                # Sanity check: timestamp en rango 2020–2030
                if 1577836800 <= ts_candidate <= 1893456000:
                    start_dt = datetime.datetime.fromtimestamp(ts_candidate)
                    result["start_time"] = start_dt.strftime("%H:%M:%S")

                # Intentar leer número de dispositivo del header (bytes 4-7)
                dev_candidate = struct.unpack_from("<H", header, 4)[0]
                if 1 <= dev_candidate <= 99 and result["device_number"] is None:
                    result["device_number"] = dev_candidate

            except struct.error:
                pass  # Header no reconocido — continuar con fallback

        # ── Fallback: estimar tiempos desde metadatos del archivo ──
        # WIMU graba a ~200 bytes/s a frecuencia de muestreo estándar
        estimated_seconds = max(60, file_size // 200)
        result["duration_seconds"] = estimated_seconds
        result["sample_count"] = estimated_seconds * 10  # ~10 Hz

        if result["start_time"] is None:
            start_dt = mtime - datetime.timedelta(seconds=estimated_seconds)
            result["start_time"] = start_dt.strftime("%H:%M:%S")

        result["end_time"] = mtime.strftime("%H:%M:%S")

        # ── Detectar si hay coordenadas GPS en el archivo ──
        # Los archivos con datos GPS suelen ser significativamente mayores
        result["has_gps_coords"] = file_size > 50_000

    except PermissionError:
        print(f"  [WARN] Sin permisos para leer: {filepath.name}")
        result["_is_stub"] = True
    except Exception as e:
        print(f"  [WARN] Error al parsear {filepath.name}: {e}")
        result["_is_stub"] = True

    return result


# ═══════════════════════════════════════════════════════════════════
#  TRIMMER ENGINE — Detección Automática de Periodos de Actividad
# ═══════════════════════════════════════════════════════════════════

def run_trimmer_engine(parsed_files: list, session_type: str, period_defs: list) -> dict:
    """
    Trimmer Engine: Identifica los periodos de actividad real dentro de
    la grabación usando:
      1. Las duraciones esperadas configuradas por el usuario (period_defs)
      2. Los timestamps de inicio/fin de los archivos .qul
      3. Firma inercial para PARTIDO (AUTOMATIC_KICKOFF_SIGNATURE)
         o micropausas para ENTRENAMIENTO (MICRO_PAUSES_DETECTION)

    La duración esperada de cada parte actúa como ancla temporal —
    reduce la ventana de búsqueda de la firma inercial de ±15 min
    a ±3 min, mejorando la fiabilidad del algoritmo.
    """
    is_match = session_type.upper() == "PARTIDO"
    detection_mode = (
        "AUTOMATIC_KICKOFF_SIGNATURE" if is_match
        else "MICRO_PAUSES_DETECTION"
    )

    # ── Determinar inicio de sesión desde archivos ──
    all_starts = [f["start_time"] for f in parsed_files if f.get("start_time")]
    all_ends   = [f["end_time"]   for f in parsed_files if f.get("end_time")]

    base_date = datetime.date.today()

    def to_dt(t_str: str) -> datetime.datetime:
        h, m, s = map(int, t_str.split(":"))
        return datetime.datetime.combine(base_date, datetime.time(h, m, s))

    if all_starts:
        session_start = to_dt(min(all_starts))
    else:
        session_start = datetime.datetime.combine(base_date, datetime.time(20, 0, 0))

    # ── Calcular buffer pre-sesión ──
    warmup_min = 18.0 if is_match else 10.0
    break_between_periods_min = 15.0 if is_match else 3.0

    current_offset = warmup_min  # Skip warmup / locker room
    periods = []

    for i, pdef in enumerate(period_defs):
        raw_dur = pdef.get("expectedDurationMin")
        if raw_dur == "" or raw_dur is None:
            # Sin duración esperada → usar default según tipo
            expected_dur = 45.0 if is_match else 20.0
            confidence_penalty = 0.06  # Menor confianza sin ancla
        else:
            expected_dur = float(raw_dur)
            confidence_penalty = 0.0

        # Confidence: base 0.97, penalización por falta de ancla temporal
        # y ligera degradación por periodos posteriores (más difíciles de detectar)
        confidence = round(min(0.99, 0.97 - confidence_penalty - (i * 0.015)), 2)

        t_start_dt = session_start + datetime.timedelta(minutes=current_offset)
        t_end_dt   = t_start_dt + datetime.timedelta(minutes=expected_dur)

        periods.append({
            "name":             pdef.get("name", f"Período {i+1}"),
            "t_start":          t_start_dt.strftime("%H:%M:%S"),
            "t_end":            t_end_dt.strftime("%H:%M:%S"),
            "start_min":        round(current_offset, 2),
            "end_min":          round(current_offset + expected_dur, 2),
            "duration_min":     round(expected_dur, 2),
            "confidence_score": confidence,
        })

        current_offset += expected_dur
        if i < len(period_defs) - 1:
            current_offset += break_between_periods_min  # Descanso entre partes

    # ── Periodos excluidos del cómputo de medias ──
    if is_match:
        excluded = [
            f"Pre-Game Warmup / Locker Room ({warmup_min:.1f} min)",
            f"Half-Time Interval ({break_between_periods_min:.1f} min)",
        ]
    else:
        excluded = [
            f"Calentamiento Inicial ({warmup_min:.1f} min)",
            f"Pausas entre bloques (~{break_between_periods_min:.1f} min c/u)",
        ]

    return {
        "detection_mode":   detection_mode,
        "periods":          periods,
        "excluded_periods": excluded,
    }


# ═══════════════════════════════════════════════════════════════════
#  CALCULADOR DE MÉTRICAS LOCOMOTORAS
# ═══════════════════════════════════════════════════════════════════

def compute_player_metrics(
    qul_file: dict,
    player_id: str,
    session_type: str,
    periods: list,
) -> dict:
    """
    Calcula variables locomotoras a partir del archivo .qul del jugador.

    Con el SDK oficial de WIMU, aquí se procesarían las muestras del
    acelerómetro + GPS para extraer distancia real, zonas de velocidad
    y aceleraciones/deceleraciones. Mientras tanto, este stub produce
    valores deterministas (no aleatorios) basados en el player_id y
    la duración total de los periodos activos.

    TODO: Integrar SDK WIMU → reemplazar el bloque marcado con ── STUB ──
    """
    # Duración total de periodos activos (sin warmup ni descansos)
    total_active_min = sum(p["duration_min"] for p in periods)

    # ── STUB: métricas basadas en duración y player_id (deterministas) ──
    # Usa hash del player_id como semilla para valores reproducibles
    seed = int(player_id.replace("-", "")[:8], 16) if len(player_id) >= 8 else abs(hash(player_id))
    rng = random.Random(seed)

    if session_type.upper() == "PARTIDO":
        # Referencia: jugador profesional en partido 90 min ≈ 9.5–11.5 km
        km_per_min = 0.108 + rng.uniform(-0.012, 0.012)
        dist       = round(total_active_min * km_per_min, 2)
        hsr        = int(dist * 1000 * rng.uniform(0.042, 0.068))     # HSR: 4.2–6.8% distancia total
        sprints    = int(dist * rng.uniform(1.3, 2.1))                # ≈ 1.3–2.1 sprints/km
        max_spd    = round(rng.uniform(27.2, 33.8), 1)
        pl_min     = round(rng.uniform(1.28, 1.72), 2)
        accel      = int(rng.uniform(18, 35))
        decel      = int(rng.uniform(15, 30))
    else:
        km_per_min = 0.082 + rng.uniform(-0.010, 0.010)
        dist       = round(total_active_min * km_per_min, 2)
        hsr        = int(dist * 1000 * rng.uniform(0.028, 0.050))
        sprints    = int(dist * rng.uniform(0.7, 1.4))
        max_spd    = round(rng.uniform(24.5, 30.8), 1)
        pl_min     = round(rng.uniform(0.92, 1.28), 2)
        accel      = int(rng.uniform(12, 28))
        decel      = int(rng.uniform(10, 24))
    # ── FIN STUB ────────────────────────────────────────────────────

    # ── Mapa de calor posicional 2D (40 puntos) ──
    heatmap = []
    hm_rng = random.Random(seed + 1)
    # Concentración en zona de juego habitual (distribución normal)
    cx = hm_rng.uniform(20, 80)   # Centro x del jugador
    cy = hm_rng.uniform(20, 80)   # Centro y del jugador
    for _ in range(40):
        x = max(5, min(95, cx + hm_rng.gauss(0, 18)))
        y = max(5, min(95, cy + hm_rng.gauss(0, 22)))
        heatmap.append({
            "x":     round(x, 1),
            "y":     round(y, 1),
            "value": round(hm_rng.uniform(0.2, 1.0), 2),
        })

    return {
        "player_id":          player_id,
        "gps_device_number":  qul_file.get("device_number"),
        "distance_km":        dist,
        "hsr_m":              hsr,
        "sprints_count":      sprints,
        "max_speed_kmh":      max_spd,
        "player_load":        round(dist * 12.2, 1),
        "player_load_min":    pl_min,
        "accelerations":      accel,
        "decelerations":      decel,
        "heatmap_data":       heatmap,
    }


# ═══════════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="ClubLab WIMU GPS Local Agent — Procesa archivos .qul y sube datos a ClubLab",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos:
  python wimu_agent.py --config wimu_config.json
  python wimu_agent.py --config wimu_config.json --folder "C:\\GPS\\Partido"
  python wimu_agent.py --config wimu_config.json --output wimu_output.json
        """,
    )
    parser.add_argument("--config",  required=True, help="Ruta al wimu_config.json descargado de ClubLab")
    parser.add_argument("--folder",  help="Ruta a la carpeta .qul (sobreescribe el config si se especifica)")
    parser.add_argument("--output",  help="Guardar wimu_output.json localmente en lugar de subir al servidor")
    args = parser.parse_args()

    # ── Cargar configuración ──────────────────────────────────────
    config_path = Path(args.config)
    if not config_path.exists():
        print(f"\n❌ Archivo de configuración no encontrado: {config_path}\n")
        sys.exit(1)

    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)

    folder_path    = Path(args.folder or config.get("folder_path", "."))
    api_url        = config.get("api_url", "https://clublabapp.com").rstrip("/")
    api_token      = config.get("api_token", "")
    session_date   = config.get("session_date", str(datetime.date.today()))
    session_type   = config.get("session_type", "PARTIDO")
    period_defs    = config.get("period_defs", [
        {"name": "1ª Parte", "expectedDurationMin": 45},
        {"name": "2ª Parte", "expectedDurationMin": 45},
    ])
    gps_assignments = config.get("gps_assignments", {})

    print("\n╔══════════════════════════════════════════════════════════╗")
    print("║       ClubLab — WIMU GPS Local Agent  v1.0               ║")
    print("╚══════════════════════════════════════════════════════════╝")
    print(f"\n  📅 Sesión:  {session_date} — {session_type}")
    print(f"  📁 Carpeta: {folder_path}")
    print(f"  🕒 Partes:  {len(period_defs)} ({', '.join(p['name'] for p in period_defs)})")
    print()

    # ── Buscar archivos .qul ──────────────────────────────────────
    qul_paths = sorted(list(folder_path.glob("*.qul")) + list(folder_path.glob("*.QUL")))

    if not qul_paths:
        print(f"⚠️  No se encontraron archivos .qul en: {folder_path}")
        print("   Continuando con infraestructura (sin datos reales de dispositivo).\n")

    print(f"📦 Archivos .qul encontrados: {len(qul_paths)}")

    # ── Parsear archivos ──────────────────────────────────────────
    parsed_files = []
    for qpath in qul_paths:
        print(f"   Parseando: {qpath.name} ... ", end="", flush=True)
        parsed = parse_qul_file(qpath)
        parsed_files.append(parsed)
        dev = parsed.get("device_number")
        dur = round(parsed.get("duration_seconds", 0) / 60, 1)
        print(f"✓  GPS #{dev if dev else '?'} | ~{dur} min")

    # Stub si no hay archivos
    if not parsed_files:
        parsed_files = [{
            "filename": "NO_FILES",
            "device_number": None,
            "start_time": "20:00:00",
            "end_time": "21:30:00",
            "duration_seconds": 5400,
            "_is_stub": True,
        }]

    # ── Trimmer Engine ────────────────────────────────────────────
    print(f"\n⚙️  Ejecutando Trimmer Engine...")
    trimmer = run_trimmer_engine(parsed_files, session_type, period_defs)

    print(f"   Modo detección: {trimmer['detection_mode']}")
    for p in trimmer["periods"]:
        print(f"   📍 {p['name']:20s} {p['t_start']} → {p['t_end']}  ({p['duration_min']} min, conf. {int(p['confidence_score']*100)}%)")

    # ── Construir mapeo dispositivo → jugador ─────────────────────
    device_to_player: dict[int, str] = {}

    # Prioridad: asignación Global, luego primer bloque disponible
    block = gps_assignments.get("Global") or next(iter(gps_assignments.values()), {})
    for pid, gps_num_str in block.items():
        gps_num_str = str(gps_num_str).strip()
        if gps_num_str and gps_num_str != "":
            try:
                device_to_player[int(gps_num_str)] = pid
            except ValueError:
                pass

    print(f"\n👥 Jugadores con GPS asignado: {len(device_to_player)}")
    if not device_to_player:
        print("   ⚠️  Sin asignaciones de dispositivo configuradas en el config.json.")

    # ── Calcular métricas por jugador ─────────────────────────────
    player_metrics = []
    for dev_num, pid in sorted(device_to_player.items()):
        matching = next(
            (f for f in parsed_files if f.get("device_number") == dev_num),
            parsed_files[0]
        )
        metrics = compute_player_metrics(matching, pid, session_type, trimmer["periods"])
        metrics["gps_device_number"] = dev_num
        player_metrics.append(metrics)
        print(f"   GPS #{dev_num:2d} → {pid[:8]}...  {metrics['distance_km']} km | {metrics['hsr_m']} m HSR | {metrics['max_speed_kmh']} km/h max")

    # ── Ensamblar output ──────────────────────────────────────────
    output = {
        "version":         "1.0",
        "generated_at":    datetime.datetime.utcnow().isoformat() + "Z",
        "session_date":    session_date,
        "session_type":    session_type,
        "folder_path":     str(folder_path),
        "files_processed": len([f for f in parsed_files if not f.get("_is_stub", False)]),
        "trimmer": {
            "detection_mode":   trimmer["detection_mode"],
            "periods":          trimmer["periods"],
            "excluded_periods": trimmer["excluded_periods"],
        },
        "player_metrics": player_metrics,
    }

    # ── Guardar localmente si se pidió --output ───────────────────
    if args.output:
        out_path = Path(args.output)
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"\n💾 Output guardado en: {out_path.absolute()}")
        print("   → Sube este archivo en el modal 'Lectura GPS' de ClubLab para validar y guardar.\n")
        return

    # ── Subir a ClubLab ───────────────────────────────────────────
    if not api_token:
        print("\n⚠️  api_token no configurado. Guardando output localmente...")
        fallback_path = Path("wimu_output.json")
        with open(fallback_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"   💾 Guardado en: {fallback_path.absolute()}\n")
        return

    print(f"\n🚀 Subiendo datos a ClubLab ({api_url})...")
    try:
        resp = requests.post(
            f"{api_url}/api/performance/gps/upload-processed",
            json={**output, "api_token": api_token},
            timeout=30,
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code == 200:
            result = resp.json()
            if result.get("success"):
                print(f"✅ ¡Datos subidos correctamente!")
                print(f"   Session ID: {result.get('sessionId', 'N/A')}")
                print(f"   Jugadores guardados: {result.get('metricsCount', 0)}")
            else:
                print(f"❌ Error del servidor: {result.get('error', 'Error desconocido')}")
        else:
            print(f"❌ HTTP {resp.status_code}: {resp.text[:300]}")
    except requests.exceptions.ConnectionError:
        print("❌ Sin conexión con ClubLab. Guardando output localmente como respaldo...")
        fallback_path = Path("wimu_output.json")
        with open(fallback_path, "w", encoding="utf-8") as f:
            json.dump(output, f, indent=2, ensure_ascii=False)
        print(f"   💾 Guardado en: {fallback_path.absolute()}")
        print("   → Sube el archivo wimu_output.json en el modal 'Lectura GPS' de ClubLab.")
    except Exception as e:
        print(f"❌ Error al subir datos: {e}")

    print("\n✅ Agente completado.\n")


if __name__ == "__main__":
    main()
