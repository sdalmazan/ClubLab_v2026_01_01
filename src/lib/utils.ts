import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatToDDMMAAAA(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return "";
  const str = typeof dateStr === "string" 
    ? dateStr.split("T")[0] 
    : new Date(dateStr).toISOString().split("T")[0];
  const parts = str.split("-");
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return str;
}
