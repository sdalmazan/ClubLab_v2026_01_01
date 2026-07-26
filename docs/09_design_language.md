# ClubLab UX/UI Design Language

> *"The best interface is not the one that shows the most functionality. It is the one that makes the right functionality obvious at the right moment."*

---

## 1. Producto y Filosofía

### Para quién diseñamos
ClubLab sirve a **cuerpos técnicos y entrenadores de fútbol base y semi-profesional**. Personas que:
- Trabajan en el campo, muchas veces con el móvil en la mano entre ejercicios.
- No disponen de tiempo para formaciones ni manuales.
- Valoran la velocidad de registro por encima de la complejidad analítica.
- Tienen un dominio técnico del fútbol, no del software.

### Los 10 Principios
1. **Focus**: Cada pantalla tiene un propósito dominante claro en < 3 segundos.
2. **Calm**: La interfaz no compite por atención. Fondos oscuros limpios, sombras tenues, sin glassmorphism ni efectos innecesarios.
3. **Progressive Disclosure**: "Simple por defecto. Potente cuando se necesita". La complejidad emerge a demanda.
4. **Context over Configuration**: Comportamientos inteligentes basados en el contexto actual del equipo/temporada.
5. **One Primary Action**: Una sola acción principal destacada por pantalla.
6. **Complexity on Demand**: Todas las funciones avanzadas existen, pero ocultas tras revelación progresiva.
7. **Consistency**: Mismos patrones visuales e interacciones en toda la plataforma.
8. **Direct Manipulation**: Preferir interactuar directamente sobre el terreno de juego o listados antes que formularios extensos.
9. **Information Hierarchy**: Tipografía y espacio negativo como estructuradores principales, no bordes ni cards infinitas.
10. **Invisible Technology**: La herramienta desaparece detrás del trabajo del entrenador.

---

## 2. Sistema de Superficies y Fichas (Tokens)

### Jerarquía de Superficies (Máximo 3 niveles)
| Nivel | Token Tailwind | Uso |
|-------|----------------|-----|
| Canvas | `bg-background` (`oklch(10% 0.02 265)`) | Fondo de la aplicación |
| Contenedor Principal | `bg-card border border-border rounded-lg` | Bloques principales de contenido |
| Elemento Anidado | `bg-muted/50 rounded-lg` | Elementos o filas dentro de una card |

**Regla de oro:** Prohibido anidar más de 3 niveles de profundidad.

### Escala de Sombras
- `shadow-sm`: Profundidad sutil en elementos en reposo.
- `shadow-md`: Elementos flotantes (modales, desplegables, popovers).
- **Prohibidas:** `shadow-lg`, `shadow-xl`, `shadow-2xl`, `shadow-black/*`.

### Modales y Superposiciones
- Estándar: `bg-popover border border-border shadow-md rounded-xl`.
- Sin `backdrop-blur`, sin sombreados oscuros masivos.

---

## 3. Sprint 0 & 1 Learnings (Reglas Evolutivas)

### Lo que funciona y debemos mantener
1. **Eliminación total del glassmorphism**: Usar `bg-card` y `bg-muted/50` grounded en lugar de `glass` y `backdrop-blur` da mayor solidez y serenidad profesional.
2. **Componentes Primitivos Unificados**: Reemplazar componentes custom por primitivos accesibles de `@base-ui/react` / shadcn (`Select`, `DropdownMenu`, `Tooltip`).
3. **Estructura de Cabecera Estandarizada**: Uso de `PageHeader` y `SectionHeader` para marcar títulos y jerarquía sin llenar la pantalla de banners.

### Lo que NO funcionó y debemos evitar / corregir
1. **El patrón de etiqueta excesiva (`text-[10px] uppercase font-bold text-slate-400 tracking-wider`)**:
   - *Problema:* Transmite una apariencia recargada y típica de plantilla "AI-generated UI".
   - *Corrección:* Utilizar tipografía neutra en tamaño `text-xs font-medium text-muted-foreground` con capitalización normal.
2. **Abuso de Cards anidadas**:
   - *Problema:* Dividir cada pequeño dato en una caja independiente genera fragmentación y fatiga visual.
   - *Corrección:* Utilizar listas limpias en espacio abierto separadas por espacio negativo o divisor fino (`divide-y divide-border/40`).
3. **Clases de compatibilidad CSS temporales**:
   - *Problema:* Mantener `.btn-corporate` o `.corp-badge` en `globals.css` genera dualidad.
   - *Corrección:* Migrar paulatinamente a componentes `<Button variant="corporate">` y `<Badge variant="corporate">`.
