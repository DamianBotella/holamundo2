# Impuestos y tasas — Reforma de vivienda en España

## Estado

- **Mantiene:** Claude (base general) + Damián (comunidad autónoma y municipios específicos)
- **Última revisión:** 2026-04-24

## IVA en reforma de vivienda

### Tipo impositivo aplicable

| Escenario | IVA | Requisitos |
|---|---|---|
| Reforma de vivienda habitual antigua (> 2 años) | **10%** | El cliente usa la vivienda como habitual + construcción > 2 años + mano de obra + materiales ≤ 40% del coste total |
| Reforma de local → vivienda | **21%** | Se considera obra nueva / cambio de uso |
| Reforma de local comercial | **21%** | Local de uso no residencial |
| Reforma de vivienda nueva (< 2 años) | **21%** | No aplica el 10% reducido |

**Requisitos para IVA 10% (art. 91 LIVA + consultas Dirección General Tributos):**

1. El destinatario debe ser **persona física no sujeto pasivo de IVA** y **propietario de la vivienda**.
2. La vivienda debe ser **habitual** (no segunda residencia, no alquiler turístico).
3. La vivienda debe ser **antigua** (construcción terminada hace **> 2 años**).
4. **Materiales aportados por empresa** ≤ 40% del total facturado. El resto debe ser **mano de obra**. Si los materiales superan 40%, se factura al 21%.

**Cómo se acredita (habitual en la práctica)**:
- Cliente firma una declaración responsable de que la vivienda es habitual y antigua.
- Empresa constructora la archiva como justificante.

### Caso típico reforma integral piso 70-90 m² habitual > 2 años

- Mano de obra: 60-65% del total.
- Materiales: 35-40% del total.
- Cumple criterio 40% mano de obra → IVA 10%.

### Caso que tributaria al 21%

- Compra importante de electrodomésticos y materiales de alta gama que desequilibran la ratio.
- Reforma que sustituye estructura (cambio de uso).
- Vivienda de menos de 2 años.

**Consejo comercial**: acordar con el cliente qué parte del material la compra él directamente (sin IVA intermedio) para mantener la ratio favorable. Ej. sanitarios y grifería los compra el cliente, la mano de obra va al 10%.

## IRPF — Retenciones al arquitecto técnico

Si el cliente es **empresa o autónomo**: retención **15%** del IRPF en factura profesional (7% si el arquitecto está en los primeros 3 años de alta).

Si el cliente es **persona física consumidor final**: **sin retención**. La factura es al total + IVA 21% (la del arquitecto, no la de la reforma).

## Licencia de obras / Declaración Responsable — Tasas municipales

### Distinción

| Tipo | Cuándo aplica | Trámite |
|---|---|---|
| **Declaración Responsable** | Reforma sin afección estructural ni cambio de uso | Comunicación previa, el cliente puede comenzar en ~15 días o cuando venza plazo |
| **Licencia de obras** | Obra mayor: cambio de uso, estructural, ampliación, obra nueva | Tramitación completa, puede tardar 2-6 meses |

**En reforma típica de vivienda no estructural**: Declaración Responsable.

### Tasas municipales (orientativo Madrid)

Se calculan como % sobre el **PEM** (Presupuesto de Ejecución Material):

| Tipo | Madrid | Rango habitual España |
|---|---|---|
| ICIO (Impuesto sobre Construcciones, Instalaciones y Obras) | 4% PEM | 2-4% |
| Tasa por licencia urbanística | 0.8-1.5% PEM | 0.5-2% |
| Ocupación vía pública (si se pone andamio o contenedor) | Tarifa por m² y día | 1-3 € m²/día |

**Ejemplo**: PEM 50.000 € en Madrid →
- ICIO: 50.000 × 4% = 2.000 €
- Tasa licencia: ~500 €
- Total aprox: ~2.500 € en impuestos municipales.

Cliente debe saber esto antes de firmar.

### Cómo consultar en cada municipio

