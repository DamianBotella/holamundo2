-- 077: ArquitAI Fase E.1 - Pre-check normativa municipal (PGOU top 5)
-- Almacena reglas substantivas de planeamiento urbano (PGOU / ordenanzas locales)
-- de los municipios mas frecuentes. Diferente de municipal_templates (mig 065) que
-- es sobre procedimientos administrativos (que documentos pide la sede electronica).
-- Aqui guardamos REGLAS DE FONDO: alturas, retranqueos, ascensor obligatorio,
-- compatibilidad de usos, ITE, accesibilidad, eficiencia, horarios obra, RCD, etc.
--
-- Lo lee agent_municipal_precheck en Fase E para hacer un pre-check rapido del
-- proyecto contra el municipio antes de lanzar el agent_regulatory completo.
--
-- Top 5 inicial: Madrid, Barcelona, Valencia, Sevilla, Bilbao
-- Esta migracion siembra solo Madrid (21 reglas). Resto (Barcelona, Valencia, Sevilla, Bilbao) en migs siguientes.

BEGIN;

CREATE TABLE IF NOT EXISTS municipal_pgou_rules (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  municipio_slug        text NOT NULL,
  municipio_nombre      text NOT NULL,
  provincia             text NOT NULL,
  ccaa                  text NOT NULL,
  rule_key              text NOT NULL,
  rule_category         text NOT NULL CHECK (rule_category IN (
    'tramite_licencia',
    'compatibilidad_uso',
    'alturas_volumenes',
    'retranqueos_distancias',
    'ocupacion_parcela',
    'ascensor_obligatorio',
    'accesibilidad',
    'eficiencia_energetica',
    'habitabilidad_minima',
    'patios_ventilacion',
    'aparcamiento_obligatorio',
    'proteccion_patrimonio',
    'ite_iee',
    'horario_obras',
    'gestion_rcd',
    'tasas_andamios_vados',
    'instalaciones_servicios',
    'otros'
  )),
  rule_title            text NOT NULL,
  rule_description      text NOT NULL,
  normative_reference   text,
  normative_url         text,
  applies_to            jsonb NOT NULL DEFAULT '{}'::jsonb,
  triggers              jsonb NOT NULL DEFAULT '{}'::jsonb,
  license_implication   text CHECK (license_implication IS NULL OR license_implication IN (
    'comunicacion_previa',
    'declaracion_responsable',
    'licencia_obra_menor',
    'licencia_obra_mayor',
    'sin_licencia',
    'depende'
  )),
  pitfalls              jsonb DEFAULT '[]'::jsonb,
  severity              text NOT NULL DEFAULT 'importante' CHECK (severity IN ('critico','importante','recomendable','informativo')),
  version_rule          int NOT NULL DEFAULT 1,
  last_verified_at      timestamptz NOT NULL DEFAULT now(),
  source_doc            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (municipio_slug, rule_key)
);

CREATE INDEX IF NOT EXISTS idx_municipal_pgou_municipio   ON municipal_pgou_rules(municipio_slug);
CREATE INDEX IF NOT EXISTS idx_municipal_pgou_category    ON municipal_pgou_rules(municipio_slug, rule_category);
CREATE INDEX IF NOT EXISTS idx_municipal_pgou_severity    ON municipal_pgou_rules(severity);
CREATE INDEX IF NOT EXISTS idx_municipal_pgou_applies_gin ON municipal_pgou_rules USING GIN (applies_to);
CREATE INDEX IF NOT EXISTS idx_municipal_pgou_triggers_gin ON municipal_pgou_rules USING GIN (triggers);

