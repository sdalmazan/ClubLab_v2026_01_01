"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface CustomSelectProps {
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  isMultiSelect?: boolean;
}

export function CustomSelect({ 
  value, 
  onChange, 
  options, 
  placeholder, 
  className, 
  isMultiSelect 
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedValues = isMultiSelect ? (value ? value.split(",") : []) : [value];

  const handleToggle = (val: string) => {
    if (isMultiSelect) {
      let newValues;
      if (selectedValues.includes(val)) {
        newValues = selectedValues.filter(v => v !== val);
      } else {
        newValues = [...selectedValues, val];
      }
      onChange(newValues.join(","));
    } else {
      onChange(val);
      setIsOpen(false);
    }
  };

  const getDisplayLabel = () => {
    if (isMultiSelect) {
      if (selectedValues.length === 0) return placeholder || "Seleccionar...";
      if (selectedValues.length === options.length) return "Todos";
      if (selectedValues.length > 2) return `${selectedValues.length} seleccionados`;
      return options
        .filter(o => selectedValues.includes(o.value))
        .map(o => o.label)
        .join(", ");
    }
    const selectedOpt = options.find(o => o.value === value);
    return selectedOpt?.label || placeholder || "Seleccionar...";
  };

  return (
    <div className={`relative min-w-[150px] ${className || ""}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-900/80 border border-white/10 hover:border-white/20 text-white rounded-xl px-3 py-2 text-xs focus:outline-none flex items-center justify-between backdrop-blur-sm cursor-pointer transition-all shadow-md select-none"
      >
        <span className="truncate">{getDisplayLabel()}</span>
        <ChevronDown className={`h-3 w-3 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-full bg-slate-950/95 border border-white/10 rounded-xl py-1 z-20 shadow-2xl backdrop-blur-md max-h-48 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-155">
            {options.map((opt) => {
              const isChecked = selectedValues.includes(opt.value);
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => handleToggle(opt.value)}
                  className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-emerald-500/10 hover:text-emerald-455 cursor-pointer flex items-center justify-between ${
                    isChecked ? "text-emerald-450 font-bold bg-emerald-500/5" : "text-slate-355"
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isMultiSelect && (
                    <span className={`w-3.5 h-3.5 rounded border border-white/20 flex items-center justify-center text-[8px] ${isChecked ? "bg-emerald-500 border-emerald-500 text-white" : ""}`}>
                      {isChecked && "✓"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
