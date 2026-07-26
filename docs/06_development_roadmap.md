# 06. Development Roadmap

Este documento define la planificación temporal y funcional del desarrollo de **ClubLab**. Organiza las características en épicas y funcionalidades secuenciales, estableciendo dependencias técnicas claras y delimitando hitos de entrega realistas para el equipo de desarrollo. La estructura está diseñada para facilitar su importación directa a herramientas como Linear.

---

## 1. Hitos Temporales del Proyecto (Milestones)

El desarrollo y validación de ClubLab se divide en cuatro grandes metas temporales para compaginar el rigor de desarrollo con la validación práctica en el fútbol real:

```text
[27 Julio 2026] ──► Hito 1: Lanzamiento de la versión MVP Core (Fase 1)
[Diciembre 2026] ──► Hito 2: Cierre de validación piloto e incorporación de equipos beta externos
[Año 2027]       ──► Hito 3: Desarrollo e integración de IA Deportiva y Vídeo (Fase 2)
[Año 2028 / +]   ──► Hito 4: Escalabilidad SaaS comercial y Módulos Financieros avanzados (Fase 3)
```

---

## 2. Desglose del Roadmap por Fases y Épicas

A continuación se detalla el listado funcional genérico estructurado por épicas y fases de desarrollo:

### FASE 1: MVP CORE
*Objetivo: Sentar los cimientos del sistema multi-tenant, el control físico diario, el historial de lesiones completo y el scouting básico. Lanzamiento: 27 de julio de 2026. Validación beta: diciembre de 2026.*

#### Épica 1: Multi-tenancy, Onboarding y Seguridad
*   **CL-1.1:** Sistema de registro organizativo (Club, Academia o Entrenador independiente) y subida de branding (colores dinámicos en variables CSS).
*   **CL-1.2:** Creador estructurado de Temporadas (`seasons`) y Categorías de equipos (`teams`).
*   **CL-1.3:** Sistema de invitaciones y alta de usuarios del staff técnico/médico.
*   **CL-1.4:** Modelo de permisos RBAC flexible con soporte para asignación de múltiples roles simultáneos por usuario (ej. primer entrenador y preparador físico).
*   **CL-1.5:** Aplicación de políticas RLS en base de datos PostgreSQL mediante el helper `auth_org_id()`.

#### Épica 2: Gestión de Plantillas y Jugadores
*   **CL-2.1:** Ficha de jugador: datos biográficos, pie dominante, altura/peso y avatar.
*   **CL-2.2:** Flujo de consentimiento explícito de uso de datos (`data_sharing_consent`) y asignación de identificador único anonimizado (`anonymized_id`).
*   **CL-2.3:** Campograma visual interactivo para asignación de posiciones tácticas principales y secundarias por jugador.

#### Épica 3: Rendimiento MVP (Entrenamientos y Cargas)
*   **CL-3.1:** Calendario mensual y semanal de entrenamientos y partidos (MD-4 a MD+2).
*   **CL-3.2:** Biblioteca de ejercicios del club con taxonomía básica y creador de plantillas de sesión.
*   **CL-3.3:** Registro de asistencia rápido (`SessionAttendance`) para jugadores.
*   **CL-3.4:** Registro diario de Wellness (sueño, fatiga, humor, molestias) y valoración subjetiva del esfuerzo post-sesión (RPE) por el jugador.

#### Épica 4: Fisioterapia y Lesiones MVP (Médico completo)
*   **CL-4.1:** Historial clínico de lesiones: tipo de lesión, gravedad, región muscular/articular y mecanismo de lesión.
*   **CL-4.2:** Planes de tratamiento y registro diario de las fases de readaptación física.
*   **CL-4.3:** Panel de disponibilidad de plantilla para el entrenador en semáforo (`green`, `yellow`, `red`) alimentado por el estado médico.

#### Épica 5: Scouting e Introducción a la Captación
*   **CL-5.1:** Base de datos de candidatos externos y ojeadores asignados.
*   **CL-5.2:** Ficha técnica de candidatos externos con estado de fichaje (`signed`, `close`, `difficult`) e informes de ojeador simplificados.

#### Épica 6: Gestión Administrativa y Financiera Core
*   **CL-6.1:** Base de datos básica de socios y cobro manual de cuotas de la escuela/academia.

---

