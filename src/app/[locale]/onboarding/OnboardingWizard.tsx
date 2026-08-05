"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shield, GraduationCap, User, Check } from "lucide-react";
import {
  checkUserOnboardingStatusAction,
  completeOnboardingAction,
  acceptAssignedOrgAction,
} from "./actions";

type OrgType = "club" | "academy" | "independent_coach";
type Step = 1 | 2 | 3;

const ORG_TYPE_OPTIONS: { value: OrgType; label: string; desc: string; icon: React.ElementType }[] = [
  { value: "club", label: "Club de fútbol", desc: "Gestiona uno o varios equipos de un club", icon: Shield },
  { value: "academy", label: "Academia", desc: "Múltiples equipos, metodología compartida", icon: GraduationCap },
  { value: "independent_coach", label: "Entrenador independiente", desc: "Tú y tu equipo, sin estructura de club", icon: User },
];

const POSITION_OPTIONS = [
  { value: "goalkeeper", label: "Portero" },
  { value: "right_back", label: "Lateral Derecho" },
  { value: "right_center_back", label: "Central" },
  { value: "left_back", label: "Lateral Izquierdo" },
  { value: "defensive_midfielder", label: "Mediocentro Defensivo" },
  { value: "playmaker_midfielder", label: "Mediocentro" },
  { value: "attacking_midfielder", label: "Mediapunta" },
  { value: "left_winger", label: "Extremo Izquierdo" },
  { value: "right_winger", label: "Extremo Derecho" },
  { value: "striker", label: "Delantero Centro" },
];

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<string>("club_admin");
  const [fullName, setFullName] = useState("");

  const [assignedOrg, setAssignedOrg] = useState<{ orgName: string; role: string } | null>(null);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Base state
  const [orgType, setOrgType] = useState<OrgType>("club");
  const [orgName, setOrgName] = useState("");
  const [clubName, setClubName] = useState("");
  const [seasonName, setSeasonName] = useState("2026/27");
  const [teamName, setTeamName] = useState("Primer equipo");

  // Player state
  const [dob, setDob] = useState("");
  const [nationality, setNationality] = useState("Española");
  const [dominantFoot, setDominantFoot] = useState<"right" | "left" | "both">("right");
  const [heightCm, setHeightCm] = useState("175");
  const [weightKg, setWeightKg] = useState("70");
  const [position, setPosition] = useState("striker");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  useEffect(() => {
    async function loadUserAndStatus() {
      try {
        setCheckingStatus(true);
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
          const userRole = user.user_metadata?.role || "club_admin";
          setRole(userRole);
          setFullName(user.user_metadata?.full_name || "");

          // Check if user is already assigned or invited to an existing club (e.g. S.D. Almazán)
          const status = await checkUserOnboardingStatusAction();
          if (status.alreadyAssigned && status.orgName) {
            setAssignedOrg({
              orgName: status.orgName,
              role: status.role || userRole,
            });
            setCheckingStatus(false);
            return;
          }

          // Pre-configure defaults based on role
          if (userRole === "player") {
            setOrgType("independent_coach");
            setOrgName(`Espacio de ${user.user_metadata?.full_name || "Jugador"}`);
            setClubName(`Espacio de ${user.user_metadata?.full_name || "Jugador"}`);
            setTeamName("Mi Perfil");
          } else if (userRole === "head_coach") {
            setOrgType("independent_coach");
            setOrgName(`Cantera de ${user.user_metadata?.full_name || "Entrenador"}`);
            setClubName(`Club de ${user.user_metadata?.full_name || "Entrenador"}`);
            setTeamName("Primera Plantilla");
          }
        }
      } catch (err) {
        console.error("Error loading onboarding user status:", err);
      } finally {
        setCheckingStatus(false);
      }
    }
    loadUserAndStatus();
  }, []);

  async function handleFinish() {
    setError(null);
    setLoading(true);

    try {
      const res = await completeOnboardingAction({
        orgType,
        orgName,
        clubName: clubName || orgName,
        seasonName,
        teamName,
        role,
        playerData: role === "player" ? {
          dob,
          nationality,
          dominantFoot,
          heightCm,
          weightKg,
          position,
        } : undefined
      });

      if (res.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(res.error || "Error al configurar la entidad.");
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.message ?? "Error inesperado al completar la configuración.");
      setLoading(false);
    }
  }

  if (checkingStatus) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 text-center text-slate-400 space-y-3">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500 mx-auto" />
        <p className="text-xs font-semibold">Comprobando vinculación de tu club...</p>
      </div>
    );
  }

  // If player is invited or linked to an existing organization (e.g. S.D. Almazán)
  if (assignedOrg) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 animate-fade-in text-center space-y-6 shadow-2xl">
        <div className="mx-auto size-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/40">
          <Shield className="size-8" />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">
            Perfil vinculado oficialmente
          </span>
          <h2 className="text-2xl font-black text-white tracking-tight">
            ¡Te has unido a {assignedOrg.orgName}!
          </h2>
          <p className="text-xs text-slate-400 max-w-sm mx-auto leading-relaxed font-medium">
            Tu cuenta ha sido asignada a <strong>{assignedOrg.orgName}</strong> con el perfil de{" "}
            <strong className="text-emerald-400 font-bold">
              {assignedOrg.role === "player" ? "Jugador" : assignedOrg.role === "head_coach" ? "Entrenador" : "Administrador"}
            </strong>. No necesitas crear un club nuevo.
          </p>
        </div>

        <button
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              const res = await acceptAssignedOrgAction();
              window.location.href = res.redirectUrl || "/dashboard";
            } catch {
              window.location.href = "/dashboard";
            }
          }}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm py-3 transition-all shadow-lg shadow-emerald-950/50 cursor-pointer disabled:opacity-50"
        >
          {loading ? "Accediendo a tu club..." : "¡Aceptar y acceder a mi plantilla! ⚽"}
        </button>

        <div className="pt-2 border-t border-white/[0.06]">
          <button
            onClick={handleSignOut}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            ¿No eres tú? Cambiar de cuenta
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden animate-fade-in">
      {/* Progress bar */}
      <div className="h-1 bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      <div className="p-8">
        {/* Step 1 */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            {role === "player" ? (
              <div>
                <h2 className="text-lg font-bold text-white">¡Bienvenido Jugador!</h2>
                <p className="text-sm text-slate-400 mt-1">Configuraremos tu perfil deportivo personal para realizar seguimiento de tu rendimiento.</p>
                <div className="bg-white/5 border border-white/10 rounded-xl p-4 mt-4 text-xs text-slate-400 space-y-3">
                  <p className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Podrás reportar tu cuestionario diario de bienestar (Wellness).</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Podrás registrar la carga de tus entrenamientos (RPE).</span>
                  </p>
                  <p className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    <span>Visualizarás tus alertas y estadísticas individuales.</span>
                  </p>
                </div>
              </div>
            ) : role === "head_coach" ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">¡Bienvenido Entrenador!</h2>
                  <p className="text-sm text-slate-400 mt-1">Configura el nombre de tu marca u organización individual.</p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="coach-org-name" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Nombre de tu espacio deportivo *
                  </label>
                  <input
                    id="coach-org-name"
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => {
                      setOrgName(e.target.value);
                      setClubName(e.target.value);
                    }}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                    placeholder="Preparador Físico Pérez, Entrenamientos Pro..."
                  />
                </div>
              </div>
            ) : (
              // club_admin
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white">¿Qué tipo de organización eres?</h2>
                  <p className="text-sm text-slate-400 mt-1">Esto determina las funcionalidades disponibles.</p>
                </div>

                <div className="space-y-3">
                  {ORG_TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      id={`org-type-${opt.value}`}
                      onClick={() => setOrgType(opt.value)}
                      className={`w-full text-left rounded-xl border p-4 transition-all ${
                        orgType === opt.value
                          ? "border-emerald-500/60 bg-emerald-500/10"
                          : "border-white/10 bg-white/3 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-10 w-10 shrink-0 rounded-xl flex items-center justify-center border transition-all ${
                          orgType === opt.value
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                            : "bg-white/5 border-white/10 text-slate-400"
                        }`}>
                          <opt.icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">{opt.label}</p>
                          <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                        </div>
                        {orgType === opt.value && (
                          <div className="ml-auto h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              id="onboarding-next-1"
              disabled={role === "head_coach" && !orgName.trim()}
              onClick={() => setStep(2)}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm py-2.5 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            {role === "player" ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Cuéntanos sobre ti</h2>
                  <p className="text-sm text-slate-400 mt-1">Completa tus datos físicos iniciales.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fecha de nacimiento</label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Nacionalidad</label>
                    <input
                      type="text"
                      value={nationality}
                      onChange={(e) => setNationality(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pie dominante</label>
                    <select
                      value={dominantFoot}
                      onChange={(e) => setDominantFoot(e.target.value as any)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 [&>option]:bg-zinc-950"
                    >
                      <option value="right">Derecho</option>
                      <option value="left">Izquierdo</option>
                      <option value="both">Ambos</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Altura (cm)</label>
                    <input
                      type="number"
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Peso (kg)</label>
                    <input
                      type="number"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                    />
                  </div>
                </div>
              </div>
            ) : (
              // club_admin / head_coach
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white">Cuéntanos sobre tu organización</h2>
                  <p className="text-sm text-slate-400 mt-1">Estos datos pueden editarse después.</p>
                </div>

                <div className="space-y-4">
                  {role === "club_admin" && (
                    <div className="space-y-1.5">
                      <label htmlFor="org-name" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Nombre de la organización *
                      </label>
                      <input
                        id="org-name"
                        type="text"
                        required
                        value={orgName}
                        onChange={(e) => setOrgName(e.target.value)}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                        placeholder="SD Almazán, Academia Futuro..."
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label htmlFor="club-name" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Nombre del club / marca
                    </label>
                    <input
                      id="club-name"
                      type="text"
                      value={clubName}
                      onChange={(e) => setClubName(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                      placeholder="Igual que la organización si se omite"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                id="onboarding-back-2"
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm py-2.5 transition-all"
              >
                Atrás
              </button>
              <button
                id="onboarding-next-2"
                disabled={role === "club_admin" && !orgName.trim()}
                onClick={() => setStep(3)}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm py-2.5 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            {role === "player" ? (
              <div className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-white">Posición preferida</h2>
                  <p className="text-sm text-slate-400 mt-1">Elige tu rol principal en el campo de juego.</p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Posición en el campo</label>
                  <select
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 [&>option]:bg-zinc-950"
                  >
                    {POSITION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            ) : (
              // club_admin / head_coach
              <div className="space-y-6">
                <div>
                  <h2 className="text-lg font-bold text-white">Configura tu primera temporada</h2>
                  <p className="text-sm text-slate-400 mt-1">Puedes añadir más equipos y temporadas después.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label htmlFor="season-name" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Temporada
                    </label>
                    <input
                      id="season-name"
                      type="text"
                      value={seasonName}
                      onChange={(e) => setSeasonName(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                      placeholder="2026/27"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="team-name" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Primer equipo
                    </label>
                    <input
                      id="team-name"
                      type="text"
                      value={teamName}
                      onChange={(e) => setTeamName(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                      placeholder="Primer equipo, Juvenil A..."
                    />
                  </div>
                </div>
              </div>
            )}

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                id="onboarding-back-3"
                onClick={() => setStep(2)}
                className="flex-1 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm py-2.5 transition-all"
              >
                Atrás
              </button>
              <button
                id="onboarding-finish"
                disabled={loading}
                onClick={handleFinish}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm py-2.5 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? "Configurando..." : "¡Empezar!"}
              </button>
            </div>
          </div>
        )}

        {/* Step indicator */}
        <div className="flex justify-center gap-2 mt-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all ${
                s === step ? "w-6 bg-emerald-500" : s < step ? "w-3 bg-emerald-700" : "w-3 bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Already registered / Logout link */}
        <div className="mt-8 pt-4 border-t border-white/[0.06] text-center">
          <button
            onClick={handleSignOut}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
          >
            ¿Ya tienes tu cuenta configurada? <span className="text-emerald-500 font-semibold hover:text-emerald-400">Inicia sesión</span>
          </button>
        </div>
      </div>
    </div>
  );
}
