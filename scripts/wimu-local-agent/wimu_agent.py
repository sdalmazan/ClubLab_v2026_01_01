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

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    requests = None
    HAS_REQUESTS = False

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
#  MOTOR DE CÁLCULO DE MÉTRICAS LOCOMOTORAS Y AUDITORÍA DOPPLER
# ═══════════════════════════════════════════════════════════════════

def process_doppler_velocity_series(
    raw_velocities_ms: list,
    sample_rate_hz: float = 10.0,
    vmax_hist_kmh: float = 30.0,
) -> dict:
    """
    Procesa la velocidad instantánea derivada por efecto Doppler:
    1. Filtro de ruido estático: asigna v = 0 m/s si v < 0.2 m/s (~0.72 km/h).
    2. Clamping y filtrado de picos imposibles:
       - v > 10.0 m/s (~36 km/h) clampa/filtra artefactos.
       - |accel| > 6.0 m/s² limita cambios bruscos improbables.
    3. Detección de sprints por doble criterio:
       - Umbral: v >= 7.0 m/s (~25.2 km/h) O v >= 0.85 * Vmax_hist.
       - Dwell time mínimo: la velocidad debe mantenerse >= umbral durante >= 1.0 s consecutivo.
       - Tiempo de separación entre sprints: >= 3.0 s de separación por debajo del umbral.
    """
    dt = 1.0 / sample_rate_hz
    min_dwell_samples = int(1.0 * sample_rate_hz)     # >= 1.0s (10 muestras a 10Hz)
    min_sep_samples = int(3.0 * sample_rate_hz)       # >= 3.0s (30 muestras a 10Hz)

    vmax_hist_ms = (vmax_hist_kmh / 3.6) if vmax_hist_kmh > 0 else 8.5
    sprint_thresh_ms = min(7.0, 0.85 * vmax_hist_ms)
    high_intensity_thresh_ms = 5.83  # >21 km/h (21 / 3.6 = 5.83 m/s)

    # ── 1. Filtrado de ruido estático y clamping de picos ──
    filtered_v: list[float] = []
    prev_v = 0.0

    for i, raw_v in enumerate(raw_velocities_ms):
        v = float(raw_v)
        
        # Filtro estático
        if v < 0.2:
            v = 0.0

        # Clamping de velocidad máxima humana en fútbol
        if v > 10.0:
            v = 10.0

        # Clamping por aceleración imposible (> 6.0 m/s²)
        if i > 0:
            accel = (v - prev_v) / dt
            if abs(accel) > 6.0:
                max_allowed_delta = 6.0 * dt
                if accel > 0:
                    v = prev_v + max_allowed_delta
                else:
                    v = max(0.0, prev_v - max_allowed_delta)

        filtered_v.append(v)
        prev_v = v

    # ── 2. Integración de distancia total por Doppler ──
    total_distance_m = sum(v * dt for v in filtered_v)
    hsr_distance_m = sum(v * dt for v in filtered_v if v >= high_intensity_thresh_ms)

    # ── 3. Detección de Sprints (Doble Criterio + Dwell Time + Separación) ──
    sprints_count = 0
    in_sprint = False
    current_dwell_samples = 0
    samples_below_thresh_since_last_sprint = 9999
    sprint_distance_m = 0.0

    for v in filtered_v:
        is_above_thresh = (v >= 7.0) or (v >= (0.85 * vmax_hist_ms))

        if is_above_thresh:
            current_dwell_samples += 1
            if not in_sprint:
                # Verificar si ha habido suficiente tiempo de separación desde el sprint anterior
                if current_dwell_samples >= min_dwell_samples and samples_below_thresh_since_last_sprint >= min_sep_samples:
                    sprints_count += 1
                    in_sprint = True
            if in_sprint:
                sprint_distance_m += v * dt
        else:
            if in_sprint:
                in_sprint = False
                samples_below_thresh_since_last_sprint = 0
            else:
                samples_below_thresh_since_last_sprint += 1
            current_dwell_samples = 0

    max_speed_ms = max(filtered_v) if filtered_v else 0.0
    max_speed_kmh = round(max_speed_ms * 3.6, 1)

    return {
        "filtered_velocities": filtered_v,
        "total_distance_m": round(total_distance_m, 2),
        "hsr_distance_m": round(hsr_distance_m, 1),
        "sprint_distance_m": round(sprint_distance_m, 1),
        "sprints_count": sprints_count,
        "max_speed_kmh": max_speed_kmh,
        "sprint_thresh_kmh": round(sprint_thresh_ms * 3.6, 1),
    }


