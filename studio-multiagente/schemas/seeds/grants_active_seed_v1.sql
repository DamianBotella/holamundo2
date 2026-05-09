-- ============================================================
-- SEED grants_active v1 — 10 subvenciones espanolas reales activas
-- Fase B.1 plan Opus / B63 agent_grants_finder
-- ============================================================
-- Datos verificables a 2026-05 segun fuentes oficiales (citation_source).
-- normativa_confidence 0.6 -> dato verificable manualmente, fechas y % pueden cambiar.
-- normativa_confidence 0.85 -> texto legal RD/Ley estable.
-- El cron grants_refresh_cron actualizara estos datos cuando Damian lo active.
-- Idempotente: ON CONFLICT (nombre, organismo) preserva manuales editados despues.
-- ============================================================

INSERT INTO grants_active (
  nombre, organismo, ambito, comunidad_autonoma, tipo,
  importe_maximo, porcentaje_maximo, fecha_apertura, fecha_cierre,
  url_convocatoria, requisitos, documentacion_requerida, compatible_con_otras,
  normativa_confidence, citation_source, active
) VALUES
-- ============================================================
-- NEXT GENERATION EU — Programas RD 853/2021 (deadline 30/06/2026)
-- ============================================================
(
  'Programa 3 — Rehabilitacion a nivel de edificio',
  'MIVAU (Ministerio de Vivienda y Agenda Urbana)',
  'estatal', NULL, 'rehabilitacion',
  21400.00, 80.00, '2021-10-19', '2026-06-30',
  'https://www.mivau.gob.es/arquitectura/programa-rehabilitacion',
  'Reduccion >=30% consumo energia primaria no renovable. Edificios uso predominante residencial.',
  '["Proyecto tecnico", "Certificado eficiencia energetica antes y despues", "Acuerdo comunidad propietarios", "Presupuesto desglosado"]'::jsonb,
  true, 0.85, 'RD 853/2021 art. 35-44 BOE 06/10/2021', true
),
(
  'Programa 4 — Mejora eficiencia energetica viviendas',
  'MIVAU (Ministerio de Vivienda y Agenda Urbana)',
  'estatal', NULL, 'eficiencia_energetica',
  3000.00, 40.00, '2021-10-19', '2026-06-30',
  'https://www.mivau.gob.es/arquitectura/programa-rehabilitacion',
  'Actuaciones individuales en envolvente termica o instalaciones. Reduccion >=7% demanda calefaccion+refrigeracion o >=30% consumo no renovable.',
  '["Memoria tecnica", "Certificado eficiencia previa", "Facturas y certificados de obra"]'::jsonb,
  true, 0.85, 'RD 853/2021 art. 45-52 BOE 06/10/2021', true
),
(
  'Programa 5 — Libro del Edificio Existente y proyectos rehabilitacion',
  'MIVAU (Ministerio de Vivienda y Agenda Urbana)',
  'estatal', NULL, 'rehabilitacion',
  4000.00, 100.00, '2021-10-19', '2026-06-30',
  'https://www.mivau.gob.es/arquitectura/programa-rehabilitacion',
  'Edificios de uso residencial. Elaboracion de Libro del Edificio Existente conforme RD 390/2021.',
  '["Libro del Edificio Existente", "Proyecto tecnico", "Honorarios profesionales"]'::jsonb,
  true, 0.85, 'RD 853/2021 art. 53-58 BOE 06/10/2021', true
),
(
  'Programa 1 — Actuaciones de rehabilitacion a nivel de barrio',
  'MIVAU (Ministerio de Vivienda y Agenda Urbana)',
  'estatal', NULL, 'rehabilitacion',
  21400.00, 80.00, '2021-10-19', '2026-06-30',
  'https://www.mivau.gob.es/arquitectura/programa-rehabilitacion',
  'Entornos Residenciales de Rehabilitacion Programada (ERRP). Proyectos coordinados a escala barrio.',
  '["Plan de actuacion ERRP", "Proyecto tecnico edificios", "Convenio con ayuntamiento"]'::jsonb,
  true, 0.85, 'RD 853/2021 art. 13-22 BOE 06/10/2021', true
),

