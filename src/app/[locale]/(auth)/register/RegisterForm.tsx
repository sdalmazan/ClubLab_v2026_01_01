"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shield, UserCheck, User, ShieldCheck, MailCheck } from "lucide-react";
import { PrivacyPolicyModal } from "@/components/auth/PrivacyPolicyModal";

function RegisterFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token");
  const emailParam = searchParams.get("email");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(emailParam || "");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"club_admin" | "head_coach" | "player">("club_admin");
  const [preferredChannel, setPreferredChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [invitationOrg, setInvitationOrg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Load invitation details if token present
  useEffect(() => {
    if (tokenParam) {
      fetch(`/api/organization/invitations?token=${encodeURIComponent(tokenParam)}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.invitation) {
            if (data.invitation.fullName) setFullName(data.invitation.fullName);
            if (data.invitation.email) setEmail(data.invitation.email);
            if (data.invitation.role) setRole(data.invitation.role);
            if (data.invitation.organizationName) setInvitationOrg(data.invitation.organizationName);
          }
        })
        .catch(() => {});
    }
  }, [tokenParam]);

  async function handleGoogleRegister() {
    if (!privacyAccepted) {
      setError("Debes aceptar la Política de Privacidad de Datos para registrarte.");
      return;
    }

    const supabase = createClient();
    const tokenQuery = tokenParam ? `&token=${encodeURIComponent(tokenParam)}` : "";
    const channelQuery = `&preferredChannel=${preferredChannel}`;
    const phoneQuery = phoneNumber ? `&phone=${encodeURIComponent(phoneNumber)}` : "";

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        scopes: "email profile https://www.googleapis.com/auth/user.birthday.read https://www.googleapis.com/auth/user.phonenumbers.read",
        redirectTo: `${location.origin}/api/auth/callback?next=/onboarding&role=${role}${tokenQuery}${channelQuery}${phoneQuery}`,
      },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!privacyAccepted) {
      setError("Debes marcar la casilla para aceptar la Política de Privacidad de Datos.");
      return;
    }

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        },
        emailRedirectTo: `${location.origin}/onboarding`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (authData.user) {
      // Record RGPD consent and link invitation/player profile
      try {
        await fetch("/api/auth/register-consent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: authData.user.id,
            email: email,
            consentAccepted: true,
            token: tokenParam || undefined,
            preferredChannel: preferredChannel,
            phoneNumber: phoneNumber || undefined,
          }),
        });
      } catch (err) {
        console.error("[Consent Error]", err);
      }
    }

    // Redirect to onboarding after registration
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="bg-card rounded-lg border border-border p-8 animate-fade-in relative">
      {invitationOrg && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
          <MailCheck className="h-4 w-4 shrink-0" />
          <span>Invitación oficial de: <strong>{invitationOrg}</strong></span>
        </div>
      )}

      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Crea tu cuenta</h2>
        <p className="text-sm text-slate-400 mt-1">
          Empieza a gestionar tu club con ClubLab
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" id="register-form">
        {/* Full name */}
        <div className="space-y-1.5">
          <label
            htmlFor="register-name"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            Nombre completo
          </label>
          <input
            id="register-name"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            placeholder="Nombre Apellido"
          />
        </div>

        {/* Role Selection */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            ¿Cómo usarás ClubLab?
          </label>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setRole("club_admin")}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                role === "club_admin"
                  ? "border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-950/20"
                  : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200"
              }`}
            >
              <Shield className="h-5 w-5 mb-1.5 text-emerald-500" />
              <span className="text-xs font-bold block">Club / Academia</span>
              <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">Admin corporativo</span>
            </button>

            <button
              type="button"
              onClick={() => setRole("head_coach")}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                role === "head_coach"
                  ? "border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-950/20"
                  : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200"
              }`}
            >
              <UserCheck className="h-5 w-5 mb-1.5 text-emerald-500" />
              <span className="text-xs font-bold block">Entrenador</span>
              <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">Uso individual</span>
            </button>

            <button
              type="button"
              onClick={() => setRole("player")}
              className={`flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center ${
                role === "player"
                  ? "border-emerald-500 bg-emerald-500/10 text-white shadow-lg shadow-emerald-950/20"
                  : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20 hover:text-slate-200"
              }`}
            >
              <User className="h-5 w-5 mb-1.5 text-emerald-500" />
              <span className="text-xs font-bold block">Jugador</span>
              <span className="text-[10px] text-slate-500 mt-0.5 leading-tight">Perfil personal</span>
            </button>
          </div>
        </div>

        {/* Notification Channel Preference */}
        <div className="space-y-2 p-3.5 rounded-2xl bg-white/[0.03] border border-white/10">
          <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider block">
            Canal de Notificaciones Preferido
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPreferredChannel("whatsapp")}
              className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between relative overflow-hidden ${
                preferredChannel === "whatsapp"
                  ? "border-emerald-500 bg-emerald-500/15 text-white"
                  : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
              }`}
            >
              <div className="flex items-center justify-between gap-1 flex-wrap w-full">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1 shrink-0">
                  💬 WhatsApp
                </span>
                <span className="text-[8.5px] font-black px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                  ⚡ RECOMENDADO
                </span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1.5 leading-tight block">
                Mayor rapidez para convocatorias y avisos urgentes.
              </span>
            </button>

            <button
              type="button"
              onClick={() => setPreferredChannel("email")}
              className={`p-3 rounded-xl border transition-all text-left flex flex-col justify-between ${
                preferredChannel === "email"
                  ? "border-emerald-500 bg-emerald-500/15 text-white"
                  : "border-white/10 bg-white/5 text-slate-400 hover:border-white/20"
              }`}
            >
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1">
                📧 Correo Electrónico
              </span>
              <span className="text-[10px] text-slate-400 mt-1.5 leading-tight block">
                Avisos en tu bandeja de entrada tradicional.
              </span>
            </button>
          </div>

          {preferredChannel === "whatsapp" && (
            <div className="pt-2 animate-fade-in space-y-1.5">
              <label htmlFor="register-phone" className="text-[11px] font-semibold text-slate-300">
                Número de Teléfono (WhatsApp)
              </label>
              <input
                id="register-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                placeholder="+34 600 000 000"
              />
            </div>
          )}

          <p className="text-[10px] text-slate-500 flex items-center gap-1 pt-1">
            <span>🛡️</span>
            <span>Tranquilo: Solo recibirás notificaciones indispensables de tu plantilla (convocatorias y alertas). Cero spam.</span>
          </p>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="register-email"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            Correo electrónico
          </label>
          <input
            id="register-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            placeholder="tu@email.com"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label
            htmlFor="register-password"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            Contraseña
          </label>
          <input
            id="register-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        {/* RGPD Privacy Policy Acceptance Checkbox */}
        <div className="pt-2">
          <label className="flex items-start gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              id="privacy-consent-checkbox"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0 cursor-pointer accent-emerald-500"
            />
            <span className="text-xs text-slate-400 group-hover:text-slate-300 leading-tight">
              Acepto la{" "}
              <button
                type="button"
                onClick={() => setShowPrivacyModal(true)}
                className="text-emerald-400 hover:underline font-medium focus:outline-none"
              >
                Política de Privacidad y Protección de Datos
              </button>{" "}
              de ClubLab para vincular mi perfil y tratar mis datos deportivos (RGPD).
            </span>
          </label>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Submit */}
        <button
          id="register-submit"
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm py-2.5 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        {/* Separator */}
        <div className="relative my-4 flex items-center justify-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <span className="relative bg-[#0d0f14] px-3 text-xs text-slate-500 uppercase tracking-widest">
            o
          </span>
        </div>

        {/* Google Register */}
        <button
          type="button"
          onClick={handleGoogleRegister}
          className="w-full flex items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white font-semibold text-sm py-2.5 transition-all"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
          </svg>
          Registrarse con Google
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-500">
        ¿Ya tienes cuenta?{" "}
        <Link
          href="/login"
          className="text-emerald-500 hover:text-emerald-400 font-medium transition-colors"
        >
          Inicia sesión
        </Link>
      </p>

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </div>
  );
}

export function RegisterForm() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando...</div>}>
      <RegisterFormContent />
    </Suspense>
  );
}
