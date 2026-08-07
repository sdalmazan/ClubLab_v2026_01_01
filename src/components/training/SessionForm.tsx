"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Gauge,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  User,
  Users,
  Target,
  PenTool,
  Check,
  AlertCircle,
  ListTodo,
  Copy,
  LayoutGrid,
  FileText,
  Printer,
  Sparkles,
  Smartphone,
  Tablet,
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Eye,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useSidebar } from "@/components/ui/sidebar";
import { PitchGridSelector } from "./PitchGridSelector";
import { EquipmentSelector } from "./EquipmentSelector";
import { GroupPlanner } from "./GroupPlanner";
import { MatchGamePlan } from "./MatchGamePlan";
import { FieldMap } from "@/components/players/FieldMap";
import { SessionPrintReport } from "./SessionPrintReport";
import { TestSessionGrid } from "./TestSessionGrid";
import { TacticalSvgRenderer, hasWhiteboardData } from "./print/TacticalSvgRenderer";
import { prepareAndPrintDocument } from "@/lib/printUtils";
import { TaskWhiteboard, type WhiteboardData } from "./TaskWhiteboard";
import { TacticalConceptsSelector } from "./TacticalConceptsSelector";
import { MuscleGroupsSelector } from "./MuscleGroupsSelector";
import { TACTICAL_CONCEPTS, MUSCLE_GROUPS } from "@/lib/exercise-taxonomy";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "../ui/tooltip";
import type { PlayerWithMembership } from "@/services/players";
import type { ExerciseLibraryItem } from "@/services/tasks";
import type { SessionTemplate, SessionType, LoadLevel, MicrocycleDay, PositionKey } from "@/types";
import { resolveCampogramaSlot } from "@/types";

import { SessionTypePickerModal } from "./SessionTypePickerModal";

interface SessionFormProps {
  organizationId: string;
  userId: string;
  teams: any[];
  squadPlayers: PlayerWithMembership[];
  templates: SessionTemplate[];
  exerciseLibrary: ExerciseLibraryItem[];
  initialData?: any; // If editing
  initialDate?: string | null;
  initialSessionType?: SessionType | null;
  organizationSettings?: any;
  userTeamId?: string | null;
  userRole?: string | null;
}

export function getExerciseTotalDuration(ex: any): number {
  if (!ex) return 0;
  if (ex.use_variable_series && Array.isArray(ex.series) && ex.series.length > 0) {
    return ex.series.reduce((sum: number, s: any) => sum + Number(s.duration_min || 0), 0);
  }
  const nSeries = Number(ex.num_series || 1);
  const sDuration = Number(ex.series_duration_min || ex.duration_min || 15);
  return nSeries * sDuration;
}

export function isGoalkeeper(p: any): boolean {
  if (!p) return false;
  const playerObj = p.player || p;
  
  const positionsArray: string[] = 
    playerObj.membership?.positions || 
    playerObj.positions || 
    p.membership?.positions || 
    p.positions || 
    [];
  
  if (Array.isArray(positionsArray) && positionsArray.length > 0) {
    if (positionsArray.some((pos: string) => {
      const s = String(pos).toLowerCase();
      return s.includes("goalkeeper") || s.includes("por") || s === "gk";
    })) {
      return true;
    }
  }

  const posStr = String(
    playerObj.primary_position || 
    playerObj.position || 
    p.primary_position || 
    p.position || 
    ""
  ).toLowerCase();

  return (
    posStr.includes("goalkeeper") ||
    posStr.includes("portero") ||
    posStr.includes("por") ||
    posStr === "gk"
  );
}

