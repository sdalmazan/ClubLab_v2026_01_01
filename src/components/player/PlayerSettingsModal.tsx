"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { X, Check, User, Lock, Bell, MessageSquare, ShieldCheck, Send, KeyRound, LogOut } from "lucide-react";

interface PlayerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PlayerSettingsModal({ isOpen, onClose }: PlayerSettingsModalProps) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "notifications">("profile");

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch (e) {
      console.error("Error signing out:", e);
    } finally {
      onClose();
      router.push("/login");
      router.refresh();
    }
  };

  // Profile Form
  const [sportingName, setSportingName] = useState("Diego A.");
  const [height, setHeight] = useState("182");
  const [weight, setWeight] = useState("76");

  // Security Form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Notification Toggles
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [whatsappAlerts, setWhatsappAlerts] = useState(false);

  // Phone Verification
  const [phone, setPhone] = useState("+34600000000");
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [showOtpInput, setShowOtpInput] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [otpStatus, setOtpStatus] = useState<string | null>(null);
  const [otpError, setOtpError] = useState<string | null>(null);

  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSendOtp = async () => {
    setOtpError(null);
    setOtpStatus(null);
    setSendingOtp(true);

    try {
      const res = await fetch("/api/player/phone/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setOtpError(data.error || "Error al enviar el código de verificación.");
      } else {
        setOtpStatus(data.message || "Código enviado por WhatsApp.");
        setShowOtpInput(true);
      }
    } catch (e: any) {
      setOtpError("Error de conexión al enviar el código.");
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    setOtpError(null);
    setOtpStatus(null);
    setVerifyingOtp(true);

    try {
      const res = await fetch("/api/player/phone/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpCode }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setOtpError(data.error || "Código incorrecto.");
      } else {
        setPhoneVerified(true);
        setWhatsappAlerts(true);
        setShowOtpInput(false);
        setOtpStatus("¡Número de WhatsApp verificado con éxito!");
      }
    } catch (e: any) {
      setOtpError("Error al verificar el código.");
    } finally {
      setVerifyingOtp(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-card w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in slide-in-from-bottom duration-300">
        {/* Header */}
        <div className="p-4 border-b border-border/50 flex items-center justify-between bg-blue-500/5">
          <h2 className="text-base font-bold text-foreground">Ajustes del Jugador</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center border-b border-border/50 bg-accent/20 px-3 pt-2">
          {[
            { key: "profile", label: "Perfil", icon: User },
            { key: "security", label: "Contraseña", icon: Lock },
            { key: "notifications", label: "Notificaciones", icon: Bell },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key as any)}
                className={`flex-1 py-3 text-xs font-bold flex items-center justify-center gap-1.5 border-b-2 transition-all ${
                  active
                    ? "border-blue-600 text-blue-500 bg-card/60"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-4 space-y-4">
          {activeTab === "profile" && (
            <div className="space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Nombre Deportivo / Apodo
                  </label>
                  <input
                    type="text"
                    value={sportingName}
                    onChange={(e) => setSportingName(e.target.value)}
                    placeholder="Ej. Diego C."
                    className="w-full p-3 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Fecha de Nacimiento
                  </label>
                  <input
                    type="date"
                    value="2001-05-14"
                    onChange={() => {}}
                    className="w-full p-3 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Pie Dominante
                  </label>
                  <select
                    defaultValue="Diestro"
                    className="w-full p-3 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Diestro">Diestro</option>
                    <option value="Zurdo">Zurdo</option>
                    <option value="Ambidiestro">Ambidiestro</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Posición Principal
                  </label>
                  <select
                    defaultValue="Mediocentro"
                    className="w-full p-3 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="Portero">Portero</option>
                    <option value="Central">Defensa Central</option>
                    <option value="Lateral Derecho">Lateral Derecho</option>
                    <option value="Lateral Izquierdo">Lateral Izquierdo</option>
                    <option value="Mediocentro">Mediocentro / Pivote</option>
                    <option value="Mediapunta">Mediapunta / Interior</option>
                    <option value="Extremo Derecho">Extremo Derecho</option>
                    <option value="Extremo Izquierdo">Extremo Izquierdo</option>
                    <option value="Delantero Centro">Delantero Centro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Altura (cm)
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="w-full p-2.5 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Peso (kg)
                  </label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full p-2.5 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Dorsal Preferido
                  </label>
                  <input
                    type="number"
                    defaultValue="8"
                    className="w-full p-2.5 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Injury & Medical History Button inside Profile */}
              <div className="p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-between mt-2">
                <div>
                  <span className="text-xs font-bold text-foreground block">🩺 Histórico Lesional y Salud</span>
                  <span className="text-[10.5px] text-muted-foreground block">Añade o consulta tus antecedentes médicos</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    // Small delay to allow modal transition
                    setTimeout(() => {
                      const btn = document.querySelector('[data-open-injury-modal]') as HTMLButtonElement;
                      if (btn) btn.click();
                    }, 200);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all cursor-pointer shrink-0"
                >
                  Gestionar
                </button>
              </div>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Contraseña Actual
                </label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Nueva Contraseña
                </label>
                <input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-3">
              {/* Active Channel Display Banner */}
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider block">Canal Activo de Notificaciones del Club</span>
                  <strong className="text-sm font-extrabold text-white flex items-center gap-1.5 mt-0.5">
                    {whatsappAlerts ? "💬 WhatsApp — Canal Activo" : "📧 Correo Electrónico — Canal Activo"}
                  </strong>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30">
                  ✓ Verificado
                </span>
              </div>

              {/* Selector for Channel Change */}
              <div className="p-3.5 rounded-2xl bg-accent/20 border border-border/40 space-y-3">
                <label className="text-xs font-bold text-foreground block">
                  Cambiar Canal Operativo (Requiere Verificación OTP)
                </label>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!whatsappAlerts) {
                        setShowOtpInput(true);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left text-xs font-bold flex flex-col justify-between transition-all ${
                      whatsappAlerts
                        ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                        : "border-border/50 bg-accent/30 text-muted-foreground hover:border-emerald-500/50"
                    }`}
                  >
                    <span>💬 WhatsApp</span>
                    <span className="text-[10px] font-normal text-muted-foreground mt-1">Convocatorias urgentes</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (whatsappAlerts) {
                        setShowOtpInput(true);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left text-xs font-bold flex flex-col justify-between transition-all ${
                      !whatsappAlerts
                        ? "border-blue-500 bg-blue-500/20 text-blue-300"
                        : "border-border/50 bg-accent/30 text-muted-foreground hover:border-blue-500/50"
                    }`}
                  >
                    <span>📧 Correo</span>
                    <span className="text-[10px] font-normal text-muted-foreground mt-1">Bandeja tradicional</span>
                  </button>
                </div>

                {/* Phone verification input */}
                <div className="pt-2">
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Teléfono para WhatsApp
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+34 685 228 4495"
                      className="flex-1 p-2.5 rounded-xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-emerald-500"
                    />
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={sendingOtp}
                      className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{sendingOtp ? "Enviando..." : "Enviar OTP"}</span>
                    </button>
                  </div>
                </div>

                {/* OTP Verification Form */}
                {showOtpInput && (
                  <div className="mt-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2.5 animate-fade-in">
                    <p className="text-[11px] font-semibold text-emerald-300">
                      Introduce el código de 6 dígitos enviado para confirmar el cambio:
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        placeholder="123456"
                        className="w-32 text-center tracking-widest font-mono text-sm p-2 rounded-lg bg-black/40 border border-emerald-500/50 text-white focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleVerifyOtp}
                        disabled={verifyingOtp || otpCode.length !== 6}
                        className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>{verifyingOtp ? "Verificando..." : "Validar y Cambiar Canal"}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Status / Error messages */}
                {otpStatus && (
                  <p className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">{otpStatus}</p>
                )}
                {otpError && (
                  <p className="text-[11px] font-semibold text-red-400 bg-red-500/10 p-2 rounded-lg border border-red-500/20">{otpError}</p>
                )}
              </div>
            </div>
          )}

          {savedSuccess && (
            <div className="p-3 bg-emerald-500/10 text-emerald-500 font-bold text-xs rounded-xl flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>Ajustes guardados correctamente</span>
            </div>
          )}

          <button
            type="submit"
            className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-sm rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all"
          >
            <Check className="w-5 h-5" />
            <span>Guardar Ajustes</span>
          </button>

          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full py-3.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 font-extrabold text-xs uppercase tracking-wider rounded-2xl border border-rose-500/30 flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer disabled:opacity-50 mt-3"
          >
            <LogOut className="w-4 h-4" />
            <span>{isLoggingOut ? "Cerrando sesión..." : "Cerrar Sesión"}</span>
          </button>
        </form>
      </div>
    </div>
  );
}

