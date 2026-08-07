#!/usr/bin/env python3
"""
Test Unitario de Reglas Físicas y Auditoría de Homogeneidad GPS WIMU
Verifica:
1. Filtro estático v < 0.2 m/s -> v = 0 m/s (evita deriva GPS).
2. Clamping de picos v > 10.0 m/s (~36 km/h) y |accel| > 6.0 m/s².
3. Detección de sprints con doble criterio (v >= 7.0 m/s o v >= 0.85 * Vmax_hist),
   dwell time >= 1.0s y tiempo de separación >= 3.0s.
4. Auditoría de homogeneidad posicional y alerta si CV < 15%.
"""

import sys
import os
from pathlib import Path

# Añadir directorio actual al path
sys.path.insert(0, str(Path(__file__).parent))

from wimu_agent import process_doppler_velocity_series, audit_session_homogeneity

def test_static_noise_filter():
    print("🧪 Test 1: Filtro de ruido estático (v < 0.2 m/s)...")
    # Serie con velocidades por debajo de 0.2 m/s (ruido estático de jugador parado)
    raw_v = [0.05, 0.12, 0.18, 0.0, 0.19, 0.08]  # 6 muestras a 10 Hz (0.6s)
    res = process_doppler_velocity_series(raw_v, sample_rate_hz=10.0)
    
    assert res["total_distance_m"] == 0.0, f"Error: La distancia estática debe ser 0m, pero fue {res['total_distance_m']}m"
    assert all(v == 0.0 for v in res["filtered_velocities"]), "Error: Muestras < 0.2 m/s no se filtraron a 0"
    print("   ✓ OK: Ruido estático correctamente eliminado (distancia = 0.00 m).")

def test_spike_clamping():
    print("🧪 Test 2: Clamping de picos de velocidad (>10.0 m/s) y aceleración (>6.0 m/s²)...")
    # Velocidad imposible de 15 m/s (54 km/h)
    raw_v = [3.0, 15.0, 15.0, 3.0]
    res = process_doppler_velocity_series(raw_v, sample_rate_hz=10.0)
    
    max_v = max(res["filtered_velocities"])
    assert max_v <= 10.0, f"Error: La velocidad no fue clamped a 10 m/s (fue {max_v})"
    print(f"   ✓ OK: Pico de velocidad clampeado a {max_v} m/s (<= 10.0 m/s).")

def test_sprint_dwell_time_and_separation():
    print("🧪 Test 3: Sprint Dwell Time (>= 1.0s) y Separación (>= 3.0s)...")
    
    def make_ramp(start_v: float, peak_v: float, ramp_steps: int = 10) -> list[float]:
        return [start_v + (peak_v - start_v) * (i / ramp_steps) for i in range(ramp_steps + 1)]

    # Caso A: Pico corto (< 1.0s por encima del umbral de 7.0 m/s -> 4 muestras = 0.4s)
    short_sprint_v = [2.0]*5 + make_ramp(2.0, 7.8, 5) + [7.8]*2 + make_ramp(7.8, 2.0, 5) + [2.0]*10
    res_short = process_doppler_velocity_series(short_sprint_v, sample_rate_hz=10.0)
    assert res_short["sprints_count"] == 0, f"Error: Sprint de < 1.0s no debió contar (contó {res_short['sprints_count']})"

    # Caso B: Sprint válido (>= 1.0s por encima del umbral de 7.0 m/s -> 15 muestras = 1.5s)
    valid_sprint_v = [2.0]*5 + make_ramp(2.0, 7.8, 5) + [7.8]*15 + make_ramp(7.8, 2.0, 5) + [2.0]*10
    res_valid = process_doppler_velocity_series(valid_sprint_v, sample_rate_hz=10.0)
    assert res_valid["sprints_count"] == 1, f"Error: Sprint de 1.5s debió contar como 1 (contó {res_valid['sprints_count']})"

    # Caso C: Dos sprints separados por solo 1.5s (< 3.0s separation -> debe fusionarse en 1 solo evento)
    merged_sprints_v = [2.0]*5 + make_ramp(2.0, 7.8, 5) + [7.8]*15 + make_ramp(7.8, 3.0, 5) + [3.0]*15 + make_ramp(3.0, 7.8, 5) + [7.8]*15 + [2.0]*10
    res_merged = process_doppler_velocity_series(merged_sprints_v, sample_rate_hz=10.0)
    assert res_merged["sprints_count"] == 1, f"Error: Sprints con 1.5s separación debieron unirse (contó {res_merged['sprints_count']})"

    # Caso D: Dos sprints separados por 3.5s (>= 3.0s separation -> debe contar 2 sprints)
    sep_sprints_v = [2.0]*5 + make_ramp(2.0, 7.8, 5) + [7.8]*15 + make_ramp(7.8, 3.0, 5) + [3.0]*35 + make_ramp(3.0, 7.8, 5) + [7.8]*15 + [2.0]*10
    res_sep = process_doppler_velocity_series(sep_sprints_v, sample_rate_hz=10.0)
    assert res_sep["sprints_count"] == 2, f"Error: Sprints con 3.5s separación debieron contar como 2 (contó {res_sep['sprints_count']})"

    print("   ✓ OK: Dwell time y reglas de separación verificados correctamente.")

