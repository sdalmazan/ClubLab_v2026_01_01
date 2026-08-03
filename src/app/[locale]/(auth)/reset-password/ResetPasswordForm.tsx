"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Key, CheckCircle2, AlertTriangle, ArrowLeft, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isFirstLogin = searchParams.get("firstLogin") === "true";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [targetRole, setTargetRole] = useState<string>("dashboard");

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("Tu sesión ha expirado o es inválida. Por favor, inicia sesión de nuevo.");
      } else {
        const role = user.user_metadata?.role;
        if (role === "player") {
          setTargetRole("player");
        }
      }
      setCheckingSession(false);
    }
    checkSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(null);
    setError(null);
    setLoading(true);

    if (newPassword.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
    } else {
      setSuccess("¡Contraseña actualizada con éxito! Redirigiéndote al portal...");
      setNewPassword("");
      setConfirmPassword("");
      
      const destination = targetRole === "player" ? "/player" : "/dashboard";
      setTimeout(() => {
        router.push(destination);
        router.refresh();
      }, 1500);
    }
  }

  function handleSkip() {
    const destination = targetRole === "player" ? "/player" : "/dashboard";
    router.push(destination);
    router.refresh();
  }

  if (checkingSession) {
    return (
      <div className="bg-card rounded-lg border border-border p-8 text-center text-slate-400">
        Cargando verificación de cuenta...
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border border-border p-8 animate-fade-in">
      <div className="mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium mb-3">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>{isFirstLogin ? "Primer Inicio de Sesión" : "Seguridad de Cuenta"}</span>
        </div>
        <h2 className="text-xl font-bold text-white">
          {isFirstLogin ? "Personaliza tu contraseña" : "Restablecer tu contraseña"}
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          {isFirstLogin
            ? "Has accedido con la contraseña provisional. Te recomendamos definir una contraseña propia y personal."
            : "Escribe tu nueva contraseña de acceso a continuación."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" id="reset-password-form">
        {/* New Password */}
        <div className="space-y-1.5">
          <label
            htmlFor="reset-new-password"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            Nueva contraseña
          </label>
          <input
            id="reset-new-password"
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            placeholder="Mínimo 8 caracteres"
          />
        </div>

        {/* Confirm Password */}
        <div className="space-y-1.5">
          <label
            htmlFor="reset-confirm-password"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            Confirmar contraseña
          </label>
          <input
            id="reset-confirm-password"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            placeholder="Repite tu nueva contraseña"
          />
        </div>

        {/* Status messages */}
        {error && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* Submit */}
        <button
          id="reset-submit"
          type="submit"
          disabled={loading || !!success}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm py-2.5 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? "Guardando..." : "Guardar mi nueva contraseña"}
        </button>

        {isFirstLogin && !success && (
          <button
            type="button"
            onClick={handleSkip}
            className="w-full rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-medium text-xs py-2.5 transition-colors cursor-pointer"
          >
            Omitir por ahora y continuar al portal
          </button>
        )}
      </form>

      {!success && !isFirstLogin && (
        <div className="mt-6 flex justify-center">
          <Link
            href="/login"
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5"
          >
            <ArrowLeft className="h-3 w-3" />
            Volver a iniciar sesión
          </Link>
        </div>
      )}
    </div>
  );
}