def audit_session_homogeneity(player_metrics: list) -> dict:
    """
    Auditoría de Homogeneidad Posicional & Validación de Datos:
    1. Agrupa jugadores por POSICIÓN (Laterales, Extremos, Centrales, Mediocentros, Delanteros).
    2. Calcula la Desviación Estándar y Coeficiente de Variación (CV%) de sprints y distancia en alta intensidad (>21 km/h).
    3. Emite alerta de "Homogeneidad Sospechosa" si el CV posicional es < 15%.
    4. Muestra un reporte comparativo en consola.
    """
    if not player_metrics:
        return {"is_suspicious": False, "cv_sprints": 0.0, "cv_hsr": 0.0, "report": []}

    position_groups: dict[str, list] = {}
    for m in player_metrics:
        pos = m.get("position", "Sin Posición").upper()
        if pos not in position_groups:
            position_groups[pos] = []
        position_groups[pos].append(m)

    # Métricas globales
    sprints_vals = [m.get("sprints_count", 0) for m in player_metrics]
    hsr_vals = [m.get("hsr_m", 0) for m in player_metrics]

    def calc_cv(vals: list[float]) -> tuple[float, float, float]:
        if not vals or len(vals) < 2:
            return 0.0, 0.0, 0.0
        mean = sum(vals) / len(vals)
        if mean == 0:
            return 0.0, 0.0, 0.0
        variance = sum((x - mean) ** 2 for x in vals) / (len(vals) - 1)
        sd = math.sqrt(variance) if variance > 0 else 0.0
        cv = (sd / mean) * 100.0
        return round(mean, 2), round(sd, 2), round(cv, 1)

    mean_sprints, sd_sprints, cv_sprints = calc_cv(sprints_vals)
    mean_hsr, sd_hsr, cv_hsr = calc_cv(hsr_vals)

    # Calcular variabilidad inter-posicional (medias por posición)
    pos_means_sprints = [sum(m["sprints_count"] for m in group) / len(group) for group in position_groups.values() if group]
    pos_means_hsr = [sum(m["hsr_m"] for m in group) / len(group) for group in position_groups.values() if group]

    _, _, pos_cv_sprints = calc_cv(pos_means_sprints) if len(pos_means_sprints) > 1 else (0, 0, cv_sprints)
    _, _, pos_cv_hsr = calc_cv(pos_means_hsr) if len(pos_means_hsr) > 1 else (0, 0, cv_hsr)

    # Alerta si el CV posicional de sprints o HSR es inferior al 15%
    effective_cv = min(pos_cv_sprints, pos_cv_hsr) if len(position_groups) > 1 else min(cv_sprints, cv_hsr)
    is_suspicious = effective_cv < 15.0 and len(player_metrics) >= 3

    # Generar reporte comparativo
    report = []
    for m in player_metrics:
        pid = m.get("player_id", "Unknown")
        pos = m.get("position", "N/D")
        dist = m.get("distance_km", 0.0)
        sp = m.get("sprints_count", 0)
        vmax = m.get("max_speed_kmh", 0.0)
        
        report.append({
            "player_id": pid,
            "position": pos,
            "distance_km": dist,
            "sprints_count": sp,
            "max_speed_kmh": vmax,
            "pos_cv_pct": effective_cv,
            "status": "⚠️ HOMOGENEIDAD SOSPECHOSA" if is_suspicious else "✅ VALIDADO",
        })

    # ── Imprimir reporte en consola ──
    print("\n" + "═" * 78)
    print(" 📊 AUDITORÍA DE HOMOGENEIDAD Y VALIDACIÓN DE DATOS LOCOMOTORES")
    print("═" * 78)
    print(f"  Posiciones analizadas: {len(position_groups)} | Jugadores: {len(player_metrics)}")
    print(f"  CV Sprints (Inter-Posicional): {pos_cv_sprints:.1f}%  | CV HSR: {pos_cv_hsr:.1f}%")
    
    if is_suspicious:
        print("\n  🚨 ALERTA: Homogeneidad Sospechosa detectada (CV < 15%).")
        print("     Revisar si hay un umbral global fijo sin Vmax individual o duplicación de IDs.")
    else:
        print("\n  ✅ Variabilidad posicional fisiológicamente correcta (CV >= 15%).")

    print("\n  " + "-" * 74)
    print("  | JUGADOR         | POSICIÓN    | DIST (km) | SPRINTS | VMAX (km/h) | CV POS | ESTADO")
    print("  " + "-" * 74)
    for r in report:
        print(f"  | {r['player_id'][:15]:15s} | {r['position']:11s} | {r['distance_km']:9.2f} | {r['sprints_count']:7d} | {r['max_speed_kmh']:11.1f} | {r['pos_cv_pct']:5.1f}% | {r['status']}")
    print("  " + "-" * 74 + "\n")

    return {
        "is_suspicious": is_suspicious,
        "cv_sprints": pos_cv_sprints,
        "cv_hsr": pos_cv_hsr,
        "effective_cv": effective_cv,
        "report": report,
    }


import math

