# 10. ClubLab — Privacy & Data Governance Specification

> ⚖️ **AVISO DE EXENCIÓN LEGAL:** Este documento ha sido elaborado por el equipo de producto e ingeniería de ClubLab como especificación técnica y de arquitectura de gobierno de datos. **No constituye asesoramiento jurídico definitivo.** Todos los apartados marcados con ⚖️ o 🔧 deben ser revisados y ratificados por un profesional jurídico cualificado antes del lanzamiento comercial.

---

## 1. Introducción y Arquitectura de Gobierno del Dato

ClubLab es una plataforma SaaS digital multi-tenant diseñada para la gestión deportiva holística en clubes de fútbol, academias y preparadores independientes. Centraliza datos personales, deportivos, físicos, de bienestar y de salud (lesiones y readaptación).

El objetivo de esta especificación es implementar los principios del **RGPD / Reglamento (UE) 2016/679** y normativas internacionales equivalentes directamente en el diseño del software (**Privacy by Design & by Default**), garantizando:

1. **Lawfulness (Licitud)**: Cada tratamiento cuenta con una base jurídica válida conforme al Art. 6 (y Art. 9 para salud).
2. **Transparency (Transparencia)**: El usuario entiende qué se recoge, para qué, quién lo ve y cómo lo controla.
3. **Data Minimization (Minimización)**: Solo se procesa el dato estrictamente necesario para la funcionalidad solicitada.
4. **Security & Least Privilege (Seguridad y Mínimo Privilegio)**: Aislamiento por RLS en PostgreSQL, cifrado y control de acceso funcional por rol.
5. **User Control (Control de Usuario)**: Gestión activa de consentimientos, transparencia de IA y ejercicio de derechos ARCO/RGPD.

---

## 2. Clasificación Legal de las Categorías de Datos

Analizando el modelo de datos real de ClubLab (tablas de Supabase `profiles`, `players`, `wellness_entries`, `rpe_entries`, `player_loads`, `injuries`, `physical_tests`, `ai_analyses`, `user_data_consents`), las 8 categorías principales se clasifican legalmente así:

| Categoría de Dato | Campos en BD | Clasificación Legal (RGPD) | Justificación y Sensibilidad | Base Jurídica Recomendada |
| :--- | :--- | :--- | :--- | :--- |
| **1. Datos Personales Identificativos** | `first_name`, `last_name`, `sporting_name`, `dob`, `avatar_url`, `email` | **Datos Personales Comunes** (Art. 4.1) | Identificadores directos de la persona. Sensibilidad Estándar. | Ejecución de Contrato (Art. 6.1.b) |
| **2. Datos Deportivos** | `positions`, `dominant_foot`, `jersey_number`, `minutes_played`, `match_stats` | **Datos Personales Comunes** | Métricas operativas de rendimiento deportivo. Sensibilidad Baja. | Ejecución de Contrato (Art. 6.1.b) / Interés Legítimo |
| **3. Datos Físicos** | `height_cm`, `weight_kg`, composición corporal futura | **Datos Antropométricos / Salud** | Parámetros físicos que revelan características corporales. Sensibilidad Media-Alta. | Consentimiento Explícito (Art. 9.2.a) / Contrato |
| **4. Datos de Bienestar (Wellness)** | `sleep_quality`, `fatigue`, `mood`, `muscle_soreness`, `localized_discomfort` | **Datos Fisiológicos / Potencialmente Salud** | Monitoreo del estado diario de fatiga, descanso y tensión corporal. Sensibilidad Alta. | Consentimiento Explícito (Art. 9.2.a) / Ejecución Contrato |
| **5. Datos Relacionados con Salud** | `injuries` (`injury_type`, `body_part`, `mechanism`, `medical_notes`, `treatment_plan`), `rehab_plans` | **Categoría Especial de Datos (Datos de Salud - Art. 9.1)** | Diagnósticos clínicos, tratamientos, limitaciones médicas y fichas fisioterapéuticas. **Sensibilidad Máxima (Protección Reforzada).** | **Consentimiento Explícito (Art. 9.2.a)** o Medicina del Trabajo/Deporte bajo Secreto Profesional (Art. 9.2.h) |
| **6. Datos de Rendimiento & Carga** | `rpe` (1-10), `acute_load`, `chronic_load`, `acwr`, `monotony`, `strain` | **Datos Bio-fisiológicos Derivados** | Carga interna y externa, riesgo de sobrecarga. Revelan la capacidad de respuesta física. Sensibilidad Alta. | Consentimiento Explícito (Art. 9.2.a) / Interés Legítimo |
| **7. Datos de Uso de la Plataforma** | `platform_page_views`, `platform_feature_usage`, IP, User Agent, logs | **Datos de Navegación / Telemetría** | Auditoría técnica y telemetría de uso del SaaS. Sensibilidad Baja-Media. | Interés Legítimo (Art. 6.1.f) / Consentimiento Cookies |
| **8. Datos Derivados e IA** | `physical_status` (`green/yellow/red`), `availability_status`, `ai_analyses` | **Datos Inferidos / Perfiles de Rendimiento** | Indicadores sintetizados por algoritmos o Gemini LLM. Sensibilidad Alta si resumen salud. | Consentimiento Explícito (Art. 9.2.a) / Ejecución Contrato |

