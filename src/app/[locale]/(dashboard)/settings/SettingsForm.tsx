"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, Key, Building2, UserCog, CheckCircle2, AlertTriangle } from "lucide-react";

interface SettingsFormProps {
  initialEmail: string;
  initialName: string;
  role: string;
  organizationName: string;
}

export function SettingsForm({
  initialEmail,
  initialName,
  role,
  organizationName,
}: SettingsFormProps) {
  const [fullName, setFullName] = useState(initialName);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Role translation dictionary
  const roleTranslations: Record<string, string> = {
    super_admin: "Super Administrador",
    club_admin: "Administrador de Club",
    head_coach: "Primer Entrenador",
    coach: "Entrenador",
    player: "Jugador",
  };

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);
    setProfileLoading(true);

    if (!fullName.trim()) {
      setProfileError("El nombre completo no puede estar vacío.");
      setProfileLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      data: { full_name: fullName.trim() },
    });

    if (error) {
      setProfileError(error.message);
    } else {
      setProfileSuccess("Perfil actualizado con éxito.");
    }
    setProfileLoading(false);
  }

  async function handleUpdatePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);
    setPasswordLoading(true);

    if (newPassword.length < 8) {
      setPasswordError("La contraseña debe tener al menos 8 caracteres.");
      setPasswordLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      setPasswordLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPasswordError(error.message);
    } else {
      setPasswordSuccess("Contraseña cambiada con éxito.");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPasswordLoading(false);
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* ── LEFT: Account Info ── */}
      <div className="lg:col-span-1 space-y-6">
        <div className="glass rounded-2xl p-6 border border-white/[0.06] flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-emerald-950/50 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-extrabold text-2xl mb-4 shadow-lg shadow-emerald-950/40">
            {fullName.split("@")[0].slice(0, 2).toUpperCase()}
          </div>
          <h2 className="text-lg font-bold text-white truncate max-w-full">
            {fullName || "Usuario"}
          </h2>
          <p className="text-xs text-slate-400 truncate max-w-full mb-4">
            {initialEmail}
          </p>

          <div className="w-full border-t border-white/[0.06] pt-4 mt-2 space-y-3.5 text-left">
            <div className="flex items-center gap-3">
              <UserCog className="h-4 w-4 text-emerald-500 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">
                  Rol asignado
                </p>
                <p className="text-sm font-semibold text-slate-200 mt-1">
                  {roleTranslations[role] || role}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Building2 className="h-4 w-4 text-emerald-500 shrink-0" />
              <div>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider leading-none">
                  Organización
                </p>
                <p className="text-sm font-semibold text-slate-200 mt-1">
                  {organizationName || "Sin organización"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Forms ── */}
      <div className="lg:col-span-2 space-y-6">
        {/* Form: Profile details */}
        <div className="glass rounded-2xl p-6 border border-white/[0.06]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Detalles del Perfil</h3>
              <p className="text-xs text-slate-400">Actualiza tus datos de contacto básicos</p>
            </div>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  disabled
                  value={initialEmail}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-slate-400 cursor-not-allowed focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="settings-name" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Nombre completo
                </label>
                <input
                  id="settings-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder-slate-600"
                  placeholder="Tu Nombre completo"
                />
              </div>
            </div>

            {profileError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{profileError}</span>
              </div>
            )}

            {profileSuccess && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{profileSuccess}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={profileLoading}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-xs transition-all disabled:opacity-60 shadow-lg shadow-emerald-950/45 cursor-pointer"
              >
                {profileLoading ? "Guardando..." : "Guardar cambios"}
              </button>
            </div>
          </form>
        </div>

        {/* Form: Password reset */}
        <div className="glass rounded-2xl p-6 border border-white/[0.06]">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Cambiar Contraseña</h3>
              <p className="text-xs text-slate-400">Protege tu cuenta con una nueva clave segura</p>
            </div>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="settings-new-password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Nueva contraseña
                </label>
                <input
                  id="settings-new-password"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder-slate-700"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="settings-confirm-password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Confirmar contraseña
                </label>
                <input
                  id="settings-confirm-password"
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder-slate-700"
                  placeholder="Confirmar contraseña"
                />
              </div>
            </div>

            {passwordError && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            {passwordSuccess && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={passwordLoading}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-xs transition-all disabled:opacity-60 shadow-lg shadow-emerald-950/45 cursor-pointer"
              >
                {passwordLoading ? "Actualizando..." : "Actualizar contraseña"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
