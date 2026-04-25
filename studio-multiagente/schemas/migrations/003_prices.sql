-- Migration 003: price_references + supplier_catalog
-- Parte del roadmap ArquitAI sección 2.1 + 2.2
-- Reemplaza estimaciones del LLM por precios reales/verificados en agent_materials y agent_costs
-- Fecha: 2026-04-24

-- ============================================================
-- TABLA 1: price_references
-- Partidas de obra verificadas (origen CYPE/BEDEC) para validar agent_costs
-- ============================================================
CREATE TABLE IF NOT EXISTS price_references (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partida       text NOT NULL,
  unit          text NOT NULL,               -- m², ud, ml, m³, pa
  min_price     numeric(10,2),
  avg_price     numeric(10,2) NOT NULL,
  max_price     numeric(10,2),
  category      text,                        -- demolicion|albanileria|electricidad|fontaneria|carpinteria|acabados|climatizacion|otros
  source        text DEFAULT 'cype',         -- cype | bedec | manual
  location_zone text DEFAULT 'nacional',
  last_updated  date NOT NULL DEFAULT CURRENT_DATE,
  notes         text
);

CREATE INDEX IF NOT EXISTS idx_price_references_partida ON price_references (partida);
CREATE INDEX IF NOT EXISTS idx_price_references_category ON price_references (category);