4. **Dashboard como "Data Dump"**:
   - *Problema:* Muestra 10 métricas y accesos simultáneos compitiendo por atención.
   - *Corrección:* Transformar el Dashboard en un **Daily Briefing** centrado en lo que el entrenador debe saber y hacer **hoy**.

---

## 4. Convenciones de Código y Componentes

- **Tooltip**: `<TooltipTrigger>` renderiza directamente el elemento interactivo. Usar `render` prop para componentes complejos.
- **Select**: Guardar `onValueChange` con `?? ""` para prevenir `null` devueltos por `base-ui`.
- **Colores Semánticos**:
  - `text-muted-foreground` en lugar de `text-slate-400` / `text-slate-500`.
  - `border-border` en lugar de `border-white/10`.
  - `bg-card` o `bg-muted` en lugar de `bg-slate-900` / `bg-white/5`.

---

## 5. Sprint 3 Learnings — Player Workspace Rules

> *Reglas de interacción descubiertas en el rediseño del Workspace de Jugadores y Plantilla.*

### Principio de Lectura del Jugador: "Scan → Understand → Act → Explore"
1. **Scan (0-3s):** El staff debe identificar de un vistazo en la cabecera la Identidad (Avatar, Dorsal, Posición) y la Disponibilidad Médica (Disponible, Readaptación, Baja).
2. **Understand:** Estado de carga reciente, fatiga acumulada y alertas activas en una sola franja sin badges inconexos.
3. **Act:** El botón principal de acción es dinámico y depende del estado actual del jugador (ej. Si está en baja médica, "Seguimiento Médico / Readaptación"; si está disponible, "Registrar Test / Carga").
4. **Explore:** La información detallada (Historial de lesiones, pruebas físicas, roles de lanzamiento) se distribuye en pestañas sobrias y contextuales.

### Tabla de Decisión de Plantilla (`/players`)
- Reemplazo de la acumulación de cards por una **Tabla de Decisión de Alta Densidad** que responde a: *"¿Quién necesita mi atención hoy?"*.
- El filtro rápido incluye un contador en tiempo real de jugadores que requieren atención (bajas médicas + sobrecarga física).
- El **Mapa de Campo Táctico** se conserva como vista alternativa limpia para el staff que requiere evaluación gráfica por posición sobre el terreno de juego.

---

## 6. Sprint 4 Learnings — Physio & Medical Workspace Rules

> *Principios de interacción para el módulo de Enfermería, Citas de Fisioterapia y Return to Play (RTP).*

### Interfaz Ultramóvil & Flujo del Fisioterapeuta
1. **Apertura de Consulta Abierta:** El fisio define la fecha, la hora de inicio (ej. `16:00`) y la duración de franja por jugador (15 min por defecto).
2. **Cita en 1 Clic para el Jugador:** Los futbolistas ven el aviso de consulta abierta en su perfil/dashboard y se apuntan indicando únicamente el **motivo de la molestia**.
3. **Dictamen "Tratado" en 1 Toque:** Al pulsar el botón grande **"Tratado"**, se despliega el menú de aptitud en 3 estados:
   - 🟩 **Apto** *(Disponible para entrenar/competir)*
   - 🟧 **Adaptado** *(Readaptación física / Parte de sesión)*
   - 🔴 **No Apto** *(Baja Médica)*
4. **Pipeline de Lesión en 4 Fases (RTP):**
   - *Fase 1:* Fisioterapia / Baja
   - *Fase 2:* Readaptación en Campo
   - *Fase 3:* Integración Parcial a Grupo
   - *Fase 4:* Alta Competitiva
   - Ajuste dinámico de la **Fecha Prevista de Retorno (Return to Play)** en cada sesión de tratamiento.
5. **Informes Médicos Adjuntos:** Espacio para redactar la evolución clínica y adjuntar o simular archivos PDF/Imágenes de resonancias y ecografías.

---

## 7. Sprint 5 Learnings — Match Center & Pre-Match Hub Rules

> *Principios de interacción para el módulo de Partidos (`/matches`), Scouting y Pre-Match Briefing.*

