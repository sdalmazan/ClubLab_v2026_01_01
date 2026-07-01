"use client";

import React, { useState } from "react";
import {
  Activity,
  Users,
  Building,
  Mail,
  Plus,
  Trash2,
  ShieldCheck,
  AlertCircle,
  Clock,
  Eye,
  Settings,
  UserCheck,
  RotateCw,
  Search
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AdminPortalClientProps {
  initialData: {
    organizations: any[];
    users: any[];
    players: any[];
    onlineSnapshots: any[];
    dailyStats: any[];
    topPages: any[];
    topFeatures: any[];
    currentOnlineCount: number;
    tablesExist: boolean;
  };
}

export function AdminPortalClient({ initialData }: AdminPortalClientProps) {
  const [activeTab, setActiveTab] = useState<"telemetry" | "organizations" | "users" | "players">("telemetry");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Search/Filter states
  const [orgSearch, setOrgSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [playerSearch, setPlayerSearch] = useState("");

  // Form states
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("coach");
  const [inviteOrgId, setInviteOrgId] = useState("");

  // Create Organization Form states
  const [newOrgName, setNewOrgName] = useState("");
  const [newOrgSlug, setNewOrgSlug] = useState("");
  const [newOrgAdminEmail, setNewOrgAdminEmail] = useState("");
  const [newOrgAdminName, setNewOrgAdminName] = useState("");

  // Data states
  const [organizations, setOrganizations] = useState(initialData.organizations);
  const [users, setUsers] = useState(initialData.users);
  const [players, setPlayers] = useState(initialData.players);
  const [dailyStats, setDailyStats] = useState(initialData.dailyStats);
  const [currentOnlineCount, setCurrentOnlineCount] = useState(initialData.currentOnlineCount);

  const showFeedback = (type: "success" | "error", message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleAdminAction = async (payload: any) => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/manage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Operation failed");
      }

      showFeedback("success", "Operación realizada con éxito");
      
      // Update local states depending on action
      if (payload.action === "delete_org") {
        setOrganizations(prev => prev.filter(o => o.id !== payload.id));
      } else if (payload.action === "delete_user") {
        setUsers(prev => prev.filter(u => u.id !== payload.userId));
      } else if (payload.action === "delete_player") {
        setPlayers(prev => prev.filter(p => p.id !== payload.playerId));
      } else if (payload.action === "update_user_role") {
        setUsers(prev => prev.map(u => u.id === payload.userId ? { ...u, role: payload.role } : u));
      } else if (payload.action === "invite_user") {
        setInviteEmail("");
        // Reload users list (in real scenario, we would trigger a refresh or re-fetch)
        window.location.reload();
      } else if (payload.action === "create_org") {
        setNewOrgName("");
        setNewOrgSlug("");
        setNewOrgAdminEmail("");
        setNewOrgAdminName("");
        window.location.reload();
      } else if (payload.action === "aggregate_stats") {
        window.location.reload();
      }
    } catch (err: any) {
      showFeedback("error", err.message || "Error al realizar la operación");
    } finally {
      setLoading(false);
    }
  };

  const filteredOrgs = organizations.filter(o =>
    o.name.toLowerCase().includes(orgSearch.toLowerCase()) ||
    o.slug.toLowerCase().includes(orgSearch.toLowerCase())
  );

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredPlayers = players.filter(p =>
    `${p.first_name} ${p.last_name}`.toLowerCase().includes(playerSearch.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-emerald-450" />
            Portal de Super Administración
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión global de ClubLab, telemetría de uso y administración de cuentas.
          </p>
        </div>
        <button
          onClick={() => handleAdminAction({ action: "aggregate_stats" })}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold px-4 py-2.5 transition-all disabled:opacity-50 cursor-pointer"
        >
          <RotateCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Recargar Telemetría Diaria
        </button>
      </div>

      {/* FEEDBACK BANNERS */}
      {feedback && (
        <div
          className={`p-4 rounded-xl border text-xs font-bold flex items-center gap-2 animate-fade-in ${
            feedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
          }`}
        >
          <AlertCircle className="h-4 w-4" />
          {feedback.message}
        </div>
      )}

      {/* WARNING IF TABLES DONT EXIST */}
      {!initialData.tablesExist && (
        <div className="bg-amber-500/10 border border-amber-500/20 p-5 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Tablas de Telemetría e Historial de Uso Faltantes
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            Las tablas necesarias para registrar el uso no se han creado en tu base de datos Supabase. 
            Ejecuta el archivo de migración <code className="bg-slate-950 px-1.5 py-0.5 rounded text-amber-400">008_super_admin_metrics.sql</code> en el editor de SQL de tu panel de Supabase para habilitar el seguimiento del uso y de usuarios activos.
          </p>
        </div>
      )}

      {/* TABS SELECTOR */}
      <div className="flex gap-2 border-b border-white/5 pb-0.5 overflow-x-auto">
        {[
          { id: "telemetry", label: "Métricas y Telemetría", icon: Activity },
          { id: "organizations", label: "Organizaciones", icon: Building },
          { id: "users", label: "Cuentas y Personal", icon: Users },
          { id: "players", label: "Jugadores Registrados", icon: UserCheck },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all cursor-pointer ${
              activeTab === tab.id
                ? "border-emerald-500 text-white"
                : "border-transparent text-slate-500 hover:text-slate-350"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* TABS CONTENT */}
      <div className="space-y-6">
        
        {/* TAB 1: METRICS & TELEMETRY */}
        {activeTab === "telemetry" && (
          <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass rounded-2xl p-5 flex flex-col gap-1.5 bg-white/2 border border-white/10">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Clock className="h-3 w-3 text-sky-400" />
                  Usuarios Online (5 min)
                </span>
                <span className="text-3xl font-black text-white">{currentOnlineCount}</span>
                <span className="text-[9px] text-slate-400">Calculado en tiempo real</span>
              </div>

              <div className="glass rounded-2xl p-5 flex flex-col gap-1.5 bg-white/2 border border-white/10">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Eye className="h-3 w-3 text-emerald-400" />
                  Páginas Vistas (Hoy)
                </span>
                <span className="text-3xl font-black text-white">
                  {initialData.topPages.reduce((acc, p) => acc + p.count, 0)}
                </span>
                <span className="text-[9px] text-slate-400">Actividad de navegación</span>
              </div>

              <div className="glass rounded-2xl p-5 flex flex-col gap-1.5 bg-white/2 border border-white/10">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Settings className="h-3 w-3 text-amber-400" />
                  Acciones (Hoy)
                </span>
                <span className="text-3xl font-black text-white">
                  {initialData.topFeatures.reduce((acc, f) => acc + f.count, 0)}
                </span>
                <span className="text-[9px] text-slate-400">Interacciones registradas</span>
              </div>

              <div className="glass rounded-2xl p-5 flex flex-col gap-1.5 bg-white/2 border border-white/10">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                  <Users className="h-3 w-3 text-indigo-400" />
                  Total Registros
                </span>
                <span className="text-3xl font-black text-white">
                  {users.length + players.length}
                </span>
                <span className="text-[9px] text-slate-400">
                  {users.length} staff + {players.length} jugadores
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Viewed Pages */}
              <div className="glass rounded-2xl p-5 bg-white/2 border border-white/10 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Pantallas Más Visitadas (Histórico Reciente)
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] text-slate-500 font-bold uppercase">
                        <th className="py-2">Pantalla/Ruta</th>
                        <th className="py-2 text-right">Vistas</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {initialData.topPages.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="py-4 text-center text-slate-500 italic">No hay vistas registradas</td>
                        </tr>
                      ) : (
                        initialData.topPages.map((p, idx) => (
                          <tr key={idx} className="hover:bg-white/2">
                            <td className="py-2.5 font-mono text-slate-300">{p.path}</td>
                            <td className="py-2.5 text-right font-bold text-white">{p.count}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Features Used */}
              <div className="glass rounded-2xl p-5 bg-white/2 border border-white/10 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                  Utilidades Más Utilizadas
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-white/5 text-[10px] text-slate-500 font-bold uppercase">
                        <th className="py-2">Herramienta/Acción</th>
                        <th className="py-2 text-right">Ejecuciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {initialData.topFeatures.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="py-4 text-center text-slate-500 italic">No hay interacciones registradas</td>
                        </tr>
                      ) : (
                        initialData.topFeatures.map((f, idx) => (
                          <tr key={idx} className="hover:bg-white/2">
                            <td className="py-2.5 font-semibold text-slate-350">{f.feature_name}</td>
                            <td className="py-2.5 text-right font-bold text-white">{f.count}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Daily History Aggregation */}
            <div className="glass rounded-2xl p-5 bg-white/2 border border-white/10 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                Historial de Uso Diario (Cargas de Telemetría)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-white/5 text-[10px] text-slate-500 font-bold uppercase">
                      <th className="py-2">Fecha</th>
                      <th className="py-2">Usuarios Activos</th>
                      <th className="py-2">Páginas Vistas</th>
                      <th className="py-2">Pantalla Más Vista</th>
                      <th className="py-2">Acción Más Utilizada</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {dailyStats.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-550 italic">
                          No hay agregaciones diarias de telemetría registradas. Ejecuta la recarga de datos.
                        </td>
                      </tr>
                    ) : (
                      dailyStats.map((stat, idx) => (
                        <tr key={idx} className="hover:bg-white/2">
                          <td className="py-2.5 font-bold text-white">{stat.date}</td>
                          <td className="py-2.5 font-semibold text-slate-300">{stat.active_users}</td>
                          <td className="py-2.5 text-slate-300">{stat.total_page_views}</td>
                          <td className="py-2.5 font-mono text-emerald-400">{stat.most_viewed_screen}</td>
                          <td className="py-2.5 text-slate-350">{stat.most_used_feature}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: ORGANIZATIONS */}
        {activeTab === "organizations" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* List of Organizations (Left Column) */}
              <div className="lg:col-span-2 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
                  <input
                    type="text"
                    placeholder="Buscar organización por nombre o slug..."
                    value={orgSearch}
                    onChange={e => setOrgSearch(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>

                <div className="glass rounded-2xl bg-white/2 border border-white/10 overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/1 text-[10px] text-slate-500 font-bold uppercase">
                        <th className="p-4">Nombre / ID</th>
                        <th className="p-4">Slug</th>
                        <th className="p-4">Tipo</th>
                        <th className="p-4">Fecha de Registro</th>
                        <th className="p-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredOrgs.map(org => (
                        <tr key={org.id} className="hover:bg-white/1">
                          <td className="p-4 font-bold text-white">
                            {org.name}
                            <span className="block font-mono text-[9px] text-slate-600 mt-0.5">{org.id}</span>
                          </td>
                          <td className="p-4 text-slate-300 font-mono">{org.slug}</td>
                          <td className="p-4">
                            <Badge variant="secondary" className="capitalize text-[10px]">
                              {org.type === "club" ? "Club Deportivo" : "Academia"}
                            </Badge>
                          </td>
                          <td className="p-4 text-slate-400">{new Date(org.created_at).toLocaleDateString()}</td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => {
                                if (confirm(`¿Estás seguro de eliminar permanentemente la organización "${org.name}" y todos sus datos?`)) {
                                  handleAdminAction({ action: "delete_org", id: org.id });
                                }
                              }}
                              className="text-rose-400 hover:text-rose-350 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                              title="Eliminar organización"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Create Organization Form (Right Column) */}
              <div className="glass rounded-2xl p-5 bg-white/2 border border-white/10 space-y-4 h-fit">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Plus className="h-4 w-4 text-emerald-450" />
                  Crear Nueva Organización
                </h3>

                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nombre de la Organización</label>
                    <input
                      type="text"
                      placeholder="Ej. Club de Fútbol Real"
                      value={newOrgName}
                      onChange={e => {
                        setNewOrgName(e.target.value);
                        // Auto-generate slug
                        setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""));
                      }}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Slug (Identificador URL)</label>
                    <input
                      type="text"
                      placeholder="ej-club-real"
                      value={newOrgSlug}
                      onChange={e => setNewOrgSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, ""))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5 border-t border-white/5 pt-2">
                    <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Administrador Principal</label>
                    <p className="text-[9px] text-slate-500 leading-normal">Se le creará una cuenta vinculada a esta organización.</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Nombre Completo del Admin</label>
                    <input
                      type="text"
                      placeholder="Ej. Juan Pérez"
                      value={newOrgAdminName}
                      onChange={e => setNewOrgAdminName(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Correo Electrónico del Admin</label>
                    <input
                      type="email"
                      placeholder="admin@clubreal.com"
                      value={newOrgAdminEmail}
                      onChange={e => setNewOrgAdminEmail(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={() => {
                      if (!newOrgName || !newOrgSlug || !newOrgAdminEmail || !newOrgAdminName) {
                        alert("Por favor, rellena todos los campos.");
                        return;
                      }
                      handleAdminAction({
                        action: "create_org",
                        name: newOrgName,
                        slug: newOrgSlug,
                        adminEmail: newOrgAdminEmail,
                        adminName: newOrgAdminName
                      });
                    }}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Crear Organización y Admin
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: USERS & STAFF */}
        {activeTab === "users" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Users List (Left Column) */}
              <div className="lg:col-span-2 space-y-4">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
                  <input
                    type="text"
                    placeholder="Buscar usuario por correo o rol..."
                    value={userSearch}
                    onChange={e => setUserSearch(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>

                <div className="glass rounded-2xl bg-white/2 border border-white/10 overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-white/5 bg-white/1 text-[10px] text-slate-500 font-bold uppercase">
                        <th className="p-4">Usuario (Correo)</th>
                        <th className="p-4">Organización</th>
                        <th className="p-4">Rol Asignado</th>
                        <th className="p-4 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {filteredUsers.map((user, idx) => (
                        <tr key={idx} className="hover:bg-white/1">
                          <td className="p-4 font-bold text-white">
                            {user.email}
                            <span className="block font-mono text-[9px] text-slate-600 mt-0.5">UID: {user.id}</span>
                          </td>
                          <td className="p-4 text-slate-300 font-semibold">{user.organization_name || "Ninguna"}</td>
                          <td className="p-4">
                            <select
                              value={user.role}
                              onChange={(e) => handleAdminAction({
                                action: "update_user_role",
                                userId: user.id,
                                organizationId: user.organization_id,
                                role: e.target.value
                              })}
                              className="rounded bg-slate-900 border border-white/10 text-white text-[11px] font-semibold px-2 py-1 focus:outline-none cursor-pointer"
                            >
                              <option value="super_admin">Super Administrador</option>
                              <option value="club_admin">Admin de Club</option>
                              <option value="academy_director">Director Academia</option>
                              <option value="academy_coordinator">Coordinador Academia</option>
                              <option value="head_coach">Primer Entrenador</option>
                              <option value="coach">Entrenador</option>
                              <option value="physical_coach">Prep. Físico</option>
                              <option value="physio">Fisioterapeuta</option>
                              <option value="sporting_director">Director Dep.</option>
                              <option value="player">Jugador</option>
                            </select>
                          </td>
                          <td className="p-4 text-right">
                            <button
                              onClick={() => {
                                if (confirm(`¿Estás seguro de eliminar permanentemente la cuenta de "${user.email}"?`)) {
                                  handleAdminAction({ action: "delete_user", userId: user.id });
                                }
                              }}
                              className="text-rose-400 hover:text-rose-350 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                              title="Eliminar cuenta"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Send Invitation Form (Right Column) */}
              <div className="glass rounded-2xl p-5 bg-white/2 border border-white/10 space-y-4 h-fit">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-emerald-450" />
                  Enviar Invitación de Registro
                </h3>
                
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Correo Electrónico</label>
                    <input
                      type="email"
                      placeholder="correo@ejemplo.com"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rol Propuesto</label>
                    <select
                      value={inviteRole}
                      onChange={e => setInviteRole(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value="club_admin">Administrador de Club</option>
                      <option value="head_coach">Primer Entrenador</option>
                      <option value="coach">Entrenador</option>
                      <option value="physical_coach">Preparador Físico</option>
                      <option value="sporting_director">Director Deportivo</option>
                      <option value="player">Jugador</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Organización Destino</label>
                    <select
                      value={inviteOrgId}
                      onChange={e => setInviteOrgId(e.target.value)}
                      className="w-full rounded-xl bg-slate-900 border border-white/10 px-3 py-2 text-xs text-white focus:outline-none cursor-pointer"
                    >
                      <option value="">-- Seleccionar Club/Academia --</option>
                      {organizations.map(org => (
                        <option key={org.id} value={org.id}>
                          {org.name} ({org.slug})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => {
                      if (!inviteEmail || !inviteOrgId) {
                        alert("Por favor rellena el correo y selecciona la organización.");
                        return;
                      }
                      handleAdminAction({
                        action: "invite_user",
                        email: inviteEmail,
                        role: inviteRole,
                        organizationId: inviteOrgId
                      });
                    }}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold py-2.5 transition-all cursor-pointer"
                  >
                    <Plus className="h-4 w-4" />
                    Crear & Vincular Invitado
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: PLAYERS */}
        {activeTab === "players" && (
          <div className="space-y-6">
            <div className="relative max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-600" />
              <input
                type="text"
                placeholder="Buscar jugador por nombre..."
                value={playerSearch}
                onChange={e => setPlayerSearch(e.target.value)}
                className="w-full rounded-xl bg-white/5 border border-white/10 pl-9 pr-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none"
              />
            </div>

            <div className="glass rounded-2xl bg-white/2 border border-white/10 overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-white/5 bg-white/1 text-[10px] text-slate-500 font-bold uppercase">
                    <th className="p-4">Jugador</th>
                    <th className="p-4">Organización</th>
                    <th className="p-4">Estado Físico</th>
                    <th className="p-4 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredPlayers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-slate-500 italic">No hay jugadores registrados</td>
                    </tr>
                  ) : (
                    filteredPlayers.map(player => (
                      <tr key={player.id} className="hover:bg-white/1">
                        <td className="p-4 font-bold text-white">
                          {player.first_name} {player.last_name}
                          <span className="block font-mono text-[9px] text-slate-600 mt-0.5">ID: {player.id}</span>
                        </td>
                        <td className="p-4 text-slate-300 font-semibold">{player.organization_name || "ClubLab"}</td>
                        <td className="p-4">
                          <span className={`inline-flex items-center text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                            player.physical_status === "green"
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                              : player.physical_status === "yellow"
                              ? "bg-amber-500/10 border-amber-500/20 text-amber-400"
                              : "bg-rose-500/10 border-rose-500/20 text-rose-400"
                          }`}>
                            {player.physical_status === "green" ? "Óptimo" : player.physical_status === "yellow" ? "Control" : "Vigilar"}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => {
                              if (confirm(`¿Estás seguro de eliminar permanentemente al jugador "${player.first_name} ${player.last_name}"?`)) {
                                handleAdminAction({ action: "delete_player", playerId: player.id });
                              }
                            }}
                            className="text-rose-400 hover:text-rose-350 p-1.5 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                            title="Eliminar jugador"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
