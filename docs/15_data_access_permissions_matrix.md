# 15. ClubLab Data Access & Permissions Matrix (RBAC & RLS Audit)

Este documento especifica la **matriz completa de control de acceso a los datos (RBAC multi-rol y políticas RLS de PostgreSQL)** de ClubLab bajo el principio de **Mínimo Privilegio (Least Privilege)**.

---

## 1. Principio de Mínimo Privilegio (Least Privilege)

Cada usuario de la plataforma únicamente debe tener acceso a la información estrictamente necesaria para realizar sus funciones operativas o deportivas dentro de la organización. Ningún rol técnico no sanitario debe tener acceso directo a notas de diagnóstico médico o fichas fisioterapéuticas confidenciales.

---

## 2. Matriz Exhaustiva: Categoría de Dato × Rol de Usuario

| Categoría de Dato | Jugador (Dueño) | Fisioterapeuta / Médico (`physio`) | Preparador Físico (`physical_coach`) | Primer Entrenador (`head_coach`) / Staff | Director Deportivo (`sporting_director`) | Admin del Club (`club_admin`) | Super Admin SaaS (`super_admin`) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Perfil e Identificación** (`players`, `profiles`) | Lectura / Edición (Propio) | Lectura | Lectura | Lectura | Lectura | Lectura / Escritura | Lectura (Soporte) |
| **Datos Físicos (Altura/Peso)** | Lectura / Edición | Lectura | Lectura / Escritura | Lectura | Lectura | Lectura | Sin Acceso Directo |
| **Cuestionarios Wellness** (`wellness_entries`) | Lectura / Escritura (Propio) | Lectura | Lectura | Lectura | Restringido (Agregado) | Sin Acceso Directo | Sin Acceso Directo |
| **Registros RPE / Carga** (`rpe_entries`, `player_loads`) | Lectura / Escritura (Propio) | Lectura | Lectura / Escritura | Lectura | Restringido (Agregado) | Sin Acceso Directo | Sin Acceso Directo |
| **Listado de Lesiones (Estado / Gravedad)** | Lectura (Propio) | Lectura / Escritura | Lectura | Lectura (Ver Semáforo) | Lectura (Ver Disponibilidad) | Lectura | Sin Acceso Directo |
| **Notas Médicas Confidenciales** (`medical_notes`) | Sin Acceso | **Lectura / Escritura** | **Sin Acceso** | **Sin Acceso** | **Sin Acceso** | **Sin Acceso** (Salvo rol médico asignado) | **Sin Acceso** |
| **Plan de Readaptación** (`rehab_plans`, `rehab_sessions`) | Lectura (Propio) | Lectura / Escritura | Lectura / Escritura | Lectura (Resumen) | Sin Acceso | Sin Acceso | Sin Acceso |
| **Sesiones y Ejercicios** (`training_sessions`) | Lectura | Lectura | Lectura / Escritura | Lectura / Escritura | Lectura | Lectura / Escritura | Sin Acceso |
| **Partidos y Convocatorias** (`matches`) | Lectura | Lectura | Lectura | Lectura / Escritura | Lectura | Lectura / Escritura | Sin Acceso |
| **Vídeo Análisis y Clips** (`videos`, `video_clips`) | Lectura | Lectura | Lectura | Lectura / Escritura | Lectura | Lectura / Escritura | Sin Acceso |
| **Análisis e Insights de IA** (`ai_analyses`) | Lectura (Propios) | Lectura | Lectura | Lectura | Lectura | Lectura / Escritura | Sin Acceso |
| **Registros de Consentimiento** (`user_data_consents`) | Lectura (Propio) | Sin Acceso | Sin Acceso | Sin Acceso | Sin Acceso | **Lectura / Auditoría** | Sin Acceso |

---

## 3. Especificación Término-Técnica para Políticas Supabase RLS

### 3.1. Corrección Obligatoria en RLS para Lesiones (`injuries`)

Actualmente, la política de RLS para notas médicas debe asegurar que la columna `medical_notes` no se filtre a entrenadores:

```sql
-- Política RLS recomendada para la tabla injuries
CREATE POLICY "Permitir lectura de lesiones según rol"
ON public.injuries
FOR SELECT
USING (
    organization_id = auth_org_id()
    AND (
        -- Fisioterapeutas y admins ven la ficha completa
        (auth_user_role() IN ('physio', 'club_admin', 'super_admin'))
        OR
        -- El staff técnico ve la lesión pero la columna medical_notes se filtra mediante Vista o API DTO
        (auth_user_role() IN ('head_coach', 'coach', 'physical_coach', 'sporting_director'))
        OR
        -- El propio jugador ve sus lesiones
        (player_id IN (SELECT id FROM public.players WHERE user_id = auth.uid()))
    )
);
```

### 3.2. Función Helper JWT para Verificación de Permisos Granulares
El backend utiliza la función de comprobación en `src/lib/permissions/can.ts`:

```typescript
// Permiso específico para notas médicas confidenciales
if (permission === 'view_injury_medical_notes') {
    return user.roles.includes('physio') || user.roles.includes('club_admin');
}
```

---

## 4. Resumen de Recomendaciones de Seguridad para Ingeniería

1. **Restricción de `head_coach` en `medical_notes`**: Modificar la vista o DTO de API para que los entrenadores reciban únicamente `availability_status` (`green`, `yellow`, `red`) y `availability_notes` de alto nivel (ej. "No disponible para trabajo con balón"), omitiendo diagnósticos clínicos.
2. **Acceso del Super Admin SaaS**: Aplicar la regla de que el `super_admin` gestiona organizaciones y métricas de plataforma, pero **no tiene acceso por RLS al contenido médico o personal de los jugadores** de los clubes clientes (Cero Conocimiento / Zero Trust).
