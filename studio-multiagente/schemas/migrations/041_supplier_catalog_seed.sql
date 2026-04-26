-- Migration 041: seed inicial supplier_catalog
-- Fecha: 2026-04-26
--
-- Activa agent_materials con un catalogo MINIMO de items genericos
-- de proveedores españoles habituales en gama media. El bloque 10
-- conecto el Load Supplier Catalog con la tabla real (antes era stub
-- vacio); este seed le da datos reales para empezar.
--
-- IMPORTANTE: estos precios son referencia 2026 y orientativos.
-- Damian debe REEMPLAZARLOS por precios reales de sus proveedores
-- de confianza. Idealmente alimentar la tabla con catalogos PDF
-- reales (Roca, Porcelanosa, Marazzi, etc) cuando los tenga.
--
-- Forma de uso:
--   1. Ejecutar este script en Supabase.
--   2. agent_materials los lee automaticamente (cableado en bloque 10).
--   3. Damian sustituye items con sus proveedores reales:
--      DELETE FROM supplier_catalog WHERE source_type = 'seed_generico';
--      INSERT INTO supplier_catalog ... (sus items reales)
--   4. Si quiere mantener estos como fallback, dejar source_type='seed_generico'
--      y añadir items con source_type='catalog' que tendran prioridad.

INSERT INTO supplier_catalog (supplier_name, category, item_name, brand, model_ref, unit_price, unit, quality_tier, source_type, notes) VALUES

-- ============================================================
-- PAVIMENTO
-- ============================================================
('Porcelanosa', 'pavimento', 'Porcelanico rectificado 60x60 cm — colores neutros',  'Porcelanosa', 'STARWOOD',     32.00, 'm2', 'media',  'seed_generico', 'Polido o mate. Stock habitual en distribuidor.'),
('Marazzi',     'pavimento', 'Porcelanico imitacion madera 20x120 cm',              'Marazzi',     'TREVERKHOME',  42.00, 'm2', 'alta',   'seed_generico', 'Buena resistencia al rayado, ideal salones'),
('Saloni',      'pavimento', 'Porcelanico antideslizante R10 30x60 banos',          'Saloni',      'AQUASTOP',     28.00, 'm2', 'media',  'seed_generico', 'Cumple deslizamiento clase 3 SUA-1'),
('Leroy Merlin','pavimento', 'Tarima laminada AC4 estructurada 8mm',                'Quick-Step',  'CLASSIC',      18.00, 'm2', 'economica', 'seed_generico', 'Garantia 25 anos uso domestico'),

-- ============================================================
-- SANITARIOS
-- ============================================================
('Roca',        'sanitarios','Inodoro suspendido con cisterna empotrada',          'Roca',        'MERIDIAN',    420.00, 'ud', 'media',  'seed_generico', 'Incluye estructura, pulsador y tapa amortiguada'),
('Roca',        'sanitarios','Plato ducha resina 100x80 cm antideslizante',        'Roca',        'TERRAN',      280.00, 'ud', 'media',  'seed_generico', 'Sifón incluido. Color blanco/gris'),
('Geberit',     'sanitarios','Bastidor empotrado con pulsador',                    'Geberit',     'DUOFIX',      350.00, 'ud', 'alta',   'seed_generico', 'Mas duradero que opcion media. 10 anos garantia'),
('Roca',        'sanitarios','Lavabo sobre encimera ceramica',                     'Roca',        'KHROMA',      180.00, 'ud', 'media',  'seed_generico', 'Sin grifo. 60cm de ancho'),

-- ============================================================
-- GRIFERIA
-- ============================================================
('Tres',        'griferia',  'Grifo monomando lavabo bano',                        'Tres',        'CUADRO-TRES', 120.00, 'ud', 'media',  'seed_generico', 'Cromado. Aireador antical'),
('Grohe',       'griferia',  'Grifo monomando termostatico ducha empotrado',       'Grohe',       'GROHTHERM',   380.00, 'ud', 'alta',   'seed_generico', 'Set ducha completo, 30 anos garantia'),
('Tres',        'griferia',  'Grifo monomando cocina cano alto giratorio',         'Tres',        'COCINA-CANO', 150.00, 'ud', 'media',  'seed_generico', NULL),

-- ============================================================
-- COCINA (mobiliario y electrodomesticos)
-- ============================================================
('IKEA',        'cocina',    'Modulo bajo cocina 60cm con cajones METOD',          'IKEA',        'METOD-MAXIMERA', 220.00, 'ud', 'media',  'seed_generico', 'Frente VOXTORP blanco mate'),
('Siemens',     'cocina',    'Placa induccion 60cm 3 zonas',                       'Siemens',     'EH675FFC1E',  650.00, 'ud', 'media',  'seed_generico', 'iQ300 con boost'),
('Bosch',       'cocina',    'Horno multifuncion EcoClean',                        'Bosch',       'HBA534BS0',   480.00, 'ud', 'media',  'seed_generico', 'Serie 4, A energetico'),
('Cosentino',   'cocina',    'Encimera Silestone 20mm + canto recto',              'Cosentino',   'SILESTONE',   320.00, 'ml', 'alta',   'seed_generico', 'Sin junta hasta 320cm. Color iconic white'),

-- ============================================================
-- CARPINTERIA INTERIOR
-- ============================================================
('VT Industrial','carpinteria_int','Puerta paso lacada blanca 72.5cm',             'VT',          'LISA-BLANCA', 280.00, 'ud', 'media',  'seed_generico', 'Premarco, marco y tapetas. Cerradura cromada'),
('Sanrafael',   'carpinteria_int','Puerta corredera empotrada con guia',           'Sanrafael',   'SLIDE-COR',   620.00, 'ud', 'alta',   'seed_generico', 'Sistema completo cassette + puerta'),

-- ============================================================
-- ILUMINACION
-- ============================================================
('Philips',     'iluminacion','Downlight LED empotrable 18W IP44',                 'Philips',     'COREPRO',      28.00, 'ud', 'media',  'seed_generico', 'Apto baño zona 2'),
('Faro',        'iluminacion','Tira LED 5m 24V CRI90 IP20',                        'Faro',        'STRIPE-90',    65.00, 'ud', 'media',  'seed_generico', 'Para muebles cocina y armarios. Necesita driver aparte'),

-- ============================================================
-- PINTURA
-- ============================================================
('Bruguer',     'pintura',   'Pintura plastica lisa interior 15L',                 'Bruguer',     'CLIMAVEN',     85.00, 'ud', 'media',  'seed_generico', 'Cubre 90-110m2 dos manos. Lavable'),

-- ============================================================
-- CLIMATIZACION
-- ============================================================
('Daikin',      'climatizacion','Split mural 1x1 3,5kW invertir',                  'Daikin',      'FTXM35R',    1100.00, 'ud', 'media',  'seed_generico', 'Bomba calor frio/calor R32. A++/A+'),
('Saunier Duval','climatizacion','Caldera condensacion gas natural 24kW',          'Saunier Duval','TWINTOP',   2300.00, 'ud', 'media',  'seed_generico', 'Mixta ACS+calefaccion. Etiqueta A')

ON CONFLICT DO NOTHING;

-- ============================================================
-- Verificacion post-migracion
-- ============================================================
-- SELECT count(*) FROM supplier_catalog WHERE source_type = 'seed_generico'; -- esperado: 22
-- SELECT category, count(*) FROM supplier_catalog GROUP BY category ORDER BY category;
-- SELECT supplier_name, count(*) FROM supplier_catalog GROUP BY supplier_name ORDER BY 2 DESC;
