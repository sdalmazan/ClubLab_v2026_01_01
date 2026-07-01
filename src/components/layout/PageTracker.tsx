"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;

    fetch("/api/admin/track", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        path: pathname,
        type: "page_view",
      }),
    }).catch((err) => {
      console.warn("Failed to report telemetry:", err);
    });
  }, [pathname]);

  return null;
}
