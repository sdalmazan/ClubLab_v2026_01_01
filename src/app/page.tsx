import { redirect } from "next/navigation";

/**
 * Root page — redirects to dashboard.
 * The middleware handles auth checks before this runs.
 */
export default function RootPage() {
  redirect("/dashboard");
}