### Centro de Operaciones Pre-Partido
1. **Pre-Match Briefing Hero:** En lugar de presentar primero filtros de actas pasadas, la cabecera destaca el **Próximo Partido** con fecha, estadio y tipo de encuentro.
2. **3 Claves Tácticas del Rival:** Presentación ejecutiva de la *vulnerabilidad defensiva*, *patrón ofensivo* y *balón parado* en 3 tarjetas limpias.
3. **Semáforo de Disponibilidad del Equipo:** Conexión visible con el estado de la plantilla (Aptos 🟩, Readaptación 🟧, Bajas Médicas 🔴).
4. Modales de Actas Federativas: Fondos 100% sólidos y opacos (`bg-slate-900 shadow-2xl`) con navegación limpia por pestañas para alineaciones, eventos y auditoría de cuerpo técnico.

---

## 8. Sprint 6 Learnings — Performance & Readiness Command Center Rules

> *Principios de interacción para el módulo de Rendimiento (`/performance/dashboard`) y control de cargas.*

### Centro de Operaciones del Preparador Físico
1. **Semáforo Matutino de Disponibilidad:** Clasificación ejecutiva previa a la sesión en 3 niveles (🟩 *Listo 100%*, 🟧 *Carga Reducida / Adaptado*, 🔴 *Baja Médica / Reposo*).
2. **Bandeja de Sugerencias de Enfermería:** Conexión directa con las indicaciones clínicas del Fisioterapeuta con acción en 1 clic **"Aplicar a la Sesión"**.
3. Controles de Carga Táctiles: Botones de minutos proyectados (`90m`, `60m`, `45m`, `30m`, `0m`) para ajustar cargas sin salir del dashboard.
4. **Acción de Lectura en Physio Inbox:** El preparador físico valida los comentarios del fisio mediante **"Aceptar Comentario (Leído)"**.
5. **Monitorización de Wellness:** Contador en directo de cumplimentación (*ej. 18 / 22 completados*) y gráfico emergente de evolución de tendencias.
6. Confirmación por Pesaje Matutino: Pesaje obligatorio desde las instalaciones del club que registra el peso e ingresa la asistencia del futbolista automáticamente.
7. **Widget de Check-in en Inicio:** Tarjeta Mobile-First en la pantalla principal del Entrenador para consultar el % de cumplimentación y la lista de pendientes en 1 vistazo.
8. **Ficha Holística 360°:** Cuadro de mando unificado que agrupa lesiones, molestias, wellness, datos GPS, peso y composición corporal.
9. **Antropometría ISAK:** Test de 6 pliegues cutáneos para seguimiento de % de grasa corporal.

---

## 9. Sprint 7 Learnings — Exercise Creator & 2D Tactical Whiteboard Rules

> *Principios de interacción para la biblioteca de tareas (`/training/exercises`) y la pizarra táctica.*

### Preservación del Flujo de Trabajo
1. **Flujo Habitual Intacto:** La creación de sesiones, bloques de tiempo y asignación de ejercicios a futbolistas mantiene 100% la estructura conocida.
2. **Píldoras de Filtro Táctico de 1 Clic:** Botones directos para filtrar por *Activación, Posesión, Transiciones, Finalización, ABP y Fuerza*.
3. **Pizarra 2D:** Esquemas tácticos vectoriales con fichas por colores (🔴/🔵/🟡/🟩) y trazados de pase/desmarque.

---

## 10. Sprint 8 Learnings — Universal Scouting Search Engine Rules

> *Principios de interacción para el buscador de scouting (`/scouting`).*

### Buscador Directo & Sugerencias
1. **Búsqueda Multi-Entidad:** Permite buscar simultáneamente **Jugadores**, **Entrenadores** y **Equipos/Clubes rivales** en una única caja limpia.
2. **Sugerencias Destacadas:** Tarjetas de acceso rápido a los líderes de la competición (*Goleadores, Asistentes, Rendimiento Superior*).
3. **Detalle Opaco 100%:** Fichas de consulta modal de fondo totalmente sólido (`bg-slate-900 shadow-2xl`).

---

## 11. Sprint 9 Learnings — Academy, Methodology & Facilities Rules

> *Principios de interacción para el módulo de la Academia (`/academy`).*

### Gestión de Cantera & Licencia
1. **Control de Licencia de Módulo:** Verificación de módulo habilitado por suscripción (`is_academy_license_active`), activo por defecto para S.D. Almazán.
2. **Cuadrante Horario de Campos:** Matriz visual por franjas horarias y terrenos de juego (*La Arboleda, Anexo Césped Artificial*) previniendo solapamientos.
3. **Seguimiento Metodológico Táctico:** Matriz de minutos trabajados en conceptos tácticos clave por cada categoría del club.



