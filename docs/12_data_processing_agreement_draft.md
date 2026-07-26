# 12. ClubLab Data Processing Agreement (DPA) — Draft

> ⚖️ **CONTRATO DE ENCARGADO DEL TRATAMIENTO (DPA - ARTÍCULO 28 RGPD)**
> Este documento constituye el borrador del acuerdo B2B de tratamiento de datos personales a suscribir entre **ClubLab** (Encargado) y los **Clubes / Entidades Deportivas** (Responsables). Debe ser validado formalmente por un abogado antes de su anexado a los Términos de Servicio B2B.

---

**ENTRE:**

1. **EL RESPONSABLE DEL TRATAMIENTO:** La entidad deportiva, club o academia (en adelante, el "**Cliente**" o el "**Responsable**"), cuyos datos identificativos constan en el formulario de contratación del servicio ClubLab.

2. **EL ENCARGADO DEL TRATAMIENTO:** **ClubLab, S.L.** [Nombre legal provisional] (en adelante, "**ClubLab**" o el "**Encargado**"), titular de la plataforma digital ClubLab.

Ambas partes acuerdan suscribir el presente **Acuerdo de Tratamiento de Datos (DPA)** de conformidad con lo establecido en el Artículo 28 del Reglamento (UE) 2016/679 (RGPD).

---

## 1. Objeto y Duración del Tratamiento

1.1. **Objeto**: El presente acuerdo regula los términos en los que ClubLab tratará datos personales por cuenta del Cliente con el fin exclusivo de prestar los servicios SaaS de gestión deportiva, control de rendimiento, bienestar, lesiones, analítica e Inteligencia Artificial contratados a través de la plataforma ClubLab.
1.2. **Duración**: La duración del tratamiento coincidirá con la vigencia de la prestación de los servicios SaaS acordada entre el Cliente y ClubLab.

---

## 2. Naturaleza, Finalidad y Categorías de Datos

2.1. **Naturaleza y Finalidades**: Alojamiento en la nube, procesamiento algorítmico, gestión de convocatorias, seguimiento de cargas físicas, evaluación fisioterapéutica y soporte al rendimiento deportivo.
2.2. **Categorías de Interesados**: Jugadores/as, cuerpo técnico, preparadores físicos, equipo médico/fisioterapeutas, directivos, empleados y tutores legales de menores del Cliente.
2.3. **Tipos de Datos Personales**:
- Datos Identificativos y de Contacto (Nombre, foto, email, DNI/Pasaporte si aplica).
- Datos Deportivos y Físicos (Posición, minutos, altura, peso, estadísticas).
- Datos de Carga y Bienestar (RPE, encuestas de sueño, fatiga, molestias).
- **Categorías Especiales de Datos (Salud - Art. 9 RGPD)**: Historial de lesiones, diagnósticos clínicos, notas médicas confidenciales y planes de readaptación.

---

## 3. Obligaciones del Encargado (ClubLab)

ClubLab se compromete expresamente a:

3.1. **Tratamiento según Instrucciones**: Tratar los datos personales únicamente siguiendo las instrucciones documentadas del Cliente, salvo que esté obligado a ello en virtud del Derecho de la Unión o de los Estados miembros.
3.2. **Confidencialidad**: Garantizar que las personas autorizadas para tratar datos personales (personal técnico y de soporte) se hayan comprometido a respetar la confidencialidad o estén sujetas a una obligación legal de confidencialidad.
3.3. **Medidas de Seguridad (Art. 32 RGPD)**: Aplicar medidas técnicas y organizativas apropiadas para garantizar un nivel de seguridad adecuado al riesgo, incluyendo:
- Cifrado de datos en tránsito (TLS 1.3) y en reposo (AES-256 en BD).
- Aislamiento estricto multi-tenant mediante Row Level Security (RLS) en PostgreSQL.
- Control de acceso basado en roles (RBAC) con restricción técnica de notas médicas a perfiles sanitarios.
- Resguardos y copias de seguridad automatizadas.
3.4. **Asistencia al Responsable**:
- Prestar asistencia al Cliente, mediante medidas técnicas y organizativas convenientes, para responder a las solicitudes de ejercicio de derechos de los interesados (acceso, rectificación, supresión, oposición, portabilidad y limitación).
- Asistir al Cliente en la realización de Evaluaciones de Impacto (EIPD) y consultas previas cuando proceda.
3.5. **Notificación de Brechas de Seguridad**: Notificar al Cliente, sin dilación indebida y en un plazo máximo de **48 horas** tras tener conocimiento de ella, las violaciones de la seguridad de los datos personales a su cargo.
3.6. **Devolución o Supresión**: A la finalización de los servicios, a elección del Cliente, suprimir o devolver todos los datos personales, suprimiendo las copias existentes salvo que se requiera la conservación por obligación legal.

---

## 4. Subencargados del Tratamiento (Subprocessors)

4.1. El Cliente autoriza con carácter general a ClubLab para recurrir a los siguientes subencargados necesarios para la prestación del servicio:

| Subencargado | Servicio Prestado | Ubicación | Garantía de Transferencia |
| :--- | :--- | :--- | :--- |
| **Supabase Inc.** | Base de datos PostgreSQL, Auth & Object Storage | UE / EE.UU. | EU-US Data Privacy Framework / SCCs |
| **Google Cloud (Gemini API)** | Inferencia de modelos de IA y RAG seudonimizado | UE / EE.UU. | DPF / SCCs (Zero Data Retention) |
| **Resend Inc.** | Infraestructura de envíos transaccionales de email | EE.UU. | EU-US Data Privacy Framework / SCCs |
| **Stripe Inc.** | Procesamiento de suscripciones y facturación | UE / EE.UU. | DPF / SCCs |

4.2. ClubLab informará al Cliente de cualquier cambio previsto en la incorporación o sustitución de subencargados, dando al Cliente la oportunidad de oponerse a dichos cambios.

---

## 5. Obligaciones del Responsable (El Club)

5.1. Garantizar que el tratamiento de datos cuenta con una base jurídica válida conforme al RGPD (incluyendo la recogida del **consentimiento explícito** para datos de salud de los jugadores o tutores legales de menores).
5.2. Proporcionar a los interesados la información preceptiva sobre protección de datos conforme a los Artículos 13 y 14 del RGPD.
5.3. Mantener actualizada la lista de usuarios y roles autorizados dentro de la plataforma ClubLab.

---

## 6. Auditoría y Demostración de Cumplimiento

ClubLab pondrá a disposición del Cliente toda la información necesaria para demostrar el cumplimiento de las obligaciones establecidas en el presente acuerdo, permitiendo y contribuyendo a la realización de auditorías o inspecciones por parte del Cliente o de un auditor autorizado.

---

## 7. Legislación Aplicable y Jurisdicción

El presente acuerdo se regirá e interpretará de conformidad con las leyes de España y la normativa europea de protección de datos (RGPD). Cualquier controversia se someterá a los juzgados y tribunales del domicilio del Responsable o según se estipule en el contrato principal de SaaS.
