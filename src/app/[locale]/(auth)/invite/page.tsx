import type { Metadata } from "next";
import { InviteForm } from "./InviteForm";

export const metadata: Metadata = {
  title: "Invitación Oficial — ClubLab",
  description: "Completa tu registro para unirte a tu club en ClubLab",
};

export default function InvitePage() {
  return <InviteForm />;
}
