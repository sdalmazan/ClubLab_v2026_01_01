import { redirect } from "next/navigation";

export default function PerformanceSettingsPage() {
  redirect("/settings?tab=performance");
}
