# Honorarios profesionales — Arquitecto técnico en reforma

## Estado

- **Mantiene:** Claude (base orientativa del COAAT / COAM) + Damián (tarifas reales)
- **Última revisión:** 2026-04-24
- **Nota:** desde 2008 los honorarios profesionales en España son **libres**. Lo que sigue son orientaciones de mercado 2024-2026, no tarifas oficiales.

## Servicios típicos del arquitecto técnico en reforma de vivienda

| Servicio | Base de cálculo | Orientación de mercado |
|---|---|---|
| Proyecto + dirección de obra completa | % sobre PEM | 5-10% PEM (según complejidad y tamaño) |
| Solo proyecto | % sobre PEM | 3-5% PEM |
| Solo dirección de obra (DO + DEO) | % sobre PEM | 3-5% PEM |
| Coordinación Seguridad y Salud (CSS) | Fijo o % sobre PEM | 300-600 € o 1-1.5% PEM |
| Redacción EBSS / PSS | Fijo | 200-400 € |
| Certificado final de obra | Fijo | 200-500 € |
| Informe pericial / estudio de patología | Fijo o por horas | 400-1200 € según complejidad |
| Declaración Responsable (trámite simple) | Fijo | 300-600 € |
| Licencia de obras (proyecto básico + ejecución) | % sobre PEM | 4-8% PEM |
| Certificado energético (CEE) | Fijo | 150-350 € |

## Criterios que justifican subir el % (arquitecto senior)

- Proyecto con intervención estructural (apertura muro portante, apeo).
- Proyecto con cambio de uso (local → vivienda).
- Vivienda protegida de patrimonio (mayor complejidad administrativa).
- Cliente con alto nivel de exigencia estética / plazos.
- Obra en finca con administrador difícil o comunidad conflictiva.

## Criterios que justifican bajar el % (comodidad)

- Cliente recurrente.
- Proyecto simple sin estructura ni cambio de uso.
- Gremios habituales (menor tiempo de coordinación).
- Reforma estándar (no hay dilemas técnicos).

## Presupuesto Orientativo — reforma integral 70-90 m² en Madrid 2025

Sobre un PEM típico de 40.000 - 60.000 €:

| Concepto | % | Importe estimado |
|---|---|---|
| Proyecto técnico (si visado) | 3-4% | 1.200 - 2.400 € |
| Dirección de obra (DO + DEO) | 3-5% | 1.500 - 3.000 € |
| CSS + EBSS | 1.5% | 600 - 900 € |
| Certificado final | Fijo | 200 - 400 € |
| **TOTAL honorarios arquitecto técnico** | **7-10%** | **3.500 - 6.700 €** |

## Facturación

- IVA 21% (arquitecto técnico profesional autónomo).
- Retención IRPF 15% si cliente es empresa o autónomo (7% en primeros 3 años de alta).
- Pagos parciales: habitual 30% a inicio, 30% a mitad, 40% a final (o por hitos del proyecto).

## Forma de presentar al cliente

En la propuesta comercial del cliente (la redacta `agent_proposal`), separar claramente:

1. **Honorarios profesionales** (arquitecto técnico + cualquier técnico subcontrato).
2. **PEM (Presupuesto de Ejecución Material)** — coste de gremios + materiales.
3. **Impuestos sobre PEM** (IVA 21% en España para reformas).
4. **Tasas municipales** — licencia o declaración responsable.

Cliente percibe con claridad qué es trabajo profesional vs materiales vs impuestos.

## Cláusulas contractuales frecuentes

- **Modificaciones**: cada cambio solicitado por cliente que afecte al proyecto se factura aparte (1-3% del incremento de PEM).
- **Dilaciones**: si la obra se dilata por causa no imputable al arquitecto > 15% del plazo previsto, honorarios de dirección aumentan proporcionalmente.
- **Terminación anticipada**: si el cliente desiste sin causa imputable al arquitecto, honorarios devengados hasta la fecha + 20% de los pendientes.
- **Seguro RC profesional**: responsabilidad hasta límite del seguro; daños superiores no cubiertos sin mutualidad.

## Visado del COAAT (o COAM)

El visado es:
- **Obligatorio** en: proyectos con presupuesto > umbral (depende de CCAA), cambios de uso, obra nueva, obras que requieran licencia plena.
- **Recomendable** en: reformas significativas (prueba de diligencia profesional ante posibles reclamaciones).
- **Opcional** en: declaraciones responsables, proyectos pequeños.

Coste del visado: 0.3-0.5% sobre PEM del proyecto visado.

## Tarifas COAAT Madrid (referencia)

El COAAT de Madrid publica anualmente sus tarifas orientativas. Esta guía es ORIENTATIVA y se deben verificar cada año:

- [coaatm.es](https://www.coaatm.es) — colegio profesional de aparejadores y arquitectos técnicos de Madrid.

## Cómo usa ArquitAI estos datos

- `agent_proposal` incluye en la propuesta comercial los honorarios separados, calculados sobre el PEM generado por `agent_costs`.
- El cliente ve una propuesta "transparente": honorarios + PEM + impuestos = precio total.

## Espacio para tus tarifas reales

Damián, rellena aquí lo que facturas:

```
## Mis tarifas reales

- Proyecto + DO + DEO + CSS reforma integral piso: 7% PEM, mínimo 2500 € + IVA.
- Solo proyecto: 3% PEM, mínimo 1200 € + IVA.
- EBSS simple: 250 € + IVA.
- CEE: 200 € + IVA.
- ...
```

Cuando tengas esto concreto, `agent_proposal` generará propuestas con tus números, no con los orientativos de mercado.
