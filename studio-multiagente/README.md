# Studio Multiagente

Sistema multiagente para estudio de arquitectura técnica y reformas de vivienda.

## Estructura

```
studio-multiagente/
├── CLAUDE.md                ← Contexto para Claude Code
├── .cursorrules             ← Contexto para Cursor
├── README.md
├── docs/
│   ├── arquitectura.md      ← Bloque 1: arquitectura n8n 2.12.x
│   ├── modelo_datos.md      ← Bloque 2: 16 entidades
│   ├── mapa_workflows.md    ← Bloque 3: 17 workflows detallados
│   ├── agentes.md           ← Bloque 4: implementación por agente
│   ├── plan_fases.md        ← Bloque 5: MVP → V2 → V3
│   ├── guia_util_llm_call.md ← Bloque 6: primer workflow paso a paso
│   └── handoff_resumen.md   ← Resumen de estado actual
├── schemas/
│   └── mvp_schema.sql       ← Script SQL para Supabase (16 tablas)
├── prompts/
│   └── agent_prompts.md     ← Prompts de los 11 agentes
├── workflows/
│   └── (JSON importables en n8n)
└── references/
    └── n8n_node_types.md    ← Referencia de nodos n8n 2.12.x
```

## Uso

1. Abrir en Cursor o VS Code con Claude Code.
2. Pedir a Claude que genere el siguiente workflow según el orden del CLAUDE.md.
3. Importar el JSON generado en n8n.
4. Configurar credenciales y publicar.

## Stack

- n8n 2.12.x (self-hosted, Docker)
- Supabase (PostgreSQL 15+)
- Anthropic Claude / OpenAI GPT-4
- Google Drive + Gmail
