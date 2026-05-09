-- ============================================================
-- SEED municipal_templates v1 - top 5 municipios espanoles
-- Fase B.4 plan Opus / B66 agent_telematic_filing
-- ============================================================
-- Plantillas verificables a 2026-05. citation_source apunta a sede electronica.
-- Documentos genericos comunes (PDF/A firmados digitalmente). Cada ayuntamiento
-- puede tener variantes que se ajustan manualmente.
-- Idempotente: ON CONFLICT (municipio, tipo_tramite) DO NOTHING.
-- ============================================================

INSERT INTO municipal_templates (
  municipio, provincia, tipo_tramite,
  documentos_requeridos, formato_expediente, sede_electronica_url,
  tamano_maximo_mb, formatos_admitidos, requiere_firma_digital,
  notas, citation_source
) VALUES

-- ============================================================
-- MADRID - Licencia obra menor (reformas interiores sin estructura)
-- ============================================================
('Madrid', 'Madrid', 'licencia_obra_menor',
 '[
   {"nombre":"Memoria descriptiva","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_documents"},
   {"nombre":"Planos del estado actual y reformado","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_design"},
   {"nombre":"Presupuesto desglosado por partidas","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_costs"},
   {"nombre":"Estudio Gestion RCD","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_rcd"},
   {"nombre":"Declaracion responsable del tecnico","tipo":"PDF","obligatorio":true,"agente_responsable":"manual"},
   {"nombre":"Certificado de instalaciones electricas","tipo":"PDF","obligatorio":false,"agente_responsable":"manual"},
   {"nombre":"Justificante de pago de tasa ICIO","tipo":"PDF","obligatorio":true,"agente_responsable":"manual"}
 ]'::jsonb,
 'ZIP', 'https://sede.madrid.es', 50,
 '["PDF","PDF/A","JPG","PNG"]'::jsonb,
 true,
 'Madrid usa Plataforma de Tramitacion Telematica. Tasa ICIO ~3% PEM. Plazo 1 mes silencio positivo.',
 'Ordenanza Municipal Tramitacion Licencias Urbanisticas Ayto Madrid 2024'),

('Madrid', 'Madrid', 'declaracion_responsable',
 '[
   {"nombre":"Declaracion responsable firmada","tipo":"PDF","obligatorio":true,"agente_responsable":"manual"},
   {"nombre":"Memoria descriptiva","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_documents"},
   {"nombre":"Planos basicos","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_design"},
   {"nombre":"Presupuesto","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_costs"},
   {"nombre":"Justificante de pago de tasa","tipo":"PDF","obligatorio":true,"agente_responsable":"manual"}
 ]'::jsonb,
 'ZIP', 'https://sede.madrid.es', 30,
 '["PDF","PDF/A"]'::jsonb,
 true,
 'Modalidad agil para reformas menores sin afectar estructura. Inicio inmediato tras presentacion.',
 'Ley 7/1985 Bases Regimen Local + Ordenanza Madrid 2024'),

('Madrid', 'Madrid', 'iee',
 '[
   {"nombre":"Informe Evaluacion Edificio (IEE)","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_iee"},
   {"nombre":"Anexo fotografico","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_iee"},
   {"nombre":"Certificado eficiencia energetica","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_energy_assessor"},
   {"nombre":"Plano emplazamiento","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_design"}
 ]'::jsonb,
 'ZIP', 'https://sede.madrid.es', 30,
 '["PDF","PDF/A","JPG"]'::jsonb,
 true,
 'Obligatorio edificios > 50 anos uso residencial colectivo. Vigencia 10 anos.',
 'Ley 8/2013 + RD 233/2013 Anexo II'),

-- ============================================================
-- BARCELONA - Comunicacion previa (mas comun para reformas pequenas)
-- ============================================================
('Barcelona', 'Barcelona', 'comunicacion_previa',
 '[
   {"nombre":"Comunicacion previa firmada","tipo":"PDF","obligatorio":true,"agente_responsable":"manual"},
   {"nombre":"Memoria tecnica","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_documents"},
   {"nombre":"Planos","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_design"},
   {"nombre":"Presupuesto","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_costs"},
   {"nombre":"Estudio basico de RCD","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_rcd"}
 ]'::jsonb,
 'ZIP', 'https://seuelectronica.ajuntament.barcelona.cat', 50,
 '["PDF","PDF/A"]'::jsonb,
 true,
 'Sistema GAUDI Ayto Barcelona. Reformas interiores sin afectar fachada/estructura.',
 'Ordenanza Reguladora Procediment Comunicacio Previa Barcelona 2024'),

