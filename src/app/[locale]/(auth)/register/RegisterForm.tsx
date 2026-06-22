"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Shield, UserCheck, User } from "lucide-react";

export function RegisterForm() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"club_admin" | "head_coach" | "player">("club_admin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleGoogleRegister() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/api/auth/callback?next=/onboarding`,
      },
    });
  }

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
        data: {
          full_name: fullName,
          role: role
        },
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
    </div>
  );
}
