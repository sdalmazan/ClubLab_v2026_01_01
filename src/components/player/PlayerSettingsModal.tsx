"use client";

import React, { useState } from "react";
import { X, Check, User, Lock, Bell, MessageSquare, ShieldCheck, Send, KeyRound } from "lucide-react";

interface PlayerSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PlayerSettingsModal({ isOpen, onClose }: PlayerSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"profile" | "security" | "notifications">("profile");

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
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">
                  Nombre Deportivo
                </label>
                <input
                  type="text"
                  value={sportingName}
                  onChange={(e) => setSportingName(e.target.value)}
                  className="w-full p-3.5 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Altura (cm)
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Peso (kg)
                  </label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full p-3.5 rounded-2xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-blue-500"
                  />
                </div>
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
              {/* Email Alerts Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-accent/30 border border-border/40">
                <div>
                  <p className="text-xs font-bold text-foreground">Alertas por Email</p>
                  <p className="text-[11px] text-muted-foreground">Apertura y aviso de alertas de la app.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setEmailAlerts(!emailAlerts)}
                  className={`w-11 h-6 rounded-full p-1 transition-colors ${
                    emailAlerts ? "bg-blue-600" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      emailAlerts ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* WhatsApp Alerts Toggle */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-accent/30 border border-border/40">
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-foreground">Avisos por WhatsApp</p>
                    {phoneVerified && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        Verificado
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Notificaciones directas a tu teléfono.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!phoneVerified && !whatsappAlerts) {
                      setShowOtpInput(true);
                    } else {
                      setWhatsappAlerts(!whatsappAlerts);
                    }
                  }}
                  className={`w-11 h-6 rounded-full p-1 transition-colors ${
                    whatsappAlerts ? "bg-emerald-600" : "bg-muted"
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      whatsappAlerts ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Phone Verification Section */}
              <div className="p-3.5 rounded-2xl bg-accent/20 border border-border/40 space-y-3">
                <label className="text-xs font-bold text-foreground flex items-center justify-between">
                  <span>Número de Teléfono (WhatsApp)</span>
                  {phoneVerified ? (
                    <span className="text-emerald-400 flex items-center gap-1 text-[11px]">
                      <ShieldCheck className="w-3.5 h-3.5" /> Confirmado
                    </span>
                  ) : (
                    <span className="text-amber-400 text-[11px]">Pendiente de confirmar</span>
                  )}
                </label>

                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+34 600 000 000"
                    className="flex-1 p-2.5 rounded-xl bg-accent/30 border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={sendingOtp}
                    className="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{sendingOtp ? "Enviando..." : "Enviar Código"}</span>
                  </button>
                </div>

                {/* OTP Input Form */}
                {showOtpInput && (
                  <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2 animate-fade-in">
                    <p className="text-[11px] font-semibold text-emerald-300">
                      Introduce el código de 6 dígitos enviado por WhatsApp:
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
                        className="flex-1 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-black font-bold text-xs rounded-lg flex items-center justify-center gap-1 transition-all"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                        <span>{verifyingOtp ? "Verificando..." : "Confirmar Código"}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Status / Error messages */}
                {otpStatus && (
                  <p className="text-[11px] font-semibold text-emerald-400">{otpStatus}</p>
                )}
                {otpError && (
                  <p className="text-[11px] font-semibold text-red-400">{otpError}</p>
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
        </form>
      </div>
    </div>
  );
}

