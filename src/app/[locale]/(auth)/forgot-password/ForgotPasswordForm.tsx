"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Mail, CheckCircle2, AlertTriangle, ArrowLeft } from "lucide-react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(null);
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/api/auth/callback?next=/reset-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Se ha enviado un enlace de recuperación a tu correo electrónico. Por favor, revisa tu bandeja de entrada.");
      setEmail("");
    }
    setLoading(false);
  }

  return (
    <div className="glass rounded-2xl p-8 animate-fade-in">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white">Recuperar contraseña</h2>
        <p className="text-sm text-slate-400 mt-1">
          Escribe tu correo y te enviaremos un enlace para restablecer tu contraseña
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" id="forgot-password-form">
        {/* Email */}
        <div className="space-y-1.5">
          <label
            htmlFor="forgot-email"
            className="text-xs font-semibold text-slate-400 uppercase tracking-wider"
          >
            Correo electrónico
          </label>
          <div className="relative">
            <input
              id="forgot-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl bg-white/5 border border-white/10 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
              placeholder="tu@email.com"
            />
            <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
          </div>
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
          id="forgot-submit"
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm py-2.5 transition-all shadow-lg shadow-emerald-950/50 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? "Enviando enlace..." : "Enviar enlace de recuperación"}
        </button>
      </form>

      <div className="mt-6 flex justify-center">
        <Link
          href="/login"
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
