"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

interface DeleteTemplateButtonProps {
  templateId: string;
}

export function DeleteTemplateButton({ templateId }: DeleteTemplateButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm("¿Seguro que deseas eliminar esta plantilla de sesión?")) {
      return;
    }

    setDeleting(true);

    try {
      const res = await fetch(`/api/training/templates/${templateId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("No se pudo eliminar la plantilla");
      }

      router.refresh();
    } catch (err: any) {
      alert(err.message ?? "Error al eliminar");
      setDeleting(false);
    }
  };

  return (
    <button
      type="button"
      disabled={deleting}
      onClick={handleDelete}
      className="flex items-center gap-1 text-slate-500 hover:text-rose-400 text-xs font-semibold p-1 hover:bg-white/5 rounded transition-all cursor-pointer disabled:opacity-50"
      title="Eliminar plantilla"
    >
      <Trash2 className="h-3.5 w-3.5" />
      <span>{deleting ? "Eliminando..." : "Eliminar"}</span>
    </button>
  );
}
