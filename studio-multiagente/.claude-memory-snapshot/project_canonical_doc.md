---
name: ArquitAI — documento canónico de producto
description: studio-multiagente/ArquitAI.md es la fuente única de verdad de qué es el producto y hacia dónde va
type: reference
originSessionId: 32bee148-6455-4e09-b04c-9ad2f179c99b
---
El producto se llama **ArquitAI** (no "studio-multiagente" — ese es solo el nombre de la carpeta técnica).

## Archivo canónico
`studio-multiagente/ArquitAI.md` es el documento maestro. Contiene en 7 secciones:
- Sec 0: visión y principios inmutables
- Sec 1: núcleo MVP construido (11 agentes + utilidades + crons + modelo de datos)
- Sec 2: roadmap cercano planificado (price_search, LightRAG, agent_3d_design, chat sidebar, multi-tenant)
- Sec 3: nuevas oportunidades — 20 lagunas del oficio identificadas (seguimiento obra, gremios, licencias, postventa, CSS, calidad, energía, accesibilidad, BIM, contratos, ciberseguridad GDPR/RLS, domótica, AR, patología, interop BC3/IFC, colaboradores)
- Sec 4: tabla de priorización
- Sec 5: reglas de evolución (invariantes técnicas)
- Sec 6: glosario de identificadores (URLs, credenciales)
- Sec 7: cómo usar el documento

**Why:** Damián pidió un punto de partida único para toda conversación sobre el producto. Antes de proponer features, arquitectura o prioridades, consultar ArquitAI.md para alinear con la estructura existente.

**How to apply:** 
- Antes de sugerir una feature nueva, ver si ya está en sec 2 o sec 3.
- Features nuevas se añaden a sec 3 con las 3 pautas (Técnica / Función / Beneficio) y a la tabla de priorización en sec 4.
- Features construidas se mueven de sec 2/3 a sec 1.
- Reglas de evolución en sec 5 son invariantes — ningún agente nuevo debería violarlas.
