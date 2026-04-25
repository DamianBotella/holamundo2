# Catálogo de proveedores — TU red profesional

## Estado

- **Pendiente:** Damián debe rellenar con sus proveedores habituales.
- **Consumido por:** `agent_materials` (ya existente), `util_price_search` (ya existente) — consulta la tabla `supplier_catalog` en Supabase.

---

## Cómo rellenar

Este archivo es la versión **human-readable** del catálogo. El sistema consulta la tabla `supplier_catalog` en Supabase (es lo que usan los agentes en runtime).

Este archivo te sirve para:
- Documentar decisiones que NO están en la tabla (por qué este proveedor, condiciones especiales).
- Tenerlo como referencia offline.
- Introducir nuevos proveedores (lo paso yo a la tabla SQL después).

---

## Plantilla

```markdown
## Mis proveedores habituales

### Pavimento / alicatado

#### Proveedor 1 — [Nombre empresa]
- Categoría: pavimento + alicatado
- Contacto: [persona] · [email] · [teléfono]
- Condiciones comerciales: X% descuento sobre PVP, entrega 48h si stock
- Gamas disponibles: ...
- Marcas principales: Marazzi, Porcelanosa, Tau, Gres Valencia
- Valoración: ★★★★★ / ★★★★☆ / ...
- Notas: ...

#### Proveedor 2 — ...

### Sanitarios y grifería

#### Proveedor 1 — ...

### Cocina (mobiliario a medida)

#### Proveedor 1 — ...

### Carpintería interior

#### Proveedor 1 — ...

### Carpintería exterior (aluminio)

#### Proveedor 1 — ...

### Iluminación

#### Proveedor 1 — ...

### Mecanismos eléctricos

#### Proveedor 1 — ...

### Climatización (equipos)

#### Proveedor 1 — ...

### Aislamiento / pladur

#### Proveedor 1 — ...

### Otros

...
```

---

## Tabla supplier_catalog en Supabase

Esquema de la tabla (ya creada):

```sql
CREATE TABLE supplier_catalog (
  id            uuid PRIMARY KEY,
  supplier_name text,
  category      text,   -- pavimento | sanitarios | griferia | cocina | carpinteria_int | carpinteria_ext | iluminacion | pintura | climatizacion | otros
  item_name     text,
  brand         text,
  model_ref     text,
  unit_price    numeric(10,2),
  unit          text,   -- m2 | ud | ml | pa
  quality_tier  text,   -- economica | media | alta | premium
  source_type   text,   -- catalog | quote | web_search
  valid_until   date,
  notes         text
);
```

### Cómo añadir un producto

Cuando tengas producto concreto con precio, lo metemos a la tabla:

```markdown
## Producto a añadir a supplier_catalog

- supplier_name: Porcelanosa
- category: pavimento
- item_name: Porcelánico 60x60 efecto mármol calacatta
- brand: Porcelanosa
- model_ref: POR-60-CAL
- unit_price: 42.00
- unit: m2
- quality_tier: alta
- source_type: catalog
- valid_until: 2026-12-31
- notes: Descuento 15% si compra > 30 m2. Entrega 7 días.
```

Cuando tengas 5-10 productos listos, me los pasas aquí y yo hago el INSERT en la tabla con un workflow temporal.

---

## Categorías canónicas

Para que `util_price_search` funcione bien, usa SIEMPRE estas categorías (el agent_materials hace queries por categoría exacta):

- `pavimento` — suelos de todas las tipologías
- `alicatado` — revestimiento de pared, baños y cocinas
- `sanitarios` — inodoro, lavabo, plato ducha, bañera, bidé
- `griferia` — grifos, termostáticos, mezcladores
- `cocina` — mobiliario cocina, encimera, fregadero
- `carpinteria_int` — puertas de paso, armarios empotrados
- `carpinteria_ext` — ventanas, puertas exteriores
- `iluminacion` — luminarias, focos, tiras LED
- `pintura` — pinturas y barnices
- `climatizacion` — calderas, splits, conductos
- `aislamiento` — lana mineral, XPS, poliuretano
- `pladur` — placas y perfilería
- `electricidad_materiales` — cableado, mecanismos, cuadros
- `fontaneria_materiales` — tuberías, accesorios
- `otros`

---

## Consejo

Empieza con **5-10 proveedores clave** (los que más usas). No hace falta el catálogo completo de cada uno — solo los productos que sueles proponer.

El sistema empieza a dar valor real en cuanto tiene:
- 5 proveedores
- 50+ productos con precio

Con eso `agent_materials` ya propone cosas que son las tuyas, no mezclas genéricas de internet.