### FASE 2: INTELLIGENCE & AI CORE (AÑO 2027)
*Objetivo: Integrar el motor de IA deportiva, análisis estadístico y la edición local de clips de vídeo. Lanzamiento de IA: Año 2027.*

#### Épica 7: Motor de IA Deportiva
*   **CL-7.1:** Asistente conversacional inteligente global (AI Concierge) integrado en la barra de búsqueda/chat.
*   **CL-7.2:** Persistencia de análisis de IA en la base de datos (`ai_analyses`) con control de expiración a 90 días.
*   **CL-7.3:** Integración de widgets especializados de IA para la propuesta táctica de ejercicios y redacción de planes de readaptación.
*   **CL-7.4:** Implementación de RAG (Generación Aumentada por Recuperación) conectada al contexto semántico del club.
*   **CL-7.5:** Agentes interfuncionales (Cross-Functional) con enmascaramiento de datos médicos confidenciales.

#### Épica 8: Análisis Estadístico y Edición de Vídeo Local
*   **CL-8.1:** Registro avanzado de estadísticas de partidos (alineaciones, goles, tarjetas, eventos de juego).
*   **CL-8.2:** Integración de WebAssembly (`FFmpeg.wasm`) en cliente para el corte local de clips de vídeo por el entrenador sin costes en la nube.
*   **CL-8.3:** Descarga de clips de vídeo local y soporte para su transmisión interna mediante las vías de comunicación del club (WhatsApp, Drive, NAS).

#### Épica 9: Grafo Semántico y Alertas Proactivas
*   **CL-9.1:** Estructura híbrida de grafos en PostgreSQL + pgvector para la ontología de conceptos tácticos y dolores/lesiones anatómicas.
*   **CL-9.2:** Sistema autónomo (cron tasks) de alertas predictivas de riesgo de lesión basadas en wellness/RPE acumulados.
*   **CL-9.3:** Envío automatizado de recordatorios (wellness diario) por WhatsApp API / Correo (Resend).

---

### FASE 3: SAAS SCALE & FINANZAS AVANZADAS (AÑO 2028 / +)
*Objetivo: Automatizar la monetización del SaaS, la facturación digital con validez legal y el control administrativo total.*

#### Épica 10: Módulo Administrativo Avanzado
*   **CL-10.1:** Gestión completa de socios, abonados y control de accesos e inventario de material deportivo.
*   **CL-10.2:** Plataforma de inscripciones públicas online para la academia del club.

#### Épica 11: Módulo Financiero y Compliance
*   **CL-11.1:** Domiciliación y cobro de cuotas periódicas mediante pasarelas bancarias (Stripe / SEPA).
*   **CL-11.2:** Motor de facturación digital con soporte legal para leyes de e-factura modernas (TicketBAI / Crea y Crece).
*   **CL-11.3:** Seguimiento económico de patrocinadores y justificación presupuestaria de subvenciones públicas.

---

## 3. Matriz de Prioridades y Dependencias Técnicas

| Épica | Fase | Complejidad | Impacto | Dependencias Lógicas (Épicas previas) |
|---|---|---|---|---|
| **Épica 1: Multi-tenancy** | Fase 1 | Media | Crítico | Ninguna (Bloqueante general) |
| **Épica 2: Gestión Plantillas** | Fase 1 | Baja | Alto | Épica 1 |
| **Épica 3: Rendimiento MVP** | Fase 1 | Alta | Alto | Épica 1, Épica 2 |
| **Épica 4: Fisioterapia MVP** | Fase 1 | Media | Alto | Épica 1, Épica 2 |
| **Épica 5: Scouting MVP** | Fase 1 | Baja | Medio | Épica 1 |
| **Épica 6: Finanzas Core** | Fase 1 | Baja | Medio | Épica 1 |
| **Épica 7: Motor IA Deportiva** | Fase 2 | Alta | Crítico | Épica 3, Épica 4 |
| **Épica 8: Vídeo Local** | Fase 2 | Alta | Alto | Épica 3 |
| **Épica 9: Grafo Semántico** | Fase 2 | Media | Alto | Épica 7 |
| **Épica 10: Admin Avanzado** | Fase 3 | Media | Medio | Épica 6 |
| **Épica 11: Financiero/E-factura**| Fase 3 | Alta | Alto | Épica 6, Épica 10 |
