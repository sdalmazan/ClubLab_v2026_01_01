"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PhysicalTest } from "@/types";

interface NewTestFormProps {
  playerId: string;
  testTypes: PhysicalTest[];
}

export function NewTestForm({ playerId, testTypes }: NewTestFormProps) {
  const router = useRouter();

  const [testTypeId, setTestTypeId] = useState(testTypes[0]?.id ?? "");
  const [testDate, setTestDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [resultValue, setResultValue] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedType = testTypes.find((t) => t.id === testTypeId);
  const unit = selectedType?.unit ?? "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!testTypeId) {
      setError("Por favor, selecciona un tipo de test.");
      return;
    }
    if (!resultValue || isNaN(Number(resultValue))) {
      setError("Introduce un resultado numérico válido.");
      return;
    }
    if (!testDate) {
      setError("Introduce la fecha del test.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/players/${playerId}/tests`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          testTypeId,
          date: testDate,
          value: Number(resultValue),
          notes: notes.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "Error al registrar el test físico");
      }

      router.push(`/players/${playerId}`);
      router.refresh();
    } catch (err: any) {
      setError(err?.message ?? "Error al registrar el test.");
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 text-sm text-white placeholder-slate-600 corp-input-focus transition-all";
  
  const labelClass =
    "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5";

  if (testTypes.length === 0) {
    return (
      <div className="glass rounded-2xl p-6 text-center text-slate-400 text-sm">
        No hay tipos de tests configurados en la organización. Crea o activa un tipo de test antes de continuar.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 space-y-6">
      {error && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Tipo de Test */}
      <div>
        <label htmlFor="test-type" className={labelClass}>Tipo de test</label>
        <select
          id="test-type"
          value={testTypeId}
          onChange={(e) => setTestTypeId(e.target.value)}
          className={inputClass}
          required
        >
          {testTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name} ({type.category || "General"})
            </option>
          ))}
        </select>
        {selectedType?.description && (
          <p className="text-[11px] text-slate-400 mt-1.5 italic leading-relaxed">
            Descripción: {selectedType.description}
          </p>
        )}
      </div>

      {/* Grid: Fecha y Valor */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="test-date" className={labelClass}>Fecha del test</label>
          <input
            id="test-date"
            type="date"
            value={testDate}
            onChange={(e) => setTestDate(e.target.value)}
            className={inputClass}
            required
          />
        </div>
        <div>
          <label htmlFor="test-value" className={labelClass}>Resultado</label>
          <div className="relative flex items-center">
            <input
              id="test-value"
              type="number"
              step="any"
              value={resultValue}
              onChange={(e) => setResultValue(e.target.value)}
              placeholder="Ej: 45.8"
              className={inputClass}
              required
            />
            {unit && (
              <span className="absolute right-4 text-xs font-bold text-slate-400 bg-white/10 px-2 py-0.5 rounded border border-white/5">
                {unit}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Observaciones */}
      <div>
        <label htmlFor="test-notes" className={labelClass}>Observaciones / Notas</label>
        <textarea
          id="test-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Añade detalles sobre las condiciones de la prueba, estado físico del jugador, etc."
          rows={3}
          className={inputClass}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex-1 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/20 font-semibold text-sm py-2.5 transition-all"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl btn-corporate font-semibold text-sm py-2.5 transition-all shadow-lg disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {saving ? "Guardando..." : "Guardar Test"}
        </button>
      </div>
    </form>
  );
}
