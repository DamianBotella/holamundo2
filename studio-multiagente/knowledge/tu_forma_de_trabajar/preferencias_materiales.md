# Preferencias de materiales — TU criterio profesional

## Estado

- **Pendiente:** Damián debe rellenar con sus reglas personales.
- **Consumido por:** `agent_materials`, `agent_design` (para no proponer lo que tú no usarías).

---

## Cómo rellenar

Escribe tus reglas de "**siempre**" y "**nunca**" por categoría. Media página basta. Cuanto más específico, mejor: incluye marca/modelo cuando aplique.

### Plantilla

```markdown
## Mis reglas de oro

### Pavimentos
- SIEMPRE: porcelánico en baño (clase 2 mínimo).
- NUNCA: parquet macizo sobre suelo radiante.
- PREFIERO: porcelánico rectificado 60x60 en zonas comunes.

### Carpintería exterior
- SIEMPRE: aluminio RPT + vidrio 4+16+4 low-e mínimo.
- NUNCA: PVC (prefiero estética aluminio).
- MARCA PREFERIDA: Técnal / Cortizo.

### Grifería
- SIEMPRE: monomando, nunca bimando.
- MARCA PREFERIDA: Grohe Concetto (gama media) / Tres (gama económica).
- NUNCA: marcas de origen chino sin garantía (problemas a los 2-3 años).

### Sanitarios
- PREFIERO: Roca para inodoros estándar.
- EN BAÑO PEQUEÑO: sanitarios suspendidos (aprovechan espacio).
- NUNCA: cisternas empotradas de marcas no reconocidas (repuestos imposibles).

### Pintura
- SIEMPRE: pintura plástica lisa en vivienda (mate o sedosa según zona).
- MARCA PREFERIDA: Titanlux / Bruguer.
- EN BAÑO: antihumedad obligatorio.

### Cocina (mobiliario)
- MARCAS DE CONFIANZA: Santos, Dica (gama alta); IKEA Metod (gama media ajustada).
- ENCIMERA: Silestone para uso diario. Dekton si cliente premium.

### Electricidad - mecanismos
- PREFIERO: Simon 82 (gama media) blanco.
- GAMA ALTA: Jung LS 990 o Niko Pure.

### Climatización
- CALDERA PREFERIDA: Saunier Duval (condensación) o Viessmann.
- AIRE ACONDICIONADO: Mitsubishi MSZ (gama doméstica) o Daikin Perfera.
- NUNCA: marcas de bazar sin servicio técnico local.

### Aislamiento
- SIEMPRE: lana mineral en trasdosados.
- EN FACHADA: SATE con EPS o lana mineral según necesidad.

### Materiales a evitar
- PVC en carpintería exterior (estética pobre, mi criterio).
- Porcelánico efecto mármol ultra pulido en zonas de paso (resbala).
- ...
```

---

## Por qué esto vale oro

Cuando `agent_materials` genera una propuesta para un cliente, ahora mismo usa el conocimiento general. Cuando tenga TUS reglas:

- Va a proponer Roca automáticamente para inodoros sin que tú tengas que filtrar.
- Evitará combinaciones que a ti no te gustan.
- El cliente recibe una propuesta **coherente con tu estilo profesional**, no una mezcla genérica.

Esto multiplica la sensación de "el arquitecto me conoce" y reduce tu tiempo de revisión de propuestas.

---

## Cómo versionamos

Este archivo crece con el tiempo. Cuando tengas un nuevo criterio tras un proyecto, lo añades aquí. Los agentes lo usan automáticamente en el siguiente proyecto.

Cuando lo actualices, me avisas y lo inyecto en el prompt del agente relevante.
