import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Iniciar sesión — ClubLab",
  description: "Accede a tu plataforma de gestión deportiva",
};

export default function LoginPage() {
  return <LoginForm />;
}
