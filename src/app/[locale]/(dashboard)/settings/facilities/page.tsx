"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Building2,
  Dumbbell,
  Video,
  Layers,
  Sparkles,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface Facility {
  id: string;
  name: string;
  type: "field" | "gym" | "room" | "pool" | "other";
  surface: string | null;
  capacity: number | null;
  notes: string | null;
  is_active: boolean;
}

const TYPE_LABELS = {
  field: "Campo de Juego",
  gym: "Gimnasio",
  room: "Sala de Reunión/Vídeo",
  pool: "Piscina",
  other: "Otro",
};

const TYPE_ICONS = {
  field: Layers,
  gym: Dumbbell,
  room: Video,
  pool: Building2,
  other: Building2,
};

export default function FacilitiesPage() {
  const router = useRouter();
  const supabase = createClient();

  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string>("");
  const [orgSettings, setOrgSettings] = useState<any>({});

  // New facility form state
  const [name, setName] = useState("");
  const [type, setType] = useState<"field" | "gym" | "room" | "pool" | "other">("field");
  const [surface, setSurface] = useState("Hierba Artificial");
  const [capacity, setCapacity] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Get user organization
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError("No autenticado");
        setLoading(false);
        return;
      }

      const { data: orgRole } = await supabase
        .from("user_organization_roles")
        .select(`
          organization_id,
          organizations (
            settings
          )
        `)
        .eq("user_id", user.id)
        .single();

      if (!orgRole) {
        setError("No tienes organización asignada");
        setLoading(false);
        return;
      }

      setOrgId(orgRole.organization_id);
      setOrgSettings((orgRole as any)?.organizations?.settings ?? {});

      // Fetch facilities
      const { data, error: fetchErr } = await supabase
        .from("facilities")
        .select("*")
        .eq("organization_id", orgRole.organization_id)
        .order("created_at", { ascending: false });

      if (fetchErr) throw fetchErr;
      setFacilities(data ?? []);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? "Error al cargar instalaciones");
    } finally {
      setLoading(false);
    }
  }

  async function handleSetDefaultFacility(facilityId: string) {
    try {
      setError(null);
      setSuccess(null);
      
      const isCurrentDefault = orgSettings?.default_facility_id === facilityId;
      const updatedSettings = {
        ...orgSettings,
        default_facility_id: isCurrentDefault ? null : facilityId
      };

      const { error: updateErr } = await supabase
        .from("organizations")
        .update({ settings: updatedSettings })
        .eq("id", orgId);

      if (updateErr) throw updateErr;

      setOrgSettings(updatedSettings);
      setSuccess(
        isCurrentDefault 
          ? "Se ha quitado la instalación predeterminada" 
          : "Instalación predeterminada guardada correctamente"
      );
    } catch (err: any) {
      setError(err.message ?? "Error al establecer instalación por defecto");
    }
  }

  async function handleAddFacility(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const newFacility = {
        organization_id: orgId,
        name: name.trim(),
        type,
        surface: type === "field" ? surface : null,
        capacity: capacity ? Number(capacity) : null,
        notes: notes.trim() || null,
        is_active: true,
      };

      const { data, error: insertErr } = await supabase
        .from("facilities")
        .insert(newFacility)
        .select()
        .single();

      if (insertErr) throw insertErr;

      setFacilities([data, ...facilities]);
      setSuccess("Instalación creada correctamente");

      // Reset form
      setName("");
      setType("field");
      setSurface("Hierba Artificial");
      setCapacity("");
      setNotes("");
    } catch (err: any) {
      setError(err.message ?? "Error al crear instalación");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Seguro que deseas eliminar esta instalación?")) return;

    try {
      setError(null);
      setSuccess(null);

      const { error: delErr } = await supabase
        .from("facilities")
        .delete()
        .eq("id", id);

      if (delErr) throw delErr;

      setFacilities(facilities.filter((f) => f.id !== id));
      setSuccess("Instalación eliminada correctamente");
    } catch (err: any) {
      setError(err.message ?? "Error al eliminar instalación");
    }
  }

  const inputClass =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all";
  const labelClass = "block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5";

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Back to Settings */}
      <div>
        <Link
          href="/settings"
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors w-fit"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Ajustes
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <Building2 className="h-6 w-6 corp-icon" />
          Instalaciones y Campos
        </h1>
        <p className="text-slate-400 text-sm mt-0.5">
          Configura y edita los terrenos de juego, gimnasios y salas de tu academia. Podrás asignarlos en el diseño de las sesiones de entrenamiento.
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-3 text-sm text-rose-455">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-sm text-emerald-400 flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6">
        {/* Facilities list */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
            Instalaciones Registradas ({facilities.length})
          </h2>

          {loading ? (
            <div className="py-12 text-center text-slate-500 text-sm">Cargando instalaciones...</div>
          ) : facilities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 border border-dashed border-white/10 rounded-2xl bg-white/2">
              <Building2 className="h-8 w-8 text-slate-500 mb-2" />
              <p className="text-sm text-slate-400 font-semibold">No hay instalaciones registradas</p>
              <p className="text-xs text-slate-600 mt-1">Usa el formulario lateral para añadir la primera.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {facilities.map((fac) => {
                const Icon = TYPE_ICONS[fac.type] || Building2;
                return (
                  <div
                    key={fac.id}
                    className="bg-card rounded-lg border border-border p-5 hover:bg-muted/50 hover:border-border transition-all flex justify-between items-start gap-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-emerald-400 shrink-0">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="font-extrabold text-white text-sm">{fac.name}</h4>
                        <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-slate-400 bg-white/5 border border-white/5 rounded px-2 py-0.5">
                          {TYPE_LABELS[fac.type]}
                        </span>
                        {orgSettings?.default_facility_id === fac.id && (
                          <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-2 py-0.5 ml-1.5 animate-pulse">
                            Predeterminada
                          </span>
                        )}
                        {fac.surface && (
                          <p className="text-xs text-slate-405 mt-1">
                            Superficie: <span className="text-slate-300 font-medium">{fac.surface}</span>
                          </p>
                        )}
                        {fac.capacity && (
                          <p className="text-xs text-slate-405">
                            Aforo/Capacidad: <span className="text-slate-300 font-medium">{fac.capacity} personas</span>
                          </p>
                        )}
                        {fac.notes && (
                          <p className="text-xs text-slate-500 italic mt-1 font-medium">
                            "{fac.notes}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleSetDefaultFacility(fac.id)}
                        className={cn(
                          "p-1.5 rounded transition-all cursor-pointer",
                          orgSettings?.default_facility_id === fac.id
                            ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                            : "hover:bg-white/5 text-slate-500 hover:text-amber-400"
                        )}
                        title={
                          orgSettings?.default_facility_id === fac.id
                            ? "Quitar como predeterminada"
                            : "Establecer como predeterminada"
                        }
                      >
                        <Sparkles className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDelete(fac.id)}
                        className="p-1.5 rounded hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Add Facility Form */}
        <div>
          <form
            onSubmit={handleAddFacility}
            className="bg-card rounded-lg p-6 border border-border space-y-4"
          >
            <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-white/5 pb-2 mb-2">
              <Plus className="h-4 w-4 corp-icon" />
              Nueva Instalación
            </h3>

            <div>
              <label className={labelClass}>Nombre *</label>
              <input
                type="text"
                required
                placeholder="Ej: Campo F11 Principal, Gimnasio A"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Tipo de Instalación</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all cursor-pointer"
              >
                <option value="field">Campo de Juego</option>
                <option value="gym">Gimnasio</option>
                <option value="room">Sala de Reunión / Vídeo</option>
                <option value="pool">Piscina / Zona Agua</option>
                <option value="other">Otro</option>
              </select>
            </div>

            {type === "field" && (
              <div>
                <label className={labelClass}>Superficie</label>
                <select
                  value={surface}
                  onChange={(e) => setSurface(e.target.value)}
                  className="w-full rounded-xl bg-slate-900 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all cursor-pointer"
                >
                  <option value="Hierba Natural">Hierba Natural</option>
                  <option value="Hierba Artificial">Hierba Artificial</option>
                  <option value="Parqué / Pista">Parqué / Pista</option>
                  <option value="Tierra">Tierra</option>
                  <option value="Sintético">Sintético</option>
                </select>
              </div>
            )}

            <div>
              <label className={labelClass}>Aforo / Capacidad (Opcional)</label>
              <input
                type="number"
                placeholder="Ej: 30"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Notas / Observaciones</label>
              <textarea
                placeholder="Ej: Acceso por puerta trasera, iluminación regulable..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-sm py-3 transition-all shadow-lg shadow-emerald-950/40 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Crear Instalación"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
