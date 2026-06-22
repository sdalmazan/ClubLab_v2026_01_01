"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type OrgType = "club" | "academy" | "independent_coach";
type Step = 1 | 2 | 3;

const ORG_TYPE_OPTIONS: { value: OrgType; label: string; desc: string; icon: string }[] = [
  { value: "club", label: "Club de fútbol", desc: "Gestiona uno o varios equipos de un club", icon: "🏟️" },
  { value: "academy", label: "Academia", desc: "Múltiples equipos, metodología compartida", icon: "🎓" },
  { value: "independent_coach", label: "Entrenador independiente", desc: "Tú y tu equipo, sin estructura de club", icon: "🧑‍🏫" },
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
  const [orgType, setOrgType] = useState<OrgType>("club");
  const [orgName, setOrgName] = useState("");
  const [clubName, setClubName] = useState("");
  const [seasonName, setSeasonName] = useState("2026/27");
  const [teamName, setTeamName] = useState("Primer equipo");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      const slug = slugify(orgName) || `org-${Date.now()}`;
      const { data: org, error: orgErr } = await supabase
        .from("organizations")
        .insert({ name: orgName, slug, type: orgType })
        .select("id")
        .single();

      if (orgErr) throw new Error(orgErr.message);

      // 2. Assign free plan subscription
      const { data: freePlan } = await supabase
        .from("plans")
        .select("id")
        .eq("slug", "free")
        .single();

      if (freePlan) {
        await supabase.from("subscriptions").insert({
          organization_id: org.id,
          plan_id: freePlan.id,
          status: "manual",
        });
      }

      // 3. Create user role as club_admin
      await supabase.from("user_organization_roles").insert({
        user_id: user.id,
        organization_id: org.id,
        role: "club_admin",
      });

      // 4. Create club
      const { data: club, error: clubErr } = await supabase
        .from("clubs")
        .insert({ organization_id: org.id, name: clubName || orgName })
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
      await supabase.from("teams").insert({
        club_id: club.id,
        season_id: season.id,
        name: teamName,
        category: "Senior",
      });

      router.push("/dashboard");
      router.refresh();
    } catch (err: any) {
      setError(err.message ?? "Error al configurar la organización.");
      setLoading(false);
    }
  }

  return (
    <div className="glass rounded-2xl overflow-hidden animate-fade-in">
      {/* Progress bar */}
      <div className="h-1 bg-white/5">
        <div
          className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
          style={{ width: `${(step / 3) * 100}%` }}
        />
      </div>

      <div className="p-8">
        {/* Step 1 — Tipo de organización */}
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
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
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{opt.icon}</span>
                    <div>
                      <p className="font-semibold text-white text-sm">{opt.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{opt.desc}</p>
                    </div>
                    {orgType === opt.value && (
                      <div className="ml-auto h-2 w-2 rounded-full bg-emerald-500 animate-pulse-glow" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <button
              id="onboarding-next-1"
              onClick={() => setStep(2)}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm py-2.5 transition-all shadow-lg shadow-emerald-950/50"
            >
              Continuar
            </button>
          </div>
        )}

        {/* Step 2 — Nombre */}
        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-lg font-bold text-white">Cuéntanos sobre tu organización</h2>
              <p className="text-sm text-slate-400 mt-1">Estos datos pueden editarse después.</p>
            </div>

            <div className="space-y-4">
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

              <div className="space-y-1.5">
                <label htmlFor="club-name" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Nombre del club / academia
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
                disabled={!orgName.trim()}
                onClick={() => setStep(3)}
                className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm py-2.5 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Temporada y primer equipo */}
        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
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
      </div>
    </div>
  );
}
