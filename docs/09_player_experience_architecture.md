# 09. Player Experience Architecture — Mobile First

Este documento define la arquitectura de producto, UX/UI, diseño de interacción y flujos de usuario para la **Experiencia del Jugador (ClubLab Player)**.

---

## 1. Principio de Producto y Filosofía

La experiencia del jugador en ClubLab está diseñada bajo los principios **Mobile First, Ultra Minimalista, Premium e inspirada en la usabilidad nativa de iOS**.

Se utiliza el **Azul Corporativo del SD Almazán (`#3B82F6` / `#1D4ED8`)** como acento visual primario en toda la experiencia, eliminando tonos genéricos.

El sistema convierte continuamente:

$$\text{Datos} \longrightarrow \text{Contexto} \longrightarrow \text{Insight} \longrightarrow \text{Acción}$$

Responde de forma clara a cuatro preguntas centrales en menos de 10 segundos de uso:

1. **¿Cómo estoy?** (Estado físico por carga ACWR/GPS, test físicos, descanso y lesiones).
2. **¿Qué tengo pendiente?** (Check-in pre-entreno y check-out RPE post-sesión en ventana horaria).
3. **¿Qué debería hacer ahora?** (Tarjeta prioritaria inteligente *What Should I Do Now?*).
4. **¿Estoy mejorando?** (Rendimiento en partidos, minutos, goles, clasificación y evolución).

---

## 2. Navegación Móvil (5 Áreas Principales)

Ubicada en una barra de navegación inferior fija (*Bottom Navigation Bar*) estilo iOS con efecto esmerilado (`backdrop-blur-xl`, acentos azul corporativo Almazán):

1. **HOY (`/player`)**: Estado actual, tarjeta prioritaria, resumen sintético y modales.
2. **MI ESTADO & LESIONES (`/player/status`)**: Estado físico (Carga ACWR/GPS, tests físicos), lesiones activas, histórico y botón **Añadir Lesión Confidencial**.
3. **PARTIDOS (`/player/matches`)**: Participación individual (titularidad, minutos, goles, tarjetas, resultado), acumulados de temporada y **Tabla de Clasificación**.
4. **RECOMENDACIONES (`/player/recommendations`)**: Rutinas prescritas por el staff (Fuerza, Prevención, Activación, Movilidad, Recuperación).
5. **PERFIL & AJUSTES (`/player/profile`)**: Datos personales, barra de % completitud, **Ajustes de Perfil** (Editar datos, Cambiar contraseña, Notificaciones) y **Privacy Center**.

---

## 3. Check-in y Check-out con Ventana Horaria & Notificaciones

### 3.1. Restricción por Ventana Horaria
- **Check-in**: Disponible únicamente desde 2 horas antes de la sesión hasta 15 minutos antes del inicio. Botón de envío etiquetado como **"Enviar"**.
- **Check-out (RPE)**: Disponible desde la finalización del entrenamiento hasta 4 horas después. Botón de envío etiquetado como **"Enviar"**.
- Fuera de ventana: Se muestra mensaje descriptivo (*"Check-in cerrado. Próxima ventana disponible a las 09:00h"*).

### 3.2. Sistema de Notificaciones (Email & WhatsApp)
- **Apertura de Ventana**: Envío de aviso por Email / WhatsApp al jugador cuando se abre el período de check-in / check-out.
- **Recordatorio a 30 Minutos del Cierre**: Notificación de alerta a los jugadores que aún no han completado el envío.

### 3.3. Check-in Adaptativo (< 30s)
1. *Calidad del Sueño, Fatiga, Ánimo, Molestia Muscular, Estrés* (1 a 5).
2. *Molestia Focalizada*: Selector de zona corporal (Isquios, Gemelos, Cuádriceps, Rodilla, Tobillo, Espalda, Glúteo) **+ Opción "Otro" con campo de texto libre para especificar la zona**.
3. *Comentarios Opcionales*: Campo colapsado por defecto con botón `+ Añadir comentario opcional`.
4. Botón principal: **`[Enviar]`**.

---

## 4. Estado Físico, Carga & Lesiones Confidenciales

En `/player/status`:
- **Estado Físico Basado en Carga & Tests**: Indicador calculado a partir de la ratio de Carga Aguda vs Crónica (ACWR / GPS) y resultados de tests físicos recientes.
- **Histórico de Lesiones Sencillo**: Modal intuitivo para introducir lesiones previas.
- **Toggle de Confidencialidad**:
  - Opción: `[🔒 Marcar como Confidencial]`.
  - Explicación explícita: *"Al marcar como confidencial, esta lesión solo será visible para los Servicios Médicos y Fisioterapia del club. No será visible para entrenadores ni otros estamentos."*

---

## 5. Partidos del Jugador y Clasificación

En `/player/matches`:
- **Resumen Individual de Partido**: Titular/Suplente, minutos jugados, goles, asistencias, tarjetas amarillas/rojas, resultado del equipo (ej: *SD Almazán 2 - 1 Numancia*).
- **Acumulados de Temporada**: Minutos totales competidos, goles marcados, titularidades, tarjetas acumuladas.
- **Tabla de Clasificación de la Liga**: Posición actual de la SD Almazán, puntos, partidos jugados, victorias, empates, derrotas y gol average.

---

## 6. Ajustes y Configuración del Perfil

Accedido desde `/player/profile`:
- **Editar Perfil**: Nombre deportivo, altura, peso, pie dominante, fotografía de perfil.
- **Cambiar Contraseña**: Formulario seguro de actualización de credenciales.
- **Preferencias de Notificación**: Toggles para Avisos por Email y WhatsApp.
