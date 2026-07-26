"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shield, GraduationCap, User, Check } from "lucide-react";
import { createInitialSubscription } from './actions';

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

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function OnboardingWizard() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<string>("club_admin");
  const [fullName, setFullName] = useState("");

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

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

  useEffect(() => {
    async function loadUser() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const userRole = user.user_metadata?.role || "club_admin";
        setRole(userRole);
        setFullName(user.user_metadata?.full_name || "");

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
          setTeamName("Senior A");
        }
      }
    }
    loadUser();
  }, []);

  async function handleFinish() {
    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // 1. Create organization
      const finalOrgName = orgName || `${fullName} Space`;
      const slug = slugify(finalOrgName) || `org-${Date.now()}`;
      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .insert({ name: finalOrgName, slug, type: orgType })
        .select("id")
        .single();

      if (orgErr) throw new Error(orgErr.message);

      // 2. Assign free plan subscription (via Server Action — uses service_role)
      await createInitialSubscription(org.id);

      // 3. Create user role in user_organization_roles
      const finalRole = role === "player" ? "player" : role === "head_coach" ? "head_coach" : "club_admin";
      await supabase.from("user_organization_roles").insert({
        user_id: user.id,
        organization_id: org.id,
        role: finalRole,
      });

      // 4. Create club
      const { data: club, error: clubErr } = await supabase
        .from("clubs")
        .insert({ organization_id: org.id, name: clubName || finalOrgName })
        .select("id")
        .single();

      if (clubErr) throw new Error(clubErr.message);

      // 5. Create first season
      const { data: season, error: seasonErr } = await supabase
        .from("seasons")
        .insert({
          club_id: club.id,
          name: seasonName,
          start_date: "2026-07-01",
          end_date: "2027-06-30",
          is_active: true,
        })
        .select("id")
        .single();

      if (seasonErr) throw new Error(seasonErr.message);

      // 6. Create first team
      const { data: team, error: teamErr } = await supabase
        .from("teams")
        .insert({
          club_id: club.id,
          season_id: season.id,
          name: teamName,
          category: "Senior",
        })
        .select("id")
        .single();

      if (teamErr) throw new Error(teamErr.message);

      // 7. Seed player-specific tables if role is player
      if (role === "player") {
        const nameParts = fullName.trim().split(" ");
        const firstName = nameParts[0] || "Jugador";
        const lastName = nameParts.slice(1).join(" ") || "Individual";

        const { data: playerRecord, error: playerErr } = await supabase
          .from("players")
          .insert({
            organization_id: org.id,
            first_name: firstName,
            last_name: lastName,
            date_of_birth: dob || null,
            nationality: nationality,
            dominant_foot: dominantFoot,
            height_cm: heightCm ? parseFloat(heightCm) : null,
            weight_kg: weightKg ? parseFloat(weightKg) : null,
          })
          .select("id")
          .single();

        if (playerErr) throw new Error(playerErr.message);

        // Link player to the default team
        const { error: memberErr } = await supabase
          .from("player_team_memberships")
          .insert({
            player_id: playerRecord.id,
            team_id: team.id,
            season_id: season.id,
            jersey_number: 10,
            positions: [position],
            status: "active",
          });

        if (memberErr) throw new Error(memberErr.message);
      }

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Error al configurar el onboarding.");
      setLoading(false);
    }
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
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm py-2.5 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-60 disabled:cursor-not-allowed"
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
