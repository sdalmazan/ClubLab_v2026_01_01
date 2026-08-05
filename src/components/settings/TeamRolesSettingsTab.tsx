"use client";

import { useState, useEffect } from "react";
import { Users, UserPlus, ShieldCheck, Mail, CheckCircle2, AlertCircle, RefreshCw, UserCheck, Trash2, Clock } from "lucide-react";

interface StaffMember {
  id: string;
  user_id: string;
  organization_id: string;
  role: string;
  is_admin?: boolean;
  created_at: string;
  email: string;
  full_name: string;
  is_pending?: boolean;
}

interface TeamRolesSettingsTabProps {
  organizationId: string;
}

const ROLE_OPTIONS = [
  { value: "super_admin", label: "Super Administrador" },
  { value: "club_admin", label: "Administrador del Club / Director" },
  { value: "head_coach", label: "Primer Entrenador (Head Coach)" },
  { value: "coach", label: "Entrenador / Ayudante" },
  { value: "physical_coach", label: "Preparador Físico" },
  { value: "physio", label: "Fisioterapeuta / Servicios Médicos" },
  { value: "sporting_director", label: "Director Deportivo / Scouting" },
  { value: "academy_director", label: "Director de Cantera / Academia" },
  { value: "player", label: "Jugador" },
];

