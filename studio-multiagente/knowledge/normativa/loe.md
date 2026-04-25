# LOE — Ley de Ordenación de la Edificación

## Estado

- **Mantiene:** Claude
- **Fuente oficial:** Ley 38/1999, de 5 de noviembre, con modificaciones.
- **Última revisión:** 2026-04-24

## Qué regula

Marco legal de la edificación en España: agentes intervinientes, responsabilidades y garantías.

## Agentes de la edificación (art. 8-16)

| Agente | Responsabilidad principal |
|---|---|
| **Promotor** | Contratar al resto de agentes, garantizar las garantías LOE, obtener licencias |
| **Proyectista** | Redactar el proyecto técnico con su titulación profesional |
| **Constructor** | Ejecutar la obra según proyecto y buenas prácticas |
| **Director de Obra (DO)** | Dirigir el desarrollo de la obra en aspectos técnicos, estéticos, urbanísticos y medioambientales |
| **Director de Ejecución de la Obra (DEO)** | Dirigir la ejecución material, controlar cualitativa y cuantitativamente |
| **Coordinador de Seguridad y Salud (CSS)** | RD 1627/1997 — coordinar la seguridad en obra |
| **Entidades/laboratorios de control técnico** | Emitir informes a petición del promotor |
| **Suministradores de productos** | Certificar conformidad CE, cumplimiento normativa |
| **Propietarios / usuarios** | Mantener la edificación, uso conforme |

**Nota en reformas**: la figura del **arquitecto técnico** asume habitualmente DEO + CSS en reformas de vivienda. En proyectos que requieren visado completo, el arquitecto superior suele asumir DO.

## Garantías obligatorias (art. 19)

La LOE impone tres tipos de garantía al promotor desde la recepción de la obra:

| Tipo | Plazo | Cubre | Quién responde |
|---|---|---|---|
| **Daños materiales** de acabados o terminación | **1 año** | Defectos o daños que afecten a la terminación o acabado (pintura, solados, carpintería...) | Constructor (pone cara — suele ser subcontrata del arquitecto técnico) |
| **Daños materiales** que afectan a la habitabilidad | **3 años** | Incumplimientos de los requisitos de habitabilidad (aislamiento, humedad, instalaciones, etc.) | Constructor + Director de Ejecución + Suministradores |
| **Daños materiales** que afectan a la estabilidad del edificio | **10 años** | Vicios o defectos que afecten a la resistencia mecánica y estabilidad | Proyectista + Director de Obra + Constructor + Suministradores |

**Cómputo del plazo:** desde la fecha de recepción de la obra sin reservas o desde la subsanación de las reservas.

**Acción legal:** 2 años para exigir responsabilidad una vez detectado el daño (art. 18).

## Seguros obligatorios (art. 19.1.c)

Aplicable a **obras de nueva construcción** con carácter principal de vivienda:

- Seguro decenal de daños materiales (10 años, estabilidad) — **obligatorio**.
- Seguro trienal — puede sustituirse por garantía equivalente.
- Seguro anual — habitualmente sustituido por retención del 5% del PEM al constructor.

**En reforma de vivienda existente**: el seguro decenal NO aplica salvo que se trate de rehabilitación integral asimilable a obra nueva. Las responsabilidades sí aplican, pero el seguro obligatorio no.

## Proyecto técnico (art. 4)

Requisitos del proyecto arquitectónico:

1. **Proyecto básico**: memoria descriptiva, normativa aplicable, cumplimiento del CTE, presupuesto aproximado. **Es el documento que acompaña la solicitud de licencia**.
2. **Proyecto de ejecución**: desarrollo completo del proyecto básico con detalles constructivos, pliegos, mediciones, presupuesto detallado, estudio de seguridad y salud. **Es obligatorio antes de comenzar la ejecución material**.

**En reforma**: muchos ayuntamientos admiten **Declaración Responsable** para reformas no estructurales en lugar de proyecto básico + licencia. Esto depende de cada ordenanza municipal.

## Libro del Edificio (art. 7)

El promotor debe entregar al propietario:
- Proyecto (básico + ejecución) con final de obra
- Acta de recepción
- Relación de agentes intervinientes
- Instrucciones de uso y mantenimiento
- Resumen de garantías

**En reforma**: el Libro del Edificio original se actualiza con la intervención. Si el edificio no tiene Libro (común en edificios previos a 1999), el arquitecto técnico debería redactarlo para reformas significativas.

## Recepción de la obra (art. 6)

Acto formal por el que el promotor recibe la obra terminada del constructor. Dos escenarios:

- **Recepción sin reservas**: promotor acepta → empieza cómputo de plazos de garantía.
- **Recepción con reservas**: promotor acepta con defectos identificados que constructor se compromete a subsanar → plazos empiezan al subsanar.

**Rechazo de recepción**: si los defectos son graves e impiden el uso, promotor puede rechazar recepción y el plazo de garantía no empieza.

## Responsabilidades en reforma típica (arquitecto técnico redactor + DEO)

| Problema aparecido | Plazo | Responsable según LOE |
|---|---|---|
| Baldosa suelta al 8º mes | 1 año | Constructor (y el subcontratado de solados) |
| Humedad en baño al 2º año | 3 años | Constructor + DEO (control de ejecución de la estanqueidad) + Suministrador (material) |
| Fisura estructural al 7º año | 10 años | Proyectista + DO + Constructor |

Nota: incluso si el proyectista/DEO cumplió con diligencia profesional, puede ser llamado responsable solidario en los plazos correspondientes. **Tener seguro de RC profesional es imprescindible**.

## Documentos a incluir en cada proyecto (buenas prácticas)

El arquitecto técnico debe conservar:
- Proyecto visado por el colegio profesional (COAM, COAAT, etc.)
- Designación formal de DEO y CSS (firmadas).
- Actas de visitas de obra (firmadas por él y jefe de obra).
- Certificado final de obra.
- Informes de cualquier incidencia.
- Justificaciones técnicas de cualquier desviación del proyecto.

Estos documentos son la prueba de diligencia profesional ante reclamaciones dentro de los plazos LOE.

## Cómo usa ArquitAI la LOE

- **agent_proposal** redacta la propuesta comercial citando plazos de garantía aplicables.
- **agent_contracts** (futuro) genera documentación con cláusulas LOE.
- **agent_aftercare** (futuro) gestiona incidencias post-entrega clasificándolas según el plazo LOE que aplique.
- **agent_safety_plan** (futuro) coordina con la designación de CSS (LOE art. 13 + RD 1627/1997).

## Referencias útiles

- [BOE — Ley 38/1999](https://www.boe.es/buscar/act.php?id=BOE-A-1999-21567)
- Colegios profesionales: COAM, COAAT-Madrid publican notas aclaratorias sobre responsabilidades.
