"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shield, UserCheck, User, MailCheck, Check, X, Lock } from "lucide-react";
import { PrivacyPolicyModal } from "@/components/auth/PrivacyPolicyModal";

function RegisterFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token");
  const emailParam = searchParams.get("email");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(emailParam || "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"club_admin" | "head_coach" | "player">("club_admin");
  const [preferredChannel, setPreferredChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [invitationOrg, setInvitationOrg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  // Password complexity rules
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  // Auto-redirect to dedicated /invite page if token is present in /register
  useEffect(() => {
    if (tokenParam) {
      router.replace(`/invite?token=${encodeURIComponent(tokenParam)}${emailParam ? `&email=${encodeURIComponent(emailParam)}` : ""}`);
    }
  }, [tokenParam, emailParam, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!privacyAccepted) {
      setError("Debes marcar la casilla para aceptar la Política de Privacidad de Datos.");
      return;
    }

    if (!isPasswordValid) {
      setError("La contraseña no cumple con los requisitos mínimos de seguridad.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden. Por favor, verifica ambas contraseñas.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const appBaseUrl = "https://clublab.vercel.app";
    const nextPath = role === "player" ? "/player" : "/onboarding";

    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        },
        emailRedirectTo: `${appBaseUrl}/api/auth/callback?next=${nextPath}&token=${encodeURIComponent(tokenParam || "")}&preferredChannel=${preferredChannel}&phone=${encodeURIComponent(phoneNumber || "")}`,
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

    setLoading(false);

    // If session exists (email confirmation disabled in Supabase), go to player/onboarding directly.
    if (authData.session) {
      router.push(nextPath);
      router.refresh();
    } else {
      setSubmittedEmail(email);
    }
  }

  // Verification Pending View
  if (submittedEmail) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 animate-fade-in text-center space-y-5">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
          <MailCheck className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">¡Verifica tu correo electrónico!</h2>
          <p className="text-sm text-slate-300 mt-2 max-w-md mx-auto leading-relaxed">
            Hemos enviado un correo de verificación a:
            <br />
            <strong className="text-emerald-400 font-semibold text-base">{submittedEmail}</strong>
          </p>
        </div>
        <div className="p-4 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-400 text-left space-y-2">
          <p className="font-semibold text-slate-300">Pasos para activar tu cuenta:</p>
          <ol className="list-decimal list-inside space-y-1 text-slate-400">
            <li>Revisa tu bandeja de entrada (y la carpeta de SPAM).</li>
            <li>Haz clic en el enlace de confirmación en el email.</li>
            <li>Accederás directamente a tu perfil sin errores.</li>
          </ol>
        </div>
        <div className="pt-2 flex justify-center">
          <Link
            href="/login"
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm transition-all shadow-lg shadow-emerald-950/50"
          >
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 animate-fade-in relative shadow-2xl">
      {tokenParam ? (
        <div className="space-y-4 mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
            <MailCheck className="h-4 w-4" />
            <span>Invitación Oficial de Club</span>
          </div>
          <div>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Te han invitado a unirte a {invitationOrg || "SD Almazán"}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Crea tu contraseña y selecciona tu canal de notificaciones preferido para activar tu perfil.
            </p>
          </div>

          {/* Tarjeta de Resumen de Invitación */}
          <div className="p-4 rounded-2xl bg-slate-950/80 border border-emerald-500/30 space-y-3">
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Club / Entidad</span>
              <span className="text-xs font-extrabold text-white">{invitationOrg || "SD Almazán"}</span>
            </div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Rol Asignado</span>
              <span className="text-xs font-black text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                {role === "player" ? "⚽ Jugador / Futbolista" : role === "head_coach" ? "🧢 Entrenador" : "📋 Staff"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Correo de Alta</span>
              <span className="text-xs font-medium text-slate-200">{email}</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-white">Crea tu cuenta</h2>
          <p className="text-sm text-slate-400 mt-1">
            Empieza a gestionar tu club con ClubLab
          </p>
        </div>
      )}

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

        {/* Role Selection — Hidden if invited via token */}
        {!tokenParam && (
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
        )}

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

          {/* Password Validation Checklist */}
          {password.length > 0 && (
            <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10 text-[11px] space-y-1.5 text-slate-400 animate-fade-in mt-2">
              <p className="font-semibold text-slate-300 text-[11px] mb-1">Requisitos de contraseña:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                <div className={`flex items-center gap-1.5 ${hasMinLength ? "text-emerald-400" : "text-slate-500"}`}>
                  {hasMinLength ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
                  <span>Mínimo 8 caracteres</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasUpper ? "text-emerald-400" : "text-slate-500"}`}>
                  {hasUpper ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
                  <span>Una mayúscula (A-Z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasLower ? "text-emerald-400" : "text-slate-500"}`}>
                  {hasLower ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
                  <span>Una minúscula (a-z)</span>
                </div>
                <div className={`flex items-center gap-1.5 ${hasNumber ? "text-emerald-400" : "text-slate-500"}`}>
                  {hasNumber ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
                  <span>Un número (0-9)</span>
                </div>
                <div className={`flex items-center gap-1.5 col-span-1 sm:col-span-2 ${hasSpecial ? "text-emerald-400" : "text-slate-500"}`}>
                  {hasSpecial ? <Check className="h-3.5 w-3.5 shrink-0" /> : <X className="h-3.5 w-3.5 shrink-0 text-slate-600" />}
                  <span>Un carácter especial (@, #, $, %, !, etc.)</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label
            htmlFor="register-confirm-password"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            Repetir Contraseña
          </label>
          <input
            id="register-confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={`w-full rounded-xl bg-white/5 border px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 transition-all ${
              confirmPassword.length > 0
                ? passwordsMatch
                  ? "border-emerald-500/50 focus:ring-emerald-500/50"
                  : "border-red-500/50 focus:ring-red-500/50"
                : "border-white/10 focus:ring-emerald-500/50 focus:border-emerald-500/50"
            }`}
            placeholder="Repite tu contraseña"
          />
          {confirmPassword.length > 0 && (
            <p className={`text-[11px] font-medium flex items-center gap-1 pt-0.5 ${passwordsMatch ? "text-emerald-400" : "text-red-400"}`}>
              {passwordsMatch ? (
                <>
                  <Check className="h-3.5 w-3.5" /> Las contraseñas coinciden
                </>
              ) : (
                <>
                  <X className="h-3.5 w-3.5" /> Las contraseñas no coinciden
                </>
              )}
            </p>
          )}
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
          disabled={loading || !isPasswordValid || !passwordsMatch || !privacyAccepted}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm py-3 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading
            ? "Activando cuenta..."
            : tokenParam
            ? `Completar Registro en ${invitationOrg || "SD Almazán"} →`
            : "Crear cuenta"}
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
