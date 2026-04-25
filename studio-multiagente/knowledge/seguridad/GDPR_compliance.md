# RGPD / LOPDGDD — Cumplimiento básico de ArquitAI

## Estado

- **Migración 007** aplicada (system_config + consent_records + anonymize_client + webhook_token).
- **Última revisión**: 2026-04-25.
- **Nivel**: cumplimiento mínimo viable. Falta lo que aparece en el bloque "pendiente" más abajo.

## Marco legal

- **RGPD** (Reglamento UE 2016/679) — directamente aplicable en España.
- **LOPDGDD** (Ley Orgánica 3/2018) — desarrollo nacional del RGPD.
- **Ámbito ArquitAI**: tratamos datos personales de clientes (nombre, email, teléfono, notas de visita) y datos de proyecto que pueden contener referencias indirectas. Damián = responsable del tratamiento.

## Qué datos personales recolectamos

| Tabla | Campo | Tipo | Sensibilidad |
|---|---|---|---|
| `clients` | `name`, `email`, `phone` | Identificativos básicos | Media |
| `clients` | `notes` | Notas libres del arquitecto | Variable |
| `projects` | `location_address`, `location_city` | Domicilio (si vivienda habitual) | Media-alta |
| `projects` | `metadata.architect_intake_notes` | Observaciones de la visita | Media |
| `projects` | `metadata.architect_observations` | Estado del inmueble | Baja-media |
| `projects` | `metadata.client_stated_preferences` | Preferencias del cliente | Baja |
| `briefings` | `client_needs`, `style_preferences` | Necesidades expresadas | Baja |
| `proposals` | `total_price`, contenido | Información comercial | Media |
| `activity_log` | Trazas de operaciones | Operacional | Baja |

**No recolectamos**: categorías especiales del art. 9 RGPD (salud, religión, ideología, etc.). Si el arquitecto detecta que la reforma se hace para una vivienda adaptada por discapacidad, esa información debe registrarse de forma genérica (ej. "vivienda adaptada"), sin diagnóstico médico.

## Bases legales del tratamiento (art. 6 RGPD)

Para cada finalidad existe una base legal:

| Finalidad | Base legal |
|---|---|
| Ejecutar el encargo profesional (proyecto + dirección obra) | Ejecución de contrato (art. 6.1.b) |
| Comunicar trámites a administración pública | Cumplimiento obligación legal (art. 6.1.c) — LOE, CTE |
| Coordinar con gremios | Interés legítimo del arquitecto en cumplir el encargo (art. 6.1.f) |
| Conservar documentación tras entrega para defensa legal LOE | Interés legítimo + cumplimiento obligación legal |
| Marketing posterior, newsletter | Consentimiento expreso (art. 6.1.a) |

`consent_records` registra los consentimientos explícitos cuando aplica.

## Política de retención

| Tipo de dato | Plazo de retención | Justificación |
|---|---|---|
| Datos del cliente activo | Mientras el cliente sea activo | Ejecución contrato |
| Datos de proyecto cerrado | **10 años** tras recepción | LOE art. 18 — plazo de responsabilidad estructural |
| Briefings, design_options, costs, proposals | **10 años** | Documentación profesional / defensa LOE |
| activity_log, agent_executions | **5 años** | Auditoría operacional |
| memory_cases (con embeddings) | Indefinido si anonimizados | Mejora del servicio (legítimo interés) |
| Datos personales tras 10 años | **Anonimización obligatoria** | Principio minimización |

A los 10 años post-recepción, ejecutar:

```sql
SELECT anonymize_client(c.id)
FROM clients c
JOIN projects p ON p.client_id = c.id
WHERE p.current_phase = 'archived'
  AND p.updated_at < NOW() - INTERVAL '10 years';
```

Recomendable: cron mensual `cron_gdpr_retention` que ejecute esto automáticamente. **Pendiente de construir.**

## Derechos del interesado (art. 15-22 RGPD)

| Derecho | Cómo se ejerce hoy en ArquitAI |
|---|---|
| Acceso (art. 15) | Damián exporta los datos del cliente (manual desde Supabase) |
| Rectificación (art. 16) | Damián edita la fila en `clients` o en `projects.metadata` |
| Supresión / olvido (art. 17) | `SELECT anonymize_client('uuid'::uuid);` |
| Oposición (art. 21) | Damián marca el proyecto como `archived` y ejecuta anonimización |
| Limitación tratamiento (art. 18) | Pendiente — se puede simular pausando todos los agentes vía bandera en `system_config` |
| Portabilidad (art. 20) | Damián exporta JSON de las tablas relevantes (manual) |

