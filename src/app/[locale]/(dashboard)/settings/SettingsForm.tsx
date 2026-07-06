"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { User, Key, Building2, UserCog, CheckCircle2, AlertTriangle, ChevronDown } from "lucide-react";
import ImageAdjusterModal from "@/components/settings/ImageAdjusterModal";

import { VALIDATED_COLORS, findClosestValidatedColor } from "@/lib/colors";

function ColorPickerGrid({
  label,
  selectedColor,
  onChange,
}: {
  label: string;
  selectedColor: string;
  onChange: (hex: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(selectedColor);
  
  const closestValidated = findClosestValidatedColor(selectedColor);
  const activeColor = VALIDATED_COLORS.find(
    (c) => c.hex.toLowerCase() === selectedColor.toLowerCase()
  ) ?? { name: "Personalizado", hex: selectedColor };

  const closestColorInfo = VALIDATED_COLORS.find(
    (c) => c.hex.toLowerCase() === closestValidated.toLowerCase()
  );

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    if (/^#[0-9A-Fa-f]{6}$/.test(val) || /^#[0-9A-Fa-f]{3}$/.test(val)) {
      onChange(val);
    }
  };

  const handleColorPickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    onChange(val);
  };

  return (
    <div className="space-y-1.5 relative w-full">
      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
        {label}
        <span className="inline-block h-3.5 w-3.5 rounded-full border border-white/20 shadow-md transition-all duration-300" style={{ backgroundColor: selectedColor }} />
      </label>
      
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full rounded-xl bg-white/5 border border-white/10 px-3.5 py-2.5 text-left text-xs font-semibold text-slate-200 flex items-center justify-between hover:bg-white/10 transition-all cursor-pointer focus:outline-none"
      >
        <span className="flex items-center gap-2 truncate">
          <span className="h-4 w-4 rounded-full border border-white/20 shrink-0 shadow-sm transition-all duration-300" style={{ backgroundColor: selectedColor }} />
          <span className="truncate">
            {activeColor.name} ({selectedColor})
            {closestValidated.toLowerCase() !== selectedColor.toLowerCase() && (
              <span className="text-[10px] text-slate-400 font-normal ml-1">
                (Aprox: {closestColorInfo?.name})
              </span>
            )}
          </span>
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 transition-transform duration-200" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-80 rounded-2xl border border-white/10 bg-slate-950/95 backdrop-blur-xl p-4 shadow-2xl shadow-black z-50 animate-in fade-in slide-in-from-top-1 duration-150 space-y-4">
            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">Ingresar Color Corporativo:</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={inputValue}
                    onChange={handleTextChange}
                    placeholder="#10b981"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-xs text-white uppercase placeholder-slate-700 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
                <div className="relative h-8 w-8 rounded-lg overflow-hidden border border-white/10 shrink-0 cursor-pointer">
                  <input
                    type="color"
                    value={selectedColor.startsWith("#") && (selectedColor.length === 4 || selectedColor.length === 7) ? selectedColor : "#10b981"}
                    onChange={handleColorPickerChange}
                    className="absolute inset-0 h-full w-full opacity-0 cursor-pointer"
                  />
                  <div className="h-full w-full" style={{ backgroundColor: selectedColor }} />
                </div>
              </div>
            </div>

            {closestValidated.toLowerCase() !== selectedColor.toLowerCase() && (
              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2.5 flex items-start gap-2">
                <div className="h-4 w-4 rounded-full border border-white/20 shrink-0 mt-0.5 shadow-sm" style={{ backgroundColor: closestValidated }} />
                <div>
                  <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider leading-none">Ajuste Legible Adaptado</p>
                  <p className="text-[10px] text-slate-400 mt-1 leading-normal">
                    Se aplicará {closestColorInfo?.name} ({closestValidated}) para optimizar el contraste contra el fondo oscuro.
                  </p>
                </div>
              </div>
            )}

            <div>
              <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-2">O selecciona de la paleta validada:</p>
              <div className="grid grid-cols-6 gap-1.5 max-h-[140px] overflow-y-auto pr-1">
                {VALIDATED_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    onClick={() => {
                      onChange(c.hex);
                      setInputValue(c.hex);
                      setOpen(false);
                    }}
                    title={c.name}
                    className={`h-7 w-7 rounded-lg border transition-all hover:scale-110 cursor-pointer flex items-center justify-center ${
                      c.hex.toLowerCase() === selectedColor.toLowerCase()
                        ? "border-white ring-2 ring-emerald-500/50 scale-105"
                        : "border-white/10 hover:border-white/30"
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface SettingsFormProps {
  initialEmail: string;
  initialName: string;
  role: string;
  organizationName: string;
  organizationId?: string;
  organizationSettings?: any;
}

export function SettingsForm({
  initialEmail,
  initialName,
  role,
  organizationName,
  organizationId = "",
  organizationSettings = {},
}: SettingsFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initialName);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [activeTab, setActiveTab] = useState<'profile' | 'branding' | 'team' | 'methodology' | 'video_pack'>('profile');
  const [inactiveDaysThreshold, setInactiveDaysThreshold] = useState(21);
  const [overuseWeeklyThreshold, setOveruseWeeklyThreshold] = useState(4);

  useEffect(() => {
    async function loadAlertSettings() {
      if (!organizationId) return;
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from("org_alert_settings")
          .select("*")
          .eq("organization_id", organizationId)
          .single();

        if (data) {
          setInactiveDaysThreshold(data.concept_inactive_days_threshold);
          setOveruseWeeklyThreshold(data.concept_overuse_weekly_threshold);
        }
      } catch (err) {
        console.error("Error loading alert settings", err);
      }
    }
    loadAlertSettings();
  }, [organizationId]);

  // Organization settings states
  const [homeColor, setHomeColor] = useState(organizationSettings?.pantone_home_color ?? organizationSettings?.club_primary_color ?? "#10b981");
  const [rivalColor, setRivalColor] = useState(organizationSettings?.pantone_rival_color ?? "#3b82f6");
  const [checkinHours, setCheckinHours] = useState(organizationSettings?.default_checkin_hours_before ?? 8);
  const [checkinClose, setCheckinClose] = useState(organizationSettings?.default_checkin_close_mins_before ?? 15);
  const [checkoutDelay, setCheckoutDelay] = useState(organizationSettings?.default_checkout_mins_after ?? 30);
  const [checkoutClose, setCheckoutClose] = useState(organizationSettings?.default_checkout_close_hours_after ?? 16);

  // Club customization settings states
  const [clubName, setClubName] = useState(organizationSettings?.club_name ?? "");
  const [clubLogoUrl, setClubLogoUrl] = useState(organizationSettings?.club_logo_url ?? "");
  const [clubPrimaryColor, setClubPrimaryColor] = useState(organizationSettings?.club_primary_color ?? "#10b981");
  const [clubSecondaryColor, setClubSecondaryColor] = useState(organizationSettings?.club_secondary_color ?? "#6366f1");
  const [clubJerseyStyle, setClubJerseyStyle] = useState(organizationSettings?.club_jersey_style ?? "solid");
  const [defaultTrainingTime, setDefaultTrainingTime] = useState(organizationSettings?.default_training_time ?? "10:00");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [selectedFileForAdjustment, setSelectedFileForAdjustment] = useState<File | null>(null);

  // Custom taxonomy states
  const [customConcepts, setCustomConcepts] = useState<any[]>(() => {
    return organizationSettings?.custom_tactical_concepts ?? [
      { key: 'salida_balon', label: 'Salida de Balón', category: 'Fase Ofensiva' },
      { key: 'progresion_canalizacion', label: 'Progresión / Canalización', category: 'Fase Ofensiva' },
      { key: 'amplitud_profundidad', label: 'Amplitud y Profundidad', category: 'Fase Ofensiva' },
      { key: 'juego_posicion', label: 'Juego de Posición / Tercer Hombre', category: 'Fase Ofensiva' },
      { key: 'finalizacion', label: 'Finalización / Ocupación del Área', category: 'Fase Ofensiva' },
      { key: 'bloque_alto', label: 'Bloque Alto / Presión Alta', category: 'Fase Defensiva' },
      { key: 'bloque_medio', label: 'Bloque Medio / Repliegue Medio', category: 'Fase Defensiva' },
      { key: 'bloque_bajo', label: 'Bloque Bajo / Defensa de Área', category: 'Fase Defensiva' },
      { key: 'basculacion', label: 'Basculación / Orientación de Ayuda', category: 'Fase Defensiva' },
      { key: 'vigilancias_defensivas', label: 'Vigilancias Defensivas', category: 'Fase Defensiva' },
      { key: 'presion_tras_perdida', label: 'Presión Tras Pérdida (PTP)', category: 'Transición A-D' },
      { key: 'repliegue_intensivo', label: 'Repliegue Intensivo', category: 'Transición A-D' },
      { key: 'contraataque', label: 'Contraataque / Transición Rápida', category: 'Transición D-A' },
      { key: 'asegurar_pase', label: 'Asegurar Primer Pase / Conservación', category: 'Transición D-A' },
      { key: 'abp_ofensivo', label: 'ABP Ofensivo', category: 'ABP' },
      { key: 'abp_defensivo', label: 'ABP Defensivo', category: 'ABP' },
    ];
  });

  const [customMuscles, setCustomMuscles] = useState<any[]>(() => {
    return organizationSettings?.custom_muscle_groups ?? [
      { key: 'isquiotibiales', label: 'Isquiotibiales', zone: 'Cadena Posterior' },
      { key: 'gluteos', label: 'Glúteos (Mayor y Medio)', zone: 'Cadena Posterior' },
      { key: 'triceps_sural', label: 'Tríceps Sural (Gemelos y Sóleo)', zone: 'Cadena Posterior' },
      { key: 'cuadriceps', label: 'Cuádriceps', zone: 'Cadena Anterior' },
      { key: 'core_zona_media', label: 'Core / Zona Media', zone: 'Cadena Anterior' },
      { key: 'aductores', label: 'Aductores / Pubis', zone: 'Cadera-Ingle' },
      { key: 'flexores_cadera', label: 'Flexores de Cadera (Psóas Ilíaco)', zone: 'Cadera-Ingle' },
      { key: 'general_aerobico', label: 'Resistencia Aeróbica (General)', zone: 'General' },
      { key: 'velocidad_sprint', label: 'Velocidad / Sprint', zone: 'General' },
      { key: 'fuerza_explosiva', label: 'Fuerza Explosiva / Salto', zone: 'General' },
    ];
  });

  const [newConceptLabel, setNewConceptLabel] = useState("");
  const [newConceptCategory, setNewConceptCategory] = useState("Fase Ofensiva");
  const [newMuscleLabel, setNewMuscleLabel] = useState("");
  const [newMuscleZone, setNewMuscleZone] = useState("General");

  const addConcept = () => {
    if (!newConceptLabel.trim()) return;
    const key = newConceptLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (customConcepts.some((c) => c.key === key)) {
      alert("Ya existe un concepto con una clave similar.");
      return;
    }
    setCustomConcepts([...customConcepts, { key, label: newConceptLabel.trim(), category: newConceptCategory }]);
    setNewConceptLabel("");
  };

  const removeConcept = (key: string) => {
    setCustomConcepts(customConcepts.filter((c) => c.key !== key));
  };

  const addMuscle = () => {
    if (!newMuscleLabel.trim()) return;
    const key = newMuscleLabel.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
    if (customMuscles.some((m) => m.key === key)) {
      alert("Ya existe un grupo muscular con una clave similar.");
      return;
    }
    setCustomMuscles([...customMuscles, { key, label: newMuscleLabel.trim(), zone: newMuscleZone }]);
    setNewMuscleLabel("");
  };

  const removeMuscle = (key: string) => {
    setCustomMuscles(customMuscles.filter((m) => m.key !== key));
  };

  function handleLogoFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFileForAdjustment(file);
    e.target.value = ""; // Reset value so selecting the same file again triggers change
  }

  async function handleUploadProcessedLogo(blob: Blob) {
    setUploadingLogo(true);
    setOrgError(null);
    setOrgSuccess(null);

    const formData = new FormData();
    formData.append("file", blob, "logo.png");

    try {
      const res = await fetch("/api/clubs/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Error al subir el archivo");
      }

      // Add unique timestamp query param to force reload the image
      const newUrl = `${data.logoUrl}?t=${Date.now()}`;
      setClubLogoUrl(newUrl);

      // --- AUTO SAVE TO DATABASE ---
      const supabase = createClient();
      const updatedSettings = {
        ...organizationSettings,
        pantone_home_color: homeColor,
        pantone_rival_color: rivalColor,
        default_checkin_hours_before: Number(checkinHours),
        default_checkin_close_mins_before: Number(checkinClose),
        default_checkout_mins_after: Number(checkoutDelay),
        default_checkout_close_hours_after: Number(checkoutClose),
        club_name: clubName.trim(),
        club_logo_url: newUrl.trim(), // Use newly uploaded URL with timestamp
        club_primary_color: clubPrimaryColor,
        club_secondary_color: clubSecondaryColor,
        club_jersey_style: clubJerseyStyle,
        default_training_time: defaultTrainingTime.trim(),
        custom_tactical_concepts: customConcepts,
        custom_muscle_groups: customMuscles,
      };

      const { error: dbError } = await supabase
        .from("organizations")
        .update({ settings: updatedSettings })
        .eq("id", organizationId);

      if (dbError) {
        throw dbError;
      }

      setOrgSuccess("Escudo actualizado y guardado correctamente en tu cuenta.");
      
      // Refresh the page data
      router.refresh();
    } catch (err: any) {
      setOrgError(err.message || "Error al subir y guardar el escudo");
    } finally {
      setUploadingLogo(false);
    }
  }

  const [orgSuccess, setOrgSuccess] = useState<string | null>(null);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);

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

  async function handleUpdateOrgSettings(e: React.FormEvent) {
    e.preventDefault();
    setOrgSuccess(null);
    setOrgError(null);
    setOrgLoading(true);

    const supabase = createClient();
    const updatedSettings = {
      ...organizationSettings,
      pantone_home_color: homeColor,
      pantone_rival_color: rivalColor,
      default_checkin_hours_before: Number(checkinHours),
      default_checkin_close_mins_before: Number(checkinClose),
      default_checkout_mins_after: Number(checkoutDelay),
      default_checkout_close_hours_after: Number(checkoutClose),
      club_name: clubName.trim(),
      club_logo_url: clubLogoUrl.trim(),
      club_primary_color: clubPrimaryColor,
      club_secondary_color: clubSecondaryColor,
      club_jersey_style: clubJerseyStyle,
      default_training_time: defaultTrainingTime.trim(),
      custom_tactical_concepts: customConcepts,
      custom_muscle_groups: customMuscles,
    };

    const { error } = await supabase
      .from("organizations")
      .update({ settings: updatedSettings })
      .eq("id", organizationId);

    // Upsert alert settings threshold
    const { error: alertErr } = await supabase
      .from("org_alert_settings")
      .upsert({
        organization_id: organizationId,
        concept_inactive_days_threshold: Number(inactiveDaysThreshold),
        concept_overuse_weekly_threshold: Number(overuseWeeklyThreshold),
        updated_at: new Date().toISOString(),
      }, { onConflict: "organization_id" });

    if (alertErr) {
      console.error("Error updating alert settings", alertErr);
    }

    if (error) {
      setOrgError(error.message);
    } else {
      setOrgSuccess("Ajustes del club actualizados con éxito.");
      router.refresh(); // Refresh Server Components to update layout styling instantly!
    }
    setOrgLoading(false);
  }

  const isOrgAdmin = role === "super_admin" || role === "club_admin" || role === "head_coach";

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

      {/* ── RIGHT: Forms with tab layout ── */}
      <div className="lg:col-span-2 space-y-6">
        {/* Tab Navigation */}
        <div className="flex border-b border-white/5 mb-2 gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'profile'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Cuenta y Seguridad
          </button>
          {isOrgAdmin && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('branding')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'branding'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Interfaz y Marca
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('team')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'team'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Planificación y Equipo
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('methodology')}
                className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
                  activeTab === 'methodology'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                Academia y Metodología
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('video_pack')}
            className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'video_pack'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Herramientas de Vídeo
          </button>
        </div>

        {/* Tab 1: Profile & Password */}
        {(activeTab === 'profile' || !isOrgAdmin) && (
          <div className="space-y-6">
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
        )}

        {/* Tab 2: Interfaz y Marca */}
        {isOrgAdmin && activeTab === 'branding' && organizationId && (
          <div className="glass rounded-2xl p-6 border border-white/[0.06] space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Identidad de Marca</h3>
                <p className="text-xs text-slate-400">Personaliza la estética y el escudo de tu club</p>
              </div>
            </div>

            <form onSubmit={handleUpdateOrgSettings} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="club-name-input" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Nombre del Club / Academia
                  </label>
                  <input
                    id="club-name-input"
                    type="text"
                    value={clubName}
                    onChange={(e) => setClubName(e.target.value)}
                    placeholder="Nombre oficial del club"
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all placeholder-slate-750"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Escudo / Logotipo del Club
                  </label>
                  <div className="flex flex-wrap items-center gap-6 p-4 bg-white/2 border border-white/10 rounded-xl">
                    <div className="flex items-center gap-5 bg-black/20 p-2.5 rounded-xl border border-white/5 shrink-0">
                      <div className="flex flex-col items-center gap-1.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white border border-white/10 p-1 shadow-lg shadow-black/40 overflow-hidden">
                          {clubLogoUrl ? (
                            <img src={clubLogoUrl} className="h-full w-full object-contain" alt="Escudo" />
                          ) : (
                            <Building2 className="h-5 w-5 text-slate-405" />
                          )}
                        </div>
                        <span className="text-[8px] text-slate-500 font-bold uppercase">Sidebar</span>
                      </div>
                    </div>

                    <div className="flex-1 min-w-[150px] space-y-2">
                      <p className="text-[10px] text-slate-450 leading-relaxed font-semibold">
                        Sube una imagen cuadrada (.png o .jpg) para personalizar la cabecera del menú lateral y las fichas oficiales.
                      </p>
                      <div className="relative">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoFileSelected}
                          disabled={uploadingLogo}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 disabled:cursor-not-allowed"
                        />
                        <button
                          type="button"
                          className="w-full rounded-xl border border-dashed border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold px-4 py-2.5 transition-all text-center"
                        >
                          {uploadingLogo ? "Subiendo..." : "Seleccionar Archivo"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Colores corporativos */}
              <div className="space-y-4 border-t border-white/5 pt-4">
                <h4 className="text-xs font-bold text-slate-450 uppercase tracking-widest border-b border-white/5 pb-1">Colores del Club</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <ColorPickerGrid
                    label="Color Primario"
                    selectedColor={clubPrimaryColor}
                    onChange={setClubPrimaryColor}
                  />
                  <ColorPickerGrid
                    label="Color Secundario"
                    selectedColor={clubSecondaryColor}
                    onChange={setClubSecondaryColor}
                  />
                  <ColorPickerGrid
                    label="Pizarra: Color Local"
                    selectedColor={homeColor}
                    onChange={setHomeColor}
                  />
                  <ColorPickerGrid
                    label="Pizarra: Color Rival"
                    selectedColor={rivalColor}
                    onChange={setRivalColor}
                  />
                </div>

                <div className="space-y-1.5 pt-2">
                  <label htmlFor="settings-jersey-style" className="text-xs font-semibold text-slate-405 block">
                    Estilo visual de camiseta
                  </label>
                  <select
                    id="settings-jersey-style"
                    value={clubJerseyStyle}
                    onChange={(e) => setClubJerseyStyle(e.target.value)}
                    className="w-full rounded-xl bg-slate-950 border border-white/10 px-4 py-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="solid" className="bg-slate-950">Liso / Sólido</option>
                    <option value="striped_vertical" className="bg-slate-950">Rayas Verticales</option>
                    <option value="striped_horizontal" className="bg-slate-950">Rayas Horizontales</option>
                    <option value="halves" className="bg-slate-950">Mitad y Mitad</option>
                    <option value="cross" className="bg-slate-950">Con Cruz de Santiago/San Andrés</option>
                  </select>
                </div>
              </div>

              {orgError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{orgError}</span>
                </div>
              )}

              {orgSuccess && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{orgSuccess}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={orgLoading}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-xs transition-all disabled:opacity-60 shadow-lg shadow-emerald-950/45 cursor-pointer"
                >
                  {orgLoading ? "Guardando..." : "Guardar ajustes de marca"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 3: Planificación y Equipo */}
        {isOrgAdmin && activeTab === 'team' && organizationId && (
          <div className="glass rounded-2xl p-6 border border-white/[0.06] space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Planificación y Equipo</h3>
                <p className="text-xs text-slate-400">Parámetros globales de horarios y convocatorias</p>
              </div>
            </div>

            <form onSubmit={handleUpdateOrgSettings} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="settings-training-time" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Horario Predeterminado de Entrenamiento
                  </label>
                  <input
                    id="settings-training-time"
                    type="time"
                    required
                    value={defaultTrainingTime}
                    onChange={(e) => setDefaultTrainingTime(e.target.value)}
                    className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
              </div>

              {/* Timings */}
              <div className="space-y-4 border-t border-white/5 pt-4">
                <h4 className="text-xs font-bold text-slate-450 uppercase tracking-widest border-b border-white/5 pb-1">Parámetros de Convocatorias</h4>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="settings-checkin-hours" className="text-xs font-semibold text-slate-400">
                      Envío Check-in
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="settings-checkin-hours"
                        type="number"
                        min="1"
                        max="48"
                        required
                        value={checkinHours}
                        onChange={(e) => setCheckinHours(Number(e.target.value))}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-slate-500 font-semibold">horas</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="settings-checkin-close" className="text-xs font-semibold text-slate-400">
                      Cierre Check-in
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="settings-checkin-close"
                        type="number"
                        min="1"
                        max="180"
                        required
                        value={checkinClose}
                        onChange={(e) => setCheckinClose(Number(e.target.value))}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-slate-500 font-semibold">min</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="settings-checkout-delay" className="text-xs font-semibold text-slate-400">
                      Envío Check-out
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="settings-checkout-delay"
                        type="number"
                        min="1"
                        max="120"
                        required
                        value={checkoutDelay}
                        onChange={(e) => setCheckoutDelay(Number(e.target.value))}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-slate-500 font-semibold">min</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="settings-checkout-close" className="text-xs font-semibold text-slate-400">
                      Cierre Check-out
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="settings-checkout-close"
                        type="number"
                        min="1"
                        max="48"
                        required
                        value={checkoutClose}
                        onChange={(e) => setCheckoutClose(Number(e.target.value))}
                        className="w-full rounded-xl bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <span className="text-[10px] text-slate-500 font-semibold">h</span>
                    </div>
                  </div>
                </div>
              </div>

              {orgError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{orgError}</span>
                </div>
              )}

              {orgSuccess && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{orgSuccess}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={orgLoading}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-xs transition-all disabled:opacity-60 shadow-lg shadow-emerald-950/45 cursor-pointer"
                >
                  {orgLoading ? "Guardando..." : "Guardar planificación"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Tab 4: Academia y Metodología */}
        {isOrgAdmin && activeTab === 'methodology' && organizationId && (
          <div className="glass rounded-2xl p-6 border border-white/[0.06] space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500">
                  <Building2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Dirección Metodológica</h3>
                  <p className="text-xs text-slate-400">Ajustes del modelo de juego, conceptos tácticos e instalaciones</p>
                </div>
              </div>
              <div>
                <Link
                  href="/settings/facilities"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs font-semibold px-4 py-2.5 transition-all shadow-md"
                >
                  <Building2 className="h-4 w-4 text-emerald-500" />
                  Gestionar Instalaciones / Campos
                </Link>
              </div>
            </div>

            <form onSubmit={handleUpdateOrgSettings} className="space-y-6">
              {/* Alertas Metodológicas */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-450 uppercase tracking-widest border-b border-white/5 pb-1">Alertas Metodológicas</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="inactive-days-threshold" className="text-xs font-semibold text-slate-400">
                      Inactividad del Concepto (Días sin entrenar)
                    </label>
                    <input
                      id="inactive-days-threshold"
                      type="number"
                      min="7"
                      max="60"
                      value={inactiveDaysThreshold}
                      onChange={(e) => setInactiveDaysThreshold(Number(e.target.value))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500">Días que pueden pasar sin entrenar un concepto antes de lanzar alerta.</p>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="overuse-weekly-threshold" className="text-xs font-semibold text-slate-400">
                      Límite de Uso Semanal (Veces entrenado)
                    </label>
                    <input
                      id="overuse-weekly-threshold"
                      type="number"
                      min="1"
                      max="10"
                      value={overuseWeeklyThreshold}
                      onChange={(e) => setOveruseWeeklyThreshold(Number(e.target.value))}
                      className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500">Máximo número de veces que se puede entrenar un concepto por semana.</p>
                  </div>
                </div>
              </div>

              {/* Taxonomía de Metodología */}
              <div className="space-y-4 border-t border-white/5 pt-4">
                <h4 className="text-xs font-bold text-slate-450 uppercase tracking-widest border-b border-white/5 pb-1">
                  Taxonomía Metodológica de la Academia
                </h4>
                <p className="text-[10px] text-slate-500 leading-normal">
                  Personaliza los conceptos tácticos y grupos musculares que se monitorizan y entrenan en las sesiones de la academia.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Conceptos Tácticos */}
                  <div className="space-y-4 bg-white/2 p-4 border border-white/5 rounded-xl">
                    <span className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Conceptos Tácticos ({customConcepts.length})
                    </span>

                    {/* List of Concepts */}
                    <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                      {customConcepts.map((c) => (
                        <div
                          key={c.key}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-white/5 text-xs text-slate-350 hover:text-white"
                        >
                          <div>
                            <span className="font-bold text-white block">{c.label}</span>
                            <span className="text-[9px] text-slate-500 uppercase font-semibold">{c.category}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeConcept(c.key)}
                            className="text-slate-550 hover:text-rose-400 font-bold p-1 cursor-pointer transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Concept Form */}
                    <div className="space-y-2 border-t border-white/5 pt-3">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Añadir Concepto</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Ej: Salida de Tres"
                          value={newConceptLabel}
                          onChange={(e) => setNewConceptLabel(e.target.value)}
                          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none"
                        />
                        <select
                          value={newConceptCategory}
                          onChange={(e) => setNewConceptCategory(e.target.value)}
                          className="rounded-lg bg-slate-950 border border-white/10 px-2 py-1.5 text-xs text-white cursor-pointer focus:outline-none"
                        >
                          <option value="Fase Ofensiva" className="bg-slate-950">Ofensivo</option>
                          <option value="Fase Defensiva" className="bg-slate-950">Defensivo</option>
                          <option value="Transición A-D" className="bg-slate-950">Trans. A-D</option>
                          <option value="Transición D-A" className="bg-slate-950">Trans. D-A</option>
                          <option value="ABP" className="bg-slate-950">ABP</option>
                        </select>
                        <button
                          type="button"
                          onClick={addConcept}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 rounded-lg cursor-pointer transition-colors animate-pulse"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Grupos Musculares */}
                  <div className="space-y-4 bg-white/2 p-4 border border-white/5 rounded-xl">
                    <span className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                      Grupos Musculares ({customMuscles.length})
                    </span>

                    {/* List of Muscles */}
                    <div className="space-y-1 max-h-[220px] overflow-y-auto pr-1">
                      {customMuscles.map((m) => (
                        <div
                          key={m.key}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-900 border border-white/5 text-xs text-slate-355 hover:text-white"
                        >
                          <div>
                            <span className="font-bold text-white block">{m.label}</span>
                            <span className="text-[9px] text-slate-500 uppercase font-semibold">{m.zone}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeMuscle(m.key)}
                            className="text-slate-555 hover:text-rose-400 font-bold p-1 cursor-pointer transition-colors"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add Muscle Form */}
                    <div className="space-y-2 border-t border-white/5 pt-3">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Añadir Grupo Muscular</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Ej: Sóleo"
                          value={newMuscleLabel}
                          onChange={(e) => setNewMuscleLabel(e.target.value)}
                          className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none"
                        />
                        <select
                          value={newMuscleZone}
                          onChange={(e) => setNewMuscleZone(e.target.value)}
                          className="rounded-lg bg-slate-950 border border-white/10 px-2 py-1.5 text-xs text-white cursor-pointer focus:outline-none"
                        >
                          <option value="Cadena Posterior" className="bg-slate-950">Cad. Posterior</option>
                          <option value="Cadena Anterior" className="bg-slate-950">Cad. Anterior</option>
                          <option value="Cadera-Ingle" className="bg-slate-950">Cadera-Ingle</option>
                          <option value="General" className="bg-slate-950">General</option>
                        </select>
                        <button
                          type="button"
                          onClick={addMuscle}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-3 rounded-lg cursor-pointer transition-colors"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {orgError && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs text-red-400 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{orgError}</span>
                </div>
              )}

              {orgSuccess && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-xs text-emerald-400 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>{orgSuccess}</span>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={orgLoading}
                  className="px-6 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white font-semibold text-xs transition-all disabled:opacity-60 shadow-lg shadow-emerald-950/45 cursor-pointer"
                >
                  {orgLoading ? "Guardando..." : "Guardar ajustes metodológicos"}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'video_pack' && (
          <div className="glass rounded-3xl border border-white/10 p-6 shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-white/5 pb-4">
              <div className="h-10 w-10 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 text-xl shrink-0">
                🎬
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">Paquetes de Videoanálisis Local</h3>
                <p className="text-xs text-slate-500 mt-0.5">Herramientas auxiliares de captura, reproducción y edición local offline.</p>
              </div>
            </div>

            <div className="text-xs text-slate-400 leading-relaxed bg-slate-950/40 p-4 border border-white/5 rounded-2xl">
              Si el cuerpo técnico o los analistas necesitan realizar el etiquetado y cortes de vídeo directamente en sus ordenadores o iPads sin conexión a internet, deben descargar los siguientes paquetes de software local. Los clips se guardarán temporalmente en el almacenamiento del dispositivo y se sincronizarán con la nube al recuperar la conexión.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Windows card */}
              <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col justify-between space-y-4 hover:border-white/10 transition-all bg-white/2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Sistema Operativo</span>
                    <span className="bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">Windows 10/11</span>
                  </div>
                  <h4 className="text-xs font-extrabold text-white">ClubLab Video Editor para Windows</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Instalador nativo para Windows de 64 bits. Incluye motor de renderizado acelerado por hardware y códecs integrados de decodificación H.264/HEVC.
                  </p>
                </div>
                <div className="pt-2">
                  <a
                    href="#download-win"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Iniciando la descarga del paquete ClubLab_Video_Analysis_x64.msi (124 MB)...");
                    }}
                    className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs uppercase px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-center"
                  >
                    Descargar para Windows (.msi)
                  </a>
                  <span className="text-[9px] text-slate-500 text-center block mt-1.5 font-medium">Requisitos: DirectX 12 • 4GB RAM</span>
                </div>
              </div>

              {/* iOS card */}
              <div className="glass p-5 rounded-2xl border border-white/5 flex flex-col justify-between space-y-4 hover:border-white/10 transition-all bg-white/2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Dispositivo Móvil</span>
                    <span className="bg-rose-500/20 text-rose-455 border border-rose-500/30 text-[8px] font-black uppercase px-2 py-0.5 rounded-full">iOS / iPadOS</span>
                  </div>
                  <h4 className="text-xs font-extrabold text-white">ClubLab Video Companion para iOS</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    Aplicación de videoanálisis táctico optimizada para iPads. Diseñada para trabajar a pie de campo grabando cortes y anotando jugadas directamente sobre la pantalla táctil.
                  </p>
                </div>
                <div className="pt-2">
                  <a
                    href="#download-ios"
                    onClick={(e) => {
                      e.preventDefault();
                      alert("Iniciando la descarga del paquete ClubLab_Video_Companion.ipa (48 MB) para su instalación corporativa via MDM o TestFlight...");
                    }}
                    className="w-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs uppercase px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors cursor-pointer text-center"
                  >
                    Descargar para iOS (.ipa)
                  </a>
                  <span className="text-[9px] text-slate-500 text-center block mt-1.5 font-medium">Requisitos: iOS 15.0+ • Optimizado para iPad</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      {selectedFileForAdjustment && (
        <ImageAdjusterModal
          file={selectedFileForAdjustment}
          onClose={() => setSelectedFileForAdjustment(null)}
          onConfirm={async (blob) => {
            await handleUploadProcessedLogo(blob);
            setSelectedFileForAdjustment(null);
          }}
        />
      )}
    </div>
  );
}