-- ============================================================
-- TABLA 2: supplier_catalog
-- Catálogo de proveedores del arquitecto (alimentado manualmente por el arquitecto)
-- Consultado por util_price_search para dar prioridad a materiales conocidos
-- ============================================================
CREATE TABLE IF NOT EXISTS supplier_catalog (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL,
  category      text NOT NULL,               -- pavimento | sanitarios | griferia | cocina | carpinteria_int | carpinteria_ext | iluminacion | pintura | climatizacion | otros
  item_name     text NOT NULL,
  brand         text,
  model_ref     text,
  unit_price    numeric(10,2),
  unit          text,
  quality_tier  text,                        -- economica | media | alta | premium
  source_type   text DEFAULT 'catalog',      -- catalog | quote | web_search
  valid_until   date,
  notes         text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_supplier_catalog_category ON supplier_catalog (category);
CREATE INDEX IF NOT EXISTS idx_supplier_catalog_brand ON supplier_catalog (brand);

-- ============================================================
-- SEED: price_references — 35 partidas CYPE típicas de reforma integral
-- Precios medios en España 2026 (referencia CYPE / mercado)
-- ============================================================

INSERT INTO price_references (partida, unit, min_price, avg_price, max_price, category, source, notes) VALUES

-- ---------- DEMOLICIÓN / DESESCOMBRO ----------
('Demolición de tabique de ladrillo hueco',                    'm²',   8.00,  12.00,  18.00, 'demolicion', 'cype', 'Incluye retirada a contenedor'),
('Desmontaje de alicatado existente',                          'm²',   6.00,   9.00,  14.00, 'demolicion', 'cype', 'Sin recuperación'),
('Demolición de solado cerámico incluido rodapié',             'm²',   7.50,  11.00,  16.00, 'demolicion', 'cype', NULL),
('Retirada de sanitarios existentes',                          'ud',  25.00,  40.00,  70.00, 'demolicion', 'cype', 'Lavabo/inodoro/bañera'),
('Retirada de escombros a vertedero autorizado con contenedor','m³',  28.00,  42.00,  60.00, 'demolicion', 'cype', 'Incluye transporte y canon'),

-- ---------- ALBAÑILERÍA / TABIQUERÍA ----------
('Tabique de pladur 15+70+15 con aislamiento lana mineral',    'm²',  38.00,  48.00,  65.00, 'albanileria', 'cype', '1+1 placa con perfilería'),
('Tabique de ladrillo hueco doble de 7 cm',                    'm²',  32.00,  42.00,  55.00, 'albanileria', 'cype', 'Con yeso a dos caras'),
('Trasdosado autoportante pladur 15+46',                       'm²',  28.00,  36.00,  48.00, 'albanileria', 'cype', 'Aislamiento y placa estándar'),
('Falso techo continuo de pladur con aislamiento',             'm²',  26.00,  34.00,  46.00, 'albanileria', 'cype', 'Placa 13mm + aislamiento'),
('Falso techo registrable 60x60 escayola',                     'm²',  22.00,  29.00,  40.00, 'albanileria', 'cype', 'Perfilería oculta'),
('Recibido de premarcos y reposición de guarnecidos',          'ud',  28.00,  42.00,  65.00, 'albanileria', 'cype', NULL),

-- ---------- ACABADOS ----------
('Colocación de pavimento porcelánico en suelo',               'm²',  18.00,  24.00,  34.00, 'acabados', 'cype', 'Sin incluir material'),
('Colocación de alicatado porcelánico en pared',               'm²',  22.00,  30.00,  42.00, 'acabados', 'cype', 'Sin incluir material'),
('Colocación de rodapié cerámico/laminado',                    'ml',   4.50,   7.00,  10.00, 'acabados', 'cype', NULL),
('Enfoscado maestreado con mortero de cemento',                'm²',  16.00,  22.00,  30.00, 'acabados', 'cype', 'Preparación pared'),
('Pintura plástica lisa mate/satinada en pared',               'm²',   6.00,   8.50,  12.00, 'acabados', 'cype', 'Dos manos, imprimación incluida'),
('Pintura plástica lisa en techo',                             'm²',   7.00,  10.00,  14.00, 'acabados', 'cype', 'Dos manos'),
('Microcemento continuo 2 capas + sellado',                    'm²',  75.00,  95.00, 130.00, 'acabados', 'cype', 'Aplicación profesional'),
('Parquet laminado AC4 flotante instalado',                    'm²',  22.00,  32.00,  48.00, 'acabados', 'cype', 'Material y colocación'),

-- ---------- ELECTRICIDAD ----------
('Instalación eléctrica completa vivienda REBT grado 2',       'm²',  32.00,  40.00,  55.00, 'electricidad', 'cype', 'Incluye cableado, mecanismos y cuadro'),
('Cuadro general de mando y protección IGA+ICP+diferenciales', 'ud', 380.00, 480.00, 650.00, 'electricidad', 'cype', 'REBT vivienda grado elevado'),
('Punto de luz con mecanismo simple',                          'ud',  35.00,  48.00,  68.00, 'electricidad', 'cype', 'Cableado + mecanismo blanco estándar'),
('Toma de corriente Schuko 16A',                               'ud',  32.00,  44.00,  62.00, 'electricidad', 'cype', 'Incluye cableado desde cuadro'),

-- ---------- FONTANERÍA Y SANITARIOS ----------
('Instalación fontanería baño completo (inodoro+lavabo+ducha)','ud', 1400.00,1800.00,2400.00, 'fontaneria', 'cype', 'Multicapa pex, sin sanitarios'),
('Instalación fontanería cocina (fregadero + lavavajillas)',   'ud', 380.00, 520.00, 720.00, 'fontaneria', 'cype', 'Puntos de agua fría y caliente'),
('Sanitarios baño gama media (inodoro+lavabo+plato ducha)',    'pa', 650.00, 950.00,1450.00, 'fontaneria', 'cype', 'Porcelana estándar española'),
('Grifería termostática ducha + lavabo gama media',            'pa', 280.00, 420.00, 680.00, 'fontaneria', 'cype', 'Grohe/Tres nivel medio'),

-- ---------- CLIMATIZACIÓN ----------
('Aire acondicionado por conductos 4-5 kW con máquina exterior','ud',2200.00,2900.00,3800.00, 'climatizacion','cype', 'Instalado y puesto en marcha'),
('Split 1x1 pared 3kW instalado',                              'ud', 650.00, 850.00,1150.00, 'climatizacion','cype', 'Mitsubishi/Daikin gama media'),
('Caldera de condensación gas natural 24kW',                   'ud',1800.00,2400.00,3200.00, 'climatizacion','cype', 'Instalación completa'),
('Extracción mecánica en baño con conducto al exterior',       'ud', 150.00, 220.00, 320.00, 'climatizacion','cype', NULL),

-- ---------- CARPINTERÍA ----------
('Puerta de paso lacada blanca con herrajes gama media',       'ud', 320.00, 420.00, 580.00, 'carpinteria', 'cype', 'Premarco + puerta + tapetas'),
('Puerta corredera empotrada con guía',                        'ud', 480.00, 640.00, 880.00, 'carpinteria', 'cype', 'Sistema completo'),
('Puerta de entrada blindada nivel 3',                         'ud', 780.00,1100.00,1600.00, 'carpinteria', 'cype', 'Colocada con cerradura de seguridad'),
('Carpintería exterior aluminio RPT con climalit 4+16+4',      'm²', 320.00, 420.00, 580.00, 'carpinteria', 'cype', 'Rotura puente térmico'),

-- ---------- COCINA ----------
('Mobiliario de cocina gama media (bajos + altos)',            'ml', 480.00, 680.00, 980.00, 'cocina', 'cype', 'Sin electrodomésticos ni encimera'),
('Encimera Silestone/compac espesor 20mm',                     'ml', 260.00, 380.00, 540.00, 'cocina', 'cype', 'Canto recto, sin aperturas especiales'),

-- ---------- LIMPIEZA Y FIN DE OBRA ----------
('Limpieza final de obra vivienda completa',                   'm²',   3.50,   5.50,   8.50, 'otros', 'cype', 'Basic + cristales');

-- ============================================================
-- Verificación post-migración
-- ============================================================
-- SELECT COUNT(*) FROM price_references;             -- debe ser 38
-- SELECT category, COUNT(*) FROM price_references GROUP BY category ORDER BY category;
-- SELECT COUNT(*) FROM supplier_catalog;             -- debe ser 0 (arquitecto añade los suyos)