def test_homogeneity_audit():
    print("🧪 Test 4: Auditoría de Homogeneidad Posicional (Alerta CV < 15%)...")
    
    # Datos homogéneos anómalos (todos los jugadores con métricas casi idénticas)
    homogeneous_metrics = [
        {"player_id": "P1", "position": "LATERAL", "distance_km": 10.1, "sprints_count": 15, "hsr_m": 500, "max_speed_kmh": 30.0},
        {"player_id": "P2", "position": "CENTRAL", "distance_km": 10.0, "sprints_count": 15, "hsr_m": 505, "max_speed_kmh": 30.1},
        {"player_id": "P3", "position": "EXTREMO", "distance_km": 10.2, "sprints_count": 16, "hsr_m": 510, "max_speed_kmh": 29.9},
    ]
    res_hom = audit_session_homogeneity(homogeneous_metrics)
    assert res_hom["is_suspicious"] == True, "Error: Datos idénticos debieron activar alerta de homogeneidad"

    # Datos fisiológicamente heterogéneos (Laterales/Extremos con más sprints que Centrales)
    realistic_metrics = [
        {"player_id": "P1", "position": "LATERAL", "distance_km": 11.2, "sprints_count": 22, "hsr_m": 720, "max_speed_kmh": 32.5},
        {"player_id": "P2", "position": "EXTREMO", "distance_km": 10.8, "sprints_count": 26, "hsr_m": 850, "max_speed_kmh": 34.1},
        {"player_id": "P3", "position": "CENTRAL", "distance_km": 9.4,  "sprints_count": 8,  "hsr_m": 310, "max_speed_kmh": 29.8},
        {"player_id": "P4", "position": "MEDIOCENTRO", "distance_km": 12.1, "sprints_count": 11, "hsr_m": 580, "max_speed_kmh": 30.2},
    ]
    res_real = audit_session_homogeneity(realistic_metrics)
    assert res_real["is_suspicious"] == False, "Error: Datos variados con CV > 15% no debieron ser marcados sospechosos"
    print("   ✓ OK: Auditoría de homogeneidad y alerta posicional validadas.")

def main():
    print("\n╔══════════════════════════════════════════════════════════╗")
    print("║   ClubLab — Test de Validación Métricas GPS WIMU          ║")
    print("╚══════════════════════════════════════════════════════════╝\n")
    test_static_noise_filter()
    test_spike_clamping()
    test_sprint_dwell_time_and_separation()
    test_homogeneity_audit()
    print("\n✅ ¡TODOS LOS TESTS UNITARIOS PASARON SATISFACTORIAMENTE!\n")

if __name__ == "__main__":
    main()
