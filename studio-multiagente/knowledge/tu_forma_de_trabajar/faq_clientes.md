# FAQ clientes — TUS respuestas profesionales

## Estado

- **Pendiente:** Damián debe rellenar (o al menos empezar con las 10 más frecuentes).
- **Consumido por:** `agent_client_concierge` (futuro, sec 3.4), `agent_briefing` (para anticipar dudas y meterlas en `open_questions`).

---

## Cómo rellenar

Para cada pregunta típica de cliente, escribe TU respuesta profesional honesta. El objetivo es que el chatbot del cliente (futuro) responda con tu voz.

### Plantilla

```markdown
## FAQ

### Sobre plazos

**¿Cuánto dura una reforma integral de piso típico?**
> Respuesta de Damián: 8-10 semanas de obra efectiva + 2-4 semanas de preparación previa. Puede dilatarse por...

**¿Puedo vivir en el piso durante la obra?**
> Respuesta: ...

**¿Qué pasa si el plazo se retrasa por causas imprevistas?**
> Respuesta: ...

### Sobre presupuesto

**¿Por qué dos presupuestos pueden variar tanto por la misma obra?**
> Respuesta: Tres factores típicos...

**¿Qué entra en "imprevistos" y cuánto suelen ser?**
> Respuesta: Habitualmente 10-15% del PEM para imprevistos de obra oculta...

**¿El presupuesto incluye los impuestos?**
> Respuesta: ...

### Sobre permisos

**¿Necesito pedir licencia de obras o vale con declaración responsable?**
> Respuesta: Depende del tipo de reforma...

**¿La comunidad de vecinos puede oponerse a mi reforma?**
> Respuesta: Si afecta a elementos comunes (fachada, bajante, cubierta, patio interior), sí debe autorizarlo...

### Sobre materiales

**¿Qué calidad recomendarías dentro del presupuesto?**
> Respuesta: ...

**¿Por qué los sanitarios buenos son 2× más caros que los de gama baja?**
> Respuesta: Por durabilidad. Un inodoro Roca te dura 25 años. Uno de bazar 5...

**¿Puedo comprar yo los materiales y que vosotros solo los instaléis?**
> Respuesta: Sí, con matices...

### Sobre durante la obra

**¿Puedo cambiar de opinión durante la obra?**
> Respuesta: Sí, pero con coste adicional y posible retraso...

**¿Cómo veo el avance?**
> Respuesta: Yo visito la obra 2-3 veces por semana y te envío un resumen quincenal con fotos...

**¿Qué gremios van a entrar en mi casa?**
> Respuesta: Albañiles, electricistas, fontaneros, pintores, carpinteros, cocina. Siempre con jefe de obra que coordina...

### Sobre post-obra

**¿Qué pasa si al 6º mes aparece una humedad?**
> Respuesta: La LOE cubre 3 años en daños de habitabilidad...

**¿Quién es responsable si el suelo se agrieta al año?**
> Respuesta: El constructor y subcontratados. La LOE cubre 1 año en acabados...

**¿Debo guardar algún documento especial?**
> Respuesta: Sí: Libro del edificio, certificados eléctricos, garantías de materiales, CEE...
```

---

## Cómo usa ArquitAI

- Cuando esté construido `agent_client_concierge`, el chatbot del cliente responde con TUS palabras.
- Mientras tanto, estas respuestas las puedes usar tú directamente al comunicarte con cliente (copia y pega o adapta).

---

## Empieza con lo que tengas

No hace falta que redactes 30 preguntas de golpe. Empieza por las 5 que más te repiten los clientes y ve añadiendo cada vez que un cliente te pregunte algo nuevo.
