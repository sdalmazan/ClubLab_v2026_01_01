"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { MailCheck, Check, X, Shield, User, Lock, HeartPulse } from "lucide-react";
import { PrivacyPolicyModal } from "@/components/auth/PrivacyPolicyModal";

function InviteFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenParam = searchParams.get("token");
  const emailParam = searchParams.get("email");

  const [fullName, setFullName] = useState("Diego Ciria");
  const [email, setEmail] = useState(emailParam || "diego.ciria.lopez@gmail.com");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState<"player" | "head_coach" | "club_admin">("player");
  const [invitationOrg, setInvitationOrg] = useState<string>("S.D. Almazán");

  const [preferredChannel, setPreferredChannel] = useState<"whatsapp" | "email">("whatsapp");
  const [phoneNumber, setPhoneNumber] = useState("+34685228449");
  const [channelVerified, setChannelVerified] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpMessage, setOtpMessage] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const [completedSuccess, setCompletedSuccess] = useState(false);

  const handleSendOtp = async () => {
    setOtpError(null);
    setOtpMessage(null);
    setSendingOtp(true);

    const identifier = preferredChannel === "whatsapp" ? phoneNumber : email;
    if (!identifier || identifier.trim().length < 5) {
      setOtpError(`Por favor introduce un ${preferredChannel === "whatsapp" ? "número de WhatsApp" : "correo electrónico"} válido.`);
      setSendingOtp(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          channel: preferredChannel,
          purpose: "onboarding",
          recipientName: fullName,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setOtpError(data.error || "Error al enviar el código OTP.");
      } else {
        setOtpSent(true);
        setOtpMessage(`Te hemos enviado un código de 6 dígitos a tu ${preferredChannel === "whatsapp" ? "WhatsApp (" + phoneNumber + ")" : "correo (" + email + ")"}. Revisa tu aplicación.`);
      }
    } catch (e: any) {
      setOtpError("Error de conexión al solicitar el código OTP.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError(null);
    setOtpMessage(null);
    setVerifyingOtp(true);

    const identifier = preferredChannel === "whatsapp" ? phoneNumber : email;

    try {
      const res = await fetch("/api/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier,
          code: otpCode,
          channel: preferredChannel,
          purpose: "onboarding",
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setOtpError(data.error || "Código incorrecto o expirado.");
      } else {
        setChannelVerified(true);
        setOtpMessage(`¡${preferredChannel === "whatsapp" ? "WhatsApp" : "Correo electrónico"} verificado correctamente!`);
      }
    } catch (e: any) {
      setOtpError("Error al verificar el código OTP.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchingInvite, setFetchingInvite] = useState(true);

  // Password complexity rules
  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const isPasswordValid = hasMinLength && hasUpper && hasLower && hasNumber && hasSpecial;
  const passwordsMatch = password.length > 0 && confirmPassword.length > 0 && password === confirmPassword;

  // Load invitation details from token
  useEffect(() => {
    if (tokenParam) {
      setFetchingInvite(true);
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
        .catch((err) => console.error("Error fetching invitation details:", err))
        .finally(() => setFetchingInvite(false));
    } else {
      setFetchingInvite(false);
    }
  }, [tokenParam]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!privacyAccepted) {
      setError("Debes marcar la casilla para aceptar la Política de Privacidad de Datos.");
      return;
    }

    if (!channelVerified) {
      setError(`Debes verificar tu ${preferredChannel === "whatsapp" ? "WhatsApp" : "correo electrónico"} mediante código OTP antes de activar tu cuenta.`);
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

    try {
      // Complete Onboarding Server-Side (Transactional)
      const res = await fetch("/api/auth/complete-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: tokenParam,
          fullName,
          email,
          password,
          preferredChannel,
          phoneNumber,
          privacyAccepted: true,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "No se pudo activar la cuenta.");
        setLoading(false);
        return;
      }

      // Log in user via client Supabase session
      const supabase = createClient();
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

      setCompletedSuccess(true);
      setTimeout(() => {
        router.push("/player");
        router.refresh();
      }, 1200);
    } catch (err: any) {
      setError(err.message || "Error al completar el registro.");
      setLoading(false);
    }
  }

  // Completed Success View
  if (completedSuccess) {
    return (
      <div className="bg-card rounded-2xl border border-emerald-500/40 p-8 animate-fade-in text-center space-y-5 shadow-2xl">
        <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
          <Check className="h-7 w-7" />
        </div>
        <div>
          <h2 className="text-xl font-extrabold text-white">¡Cuenta Activada con Éxito!</h2>
          <p className="text-sm text-slate-300 mt-2 max-w-md mx-auto leading-relaxed">
            Tu perfil de <strong>Jugador</strong> en <strong>{invitationOrg}</strong> ha sido activado correctamente.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 text-center">
          Redirigiendo a tu Portal de Jugador...
      </div>
    );
  }

  return (
    <div className="bg-card rounded-2xl border border-border p-6 sm:p-8 animate-fade-in relative shadow-2xl space-y-6">
      {/* CABECERA OFICIAL DE INVITACIÓN */}
      <div className="space-y-3 border-b border-white/10 pb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <MailCheck className="h-4 w-4" />
          <span>Invitación Oficial al Club</span>
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Te han invitado a unirte a {invitationOrg}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Crea tu contraseña y selecciona tu canal de notificaciones para activar tu perfil.
          </p>
        </div>

        {/* TARJETA DE RESUMEN DEL ROL Y CLUB */}
        <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-2.5">
          <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
            <span className="font-semibold text-slate-400 uppercase tracking-wider">Club / Entidad</span>
            <span className="font-extrabold text-white">{invitationOrg}</span>
          </div>
          <div className="flex items-center justify-between text-xs border-b border-white/10 pb-2">
            <span className="font-semibold text-slate-400 uppercase tracking-wider">Rol Asignado</span>
            <span className="font-black text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              {role === "player" ? "⚽ Jugador / Futbolista" : role === "head_coach" ? "🧢 Entrenador" : "📋 Staff"}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-400 uppercase tracking-wider">Correo de Alta</span>
            <span className="font-medium text-slate-200">{email}</span>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" id="invite-form">
        {/* Full name */}
        <div className="space-y-1.5">
          <label
            htmlFor="invite-name"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            Nombre completo
          </label>
          <input
            id="invite-name"
            type="text"
            autoComplete="name"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            placeholder="Nombre Apellido"
          />
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

          {/* CHANNEL VERIFICATION SECTION */}
          <div className="pt-2 animate-fade-in space-y-2.5">
            {preferredChannel === "whatsapp" ? (
              <div>
                <label htmlFor="invite-phone" className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Número de Teléfono (WhatsApp)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="invite-phone"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => {
                      setPhoneNumber(e.target.value);
                      setChannelVerified(false);
                      setOtpSent(false);
                      setOtpMessage(null);
                    }}
                    disabled={channelVerified}
                    className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-60"
                    placeholder="+34 685 228 4495"
                  />
                  {!channelVerified ? (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={sendingOtp}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 transition-all cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {sendingOtp ? "Enviando..." : otpSent ? "Reenviar Código" : "Enviar OTP WhatsApp"}
                    </button>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1 shrink-0">
                      <Check className="w-3.5 h-3.5" /> WhatsApp Verificado
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-300">
                    Verificación de Correo Electrónico ({email})
                  </span>
                  {!channelVerified ? (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={sendingOtp}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 transition-all cursor-pointer shadow-md disabled:opacity-50"
                    >
                      {sendingOtp ? "Enviando..." : otpSent ? "Reenviar Código" : "Enviar OTP a Email"}
                    </button>
                  ) : (
                    <span className="px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-1 shrink-0">
                      <Check className="w-3.5 h-3.5" /> Email Verificado
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* OTP Status Info */}
            {otpMessage && (
              <p className="text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                {otpMessage}
              </p>
            )}

            {/* OTP Code Input Box */}
            {otpSent && !channelVerified && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5 animate-fade-in">
                <div className="flex items-center justify-between text-xs text-emerald-300 font-semibold">
                  <span>🔑 Introduce el código de 6 dígitos recibido:</span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Ingresa 6 dígitos"
                    className="flex-1 rounded-xl bg-slate-900 border border-emerald-500/40 px-3 py-2 text-xs font-mono text-center font-bold text-white tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    disabled={verifyingOtp || otpCode.trim().length !== 6}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs shrink-0 transition-all cursor-pointer shadow-lg disabled:opacity-50"
                  >
                    {verifyingOtp ? "Validando..." : "Validar Código"}
                  </button>
                </div>
              </div>
            )}

            {otpError && (
              <p className="text-[11px] font-semibold text-red-400 bg-red-500/10 p-2.5 rounded-xl border border-red-500/20">
                {otpError}
              </p>
            )}
          </div>

          <p className="text-[10px] text-slate-500 flex items-center gap-1 pt-1">
            <span>🛡️</span>
            <span>Tranquilo: Solo recibirás notificaciones indispensables de tu plantilla (convocatorias y alertas). Cero spam.</span>
          </p>
        </div>

        {/* Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="invite-email"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            Correo electrónico
          </label>
          <input
            id="invite-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            placeholder="tu@email.com"
          />
        </div>

        {/* Password */}
        <div className="space-y-1.5">
          <label
            htmlFor="invite-password"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            Crea tu Contraseña
          </label>
          <input
            id="invite-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            placeholder="Mínimo 8 caracteres"
          />

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
            htmlFor="invite-confirm-password"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            Repetir Contraseña
          </label>
          <input
            id="invite-confirm-password"
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
                : "border-white/10 focus:ring-emerald-500/50"
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
              id="privacy-consent-checkbox-invite"
              checked={privacyAccepted}
              onChange={(e) => setPrivacyAccepted(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500 accent-emerald-500"
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
              de ClubLab para vincular mi perfil a {invitationOrg}.
            </span>
          </label>
        </div>

        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          id="invite-submit"
          type="submit"
          disabled={loading || !isPasswordValid || !passwordsMatch || !privacyAccepted}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-bold text-sm py-3.5 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? "Activando cuenta..." : `Completar Registro en ${invitationOrg} →`}
        </button>
      </form>

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </div>
  );
}

export function InviteForm() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">Cargando datos de la invitación...</div>}>
      <InviteFormContent />
    </Suspense>
  );
}
