import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionById } from "@/services/sessions";
import { PlayerSessionView } from "@/components/training/PlayerSessionView";

export const dynamic = "force-dynamic";

export default async function SessionDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { id } = await params;
  const { preview } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Load user's organization role and settings
  const { data: orgRole } = await supabase
    .from("user_organization_roles")
    .select(`
      organization_id, 
      role, 
      team_id,
      organizations (
        settings
      )
    `)
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!orgRole) {
    redirect("/onboarding");
  }

  // Load the session data
  const session = await getSessionById(id);
  if (!session) {
    notFound();
  }

  const isPlayer = orgRole.role === "player";
  const wantPreview = Boolean(preview);

  // Server-side filtering of exercises & comments
  const filteredExercises = (session.exercises || [])
    .filter((ex: any) => {
      const gs = ex.group_setup || {};
      const vis = gs.visibility || { visible_to_players: true };
      return vis.visible_to_players !== false;
    })
    .map((ex: any) => {
      const gs = ex.group_setup || {};
      const vis = gs.visibility || { show_comments_to_players: true };
      const showComments = vis.show_comments_to_players !== false;

      // Clean rules & notes if coach marked them invisible
      return {
        ...ex,
        group_setup: {
          ...gs,
          rules: showComments ? (gs.rules || "") : "",
          objective_notes: showComments ? (gs.objective_notes || "") : "",
        }
      };
    });

  const sanitizedSession = {
    ...session,
    exercises: filteredExercises
  };

  const orgSettings = (orgRole as any)?.organizations?.settings ?? {};

  return (
    <PlayerSessionView
      session={sanitizedSession}
      isPreview={wantPreview}
      orgSettings={orgSettings}
    />
  );
}
