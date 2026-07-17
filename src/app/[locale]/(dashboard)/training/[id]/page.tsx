import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SessionDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/training/${id}/edit`);
}
