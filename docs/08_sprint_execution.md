# 08. Sprint Execution

Este documento organiza el desarrollo ágil diario de **ClubLab**. Se utiliza para planificar los sprints de desarrollo, definir el backlog ejecutable con sus estimaciones en Puntos de Historia (Story Points), establecer el Definition of Done (DoD) y definir los estándares de control de versiones y ramas.

---

## 1. Planificación de Sprint (Sprint Backlog)

### Sprint 1: MVP Core Release (Lanzamiento Fase 1)
*   **Periodo:** 20 de Julio al 27 de Julio de 2026 (1 Semana).
*   **Objetivo del Sprint:** Desplegar la estructura multi-tenant, el control de accesos flexible, la gestión de la plantilla con campograma, los cuestionarios de fatiga (wellness/RPE) y el seguimiento completo de lesiones sincronizado con el estado de disponibilidad del jugador.
*   **Capacidad del Equipo:** 35 SP (Story Points).

| ID Ticket | Épica Asociada | Tarea de Desarrollo / Título | Estimación (SP) | Estado Actual | Asignado A |
|---|---|---|---|---|---|
| **CL-101** | Épica 1: Multi-tenancy | Refactorizar base de datos y esquema para soporte multi-rol de usuarios (modificación de RLS y `user_organization_roles`). | 8 SP | En progreso | Backend Dev |
| **CL-102** | Épica 1: Multi-tenancy | Pantalla de Onboarding organizacional e invitaciones a staff con asignación multi-rol en UI. | 3 SP | Por hacer | Frontend Dev |
| **CL-201** | Épica 2: Plantillas | Implementación del Campograma visual interactivo para posicionamiento de jugadores. | 5 SP | Por hacer | Frontend Dev |
| **CL-301** | Épica 3: Rendimiento | Formulario móvil optimizado de cuestionario Wellness y entrada de esfuerzo RPE por jugador. | 5 SP | Por hacer | Frontend Dev |
| **CL-302** | Épica 3: Rendimiento | Cálculo y visualización de ratios de carga aguda/crónica en el dashboard del staff técnico. | 3 SP | Por hacer | Fullstack Dev |
| **CL-401** | Épica 4: Lesiones | Implementación de la tabla `injuries` en base de datos, RLS médica restrictiva y trigger de disponibilidad en Supabase. | 5 SP | En progreso | Backend Dev |
| **CL-402** | Épica 4: Lesiones | Vista del semáforo de disponibilidad y ficha médica de lesiones en el panel del Fisioterapeuta. | 3 SP | Por hacer | Frontend Dev |
| **CL-501** | Épica 5: Scouting | Vista simplificada de candidatos externos y ojeadores asignados (Ficha básica de captación). | 3 SP | Por hacer | Fullstack Dev |

---

## 2. Definition of Done (DoD) - Criterios de Finalización

Una tarea se considera "Terminada" (Done) únicamente cuando cumple con todos los criterios de la siguiente lista de control:

1.  **Código Limpio y Tipado:** El código compila sin errores ni advertencias de TypeScript y pasa las validaciones de ESLint.
2.  **Seguridad RLS Verificada:** Toda nueva tabla en base de datos tiene RLS activado y se ha testeado que un tenant no puede acceder a datos de otro.
3.  **Localización (i18n):** No existen textos hardcoded en el frontend. Todos los mensajes se han añadido a los archivos `/messages/es.json` y `/messages/en.json`.
4.  **Diseño Responsivo:** La UI se visualiza correctamente en dispositivos móviles (vistas verticales y táctiles) y ordenadores de escritorio.
5.  **Pruebas Unitarias/Integración:** Los flujos críticos modificados (cálculo de RPE, trigger de disponibilidad en lesiones) pasan los tests unitarios.
6.  **Code Review:** El Pull Request (PR) correspondiente ha sido revisado y aprobado por al menos otro desarrollador del equipo.

---

## 3. Flujo de Trabajo en Git (Git Flow)

Para mantener la rama principal (`main`) siempre estable y lista para producción:

### 3.1. Nomenclatura de Ramas
*   Funcionalidades nuevas: `feature/CL-[ID_Ticket]-[descripcion-corta]` (ej. `feature/CL-201-campograma`).
*   Corrección de fallos: `bugfix/CL-[ID_Ticket]-[descripcion-corta]` (ej. `bugfix/CL-405-error-rpe`).
*   Tareas de infraestructura/refactor: `chore/[descripcion]` (ej. `chore/eslint-setup`).

### 3.2. Formato de Commits (Conventional Commits)
Los mensajes de commit deben ser claros y estructurados:
*   `feat(lesiones): añadir trigger de actualización de disponibilidad CL-401`
*   `fix(rbac): corregir lectura de roles múltiples en can helper CL-101`
*   `style(dashboard): ajustar alineación del BottomNavBar en móvil`

### 3.3. Requisitos para Pull Requests (PR)
*   Debe incluir una descripción clara del cambio técnico y cómo verificarlo.
*   Debe adjuntar capturas de pantalla si hay modificaciones visuales de UI.
*   Debe pasar satisfactoriamente todos los checks automatizados del CI (Continuous Integration) en Vercel/GitHub Actions.
