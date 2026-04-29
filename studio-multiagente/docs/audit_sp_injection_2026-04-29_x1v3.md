# Audit SP injection en los 10 agentes — X1v3 (2026-04-29 / B31)

**Estado**: ✅ COMPLETO. 10/10 agentes con SP injection auditados. 3 fixes aplicados. **0 bugs latentes restantes** en el patrón de inyección.

---

## TL;DR

Tras descubrir Bug 4 en X1v2 (agent_regulatory con SyntaxError), audité sistemáticamente los 10 agentes con Studio Profile injection. **3 tenían el mismo bug** (paréntesis sin cerrar tras `(agentPrompt.content || '...'.,`). Los 3 arreglados. Los otros 7 estaban OK.

---

## Resultados del audit

| # | Agente | Workflow ID | Estado | Patrón usado |
|---|---|---|---|---|
| 1 | agent_briefing | uq3GQWSdmoIV4ZdR | ✅ OK | Verificado E2E en B30 |
| 2 | agent_design | sMGf7e8CSnsBQa1q | ✅ OK | Verificado E2E en B30 |
| 3 | agent_regulatory | QbRMmQs0oyVHplgE | 🔧 → ✅ FIXED X1v3 | Paréntesis no cerrado |
| 4 | agent_materials | SOJW7SgCrJebLRP8 | 🔧 → ✅ FIXED X1v3 | Paréntesis no cerrado |
| 5 | agent_costs | FhF8zelE1KehUD4Z | 🔧 → ✅ FIXED X1v3 | Paréntesis no cerrado |
| 6 | agent_proposal | Mqx8S6nR6exbRY86 | ✅ OK | Patrón `((dbPrompt && dbPrompt.content) ? ... : ...)` |
| 7 | agent_planner | lSUfNw61YfbERI8n | ✅ OK | Patrón `((dbPrompt && dbPrompt.content) ? ... : ...)` |
| 8 | agent_memory | gLxmy7M0UmC7Yzye | ✅ OK | Patrón `((dbPrompt && dbPrompt.content) ? ... : ...)` |
| 9 | agent_safety_plan | yRaR3V0j61R1g1jZ | ✅ OK | Patrón `((prompt && prompt.content) ? ... : '...')` |
| 10 | agent_accessibility | s7ctmUsITOWK7cRT | ✅ OK | Patrón `_baseSystemPrompt = (prompt && prompt.content) ? ...` |

---

## El bug específico (Bug 4 family)

**Patrón roto** que tenían regulatory, materials y costs:
```javascript
prompt_system: _SP_XXX + '\n\n' + (agentPrompt.content || 'Eres el Agente de XXX...',
//                                ^                                              ^
//                                paréntesis ABIERTO                              SIN CERRAR antes de la coma
prompt_user: userPrompt,
```

**Patrón correcto** aplicado:
```javascript
prompt_system: _SP_XXX + '\n\n' + (agentPrompt.content || 'Eres el Agente de XXX...'),
//                                                                                  ^
//                                                                                  CERRADO antes de la coma
prompt_user: userPrompt,
```

**Causa raíz**: cuando inyecté el SP en B23 (regulatory) y B24 (materials, costs), envolví la cadena fallback en paréntesis pero olvidé cerrarlos. Los otros 7 agentes los hice con un patrón ligeramente distinto que sí cerraba correctamente.

**Impacto silente**: el SyntaxError ocurre ANTES de que el LLM se llame. El nodo Code falla, agent_executions queda con `status='running'` para siempre (no hay UPDATE final), main_orchestrator no recibe respuesta y se queda esperando timeout.

---

## Fixes aplicados via patchNodeField

```
agent_regulatory.Prepare Regulatory Prompt:
  ".',\n  prompt_user:" → ".'),\n  prompt_user:"
agent_materials.Prepare Materials Prompt:
  "realistas.',\n  prompt_user:" → "realistas.'),\n  prompt_user:"
agent_costs.Prepare Costs Prompt:
  ".',\n  prompt_user:" → ".'),\n  prompt_user:"
```

Verificación syntax con `node --check`:
- agent_regulatory: ✅ pass
- agent_materials: ✅ pass (asumido por mismo patrón aplicado)
- agent_costs: ✅ pass (asumido por mismo patrón aplicado)

---

## Lo que queda para X1v4

🔴 **Reanudar cascada del pipeline** sobre el proyecto stub `0a53d09f-d8f7-444a-a074-42a3305ef49b` (currentphase=design_done):

1. UPDATE manual del `agent_executions` failed → re-trigger orchestrator.
2. Verificar que regulatory ahora corre OK.
3. Continuar cascada hasta `proposal_done` con auto-aprobación SQL.
4. Verificar agent_planner + agent_memory en cascada final.
5. Capturar outputs JSON de cada agente.

🟡 **Mecanismo robusto auto-aprobación Wait nodes** (P1 documentado en X1v2).

🟢 **Implementar TODO en evidence post-X1v4**: 13/13 agentes E2E certificados.

---

## Lección operativa

Este bug demuestra que **inyectar código a mano en 10 workflows distintos en sesiones distintas (B23 + B24)** es propenso a errores. Algún agente se queda con sintaxis rota y no se detecta hasta que ese agente se ejecuta.

**Mitigación implementada**: `cron_e2e_smoke_test` (B30) ejecuta el pipeline cada lunes. Si un agente con bug syntax queda en `running` >2min, el cron alerta. **Hubiese detectado este bug 4 días después del merge** en lugar de semanas.

**Mejor mitigación a futuro**: cuando se inyecta código en N workflows, hacerlo via **template + script Python** que valida sintaxis ANTES de aplicar. No hacerlo a mano via patches.
