"use client";

import { useState } from "react";
import { Plus, Minus, PlusCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EquipmentItem {
  name: string;
  quantity: number;
}

interface EquipmentSelectorProps {
  value: EquipmentItem[];
  onChange: (value: EquipmentItem[]) => void;
  interactive?: boolean;
}

const STANDARD_ITEMS = [
  { name: "Balones", defaultQty: 10 },
  { name: "Chinos", defaultQty: 20 },
  { name: "Petos", defaultQty: 10 },
  { name: "Porterías", defaultQty: 2 },
  { name: "Cinta", defaultQty: 1 },
  { name: "Vallas", defaultQty: 6 },
  { name: "Escaleras", defaultQty: 2 },
];

export function EquipmentSelector({
  value = [],
  onChange,
  interactive = true,
}: EquipmentSelectorProps) {
  const [customName, setCustomName] = useState("");

  const updateQuantity = (name: string, quantity: number) => {
    if (!interactive) return;
    const newQty = Math.max(1, quantity);
    const exists = value.some((item) => item.name.toLowerCase() === name.toLowerCase());

    if (exists) {
      onChange(
        value.map((item) =>
          item.name.toLowerCase() === name.toLowerCase()
            ? { ...item, quantity: newQty }
            : item
        )
      );
    } else {
      onChange([...value, { name, quantity: newQty }]);
    }
  };

  const toggleItem = (name: string, defaultQty: number) => {
    if (!interactive) return;
    const exists = value.some((item) => item.name.toLowerCase() === name.toLowerCase());

    if (exists) {
      onChange(value.filter((item) => item.name.toLowerCase() !== name.toLowerCase()));
    } else {
      onChange([...value, { name, quantity: defaultQty }]);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!interactive || !customName.trim()) return;
    const name = customName.trim();
    const exists = value.some((item) => item.name.toLowerCase() === name.toLowerCase());

    if (!exists) {
      onChange([...value, { name, quantity: 1 }]);
    }
    setCustomName("");
  };

  const handleRemoveItem = (name: string) => {
    if (!interactive) return;
    onChange(value.filter((item) => item.name.toLowerCase() !== name.toLowerCase()));
  };

  return (
    <div className="space-y-4">
      {/* Standard Equipment Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {STANDARD_ITEMS.map((std) => {
          const activeItem = value.find(
            (item) => item.name.toLowerCase() === std.name.toLowerCase()
          );
          const isSelected = !!activeItem;

          return (
            <div
              key={std.name}
              className={cn(
                "flex items-center justify-between p-3 rounded-xl border transition-all glass-card",
                isSelected
                  ? "border-emerald-500/40 bg-emerald-500/5"
                  : "border-white/5 bg-white/2"
              )}
            >
              <button
                type="button"
                disabled={!interactive}
                onClick={() => toggleItem(std.name, std.defaultQty)}
                className={cn(
                  "flex-1 text-left text-sm font-semibold transition-colors",
                  isSelected ? "text-emerald-300" : "text-slate-400 hover:text-white",
                  !interactive && "cursor-default"
                )}
              >
                {std.name}
              </button>

              {isSelected && interactive && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateQuantity(std.name, activeItem.quantity - 1)}
                    className="h-7 w-7 rounded-lg border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <input
                    type="number"
                    min="1"
                    readOnly
                    value={activeItem.quantity}
                    className="w-11 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-center text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => updateQuantity(std.name, activeItem.quantity + 1)}
                    className="h-7 w-7 rounded-lg border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveItem(std.name)}
                    className="text-rose-455 hover:text-rose-350 p-1 hover:bg-rose-500/10 rounded transition-all ml-1 cursor-pointer"
                    title="Quitar"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}

              {isSelected && !interactive && (
                <span className="text-xs font-extrabold text-slate-400">
                  Cant: {activeItem.quantity}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom & Added Equipment List */}
      {value.filter(
        (item) =>
          !STANDARD_ITEMS.some((std) => std.name.toLowerCase() === item.name.toLowerCase())
      ).length > 0 && (
        <div className="space-y-1.5 pt-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
            Material personalizado añadido:
          </p>
          <div className="space-y-2">
            {value
              .filter(
                (item) =>
                  !STANDARD_ITEMS.some((std) => std.name.toLowerCase() === item.name.toLowerCase())
              )
              .map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/40 bg-emerald-500/5 glass-card"
                >
                  <span className="text-sm font-semibold text-emerald-300">{item.name}</span>
                  {interactive ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.name, item.quantity - 1)}
                          className="h-7 w-7 rounded-lg border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min="1"
                          readOnly
                          value={item.quantity}
                          className="w-11 bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-center text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.name, item.quantity + 1)}
                          className="h-7 w-7 rounded-lg border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(item.name)}
                        className="text-rose-455 hover:text-rose-350 p-1 hover:bg-rose-500/10 rounded transition-all cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-extrabold text-slate-400">
                      Cant: {item.quantity}
                    </span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Custom Add Input */}
      {interactive && (
        <div className="flex gap-2 pt-2">
          <input
            type="text"
            placeholder="Añadir otro material (ej: Picas, Gomas)..."
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustom(e);
              }
            }}
            className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2 text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
          />
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleAddCustom(e);
            }}
            className="flex items-center gap-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold px-4 py-2 border border-white/10 transition-all cursor-pointer"
          >
            <PlusCircle className="h-4.5 w-4.5 text-slate-400" />
            Añadir
          </button>
        </div>
      )}
    </div>
  );
}