('Barcelona', 'Barcelona', 'licencia_obra_menor',
 '[
   {"nombre":"Memoria descriptiva","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_documents"},
   {"nombre":"Planos firmados","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_design"},
   {"nombre":"Presupuesto","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_costs"},
   {"nombre":"Estudio Gestion RCD","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_rcd"},
   {"nombre":"Declaracion responsable del tecnico","tipo":"PDF","obligatorio":true,"agente_responsable":"manual"},
   {"nombre":"Pago tasa","tipo":"PDF","obligatorio":true,"agente_responsable":"manual"}
 ]'::jsonb,
 'ZIP', 'https://seuelectronica.ajuntament.barcelona.cat', 50,
 '["PDF","PDF/A"]'::jsonb,
 true,
 'Para reformas con afectacion estructural o fachada. Plazo aprox 2 meses.',
 'Ordenanza Llicencies i Comunicats Barcelona 2024'),

-- ============================================================
-- VALENCIA - Declaracion responsable + licencia obra menor
-- ============================================================
('Valencia', 'Valencia', 'declaracion_responsable',
 '[
   {"nombre":"Declaracion responsable firmada","tipo":"PDF","obligatorio":true,"agente_responsable":"manual"},
   {"nombre":"Memoria","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_documents"},
   {"nombre":"Planos","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_design"},
   {"nombre":"Presupuesto","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_costs"},
   {"nombre":"Justificante pago tasa","tipo":"PDF","obligatorio":true,"agente_responsable":"manual"}
 ]'::jsonb,
 'ZIP', 'https://sede.valencia.es', 30,
 '["PDF","PDF/A"]'::jsonb,
 true,
 'Tramitacion telematica via sede.valencia.es. Tasa segun PEM.',
 'Ordenanza Tramitacion Telematica Ayto Valencia 2024'),

-- ============================================================
-- SEVILLA - Licencia obra menor
-- ============================================================
('Sevilla', 'Sevilla', 'licencia_obra_menor',
 '[
   {"nombre":"Memoria descriptiva","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_documents"},
   {"nombre":"Planos","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_design"},
   {"nombre":"Presupuesto","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_costs"},
   {"nombre":"Estudio basico RCD","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_rcd"},
   {"nombre":"Pago tasa ICIO","tipo":"PDF","obligatorio":true,"agente_responsable":"manual"}
 ]'::jsonb,
 'ZIP', 'https://sede.sevilla.org', 50,
 '["PDF","PDF/A","JPG"]'::jsonb,
 true,
 'Sede electronica Ayto Sevilla. Tasa ICIO + tasa por servicios urbanisticos.',
 'Ordenanza Reguladora Tramitacion Licencias Sevilla 2024'),

-- ============================================================
-- BILBAO - Comunicacion previa
-- ============================================================
('Bilbao', 'Bizkaia', 'comunicacion_previa',
 '[
   {"nombre":"Comunicacion previa firmada","tipo":"PDF","obligatorio":true,"agente_responsable":"manual"},
   {"nombre":"Memoria tecnica","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_documents"},
   {"nombre":"Planos","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_design"},
   {"nombre":"Presupuesto","tipo":"PDF","obligatorio":true,"agente_responsable":"agent_costs"}
 ]'::jsonb,
 'ZIP', 'https://www.bilbao.eus/sede', 30,
 '["PDF","PDF/A"]'::jsonb,
 true,
 'Tramitacion bilingue (eu/es). Reformas sin estructura ni fachada.',
 'Ordenanza Tramitacion Electronica Bilbao 2024')

ON CONFLICT (municipio, tipo_tramite) DO NOTHING;

-- Verificacion
SELECT municipio, tipo_tramite,
       jsonb_array_length(documentos_requeridos) AS docs_count,
       requiere_firma_digital
FROM municipal_templates
ORDER BY municipio, tipo_tramite;
