# Criterios de selección de gremios — TU know-how

## Estado

- **Pendiente:** Damián debe rellenar.
- **Consumido por:** `agent_trades` (ya existente), `agent_trade_comms` (futuro).

---

## Cómo rellenar

Para cada gremio que contrates habitualmente:
1. Nombre del contacto preferido (o "sin contacto fijo").
2. Criterios de selección (qué te hace elegir uno u otro).
3. Señales de alerta (por qué descartarlos).
4. Tarifa orientativa en tu zona.

### Plantilla

```markdown
## Gremios de confianza (Damián)

### Albañilería
- Contacto preferido: [nombre + teléfono + email] o "busco por proyecto"
- Criterios de selección:
  - Experiencia en pisos con forjados viejos (para reformas año 60-70)
  - Gestión limpia de escombros
  - Entrega plazo comprometido
- Señales de alerta: ...
- Tarifa orientativa: X €/día cuadrilla 2 personas

### Electricidad
- Contacto preferido: ...
- Criterios:
  - Categoría IBTE (REBT)
  - Documenta pruebas
  - Mecanismos bien instalados (estética)
- ...

### Fontanería
- ...

### Climatización
- ...

### Carpintería exterior (aluminio)
- ...

### Carpintería interior (puertas, armarios)
- ...

### Solados y alicatados
- ...

### Pintura
- ...

### Mobiliario cocina a medida
- ...

### Cristalería / mamparas
- ...

### Pladur
- ...
```

---

## Criterios transversales

```markdown
## Mis principios de elección

1. **Prefiero gremio con cierta historia**: < 5 años facturando es riesgo.
2. **Visito su última obra** antes de contratar en caso nuevo.
3. **Pido presupuesto escrito detallado**: desconfío de "te lo mando por WhatsApp".
4. **Mido la respuesta**: si tarda > 48h en responder WhatsApp en presupuesto, tardará en obra.
5. **Gremio que no quiere verme la obra diaria me da mala señal**.
6. **Siempre al menos 2 presupuestos**, incluso con gremio de confianza (para disciplina de mercado).
```

---

## Alertas rojas

```markdown
## Nunca contratar si...

- Precio muy por debajo del mercado (riesgo de que abandone la obra o use materiales de mala calidad).
- No tiene seguro de responsabilidad civil.
- Solo acepta pago en efectivo sin factura.
- Promete plazos imposibles ("en 2 semanas te dejo el baño").
- Discurso comercial excesivo ("el mejor de Madrid...").
```

---

## Cómo usa ArquitAI

- `agent_trades` (hoy) consulta estos criterios al preparar `trade_requests`.
- `agent_trade_comms` (futuro) usa los contactos para enviar presupuestos automatizados.
- `agent_anomaly_detector` (futuro) cruza precios entre tus gremios y detecta desviaciones.

Cuanto más concreto escribas aquí, mejor propone el sistema.