-- Tabla resultado del precheck (por proyecto, versionado)
CREATE TABLE IF NOT EXISTS municipal_prechecks (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id            uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tenant_id             uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  municipio_slug        text NOT NULL,
  rules_matched_count   int NOT NULL DEFAULT 0,
  applicable_rules      jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_license   text,
  blockers              jsonb DEFAULT '[]'::jsonb,
  pitfalls_aggregated   jsonb DEFAULT '[]'::jsonb,
  summary_for_architect text,
  llm_model             text,
  llm_tokens_in         int,
  llm_tokens_out        int,
  request_id            text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_municipal_prechecks_project ON municipal_prechecks(project_id, created_at DESC);

ALTER TABLE municipal_prechecks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS municipal_prechecks_tenant ON municipal_prechecks;
CREATE POLICY municipal_prechecks_tenant ON municipal_prechecks
  FOR ALL USING (tenant_id = current_tenant_id() OR is_super_admin())
  WITH CHECK (tenant_id = current_tenant_id() OR is_super_admin());

-- municipal_pgou_rules es PUBLICA (compartida entre tenants, como municipal_templates).
-- No habilitamos RLS.

-- ================================================================
-- SEED Madrid (PGOU 1997 + revisiones + ordenanzas habituales)
-- ================================================================

INSERT INTO municipal_pgou_rules (municipio_slug, municipio_nombre, provincia, ccaa, rule_key, rule_category, rule_title, rule_description, normative_reference, normative_url, applies_to, triggers, license_implication, pitfalls, severity, source_doc) VALUES

('madrid','Madrid','Madrid','Madrid','reforma_no_estructural_comunicacion','tramite_licencia',
 'Reforma interior sin afectar estructura ni distribucion: comunicacion previa',
 'Pintura, sustitucion de pavimentos/revestimientos sin modificar tabiqueria, cambio de sanitarios y griferia, ventanas SIN modificar hueco: bastan comunicacion previa o declaracion responsable. No requiere proyecto tecnico.',
 'Ordenanza Municipal de Tramitacion de Licencias Urbanisticas (OMTLU) art. 17',
 'https://www.madrid.es/UnidadesDescentralizadas/UrbanismoyVivienda/Urbanismo/Licencias/OMTLU.pdf',
 '{"project_type":["reforma","actuacion_simple"]}'::jsonb,
 '{"affects_structure":false,"changes_layout":false,"changes_facade":false}'::jsonb,
 'comunicacion_previa',
 '["Aun siendo comunicacion previa, requiere memoria firmada y fotos. No se puede empezar sin numero de expediente.","Si cambias bañera por plato de ducha alteras pendientes de saneamiento - puede requerir DR en lugar de CP."]'::jsonb,
 'critico','PGOU Madrid 1997 + OMTLU'),

('madrid','Madrid','Madrid','Madrid','reforma_distribucion_dr','tramite_licencia',
 'Reforma con cambio de distribucion interior: declaracion responsable',
 'Si se modifica tabiqueria interior (mover/anular/anadir) sin afectar elementos estructurales, se tramita por declaracion responsable (DR). Requiere proyecto tecnico firmado por arquitecto o aparejador.',
 'OMTLU art. 18 + RD-Ley 8/2011',
 'https://www.madrid.es/UnidadesDescentralizadas/UrbanismoyVivienda/Urbanismo/Licencias/OMTLU.pdf',
 '{"project_type":["reforma"]}'::jsonb,
 '{"changes_layout":true,"affects_structure":false}'::jsonb,
 'declaracion_responsable',
 '["DR permite iniciar obra al presentar, pero el ayuntamiento revisa a posteriori. Si falta documento se interrumpe.","Si la reforma afecta a elemento comun (patio, fachada) hace falta autorizacion de la comunidad ANTES de la DR."]'::jsonb,
 'critico','OMTLU Madrid'),

('madrid','Madrid','Madrid','Madrid','obra_estructural_licencia_mayor','tramite_licencia',
 'Reforma que afecta a estructura o cambia uso: licencia de obra mayor',
 'Tocar pilares, vigas, forjados, modificar fachada estructural, cambio de uso (terciario->residencial o viceversa), o division horizontal: licencia de obra MAYOR. Requiere proyecto basico + ejecucion visado y normalmente plazo 2-4 meses.',
 'Ley del Suelo de la CAM 9/2001 art. 151 + OMTLU',
 'https://www.madrid.es/UnidadesDescentralizadas/UrbanismoyVivienda/Urbanismo/Licencias',
 '{"project_type":["reforma","cambio_uso","division_horizontal","obra_nueva"]}'::jsonb,
 '{"affects_structure":true}'::jsonb,
 'licencia_obra_mayor',
 '["No iniciar obra hasta tener la licencia. Las sanciones por obra sin licencia son altas.","Si el edificio esta catalogado, anadir informe de la Comision Local de Patrimonio. Plazo +2 meses."]'::jsonb,
 'critico','Ley 9/2001 CAM'),

('madrid','Madrid','Madrid','Madrid','ape_centro_protegido','proteccion_patrimonio',
 'Ambito de Proteccion Especial (APE/APR): restricciones de patrimonio en Centro',
 'Si el inmueble esta en APE Centro, APR Latina, APR Plaza Mayor u otros ambitos protegidos del PGOU, cualquier intervencion en fachada, cubierta o elementos protegidos requiere informe favorable de la Direccion General de Patrimonio. NO se pueden cambiar carpinterias exteriores sin matricula identica.',
 'PGOU Madrid 1997 - Catalogo de Bienes y Espacios Protegidos',
 'https://www.madrid.es/portales/munimadrid/es/PGOU',
 '{"property_type":["any"]}'::jsonb,
 '{"location_zone":["centro","ape_centro","apr"],"affects_facade":true}'::jsonb,
 'licencia_obra_mayor',
 '["Aunque sea reforma interior, si el edificio esta catalogado nivel 1-2 toda intervencion va a Patrimonio.","La sustitucion de ventanas en APE requiere mantener materialidad y particion. Aluminio prohibido en muchos casos."]'::jsonb,
 'critico','PGOU 1997 Catalogo'),

('madrid','Madrid','Madrid','Madrid','ascensor_obligatorio_4plantas','ascensor_obligatorio',
 'Ascensor obligatorio: edificios >4 plantas sobre rasante o reformas >25% en edificios existentes',
 'En obra nueva: ascensor obligatorio si el edificio tiene 4 o mas plantas sobre rasante (PB+3). En rehabilitacion: si la reforma supera el 25% del valor del edificio y este tiene PB+3 o mas, se debe instalar ascensor o justificar incompatibilidad tecnica/economica.',
 'Ley 8/1993 PROMOCION ACCESIBILIDAD CAM + CTE DB-SUA 9',
 'https://www.boe.es/buscar/act.php?id=BOE-A-2010-4056',
 '{"project_type":["obra_nueva","rehabilitacion","cambio_uso"],"property_floors":">=4"}'::jsonb,
 '{"property_floors_above_ground":">=4","reform_pct_value":">=25"}'::jsonb,
 'depende',
 '["Si el edificio tiene 4 plantas y NO ascensor, antes de empezar reforma >25% pedir informe de viabilidad de instalacion.","Hay subvenciones autonomicas y estatales (Plan Recuperacion) para instalar ascensor en rehabilitacion."]'::jsonb,
 'critico','Ley 8/1993 CAM + CTE'),

('madrid','Madrid','Madrid','Madrid','accesibilidad_db_sua_reformas','accesibilidad',
 'DB-SUA aplicable en reformas que afecten >50% superficie o cambio de uso',
 'CTE DB-SUA 9 (accesibilidad) se aplica integramente en obra nueva y cambios de uso. En reformas, aplica a las zonas reformadas si superan el 50% de la superficie total. Anchos puerta >=80cm, pasillo >=100cm, ducha enrasada en banos accesibles.',
 'CTE DB-SUA + Orden VIV/561/2010',
 'https://www.codigotecnico.org/DocumentosCTE/SeguridadUtilizacion.html',
 '{"project_type":["reforma","cambio_uso","obra_nueva"]}'::jsonb,
 '{"reform_pct_surface":">=50","is_change_of_use":true}'::jsonb,
 'depende',
 '["En reformas parciales se confunde a menudo y se aplica DB-SUA cuando no toca: encarece sin necesidad.","Pero si la reforma incluye zonas comunes (portal, pasillo, ascensor) DB-SUA aplica si o si."]'::jsonb,
 'importante','CTE DB-SUA'),

('madrid','Madrid','Madrid','Madrid','cte_dbhe_reforma_mayor','eficiencia_energetica',
 'CTE DB-HE eficiencia energetica: aplicable en reforma >25% envolvente',
 'Si la reforma supera el 25% de la envolvente termica del edificio, se debe cumplir DB-HE0 y HE1 (limitacion demanda + eficiencia). Aislamiento, carpinterias U<=1.8 W/m2K, calderas condensacion, etc. Tambien si hay cambio de uso a residencial.',
 'CTE DB-HE (RD 732/2019 actualizado)',
 'https://www.codigotecnico.org/DocumentosCTE/AhorroEnergia.html',
 '{"project_type":["reforma","cambio_uso","obra_nueva"]}'::jsonb,
 '{"reform_pct_envelope":">=25"}'::jsonb,
 'depende',
 '["Muchas reformas integrales no se dan cuenta de que superan el 25% y omiten el estudio DB-HE. Si lo detectan en visado se paraliza el proyecto.","Cambio de carpinteria exterior siempre tira de DB-HE1 - acreditar U de las nuevas ventanas."]'::jsonb,
 'critico','CTE DB-HE'),

('madrid','Madrid','Madrid','Madrid','habitabilidad_25m2_estudio','habitabilidad_minima',
 'Superficie minima habitable: 25 m2 utiles para estudio, 30 m2 para 1 dormitorio',
 'Norma de habitabilidad CAM: superficie minima habitable de un estudio 25 m2 utiles (sin terrazas ni trasteros). 1 dormitorio: 30 m2 utiles. Cada dormitorio adicional: +8 m2.',
 'Decreto 11/2018 CAM Condiciones de Habitabilidad',
 'https://www.bocm.es/boletin/CM_Orden_BOCM/2018/02/13/BOCM-20180213-1.PDF',
 '{"project_type":["obra_nueva","cambio_uso","division_horizontal"]}'::jsonb,
 '{"creates_dwelling":true}'::jsonb,
 'depende',
 '["Cuidado con division horizontal: si una vivienda se divide en dos, cada una debe cumplir el minimo. Frecuentemente queda alguna por debajo.","Cambio de uso terciario->residencial obliga a habitabilidad - es la trampa habitual."]'::jsonb,
 'critico','Decreto 11/2018 CAM'),

('madrid','Madrid','Madrid','Madrid','patio_minimo_9m2','patios_ventilacion',
 'Patio interior minimo: 9 m2 para vivienda exterior, 12 m2 si recibe ventilacion de dormitorio',
 'Patios de ventilacion: dimension minima de inscribir un circulo de 3m diametro (9 m2) para vivienda exterior. Si un dormitorio ventila a patio, minimo 12 m2 y altura/lado >= 1/3.',
 'PGOU Madrid 1997 art. 6.5',
 'https://www.madrid.es/portales/munimadrid/es/PGOU',
 '{"project_type":["obra_nueva","division_horizontal","cambio_uso"]}'::jsonb,
 '{"requires_patio":true}'::jsonb,
 'depende',
 '["En cambios de uso de oficina a vivienda hay que comprobar siempre el patio: si no cumple no se puede convertir en residencial sin obra de fachada.","Se calcula sobre dimensiones LIBRES, no totales de la finca."]'::jsonb,
 'critico','PGOU 1997'),

('madrid','Madrid','Madrid','Madrid','aparcamiento_residencial_1x100','aparcamiento_obligatorio',
 'Plaza de aparcamiento obligatoria: 1 plaza cada 100 m2 construidos residencial',
 'En obra nueva o ampliacion >25% en uso residencial: 1 plaza de aparcamiento por cada 100 m2 construidos. En centro historico la obligacion se atenua o exonera segun grado de proteccion.',
 'PGOU Madrid 1997 art. 7.5',
 'https://www.madrid.es/portales/munimadrid/es/PGOU',
 '{"project_type":["obra_nueva"]}'::jsonb,
 '{"is_residential":true,"property_area_m2":">=100"}'::jsonb,
 'depende',
 '["En division horizontal de un edificio existente, normalmente NO se exige aparcamiento adicional.","En APE/Centro hay tablas de exoneracion - consultar Junta de Distrito."]'::jsonb,
 'importante','PGOU 1997'),

('madrid','Madrid','Madrid','Madrid','ite_edificios_30anos','ite_iee',
 'ITE obligatoria: edificios mayores de 30 anos cada 10 anos',
 'Inspeccion Tecnica del Edificio (ITE) obligatoria para edificios con mas de 30 anos, renovable cada 10 anos. Si el edificio no tiene ITE en vigor, NO se puede dar licencia para reforma >25%.',
 'Ordenanza ITE Madrid + Ley 8/2013 Rehabilitacion',
 'https://www.madrid.es/portales/munimadrid/es/Inicio/Vivienda-urbanismo-y-obras/Inspeccion-Tecnica-de-Edificios-ITE',
 '{"project_type":["reforma","cambio_uso","division_horizontal"]}'::jsonb,
 '{"building_age_years":">=30"}'::jsonb,
 'depende',
 '["Comprobar ITE del edificio ANTES de presentar licencia. Si la ITE esta caducada, primero hay que renovarla (~600-1500 EUR).","ITE desfavorable obliga a obras correctoras antes que cualquier otra licencia."]'::jsonb,
 'critico','Ordenanza ITE Madrid'),

('madrid','Madrid','Madrid','Madrid','iee_50anos','ite_iee',
 'IEE (Informe Evaluacion Edificio) en transmision o subvencion - edificios >50 anos',
 'Informe de Evaluacion de Edificios (IEE) obligatorio en cualquier transmision o solicitud de ayudas publicas si el edificio tiene mas de 50 anos. Mas amplio que ITE: incluye eficiencia energetica + accesibilidad.',
 'Ley 8/2013 Rehabilitacion + Decreto IEE CAM',
 'https://www.boe.es/buscar/doc.php?id=BOE-A-2013-6938',
 '{"project_type":["any"]}'::jsonb,
 '{"building_age_years":">=50","triggers_iee":true}'::jsonb,
 'sin_licencia',
 '["IEE es requisito para solicitar ayudas Next Generation EU de rehabilitacion energetica.","IEE caducado tras 10 anos."]'::jsonb,
 'recomendable','Ley 8/2013'),

('madrid','Madrid','Madrid','Madrid','horario_obras_madrid','horario_obras',
 'Horario de obras Madrid: L-V 8:00-20:00, S 9:30-14:00, D y festivos prohibido',
 'Obras y trabajos ruidosos en zona urbana solo de lunes a viernes de 8:00 a 20:00 y sabados de 9:30 a 14:00. Domingos y festivos prohibido salvo licencia especial. Vibradores y martillos electricos solo L-V 9:00-19:00.',
 'Ordenanza de Proteccion contra la Contaminacion Acustica y Termica art. 24',
 'https://www.madrid.es/portales/munimadrid/es/Inicio/El-Ayuntamiento/Normativa/Ordenanzas-municipales',
 '{"project_type":["any"]}'::jsonb,
 '{"any":true}'::jsonb,
 'sin_licencia',
 '["Incumplir horario es la queja vecinal mas habitual. Multa por incumplimiento.","Para obras urgentes fuera de horario se pide autorizacion especial al Distrito 48h antes."]'::jsonb,
 'importante','Ordenanza Acustica Madrid'),

('madrid','Madrid','Madrid','Madrid','rcd_gestion_obligatoria','gestion_rcd',
 'Gestion RCD: punto limpio o gestor autorizado obligatorio si supera 5 m3',
 'Residuos de Construccion y Demolicion: separacion en origen y entrega a gestor autorizado obligatoria. Fianza municipal si supera 5 m3 de RCD estimados (~60 EUR/m3). Devolucion al presentar certificado de gestor.',
 'Real Decreto 105/2008 + Ordenanza Limpieza Madrid',
 'https://www.boe.es/buscar/act.php?id=BOE-A-2008-2486',
 '{"project_type":["reforma","obra_nueva","cambio_uso","division_horizontal"]}'::jsonb,
 '{"generates_rcd":true,"estimated_rcd_m3":">=5"}'::jsonb,
 'sin_licencia',
 '["La fianza se exige al pedir licencia y NO se devuelve sin certificado de gestor. Importante archivar.","Si el contratista no tiene contrato con gestor, exigirlo antes de empezar."]'::jsonb,
 'importante','RD 105/2008'),

('madrid','Madrid','Madrid','Madrid','andamio_vado_tasa','tasas_andamios_vados',
 'Andamio en via publica: tasa de ocupacion + autorizacion de uso publico',
 'Si la obra requiere andamio, contenedor o vado en acera/calzada, autorizacion de Movilidad + tasa por dia/m2. Madrid tasa media 0.4-0.8 EUR/m2/dia. Andamios >6m altura: certificado tecnico obligatorio.',
 'Ordenanza Mobiliario Urbano + Ordenanza Tasas',
 'https://www.madrid.es/portales/munimadrid/es/Inicio/El-Ayuntamiento/Normativa/Ordenanzas-municipales',
 '{"project_type":["reforma","obra_nueva"]}'::jsonb,
 '{"requires_public_space":true}'::jsonb,
 'sin_licencia',
 '["Solicitar autorizacion 15 dias antes - tramite paralelo a la licencia de obra.","En calles peatonales hay restricciones horarias para suministro de materiales."]'::jsonb,
 'recomendable','Ordenanza Tasas Madrid'),

('madrid','Madrid','Madrid','Madrid','contador_individual_agua','instalaciones_servicios',
 'Contador individual de agua obligatorio en reformas integrales',
 'Reformas integrales o division horizontal: obligatorio contador individual por vivienda (no comunes). Acometida ajustada a la potencia/caudal de cada vivienda.',
 'Decreto 137/1985 CAM + RC Canal Isabel II',
 'https://www.canaldeisabelsegunda.es',
 '{"project_type":["reforma","division_horizontal","obra_nueva"]}'::jsonb,
 '{"is_residential":true,"reform_pct_value":">=25"}'::jsonb,
 'sin_licencia',
 '["Sin contador individual no hay alta de suministro. Importante coordinar con Canal Isabel II antes de la obra.","Si la finca tiene contador comun antiguo, hay subvencion por individualizar."]'::jsonb,
 'importante','Decreto 137/1985'),

('madrid','Madrid','Madrid','Madrid','distancia_minima_vecinos_3m','retranqueos_distancias',
 'Distancia minima de elementos nuevos a linderos vecinos: 3 m fachada / 1.5 m patio',
 'En obra nueva o ampliacion vertical, retranqueo minimo: 3 m a linderos exteriores (fachada), 1.5 m a linderos a patio. Cuerpos volados <0.5m no computan retranqueo.',
 'PGOU Madrid 1997 normas zonales',
 'https://www.madrid.es/portales/munimadrid/es/PGOU',
 '{"project_type":["obra_nueva","ampliacion"]}'::jsonb,
 '{"creates_new_volume":true}'::jsonb,
 'depende',
 '["No aplica a reforma interior. Pero si la reforma incluye cerramiento de terraza, cuenta como ampliacion y debe respetar el retranqueo.","Cuerpos volados cuentan como retranqueo si superan 0.5 m."]'::jsonb,
 'importante','PGOU 1997'),

('madrid','Madrid','Madrid','Madrid','cambio_uso_compatibilidad','compatibilidad_uso',
 'Cambio de uso terciario->residencial requiere compatibilidad PGOU + habitabilidad completa',
 'Convertir local/oficina/comercial en vivienda exige: (1) que el uso residencial sea compatible en la zona PGOU, (2) cumplir todo el Decreto 11/2018 habitabilidad, (3) ventilacion natural a calle o patio reglamentario, (4) altura libre minima 2.50 m, (5) instalaciones nuevas conformes a normativa actual.',
 'PGOU Madrid 1997 + Decreto 11/2018 CAM',
 'https://www.bocm.es/boletin/CM_Orden_BOCM/2018/02/13/BOCM-20180213-1.PDF',
 '{"project_type":["cambio_uso"]}'::jsonb,
 '{"new_use":"residencial","origin_use":["terciario","comercial","oficina"]}'::jsonb,
 'licencia_obra_mayor',
 '["Muchos locales en planta baja NO son compatibles con uso residencial en su zona PGOU. Comprobar en Cartografia Municipal antes.","La altura libre de 2.50 m descarta muchos locales de techos bajos."]'::jsonb,
 'critico','PGOU 1997 + Decreto 11/2018'),

('madrid','Madrid','Madrid','Madrid','calefaccion_renovable_obligatoria','eficiencia_energetica',
 'Calefaccion: sustitucion de caldera de gasoil prohibida desde 2024 en residencial',
 'En reforma integral de vivienda, sustitucion de caldera de gasoil/carbon esta prohibida; debe instalarse alternativa renovable (aerotermia, biomasa pellet) o gas natural condensacion. Calderas estancas de gas siempre obligatorio para nueva instalacion.',
 'Plan Nacional Integrado de Energia y Clima + RD 178/2021',
 'https://www.boe.es/buscar/act.php?id=BOE-A-2021-4682',
 '{"project_type":["reforma","cambio_uso","obra_nueva"]}'::jsonb,
 '{"replaces_heating":true}'::jsonb,
 'sin_licencia',
 '["Si el contrato menciona sustitucion de caldera, asegurar que NO es gasoil.","Aerotermia y biomasa tienen subvenciones - 25-40% del coste."]'::jsonb,
 'importante','RD 178/2021'),

('madrid','Madrid','Madrid','Madrid','asbesto_amianto_pre1980','otros',
 'Amianto: edificios anteriores a 1980 requieren evaluacion antes de demolicion',
 'En reforma con demolicion de tabiqueria, cubiertas, bajantes en edificios anteriores a 1980 (sospecha amianto), evaluacion previa obligatoria. Si hay amianto: empresa RERA autorizada para retirar + plan de trabajo aprobado por Inspeccion de Trabajo.',
 'Real Decreto 396/2006',
 'https://www.boe.es/buscar/act.php?id=BOE-A-2006-6474',
 '{"project_type":["reforma","obra_nueva"]}'::jsonb,
 '{"building_age_years":">=45","demolition_works":true}'::jsonb,
 'sin_licencia',
 '["Bajantes de uralita en edificios anteriores a 1980 son amianto al 95%. Coste retirada 30-60 EUR/ml.","Sin plan de trabajo aprobado NO se puede empezar demolicion. Plazo aprobacion 2-3 semanas."]'::jsonb,
 'critico','RD 396/2006'),

('madrid','Madrid','Madrid','Madrid','altura_libre_minima_residencial','habitabilidad_minima',
 'Altura libre minima en residencial: 2.50 m piezas habitables, 2.20 m banos y pasillos',
 'En piezas habitables (estar, dormitorios, cocina): altura libre minima 2.50 m. En banos, cocinas pequenas, pasillos y zonas no habitables: 2.20 m minimo. Se admiten descuelgues puntuales hasta el 25% de la superficie.',
 'Decreto 11/2018 CAM Condiciones Habitabilidad',
 'https://www.bocm.es/boletin/CM_Orden_BOCM/2018/02/13/BOCM-20180213-1.PDF',
 '{"project_type":["obra_nueva","cambio_uso","reforma"]}'::jsonb,
 '{"affects_ceiling_height":true}'::jsonb,
 'depende',
 '["Si poner falso techo deja altura <2.50 m, NO se puede en piezas habitables. Iluminacion empotrada cuenta como descuelgue.","Cambios de uso de local a vivienda fallan muchas veces por altura libre."]'::jsonb,
 'importante','Decreto 11/2018 CAM')

ON CONFLICT (municipio_slug, rule_key) DO UPDATE SET
  rule_description = EXCLUDED.rule_description,
  normative_reference = EXCLUDED.normative_reference,
  normative_url = EXCLUDED.normative_url,
  applies_to = EXCLUDED.applies_to,
  triggers = EXCLUDED.triggers,
  license_implication = EXCLUDED.license_implication,
  pitfalls = EXCLUDED.pitfalls,
  severity = EXCLUDED.severity,
  version_rule = municipal_pgou_rules.version_rule + 1,
  last_verified_at = now(),
  updated_at = now();

INSERT INTO applied_migrations (filename, notes) VALUES
  ('077_municipal_pgou_rules.sql', 'E.1 plan Opus: municipal_pgou_rules + municipal_prechecks + seed Madrid (21 reglas PGOU 1997 + ordenanzas)')
ON CONFLICT (filename) DO NOTHING;

COMMIT;

-- rollback:
-- BEGIN;
-- DROP TABLE IF EXISTS municipal_prechecks;
-- DROP TABLE IF EXISTS municipal_pgou_rules;
-- DELETE FROM applied_migrations WHERE filename = '077_municipal_pgou_rules.sql';
-- COMMIT;