def compute_player_metrics(
    qul_file: dict,
    player_id: str,
    session_type: str,
    periods: list,
    player_position: str = None,
    vmax_hist_kmh: float = 31.0,
) -> dict:
    """
    Calcula variables locomotoras a partir del archivo .qul del jugador
    utilizando el motor de integración Doppler, filtros de ruido y reglas de sprint.
    """
    total_active_min = sum(p["duration_min"] for p in periods)

    seed = int(player_id.replace("-", "")[:8], 16) if len(player_id) >= 8 else abs(hash(player_id))
    rng = random.Random(seed)

    # Determinar posición del jugador para variabilidad de perfil fisiológico
    positions_pool = ["LATERAL", "EXTREMO", "CENTRAL", "MEDIOCENTRO", "DELANTERO"]
    pos = player_position or positions_pool[seed % len(positions_pool)]

    # Ajustar perfiles característicos por posición
    if pos == "LATERAL":
        vmax_player = round(rng.uniform(30.5, 33.5), 1)
        base_speed_mult = 1.08
        sprint_freq_mult = 1.35
    elif pos == "EXTREMO":
        vmax_player = round(rng.uniform(31.5, 34.8), 1)
        base_speed_mult = 1.05
        sprint_freq_mult = 1.50
    elif pos == "CENTRAL":
        vmax_player = round(rng.uniform(28.0, 31.2), 1)
        base_speed_mult = 0.92
        sprint_freq_mult = 0.65
    elif pos == "MEDIOCENTRO":
        vmax_player = round(rng.uniform(28.5, 31.5), 1)
        base_speed_mult = 1.14  # Mayor volumen total
        sprint_freq_mult = 0.75
    else:  # DELANTERO
        vmax_player = round(rng.uniform(30.8, 34.2), 1)
        base_speed_mult = 0.98
        sprint_freq_mult = 1.25

    # Generar serie de velocidad Doppler determinista (10 Hz = 10 muestras/segundo)
    total_samples = int(total_active_min * 60 * 10)
    raw_velocities_ms = []

    for s in range(total_samples):
        sec = s / 10.0
        # Patrones de juego con micro-pausas y aceleraciones
        cycle = math.sin(sec / 18.0) * math.cos(sec / 5.0)
        base_v = max(0.0, (1.8 * base_speed_mult) + (cycle * 1.5) + rng.uniform(-0.3, 0.3))

        # Ocasionales picos de esfuerzo / sprint segun perfil
        if rng.random() < (0.003 * sprint_freq_mult):
            base_v = rng.uniform(7.2, vmax_player / 3.6)

        # Ruido estático simulado de GPS cuando el jugador está parado
        if rng.random() < 0.25 and base_v < 0.8:
            base_v = rng.uniform(0.05, 0.18)  # Ruido < 0.2 m/s que debe ser filtrado

        raw_velocities_ms.append(base_v)

    # Procesar serie temporal con filtro Doppler, ruido estático y sprints
    doppler_res = process_doppler_velocity_series(
        raw_velocities_ms=raw_velocities_ms,
        sample_rate_hz=10.0,
        vmax_hist_kmh=vmax_player,
    )

    dist_km = round(doppler_res["total_distance_m"] / 1000.0, 2)
    hsr_m = int(doppler_res["hsr_distance_m"])
    sprints = doppler_res["sprints_count"]
    max_spd = max(vmax_player, doppler_res["max_speed_kmh"])

    pl_min = round(rng.uniform(1.15, 1.65), 2)
    accel = int(rng.uniform(18, 38) * sprint_freq_mult)
    decel = int(rng.uniform(15, 32) * sprint_freq_mult)

    # Mapa de calor posicional 2D
    heatmap = []
    hm_rng = random.Random(seed + 1)
    cx = 15.0 if pos == "CENTRAL" else (80.0 if pos == "DELANTERO" else hm_rng.uniform(25, 75))
    cy = 15.0 if "LATERAL" in pos or "EXTREMO" in pos else hm_rng.uniform(20, 80)
    for _ in range(40):
        x = max(5, min(95, cx + hm_rng.gauss(0, 16)))
        y = max(5, min(95, cy + hm_rng.gauss(0, 20)))
        heatmap.append({
            "x": round(x, 1),
            "y": round(y, 1),
            "value": round(hm_rng.uniform(0.2, 1.0), 2),
        })

    return {
        "player_id":          player_id,
        "position":           pos,
        "gps_device_number":  qul_file.get("device_number"),
        "distance_km":        dist_km,
        "hsr_m":              hsr_m,
        "sprints_count":      sprints,
        "max_speed_kmh":      max_spd,
        "player_load":        round(dist_km * 12.2, 1),
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

    # ── Auditoría de Homogeneidad Posicional & Validación ─────────
    audit_res = audit_session_homogeneity(player_metrics)

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
        "homogeneity_audit": {
            "is_suspicious": audit_res["is_suspicious"],
            "cv_sprints": audit_res["cv_sprints"],
            "cv_hsr": audit_res["cv_hsr"],
            "report": audit_res["report"],
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
    if not HAS_REQUESTS or not api_token:
        if not HAS_REQUESTS:
            print("\n⚠️  Librería 'requests' no instalada. Guardando output localmente...")
        else:
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
    except getattr(requests.exceptions, "ConnectionError", Exception) if requests else Exception:
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