-- ============================================================
-- ESTATAL — Movilidad y autoconsumo
-- ============================================================
(
  'MOVES III — Plan Movilidad Eficiente y Sostenible',
  'IDAE (Instituto para la Diversificacion y Ahorro de Energia)',
  'estatal', NULL, 'eficiencia_energetica',
  9000.00, 50.00, '2021-04-10', '2026-12-31',
  'https://www.idae.es/ayudas-y-financiacion/para-movilidad-y-vehiculos/plan-moves-iii',
  'Adquisicion vehiculos electricos e hibridos enchufables, infraestructura de recarga.',
  '["Factura compra", "Permiso circulacion", "Certificado homologacion"]'::jsonb,
  true, 0.7, 'RD 266/2021 ampliado por RD-Ley 4/2024', true
),
(
  'Autoconsumo y baterias — Programas 1 a 6',
  'IDAE (Instituto para la Diversificacion y Ahorro de Energia)',
  'estatal', NULL, 'eficiencia_energetica',
  15000.00, 50.00, '2021-06-30', '2024-12-31',
  'https://www.idae.es/ayudas-y-financiacion/para-energias-renovables-en-autoconsumo-almacenamiento-y-termicas',
  'Instalaciones de autoconsumo solar, eolico, almacenamiento y climatizacion renovable.',
  '["Memoria tecnica", "Presupuesto certificado", "CIE (Certificado Instalacion Electrica)"]'::jsonb,
  true, 0.6, 'RD 477/2021 (verificar prorroga vigente)', true
),

-- ============================================================
-- AUTONOMICAS — principales CCAA
-- ============================================================
(
  'Plan Renove ascensores y supresion barreras Madrid 2024-2026',
  'Comunidad de Madrid - Direccion General de Vivienda',
  'autonomico', 'Madrid', 'accesibilidad',
  10000.00, 50.00, '2024-01-01', '2026-12-31',
  'https://www.comunidad.madrid/servicios/vivienda',
  'Edificios con mas de 25 anos. Instalacion ascensor o supresion barreras arquitectonicas.',
  '["Proyecto tecnico", "Acuerdo comunitario", "Licencia obra municipal"]'::jsonb,
  true, 0.65, 'BOCM Decreto 75/2023 (verificar convocatoria anual)', true
),
(
  'Programa Renhata — Reformas de hogares Comunitat Valenciana',
  'Generalitat Valenciana - Conselleria Vivienda',
  'autonomico', 'Comunitat Valenciana', 'rehabilitacion',
  9000.00, 35.00, '2024-03-01', '2026-12-31',
  'https://habitatge.gva.es/es/web/vivienda/renhata',
  'Reformas en cocina, bano y mejora accesibilidad. Vivienda habitual.',
  '["Memoria de actuacion", "Presupuesto desglosado", "Cedula habitabilidad"]'::jsonb,
  true, 0.65, 'DOGV Orden Conselleria Vivienda (verificar anual)', true
),
(
  'Programa Renove eficiencia energetica viviendas Pais Vasco',
  'Gobierno Vasco - Departamento Planificacion Territorial Vivienda',
  'autonomico', 'Pais Vasco', 'eficiencia_energetica',
  12000.00, 45.00, '2024-01-15', '2025-12-31',
  'https://www.euskadi.eus/web01-a3viv/es/contenidos/informacion/renove/es_renove/renove.html',
  'Mejora envolvente termica, instalaciones renovables, ventilacion mecanica.',
  '["Certificado energetico previo", "Proyecto tecnico", "Presupuesto certificado"]'::jsonb,
  true, 0.6, 'BOPV Orden Vivienda 2024 (verificar prorroga)', true
),
(
  'Subvencion rehabilitacion energetica edificios sector residencial Cataluna',
  'Generalitat de Catalunya - Agencia Habitatge',
  'autonomico', 'Cataluna', 'eficiencia_energetica',
  21400.00, 80.00, '2022-04-01', '2026-06-30',
  'https://habitatge.gencat.cat/ca/ambits/Rehabilitacio',
  'Tramita los Programas Next Gen 3, 4, 5 a nivel autonomico. Subvenciones complementarias.',
  '["Documentacion Programa Next Gen aplicable", "Certificado energetico"]'::jsonb,
  true, 0.7, 'Ordre TES/2022, modificada (verificar saldo presupuestario)', true
)
ON CONFLICT (nombre, organismo) DO NOTHING;

-- ============================================================
-- VERIFICACION
-- ============================================================
SELECT COUNT(*) AS total_grants,
       COUNT(*) FILTER (WHERE active = true) AS active_grants,
       COUNT(*) FILTER (WHERE fecha_cierre > now() AND active = true) AS vigentes,
       MIN(fecha_cierre) FILTER (WHERE fecha_cierre > now() AND active = true) AS proximo_cierre
FROM grants_active;