export function TeamRolesSettingsTab({ organizationId }: TeamRolesSettingsTabProps) {
  const [members, setMembers] = useState<StaffMember[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Invite Form Modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("coach");
  const [inviteIsAdmin, setInviteIsAdmin] = useState(false);
  const [submittingInvite, setSubmittingInvite] = useState(false);

  useEffect(() => {
    loadData();
  }, [organizationId]);

  async function loadData() {
    try {
      setLoading(true);
      const res = await fetch("/api/organization/roles");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al cargar equipo");
      setMembers(data || []);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", message: err.message || "Error al cargar la lista de personal." });
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId: string, newRole: string) {
    try {
      setUpdatingUserId(userId);
      setFeedback(null);

      const res = await fetch("/api/organization/roles", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          role: newRole,
          organizationId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al actualizar rol");

      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m))
      );
      setFeedback({ type: "success", message: "Rol actualizado correctamente." });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", message: err.message || "No se pudo cambiar el rol." });
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleToggleAdminPermission(userId: string, targetMemberName: string, nextIsAdmin: boolean) {
    try {
      setUpdatingUserId(userId);
      setFeedback(null);

      const res = await fetch("/api/admin/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "toggle_user_admin_permission",
          userId: userId,
          isAdmin: nextIsAdmin,
        }),
      });

      if (!res.ok) throw new Error("Error al actualizar permisos de administrador");

      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, is_admin: nextIsAdmin } : m))
      );
      setFeedback({
        type: "success",
        message: nextIsAdmin
          ? `Permisos de Administrador concedidos a ${targetMemberName}.`
          : `Permisos de Administrador revocados para ${targetMemberName}.`,
      });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", message: err.message || "No se pudo cambiar el permiso de admin." });
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function handleDeleteMember(userId: string, email: string) {
    if (!confirm(`¿Estás seguro de eliminar a "${email}" del equipo y la organización?`)) return;

    try {
      setFeedback(null);
      const res = await fetch(`/api/organization/roles?userId=${userId}&organizationId=${organizationId}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar miembro del equipo");

      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      setFeedback({ type: "success", message: `Usuario ${email} eliminado del equipo correctamente.` });
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", message: err.message || "Error al eliminar el usuario." });
    }
  }

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      setSubmittingInvite(true);
      setFeedback(null);

      const res = await fetch("/api/organization/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          organizationId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al enviar invitación");

      if (inviteIsAdmin && data?.user_id) {
        await fetch("/api/admin/manage", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "toggle_user_admin_permission",
            userId: data.user_id,
            isAdmin: true,
          }),
        });
      }

      setFeedback({ type: "success", message: `Invitación enviada correctamente a ${inviteEmail}.` });
      setShowInviteModal(false);
      setInviteEmail("");
      setInviteIsAdmin(false);
      loadData();
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: "error", message: err.message || "Error al enviar invitación." });
    } finally {
      setSubmittingInvite(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-white/10 pb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-400" />
            Gestión de Usuarios, Roles y Permisos de Administración
          </h2>
          <p className="text-xs text-slate-400">
            Administra las funciones del cuerpo técnico y concede o revoca permisos de Administrador del Club a cualquier perfil.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 text-slate-300 hover:text-white transition-colors cursor-pointer"
            title="Recargar personal"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowInviteModal(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 shadow-md shadow-emerald-950/50 transition-all cursor-pointer"
          >
            <UserPlus className="h-4 w-4" />
            Invitar Miembro / Asignar Rol
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 animate-fade-in ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          }`}
        >
          {feedback.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {feedback.message}
        </div>
      )}

      {/* Members List Table */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-emerald-500" />
          <p className="text-xs text-slate-500 mt-2">Cargando cuentas y roles del club...</p>
        </div>
      ) : (
        <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-white/10 bg-slate-950/80 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-4">Usuario / Miembro</th>
                <th className="p-4">Correo Electrónico</th>
                <th className="p-4">Rol Principal</th>
                <th className="p-4 text-center">Permisos Admin</th>
                <th className="p-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500 italic">
                    No se encontraron miembros registrados en esta organización.
                  </td>
                </tr>
              ) : (
                members.map((member) => {
                  const isPrimaryAdminRole = member.role === "super_admin" || member.role === "club_admin";
                  const hasAdminAccess = isPrimaryAdminRole || member.is_admin === true;

                  return (
                    <tr key={member.id} className="hover:bg-white/2 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-emerald-400 text-xs shrink-0">
                            {member.full_name ? member.full_name.charAt(0).toUpperCase() : "M"}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white block">{member.full_name}</span>
                              {member.is_pending && (
                                <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                  ⏳ Pendiente
                                </span>
                              )}
                            </div>
                            <span className="text-[9px] font-mono text-slate-500">ID: #{member.user_id.slice(0, 8)}</span>
                          </div>
                        </div>
                      </td>

                      <td className="p-4 text-slate-300 font-medium">{member.email}</td>

                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={member.role}
                            disabled={updatingUserId === member.user_id}
                            onChange={(e) => handleRoleChange(member.user_id, e.target.value)}
                            className="rounded-xl bg-slate-950 border border-white/10 text-white text-xs font-semibold px-3 py-1.5 focus:border-emerald-500 focus:outline-none cursor-pointer disabled:opacity-50"
                          >
                            {ROLE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                          {updatingUserId === member.user_id && (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-400" />
                          )}
                        </div>
                      </td>

                      <td className="p-4 text-center">
                        <label className="inline-flex items-center gap-1.5 cursor-pointer bg-white/5 border border-white/10 px-2.5 py-1 rounded-xl hover:bg-white/10 transition-all select-none">
                          <input
                            type="checkbox"
                            checked={hasAdminAccess}
                            disabled={isPrimaryAdminRole || updatingUserId === member.user_id}
                            onChange={(e) => handleToggleAdminPermission(member.user_id, member.full_name || member.email, e.target.checked)}
                            className="rounded border-white/20 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer"
                          />
                          <span className={`text-[10px] font-bold ${hasAdminAccess ? "text-emerald-400" : "text-slate-400"}`}>
                            {hasAdminAccess ? "✓ Admin" : "No Admin"}
                          </span>
                        </label>
                      </td>

                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(member.user_id, member.email)}
                            className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                            title="Eliminar usuario del equipo"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL: INVITE MEMBER */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleInviteSubmit}
            className="bg-slate-900 border border-white/10 shadow-2xl w-full max-w-md rounded-2xl p-6 space-y-4 animate-fade-in"
          >
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <Mail className="h-4 w-4 text-emerald-400" />
                Invitar Miembro al Club & Asignar Permisos
              </h3>
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white font-bold text-lg cursor-pointer"
              >
                ×
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Correo Electrónico *
                </label>
                <input
                  type="email"
                  required
                  placeholder="ejemplo@club.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
                  Rol Principal Asignado *
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-xl bg-slate-950 border border-white/10 px-3.5 py-2 text-xs text-white focus:border-emerald-500 focus:outline-none cursor-pointer"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs text-slate-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={inviteIsAdmin}
                    onChange={(e) => setInviteIsAdmin(e.target.checked)}
                    className="rounded border-white/20 text-emerald-500 focus:ring-emerald-500/30 cursor-pointer"
                  />
                  <span>☑ Conceder también permisos de Administrador del Club</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => setShowInviteModal(false)}
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={submittingInvite}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md disabled:opacity-50 cursor-pointer"
              >
                {submittingInvite ? "Guardando..." : "Enviar e Asignar Rol"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
