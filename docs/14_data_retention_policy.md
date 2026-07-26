# 14. ClubLab Data Retention & Purge Policy

> **Política de Conservación, Purga y Cancelación de Datos**
> Este documento establece los criterios y periodos de retención para cada categoría de información en ClubLab, cumpliendo con el principio de limitación del plazo de conservación (Art. 5.1.e RGPD).

---

## 1. Principios de Conservación

1. **Minimización Temporal**: Los datos se conservarán únicamente durante el tiempo estrictamente necesario para cumplir las finalidades deportivas, operativas o legales para las que fueron recabados.
2. **Bloqueo de Datos**: Finalizada la relación entre el jugador/usuario y el club (o cancelada la suscripción SaaS), los datos se someterán a un periodo de bloqueo (acceso restringido a administradores legales) durante los plazos de prescripción de responsabilidades contractuales o administrativas antes de su eliminación o anonimización definitiva.
3. **Purga Automatizada**: Implementación de tareas automáticas de eliminación para logs de auditoría e inferencias de Inteligencia Artificial.

---

## 2. Cronograma de Retención por Tabla / Entidad

| Tabla / Entidad | Periodo de Conservación Activa | Periodo de Bloqueo | Criterio de Purga / Eliminación Definitiva |
| :--- | :--- | :--- | :--- |
| `profiles` / `auth.users` | Mientras la cuenta esté activa | 5 años tras la baja | Eliminación física (Hard Delete) de Auth y Profile. |
| `players` | Mientras el jugador pertenezca al club | 5 años tras la salida | Soft delete (`deleted_at`) → Purga física tras 5 años. |
| `wellness_entries` | 3 años acumulados | 2 años adicionales | Eliminación de registros con antigüedad > 5 años. |
| `rpe_entries` | 3 años acumulados | 2 años adicionales | Eliminación de registros con antigüedad > 5 años. |
| `player_loads` | 3 años acumulados | 2 años adicionales | Eliminación de registros con antigüedad > 5 años. |
| `injuries` & `rehab_plans` | Mientras el jugador pertenezca al club | **5 a 10 años** (según prescripción médica legal) | Bloqueo en RLS y posterior purga o anonimización. |
| `ai_analyses` | **90 días** (`expires_at`) | 0 días | Purga automática nocturna mediante Cron Job de DB. |
| `user_data_consents` | Indefinido (mientras exista la cuenta) | 5 años tras cierre | Requerido para demostración de cumplimiento (Audit). |
| `platform_page_views` / Logs | 12 meses | 0 días | Purga de logs de telemetría mayores a 365 días. |
| `subscriptions` & Facturas | Vigencia del contrato B2B | **6 años** (Código de Comercio / Ley Fiscal) | Conservación obligatoria por normativa tributaria. |

---

## 3. Escenarios de Eliminación y Cancelación

### Escenario 3.1: Un Jugador Abandona el Club
* **Acción**: El Administrador cambia el estado en `player_team_memberships` a `inactive` o `transferred`, o ejecuta soft delete (`players.deleted_at = NOW()`).
* **Acceso**: El cuerpo técnico deja de ver al jugador en las plantillas activas. Sus datos históricos de carga y partidos permanecen visibles en informes agregados de la temporada sin alteración del histórico del club.
* **Derechos**: El jugador conserva su cuenta de usuario en el Privacy Center y puede solicitar la portabilidad o supresión de sus datos personales directos.

### Escenario 3.2: El Club Cancela la Suscripción B2B a ClubLab
* **Periodo de Gracia (30 días)**: Tras la cancelación, el Club dispone de 30 días para exportar las fichas, datos de carga, estadísticas y resúmenes en formato estructurado (`.zip` / `.json` / `.csv`).
* **Supresión B2B**: Transcurridos 60 días desde la resolución del contrato B2B, ClubLab ejecutará el script de limpieza de la base de datos, eliminando las organizaciones, equipos, plantillas y registros asociados, salvo datos de facturación legalmente exigibles.

### Escenario 3.3: Solicitud del Derecho al Olvido (Art. 17 RGPD)
1. El usuario solicita la supresión desde `/player/profile/privacy`.
2. Se genera un ticket en `player_privacy_requests`.
3. El Administrador del Club dispone de un plazo máximo de **30 días** para tramitarla.
4. Si procede, los identificadores personales se eliminan y las métricas deportivas se convierten a datos anonimizados sin vinculación a la persona física.
