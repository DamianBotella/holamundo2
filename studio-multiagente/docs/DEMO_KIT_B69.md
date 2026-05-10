# Kit de demo ArquitAI — B69

Para mostrar a un arquitecto/estudio real y recoger feedback antes de
continuar Fases C/D/E.

**Tiempo total: 15-20 min de demo + 15 min de feedback estructurado.**

---

## Pre-demo — checklist 5 min antes (no improvisar)

- [ ] Vite corriendo: `npm run dev` en `foxhole-ui`. Verificar que abre.
- [ ] Sesión iniciada en ArquitAI (no perder tiempo logueando delante).
- [ ] Pestaña en `Dashboard` con kanban visible.
- [ ] **Cerrar pestañas de DevTools / VSCode** durante la demo.
- [ ] Modo presentación: Ctrl+Cmd+F en Chrome (full screen) o navegador limpio.
- [ ] Tener 1 proyecto "limpio" listo para mostrar el wizard (puedes crear
      uno tipo "Reforma cocina Pintor Rosales" para que sea reconocible).
- [ ] Tener 1 proyecto con datos reales (finca san vicente) para mostrar
      los 4 cards funcionando con outputs ya generados.
- [ ] Pestaña Studio con los 36 agentes pre-cargados (que cargue rápido).
- [ ] Probar que el chat con Director funciona (5s) — si no, regenerar JWT.
- [ ] Cerrar Slack, notificaciones, todo lo que pueda interrumpir.

---

## Script de demo (5 actos, 15 min)

### Acto 1 — La promesa (1 min)

> "Esto es ArquitAI. Es el primer SaaS español que automatiza el flujo
> completo de un proyecto de reforma desde el briefing hasta la propuesta,
> con 36 agentes de IA especializados que cubren cada fase del estudio."

Mostrar Dashboard. Señalar:
- KPIs: X proyectos activos, Y propuestas pendientes, Z€ pipeline.
- Kanban por fase (intake → briefing → diseño → … → propuesta).
- "Cada tarjeta es un proyecto real, cada columna una fase del proceso."

NO mencionar: "MVP", "alpha", "early stage". Tono: producto consolidado.

---

### Acto 2 — Crear proyecto (2 min) — *muestra LA puerta de entrada*

Click "+ Nuevo proyecto".

> "Mira lo simple que es arrancar un proyecto."

