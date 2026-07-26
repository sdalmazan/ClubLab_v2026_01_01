# 07. Technical Specifications

Este documento detalla las especificaciones técnicas para la implementación de las funcionalidades del MVP (Fase 1) de **ClubLab**. Sirve como guía de desarrollo directa para los programadores, estableciendo los esquemas de base de datos, políticas de RLS, firmas de funciones en backend/frontend y criterios de aceptación.

---

## 1. Especificación Técnica: Refactor RBAC Multi-rol

### 1.1. Objetivo
Permitir que un mismo usuario tenga asignados múltiples roles concurrentes en una misma organización (ej. un usuario que es `coach` y `physical_coach` a la vez) para responder a la realidad operativa del fútbol modesto.

### 1.2. Cambios en Base de Datos (Migración SQL)
Debemos eliminar la restricción única que limitaba a un rol por usuario y organización, y reescribir las funciones auxiliares de RLS.

```sql
-- 1. Eliminar restricción UNIQUE anterior
ALTER TABLE user_organization_roles 
  DROP CONSTRAINT IF EXISTS user_organization_roles_user_id_organization_id_key;

-- 2. Crear nueva restricción UNIQUE compuesta por rol
ALTER TABLE user_organization_roles 
  ADD CONSTRAINT user_organization_roles_user_id_org_role_unique UNIQUE (user_id, organization_id, role);

-- 3. Crear función para obtener todos los roles del usuario activo
CREATE OR REPLACE FUNCTION auth_user_roles()
RETURNS TEXT[] AS $$
  SELECT COALESCE(ARRAY_AGG(role), ARRAY[]::TEXT[])
  FROM user_organization_roles
  WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### 1.3. Actualización de Políticas RLS
Toda política de RLS que controle permisos administrativos basados en rol debe ser adaptada para comprobar la existencia del rol dentro del array devuelto por `auth_user_roles()`.

*   **Antes:**
    ```sql
    USING (organization_id = auth_org_id() AND auth_user_role() IN ('club_admin', 'super_admin'));
    ```
*   **Después (Utilizando el operador de solapamiento `&&`):**
    ```sql
    USING (organization_id = auth_org_id() AND auth_user_roles() && ARRAY['club_admin', 'super_admin']);
    ```

### 1.4. Cambios en TypeScript y Lógica de Aplicación
Refactorización del tipo de sesión de usuario y del verificador de permisos en el archivo `@/lib/permissions/can.ts`:

```typescript
// @/types/index.ts
export interface AuthUser {
  id: string;
  email: string;
  organization_id: string;
  organization_slug: string;
  roles: UserRole[]; // Refactorizado de 'role: UserRole'
  team_id: string | null;
  plan_slug: PlanSlug;
}

// @/lib/permissions/can.ts
import { Permission, ROLE_PERMISSIONS } from "./can-definitions";

export function can(user: AuthUser, permission: Permission): boolean {
  // Comprobar si alguno de los roles del usuario contiene el permiso
  return user.roles.some((role) => {
    const rolePerms = ROLE_PERMISSIONS[role];
    return rolePerms ? rolePerms.includes(permission) : false;
  });
}
```

---

## 2. Especificación Técnica: Módulo de Fisioterapia y Lesiones

### 2.1. Objetivo
Registrar lesiones, planes de readaptación física y disponibilidad deportiva de la plantilla, manteniendo la confidencialidad médica y proveyendo un semáforo de disponibilidad al cuerpo técnico.

### 2.2. Esquema de Base de Datos (Tabla `injuries`)
```sql
CREATE TABLE IF NOT EXISTS injuries (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID          NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  player_id           UUID          NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  team_id             UUID          REFERENCES teams(id) ON DELETE SET NULL,
  
  -- Diagnóstico
  injury_type         TEXT          NOT NULL, -- ej. 'Rotura fibrilar', 'Esguince'
  body_part           TEXT          NOT NULL, -- ej. 'Isquiotibiales', 'Tobillo'
  body_side           TEXT          CHECK (body_side IN ('left', 'right', 'central', 'bilateral')),
  severity            TEXT          NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  status              TEXT          NOT NULL DEFAULT 'active' 
                                    CHECK (status IN ('active', 'readaptation', 'resolved')),
  
  -- Fechas
  occurred_date       DATE          NOT NULL DEFAULT CURRENT_DATE,
  expected_return_date DATE,
  actual_return_date  DATE,
  
  -- Metadatos Médicos (Sensibles - Solo acceso Physio)
  mechanism           TEXT,                     -- Mecanismo de producción
  medical_notes       TEXT,                     -- Notas de diagnóstico clínico
  treatment_plan      TEXT,                     -- Plan de fisioterapia
  
  created_by          UUID          REFERENCES auth.users(id),
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_injuries_player ON injuries(player_id);
CREATE INDEX IF NOT EXISTS idx_injuries_org_status ON injuries(organization_id, status);
```

### 2.3. Políticas RLS de Protección Médica
Los datos genéricos de lesión son públicos para el staff técnico, pero las notas y planes médicos detallados se protegen en backend o se filtran en RLS.

```sql
ALTER TABLE injuries ENABLE ROW LEVEL SECURITY;

-- Permiso de lectura general para miembros de la organización
CREATE POLICY "Read injuries within org" ON injuries FOR SELECT
  USING (organization_id = auth_org_id());

-- Permiso de escritura completo exclusivo para Fisioterapeutas y Admins
CREATE POLICY "Manage injuries" ON injuries FOR ALL
  USING (
    organization_id = auth_org_id() 
    AND auth_user_roles() && ARRAY['physio', 'club_admin', 'super_admin']
  );
```

### 2.4. Lógica de Negocio: Semáforo de Disponibilidad del Jugador
Una lesión activa (`active` o `readaptation`) debe cambiar de manera reactiva el estado de disponibilidad del jugador (`availability_status`) en la tabla `players`.

#### Trigger de Base de Datos para Actualizar Estado:
```sql
CREATE OR REPLACE FUNCTION update_player_availability_on_injury()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' THEN
    UPDATE players 
    SET availability_status = 'not_available', physical_status = 'red'
    WHERE id = NEW.player_id;
  ELSIF NEW.status = 'readaptation' THEN
    UPDATE players 
    SET availability_status = 'control', physical_status = 'yellow'
    WHERE id = NEW.player_id;
  ELSIF NEW.status = 'resolved' THEN
    -- Solo restaurar a óptimo si no hay otra lesión activa
    IF NOT EXISTS (
      SELECT 1 FROM injuries 
      WHERE player_id = NEW.player_id AND status IN ('active', 'readaptation') AND id <> NEW.id
    ) THEN
      UPDATE players 
      SET availability_status = 'available', physical_status = 'green'
      WHERE id = NEW.player_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_injury_availability_sync
AFTER INSERT OR UPDATE ON injuries
FOR EACH ROW EXECUTE FUNCTION update_player_availability_on_injury();
```

---

## 3. Plantilla Estándar de Especificación Técnica (Futuro)

Para documentar las siguientes épicas de la Fase 2 y 3, se deberá seguir rigurosamente esta estructura:

1.  **Objetivo y Contexto:** Descripción funcional y por qué se implementa.
2.  **Esquema de Base de Datos:** Sentencias DDL SQL, restricciones y claves foráneas.
3.  **Seguridad y RLS:** Sentencias DCL SQL para RLS y mapeo de permisos RBAC.
4.  **APIs y Handlers:** Contratos JSON de entrada/salida y validaciones de Zod.
5.  **Criterios de Aceptación:** Lista de control de comportamiento esperado en QA.
