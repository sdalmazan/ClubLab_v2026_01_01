"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function PerformancePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/performance/dashboard");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center gap-2.5 bg-slate-950 text-slate-400">
      <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      <span className="text-sm font-semibold tracking-wide">Redirigiendo a Performance Command Center...</span>
    </div>
  );
}

export const dynamic = "force-dynamic";