Wizard 3 pasos:
1. Cliente: nombre + email + tel
2. Reforma: tipo + dirección + m² + presupuesto
3. Notas del arquitecto: pegar 4-5 líneas reales (ej. "Cliente quiere
   abrir cocina al salón. Edificio 1965, posibles tabiques de carga.
   Comprueba REBT y CTE DB-HE en cubierta")

Click Crear → redirige a ProjectDetail.

> "En 30 segundos hemos arrancado el proyecto. La IA ya está procesando
> el briefing en background."

---

### Acto 3 — Los 4 killer features (6 min) — *EL CORE comercial*

Volver a Dashboard → click en finca san vicente (o el proyecto demo).

Bajar al panel "Trámites y subvenciones (Fase B)".

> "Aquí es donde ArquitAI es único en el mercado. 4 agentes que ningún
> competidor cubre todos juntos."

#### 3.1 Subvenciones (2 min — más impactante)

Card "Subvenciones" → señalar el ahorro acumulable estimado.

> "Para este proyecto de 28.000€ hemos identificado 33.600€ acumulables
> en 3 subvenciones Next Gen. Con deadline 30/06/2026. El cliente reduce
> su coste real un 80% en algunos casos."

Mostrar las recomendaciones (Programa 3, Programa 1, Programa 5).

> "Cada recomendación viene con citation_source de la normativa oficial
> y un nivel de confianza. Si es bajo, te dice 'verificar manualmente'.
> Nunca inventa subvenciones."

Click "Re-ejecutar" en vivo (15s — usa el silencio para seguir hablando):

> "Mientras se actualiza, déjame contarte por qué esto importa: el
> Programa 3 cierra en pocas semanas. Si tú no lo metes, el cliente no
> se entera y pierde 16.000€."

#### 3.2 Estudio Residuos RCD (1 min)

Card "Estudio Residuos (RCD)".

> "Esto es obligatorio por ley para sacar la licencia. Construbit lo
> cobra 280€ al año, ArquitAI lo genera en 15 segundos."

Señalar 13.5 Tn + 1.240€ coste gestión + alertas peligrosos.

> "Si fuera un edificio de antes de 2002 con demolición, te alertaría
> automáticamente del amianto. Nunca se te olvida."

#### 3.3 IEE — Informe Evaluación Edificios (1 min)

Card "Informe Evaluacion Edificios" → calificación **C** grande.

> "Para edificios > 50 años en grandes municipios es obligatorio. El
> mercado español genera cientos de miles al año, a 250-1000€ cada uno.
> ArquitAI lo redacta automáticamente con la calificación A-G y las
> recomendaciones priorizadas."

#### 3.4 Tramitación sede electrónica (1 min)

Card "Expediente sede electrónica" → INCOMPLETO.

> "Este agente prepara el ZIP listo para subir a la sede del ayuntamiento.
> Lee todos los entregables (RCD, IEE, planos, memoria) y te dice qué
> falta y qué está listo. Cuando todo está OK, te genera el ZIP firmable.
> **El técnico siempre firma y sube** — ArquitAI nunca auto-presenta.
> Cumplimiento legal completo."

Cambiar municipio (Madrid → Barcelona) + tipo trámite → click Preparar.

> "Top 5 municipios cubiertos. Madrid, Barcelona, Valencia, Sevilla,
> Bilbao. Más en pipeline."

---

### Acto 4 — Studio iso + Chat agentes (3 min) — *el WOW visual*

Click "Estudio" arriba.

> "Esta es la vista del estudio. Cada habitación es un área del trabajo
> profesional. Cada personaje es un agente especializado."

Mover puntero por las habitaciones, señalar:
- Recepción → cliente entra
- Mesa de dibujo → delineante + croquista
- Biblioteca normativa → técnico CTE + accesibilidad
- Despacho contable → contable + tracker financiero
- Sala reuniones → comercial + jurídico
- Taller gremios → jefe de obra + materiales
- Terraza → inspector obra + tramitador
- Archivo → archivista + documentalista + certificador
- Corredor urgencias → 6 agentes pre-launch (IEE, RCD, subvenciones, etc.)

Click en Director (centro):

> "Y puedes hablar directamente con cualquier agente. Le pregunto al
> Director qué hay que hacer en este proyecto."

Escribir en chat: "Resumen del proyecto y siguientes pasos".

Esperar respuesta (~5s). Leerla en voz alta.

> "El chat persiste en BD. Si vuelvo mañana, sigue donde lo dejé."

---

### Acto 5 — Cierre técnico (3 min) — *para el comprador exigente*

> "Tres cosas que le importan a un CTO o a un técnico:
>
> 1. **Multi-tenant con RLS**: cada estudio ve solo sus datos. Postgres
>    Row Level Security a nivel de fila. Auditoría legal completa.
>
> 2. **GDPR desde el primer commit**: región Frankfurt. PII redactada
>    antes de enviar a APIs externas. Borrado on-demand.
>
> 3. **EU AI Act riesgo limitado**: cada output del agente está marcado
>    como 'asistencia profesional supervisada por técnico colegiado'.
>    El técnico SIEMPRE firma. ArquitAI propone, no decide ni presenta.
>
> Eso significa: vendible legalmente en España y UE desde día uno."

---

## Preguntas que QUIERES extraer (15 min post-demo)

**Bloque 1 — Encaje (5 min)**

1. ¿En qué parte de tu flujo actual encajaría esto?
2. ¿Qué herramienta o proceso reemplazaría?
3. ¿Cuánto tiempo te ahorra hoy (estimación)?
4. ¿Qué te falta para usarlo en producción mañana?

**Bloque 2 — Pricing (5 min) — CLAVE**

5. ¿Cuánto pagarías al mes por esto si fuera tu única herramienta?
6. ¿Y si fuera un complemento a CYPE o Presto que tienes ya?
7. ¿Pagarías por proyecto en vez de por mes? ¿A cuánto?
8. ¿Quién decide la compra en tu estudio: tú, un socio, el director?

**Bloque 3 — Feature gap (5 min)**

9. De las 4 cards (Subvenciones, RCD, IEE, Tramitación) — ¿cuál usarías
   más? ¿Cuál menos?
10. ¿Qué falta CRÍTICO para que firmes mañana?
11. ¿Qué te incomoda o desconfías?
12. ¿Qué le falta al chat con agentes?

---

## Lo que NO debes mostrar / decir

- "Está en alpha", "es un MVP", "todavía falta..." — vendes producto, no proyecto.
- VS Code, terminal, código, n8n internals.
- DevTools.
- Errores técnicos (si algo falla, sigue. No abras consola).
- Fase C/D/E del roadmap (no necesita saber lo que NO tienes aún).
- Precios concretos antes del bloque 2 (déjale anchar primero).
- "Esto lo construyó una IA" — vendes, no documentas.

---

## Lo que SÍ debes capturar (en vivo, durante feedback)

Toma 3 columnas en una hoja:

```
QUÉ AMÓ            QUÉ DUDÓ           QUÉ PIDIÓ
-------------      -------------      -------------
ej. ahorro grants  ej. confianza GDPR ej. integración CYPE
ej. UI iso studio  ej. precio mes     ej. más municipios
```

Lo importante NO es lo que diga, es lo que **repita 3 veces** o
lo que **le brille los ojos**.

---

## Post-demo — siguiente acción

Después de la conversación con el cliente, abre nuevo chat conmigo y
pega tus 3 columnas (qué amó / dudó / pidió). En base a eso decidimos
B70: si vamos a Fase C (catálogo) o pivotamos a algo que el cliente
priorice (ej. integración CYPE, más municipios, otra cosa).

Suerte.
