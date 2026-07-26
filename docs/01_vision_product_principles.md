# 01. Vision & Product Principles

Este documento establece la identidad estratégica, el propósito fundacional y los principios inmutables que guían el diseño, desarrollo y evolución de **ClubLab**. Sirve como el norte magnético para el equipo de producto, desarrollo y negocio, asegurando que cada nueva funcionalidad o línea de código respete el alma de la plataforma.

---

## 1. Identidad: ¿Qué es ClubLab?

**ClubLab** es el sistema operativo inteligente y holístico diseñado para centralizar y optimizar la gestión deportiva, analítica y administrativa de los clubes de fútbol, con especial foco en el **fútbol modesto, semi-profesional y de formación (amateur/academias)**.

No es solo una herramienta de base de datos o un anotador de entrenamientos; es un **ecosistema colaborativo híbrido** donde el cuerpo técnico, los directivos y los agentes de Inteligencia Artificial trabajan de forma cohesionada para transformar datos cotidianos en decisiones deportivas de alto impacto.

---

## 2. Propósito: ¿Por qué existe y qué problemas resuelve?

En el fútbol profesional de élite, los clubes cuentan con departamentos de Big Data, analistas de rendimiento, preparadores físicos especializados e infraestructura masiva. Sin embargo, en el fútbol modesto y formativo, la realidad es muy distinta:

*   **Fragmentación de herramientas:** Los clubes gestionan convocatorias por WhatsApp, cargas físicas en hojas de cálculo compartidas, historiales de lesiones en libretas de papel e informes de scouting en documentos dispersos.
*   **Falta de tiempo y recursos:** El cuerpo técnico suele ser reducido, multitarea y no profesionalizado a tiempo completo. No tienen tiempo para procesar datos complejos.
*   **Pérdida de patrimonio deportivo:** Cuando un entrenador o coordinador abandona el club, todo su conocimiento (metodología de entrenamiento, informes de jugadores, historial físico) se va con él, dejando al club sin memoria histórica.
*   **Inaccesibilidad de la Inteligencia Artificial:** La IA suele percibirse como algo complejo o restringido a presupuestos inalcanzables, en lugar de una ayuda práctica para el día a día.

**ClubLab existe para democratizar la tecnología de élite**, simplificando la gestión diaria del club de fútbol modesto y asegurando que su conocimiento se conserve y evolucione.

---

## 3. Visión a 10 Años

Nuestra visión a largo plazo es convertir a ClubLab en el **estándar global de gestión deportiva para el fútbol no profesional y en vías de profesionalización**. 

Queremos que cualquier club, sin importar su presupuesto, pueda operar con la eficiencia y el rigor científico de un club de primera división. Visualizamos ClubLab como un **sistema operativo holístico y conectado**, capaz de adaptarse a la tecnología disponible en cada momento (interfaces de voz, dispositivos portátiles avanzados, realidad aumentada para pizarras tácticas) y ofreciendo una interacción natural con los datos que permita obtener respuestas inmediatas y contextuales.

---

## 4. Principios de Producto

Los siguientes principios guían cada decisión de diseño de interfaz (UX), arquitectura de datos y desarrollo de características:

### I. Democratización e Intuición (Simplicidad Rigurosa)
*   **El principio:** La complejidad matemática o analítica debe quedar oculta bajo una interfaz intuitiva, limpia y rápida.
*   **En la práctica:** Menos clics para registrar la asistencia o la carga física (RPE). El software debe adaptarse al ritmo dinámico de un entrenamiento a pie de campo (apoyo en vistas optimizadas para móvil como `BottomNavBar` y accesos rápidos). Si una funcionalidad requiere un manual de usuario de 20 páginas, está mal diseñada.

### II. IA como Copiloto Adaptativo (Human-in-the-Loop)
*   **El principio:** La Inteligencia Artificial no tiene un papel estático ni restrictivo. Debe ajustarse dinámicamente a las demandas del usuario, actuando desde un simple consultor bajo demanda hasta un agente autónomo de análisis, pero **la toma de decisiones estratégica y de salud siempre permanece en el lado humano**.
*   **En la práctica:** La IA sugiere una carga semanal basada en el bienestar (`WellnessEntry`) y rendimiento (`RPEEntry`), propone ejercicios complementarios o redacta borradores de informes de scouting. Sin embargo, es el preparador físico o el entrenador quien valida, modifica y ejecuta las decisiones finales.

### III. Privacidad, Soberanía y Aprendizaje Consentido (Security & Ethics by Design)
*   **El principio:** La información deportiva, médica y contractual de un jugador es extremadamente sensible, especialmente en menores de edad. Garantizamos la soberanía del dato y la privacidad absoluta de cada tenant, al mismo tiempo que permitimos el uso de metadatos seguros para mejorar los algoritmos globales del ecosistema.
*   **En la práctica:**
    *   Aislamiento absoluto de bases de datos multi-tenant y cifrado en reposo y tránsito.
    *   Mecanismo de consentimiento explícito (`data_sharing_consent`) y posibilidad de anonimización (`anonymized_id`) del jugador.
    *   Los algoritmos globales aprenden de patrones agregados y anonimizados para optimizar modelos de prevención de lesiones o sugerencias de entrenamiento, sin revelar jamás la identidad ni los datos de un club a otro.

### IV. Centralización y Conectividad Holística (Cero Silos)
*   **El principio:** Cada dato en ClubLab debe estar conectado. Un entrenamiento planificado debe alimentar directamente el control de cargas, este a su vez debe alertar al cuerpo médico, y el rendimiento en los partidos debe nutrir el modelo de desarrollo del jugador en la academia.
*   **En la práctica:** Evitamos la duplicidad de información. Las entidades (Jugador, Sesión, Ejercicio, Lesión) están interrelacionadas a nivel relacional de manera que un insight táctico de la IA pueda correlacionarse con una molestia física del futbolista.

### V. Modularidad Incremental
*   **El principio:** Un club debe poder empezar usando ClubLab únicamente para controlar la asistencia y las convocatorias, y progresivamente activar la planificación táctica, el módulo médico o el motor de inteligencia de IA a medida que su estructura madure.
*   **En la práctica:** La arquitectura del sistema y el licenciamiento separan los módulos limpiamente, garantizando que la experiencia de usuario sea fluida tanto para el que usa el 10% de la plataforma como para el que usa el 100%.

### VI. Arquitectura Preparada para Agentes y Automatización (Agent-Ready Design)
*   **El principio:** El software y su infraestructura se diseñan con el propósito explícito de ser programables y operables por agentes de IA de forma autónoma, segura y extensible.
*   **En la práctica:** El backend expone APIs fuertemente tipadas y semánticamente claras, con validaciones robustas (Zod). Esto permite que los agentes de IA (como los que redactan informes o programan sesiones) puedan invocar herramientas de automatización de manera segura, sin comprometer la consistencia de los datos y adaptándose a las necesidades operativas de cada cuerpo técnico.

---

## 5. Lo que ClubLab NO es

Para mantener el enfoque del producto claro, es fundamental definir sus fronteras:
*   **No es una red social de entretenimiento:** No buscamos el consumo de contenido viral o la interacción social recreativa de aficionados.
*   **No es una herramienta de videojuegos:** Aunque incluye pizarras tácticas e interacciones visuales, su propósito es el análisis deportivo riguroso y aplicable en el mundo real.
*   **No sustituye al criterio profesional:** ClubLab no prescribe tratamientos médicos ni despide entrenadores; proporciona herramientas y datos fiables para que las personas tomen las mejores decisiones.
