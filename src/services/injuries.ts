export type InjuryPhase = 1 | 2 | 3 | 4;

export interface MedicalReport {
  id: string;
  injury_id?: string;
  created_at: string;
  text_summary: string;
  file_url?: string;
  file_name?: string;
  author_name?: string;
}

export interface ActiveInjuryRecord {
  id: string;
  player_id: string;
  player_name?: string;
  body_part: string;
  severity: "light" | "medium" | "severe";
  status: "active" | "readaptation" | "healed";
  recovery_phase: InjuryPhase; // 1: Fisioterapia, 2: Readaptación Campo, 3: Integración Parcial, 4: Alta Competitiva
  expected_return_date?: string; // YYYY-MM-DD
  description?: string;
  reports: MedicalReport[];
  updated_at: string;
}

export interface PhysioConsultation {
  id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // e.g. "16:00"
  slot_duration_min: number; // e.g. 15
  is_open: boolean;
  notes?: string;
}

export interface PhysioAppointment {
  id: string;
  consultation_id?: string;
  player_id: string;
  player_name: string;
  jersey_number?: number | null;
  reason: string;
  selected_time_slots?: string[];
  status: "pending" | "scheduled" | "treated";
  scheduled_time?: string; // e.g. "16:15"
  end_time?: string; // e.g. "16:45"
  fitness_result?: "apto" | "adaptado" | "no_apto";
  notes?: string;
  created_at?: string;
  date?: string;
}

// Exact alignment between Physio (Enfermería) and Fitness Coach (Preparador Físico / Rendimiento)
export const INJURY_PHASE_LABELS: Record<InjuryPhase, { 
  name: string; 
  desc: string; 
  badge: string; 
  fitnessState: string; // Alignment with /performance dashboard state
  attendanceStatus: "present" | "partial" | "readaptation" | "injured";
}> = {
  1: {
    name: "Fase 1: Fisioterapia / Reposo",
    desc: "Baja Médica Total (Tratamiento en camilla y reposo)",
    badge: "bg-destructive/10 text-destructive border-destructive/20",
    fitnessState: "No Disponible (Baja)",
    attendanceStatus: "injured"
  },
  2: {
    name: "Fase 2: Readaptación Campo",
    desc: "Readaptación Física Individual sobre césped (Return to Play)",
    badge: "bg-orange-500/10 text-orange-400 border-orange-500/20",
    fitnessState: "Return to Play (RTP / Césped)",
    attendanceStatus: "readaptation"
  },
  3: {
    name: "Fase 3: Integración Parcial",
    desc: "Parte de Sesión con grupo (Carga Reducida / Sin contacto)",
    badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    fitnessState: "Carga Reducida / Listo c/ Restricciones",
    attendanceStatus: "partial"
  },
  4: {
    name: "Fase 4: Alta Competitiva",
    desc: "Alta Médica Completa (Disponible 100% para convocar)",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    fitnessState: "Listo (100% Disponible)",
    attendanceStatus: "present"
  }
};