---

## 3. Tratamiento Detallado de Datos de Salud y Lesiones (Art. 9 RGPD)

> ⚖️ **REVISIÓN JURÍDICA CLAVE:** El Tribunal de Justicia de la Unión Europea (TJUE, Asunto C-184/20) interpreta "datos de salud" de forma amplia. Cualquier dato que permita deducir el estado de salud, lesión, dolor localizado o incapacidad de un jugador entra dentro de la protección especial del Art. 9 RGPD.

### 3.1. Requisitos para el Tratamiento de Datos de Salud en ClubLab
1. **Base Jurídica Dual**:
   - Para el tratamiento general: Art. 6.1.b (Ejecución del contrato entre el club y el jugador/tutor).
   - Para la excepción de prohibición de datos de salud: **Art. 9.2.a (Consentimiento explícito e informado del interesado o su tutor legal)**.
2. **Acceso Restringido y Secreto Profesional**:
   - Las notas médicas (`medical_notes`) y planes de tratamiento clínicos (`treatment_plan`) **deben estar técnicamente bloqueados en RLS** para que únicamente los roles sanitarios calificados (`physio`) y administradores autorizados puedan acceder. El cuerpo técnico (`head_coach`, `coach`) únicamente debe ver el *Semáforo de Disponibilidad* (`availability_status`: Disponible, Control, No Disponible) y restricciones funcionales, **sin revelar el diagnóstico clínico ni notas médicas confidenciales**.
3. **Almacenamiento y Seguridad**:
   - Cifrado obligatorio en tránsito (TLS 1.3) y en reposo (AES-256 en PostgreSQL/Supabase).
   - Aislamiento estricto en BD mediante `organization_id = auth_org_id()`.
   - Separación lógica de notas médicas con permisos específicos (`view_injury_medical_notes`).
4. **Periodo de Conservación de Datos de Salud**:
   - Durante la vigencia de la vinculación del jugador con el club + periodo de prescripción de responsabilidades legales o médicas (5 años tras la salida del club, salvo que la legislación deportiva/médica nacional exija otro plazo).

---

## 4. Matriz de Roles y Tratamientos por Escenario Comercial

### 4.1. Análisis de Escenarios de Negocio

| Escenario Comercial | Responsable del Tratamiento (Data Controller) | Encargado del Tratamiento (Data Processor) | Instrumento Legal Necesario |
| :--- | :--- | :--- | :--- |
| **Escenario A: ClubLab SaaS B2B Vendido a un Club** | El **Club Deportivo / Academia** (determina los fines deportivos y gestiona a sus miembros). | **ClubLab** (presta la plataforma en la nube y procesa los datos según instrucciones del club). | **Contrato de Encargado del Tratamiento (DPA / Art. 28 RGPD)**. |
| **Escenario B: ClubLab para Entrenador Independiente** | El **Entrenador / Preparador** (si actúa de forma autónoma) o el propio **Deportista** (si contrata directamente B2C). | **ClubLab**. | Términos de Servicio B2B/B2C + DPA Simplificado o Política de Privacidad Directa. |
| **Escenario C: Servicios Propios de ClubLab (SaaS Ops)** | **ClubLab** (para gestión de cuentas, cobro de suscripciones con Stripe, seguridad y soporte). | Subencargados de ClubLab (Stripe, Resend, Supabase). | **Política de Privacidad de ClubLab** (Directa al cliente). |
| **Escenario D: Analítica Agregada e Inteligencia de Producto** | **ClubLab** (para mejorar algoritmos y benchmarks deportivos). | — | **Anonimización Irreversible** o Base Jurídica de Interés Legítimo con Seudonimización. |

---

## 5. Matriz de Finalidades del Tratamiento

| Finalidad | Categorías de Datos Utilizados | Base Jurídica (Art. 6 / Art. 9) | ¿Requiere Consentimiento? | ¿Es Obligatorio para Usar la App? | Plazo de Retención | Destinatarios / Terceros |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Prestación del Servicio SaaS** | Personales, Deportivos, Uso | Art. 6.1.b (Contrato) | No (Se aceptan ToS) | Sí | Duración de la cuenta + 5 años | Supabase (Hosting) |
| **2. Gestión Deportiva y Plantilla** | Personales, Deportivos | Art. 6.1.b (Contrato) | No | Sí | Duración en el club + 5 años | Club |
| **3. Control de Carga y Rendimiento** | Físicos, Rendimiento, RPE | Art. 6.1.b + Art. 9.2.a | **Sí (Consentimiento Explícito)** | Opcional (si se desactiva, sin métricas RPE) | Duración en el club + 3 años | Staff Técnico, Physio |
| **4. Check-in Wellness Diario** | Bienestar, Soreness, Sueño | Art. 6.1.b + Art. 9.2.a | **Sí (Consentimiento Explícito)** | Opcional | 2 años acumulados | Staff Técnico, Physio |
| **5. Gestión de Salud y Lesiones** | Lesiones, Notas Médicas, Rehab | Art. 6.1.b + Art. 9.2.a | **Sí (Consentimiento Explícito)** | Opcional (salvo normativa del club) | Salida + 5 años (prescripción médica) | Fisioterapeutas / Médicos exclusivamente |
| **6. IA Generativa & Copiloto** | Deportivos, Carga, Resúmenes | Art. 6.1.f (Interés Legítimo) / Art. 9.2.a | Sí (Consentimiento IA) | Opcional | Max 90 días (`ai_analyses.expires_at`) | Google Gemini API (Zero Retention) |
| **7. Analítica y Mejora del Producto** | Uso, Telemetría, Datos Anonimizados | Art. 6.1.f (Interés Legítimo) | No (si está anonimizado) | Sí | 24 meses agregados | Servicios de Analítica Internos |

