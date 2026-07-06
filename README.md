# ClubLab — v2026.01.02

Plataforma de gestión deportiva para clubes de fútbol. Centraliza la administración de plantillas, planificación de entrenamientos, seguimiento de rendimiento físico, control de lesiones, estadísticas de partidos y gestión de academia.

---

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router) |
| UI | React 19 + Lucide React |
| Estilos | Tailwind CSS v4 + CSS variables |
| Base de datos | Supabase (PostgreSQL + RLS) |
| Autenticación | Supabase Auth + `@supabase/ssr` |
| i18n | next-intl v4 — rutas dinámicas `[locale]` |
| Formularios | react-hook-form + zod |

---

## Setup Local

### 1. Prerrequisitos

- Node.js ≥ 20
- npm ≥ 10

### 2. Variables de entorno

```bash
cp .env.example .env.local
# Rellenar NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### 3. Instalar dependencias

```bash
npm install
```

### 4. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

---

## Estructura de Directorios

```
src/
├── app/
│   ├── [locale]/
│   │   ├── (auth)/          # Login, registro, recuperación de contraseña
│   │   ├── (dashboard)/     # Panel principal (protegido por auth)
│   │   └── onboarding/      # Configuración inicial de org y roles
│   └── api/                 # Route Handlers de Next.js
├── components/
│   ├── layout/              # AppSidebar, BottomNavBar, Header, etc.
│   ├── players/             # Componentes de gestión de jugadores
│   ├── training/            # Componentes de planificación de entrenamientos
│   ├── academy/             # Componentes del módulo Academia
│   ├── settings/            # Ajustes de organización
│   └── ui/                  # Primitivos de UI (shadcn/ui)
├── features/
│   └── performance/         # Lógica de carga y rendimiento físico
├── services/                # Capa de acceso a datos (queries Supabase)
├── lib/
│   ├── supabase/            # Clientes server/client de Supabase
│   ├── permissions/         # Helper `can.ts` para control de acceso
│   ├── licensing/           # Verificación de features por plan
│   └── colors.ts            # Validación de colores de branding
├── hooks/                   # Custom React hooks
├── i18n/                    # Configuración de next-intl
└── types/                   # Tipos globales de TypeScript
supabase/
└── migrations/              # 16 migraciones SQL ordenadas cronológicamente
messages/                    # Archivos de traducción (es, en, ...)
```

---

## Convenciones de Desarrollo

- **Rutas protegidas**: Todo el dashboard verifica sesión en el `layout.tsx` del grupo `(dashboard)`. Si no hay sesión, redirige a `/login`.
- **Colores de marca**: Los colores primario/secundario del club se inyectan como variables CSS (`--primary`, `--primary-foreground`) en el layout. Usar siempre `bg-primary`, `text-primary`, etc. — nunca clases hardcoded de Tailwind como `bg-emerald-500`.
- **Permisos**: Usar el helper `can(user, permission)` de `@/lib/permissions/can` para lógica de autorización en componentes y layouts.
- **Base de datos**: No modificar esquemas en producción sin crear una migración SQL en `supabase/migrations/`.
- **i18n**: Todos los textos de UI van en `messages/{locale}.json`. Usar el hook `useTranslations()` de next-intl.

---

## Historial de Versiones

| Versión | Cambios principales |
|---|---|
| v2026.01.02 | Responsividad móvil (BottomNavBar), limpieza del repo, refactor de branding |
| v2026.01.01 | MVP funcional: dashboard, jugadores, entrenamientos, rendimiento, lesiones, partidos, academia |
