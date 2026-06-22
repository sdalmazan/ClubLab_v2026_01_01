"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function RegisterForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${location.origin}/onboarding`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Redirect to onboarding after registration
    router.push("/onboarding");
    router.refresh();
  }

  return (
    <div className="glass rounded-2xl p-8 animate-fade-in">
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
    </div>
  );
}
