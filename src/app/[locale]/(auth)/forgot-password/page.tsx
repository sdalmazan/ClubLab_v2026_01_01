import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Recuperar contraseña — ClubLab",
  description: "Recupera el acceso a tu cuenta de ClubLab",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
