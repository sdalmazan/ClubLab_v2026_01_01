# 13. ClubLab Consent Management Specification & Legal UX

Este documento especifica la **arquitectura técnica, modelo de datos y diseño de experiencia de usuario (Legal UX)** para la gestión transparente de consentimientos, avisos de privacidad y autorizaciones para menores de edad en ClubLab.

---

## 1. Inventario de Consentimientos y Bases Jurídicas

ClubLab requiere diferenciar claramente los mecanismos legales de aceptación:

| Tipo de Aceptación | Ámbito | Mecanismo | ¿Es Obligatorio? | ¿Revocable? |
| :--- | :--- | :--- | :--- | :--- |
| **Términos de Servicio (ToS)** | Condiciones de uso del SaaS | Clickwrap al registrarse | Sí | No (cancelación de cuenta) |
| **Aviso de Privacidad** | Información sobre tratamiento de datos | Checkbox de lectura obligatoria | Sí | No (informativo) |
| **Consentimiento Datos de Salud (Art. 9.2.a)** | Wellness, RPE, lesiones y datos físicos | Switch explícito e informado | **Sí (para módulos de rendimiento/salud)** | **Sí (en Privacy Center)** |
| **Consentimiento Tutor Legal (Menores <14/16 años)** | Tratamiento de datos de menores de edad | Verificación por token de tutor | **Sí (en academias/fútbol base)** | **Sí** |
| **Consentimiento Copiloto IA** | Análisis de patrones mediante LLM | Switch en onboarding / ajustes | Opcional | **Sí** |

---

## 2. Flujo de Consentimiento Parental para Menores de Edad (Academias)

En virtud del **Art. 8 RGPD** y el **Art. 7 LOPDGDD (España)**, el tratamiento de datos de menores de 14 años requiere el consentimiento verificado del titular de la patria potestad o tutela:

```
[Onboarding Jugador Menor] 
         │
         ▼
¿Edad < 14 años? ──Sí──► Desencadena Estado: `pending_parental_consent`
         │                     │
        No                     ▼
         │             Envío de Email/SMS al Tutor registrado
         │                     │
         │                     ▼
         │             El Tutor accede a Pantalla Web Dedicada:
         │             - Información clara de datos recogidos (Salud/Deportivos)
         │             - Botón de Aceptación con Firma Digital / Checkbox auditable
         │                     │
         │                     ▼
         └─────────────► Actualiza `players.data_sharing_consent = true`
                         E Inserta registro auditable en `user_data_consents`
```

---

## 3. Modelo de Datos Extendido (`user_data_consents`)

La tabla de auditoría en PostgreSQL (`user_data_consents`) registra con precisión cada acción:

```sql
CREATE TABLE IF NOT EXISTS public.user_data_consents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    consent_type TEXT NOT NULL, -- 'health_data_tracking', 'performance_analytics', 'ai_copilot', 'parental_authorization'
    version TEXT NOT NULL,      -- e.g. 'v1.2'
    accepted BOOLEAN NOT NULL,
    accepted_at TIMESTAMPTZ,
    withdrawn_at TIMESTAMPTZ,
    parent_guardian_email TEXT, -- Si aplica para menores
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. Diseño de UX Legal (Privacy UI / Legal UX)

ClubLab rechaza los textos legales oscuros e incomprensibles. La interfaz de privacidad se basa en la pirámide:

$$\text{Transparencia} \longrightarrow \text{Comprensión} \longrightarrow \text{Control} \longrightarrow \text{Consentimiento Informed}$$

### 4.1. Privacy Center (`/player/profile/privacy`)

La pantalla del jugador incluye tarjetas interactivas de control:

1. **Tarjeta 1: Datos de Rendimiento & Wellness**
   - *Explicación visual*: "Permite a tu preparador físico ajustar tu carga de entrenamiento según tu nivel diario de fatiga y calidad de sueño."
   - *Control*: Toggle Switch [ Activado / Desactivado ].

2. **Tarjeta 2: Seguimiento Fisioterapéutico y Lesiones**
   - *Explicación visual*: "Permite al servicio médico registrar tus lesiones y diseñar tu plan de readaptación. Las notas clínicas son confidenciales."
   - *Control*: Toggle Switch [ Activado / Desactivado ].

3. **Tarjeta 3: Asistente Copiloto IA**
   - *Explicación visual*: "Analiza tus métricas anonimizadas para sugerirte recomendaciones personalizadas de recuperación."
   - *Control*: Toggle Switch [ Activado / Desactivado ].

4. **Zona de Portabilidad y Derechos**
   - Botón primary: `[ 📥 Descargar Todos Mis Datos (JSON/CSV) ]`
   - Botón danger: `[ ⚠️ Solicitar Eliminación de Mi Cuenta y Olvido ]`

---

## 5. Protocolo ante Retirada del Consentimiento

Si un jugador revoca su consentimiento para datos de salud (`health_data_tracking = false`):
1. **Impacto Técnico en BD**: Se desactiva la recogida en formularios de Wellness y RPE. Los datos históricos permanecen bloqueados sin ser utilizados para nuevas inferencias de IA.
2. **Notificación al Staff**: El preparador físico verá el estado *"Consentimiento de Carga No Otorgado"* sin bloquear la participación deportiva general del jugador salvo que el club exija dicho dato por política interna.