**Pendiente automatizar**: workflow `util_gdpr_export(client_id)` que genere un ZIP con todos los datos del cliente.

## Cómo registrar consentimientos

Cuando el arquitecto firma un contrato/encargo con el cliente, debe registrar:

```sql
INSERT INTO consent_records (client_id, project_id, consent_type, granted, source, evidence_text)
VALUES
  ('<client_uuid>', '<project_uuid>', 'data_processing', true, 'client_signed_form',
   'Cláusula de RGPD del contrato firmado el 2026-MM-DD'),
  ('<client_uuid>', '<project_uuid>', 'marketing', false, 'client_signed_form',
   'Cliente marca NO en casilla de marketing del contrato');
```

Si solo viene del intake del arquitecto sin firma del cliente, usar `source: 'architect_intake'` y `evidence_text` con la descripción de cómo se obtuvo (ej. "verbal en visita 2026-MM-DD").

## Aviso de privacidad — texto base

Para incluir en cualquier comunicación con el cliente (email inicial, contrato, propuesta comercial). Texto sugerido:

> **Información sobre protección de datos**
>
> En cumplimiento del Reglamento (UE) 2016/679 y la LOPDGDD, le informamos:
>
> - **Responsable del tratamiento**: [Nombre del arquitecto / razón social] – [NIF] – [domicilio profesional] – [email contacto].
> - **Finalidad**: gestión del encargo profesional (proyecto y dirección de obra), comunicaciones con la administración (licencias, trámites), coordinación con gremios, conservación documental durante el plazo legal de responsabilidad (LOE, 10 años) y, en su caso, defensa ante reclamaciones.
> - **Base jurídica**: ejecución del contrato profesional, cumplimiento de obligaciones legales y, en su caso, consentimiento explícito (marketing).
> - **Destinatarios**: gremios contratados (con encargo expreso), administración pública para trámites, proveedor de cloud que aloja la herramienta de gestión (Supabase Inc., con cláusulas tipo de la UE).
> - **Plazo de conservación**: hasta 10 años tras recepción de obra (responsabilidad LOE). Posteriormente, anonimización irreversible.
> - **Derechos**: acceso, rectificación, supresión, oposición, limitación y portabilidad. Para ejercerlos: [email de contacto] aportando copia del DNI.
> - **Reclamaciones**: ante la Agencia Española de Protección de Datos ([www.aepd.es](https://www.aepd.es)).

## Pendiente para cumplimiento completo

1. **Workflow `util_gdpr_export`**: genera ZIP con datos del cliente para derecho de acceso.
2. **Cron `cron_gdpr_retention`**: anonimización automática a los 10 años.
3. **Cifrado columnas sensibles** (semáforo rojo de auditoría): `pgp_sym_encrypt` sobre `clients.email`, `clients.phone`, `briefings.client_needs`, `metadata`.
4. **Registro de actividades de tratamiento** (art. 30 RGPD): documento separado que enumere finalidades, plazos, transferencias.
5. **Análisis de impacto** (DPIA, art. 35) si se introduce vigilancia sistemática (ej. agent_site_monitor con fotos de obra). Hoy no aplica.
6. **Encargados del tratamiento**: contratos con Supabase, OpenAI, Google con cláusulas tipo. Lo gestionan ellos por defecto pero conviene documentarlo.

## Cómo reportar una incidencia de seguridad

Si Damián detecta una posible filtración (acceso no autorizado, robo de credenciales, etc.):

1. Inmediato: rotar `system_config.webhook_api_key` + revocar credenciales OAuth en Google/Gmail.
2. < 72h: notificar a la AEPD ([sede.aepd.gob.es](https://sede.aepd.gob.es)) si afecta a datos personales.
3. Notificar a clientes afectados si hay riesgo alto.
4. Documentar en activity_log con `agent_name = 'security_incident'`.

## Espacio para Damián

```
## Mis datos como responsable del tratamiento

- Nombre / razón social: ...
- NIF: ...
- Domicilio profesional: ...
- Email de contacto RGPD: ...
- DPO designado (opcional): ...
```

Cuando completes esta sección, lo integramos en el aviso de privacidad que se inyecta en cada propuesta comercial generada por `agent_proposal`.