---

## 6. Privacidad en la Inteligencia Artificial (AI & Data Usage Governance)

ClubLab integra **Google Gemini API** y arquitecturas RAG (Retrieval-Augmented Generation) para sugerir ejercicios, analizar cargas y redactar resúmenes de rendimiento.

### 6.1. Reglas de Gobierno de Datos para IA
1. **Seudonimización Previa**: Ningún prompt enviado a modelos de IA de terceros contendrá nombres completos, DNI, emails o identificadores directos. Los datos se envían referenciados mediante `anonymized_id` o nombres deportivos genéricos.
2. **Tratamiento de Datos de Salud por IA**:
   - Los datos médicos detallados (`medical_notes`) **NUNCA se envían directamente a la API de IA**.
   - La IA solo procesa el estado sintetizado (ej. *"Jugador en fase de readaptación por molestia muscular en isquiotibiales, limitación a sprints máximos"*).
3. **No Entrenamiento de Modelos de Terceros**: ClubLab utiliza la API Enterprise/Zero Data Retention de Google Gemini, garantizando contractualmente que los datos de los clubes **no se utilizan para entrenar los modelos públicos de Google**.
4. **Persistencia y Caducidad de IA**: Los resultados generados se almacenan en `ai_analyses` con una fecha de caducidad automática de 90 días (`expires_at`), tras la cual se purgan automáticamente.

---

## 7. Anonimización vs. Seudonimización en ClubLab

> ⚖️ **DIFERENCIACIÓN JURÍDICA CRÍTICA:**
> - **Seudonimización (Art. 4.5 RGPD)**: Proceso que sustituye identificadores (ej. usar `anonymized_id` en lugar de nombre). **Sigue siendo dato personal** bajo el RGPD y requiere base jurídica y medidas de seguridad.
> - **Anonimización**: Proceso irreversible por el cual los datos ya no pueden atribuirse a una persona física identificada ni identificable por ningún medio razonable. **Queda fuera del ámbito de aplicación del RGPD**.

ClubLab aplicará **agregación estática e irreversible** (ej. medias de RPE por categoría sin vinculación a `player_id`) para generar benchmarks globales de rendimiento de mercado.

---

## 8. Subencargados del Tratamiento y Proveedores

| Proveedor | Función | Datos Procesados | Ubicación del Servidor | Garantía / Mecanismo de Transferencia |
| :--- | :--- | :--- | :--- | :--- |
| **Supabase Inc.** | Base de Datos PostgreSQL, Auth & Storage | Todos los datos de la app | UE (Frankfurt/Irlanda) o EE.UU. | Cláusulas Contractuales Tipo (SCCs) / DPF |
| **Google Cloud / Gemini API** | Inferencia de IA & RAG | Contexto de prompts (Seudonimizado) | UE / EE.UU. | DPF (Data Privacy Framework) / SCCs |
| **Resend Inc.** | Envío de emails transaccionales | Email, Nombre, Notificaciones | EE.UU. | DPF / SCCs |
| **Stripe Inc.** | Procesamiento de pagos SaaS | Datos de facturación del club, Tarjetas | EE.UU. / UE | DPF / SCCs |
| **WhatsApp Gateway** (Self-hosted / Twilio) | Notificaciones de Wellness | Teléfono, Notificaciones breves | UE / EE.UU. | DPF / SCCs |

---

## 9. Puntos Pendientes de Decisión de Negocio y Revisión Jurídica

🔧 **Decisiones de Negocio Requeridas:**
1. Confirma la entidad jurídica titular de ClubLab y su país de radicación (ej. España / UE).
2. Definir si la región principal de BD en Supabase será Frankfurt (UE).
3. Determinar el flujo de verificación para tutores legales de menores de 14 años (LOPDGDD España).

⚖️ **Puntos para Validación Abogada/o:**
1. Redacción final del borrador del Contrato de Encargado de Tratamiento (DPA).
2. Adecuación del plazo de conservación de notas fisioterapéuticas según la legislación de la CCAA/País correspondiente.
