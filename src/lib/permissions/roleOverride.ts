import type { UserRole } from "@/types";

export interface RoleOption {
  value: UserRole;
  label: string;
  badge: string;
  description: string;
  iconName: string;
}

export const ROLE_MODE_OPTIONS: RoleOption[] = [
  {
    value: "super_admin",
    label: "Super Admin",
    badge: "⚡ Complete",
    description: "Acceso total y administración global del sistema",
    iconName: "ShieldCheck",
  },
  {
    value: "club_admin",
    label: "Admin de Club",
    badge: "🏢 Gestión",
    description: "Gestión de la organización, equipos, licencias y miembros",
    iconName: "Building2",
  },
  {
    value: "sporting_director",
    label: "Director Deportivo",
    badge: "💼 Dirección",
    description: "Visión panorámica de plantilla, análisis y rendimiento global",
    iconName: "Briefcase",
  },
  {
    value: "academy_director",
    label: "Director de Academia",
    badge: "🎓 Cantera",
    description: "Dashboard de academia, control de equipos base y metodología",
    iconName: "GraduationCap",
  },
  {
    value: "academy_coordinator",
    label: "Coordinador de Academia",
    badge: "📋 Coordinación",
    description: "Gestión operativa de sesiones, partidos y jugadores base",
    iconName: "ClipboardList",
  },
  {
    value: "head_coach",
    label: "Primer Entrenador",
    badge: "⚽ Cuerpo Técnico",
    description: "Planificación táctica, convocatorias, partidos y cargas",
    iconName: "UserCheck",
  },
  {
    value: "coach",
    label: "Entrenador",
    badge: "👥 Técnico",
    description: "Creación de ejercicios, sesiones y gestión de equipo",
    iconName: "Users",
  },
  {
    value: "physical_coach",
    label: "Preparador Físico",
    badge: "🏋️ RPE & Cargas",
    description: "Monitoreo de cargas de trabajo, tests físicos y wellness",
    iconName: "Dumbbell",
  },
  {
    value: "physio",
    label: "Fisioterapeuta",
    badge: "🩹 Médica & Lesiones",
    description: "Historial lesional, notas médicas confidenciales y readaptación",
    iconName: "HeartPulse",
  },
  {
    value: "player",
    label: "Jugador",
    badge: "🏃 Personal",
    description: "Panel del deportista: cuestionario wellness, RPE y sus datos",
    iconName: "User",
  },
];

export const SUPER_ADMIN_EMAILS = ["diecilo7@gmail.com"];

export function isSuperAdminUser(userRole: UserRole, email?: string | null): boolean {
  if (userRole === "super_admin") return true;
  if (email && SUPER_ADMIN_EMAILS.includes(email.toLowerCase().trim())) return true;
  return false;
}
