# Sistema de Memoria v2 — Embeddings + Similarity Search

## Estado

- **Migración 006** aplicada (pgvector + columna `embedding` en memory_cases).
- Workflows: `util_generate_embedding` (`xZaguYuuTG0mXSf2`), `util_search_similar_cases` (`U9U5GPfuWi7DI4TW`).
- Modificaciones: `agent_memory` genera embedding al guardar case. `agent_briefing` busca casos similares al iniciar proyecto e inyecta lecciones en el prompt.
- Última revisión: 2026-04-25.

## Filosofía

`memory_cases` almacena las lecciones, decisiones y patrones de cada proyecto completado. Sin similarity search, era una tabla muerta — cada proyecto se construía desde cero. Con v2:

- Cada nuevo memory_case se almacena con su **embedding** (vector de 1536 dim, OpenAI `text-embedding-3-small`).
- Cuando un nuevo proyecto inicia, `agent_briefing` busca los **3 casos más similares** y los inyecta en el prompt como contexto.
- El sistema "aprende" sin intervención manual: cada proyecto futuro recibe automáticamente las lecciones de proyectos pasados similares.

## Componentes

### `util_generate_embedding`
- **Input**: `{ text: string, model?: 'text-embedding-3-small' }`
- **Output**: `{ status, embedding: number[1536], dimensions, tokens_used }` o `{ status: 'error', error_message }`
- **Llama a**: `https://api.openai.com/v1/embeddings`
- **Coste**: ~$0.00002 por 1k tokens. Una entrada típica de memory_case son ~500 tokens → $0.00001 por embedding.

### `util_search_similar_cases`
- **Input**: `{ project_type, location_zone, property_type, area_m2, summary, briefing_summary?, tags?, top_k?: 5, exclude_project_id? }`
- **Pasos**: build search text → generate embedding → query con `<=>` coseno en pgvector → return top_k.
- **Output**: `{ status, cases_found, similar_cases: [{ id, similarity (0-1), summary, lessons_learned, patterns, ... }] }`

### Modificación `agent_memory`
Cadena nueva tras guardar el memory_case:
```
Save Memory Case → Build Embedding Text → Generate Embedding → Save Embedding → Write Intelligence
```

`Build Embedding Text` concatena summary + scope_summary + lessons (top 5) + patterns (top 3) + tags. Eso alimenta a `util_generate_embedding`. El vector resultante se guarda en `memory_cases.embedding`. Si el embedding falla, `Save Embedding` está marcado `continueOnFail` para no romper el flow.

### Modificación `agent_briefing`
Cadena nueva entre Load Agent Prompt y Prepare LLM Payload:
```
Load Agent Prompt → Build Search Query → Search Similar Cases → Prepare LLM Payload
```

`Build Search Query` extrae project_type, location_province, property_type, area, notas del arquitecto. Pasa eso a `util_search_similar_cases` (con `exclude_project_id: <project_id_actual>`). El `Prepare LLM Payload` recibe los casos y los inyecta en el prompt_user bajo "CASOS SIMILARES DE PROYECTOS ANTERIORES (memoria del estudio)".

El LLM ve los lessons_learned y los considera al estructurar el briefing. Por ejemplo: si un caso anterior tuvo el problema "muro entre cocina-salón resultó portante el 60% de las veces, hay que pedir cata desde el inicio", el agente lo añadirá automáticamente en `open_questions` o `constraints` del nuevo briefing.

## Flujo de datos

```
[Proyecto X completa] 
    → agent_memory genera memory_case con lessons
    → util_generate_embedding crea vector(1536)
    → memory_cases.embedding poblado

[Proyecto Y comienza]
    → agent_briefing
    → Build Search Query con datos de Y
    → util_search_similar_cases busca top 3 más similares
    → Prepare LLM Payload inyecta lessons de los 3 cases
    → LLM genera briefing aprovechando ese contexto
```

## Coste operativo

Por proyecto:
- Generar embedding al cerrar memory_case: ~$0.00001.
- Buscar similares al iniciar briefing: ~$0.00001 (1 embedding query).

Despreciable a cualquier escala razonable. Para 100 proyectos/año: ~$0.002 total en embeddings.

## Backfill de cases existentes

Para casos previos sin embedding (memory_cases creados antes de la migración 006), backfill manual:

```sql
-- Identificar cases sin embedding
SELECT id, summary FROM memory_cases WHERE embedding IS NULL;
```

Luego para cada case, llamar a `util_generate_embedding` con el texto del case y `UPDATE memory_cases SET embedding = $vector, embedding_text = $text WHERE id = $id`. Hay un workflow de plantilla para hacerlo en lote (ver `agent_memory` jsCode "Build Embedding Text").

## Limitaciones conocidas

1. **Volumen mínimo útil**: con < 10 memory_cases la búsqueda por similitud no aporta gran valor. Cada nuevo proyecto que pasa por agent_memory enriquece la base.
2. **Calidad del texto que se embedee**: el embedding es tan bueno como el texto que lo alimenta. Si los lessons son genéricos, la similarity también lo será.
3. **Index IVFFLAT con 50 lists**: óptimo hasta ~10k cases. Para volumen mayor cambiar a HNSW o reentrenar el index.
4. **Cosine similarity no es perfecta**: cases con texto distinto pero misma esencia pueden quedar abajo. Mejorar progresivamente con re-rankers post-MVP (ej. Cohere Rerank).

## Cómo evoluciona

- **Iter 2**: añadir hybrid search (vector + keyword + filtros estructurados).
- **Iter 3**: integrar con LightRAG sobre normativa para contexto cruzado.
- **Iter 4**: agent_anomaly_detector que usa similarity para detectar gremios outliers o presupuestos atípicos comparando con cases similares.

## Espacio para Damián

```
## Aprendizajes propios sobre el sistema de memoria

- Cuando funciona muy bien: ...
- Cuando falla: ...
- Casos donde la similarity propuesta era equivocada: ...
```
