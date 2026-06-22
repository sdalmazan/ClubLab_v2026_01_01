import type { Metadata } from "next";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Restablecer contraseña — ClubLab",
  description: "Establece tu nueva contraseña de ClubLab",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