- [sede.madrid.es](https://sede.madrid.es) — Ayuntamiento de Madrid.
- Página web municipal → Urbanismo / Obras → Tasas y tarifas vigentes.

## Colegio profesional — Visado

Coste del visado del COAAT (o COAM si es arquitecto superior):

- **0.3-0.5% sobre PEM** del proyecto visado (orientativo 2025).
- Tarifa mínima por visado: ~50-100 €.

**Cuándo visar**:
- Obligatorio: obra con licencia plena.
- Recomendable: cualquier proyecto con responsabilidad técnica significativa (es prueba de diligencia ante reclamaciones LOE).
- No necesario: declaraciones responsables muy simples (pero sigue siendo recomendable).

## Seguros

### Seguro de Responsabilidad Civil Profesional

- **Obligatorio** para arquitectos técnicos en ejercicio (art. 19 LOE para algunos servicios, más el exigido por los colegios profesionales).
- Cobertura mínima recomendada: **600.000 €** por siniestro.
- Coste orientativo: 200-500 €/año.

### Seguro Decenal de Daños Materiales

- **Obligatorio** en obra nueva de vivienda (art. 19 LOE).
- **NO obligatorio** en reforma de vivienda existente.
- Coste orientativo: 1-3% sobre PEM para obra nueva.

## Certificado energético (CEE)

- **Obligatorio** para alquilar o vender vivienda (RD 390/2021).
- **En reforma** se recomienda emitir nuevo CEE al finalizar (mejora la calificación si se mejoró aislamiento/ventanas).
- Coste emisión: 150-350 €.
- Tasa de registro en comunidad autónoma (Madrid: 30-50 €).

## Certificación de la calidad del aire interior

No obligatoria en vivienda en España (sí en edificios públicos). Recomendable en reformas con sospecha de problemas de ventilación.

## Resumen de "todo lo que paga el cliente" en reforma integral 70-90 m² Madrid

Orientativo sobre un PEM de 50.000 €:

| Concepto | Importe |
|---|---|
| PEM (materiales + mano de obra) | 50.000 € |
| IVA sobre PEM (10% si vivienda habitual > 2 años) | 5.000 € |
| Honorarios arquitecto técnico (~7-10% PEM) | 3.500 - 5.000 € |
| IVA honorarios (21%) | 735 - 1.050 € |
| ICIO (4% PEM) | 2.000 € |
| Tasa licencia | 500 € |
| Visado proyecto (si aplica) | 200-300 € |
| Certificado energético final | 200 € |
| **Total cliente** | **~62.135 - 64.050 €** |

**Importante para la propuesta comercial**: el cliente suele ver solo el PEM y se sorprende al final con los impuestos. `agent_proposal` debe listar TODO para que no haya sorpresas.

## Escenarios de optimización fiscal

1. **Reforma parcial escalonada** (en varios ejercicios): puede convenir desde el punto de vista de caja del cliente, pero complica la planificación.
2. **Compra directa de ciertos materiales por el cliente**: mantiene la ratio materiales/mano de obra favorable para IVA 10% en el resto.
3. **Deducción por rehabilitación eficiencia energética** (a partir de 2021): 20-60% del gasto en mejora energética es deducible de la declaración de la renta del cliente. Requisitos: certificado energético antes/después con mejora demostrada.

## Cómo usa ArquitAI

- `agent_costs` y `agent_proposal` desglosan PEM + IVA + tasas + honorarios para que el cliente vea el total real.
- `agent_regulatory` sugiere si requiere licencia o declaración responsable.
- `agent_client_concierge` (futuro) responde preguntas del cliente sobre impuestos citando este archivo.

## Espacio para notas específicas

Damián, aquí escribe para tu comunidad y municipios:

```
## Mis municipios habituales

### Madrid (ciudad)
- ICIO: 4%
- Tasa licencia: ~1%
- Sede trámite: sede.madrid.es

### Alcobendas
- ICIO: 3.5%
- ...

### Ayuntamiento pueblo X
- ...
```
