-- ============================================================
-- ClubLab — Migration 026: Fast RLS via JWT Hooks
-- Optimiza el rendimiento de las políticas de Row Level Security (RLS)
-- inyectando organization_id y role en los claims de JWT.
--
-- FASE 7 — TAREA 7.1
--
-- Por qué se hace:
--   Las políticas RLS evalúan auth_org_id() y auth_user_role() por cada fila.
--   En la versión previa, estas funciones consultaban user_organization_roles
--   en la base de datos (SELECT por cada fila). Con JWT claims, la lectura es
--   O(1) directo de la memoria del token JWT sin hacer accesos a tablas.
--
-- Cómo funciona:
--   1. Se crea la función custom_access_token_hook que Supabase Auth ejecuta al
--      generar el JWT, leyendo e inyectando organization_id y role en app_metadata.
--   2. Se otorgan permisos de ejecución al rol de Supabase supabase_auth_admin.
--   3. Se actualizan auth_org_id() y auth_user_role() para buscar primero en los
--      claims del JWT. Si no están (test/primer login), caen en fallback en la DB.
-- ============================================================

-- 1. Crear función para el hook de JWT
CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  claims jsonb;
  user_org_id uuid;
  user_role text;
BEGIN
  -- Get the current claims from event
  claims := event->'claims';

  -- Retrieve organization and role for the user
  SELECT organization_id, role
  INTO user_org_id, user_role
  FROM public.user_organization_roles
  WHERE user_id = (event->>'user_id')::uuid
  LIMIT 1;

  -- If found, inject them in the app_metadata section of JWT
  IF user_org_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, organization_id}', to_jsonb(user_org_id));
    claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(user_role));
  END IF;

  -- Update the event object with new claims
  event := jsonb_set(event, '{claims}', claims);

  RETURN event;
END;
$$;

-- 2. Otorgar permisos al motor de Auth de Supabase para poder correr el Hook
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.custom_access_token_hook(jsonb) TO supabase_auth_admin;

-- 3. Actualizar auth_org_id con fallback transparente
CREATE OR REPLACE FUNCTION auth_org_id()
RETURNS UUID AS $$
DECLARE
  org_id uuid;
BEGIN
  -- 1. Try reading from JWT claims (O(1) memory lookup)
  BEGIN
    org_id := NULLIF(
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'organization_id',
      ''
    )::uuid;
  EXCEPTION WHEN OTHERS THEN
    org_id := NULL;
  END;

  -- 2. Fallback to querying the DB table (e.g. CLI tests, local seed, pre-refresh)
  IF org_id IS NULL THEN
    SELECT organization_id INTO org_id
    FROM public.user_organization_roles
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. Actualizar auth_user_role con fallback transparente
CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS TEXT AS $$
DECLARE
  usr_role text;
BEGIN
  -- 1. Try reading from JWT claims (O(1) memory lookup)
  BEGIN
    usr_role := NULLIF(
      current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role',
      ''
    );
  EXCEPTION WHEN OTHERS THEN
    usr_role := NULL;
  END;

  -- 2. Fallback to querying the DB table
  IF usr_role IS NULL THEN
    SELECT role INTO usr_role
    FROM public.user_organization_roles
    WHERE user_id = auth.uid()
    LIMIT 1;
  END IF;

  RETURN usr_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION auth_org_id() IS
  'Obtiene el ID de organización activo del usuario. '
  'Prioriza los claims de JWT (O(1) memoria) y cae en consulta SQL si no está presente.';

COMMENT ON FUNCTION auth_user_role() IS
  'Obtiene el rol del usuario en su organización. '
  'Prioriza los claims de JWT (O(1) memoria) y cae en consulta SQL si no está presente.';
