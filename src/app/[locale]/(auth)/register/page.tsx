import type { Metadata } from "next";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Crear cuenta — ClubLab",
  description: "Crea tu cuenta en ClubLab y empieza a gestionar tu club",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