export function SessionForm({
  organizationId,
  userId,
  teams = [],
  squadPlayers = [],
  templates = [],
  exerciseLibrary = [],
  initialData,
  initialDate = null,
  initialSessionType = null,
  organizationSettings,
  userTeamId = null,
  userRole = null,
}: SessionFormProps) {
  const router = useRouter();
  const isEdit = !!initialData;
  const sidebar = useSidebar();

  useEffect(() => {
    // Collapse the main dashboard sidebar when entering this form to give full focus
    sidebar.setOpen(false);
  }, []);

  const isCoordinator = userRole === "super_admin" || userRole === "admin" || userRole === "owner" || userRole === "head_coach";
  const lockTeamSelection = !isCoordinator && !!userTeamId;

  // 1. Basic Fields State
  const [teamId, setTeamId] = useState(() => {
    if (initialData?.team_id) return initialData.team_id;
    if (!isCoordinator && userTeamId) return userTeamId;
    return teams[0]?.id ?? "";
  });
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [date, setDate] = useState(() => initialData?.date || initialDate || new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState(() => {
    if (initialData?.start_time) {
      return initialData.start_time.slice(0, 5);
    }
    return organizationSettings?.default_training_time ?? "19:30";
  });
  const [durationMin, setDurationMin] = useState(initialData?.duration_min ?? 90);
  const [sessionType, setSessionType] = useState<SessionType>(() => initialData?.session_type || initialSessionType || "training");
  const [showTypePickerModal, setShowTypePickerModal] = useState(!initialData && !initialSessionType);
  const [showExitConfirmModal, setShowExitConfirmModal] = useState(false);
  const mapDbToUiMicrocycle = (dbVal: string | null) => {
    if (dbVal === "MD-4") return "Día 1";
    if (dbVal === "MD-3") return "Día 2";
    if (dbVal === "MD-2") return "Día 3";
    if (dbVal === "MD-1") return "Día 4";
    if (dbVal === "MD") return "Día 5";
    if (dbVal === "MD+1") return "Día 6";
    if (dbVal === "MD+2") return "Día 7";
    return "";
  };
  const mapUiToDbMicrocycle = (uiVal: string | null): string | null => {
    if (!uiVal) return null;
    if (uiVal === "Día 1") return "MD-4";
    if (uiVal === "Día 2") return "MD-3";
    if (uiVal === "Día 3") return "MD-2";
    if (uiVal === "Día 4") return "MD-1";
    if (uiVal === "Día 5") return "MD";
    if (uiVal === "Día 6") return "MD+1";
    if (uiVal === "Día 7") return "MD+2";
    const validTags = ['MD-4', 'MD-3', 'MD-2', 'MD-1', 'MD', 'MD+1', 'MD+2'];
    if (validTags.includes(uiVal)) return uiVal;
    return null;
  };
  const [microcycleDay, setMicrocycleDay] = useState<string>(() => mapDbToUiMicrocycle(initialData?.microcycle_day ?? "MD-1"));
  const [expandedZones, setExpandedZones] = useState<Record<number, boolean>>({});
  const [expandedMaterials, setExpandedMaterials] = useState<Record<number, boolean>>({});
  const [plannedLoad, setPlannedLoad] = useState<LoadLevel | "">(initialData?.planned_load ?? "medium");
  const [plannedIntensity, setPlannedIntensity] = useState(initialData?.planned_intensity ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialData?.template_id ?? "");
  const [testGridResults, setTestGridResults] = useState<Record<string, Record<string, string>>>({});

  // Session-level physical & tactical concepts state
  const [sessionTacticalConcepts, setSessionTacticalConcepts] = useState<string[]>(initialData?.tactical_concepts ?? []);
  const [sessionMuscleGroups, setSessionMuscleGroups] = useState<string[]>(initialData?.muscle_groups ?? []);

  // Call timings state
  const [checkinHoursBefore, setCheckinHoursBefore] = useState(
    initialData?.checkin_hours_before ?? organizationSettings?.default_checkin_hours_before ?? 8
  );
  const [checkinCloseMinsBefore, setCheckinCloseMinsBefore] = useState(
    initialData?.checkin_close_mins_before ?? organizationSettings?.default_checkin_close_mins_before ?? 15
  );
  const [checkoutMinsAfter, setCheckoutMinsAfter] = useState(
    initialData?.checkout_mins_after ?? organizationSettings?.default_checkout_mins_after ?? 30
  );
  const [checkoutCloseHoursAfter, setCheckoutCloseHoursAfter] = useState(
    initialData?.checkout_close_hours_after ?? organizationSettings?.default_checkout_close_hours_after ?? 16
  );
  const [showTimingsAccordion, setShowTimingsAccordion] = useState(false);
  
  // Print & Preview state
  const [isPrintPreview, setIsPrintPreview] = useState(false);
  const [previewMode, setPreviewMode] = useState<'tablet' | 'mobile'>('tablet');

  const showIntensity = isEdit && (new Date() > new Date(`${date}T${startTime}`));

  useEffect(() => {
    if (typeof window !== "undefined") {
      const isMobileDevice = /Mobi|Android|iPhone/i.test(navigator.userAgent) || window.innerWidth < 768;
      setPreviewMode(isMobileDevice ? 'mobile' : 'tablet');
    }
  }, []);

  // Blocks show/hide states
  const [showBlock0, setShowBlock0] = useState(() => {
    return initialData?.exercises?.some((ex: any) => ex.group_setup?.block_type === "block0") ?? false;
  });
  const [showWarmupBlock, setShowWarmupBlock] = useState(true);
  const [showCooldownBlock, setShowCooldownBlock] = useState(true);
  const [activeBlockType, setActiveBlockType] = useState<'block0' | 'warmup' | 'main' | 'cooldown'>('main');


  // Year filter for session navigator & preview modal state
  const [navYear, setNavYear] = useState<string>("all");
  const [previewSessionModalData, setPreviewSessionModalData] = useState<any | null>(null);

  // Single task clipboard state (Cross-session copy/paste)
  const [copiedSingleTask, setCopiedSingleTask] = useState<any | null>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("cl_copied_single_exercise");
      if (saved) {
        try { return JSON.parse(saved); } catch (e) {}
      }
    }
    return null;
  });

  // Sidebar with past sessions
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pastSessions, setPastSessions] = useState<any[]>([]);

  // Fetch group training sessions for chronological navigator (oldest to newest)
  useEffect(() => {
    async function loadPastSessions() {
      if (!teamId) return;
      try {
        const supabase = createClient();
        let query = supabase
          .from("training_sessions")
          .select(`
            id,
            title,
            date,
            session_type,
            microcycle_day,
            session_total_seq,
            exercises:session_exercises(
              *,
              exercise:exercises(*)
            )
          `)
          .eq("team_id", teamId)
          .eq("session_type", "training")
          .order("date", { ascending: true });

        if (navYear !== "all") {
          query = query
            .gte("date", `${navYear}-01-01`)
            .lte("date", `${navYear}-12-31`);
        }

        const { data, error } = await query;

        if (error) throw error;
        if (data) setPastSessions(data);
      } catch (err) {
        console.error("Error loading past sessions:", err);
      }
    }
    loadPastSessions();
  }, [teamId, navYear]);

  // Inherit call-up from existing group training session on the same date when adding a test session
  useEffect(() => {
    if (sessionType === "test" && date && pastSessions.length > 0) {
      const existingGroupSession = pastSessions.find(
        (s) => s.date === date && (s.session_type === "training" || s.session_type === "match") && s.id !== initialData?.id
      );
      if (existingGroupSession && Array.isArray(existingGroupSession.session_attendance)) {
        const nextAtt: Record<string, { status: "present" | "partial" | "readaptation" | "injured" | "absent"; notes: string }> = {};
        existingGroupSession.session_attendance.forEach((att: any) => {
          if (att.player_id) {
            nextAtt[att.player_id] = { status: att.status || "present", notes: att.notes || "" };
          }
        });
        if (Object.keys(nextAtt).length > 0) {
          setAttendance((prev) => ({ ...prev, ...nextAtt }));
        }
      }
    }
  }, [sessionType, date, pastSessions, initialData?.id]);

  // Alerts sending state
  const [alertSending, setAlertSending] = useState<Record<string, boolean>>({});
  const [alertSuccess, setAlertSuccess] = useState<Record<string, boolean>>({});

  // Staff alert roster states
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedWarmupStaff, setSelectedWarmupStaff] = useState<string[]>([]);
  const [selectedCooldownStaff, setSelectedCooldownStaff] = useState<string[]>([]);
  const [showWarmupStaffDropdown, setShowWarmupStaffDropdown] = useState(false);
  const [showCooldownStaffDropdown, setShowCooldownStaffDropdown] = useState(false);

  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await fetch("/api/training/sessions/staff");
        if (res.ok) {
          const data = await res.json();
          setStaffList(data);
        }
      } catch (e) {
        console.error("Error loading staff:", e);
      }
    }
    loadStaff();
  }, []);

  // Initialize selected staff from default settings when loaded
  useEffect(() => {
    if (organizationSettings) {
      setSelectedWarmupStaff(organizationSettings.alerts_default_warmup ?? []);
      setSelectedCooldownStaff(organizationSettings.alerts_default_cooldown ?? []);
    }
  }, [organizationSettings]);

  // New: Mesocycle and session sequence
  const [mesocycle, setMesocycle] = useState(initialData?.mesocycle ?? "");
  const [sessionWeekSeq, setSessionWeekSeq] = useState<number>(initialData?.session_week_seq ?? 1);
  const [sessionTotalSeq, setSessionTotalSeq] = useState<number | null>(initialData?.session_total_seq ?? null);

  // Auto calculation of mesocycle, sessionWeekSeq, and sessionTotalSeq based on date and teamId
  useEffect(() => {
    async function calculateAutoFields() {
      if (!teamId) return;
      try {
        const supabase = createClient();
        
        // 1. Pretemporada vs Competición
        const { count: matchCount } = await supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("team_id", teamId)
          .lte("date", date);
        setMesocycle((matchCount ?? 0) > 0 ? "Competición" : "Pretemporada");

        // 2. Count total sessions before/on this date
        const { count: totalCount } = await supabase
          .from("training_sessions")
          .select("id", { count: "exact", head: true })
          .eq("team_id", teamId)
          .lte("date", date);
        setSessionTotalSeq((totalCount ?? 0) + (isEdit ? 0 : 1));

        // 3. Count weekly sessions before/on this date
        const currDate = new Date(date);
        const dayOfWeek = currDate.getDay();
        const monday = new Date(currDate);
        const diff = currDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        monday.setDate(diff);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const { count: weekCount } = await supabase
          .from("training_sessions")
          .select("id", { count: "exact", head: true })
          .eq("team_id", teamId)
          .gte("date", monday.toISOString().slice(0, 10))
          .lte("date", sunday.toISOString().slice(0, 10))
          .lte("date", date);
        setSessionWeekSeq((weekCount ?? 0) + (isEdit ? 0 : 1));
      } catch (e) {
        console.error("Error calculating auto fields:", e);
      }
    }
    calculateAutoFields();
  }, [teamId, date, isEdit]);

  // New: Facilities management
  const [facilities, setFacilities] = useState<any[]>([]);
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>(() => {
    if (initialData?.facility_ids && initialData.facility_ids.length > 0) {
      return initialData.facility_ids;
    }
    if (organizationSettings?.default_facility_id) {
      return [organizationSettings.default_facility_id];
    }
    return [];
  });

  useEffect(() => {
    async function loadFacilities() {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("facilities")
          .select("*")
          .eq("is_active", true)
          .order("name");
        if (error) throw error;
        if (data) setFacilities(data);
      } catch (err) {
        console.error("Error loading facilities:", err);
      }
    }
    loadFacilities();
  }, []);

  // Fetch past sessions for import sidebar
  useEffect(() => {
    async function loadPastSessions() {
      if (!teamId) return;
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("training_sessions")
          .select(`
            id,
            title,
            date,
            session_type,
            exercises:session_exercises(
              *,
              exercise:exercises(*)
            )
          `)
          .eq("team_id", teamId)
          .order("date", { ascending: false })
          .limit(10);

        if (error) throw error;
        if (data) setPastSessions(data);
      } catch (err) {
        console.error("Error loading past sessions:", err);
      }
    }
    loadPastSessions();
  }, [teamId]);

  const [copiedExercise, setCopiedExercise] = useState<any | null>(null);
  const [hasCopiedBlock, setHasCopiedBlock] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHasCopiedBlock(!!localStorage.getItem("cl_copied_block_exercises"));
    }
  }, []);

  // Accordion panel expansion states
  const [isGeneralDataExpanded, setIsGeneralDataExpanded] = useState(true);
  const [isConvocatoriaExpanded, setIsConvocatoriaExpanded] = useState(false);
  const [isObjectivesExpanded, setIsObjectivesExpanded] = useState(false);
  const [expandedExercises, setExpandedExercises] = useState<Record<string, boolean>>({});

  // Whiteboard modal state
  const [whiteboardExerciseIndex, setWhiteboardExerciseIndex] = useState<number | null>(null);

  const [matchGamePlan, setMatchGamePlan] = useState<any>(() => {
    return initialData?.match_game_plan ?? {
      formation: "4-3-3",
      lineup: {},
      substitutes: [],
      instructions: "",
      set_pieces_offensive: "",
      set_pieces_defensive: ""
    };
  });

  // Objectives (array of tags) - fallback/legacy
  const [objectiveInput, setObjectiveInput] = useState("");
  const [objectives, setObjectives] = useState<string[]>(initialData?.objectives ?? []);

  // Filter out inactive players (bajas) and sort by position (Portero, Defensa, Mediocentro, Delantero)
  const activeSquadPlayers = useMemo(() => {
    const filtered = squadPlayers.filter((p) => p.membership?.status !== "inactive");
    
    const positionWeights: Record<string, number> = {
      goalkeeper: 1,
      right_back: 2,
      right_center_back: 2,
      left_center_back: 2,
      left_back: 2,
      defensive_midfielder: 3,
      playmaker_midfielder: 3,
      attacking_midfielder: 3,
      left_winger: 4,
      right_winger: 4,
      striker: 4,
    };

    return [...filtered].sort((a, b) => {
      // Primary: filial/reserve/youth players go to the end of the list
      const cleanFilialList = (organizationSettings?.filial_teams ?? []).map((t: string) => t.toLowerCase().trim());
      const aIsReserve = a.membership?.player_type === "reserve" ||
                         a.membership?.player_type === "youth" ||
                         cleanFilialList.includes((a.membership?.teams?.name ?? "").toLowerCase().trim()) ||
                         (a.membership?.teams?.id && a.membership.teams.id !== teamId);
                         
      const bIsReserve = b.membership?.player_type === "reserve" ||
                         b.membership?.player_type === "youth" ||
                         cleanFilialList.includes((b.membership?.teams?.name ?? "").toLowerCase().trim()) ||
                         (b.membership?.teams?.id && b.membership.teams.id !== teamId);
                         
      if (aIsReserve !== bIsReserve) {
        return aIsReserve ? 1 : -1;
      }

      const aPos = a.membership?.positions?.[0] || "";
      const bPos = b.membership?.positions?.[0] || "";
      const aW = positionWeights[aPos] || 5;
      const bW = positionWeights[bPos] || 5;
      
      if (aW !== bW) return aW - bW;
      
      // Secondary: alphabetical by last name, then first name
      const aName = `${a.last_name || ""} ${a.first_name || ""}`.toLowerCase();
      const bName = `${b.last_name || ""} ${b.first_name || ""}`.toLowerCase();
      return aName.localeCompare(bName);
    });
  }, [squadPlayers, organizationSettings, teamId]);

  // 2. Attendance State (Default: all players present, unless marked injured/readaptation)
  const [attendance, setAttendance] = useState<Record<string, { status: "present" | "partial" | "readaptation" | "injured" | "absent"; notes: string }>>(() => {
    if (initialData?.attendance) {
      const records: Record<string, { status: any; notes: string }> = {};
      initialData.attendance.forEach((att: any) => {
        records[att.player_id] = {
          status: att.status ?? "present",
          notes: att.notes ?? "",
        };
      });
      return records;
    }

    const defaultRecords: Record<string, { status: any; notes: string }> = {};
    activeSquadPlayers.forEach((p) => {
      const activeInjury = p.active_injury;
      let status: "present" | "partial" | "readaptation" | "injured" | "absent" = "present";
      let notes = "";

      if (activeInjury) {
        const phase = (activeInjury as any).recovery_phase;
        if (phase === 3) {
          status = "partial";
          notes = `Parcial (Tareas con grupo): ${activeInjury.body_part || "Muscular"}`;
        } else if (phase === 4) {
          status = "present";
        } else {
          status = "injured";
          notes = `Lesionado (Readaptación al margen): ${activeInjury.body_part || "General"}`;
        }
      }

      defaultRecords[p.id] = { status, notes };
    });
    return defaultRecords;
  });

  // Sync attendance for activeSquadPlayers when loaded
  useEffect(() => {
    if (!activeSquadPlayers || activeSquadPlayers.length === 0) return;
    setAttendance((prev) => {
      let changed = false;
      const next = { ...prev };
      activeSquadPlayers.forEach((p) => {
        if (!next[p.id]) {
          changed = true;
          const activeInjury = p.active_injury;
          let status: "present" | "partial" | "readaptation" | "injured" | "absent" = "present";
          let notes = "";

          if (activeInjury) {
            const phase = (activeInjury as any).recovery_phase;
            if (phase === 3) {
              status = "partial";
              notes = `Parcial (Tareas con grupo): ${activeInjury.body_part || "Muscular"}`;
            } else if (phase === 4) {
              status = "present";
            } else {
              status = "injured";
              notes = `Lesionado (Readaptación al margen): ${activeInjury.body_part || "General"}`;
            }
          }

          next[p.id] = { status, notes };
        }
      });
      return changed ? next : prev;
    });
  }, [activeSquadPlayers]);

  // Computed: list of present player objects
  const presentPlayers = activeSquadPlayers
    .filter((p) => {
      const st = attendance[p.id]?.status ?? (p.active_injury?.status === "active" ? "injured" : "present");
      return st === "present";
    })
    .map((p) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      membership: p.membership,
      active_injury: p.active_injury,
    }));

  // Statistics for convocatoria
  const stats = useMemo(() => {
    const total = activeSquadPlayers.length;
    const injured = activeSquadPlayers.filter(p => p.active_injury && p.active_injury.status === "active").length;
    const present = activeSquadPlayers.filter(p => {
      const st = attendance[p.id]?.status ?? (p.active_injury?.status === "active" ? "injured" : "present");
      return st === "present";
    }).length;
    
    // Goalkeepers availability count
    const totalGKs = activeSquadPlayers.filter(p => isGoalkeeper(p)).length;
    const availableGKs = activeSquadPlayers.filter(p => {
      const isGK = isGoalkeeper(p);
      const notInjured = !p.active_injury || p.active_injury.status !== "active";
      const st = attendance[p.id]?.status ?? (p.active_injury?.status === "active" ? "injured" : "present");
      return isGK && notInjured && st === "present";
    }).length;

    return {
      total,
      injured,
      present,
      available: total - injured,
      totalGKs,
      availableGKs
    };
  }, [activeSquadPlayers, attendance]);

  // 2.5. Map active squad players into campograma slots and attendance statuses
  const playerAssignments = useMemo(() => {
    const map: Partial<Record<PositionKey, any[]>> = {};
    activeSquadPlayers.forEach((p) => {
      const positions = p.membership?.positions || [];
      const primaryPos = positions[0] || "striker";
      const slot = resolveCampogramaSlot(primaryPos);
      
      if (!map[slot]) {
        map[slot] = [];
      }
      
      const cleanFilialList = (organizationSettings?.filial_teams ?? []).map((t: string) => t.toLowerCase().trim());
      const isReserveOrYouth = p.membership?.player_type === "reserve" ||
                              p.membership?.player_type === "youth" ||
                              cleanFilialList.includes((p.membership?.teams?.name ?? "").toLowerCase().trim()) ||
                              (p.membership?.teams?.id && p.membership.teams.id !== teamId);
                              
      map[slot]!.push({
        playerId: p.id,
        name: `${p.first_name} ${p.last_name}`,
        lastName: p.last_name,
        sportingName: `${p.first_name} ${p.last_name.slice(0, 1)}.`,
        isPrimary: true,
        status: p.active_injury?.status === "active" ? "red" : "green",
        isReserveOrYouth,
      });
    });
    return map;
  }, [activeSquadPlayers, organizationSettings, teamId]);

  const attendanceStatuses = useMemo(() => {
    const statuses: Record<string, "present" | "partial" | "readaptation" | "injured" | "absent" | "rest" | "other"> = {};
    activeSquadPlayers.forEach((p) => {
      statuses[p.id] = attendance[p.id]?.status ?? "present";
    });
    return statuses;
  }, [activeSquadPlayers, attendance]);

  const handleTogglePlayerAttendance = (playerId: string) => {
    setAttendance((prev) => {
      const current = prev[playerId]?.status ?? "present";
      let next: "present" | "injured" | "absent" | "readaptation" | "partial";
      if (current === "present") next = "injured";
      else if (current === "injured") next = "absent";
      else if (current === "absent") next = "readaptation";
      else if (current === "readaptation") next = "partial";
      else next = "present";
      
      return {
        ...prev,
        [playerId]: {
          status: next,
          notes: prev[playerId]?.notes ?? "",
        },
      };
    });
  };

  // Set all available players to present
  const selectAllAvailable = () => {
    const nextAttendance = { ...attendance };
    activeSquadPlayers.forEach((p) => {
      const isInjured = p.active_injury && p.active_injury.status === "active";
      nextAttendance[p.id] = {
        status: isInjured ? "injured" : "present",
        notes: isInjured ? nextAttendance[p.id]?.notes || "Lesionado" : ""
      };
    });
    setAttendance(nextAttendance);
  };

  // Set all players to absent
  const deselectAll = () => {
    const nextAttendance = { ...attendance };
    activeSquadPlayers.forEach((p) => {
      nextAttendance[p.id] = {
        status: "absent",
        notes: ""
      };
    });
    setAttendance(nextAttendance);
  };

  // 3. Session Exercises List State
  const [exercises, setExercises] = useState<any[]>(() => {
    if (initialData?.exercises) {
      return initialData.exercises.map((ex: any) => {
        const gs = ex.group_setup || {};
        return {
          exercise_id: ex.exercise_id,
          title: ex.exercise?.title ?? "Ejercicio",
          category: ex.exercise?.category ?? "General",
          duration_min: ex.duration_min,
          recovery_min: ex.recovery_min,
          pitch_zones: ex.pitch_zones ?? [],
          equipment: ex.equipment ?? [],
          group_setup: gs,
          needs_groups: ex.needs_groups ?? ex.exercise?.needs_groups ?? Boolean(gs.groups && gs.groups.length > 0),
          num_groups: ex.num_groups ?? ex.exercise?.num_groups ?? (gs.groups?.length || 2),
          whiteboard_data: ex.whiteboard_data ?? ex.exercise?.whiteboard_data ?? null,
          whiteboard_zone: ex.whiteboard_zone ?? ex.exercise?.whiteboard_zone ?? "full_field",
          space_dimensions: ex.space_dimensions ?? ex.exercise?.space_dimensions ?? "",
          tactical_concepts: ex.tactical_concepts ?? ex.exercise?.tactical_concepts ?? [],
          muscle_groups: ex.muscle_groups ?? ex.exercise?.muscle_groups ?? [],

          // Deserialization of custom blocks / series structure
          block_type: gs.block_type ?? "main",
          use_variable_series: gs.use_variable_series ?? false,
          series: gs.series ?? [],
          num_series: gs.num_series ?? 1,
          series_duration_min: gs.series_duration_min ?? ex.duration_min,
          series_recovery_min: gs.series_recovery_min ?? ex.recovery_min,
          transition_rest_min: gs.transition_rest_min ?? 2,
          rules: gs.rules ?? "",
          objective_notes: gs.objective_notes ?? "",
        };
      });
    }
    return [];
  });

  useEffect(() => {
    if (exercises.some(ex => ex.block_type === 'block0')) {
      setShowBlock0(true);
    }
  }, [exercises]);

  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryTab, setLibraryTab] = useState<string>("all");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline exercise creator states
  const [isCreatingExercise, setIsCreatingExercise] = useState(false);
  const [newExTitle, setNewExTitle] = useState("");
  const [newExCategory, setNewExCategory] = useState("General");
  const [newExDifficulty, setNewExDifficulty] = useState("medium");
  const [newExScope, setNewExScope] = useState("none");
  const [newExDesc, setNewExDesc] = useState("");
  const [newExDuration, setNewExDuration] = useState(10);
  const [newExSeries, setNewExSeries] = useState(1);
  const [newExRecovery, setNewExRecovery] = useState(2);
  const [creatingExLoading, setCreatingExLoading] = useState(false);

  const handleCreateExerciseInline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExTitle.trim()) return;

    setCreatingExLoading(true);
    setError(null);

    try {
      // Create exercise row in DB (even if library_scope === "none") to get a valid UUID for relational integrity
      const res = await fetch("/api/training/exercises", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newExTitle.trim(),
          category: newExCategory,
          difficulty: newExDifficulty,
          library_scope: newExScope || "none",
          description: newExDesc.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al crear la tarea en la base de datos.");
      }

      // Add to session exercises list directly with duration, series, recovery
      addExercise({
        id: data.id,
        title: data.title,
        category: data.category,
        difficulty: data.difficulty,
        library_scope: data.library_scope,
        description: data.description,
        num_series: newExSeries || 1,
        series_duration_min: newExDuration || 10,
        series_recovery_min: newExRecovery || 2,
      } as any);

      // Reset form states
      setNewExTitle("");
      setNewExCategory("General");
      setNewExDifficulty("medium");
      setNewExScope("none");
      setNewExDesc("");
      setNewExDuration(10);
      setNewExSeries(1);
      setNewExRecovery(2);
      setIsCreatingExercise(false);
      setIsLibraryOpen(false);
    } catch (err: any) {
      setError(err.message ?? "Error en la petición");
      alert("No se pudo crear la tarea: " + (err.message ?? "Error desconocido"));
    } finally {
      setCreatingExLoading(false);
    }
  };

  // Auto-update duration based on sum of exercise times (+ transitions)
  useEffect(() => {
    if (exercises.length > 0) {
      const total = exercises.reduce((sum, ex) => {
        let exTime = 0;
        if (ex.use_variable_series && ex.series && ex.series.length > 0) {
          exTime = ex.series.reduce((sSum: number, s: any) => sSum + (s.duration_min || 0) + (s.recovery_min || 0), 0);
        } else {
          exTime = (ex.num_series || 1) * (ex.series_duration_min || 15) + ((ex.num_series || 1) - 1) * (ex.series_recovery_min || 2);
        }
        return sum + exTime + (ex.transition_rest_min || 0);
      }, 0);
      setDurationMin(total);
    }
  }, [exercises]);

  // Handle Template Import on-demand
  const handleImportTemplate = async () => {
    if (!selectedTemplateId) return;

    try {
      const res = await fetch(`/api/training/templates/${selectedTemplateId}`);
      if (!res.ok) throw new Error("Error al obtener la plantilla");
      
      const templateData = await res.json();
      
      // Populate basic properties if not set
      if (templateData.title && !title) setTitle(templateData.title);
      if (templateData.session_type) setSessionType(templateData.session_type);
      if (templateData.duration_min) setDurationMin(templateData.duration_min);
      if (templateData.objectives && templateData.objectives.length > 0) {
        setObjectives(templateData.objectives);
      }
      if (templateData.description && !notes) setNotes(templateData.description);

      // Populate exercises
      if (templateData.exercises && templateData.exercises.length > 0) {
        const imported = templateData.exercises.map((ex: any) => {
          const groupsSetup = ex.group_setup || { groups: [] };
          return {
            exercise_id: ex.exercise_id,
            title: ex.exercise?.title ?? "Ejercicio",
            category: ex.exercise?.category ?? "General",
            duration_min: ex.duration_min,
            recovery_min: ex.recovery_min,
            pitch_zones: ex.pitch_zones ?? [],
            equipment: ex.equipment ?? [],
            group_setup: groupsSetup,

            // Template imports get main block type by default
            block_type: "main",
            use_variable_series: false,
            series: [],
            num_series: 1,
            series_duration_min: ex.duration_min,
            series_recovery_min: ex.recovery_min,
            transition_rest_min: 2,
            rules: "",
            objective_notes: "",
          };
        });
        setExercises(imported);
      }
    } catch (err: any) {
      setError("No se pudo cargar la plantilla seleccionada: " + err.message);
    }
  };

  // Add exercise from library or quick creation
  const addExercise = (item: ExerciseLibraryItem) => {
    // Generate a unique exercise_id for session task instance
    const baseId = item.id || `local_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const exerciseId = exercises.some((ex) => ex.exercise_id === baseId)
      ? `${baseId}_${Date.now()}`
      : baseId;

    // If needs_groups is true, pre-fill groups based on item.num_groups
    const defaultGroups: any[] = [];
    const groupCount = item.num_groups ?? 2;
    if (item.needs_groups) {
      for (let i = 0; i < groupCount; i++) {
        defaultGroups.push({
          name: `Equipo ${String.fromCharCode(65 + i)}`,
          players: [],
        });
      }
    }

    const numSeries = (item as any).num_series ?? 1;
    const seriesDuration = (item as any).series_duration_min ?? 15;
    const seriesRecovery = (item as any).series_recovery_min ?? 2;

    const newItem = {
      exercise_id: exerciseId,
      title: item.title || "Tarea",
      category: item.category ?? "General",
      duration_min: seriesDuration,
      recovery_min: seriesRecovery,
      pitch_zones: [],
      equipment: [],
      group_setup: { groups: defaultGroups },
      needs_groups: false,
      num_groups: item.num_groups ?? 2,
      players_per_group: item.players_per_group ?? "",
      image_url: item.image_url ?? "",
      video_url: item.video_url ?? "",
      whiteboard_data: item.whiteboard_data ?? null,
      whiteboard_zone: item.whiteboard_zone ?? "full_field",
      space_dimensions: item.space_dimensions ?? "",
      tactical_concepts: item.tactical_concepts ?? [],
      muscle_groups: item.muscle_groups ?? [],

      // Custom fields
      block_type: activeBlockType,
      use_variable_series: false,
      series: [],
      num_series: numSeries,
      series_duration_min: seriesDuration,
      series_recovery_min: seriesRecovery,
      transition_rest_min: 2,
      rules: "",
      objective_notes: "",
    };

    setExercises((prev) => [...prev, newItem]);
    setIsLibraryOpen(false);
  };

  // Remove exercise
  const removeExercise = (index: number) => {
    setExercises(exercises.filter((_, idx) => idx !== index));
  };

  // Move exercise up or down in order
  const moveExercise = (index: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= exercises.length) return;

    const copy = [...exercises];
    const temp = copy[index];
    copy[index] = copy[targetIdx];
    copy[targetIdx] = temp;
    setExercises(copy);
  };

  // Copy exercise to global clipboard & React state
  const copyExercise = (index: number) => {
    const ex = exercises[index];
    const taskToCopy = {
      ...ex,
      exercise_id: (ex.exercise_id || "task").split('_copy_')[0] + '_copy_' + Date.now(),
    };
    if (typeof window !== "undefined") {
      localStorage.setItem("cl_copied_single_exercise", JSON.stringify(taskToCopy));
    }
    setCopiedExercise(taskToCopy);
    setCopiedSingleTask(taskToCopy);
  };

  // Paste exercise from clipboard into active/target block
  const pasteExercise = (targetBlock?: 'block0' | 'warmup' | 'main' | 'cooldown') => {
    const taskToPaste = copiedSingleTask || copiedExercise;
    if (!taskToPaste) return;

    const blockTypeToUse = targetBlock || activeBlockType || 'main';
    const pastedEx = {
      ...taskToPaste,
      exercise_id: (taskToPaste.exercise_id || "task").split('_copy_')[0] + '_copy_' + Date.now(),
      block_type: blockTypeToUse,
      group_setup: {
        ...(taskToPaste.group_setup || {}),
        groups: ((taskToPaste.group_setup || {}).groups ?? []).map((g: any) => ({
          name: g.name,
          players: [],
        })),
      },
    };
    setExercises(prev => [...prev, pastedEx]);
    setExpandedExercises(prev => ({ ...prev, [pastedEx.exercise_id]: true }));
  };

  const copyBlockExercises = (blockType: 'warmup' | 'main' | 'cooldown') => {
    const blockExercises = exercises.filter(ex => {
      if (blockType === 'warmup') return ex.block_type === 'warmup';
      if (blockType === 'cooldown') return ex.block_type === 'cooldown';
      return !ex.block_type || ex.block_type === 'main';
    });
    
    if (blockExercises.length === 0) {
      alert("No hay tareas en este bloque para copiar.");
      return;
    }

    localStorage.setItem("cl_copied_block_exercises", JSON.stringify(blockExercises));
    setHasCopiedBlock(true);
    alert(`Se han copiado ${blockExercises.length} tareas del bloque al portapapeles.`);
  };

  const pasteBlockExercises = (targetBlockType: 'warmup' | 'main' | 'cooldown') => {
    const raw = localStorage.getItem("cl_copied_block_exercises");
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      const newPasted = parsed.map((ex: any, idx: number) => {
        return {
          ...ex,
          exercise_id: (ex.exercise_id || "ex").split('_copy_')[0].split('_dup_')[0] + '_copy_' + (Date.now() + idx),
          block_type: targetBlockType,
          group_setup: {
            ...ex.group_setup,
            groups: (ex.group_setup?.groups ?? []).map((g: any) => ({
              name: g.name,
              players: [],
            })),
          },
        };
      });

      setExercises(prev => [...prev, ...newPasted]);
      setExpandedExercises(prev => {
        const next = { ...prev };
        newPasted.forEach((ex: any) => { next[ex.exercise_id] = true; });
        return next;
      });
      alert(`Se han pegado ${newPasted.length} tareas en este bloque.`);
    } catch (e) {
      console.error("Error pasting block:", e);
    }
  };

  // Duplicate exercise in-place
  const duplicateExercise = (index: number) => {
    const ex = exercises[index];
    const duplicated = {
      ...ex,
      exercise_id: ex.exercise_id + '_dup_' + Date.now(),
      group_setup: {
        ...ex.group_setup,
        groups: (ex.group_setup?.groups ?? []).map((g: any) => ({
          name: g.name,
          players: [],
        })),
      },
    };
    const newExercises = [...exercises];
    newExercises.splice(index + 1, 0, duplicated);
    setExercises(newExercises);
    setExpandedExercises(prev => ({ ...prev, [duplicated.exercise_id]: true }));
  };

  // Update specific exercise field state
  const updateExerciseField = (index: number, field: string, value: any) => {
    const updated = exercises.map((ex, idx) => {
      if (idx === index) {
        return { ...ex, [field]: value };
      }
      return ex;
    });
    setExercises(updated);
    if (field === "facility_id" && value && !selectedFacilityIds.includes(value)) {
      setSelectedFacilityIds(prev => [...prev, value]);
    }
  };

  // Attendance handlers
  const handleAttendanceChange = (playerId: string, status: any) => {
    setAttendance((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        status,
      },
    }));
  };

  const handleAttendanceNotes = (playerId: string, notes: string) => {
    setAttendance((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        notes,
      },
    }));
  };

  // Objectives handling
  const handleAddObjective = (e: React.FormEvent) => {
    e.preventDefault();
    if (objectiveInput.trim() && !objectives.includes(objectiveInput.trim())) {
      setObjectives([...objectives, objectiveInput.trim()]);
      setObjectiveInput("");
    }
  };

  const handleRemoveObjective = (tag: string) => {
    setObjectives(objectives.filter((o) => o !== tag));
  };

  // Send empty block completed alert to selected staff members
  const sendStaffAlert = async (blockType: 'warmup' | 'cooldown', userIds: string[]) => {
    if (userIds.length === 0) {
      alert("Por favor, selecciona al menos un miembro del staff técnico para alertar.");
      return;
    }
    setAlertSending(prev => ({ ...prev, [blockType]: true }));
    try {
      const res = await fetch("/api/training/sessions/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: initialData?.id || null,
          sessionTitle: title || "Sin título",
          blockType,
          userIds
        })
      });
      if (!res.ok) throw new Error("Error al enviar alerta");
      setAlertSuccess(prev => ({ ...prev, [blockType]: true }));
      setTimeout(() => {
        setAlertSuccess(prev => ({ ...prev, [blockType]: false }));
      }, 4000);
    } catch (err) {
      console.error(err);
      alert("No se pudo enviar la alerta al staff.");
    } finally {
      setAlertSending(prev => ({ ...prev, [blockType]: false }));
    }
  };

  // Past sessions quick copy functions
  const importFullSession = (pastSess: any) => {
    if (!pastSess.exercises) return;

    // Copy session level metadata
    setTitle(pastSess.title ? `${pastSess.title} (Clon)` : "");
    if (pastSess.duration_min) setDurationMin(pastSess.duration_min);
    if (pastSess.session_type) setSessionType(pastSess.session_type);
    if (pastSess.planned_load) setPlannedLoad(pastSess.planned_load);
    if (pastSess.planned_intensity) setPlannedIntensity(pastSess.planned_intensity);
    if (pastSess.notes) setNotes(pastSess.notes);
    if (pastSess.objectives) setObjectives(pastSess.objectives);
    if (pastSess.tactical_concepts) setSessionTacticalConcepts(pastSess.tactical_concepts);
    if (pastSess.muscle_groups) setSessionMuscleGroups(pastSess.muscle_groups);
    if (pastSess.start_time) setStartTime(pastSess.start_time.slice(0, 5));

    const imported = pastSess.exercises.map((ex: any) => {
      const gs = ex.group_setup || {};
      return {
        exercise_id: ex.exercise_id,
        title: ex.exercise?.title ?? "Ejercicio",
        category: ex.exercise?.category ?? "General",
        duration_min: ex.duration_min,
        recovery_min: ex.recovery_min,
        pitch_zones: ex.pitch_zones ?? [],
        equipment: ex.equipment ?? [],
        group_setup: gs,
        whiteboard_data: ex.whiteboard_data ?? null,
        whiteboard_zone: ex.whiteboard_zone ?? "full_field",
        space_dimensions: ex.space_dimensions ?? "",
        tactical_concepts: ex.tactical_concepts ?? [],
        muscle_groups: ex.muscle_groups ?? [],
        
        block_type: gs.block_type ?? "main",
        use_variable_series: gs.use_variable_series ?? false,
        series: gs.series ?? [],
        num_series: gs.num_series ?? 1,
        series_duration_min: gs.series_duration_min ?? ex.duration_min,
        series_recovery_min: gs.series_recovery_min ?? ex.recovery_min,
        transition_rest_min: gs.transition_rest_min ?? 2,
        rules: gs.rules ?? "",
        objective_notes: gs.objective_notes ?? "",
        facility_id: gs.facility_id ?? null,
      };
    });
    setExercises(imported);
  };

  const importBlockFromSession = (pastSess: any, srcBlockType: 'warmup' | 'main' | 'cooldown', targetBlockType: 'warmup' | 'main' | 'cooldown') => {
    if (!pastSess.exercises) return;
    const toImport = pastSess.exercises
      .filter((ex: any) => {
        const bt = ex.group_setup?.block_type ?? "main";
        return bt === srcBlockType;
      })
      .map((ex: any) => {
        const gs = ex.group_setup || {};
        return {
          exercise_id: ex.exercise_id,
          title: ex.exercise?.title ?? "Ejercicio",
          category: ex.exercise?.category ?? "General",
          duration_min: ex.duration_min,
          recovery_min: ex.recovery_min,
          pitch_zones: ex.pitch_zones ?? [],
          equipment: ex.equipment ?? [],
          group_setup: gs,
          whiteboard_data: ex.whiteboard_data ?? null,
          whiteboard_zone: ex.whiteboard_zone ?? "full_field",
          space_dimensions: ex.space_dimensions ?? "",
          tactical_concepts: ex.tactical_concepts ?? [],
          muscle_groups: ex.muscle_groups ?? [],
          
          block_type: targetBlockType,
          use_variable_series: gs.use_variable_series ?? false,
          series: gs.series ?? [],
          num_series: gs.num_series ?? 1,
          series_duration_min: gs.series_duration_min ?? ex.duration_min,
          series_recovery_min: gs.series_recovery_min ?? ex.recovery_min,
          transition_rest_min: gs.transition_rest_min ?? 2,
          rules: gs.rules ?? "",
          objective_notes: gs.objective_notes ?? "",
          facility_id: gs.facility_id ?? null,
        };
      });
    setExercises(prev => [...prev.filter(ex => ex.block_type !== targetBlockType), ...toImport]);
  };

  const importSingleExercise = (ex: any, targetBlockType: 'warmup' | 'main' | 'cooldown') => {
    const gs = ex.group_setup || {};
    const newItem = {
      exercise_id: ex.exercise_id,
      title: ex.exercise?.title ?? "Ejercicio",
      category: ex.exercise?.category ?? "General",
      duration_min: ex.duration_min,
      recovery_min: ex.recovery_min,
      pitch_zones: ex.pitch_zones ?? [],
      equipment: ex.equipment ?? [],
      group_setup: gs,
      whiteboard_data: ex.whiteboard_data ?? null,
      whiteboard_zone: ex.whiteboard_zone ?? "full_field",
      space_dimensions: ex.space_dimensions ?? "",
      tactical_concepts: ex.tactical_concepts ?? [],
      muscle_groups: ex.muscle_groups ?? [],
      
      block_type: targetBlockType,
      use_variable_series: gs.use_variable_series ?? false,
      series: gs.series ?? [],
      num_series: gs.num_series ?? 1,
      series_duration_min: gs.series_duration_min ?? ex.duration_min,
      series_recovery_min: gs.series_recovery_min ?? ex.recovery_min,
      transition_rest_min: gs.transition_rest_min ?? 2,
      rules: gs.rules ?? "",
      objective_notes: gs.objective_notes ?? "",
      facility_id: gs.facility_id ?? null,
    };
    setExercises(prev => [...prev, newItem]);
    setExpandedExercises(prev => ({ ...prev, [newItem.exercise_id]: true }));
  };

  // Save session form
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError("Por favor, introduce el título de la sesión.");
      return;
    }

    setSaving(true);
    setError(null);

    // Format payload using active squad players only
    const attendancePayload = activeSquadPlayers.map((p) => ({
      player_id: p.id,
      status: attendance[p.id]?.status ?? "present",
      notes: attendance[p.id]?.notes ?? null,
    }));

    const exercisesPayload = exercises.map((ex, index) => {
      // Clean players assigned to groups who might have been marked absent
      const cleanedGroups = (ex.group_setup?.groups ?? []).map((group: any) => ({
        ...group,
        players: (group.players ?? []).filter((id: string) =>
          attendance[id]?.status === "present"
        ),
      }));

      // Serialize custom fields into the group_setup JSONB block
      const serializedGroupSetup = {
        ...ex.group_setup,
        groups: cleanedGroups,
        block_type: ex.block_type,
        use_variable_series: ex.use_variable_series,
        series: ex.series,
        num_series: ex.num_series,
        series_duration_min: ex.series_duration_min,
        series_recovery_min: ex.series_recovery_min,
        transition_rest_min: ex.transition_rest_min,
        rules: ex.rules,
        objective_notes: ex.objective_notes,
        facility_id: ex.facility_id || null,
      };

      const cleanExerciseId = (ex.exercise_id || "").split("_dup_")[0].split("_copy_")[0];

      return {
        exercise_id: cleanExerciseId,
        order_index: index,
        duration_min: Number(ex.duration_min || ex.series_duration_min || 15),
        recovery_min: Number(ex.recovery_min || ex.series_recovery_min || 2),
        pitch_zones: ex.pitch_zones,
        equipment: ex.equipment,
        group_setup: serializedGroupSetup,
        needs_groups: Boolean(ex.needs_groups || (serializedGroupSetup.groups && serializedGroupSetup.groups.length > 0)),
        num_groups: ex.num_groups !== undefined ? Number(ex.num_groups) : (serializedGroupSetup.groups?.length || 2),
        players_per_group: ex.players_per_group || null,
        image_url: ex.image_url || null,
        video_url: ex.video_url || null,
        whiteboard_data: ex.whiteboard_data || null,
        whiteboard_zone: ex.whiteboard_zone || "full_field",
        space_dimensions: ex.space_dimensions || null,
        tactical_concepts: ex.tactical_concepts || [],
        muscle_groups: ex.muscle_groups || [],
      };
    });

    const activeTeam = teams.find((t) => t.id === teamId);
    const seasonId = activeTeam?.season_id ?? null;

    const payload = {
      team_id: teamId,
      season_id: seasonId,
      title: title.trim(),
      date,
      start_time: startTime + ":00",
      duration_min: Number(durationMin),
      session_type: sessionType,
      microcycle_day: mapUiToDbMicrocycle(microcycleDay),
      planned_load: plannedLoad || null,
      planned_intensity: plannedIntensity.trim() || null,
      mesocycle: mesocycle.trim() || null,
      session_week_seq: sessionWeekSeq || null,
      session_total_seq: sessionTotalSeq || null,
      objectives,
      tactical_concepts: sessionTacticalConcepts,
      muscle_groups: sessionMuscleGroups,
      notes: notes.trim() || null,
      template_id: selectedTemplateId || null,
      attendance: attendancePayload,
      exercises: (sessionType === "match" || sessionType === "test") ? [] : exercisesPayload,
      match_game_plan: sessionType === "match" ? matchGamePlan : null,
      checkin_hours_before: Number(checkinHoursBefore),
      checkin_close_mins_before: Number(checkinCloseMinsBefore),
      checkout_mins_after: Number(checkoutMinsAfter),
      checkout_close_hours_after: Number(checkoutCloseHoursAfter),
      facility_ids: selectedFacilityIds,
    };

    try {
      const url = isEdit ? `/api/training/sessions/${initialData.id}` : "/api/training/sessions";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const resData = await res.json();
      if (!res.ok) {
        throw new Error(resData.error ?? "Error al guardar la sesión.");
      }

      if (sessionType === "test" && testGridResults && Object.keys(testGridResults).length > 0) {
        const testEntries: any[] = [];
        for (const player of squadPlayers) {
          const pValues = testGridResults[player.id];
          if (!pValues) continue;
          for (const [tId, val] of Object.entries(pValues)) {
            if (val != null && val !== "") {
              testEntries.push({
                playerId: player.id,
                testId: tId,
                testName: tId,
                unit: "",
                value: Number(val) || val,
                date,
              });
            }
          }
        }

        if (testEntries.length > 0) {
          await fetch("/api/training/tests", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamId,
              date,
              entries: testEntries,
            }),
          });
        }
      }

      router.push("/training");
      router.refresh();
    } catch (err: any) {
      console.error("[SessionForm handleSave Error]:", err);
      setError(err.message ?? "Error en la petición");
      alert("Error al guardar la sesión: " + (err.message ?? "Error de servidor al guardar la sesión."));
      setSaving(false);
    }
  };

  const handleCancelExit = () => {
    setShowExitConfirmModal(true);
  };

  const labelClass = "block text-xs font-medium text-muted-foreground mb-1.5";
  const inputClass =
    "w-full rounded-lg bg-background border border-border px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all";
  const selectClass =
    "w-full rounded-lg bg-background border border-border px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer";

  // Filter tasks by block type
  const block0Exercises = exercises.filter(ex => ex.block_type === 'block0');
  const warmupExercises = exercises.filter(ex => ex.block_type === 'warmup');
  const mainExercises = exercises.filter(ex => !ex.block_type || ex.block_type === 'main');
  const cooldownExercises = exercises.filter(ex => ex.block_type === 'cooldown');

  return (
    <>
      <div className="flex gap-6 max-w-7xl mx-auto items-start relative">
        {/* ── LEFT FORM AREA (75%) ── */}
        <form onSubmit={handleSave} className="flex-1 flex flex-col gap-6 no-print overflow-hidden">
          {/* Top Control Close Bar */}
          <div className="flex items-center justify-between bg-white/[0.02] border border-white/5 rounded-2xl p-4 no-print shadow-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Planificador de Sesión</span>
            </div>
            <button
              type="button"
              onClick={handleCancelExit}
              className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-350 hover:text-white text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
              title="Cerrar sin guardar"
            >
              <X className="h-4 w-4" />
              <span>Cerrar</span>
            </button>
          </div>

          {/* ── BARRA NAVEGADORA DE SESIONES (CRONOLÓGICA DE IZQ A DER - SOLO ENTRENAMIENTOS GRUPALES) ── */}
          {pastSessions.length > 0 && (
            <div className="bg-card rounded-lg border border-border p-4 space-y-3 no-print shadow-md">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 corp-icon text-emerald-400" />
                  <span className="text-xs font-bold text-white uppercase tracking-wider">
                    Navegador Cronológico de Sesiones (Entrenamientos Grupales)
                  </span>
                </div>

                {/* Year / Season Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Temporada / Año:</span>
                  <select
                    value={navYear}
                    onChange={(e) => setNavYear(e.target.value)}
                    className="text-[10px] bg-slate-900 border border-white/10 text-white rounded-lg px-2.5 py-1 focus:outline-none cursor-pointer font-bold"
                  >
                    <option value="all">Todas las Sesiones</option>
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                    <option value="2024">2024</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {pastSessions.map((s, idx) => {
                  const isCurrent = s.id === initialData?.id;
                  const mdLabel = s.microcycle_day || "MD-1";
                  const mdColor =
                    mdLabel === "MD"
                      ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                      : mdLabel.includes("-1") || mdLabel.includes("-2")
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                      : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30";

                  const sessionTitle = s.title || `Sesión ${s.session_total_seq || (idx + 1)}`;

                  return (
                    <div
                      key={s.id}
                      className={cn(
                        "flex flex-col justify-between p-3 rounded-xl border min-w-[210px] max-w-[230px] shrink-0 transition-all space-y-2.5",
                        isCurrent
                          ? "bg-emerald-500/10 border-emerald-500/50 shadow-md ring-1 ring-emerald-500/30"
                          : "bg-white/3 border-white/10 hover:border-white/20 hover:bg-white/5"
                      )}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={cn("text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider", mdColor)}>
                            {mdLabel}
                          </span>
                          <span className="text-[9px] text-slate-400 font-mono">
                            {new Date(s.date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" })}
                          </span>
                        </div>
                        <p className="text-xs font-extrabold text-white truncate" title={sessionTitle}>
                          {sessionTitle}
                        </p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {(s.exercises || []).length} tareas en sesión
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5 pt-1.5 border-t border-white/5">
                        <button
                          type="button"
                          onClick={() => {
                            if (s.id !== initialData?.id) {
                              router.push(`/training/${s.id}/edit`);
                            }
                          }}
                          className={cn(
                            "flex-1 text-[9.5px] font-bold py-1 rounded transition-colors text-center cursor-pointer",
                            isCurrent
                              ? "bg-emerald-500 text-slate-950 font-extrabold"
                              : "bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 border border-white/5"
                          )}
                        >
                          {isCurrent ? "Editando" : "Ir a Sesión"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPreviewSessionModalData(s)}
                          className="px-2 py-1 rounded bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 border border-sky-500/20 text-[9.5px] font-bold cursor-pointer flex items-center gap-1"
                          title="Ver preview táctica de la sesión con dibujos"
                        >
                          <Eye className="h-3 w-3" />
                          <span>Preview</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <style dangerouslySetInnerHTML={{ __html: `
            input[type="date"]::-webkit-calendar-picker-indicator,
            input[type="time"]::-webkit-calendar-picker-indicator {
              filter: invert(0.8) grayscale(1);
              cursor: pointer;
            }
            input[type="date"],
            input[type="time"] {
              color-scheme: dark !important;
            }
            input[type="number"]::-webkit-inner-spin-button,
            input[type="number"]::-webkit-outer-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
            input[type="number"] {
              -moz-appearance: textfield;
            }
          `}} />

          {error && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-400 flex items-start gap-2.5">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* ── DATOS GENERALES ── */}
          <div className="bg-card rounded-lg border border-border overflow-hidden transition-all duration-300">
            {/* Header Accordion Toggle */}
            <div 
              onClick={() => setIsGeneralDataExpanded(!isGeneralDataExpanded)}
              className="p-5 flex items-center justify-between gap-4 cursor-pointer select-none border-b border-white/5 hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <PenTool className="h-5 w-5 corp-icon text-emerald-400 shrink-0" />
                <h2 className="text-base font-extrabold text-white tracking-tight truncate">
                  Datos Generales de la Sesión
                </h2>
                {!isGeneralDataExpanded && (
                  <span className="text-[10px] bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded font-bold truncate max-w-[200px]">
                    {title || "Sin título"} • {date}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                {/* Toggle past sessions sidebar button */}
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-bold transition-all cursor-pointer select-none",
                    isSidebarOpen
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 shadow-sm"
                      : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                  )}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span>{isSidebarOpen ? "Cerrar Historial" : "Historial Copiar/Pegar"}</span>
                </button>

                <div 
                  onClick={() => setIsGeneralDataExpanded(!isGeneralDataExpanded)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white cursor-pointer transition-all"
                >
                  <ChevronRight className={cn("h-5 w-5 transition-transform duration-200", isGeneralDataExpanded && "rotate-90")} />
                </div>
              </div>
            </div>

            {/* Collapsible Content */}
            {isGeneralDataExpanded && (
              <div className="p-6 space-y-6 animate-in fade-in duration-200">

            {/* Template Quick Import */}
            {!isEdit && templates.length > 0 && (
              <div className="p-4 rounded-xl border border-white/5 bg-white/2 flex items-end gap-3 flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <label htmlFor="import-template" className={labelClass}>Precargar Plantilla de Sesión</label>
                  <select
                    id="import-template"
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className={selectClass}
                  >
                    <option value="" className="bg-slate-900">-- Ninguna plantilla --</option>
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id} className="bg-slate-900">
                        {tpl.title} ({tpl.session_type})
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={!selectedTemplateId}
                  onClick={handleImportTemplate}
                  className="rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-bold px-4 py-3 transition-all cursor-pointer disabled:opacity-50"
                >
                  Importar plantilla
                </button>
              </div>
            )}

            {/* Title & Team */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="session-title" className={labelClass}>Título de la Sesión *</label>
                <input
                  id="session-title"
                  type="text"
                  required
                  placeholder="Ej: Sesión MD-1 Activación y Velocidad"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="session-team" className={labelClass}>Equipo</label>
                <select
                  id="session-team"
                  disabled={isEdit || lockTeamSelection}
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  className={selectClass}
                >
                  {teams.map((t) => (
                    <option key={t.id} value={t.id} className="bg-slate-900">
                      {t.name} ({t.category || "General"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Facilities / Campos Multiselector */}
            <div className="space-y-1.5 pt-1">
              <label className={labelClass}>Instalaciones / Campos de la Sesión (Multiselección)</label>
              <div className="flex flex-wrap gap-2">
                {facilities.map((fac) => {
                  const isSelected = selectedFacilityIds.includes(fac.id);
                  return (
                    <button
                      key={fac.id}
                      type="button"
                      onClick={() => {
                        if (isSelected) {
                          setSelectedFacilityIds(selectedFacilityIds.filter((id) => id !== fac.id));
                        } else {
                          setSelectedFacilityIds([...selectedFacilityIds, fac.id]);
                        }
                      }}
                      className={cn(
                        "px-3 py-1.5 rounded-xl border text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1.5",
                        isSelected
                          ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm"
                          : "bg-white/5 border-white/10 text-slate-400 hover:bg-white/10"
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", isSelected ? "bg-emerald-400" : "bg-slate-500")} />
                      <span>{fac.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Date, Time, Load, Duration, Type, Intensity */}
            <div className={cn("grid gap-3", showIntensity ? "grid-cols-2 md:grid-cols-6" : "grid-cols-2 md:grid-cols-5")}>
              <div>
                <label htmlFor="session-date" className={labelClass}>Fecha</label>
                <div className="relative">
                  <input
                    id="session-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={cn(inputClass, "pl-9 text-xs")}
                  />
                  <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              <div>
                <label htmlFor="session-time" className={labelClass}>Hora</label>
                <div className="relative">
                  <input
                    id="session-time"
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className={cn(inputClass, "pl-9 text-xs")}
                  />
                  <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              </div>
              {sessionType !== "test" && (
                <div>
                  <label htmlFor="session-load" className={labelClass}>Carga Planificada</label>
                  <select
                    id="session-load"
                    value={plannedLoad}
                    onChange={(e) => setPlannedLoad(e.target.value as LoadLevel)}
                    className={cn(selectClass, "text-xs")}
                  >
                    <option value="" className="bg-slate-900">Sin carga</option>
                    <option value="recovery" className="bg-slate-900">Recuperación</option>
                    <option value="low" className="bg-slate-900">Baja</option>
                    <option value="medium" className="bg-slate-900">Media</option>
                    <option value="medium_high" className="bg-slate-900">Media-Alta</option>
                    <option value="high" className="bg-slate-900">Alta</option>
                  </select>
                </div>
              )}
              {showIntensity && sessionType !== "test" && (
                <div>
                  <label htmlFor="session-intensity" className={labelClass}>Intensidad Percibida (RPE)</label>
                  <select
                    id="session-intensity"
                    value={plannedIntensity}
                    onChange={(e) => setPlannedIntensity(e.target.value)}
                    className={cn(selectClass, "text-xs")}
                  >
                    <option value="" className="bg-slate-900">RPE (1-10)</option>
                    <option value="1" className="bg-slate-900">1 - Muy Fácil</option>
                    <option value="2" className="bg-slate-900">2 - Fácil</option>
                    <option value="3" className="bg-slate-900">3 - Moderado</option>
                    <option value="4" className="bg-slate-900">4 - Algo Duro</option>
                    <option value="5" className="bg-slate-900">5 - Duro</option>
                    <option value="6" className="bg-slate-900">6 - Bastante Duro</option>
                    <option value="7" className="bg-slate-900">7 - Muy Duro</option>
                    <option value="8" className="bg-slate-900">8 - Extremadamente Duro</option>
                    <option value="9" className="bg-slate-900">9 - Casi Máximo</option>
                    <option value="10" className="bg-slate-900">10 - Máximo</option>
                  </select>
                </div>
              )}
              <div>
                <label htmlFor="session-duration" className={labelClass}>Duración Total (min)</label>
                <input
                  id="session-duration"
                  type="number"
                  required
                  readOnly
                  placeholder="Calculado"
                  value={durationMin}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-emerald-450 font-bold focus:outline-none"
                />
              </div>
              <div className="col-span-2 md:col-span-1">
                <label htmlFor="session-type" className={labelClass}>Tipo de Sesión</label>
                <select
                  id="session-type"
                  value={sessionType}
                  onChange={(e) => setSessionType(e.target.value as SessionType)}
                  className={cn(selectClass, "text-xs")}
                >
                  <option value="training" className="bg-slate-900">Entrenamiento Grupal</option>
                  <option value="individual" className="bg-slate-900">Entrenamiento Individual</option>
                  <option value="match" className="bg-slate-900">Partido</option>
                  <option value="test" className="bg-slate-900">Sesión de Test & Valoración Física</option>
                </select>
              </div>
            </div>

            {/* Sequential Metrics Metadata Bar */}
            {initialData?.metrics && (
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white/3 border border-white/5 rounded-xl px-4 py-2 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Mesociclo:</span>
                  <span className="font-bold text-white">{initialData.metrics.meso || "—"}</span>
                </div>
                <div className="hidden sm:block h-3 w-px bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Microciclo:</span>
                  <span className="font-bold text-white">Semana {initialData.metrics.micro || "—"}</span>
                </div>
                <div className="hidden sm:block h-3 w-px bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Orden Semana:</span>
                  <span className="font-bold text-white">{initialData.metrics.orden_semana || "—"}ª Sesión</span>
                </div>
                <div className="hidden sm:block h-3 w-px bg-white/10" />
                <div className="flex items-center gap-1.5">
                  <span className="text-[9px] font-extrabold uppercase text-slate-400 tracking-wider">Sesión Absoluta:</span>
                  <span className="font-bold text-emerald-400">Sesión #{initialData.metrics.total_sesiones || "—"}</span>
                </div>
              </div>
            )}

            {/* Dynamic Physical & Tactical Objectives */}
            {sessionType !== "match" && sessionType !== "test" && (
              <div className="border-t border-white/5 pt-4">
                <div 
                  onClick={() => setIsObjectivesExpanded(!isObjectivesExpanded)}
                  className="flex items-center justify-between cursor-pointer select-none text-xs font-bold text-slate-400 uppercase tracking-wider pb-2 hover:text-white transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    🎯 Objetivos de la Sesión ({sessionTacticalConcepts.length + sessionMuscleGroups.length} seleccionados)
                  </span>
                  <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", isObjectivesExpanded && "rotate-90")} />
                </div>
                
                {!isObjectivesExpanded && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {sessionTacticalConcepts.map(cKey => {
                      const concept = TACTICAL_CONCEPTS.find(c => c.key === cKey);
                      return concept ? (
                        <span key={cKey} className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-full px-2.5 py-0.5 font-bold">
                          {concept.label}
                        </span>
                      ) : null;
                    })}
                    {sessionMuscleGroups.map(mKey => {
                      const muscle = MUSCLE_GROUPS.find(m => m.key === mKey);
                      return muscle ? (
                        <span key={mKey} className="text-[9px] bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-full px-2.5 py-0.5 font-bold">
                          {muscle.label}
                        </span>
                      ) : null;
                    })}
                    {sessionTacticalConcepts.length === 0 && sessionMuscleGroups.length === 0 && (
                      <span className="text-[10px] text-slate-500 italic font-medium ml-1">Ningún objetivo seleccionado</span>
                    )}
                  </div>
                )}

                {isObjectivesExpanded && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-3 animate-in fade-in duration-200">
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-bold text-slate-450 uppercase tracking-wider">
                        Objetivos Tácticos de la Sesión
                      </span>
                      <TacticalConceptsSelector
                        value={sessionTacticalConcepts}
                        onChange={setSessionTacticalConcepts}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <span className="block text-[10px] font-bold text-slate-455 uppercase tracking-wider">
                        Objetivos Físicos de la Sesión
                      </span>
                      <MuscleGroupsSelector
                        value={sessionMuscleGroups}
                        onChange={setSessionMuscleGroups}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            <div className="space-y-4">
              <div>
                <label htmlFor="session-notes" className={labelClass}>Observaciones / Notas Manuales</label>
                <textarea
                  id="session-notes"
                  rows={3}
                  placeholder="Añadir observaciones sobre el clima, organización o foco general."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div className="flex justify-end border-t border-white/5 pt-3">
                <button
                  type="button"
                  onClick={() => setIsGeneralDataExpanded(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-[11px] font-bold transition-all cursor-pointer select-none"
                >
                  <ChevronUp className="h-3.5 w-3.5 text-emerald-400" />
                  <span>Listo / Contraer Datos Generales</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

          {/* ── CONVOCATORIA Y ASISTENCIA ── */}
          <div className="bg-card rounded-lg border border-border overflow-hidden transition-all duration-300">
            {/* Header Accordion Toggle */}
            <div 
              onClick={() => setIsConvocatoriaExpanded(!isConvocatoriaExpanded)}
              className="p-5 flex items-center justify-between gap-4 cursor-pointer select-none border-b border-white/5 hover:bg-white/[0.02] transition-colors flex-wrap"
            >
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 corp-icon text-emerald-400" />
                <h2 className="text-base font-extrabold text-white tracking-tight">
                  Convocatoria y Asistencia ({stats.present} / {stats.total} convocados)
                </h2>
              </div>
              
              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                {isConvocatoriaExpanded && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={selectAllAvailable}
                      className="rounded-lg bg-white/10 hover:bg-white/15 border border-white/10 text-white text-[10px] font-bold px-3 py-1.5 transition-all cursor-pointer"
                    >
                      Convocar Disponibles
                    </button>
                    <button
                      type="button"
                      onClick={deselectAll}
                      className="rounded-lg bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/20 text-rose-455 text-[10px] font-bold px-3 py-1.5 transition-all cursor-pointer"
                    >
                      Deseleccionar Todos
                    </button>
                  </div>
                )}

                <div 
                  onClick={() => setIsConvocatoriaExpanded(!isConvocatoriaExpanded)}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-slate-400 hover:text-white cursor-pointer transition-all"
                >
                  <ChevronRight className={cn("h-5 w-5 transition-transform duration-200", isConvocatoriaExpanded && "rotate-90")} />
                </div>
              </div>
            </div>

            {/* Collapsible Content */}
            {isConvocatoriaExpanded && (
              <div className="p-6 space-y-4 animate-in fade-in duration-200">

            {/* Statistics Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-white/2 border border-white/5 rounded-xl text-center">
                <span className="block text-[8px] font-extrabold uppercase text-slate-500 tracking-wider">Total Convocados</span>
                <span className="font-extrabold text-sm text-white">{stats.present} / {stats.total}</span>
              </div>
              <div className="p-3 bg-white/2 border border-white/5 rounded-xl text-center">
                <span className="block text-[8px] font-extrabold uppercase text-slate-500 tracking-wider">Jugadores Disponibles</span>
                <span className="font-extrabold text-sm text-emerald-400">{stats.available} / {stats.total}</span>
              </div>
              <div className="p-3 bg-white/2 border border-white/5 rounded-xl text-center">
                <span className="block text-[8px] font-extrabold uppercase text-slate-500 tracking-wider">Porteros Disponibles</span>
                <span className="font-extrabold text-sm text-sky-400">{stats.availableGKs} / {stats.totalGKs}</span>
              </div>
            </div>

            {/* Interactive Campograma Selection Field */}
            <div className="flex flex-col gap-4">
              <div className="max-w-[420px] mx-auto w-full border border-white/5 rounded-2xl overflow-hidden shadow-2xl bg-slate-950/60 p-3">
                <FieldMap
                  assignments={playerAssignments}
                  hideMetadata={true}
                  interactive={false}
                  onPlayerClick={handleTogglePlayerAttendance}
                  attendanceStatuses={attendanceStatuses}
                />
              </div>
              <p className="text-[10px] text-center text-slate-500 italic">
                * Haz clic sobre un jugador en el campograma para alternar su estado: Convocado (normal) → Ausente (opaco con línea) → Lesionado (cruz roja ✚).
              </p>
            </div>

            {/* Full Squad Roster Grid (No Scroll - 5 Color-Coded Statuses) */}
            <div className="space-y-3 mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Listado de Convocatoria (Haz clic o selecciona el estado)
                </span>
                <span className="text-[9px] text-slate-500 italic">
                  🟩 Disponible | 🟨 Parte Sesión | 🟧 Readaptación | 🟥 Lesionado | ⬜ Ausente
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {activeSquadPlayers.map((p) => {
                  const currentStatus = attendance[p.id]?.status ?? "present";
                  
                  const badgeStyle =
                    currentStatus === "present"
                      ? "bg-emerald-600 text-white border-emerald-500"
                      : currentStatus === "injured"
                      ? "bg-rose-600 text-white border-rose-500"
                      : currentStatus === "absent"
                      ? "bg-amber-600 text-white border-amber-500"
                      : currentStatus === "readaptation"
                      ? "bg-pink-600 text-white border-pink-500"
                      : "bg-yellow-400 text-slate-950 border-yellow-300";

                  const statusLabel =
                    currentStatus === "present"
                      ? "ENTRENA [S]"
                      : currentStatus === "injured"
                      ? "LESIÓN [L]"
                      : currentStatus === "absent"
                      ? "VARIOS [V]"
                      : currentStatus === "readaptation"
                      ? "ENFERMO / REA [E]"
                      : "PARCIAL [P]";

                  return (
                    <div
                      key={p.id}
                      className="p-2.5 rounded-xl bg-white/2 border border-white/5 flex flex-col justify-between space-y-2 hover:border-white/10 transition-all"
                    >
                      <span className="text-xs font-bold text-white truncate" title={p.sporting_name || `${p.first_name} ${p.last_name}`}>
                        {p.sporting_name || `${p.first_name} ${p.last_name}`}
                      </span>

                      <div className="flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => handleTogglePlayerAttendance(p.id)}
                          className={cn(
                            "text-[8.5px] font-black px-2 py-0.5 rounded border transition-all cursor-pointer truncate shadow-sm",
                            badgeStyle
                          )}
                          title="Haz clic para alternar estado"
                        >
                          {statusLabel}
                        </button>

                        <select
                          value={currentStatus}
                          onChange={(e) => handleAttendanceChange(p.id, e.target.value as any)}
                          className="text-[8px] bg-slate-900 border border-white/10 text-slate-300 rounded px-1 py-0.5 focus:outline-none cursor-pointer"
                        >
                          <option value="present" className="bg-slate-900 text-emerald-400">S - ENTRENA (Verde)</option>
                          <option value="injured" className="bg-slate-900 text-rose-400">L - LESIÓN (Rojo)</option>
                          <option value="absent" className="bg-slate-900 text-amber-400">V - VARIOS (Naranja)</option>
                          <option value="readaptation" className="bg-slate-900 text-pink-400">E - ENFERMO / REA (Rosa)</option>
                          <option value="partial" className="bg-slate-900 text-yellow-400">P - PARCIAL (Amarillo)</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Notes/Observations list for non-present players */}
            {activeSquadPlayers.some(p => (attendance[p.id]?.status ?? "present") !== "present") && (
              <div className="space-y-3 mt-4 pt-4 border-t border-white/5">
                <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Observaciones de Convocatoria (Motivos y Lesiones)</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeSquadPlayers
                    .filter(p => (attendance[p.id]?.status ?? "present") !== "present")
                    .map(p => {
                      const att = attendance[p.id] || { status: "absent", notes: "" };
                      const labelText =
                        att.status === "injured" ? "LESIÓN (L)" :
                        att.status === "absent" ? "VARIOS (V)" :
                        att.status === "readaptation" ? "ENFERMO / REA (E)" : "PARCIAL (P)";

                      return (
                        <div key={p.id} className="flex items-center gap-2 bg-white/2 border border-white/5 rounded-xl p-2.5">
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-white block truncate">{p.first_name} {p.last_name}</span>
                            <span className="text-[9px] text-amber-400 font-extrabold uppercase">{labelText}</span>
                          </div>
                          <input
                            type="text"
                            placeholder="Motivo / Notas"
                            value={att.notes}
                            onChange={(e) => handleAttendanceNotes(p.id, e.target.value)}
                            className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none w-[160px] sm:w-[200px]"
                          />
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
            {/* Collapse button at the bottom of Convocatoria */}
            <div className="flex justify-end border-t border-white/5 pt-3 mt-4">
              <button
                type="button"
                onClick={() => setIsConvocatoriaExpanded(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-[11px] font-bold transition-all cursor-pointer select-none"
              >
                <ChevronUp className="h-3.5 w-3.5 text-emerald-400" />
                <span>Listo / Contraer Convocatoria</span>
              </button>
            </div>
          </div>
        )}
      </div>

          {/* ── SESIÓN DE TEST (Solo para test) ── */}
          {sessionType === "test" && (
            <TestSessionGrid
              sessionDate={date}
              teamId={teamId}
              squadPlayers={squadPlayers}
              onChangeResults={setTestGridResults}
            />
          )}

          {/* ── PLAN DE PARTIDO (Solo para partido) ── */}
          {sessionType === "match" && (
            <div className="bg-card rounded-lg border border-border p-6 space-y-4">
              <h2 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                <Users className="h-5 w-5 corp-icon" />
                Plan de Partido (Alineación y ABP)
              </h2>
              <MatchGamePlan
                presentPlayers={presentPlayers}
                value={matchGamePlan}
                onChange={setMatchGamePlan}
                interactive={true}
                organizationSettings={organizationSettings}
              />
            </div>
          )}

          {/* ── EXERCISES TIMELINE BUILDER ── */}
          {sessionType === "individual" ? (
            /* SIMPLIFIED INDIVIDUAL SESSION CONFIGURATION */
            <div className="bg-card rounded-lg p-5 border border-border space-y-4">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div>
                  <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                    <Sparkles className="h-4 w-4 corp-text" />
                    Plan de Entrenamiento Individual ({exercises.length} tareas)
                  </h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Configuración simplificada de trabajo individual específico por jugador (series, repeticiones, cargas y descansos sin división en 4 bloques).
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveBlockType("main");
                    setLibraryTab("main");
                    setIsLibraryOpen(true);
                  }}
                  className="rounded-xl btn-corporate text-white text-xs font-bold px-3.5 py-2 transition-all cursor-pointer flex items-center gap-1.5 shadow"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir Tarea / Rutina
                </button>
              </div>

              {exercises.length === 0 ? (
                <div className="py-8 text-center border border-dashed border-white/10 rounded-xl bg-black/10 flex flex-col items-center justify-center space-y-2">
                  <Sparkles className="h-6 w-6 text-slate-500 opacity-50" />
                  <p className="text-xs text-slate-400 font-medium">No hay tareas asignadas a la sesión individual</p>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveBlockType("main");
                      setLibraryTab("main");
                      setIsLibraryOpen(true);
                    }}
                    className="text-xs font-bold corp-text hover:underline cursor-pointer"
                  >
                    + Seleccionar tareas o rutinas de la biblioteca
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {exercises.map((ex) => renderExerciseCard(ex))}
                </div>
              )}
            </div>
          ) : sessionType !== "match" && sessionType !== "test" ? (
            <div className="space-y-6">
              {/* Block 0: PRE-SESSION (Vídeo / Fuerza / Activación Previa) */}
              {!showBlock0 ? (
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-dashed border-purple-500/20 bg-purple-500/5 transition-all">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-extrabold text-purple-300 block">
                          Bloque 0: Vídeo / Fuerza / Activación
                        </span>
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          ⚡ Previo al Entrenamiento
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400">
                        Actívalo para incluir sesiones de vídeo en vestuario, gimnasio o calentamiento previo antes de saltar al campo.
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowBlock0(true)}
                    className="text-[10.5px] font-extrabold text-purple-300 hover:text-white bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg px-3 py-1.5 transition-all cursor-pointer shadow flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>+ Activar Bloque 0</span>
                  </button>
                </div>
              ) : (
                <div className="bg-card rounded-lg p-5 border border-purple-500/30 space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 flex-wrap gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-purple-500 animate-pulse" />
                          Bloque 0: Vídeo / Fuerza / Activación Previa ({block0Exercises.length} tareas)
                        </h3>
                        <span className="text-[9px] font-extrabold uppercase px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          ⚡ Previo al Entrenamiento
                        </span>
                      </div>
                      <p className="text-[10px] text-purple-200/80 mt-1 font-medium">
                        ℹ️ <strong>Aviso:</strong> Este bloque se ejecuta previamente a la sesión de entrenamiento en campo (ej. vídeo táctico en vestuario, fuerza en gimnasio o prevención).
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!copiedSingleTask}
                        onClick={() => pasteExercise('block0')}
                        className={cn(
                          "rounded-lg text-[10px] font-extrabold px-2.5 py-1.5 transition-all flex items-center gap-1 border shadow",
                          copiedSingleTask
                            ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30 cursor-pointer"
                            : "bg-white/5 text-slate-500 border-white/10 opacity-50 cursor-not-allowed"
                        )}
                        title={copiedSingleTask ? `Pegar "${copiedSingleTask.title}"` : "Copia una tarea primero para pegarla aquí"}
                      >
                        <Copy className="h-3 w-3" />
                        <span>📋 Pegar Tarea {copiedSingleTask ? `(${copiedSingleTask.title})` : ""}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveBlockType("block0");
                          setLibraryTab("strength");
                          setIsLibraryOpen(true);
                        }}
                        className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-bold px-3 py-1.5 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Añadir
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowBlock0(false)}
                        className="rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[10px] font-bold px-2 py-1.5 border border-white/5 transition-all cursor-pointer"
                        title="Ocultar Bloque 0"
                      >
                        Ocultar
                      </button>
                    </div>
                  </div>

                  {block0Exercises.length === 0 && (
                    <div className="py-3 text-center border border-dashed border-white/5 rounded-xl bg-black/5 flex items-center justify-center">
                      <p className="text-[11px] text-slate-500 italic font-medium">No hay tareas de vídeo o activación en el Bloque 0</p>
                    </div>
                  )}

                  {/* Render Block 0 Exercises */}
                  <div className="space-y-4">
                    {block0Exercises.map((ex) => renderExerciseCard(ex))}
                  </div>
                </div>
              )}

              {/* Block A: WARM-UP (Calentamiento) */}
              {showWarmupBlock && (
                <div className="bg-card rounded-lg p-5 border border-border space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 flex-wrap gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                        Bloque 1: Calentamiento ({warmupExercises.length} tareas)
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Foco de activación física, neuromuscular o técnica.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!copiedSingleTask}
                        onClick={() => pasteExercise('warmup')}
                        className={cn(
                          "rounded-lg text-[10px] font-extrabold px-2.5 py-1.5 transition-all flex items-center gap-1 border shadow",
                          copiedSingleTask
                            ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30 cursor-pointer"
                            : "bg-white/5 text-slate-500 border-white/10 opacity-50 cursor-not-allowed"
                        )}
                        title={copiedSingleTask ? `Pegar "${copiedSingleTask.title}"` : "Copia una tarea primero para pegarla aquí"}
                      >
                        <Copy className="h-3 w-3" />
                        <span>📋 Pegar Tarea {copiedSingleTask ? `(${copiedSingleTask.title})` : ""}</span>
                      </button>

                      {/* Send Alert Button if empty */}
                      {warmupExercises.length === 0 && (
                        <div className="relative inline-flex items-center gap-0">
                          {/* Alert Button */}
                          <button
                            type="button"
                            disabled={alertSending.warmup}
                            onClick={() => sendStaffAlert("warmup", selectedWarmupStaff)}
                            className="rounded-l-lg bg-yellow-500/10 hover:bg-yellow-500/15 border-y border-l border-yellow-500/20 text-yellow-400 text-[10px] font-bold px-2.5 py-1.5 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          >
                            {alertSuccess.warmup 
                              ? "✓ ¡Alerta Enviada!" 
                              : alertSending.warmup 
                                ? "Enviando..." 
                                : `🔔 Alertar (${selectedWarmupStaff.length})`
                            }
                          </button>
                          
                          {/* Dropdown Toggle Arrow */}
                          <button
                            type="button"
                            onClick={() => setShowWarmupStaffDropdown(!showWarmupStaffDropdown)}
                            className="rounded-r-lg bg-yellow-500/10 hover:bg-yellow-500/15 border border-yellow-500/20 text-yellow-400 p-1.5 transition-all cursor-pointer flex items-center justify-center"
                          >
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showWarmupStaffDropdown && "rotate-180")} />
                          </button>

                          {/* Dropdown Menu Popup Overlay */}
                          {showWarmupStaffDropdown && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setShowWarmupStaffDropdown(false)} />
                              <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-white/10 bg-slate-950 p-3 shadow-2xl z-40 space-y-2 text-left">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-1">Seleccionar Destinatarios:</p>
                                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                                  {staffList.length === 0 ? (
                                    <p className="text-slate-550 text-[10px] italic">No hay staff disponible</p>
                                  ) : (
                                    staffList.map((sm) => {
                                      const isChecked = selectedWarmupStaff.includes(sm.id);
                                      return (
                                        <label key={sm.id} className="flex items-center gap-2 text-[10px] text-slate-300 cursor-pointer hover:text-white transition-colors">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedWarmupStaff([...selectedWarmupStaff, sm.id]);
                                              } else {
                                                setSelectedWarmupStaff(selectedWarmupStaff.filter(id => id !== sm.id));
                                              }
                                            }}
                                            className="rounded border-white/10 bg-white/5 text-emerald-600 focus:ring-emerald-500/50"
                                          />
                                          <span className="truncate">{sm.name} <span className="text-[8px] text-slate-500">({sm.role})</span></span>
                                        </label>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveBlockType("warmup");
                          setLibraryTab("warmup");
                          setIsLibraryOpen(true);
                        }}
                        className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-bold px-3 py-1.5 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Añadir
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Clear warmup exercises & hide
                          setExercises(prev => prev.filter(ex => ex.block_type !== 'warmup'));
                          setShowWarmupBlock(false);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Eliminar Bloque de Calentamiento"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {warmupExercises.length === 0 && (
                    <div className="py-3 text-center border border-dashed border-white/5 rounded-xl bg-black/5 flex items-center justify-center">
                      <p className="text-[11px] text-slate-500 italic font-medium">No hay tareas en el calentamiento</p>
                    </div>
                  )}

                  {/* Render Warmup Exercises */}
                  <div className="space-y-4">
                    {warmupExercises.map((ex) => renderExerciseCard(ex))}
                  </div>
                </div>
              )}

              {/* Block B: MAIN PART (Parte Principal) */}
              <div className="bg-card rounded-lg p-5 border border-border space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      Bloque 2: Parte Principal ({mainExercises.length} tareas)
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Tareas y situaciones táctico-cognitivas centrales.</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={!copiedSingleTask}
                      onClick={() => pasteExercise('main')}
                      className={cn(
                        "rounded-lg text-[10px] font-extrabold px-2.5 py-1.5 transition-all flex items-center gap-1 border shadow",
                        copiedSingleTask
                          ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30 cursor-pointer"
                          : "bg-white/5 text-slate-500 border-white/10 opacity-50 cursor-not-allowed"
                      )}
                      title={copiedSingleTask ? `Pegar "${copiedSingleTask.title}"` : "Copia una tarea primero para pegarla aquí"}
                    >
                      <Copy className="h-3 w-3" />
                      <span>📋 Pegar Tarea {copiedSingleTask ? `(${copiedSingleTask.title})` : ""}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setActiveBlockType("main");
                        setLibraryTab("main");
                        setIsLibraryOpen(true);
                      }}
                      className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-bold px-3 py-1.5 transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="h-3 w-3" />
                      Añadir
                    </button>
                  </div>
                </div>

                {mainExercises.length === 0 && (
                  <div className="py-3 text-center border border-dashed border-white/5 rounded-xl bg-black/5 flex items-center justify-center">
                    <p className="text-[11px] text-slate-500 italic font-medium">No hay tareas en la parte principal</p>
                  </div>
                )}

                {/* Render Main Exercises */}
                <div className="space-y-4">
                  {mainExercises.map((ex) => renderExerciseCard(ex))}
                </div>
              </div>

              {/* Block C: COOLDOWN (Vuelta a la Calma) */}
              {showCooldownBlock && (
                <div className="bg-card rounded-lg p-5 border border-border space-y-4">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 flex-wrap gap-2">
                    <div>
                      <h3 className="text-sm font-extrabold text-white tracking-tight flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-cyan-500 animate-pulse" />
                        Bloque 3: Vuelta a la Calma ({cooldownExercises.length} tareas)
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">Estiramientos, regenerativo o crioterapia.</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={!copiedSingleTask}
                        onClick={() => pasteExercise('cooldown')}
                        className={cn(
                          "rounded-lg text-[10px] font-extrabold px-2.5 py-1.5 transition-all flex items-center gap-1 border shadow",
                          copiedSingleTask
                            ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border-emerald-500/30 cursor-pointer"
                            : "bg-white/5 text-slate-500 border-white/10 opacity-50 cursor-not-allowed"
                        )}
                        title={copiedSingleTask ? `Pegar "${copiedSingleTask.title}"` : "Copia una tarea primero para pegarla aquí"}
                      >
                        <Copy className="h-3 w-3" />
                        <span>📋 Pegar Tarea {copiedSingleTask ? `(${copiedSingleTask.title})` : ""}</span>
                      </button>

                      {/* Send Alert Button if empty */}
                      {cooldownExercises.length === 0 && (
                        <div className="relative inline-flex items-center gap-0">
                          {/* Alert Button */}
                          <button
                            type="button"
                            disabled={alertSending.cooldown}
                            onClick={() => sendStaffAlert("cooldown", selectedCooldownStaff)}
                            className="rounded-l-lg bg-yellow-500/10 hover:bg-yellow-500/15 border-y border-l border-yellow-500/20 text-yellow-400 text-[10px] font-bold px-2.5 py-1.5 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1"
                          >
                            {alertSuccess.cooldown 
                              ? "✓ ¡Alerta Enviada!" 
                              : alertSending.cooldown 
                                ? "Enviando..." 
                                : `🔔 Alertar (${selectedCooldownStaff.length})`
                            }
                          </button>
                          
                          {/* Dropdown Toggle Arrow */}
                          <button
                            type="button"
                            onClick={() => setShowCooldownStaffDropdown(!showCooldownStaffDropdown)}
                            className="rounded-r-lg bg-yellow-500/10 hover:bg-yellow-500/15 border border-yellow-500/20 text-yellow-400 p-1.5 transition-all cursor-pointer flex items-center justify-center"
                          >
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", showCooldownStaffDropdown && "rotate-180")} />
                          </button>

                          {/* Dropdown Menu Popup Overlay */}
                          {showCooldownStaffDropdown && (
                            <>
                              <div className="fixed inset-0 z-30" onClick={() => setShowCooldownStaffDropdown(false)} />
                              <div className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-white/10 bg-slate-950 p-3 shadow-2xl z-40 space-y-2 text-left">
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest border-b border-white/5 pb-1">Seleccionar Destinatarios:</p>
                                <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                                  {staffList.length === 0 ? (
                                    <p className="text-slate-550 text-[10px] italic">No hay staff disponible</p>
                                  ) : (
                                    staffList.map((sm) => {
                                      const isChecked = selectedCooldownStaff.includes(sm.id);
                                      return (
                                        <label key={sm.id} className="flex items-center gap-2 text-[10px] text-slate-300 cursor-pointer hover:text-white transition-colors">
                                          <input
                                            type="checkbox"
                                            checked={isChecked}
                                            onChange={(e) => {
                                              if (e.target.checked) {
                                                setSelectedCooldownStaff([...selectedCooldownStaff, sm.id]);
                                              } else {
                                                setSelectedCooldownStaff(selectedCooldownStaff.filter(id => id !== sm.id));
                                              }
                                            }}
                                            className="rounded border-white/10 bg-white/5 text-emerald-600 focus:ring-emerald-500/50"
                                          />
                                          <span className="truncate">{sm.name} <span className="text-[8px] text-slate-500">({sm.role})</span></span>
                                        </label>
                                      );
                                    })
                                  )}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveBlockType("cooldown");
                          setLibraryTab("cooldown");
                          setIsLibraryOpen(true);
                        }}
                        className="rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white text-[10px] font-bold px-3 py-1.5 transition-all cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="h-3 w-3" />
                        Añadir
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          // Clear cooldown exercises & hide
                          setExercises(prev => prev.filter(ex => ex.block_type !== 'cooldown'));
                          setShowCooldownBlock(false);
                        }}
                        className="text-slate-500 hover:text-rose-400 p-1"
                        title="Eliminar Bloque de Vuelta a la Calma"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {cooldownExercises.length === 0 && (
                    <div className="py-3 text-center border border-dashed border-white/5 rounded-xl bg-black/5 flex items-center justify-center">
                      <p className="text-[11px] text-slate-500 italic font-medium">No hay tareas en la vuelta a la calma</p>
                    </div>
                  )}

                  {/* Render Cooldown Exercises */}
                  <div className="space-y-4">
                    {cooldownExercises.map((ex) => renderExerciseCard(ex))}
                  </div>
                </div>
              )}

              {/* Add back deleted blocks menu */}
              {(!showWarmupBlock || !showCooldownBlock) && (
                <div className="flex gap-2">
                  {!showWarmupBlock && (
                    <button
                      type="button"
                      onClick={() => setShowWarmupBlock(true)}
                      className="rounded-xl border border-dashed border-white/10 hover:border-white/20 text-slate-400 hover:text-white text-xs font-bold px-4 py-2.5 transition-all"
                    >
                      + Habilitar Bloque Calentamiento
                    </button>
                  )}
                  {!showCooldownBlock && (
                    <button
                      type="button"
                      onClick={() => setShowCooldownBlock(true)}
                      className="rounded-xl border border-dashed border-white/10 hover:border-white/20 text-slate-400 hover:text-white text-xs font-bold px-4 py-2.5 transition-all"
                    >
                      + Habilitar Bloque Vuelta a la Calma
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : null}

          {/* ── FORM ACTIONS ── */}
          <div className="flex gap-4 pt-4 border-t border-white/5">
            <button
              type="button"
              onClick={handleCancelExit}
              className="flex-1 rounded-xl border border-white/10 hover:border-white/20 text-slate-400 hover:text-white font-semibold text-sm py-3 transition-all cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => setIsPrintPreview(true)}
              className="flex-1 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white font-semibold text-sm py-3 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              Previsualizar / Exportar PDF
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 disabled:from-slate-700 disabled:to-slate-800 text-white font-semibold text-sm py-3 transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer"
            >
              {saving ? "Guardando..." : isEdit ? "Guardar Cambios" : "Crear Sesión"}
            </button>
          </div>
        </form>

        {/* ── RIGHT HISTORIAL SIDEBAR (25%) ── */}
        {isSidebarOpen && (
          <div className="w-[320px] shrink-0 sticky top-6 bg-card rounded-lg border border-border p-4 max-h-[85vh] overflow-y-auto no-scrollbar flex flex-col gap-4 animate-in slide-in-from-right duration-200">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
              <span className="text-xs font-extrabold text-white tracking-tight flex items-center gap-1.5">
                <FolderOpen className="h-4 w-4 corp-icon" />
                Historial Sesiones Pasadas
              </span>
              <button
                type="button"
                onClick={() => setIsSidebarOpen(false)}
                className="text-slate-500 hover:text-white text-xs font-bold cursor-pointer"
              >
                Cerrar
              </button>
            </div>

            {pastSessions.length === 0 ? (
              <p className="text-xs text-slate-500 italic text-center py-6">No hay sesiones pasadas registradas para este equipo.</p>
            ) : (
              <div className="space-y-4">
                {pastSessions.map((sess) => (
                  <div key={sess.id} className="p-3 bg-white/2 border border-white/5 rounded-xl space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <span className="block font-bold text-white text-[11px] leading-snug truncate" title={sess.title}>{sess.title}</span>
                        <span className="block text-[9.5px] text-emerald-400 font-semibold mt-0.5">
                          Sesión Total: {sess.session_total_seq ?? "—"} | Semanal: {sess.session_week_seq ?? "—"}
                        </span>
                        <span className="block text-[9px] text-slate-500 mt-0.5">📅 {new Date(sess.date).toLocaleDateString()}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`¿Clonar todos los objetivos y tareas de la sesión "${sess.title}"?`)) {
                            importFullSession(sess);
                          }
                        }}
                        className="rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[8.5px] font-bold px-2 py-1 border border-emerald-500/20 cursor-pointer shrink-0"
                        title="Clonar sesión completa"
                      >
                        Clonar
                      </button>
                    </div>

                    {/* Past Session Blocks */}
                    {sess.exercises && sess.exercises.length > 0 && (
                      <div className="space-y-2 border-t border-white/5 pt-2">
                        {['warmup', 'main', 'cooldown'].map((block) => {
                          const blockExercises = sess.exercises.filter((ex: any) => {
                            const bt = ex.group_setup?.block_type ?? "main";
                            return bt === block;
                          });

                          if (blockExercises.length === 0) return null;

                          const blockLabel = block === 'warmup' ? "Calentamiento" : block === 'cooldown' ? "Vuelta Calma" : "Principal";
                          const blockColor = block === 'warmup' ? "text-amber-400" : block === 'cooldown' ? "text-sky-400" : "text-emerald-400";

                          return (
                            <div key={block} className="space-y-1">
                              <div className="flex items-center justify-between text-[9px]">
                                <span className={cn("font-bold uppercase tracking-wider", blockColor)}>{blockLabel}</span>
                                <button
                                  type="button"
                                  onClick={() => importBlockFromSession(sess, block as any, block as any)}
                                  className="text-slate-400 hover:text-white font-semibold"
                                >
                                  Copiar Bloque
                                </button>
                              </div>
                              <div className="space-y-0.5 pl-1.5 border-l border-white/5">
                                {blockExercises.map((ex: any, exIdx: number) => (
                                  <div key={exIdx} className="flex items-center justify-between text-[9px] text-slate-400 group py-0.5 gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                      {hasWhiteboardData(ex.whiteboard_data) ? (
                                        <div className="h-5 w-8 shrink-0 rounded border border-white/10 bg-slate-950/40 overflow-hidden flex items-center justify-center">
                                          {ex.whiteboard_data?.imageDataUrl ? (
                                            <img 
                                              src={ex.whiteboard_data.imageDataUrl} 
                                              alt="Esquema" 
                                              className="h-full w-full object-cover"
                                            />
                                          ) : (
                                            <TacticalSvgRenderer value={ex.whiteboard_data} width={120} height={80} className="w-full h-full" />
                                          )}
                                        </div>
                                      ) : (
                                        <span className="h-5 w-8 shrink-0 rounded border border-dashed border-white/5 bg-white/2 flex items-center justify-center text-[7px] text-slate-650 font-bold select-none">
                                          —
                                        </span>
                                      )}
                                      <span className="truncate text-slate-300 leading-snug" title={ex.exercise?.title}>{ex.exercise?.title || "Tarea"}</span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => importSingleExercise(ex, block as any)}
                                      className="text-slate-500 hover:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity font-bold shrink-0"
                                    >
                                      + Añadir
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL: EXERCISE LIBRARY SELECTOR ── */}
      {isLibraryOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-popover w-full max-w-lg rounded-xl border border-border flex flex-col max-h-[80vh] overflow-hidden shadow-md animate-fade-in">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <h3 className="text-base font-extrabold text-white">Biblioteca de Ejercicios</h3>
              <button
                type="button"
                onClick={() => {
                  setIsLibraryOpen(false);
                  setIsCreatingExercise(false);
                }}
                className="text-slate-500 hover:text-white font-bold text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            {/* Category Filter Tabs */}
            {!isCreatingExercise && (
              <div className="flex border-b border-white/5 bg-white/2 p-1 gap-1 shrink-0">
                {[
                  { id: "warmup", label: "Calentamiento" },
                  { id: "main", label: "Principal" },
                  { id: "strength", label: "Fuerza" },
                  { id: "cooldown", label: "Vuelta Calma" },
                  { id: "all", label: "Todos" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setLibraryTab(tab.id)}
                    className={cn(
                      "flex-1 py-1.5 text-[9px] font-bold rounded-lg transition-all cursor-pointer",
                      libraryTab === tab.id
                        ? "bg-emerald-500 text-white shadow"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
            
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="flex justify-between items-center pb-2 border-b border-white/5">
                <span className="text-xs text-slate-400 font-semibold">
                  {isCreatingExercise ? "Crear Nueva Tarea" : "Seleccionar de la Lista"}
                </span>
                <button
                  type="button"
                  onClick={() => setIsCreatingExercise(!isCreatingExercise)}
                  className="text-xs font-bold text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  {isCreatingExercise ? "Ver Biblioteca" : "Crear Ejercicio Rápido"}
                </button>
              </div>

              {isCreatingExercise ? (
                <form onSubmit={handleCreateExerciseInline} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Título *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Rondo 5v2 en zona"
                      value={newExTitle}
                      onChange={(e) => setNewExTitle(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Categoría</label>
                      <input
                        type="text"
                        placeholder="Ej: Táctica"
                        value={newExCategory}
                        onChange={(e) => setNewExCategory(e.target.value)}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-650"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Carga</label>
                      <select
                        value={newExDifficulty}
                        onChange={(e) => setNewExDifficulty(e.target.value)}
                        className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value="very_low">Muy baja</option>
                        <option value="low">Baja</option>
                        <option value="medium">Media</option>
                        <option value="high">Alta</option>
                        <option value="very_high">Muy alta</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Exportar a Biblioteca</label>
                      <select
                        value={newExScope}
                        onChange={(e) => setNewExScope(e.target.value)}
                        className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none"
                      >
                        <option value="none">No exportar (Solo esta sesión)</option>
                        <option value="coach">Personal (Entrenador / Prep Físico)</option>
                        {(userRole === "super_admin" || userRole === "admin" || userRole === "owner" || userRole === "head_coach") && (
                          <option value="academy">Academia (Coordinador / Admin)</option>
                        )}
                        {userRole === "super_admin" && (
                          <option value="global">ClubLab (Superadmin)</option>
                        )}
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Duración (min)</label>
                      <input
                        type="number"
                        min="1"
                        value={newExDuration}
                        onChange={(e) => setNewExDuration(Math.max(1, Number(e.target.value)))}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nº Series</label>
                      <input
                        type="number"
                        min="1"
                        value={newExSeries}
                        onChange={(e) => setNewExSeries(Math.max(1, Number(e.target.value)))}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Recup. (min)</label>
                      <input
                        type="number"
                        min="0"
                        value={newExRecovery}
                        onChange={(e) => setNewExRecovery(Math.max(0, Number(e.target.value)))}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Descripción</label>
                    <textarea
                      rows={3}
                      placeholder="Reglas tácticas..."
                      value={newExDesc}
                      onChange={(e) => setNewExDesc(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white placeholder-slate-650 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={creatingExLoading}
                    className="w-full rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold py-2.5 transition-all shadow-lg disabled:opacity-60"
                  >
                    Registrar y Añadir
                  </button>
                </form>
              ) : (
                <div className="space-y-2">
                  {(() => {
                    const filtered = exerciseLibrary.filter((item) => {
                      if (item.library_scope === "none") return false;
                      if (libraryTab === "all") return true;
                      const category = (item.category || "").toLowerCase();
                      
                      if (libraryTab === "warmup") {
                        return category.includes("calentamiento") || category.includes("warmup") || category.includes("activación") || category.includes("activacion");
                      }
                      if (libraryTab === "cooldown") {
                        return category.includes("vuelta") || category.includes("calma") || category.includes("cooldown") || category.includes("recuperación") || category.includes("recuperacion") || category.includes("estiramiento");
                      }
                      if (libraryTab === "strength") {
                        return category.includes("fuerza") || category.includes("strength") || category.includes("prevención") || category.includes("prevencion");
                      }
                      if (libraryTab === "main") {
                        const isWarmup = category.includes("calentamiento") || category.includes("warmup") || category.includes("activación") || category.includes("activacion");
                        const isCooldown = category.includes("vuelta") || category.includes("calma") || category.includes("cooldown") || category.includes("recuperación") || category.includes("recuperacion") || category.includes("estiramiento");
                        const isStrength = category.includes("fuerza") || category.includes("strength") || category.includes("prevención") || category.includes("prevencion");
                        return !isWarmup && !isCooldown && !isStrength;
                      }
                      return true;
                    });

                    if (filtered.length === 0) {
                      return (
                        <p className="text-xs text-slate-500 italic text-center py-8">
                          No hay ejercicios en esta categoría.
                        </p>
                      );
                    }

                    return filtered.map((item) => {
                      const isAdded = exercises.some((ex) => ex.exercise_id === item.id);
                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "flex items-center justify-between p-3 rounded-xl border transition-all",
                            isAdded
                              ? "border-emerald-500/20 bg-emerald-500/5 opacity-60"
                              : "border-white/5 bg-white/2 hover:bg-white/5 hover:border-white/10"
                          )}
                        >
                          <div className="overflow-hidden">
                            <span className="text-xs font-extrabold text-white block">{item.title}</span>
                            <span className="text-[10px] text-slate-500 block uppercase font-bold tracking-wider mt-0.5">
                              {item.category} • {item.difficulty || "General"}
                            </span>
                          </div>
                          <button
                            type="button"
                            disabled={isAdded}
                            onClick={() => addExercise(item)}
                            className={cn(
                              "rounded-lg text-[10px] font-bold px-3 py-1.5 cursor-pointer",
                              isAdded
                                ? "bg-white/5 text-emerald-400 border border-white/5 cursor-default"
                                : "bg-emerald-500 hover:bg-emerald-400 text-white"
                            )}
                          >
                            {isAdded ? "Añadido" : "Seleccionar"}
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PIZARRA TÁCTICA ── */}
      {whiteboardExerciseIndex !== null && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-popover w-full max-w-4xl rounded-xl border border-border flex flex-col max-h-[95vh] overflow-hidden shadow-md">
            <div className="p-5 border-b border-white/5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-extrabold text-white">Pizarra Táctica</h3>
                <p className="text-xs text-slate-400 mt-0.5">{exercises[whiteboardExerciseIndex]?.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setWhiteboardExerciseIndex(null)}
                className="text-slate-500 hover:text-white font-bold text-lg cursor-pointer p-2"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <TaskWhiteboard
                value={exercises[whiteboardExerciseIndex]?.whiteboard_data}
                onChange={(wbData) => {
                  updateExerciseField(whiteboardExerciseIndex, "whiteboard_data", wbData);
                  if (wbData.spaceDimensions) {
                    updateExerciseField(whiteboardExerciseIndex, "space_dimensions", wbData.spaceDimensions);
                  }
                  if (wbData.zone) {
                    updateExerciseField(whiteboardExerciseIndex, "whiteboard_zone", wbData.zone);
                  }
                }}
                interactive={true}
                onClose={() => setWhiteboardExerciseIndex(null)}
              />
            </div>
          </div>
        </div>
      )}

      {showExitConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-popover w-full max-w-sm rounded-xl border border-border p-6 space-y-6 shadow-md animate-fade-in text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-450 border border-rose-500/25 mx-auto">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-extrabold text-white">¿Salir sin guardar?</h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                Perderás toda la información introducida en esta sesión de entrenamiento.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowExitConfirmModal(false)}
                className="flex-1 rounded-xl border border-white/10 text-slate-400 hover:text-white text-xs font-semibold py-2.5 transition-all cursor-pointer hover:bg-white/5"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitConfirmModal(false);
                  router.push("/training");
                }}
                className="flex-1 rounded-xl bg-rose-500 hover:bg-rose-450 text-white text-xs font-bold py-2.5 transition-all shadow-lg cursor-pointer"
              >
                Salir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT & PREVIEW OVERLAY ── */}
      {isPrintPreview && (
        <div className="fixed inset-0 z-50 bg-slate-950 overflow-y-auto text-white p-6 md:p-10 no-scrollbar print:static print:p-0 print:m-0 print:bg-white print:z-auto print:overflow-visible print:text-black">
          {/* Preview Navigation Header */}
          <div className="max-w-5xl mx-auto flex items-center justify-between bg-slate-900 border border-white/10 rounded-2xl p-4 mb-8 shadow-2xl flex-wrap gap-4 print:hidden">
            <div>
              <h3 className="font-extrabold text-sm text-white">Vista Previa del Entrenamiento</h3>
              <p className="text-[10px] text-slate-400">Visualiza el informe en formato A4 Vertical o Móvil antes de exportar</p>
            </div>
            
            {/* View Mode Toggle */}
            <div className="flex items-center bg-black/30 border border-white/10 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setPreviewMode('tablet')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                  previewMode === 'tablet' ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
                )}
              >
                <FileText className="h-4 w-4" />
                <span>A4 Vertical (Informe)</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewMode('mobile')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer",
                  previewMode === 'mobile' ? "bg-emerald-500 text-slate-950 shadow" : "text-slate-400 hover:text-white"
                )}
              >
                <Smartphone className="h-4 w-4" />
                <span>Móvil (Jugador)</span>
              </button>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPrintPreview(false)}
                className="px-4 py-2 rounded-xl border border-white/10 hover:bg-white/5 text-xs font-semibold cursor-pointer"
              >
                Volver a la edición
              </button>
              <button
                type="button"
                onClick={() => prepareAndPrintDocument(
                  { title: title || "Sesión de Entrenamiento", date, start_time: startTime },
                  organizationSettings?.club_name || "SD Almazán"
                )}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg cursor-pointer flex items-center gap-1"
              >
                <Printer className="h-4.5 w-4.5" />
                <span>Imprimir / PDF</span>
              </button>
            </div>
          </div>

          {/* ── TABLET / A4 PREVIEW CONTAINER ── */}
          {previewMode === 'tablet' && (
            <div className="max-w-4xl mx-auto bg-white text-slate-900 rounded-2xl p-2 shadow-2xl border border-slate-100 font-sans overflow-hidden print:p-0 print:m-0 print:shadow-none print:border-none print:rounded-none">
              <SessionPrintReport
                session={{
                  title: title || "Sesión de Entrenamiento",
                  date,
                  start_time: startTime,
                  duration_min: durationMin,
                  exercises,
                  muscle_groups: sessionMuscleGroups,
                  tactical_concepts: sessionTacticalConcepts,
                  metrics: {
                    meso: mesocycle,
                    micro: microcycleDay
                  },
                  week_sequence: sessionWeekSeq,
                  total_sequence: sessionTotalSeq,
                  attendance: activeSquadPlayers.map((p) => ({
                    player_id: p.id,
                    status: attendance[p.id]?.status ?? 'present',
                    player: p
                  }))
                }}
                organizationSettings={organizationSettings}
                activeSquadPlayers={activeSquadPlayers}
              />
            </div>
          )}

          {/* ── PORTRAIT MOBILE VIEW (JUGADOR) ── */}
          {previewMode === 'mobile' && (
            <div className="print-mobile-container max-w-[390px] w-full bg-slate-900 text-white rounded-[40px] p-5 shadow-2xl border-[10px] border-slate-800 min-h-[680px] mx-auto flex flex-col justify-between font-sans relative overflow-hidden">
              <style dangerouslySetInnerHTML={{ __html: `
                @media print {
                  .print-mobile-container {
                    display: none !important;
                  }
                }
              `}} />
              
              <div className="space-y-4">
                {/* Mobile Header */}
                <div className="border-b border-white/5 pb-3 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[8px] font-extrabold uppercase text-emerald-400 tracking-wider">Plan del Jugador</span>
                    <h2 className="text-base font-extrabold text-white leading-tight mt-1">{title || "Sin título"}</h2>
                    <div className="flex gap-3 text-[10px] text-slate-400 mt-1.5">
                      <span>📅 {new Date(date).toLocaleDateString()}</span>
                      <span>⏰ {startTime} h</span>
                      <span>⏱️ {durationMin} min</span>
                    </div>
                  </div>
                  {organizationSettings?.club_logo_url && (
                    <img
                      src={organizationSettings.club_logo_url}
                      alt="Escudo"
                      className="h-10 w-10 object-contain rounded-lg border border-white/10 p-0.5 bg-black/20"
                    />
                  )}
                </div>

                {/* Session Concepts (Badge list for mobile) */}
                {(sessionTacticalConcepts.length > 0 || sessionMuscleGroups.length > 0) && (
                  <div className="space-y-1.5 bg-white/2 border border-white/5 p-2.5 rounded-xl text-[10px]">
                    <span className="block text-[8px] font-extrabold uppercase tracking-wider text-slate-500">Enfoque de la Sesión</span>
                    <div className="flex flex-wrap gap-1 pt-1">
                      {sessionTacticalConcepts.map(c => (
                        <span key={c} className="rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1.5 py-0.5 text-[9px] font-bold">
                          {c.replace(/_/g, " ")}
                        </span>
                      ))}
                      {sessionMuscleGroups.map(m => (
                        <span key={m} className="rounded-md bg-sky-500/10 border border-sky-500/20 text-sky-400 px-1.5 py-0.5 text-[9px] font-bold">
                          {m.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Mobile Attendance (Convocatoria en 4 columnas, sin colores) */}
                <div className="bg-white/2 border border-white/5 p-2.5 rounded-xl text-[10px] space-y-1.5">
                  <span className="block text-[8px] font-extrabold uppercase tracking-wider text-slate-500">Convocados ({presentPlayers.length})</span>
                  {presentPlayers.length === 0 ? (
                    <p className="text-slate-500 italic text-[10px]">Sin convocados</p>
                  ) : (
                    <div className="grid grid-cols-4 gap-x-2 gap-y-1 pt-1 text-[9.5px] text-slate-300">
                      {presentPlayers.map(p => (
                        <div key={p.id} className="truncate" title={`${p.first_name} ${p.last_name}`}>
                          • {p.first_name.slice(0, 1)}. {p.last_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Exercises Timeline list */}
                <div className="space-y-4">
                  {exercises.map((ex, idx) => {
                    const blockLabel = ex.block_type === 'warmup' ? 'Calentamiento' : ex.block_type === 'cooldown' ? 'Vuelta Calma' : 'Principal';
                    const blockColor = ex.block_type === 'warmup' ? 'text-amber-400 bg-amber-500/10' : ex.block_type === 'cooldown' ? 'text-sky-500/10' : 'text-emerald-400 bg-emerald-500/10';

                    return (
                      <div key={idx} className="p-3 bg-white/2 border border-white/5 rounded-2xl space-y-2.5">
                        <div className="flex items-center gap-2">
                          <span className="h-5.5 w-5.5 rounded-lg bg-emerald-500 text-slate-950 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div className="overflow-hidden">
                            <span className="block font-bold text-white text-[11px] truncate">{ex.title}</span>
                            <span className={cn("inline-block rounded px-1.5 py-0.5 text-[8px] font-extrabold tracking-wide uppercase mt-0.5", blockColor)}>
                              {blockLabel}
                            </span>
                          </div>
                        </div>

                        {/* Whiteboard rendered full-width */}
                        {hasWhiteboardData(ex.whiteboard_data) && (
                          <div className="rounded-xl border border-white/5 bg-slate-950 p-0.5 overflow-hidden aspect-[4/3]">
                            {ex.whiteboard_data?.imageDataUrl ? (
                              <img
                                src={ex.whiteboard_data.imageDataUrl}
                                alt="Pizarra"
                                className="w-full h-full object-contain"
                              />
                            ) : (
                              <TacticalSvgRenderer value={ex.whiteboard_data} width={400} height={300} className="w-full h-full" />
                            )}
                          </div>
                        )}

                        {/* Rules / Description */}
                        {ex.rules && (
                          <div className="text-[10px] text-slate-300 leading-normal bg-black/10 p-2 rounded-xl">
                            <span className="block text-[8px] font-extrabold uppercase text-slate-500 tracking-wider mb-0.5">Pautas e Instrucciones</span>
                            <p className="whitespace-pre-wrap">{ex.rules}</p>
                          </div>
                        )}

                        {/* Player's group assignment */}
                        {ex.group_setup?.groups && ex.group_setup.groups.length > 0 && (
                          <div className="text-[9px] border-t border-white/5 pt-2">
                            <span className="block text-[8px] font-extrabold uppercase text-slate-500 tracking-wider mb-1.5">Tus Equipos</span>
                            <div className="space-y-1">
                              {ex.group_setup.groups.map((g: any, gIdx: number) => (
                                <div key={gIdx} className="flex justify-between items-center bg-white/3 px-2 py-1 rounded">
                                  <span className="font-bold text-slate-200">{g.name}</span>
                                  <span className="text-slate-400 truncate max-w-[180px]">
                                    {(g.players ?? []).map((pId: string) => presentPlayers.find(pl => pl.id === pId)?.first_name).filter(Boolean).join(", ")}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Mobile Footer */}
              <div className="mt-4 pt-3 border-t border-white/5 text-center text-[9px] text-slate-500">
                <span>ClubLab Enterprise © 2026. Todos los derechos reservados.</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MODAL: PREVIEW DE SESIÓN CON DIBUJOS TÁCTICOS ── */}
      {previewSessionModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-white/10 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center justify-center font-bold">
                  <Eye className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    {previewSessionModalData.title || `Sesión ${previewSessionModalData.session_total_seq || ""}`}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {new Date(previewSessionModalData.date).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                    {previewSessionModalData.microcycle_day && ` • ${previewSessionModalData.microcycle_day}`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewSessionModalData(null)}
                className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-all cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {(!previewSessionModalData.exercises || previewSessionModalData.exercises.length === 0) ? (
                <div className="text-center py-10 border border-dashed border-white/10 rounded-2xl bg-white/2">
                  <p className="text-slate-400 text-sm italic">Esta sesión no tiene tareas registradas</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                      Tareas de la Sesión ({previewSessionModalData.exercises.length})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {previewSessionModalData.exercises.map((item: any, idx: number) => {
                      const ex = item.exercise || item;
                      const drawing = item.whiteboard_data?.imageDataUrl || ex?.whiteboard_data?.imageDataUrl;

                      return (
                        <div key={idx} className="bg-white/3 border border-white/10 rounded-xl p-4 flex flex-col justify-between space-y-3">
                          <div className="space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="text-[9px] font-extrabold px-2 py-0.5 rounded bg-white/10 text-slate-300 uppercase tracking-wider border border-white/10">
                                  {item.block_type === 'warmup' ? 'Calentamiento' : item.block_type === 'cooldown' ? 'Vuelta a Calma' : item.block_type === 'block0' ? 'Bloque 0' : 'Parte Principal'}
                                </span>
                                <h4 className="text-sm font-extrabold text-white mt-1.5 leading-tight">
                                  {ex?.title || item.title || "Tarea"}
                                </h4>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  const formattedEx = {
                                    exercise_id: item.exercise_id || ex?.id,
                                    title: ex?.title || item.title || "Ejercicio",
                                    category: ex?.category || item.category || "General",
                                    duration_min: item.duration_min || 15,
                                    recovery_min: item.recovery_min || 2,
                                    pitch_zones: item.pitch_zones || [],
                                    equipment: item.equipment || [],
                                    group_setup: item.group_setup || {},
                                    whiteboard_data: item.whiteboard_data || ex?.whiteboard_data || null,
                                  };
                                  localStorage.setItem("cl_copied_single_exercise", JSON.stringify(formattedEx));
                                  setCopiedSingleTask(formattedEx);
                                  alert(`Tarea "${formattedEx.title}" copiada al portapapeles. ¡Puedes pegarla en cualquier bloque!`);
                                }}
                                className="px-2 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 text-[10px] font-extrabold cursor-pointer flex items-center gap-1 shrink-0"
                                title="Copiar esta tarea"
                              >
                                <Copy className="h-3 w-3" />
                                <span>Copiar</span>
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                              <span>⏱️ {item.duration_min || 15}m (+{item.recovery_min || 2}m rec)</span>
                              {item.space_dimensions && <span>📐 {item.space_dimensions}</span>}
                            </div>
                          </div>

                          {/* Tactical Whiteboard Drawing Image */}
                          <div className="bg-slate-950 border border-white/10 rounded-xl p-2 min-h-[140px] flex items-center justify-center overflow-hidden">
                            {drawing ? (
                              <img
                                src={drawing}
                                alt="Dibujo táctico"
                                className="w-full max-h-[180px] object-contain rounded-lg"
                              />
                            ) : (
                              <div className="text-center p-4">
                                <Sparkles className="h-5 w-5 text-slate-600 mx-auto mb-1" />
                                <span className="text-[10px] text-slate-500 font-medium">Sin gráfico táctico</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-white/10 bg-white/[0.02] flex justify-end">
              <button
                type="button"
                onClick={() => setPreviewSessionModalData(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Cerrar Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE SELECCIÓN DE TIPO DE SESIÓN ── */}
      <SessionTypePickerModal
        isOpen={showTypePickerModal}
        onClose={() => setShowTypePickerModal(false)}
        onSelectType={(selectedType) => {
          setSessionType(selectedType);
          setShowTypePickerModal(false);
        }}
        selectedDate={date}
      />
    </>
  );

  // Exercise card renderer helper to keep main render method cleaner
  function renderExerciseCard(ex: any) {
    const index = exercises.findIndex(item => item === ex);
    if (index === -1) return null;

    const isExpanded = !!expandedExercises[ex.exercise_id];
    const toggleExpand = () => {
      setExpandedExercises(prev => ({
        ...prev,
        [ex.exercise_id]: !prev[ex.exercise_id]
      }));
    };

    return (
      <div
        key={ex.exercise_id + "-" + index}
        className={cn(
          "rounded-xl border transition-all duration-200 bg-white/3 space-y-4",
          isExpanded ? "border-white/10 p-5" : "border-white/5 p-3 hover:bg-white/[0.04] hover:border-white/10"
        )}
      >
        {/* Card Header */}
        <div 
          onClick={toggleExpand}
          className="flex items-center justify-between gap-4 cursor-pointer select-none"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <span className="h-5 w-5 shrink-0 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold flex items-center justify-center">
              {index + 1}
            </span>
            
            {!isExpanded && hasWhiteboardData(ex.whiteboard_data) && (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  setWhiteboardExerciseIndex(index);
                }}
                className="h-8 w-12 shrink-0 rounded border border-white/10 bg-slate-950/40 overflow-hidden cursor-pointer hover:border-emerald-500/40 transition-all flex items-center justify-center group"
                title="Editar dibujo"
              >
                {ex.whiteboard_data?.imageDataUrl ? (
                  <img 
                    src={ex.whiteboard_data.imageDataUrl} 
                    alt="Esquema" 
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <TacticalSvgRenderer value={ex.whiteboard_data} width={120} height={80} className="w-full h-full" />
                )}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-xs font-extrabold text-white truncate">{ex.title}</h4>
                {!isExpanded && (
                  <span className="text-[9px] text-slate-405 bg-white/5 border border-white/5 rounded px-1.5 py-0.2 truncate shrink-0">
                    {ex.category}
                  </span>
                )}
              </div>

              {/* Library exercise description - always visible */}
              {ex.exercise?.description && (
                <p className="text-[9px] text-slate-400 italic mt-0.5 leading-snug line-clamp-2">
                  {ex.exercise.description.replace(/^#{1,6}\s+/gm, "").replace(/\*{1,2}([^*\n]+)\*{1,2}/g, "$1").replace(/_{1,2}([^_\n]+)_{1,2}/g, "$1").replace(/^[-*_]{3,}\s*$/gm, "").trim()}
                </p>
              )}
              
              {!isExpanded && (
                <div className="flex items-center gap-3 mt-1 text-[9px] text-slate-500 font-semibold flex-wrap">
                  <span className="flex items-center gap-1">
                    ⏱️ {ex.num_series || 1} x {ex.series_duration_min || 10} min (Rec: {ex.series_recovery_min || 2} min)
                  </span>
                  <span>•</span>
                  <span>Resto: {ex.transition_rest_min ?? 2} min</span>
                  {ex.whiteboard_data && (
                    <>
                      <span>•</span>
                      <span className="text-emerald-400 font-extrabold">✏️ Pizarra</span>
                    </>
                  )}
                  {ex.group_setup?.groups?.length > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-purple-400 font-extrabold">👥 {ex.group_setup.groups.length} Grupos</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveExercise(index, "up")}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all cursor-pointer"
                >
                  <ChevronDown className="h-4 w-4 rotate-180" />
                </TooltipTrigger>
                <TooltipContent>Mover arriba</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  disabled={index === exercises.length - 1}
                  onClick={() => moveExercise(index, "down")}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-30 transition-all cursor-pointer"
                >
                  <ChevronDown className="h-4 w-4" />
                </TooltipTrigger>
                <TooltipContent>Mover abajo</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="w-px h-3 bg-border mx-0.5" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  onClick={() => duplicateExercise(index)}
                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-sky-450 transition-all cursor-pointer"
                >
                  <Copy className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent>Duplicar tarea</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  onClick={() => copyExercise(index)}
                  className={cn("p-1 rounded hover:bg-muted transition-all cursor-pointer", copiedExercise?.exercise_id?.startsWith(ex.exercise_id) ? "text-emerald-400" : "text-muted-foreground hover:text-emerald-400")}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/></svg>
                </TooltipTrigger>
                <TooltipContent>Copiar tarea</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="w-px h-3 bg-border mx-0.5" />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger
                  type="button"
                  onClick={() => removeExercise(index)}
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </TooltipTrigger>
                <TooltipContent>Eliminar de la sesión</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <div className="w-px h-3 bg-white/10 mx-0.5" />
            <button
              type="button"
              onClick={toggleExpand}
              className="p-1 rounded hover:bg-white/5 text-slate-400 hover:text-white transition-all cursor-pointer"
              title={isExpanded ? "Contraer" : "Expandir"}
            >
              <ChevronRight className={cn("h-4 w-4 transition-transform duration-200", isExpanded && "rotate-90")} />
            </button>
          </div>
        </div>

        {/* Card Body */}
        {isExpanded && (
          <div className="space-y-4 pt-2 border-t border-white/5 animate-in fade-in slide-in-from-top-1 duration-200">
            {/* Title & Category Edit Fields */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-white/2 p-3 rounded-xl border border-white/5">
              <div>
                <label className={labelClass}>Nombre / Título de la Tarea</label>
                <input
                  type="text"
                  value={ex.title ?? ""}
                  onChange={(e) => updateExerciseField(index, "title", e.target.value)}
                  placeholder="Ej: Rondo 5v2 en zona..."
                  className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
              <div>
                <label className={labelClass}>Tipo / Categoría de Tarea</label>
                <input
                  type="text"
                  value={ex.category ?? ""}
                  onChange={(e) => updateExerciseField(index, "category", e.target.value)}
                  placeholder="Ej: Táctica, Calentamiento, Fuerza..."
                  className="w-full rounded-lg bg-slate-900 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />
              </div>
            </div>

        {/* Block & Location assignment selectors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelClass}>Bloque de la Sesión</label>
            <select
              value={ex.block_type || "main"}
              onChange={(e) => updateExerciseField(index, "block_type", e.target.value as any)}
              className="w-full rounded-lg bg-slate-900 border border-white/10 px-2 py-1.5 text-xs text-white cursor-pointer"
            >
              <option value="warmup">Calentamiento</option>
              <option value="main">Parte Principal</option>
              <option value="cooldown">Vuelta a la Calma</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Ubicación / Campo</label>
            <select
              value={ex.facility_id || ""}
              onChange={(e) => updateExerciseField(index, "facility_id", e.target.value)}
              className="w-full rounded-lg bg-slate-900 border border-white/10 px-2 py-1.5 text-xs text-white cursor-pointer"
            >
              <option value="">-- Por defecto / Sin asignar --</option>
              {facilities.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Tiempo de Transición (min)</label>
            <input
              type="number"
              min="0"
              placeholder="Minutos"
              value={ex.transition_rest_min ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                updateExerciseField(index, "transition_rest_min", val === "" ? "" : Math.max(0, Number(val)));
              }}
              onBlur={(e) => {
                if (e.target.value === "") updateExerciseField(index, "transition_rest_min", 0);
              }}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white"
            />
          </div>
        </div>

        {/* Series (Sets) configuration */}
        <div className="border-t border-white/5 pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Configuración de Series</span>
            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-350 cursor-pointer">
              <input
                type="checkbox"
                checked={ex.use_variable_series ?? false}
                onChange={(e) => {
                  const val = e.target.checked;
                  updateExerciseField(index, "use_variable_series", val);
                  if (val && (!ex.series || ex.series.length === 0)) {
                    // Populate series array based on current num_series
                    const defaultSeries = [];
                    const n = Number(ex.num_series) || 1;
                    for (let i = 0; i < n; i++) {
                      defaultSeries.push({
                        set_index: i + 1,
                        duration_min: ex.series_duration_min || 15,
                        recovery_min: ex.series_recovery_min || 2
                      });
                    }
                    updateExerciseField(index, "series", defaultSeries);
                  }
                }}
                className="rounded border-white/10 bg-white/5 corp-accent h-3.5 w-3.5"
              />
              Series con tiempos variables
            </label>
          </div>

          {/* Uniform series fields */}
          {!ex.use_variable_series ? (
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nº Series</label>
                <input
                  type="number"
                  min="1"
                  value={ex.num_series ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateExerciseField(index, "num_series", val === "" ? "" : Math.max(1, Number(val)));
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "" || Number(e.target.value) < 1) updateExerciseField(index, "num_series", 1);
                  }}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Duración (min)</label>
                <input
                  type="number"
                  min="1"
                  value={ex.series_duration_min ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateExerciseField(index, "series_duration_min", val === "" ? "" : Math.max(1, Number(val)));
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "" || Number(e.target.value) < 1) updateExerciseField(index, "series_duration_min", 15);
                  }}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1">Recup. (min)</label>
                <input
                  type="number"
                  min="0"
                  value={ex.series_recovery_min ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateExerciseField(index, "series_recovery_min", val === "" ? "" : Math.max(0, Number(val)));
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "") updateExerciseField(index, "series_recovery_min", 2);
                  }}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-2 py-1 text-xs text-white"
                />
              </div>
            </div>
          ) : (
            /* Variable series fields list */
            <div className="space-y-2 animate-fade-in pl-2.5 border-l border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Series Totales:</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={ex.num_series ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "") {
                      updateExerciseField(index, "num_series", "");
                      return;
                    }
                    const nextNum = Math.max(1, Math.min(10, Number(val)));
                    updateExerciseField(index, "num_series", nextNum);
                    
                    const currentSeries = ex.series ?? [];
                    let nextSeries = [...currentSeries];
                    if (nextNum > currentSeries.length) {
                      for (let i = currentSeries.length; i < nextNum; i++) {
                        nextSeries.push({
                          set_index: i + 1,
                          duration_min: ex.series_duration_min || 15,
                          recovery_min: ex.series_recovery_min || 2
                        });
                      }
                    } else if (nextNum < currentSeries.length) {
                      nextSeries = nextSeries.slice(0, nextNum);
                    }
                    updateExerciseField(index, "series", nextSeries);
                  }}
                  onBlur={(e) => {
                    if (e.target.value === "" || Number(e.target.value) < 1) updateExerciseField(index, "num_series", 1);
                  }}
                  className="w-12 bg-slate-900 border border-white/10 rounded px-1.5 py-0.5 text-xs text-white text-center focus:outline-none"
                />
              </div>
              <div className="space-y-1.5">
                {(ex.series ?? []).map((s: any, sIdx: number) => (
                  <div key={sIdx} className="grid grid-cols-3 gap-2 items-center text-xs">
                    <span className="font-semibold text-slate-400">Serie {s.set_index}</span>
                    <input
                      type="number"
                      min="1"
                      placeholder="Dur. (min)"
                      value={s.duration_min ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newSeries = (ex.series ?? []).map((sItem: any, i: number) => {
                          if (i === sIdx) return { ...sItem, duration_min: val === "" ? "" : Number(val) };
                          return sItem;
                        });
                        updateExerciseField(index, "series", newSeries);
                      }}
                      className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-white"
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Rec. (min)"
                      value={s.recovery_min ?? ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        const newSeries = (ex.series ?? []).map((sItem: any, i: number) => {
                          if (i === sIdx) return { ...sItem, recovery_min: val === "" ? "" : Number(val) };
                          return sItem;
                        });
                        updateExerciseField(index, "series", newSeries);
                      }}
                      className="rounded bg-white/5 border border-white/10 px-2 py-0.5 text-[11px] text-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 1. DIBUJO TÁCTICO / PIZARRA (PRIMERO) ── */}
        <div className="space-y-2 border-t border-white/5 pt-3">
          <div className="flex items-center justify-between">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              1. Dibujo Táctico (Pizarra)
            </span>
            <button
              type="button"
              onClick={() => setWhiteboardExerciseIndex(index)}
              className="flex items-center gap-1.5 rounded-lg bg-violet-500/15 hover:bg-violet-500/25 border border-violet-500/25 text-violet-300 text-[10px] font-bold px-3 py-1 transition-all cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              {hasWhiteboardData(ex.whiteboard_data) ? "Editar Dibujo" : "Dibujar Tarea"}
            </button>
          </div>
          {hasWhiteboardData(ex.whiteboard_data) ? (
            <div 
              onClick={() => setWhiteboardExerciseIndex(index)}
              className="mt-2.5 flex justify-center bg-slate-950/60 p-3 rounded-2xl border border-white/10 hover:border-violet-500/30 transition-all cursor-pointer shadow-inner max-h-64 overflow-hidden"
            >
              {ex.whiteboard_data?.imageDataUrl ? (
                <img
                  src={ex.whiteboard_data.imageDataUrl}
                  alt="Esquema de Tarea"
                  className="rounded-xl max-h-56 object-contain shadow-lg bg-slate-950"
                />
              ) : (
                <TacticalSvgRenderer
                  value={ex.whiteboard_data}
                  width={500}
                  height={350}
                  className="w-full max-h-56 rounded-xl"
                />
              )}
            </div>
          ) : (
            <div 
              onClick={() => setWhiteboardExerciseIndex(index)}
              className="mt-1 border-2 border-dashed border-white/5 hover:border-violet-500/30 bg-white/2 hover:bg-violet-500/5 rounded-2xl p-6 text-center transition-all cursor-pointer space-y-1.5"
            >
              <div className="text-violet-400 text-lg font-black flex justify-center">+</div>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Dibujar Esquema Táctico</p>
              <p className="text-[9px] text-slate-500">Haz clic aquí para abrir la pizarra táctica y dibujar la tarea.</p>
            </div>
          )}
        </div>

        {/* ── 2. ZONAS DEL CAMPO (OPCIONAL - COLAPSA POR DEFECTO) ── */}
        {(() => {
          const hasZones = ex.pitch_zones && ex.pitch_zones.length > 0;
          const isOpen = expandedZones[index] || hasZones;

          if (isOpen) {
            return (
              <div className="space-y-2 border-t border-white/5 pt-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">2. Zonas del Campo (Grid Selector)</span>
                  <button
                    type="button"
                    onClick={() => {
                      updateExerciseField(index, "pitch_zones", []);
                      setExpandedZones(prev => ({ ...prev, [index]: false }));
                    }}
                    className="text-[9px] font-bold text-rose-400 hover:text-rose-350 transition-colors"
                  >
                    Quitar Zonas / Ocultar
                  </button>
                </div>
                <div className="flex flex-col md:flex-row gap-4 items-center bg-white/2 p-3 rounded-2xl border border-white/5">
                  <PitchGridSelector
                    selectedZones={ex.pitch_zones}
                    onChange={(zones) => updateExerciseField(index, "pitch_zones", zones)}
                    interactive={true}
                  />
                  <div className="flex-1 w-full space-y-1">
                    <p className="text-[10px] text-slate-400 leading-normal font-semibold">Selecciona las zonas utilizadas en el campo táctico:</p>
                    <div className="flex flex-wrap gap-1">
                      {ex.pitch_zones.length === 0 ? (
                        <span className="text-[10px] text-slate-650 italic">Todo el campo por defecto</span>
                      ) : (
                        ex.pitch_zones.map((zone: string) => (
                          <span key={zone} className="rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-350 font-bold text-[9px] px-1.5 py-0.5">Zona {zone}</span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={() => setExpandedZones(prev => ({ ...prev, [index]: true }))}
                className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-450 hover:text-emerald-400 transition-colors bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl cursor-pointer"
              >
                + Asignar Zonas del Campo
              </button>
            </div>
          );
        })()}

        {/* ── 3. MATERIAL REQUERIDO (OPCIONAL - COLAPSA POR DEFECTO) ── */}
        {(() => {
          const hasMaterial = ex.equipment && ex.equipment.length > 0;
          const isOpen = expandedMaterials[index] || hasMaterial;

          if (isOpen) {
            return (
              <div className="space-y-2 border-t border-white/5 pt-3 animate-fade-in">
                <div className="flex items-center justify-between">
                  <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">3. Material Requerido</span>
                  <button
                    type="button"
                    onClick={() => {
                      updateExerciseField(index, "equipment", []);
                      setExpandedMaterials(prev => ({ ...prev, [index]: false }));
                    }}
                    className="text-[9px] font-bold text-rose-400 hover:text-rose-350 transition-colors"
                  >
                    Quitar Material / Ocultar
                  </button>
                </div>
                <EquipmentSelector
                  value={ex.equipment}
                  onChange={(equip) => updateExerciseField(index, "equipment", equip)}
                  interactive={true}
                />
              </div>
            );
          }

          return (
            <div className="border-t border-white/5 pt-3">
              <button
                type="button"
                onClick={() => setExpandedMaterials(prev => ({ ...prev, [index]: true }))}
                className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-450 hover:text-emerald-400 transition-colors bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-xl cursor-pointer"
              >
                + Asignar Material
              </button>
            </div>
          );
        })()}

        {/* Group Assignment and Copy Teams */}
        <div className="space-y-3 border-t border-white/5 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Distribución de Equipos</span>
            
            {/* Copy Teams selector */}
            {ex.needs_groups && exercises.some((item, i) => i < index && item.needs_groups) && (
              <div className="flex items-center gap-1.5 bg-black/10 p-1.5 rounded-lg border border-white/5">
                <span className="text-[8px] font-extrabold uppercase text-slate-500 tracking-wider">Copiar de:</span>
                <select
                  onChange={(e) => {
                    const srcIndex = Number(e.target.value);
                    if (!isNaN(srcIndex) && exercises[srcIndex]?.group_setup?.groups) {
                      const cloned = exercises[srcIndex].group_setup.groups.map((g: any) => ({
                        name: g.name,
                        players: [...(g.players ?? [])]
                      }));
                      updateExerciseField(index, "group_setup", { ...ex.group_setup, groups: cloned });
                    }
                  }}
                  defaultValue=""
                  className="bg-slate-900 border border-white/10 rounded px-1.5 py-0.5 text-[9px] text-white focus:outline-none"
                >
                  <option value="">-- Tarea --</option>
                  {exercises.map((item, idx) => {
                    if (idx < index && item.needs_groups) {
                      return <option key={idx} value={idx}>Tarea {idx + 1}: {item.title}</option>;
                    }
                    return null;
                  })}
                </select>
              </div>
            )}

            <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-350 cursor-pointer">
              <input
                type="checkbox"
                checked={ex.needs_groups ?? false}
                onChange={(e) => {
                  const checked = e.target.checked;
                  updateExerciseField(index, "needs_groups", checked);
                  if (checked && (!ex.group_setup?.groups || ex.group_setup.groups.length === 0)) {
                    const defaultGroups = [];
                    const groupCount = ex.num_groups ?? 2;
                    for (let i = 0; i < groupCount; i++) {
                      defaultGroups.push({
                        name: `Equipo ${String.fromCharCode(65 + i)}`,
                        players: [],
                      });
                    }
                    updateExerciseField(index, "group_setup", { ...ex.group_setup, groups: defaultGroups });
                  }
                }}
                className="rounded border-white/10 bg-white/5 corp-accent h-3.5 w-3.5"
              />
              ¿Requiere Equipos?
            </label>
          </div>

          {(ex.needs_groups ?? false) && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-4 bg-white/2 p-2 rounded-xl border border-white/5 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-slate-500 uppercase tracking-wider">Nº de Equipos:</span>
                  <input
                    type="number"
                    min="1"
                    max="5"
                    value={ex.group_setup?.groups?.length ?? ex.num_groups ?? 2}
                    onChange={(e) => {
                      const targetNum = Math.max(1, Math.min(5, Number(e.target.value)));
                      updateExerciseField(index, "num_groups", targetNum);
                      const currentGroups = ex.group_setup?.groups ?? [];
                      let newGroups = [...currentGroups];
                      if (targetNum > currentGroups.length) {
                        for (let i = currentGroups.length; i < targetNum; i++) {
                          const name = `Equipo ${String.fromCharCode(65 + i)}`;
                          newGroups.push({ name, players: [] });
                        }
                      } else if (targetNum < currentGroups.length) {
                        newGroups = newGroups.slice(0, targetNum);
                      }
                      updateExerciseField(index, "group_setup", { ...ex.group_setup, groups: newGroups });
                    }}
                    className="w-10 bg-slate-900 border border-white/10 rounded px-1.5 py-0.5 text-center focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="font-bold text-slate-500 uppercase tracking-wider">Jugadores/Equipo:</span>
                  <input
                    type="text"
                    placeholder="Ej: 5 ó 4v4"
                    value={ex.players_per_group ?? ""}
                    onChange={(e) => updateExerciseField(index, "players_per_group", e.target.value)}
                    className="w-20 bg-slate-900 border border-white/10 rounded px-1.5 py-0.5 placeholder-slate-700"
                  />
                </div>
              </div>
              <GroupPlanner
                presentPlayers={presentPlayers}
                value={ex.group_setup}
                onChange={(groupsVal) => updateExerciseField(index, "group_setup", groupsVal)}
                interactive={true}
              />
            </div>
          )}
        </div>

        {/* Rules & Objective comments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-white/5 pt-3">
          <div>
            <label className={labelClass}>Objetivo Específico de la Tarea</label>
            <textarea
              rows={2}
              placeholder="Describir el foco de esta tarea..."
              value={ex.objective_notes ?? ""}
              onChange={(e) => updateExerciseField(index, "objective_notes", e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>
          <div>
            <label className={labelClass}>Normas de Provocación / Reglas</label>
            <textarea
              rows={2}
              placeholder="Normas básicas de juego, comodines, etc..."
              value={ex.rules ?? ""}
              onChange={(e) => updateExerciseField(index, "rules", e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-slate-650 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
            />
          </div>
        </div>

        {/* Video / Demo links preview */}
        {(ex.image_url || ex.video_url) && (
          <div className="flex gap-2 text-[10px] border-t border-white/5 pt-3">
            {ex.image_url && (
              <a
                href={ex.image_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2 py-0.5 rounded font-bold hover:bg-sky-500/15"
              >
                Ver Imagen
              </a>
            )}
            {ex.video_url && (
              <a
                href={ex.video_url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded font-bold hover:bg-amber-500/15"
              >
                Ver Vídeo
              </a>
            )}
          </div>
        )}

        {/* Collapse button at the bottom of the card for easy navigation */}
        <div className="flex justify-end border-t border-white/5 pt-3 mt-1">
          <button
            type="button"
            onClick={toggleExpand}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-[11px] font-bold transition-all cursor-pointer select-none"
            title="Contraer esta tarea"
          >
            <ChevronUp className="h-3.5 w-3.5 text-emerald-450" />
            <span>Listo / Contraer Tarea</span>
          </button>
        </div>
          </div>
        )}
      </div>
    );
  }
}
