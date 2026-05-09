# ===================================================================
# smoke_b63_grants.ps1 - Smoke E2E del agent_grants_finder (B63)
# ===================================================================
# Pasos:
#   1. Lee N8N_API_URL desde .mcp.json
#   2. Pide tu JWT actual (lo sacas de DevTools en ArquitAI)
#   3. Pide el project_id (lo sacas de la URL o de un SELECT en Supabase)
#   4. Invoca POST /api/v1/agents/grants-finder/analyze
#   5. Imprime resumen de recomendaciones + tokens consumidos
#
# Como obtener JWT:
#   1. Abre ArquitAI logueado
#   2. F12 -> Network
#   3. Click en cualquier request (ej. /me, /projects)
#   4. Pestana Headers -> Request Headers -> Authorization
#   5. Copia el valor sin el prefijo "Bearer "
#
# Como obtener project_id:
#   - Click en un proyecto del kanban -> URL contiene project=<uuid>
#   - O en Supabase: SELECT id, name FROM projects WHERE name ILIKE '%finca san%';
# ===================================================================

$ErrorActionPreference = 'Stop'

$j = Get-Content .mcp.json -Raw | ConvertFrom-Json
$N8N_URL = $j.mcpServers.n8n.env.N8N_API_URL
"=== smoke_b63_grants ==="
"N8N_URL = $N8N_URL"

if (-not $env:JWT) {
  $jwt = Read-Host -Prompt "Pega aqui tu JWT (sin Bearer)"
} else {
  $jwt = $env:JWT
  "JWT desde `$env:JWT (longitud=$($jwt.Length))"
}
if (-not $jwt -or $jwt.Length -lt 50) { throw "JWT invalido o vacio" }

if (-not $env:PROJECT_ID) {
  $projId = Read-Host -Prompt "Pega aqui el project_id (uuid)"
} else {
  $projId = $env:PROJECT_ID
  "PROJECT_ID desde `$env:PROJECT_ID = $projId"
}
if (-not $projId -or $projId.Length -ne 36) { throw "project_id no parece UUID" }

$headers = @{
  'Authorization' = "Bearer $jwt"
  'Content-Type'  = 'application/json'
}
$body = @{ project_id = $projId } | ConvertTo-Json -Compress

"---"
"POST $N8N_URL/webhook/api/v1/agents/grants-finder/analyze"
"Body: $body"
""

$started = Get-Date
try {
  $resp = Invoke-RestMethod -Uri "$N8N_URL/webhook/api/v1/agents/grants-finder/analyze" -Headers $headers -Method POST -Body $body -TimeoutSec 90
} catch {
  "ERROR HTTP $($_.Exception.Response.StatusCode.value__)"
  $_.ErrorDetails.Message
  return
}
$elapsed = ((Get-Date) - $started).TotalSeconds

"---"
"OK respuesta en $($elapsed.ToString('F1'))s"
"meta:"
$resp.meta | Format-List
"---"
"data.grants_evaluated:        $($resp.data.grants_evaluated)"
"data.recommendations_count:   $($resp.data.recommendations_count)"
"data.ahorro_total_acumulable_eur: $($resp.data.ahorro_total_acumulable_eur)"
"---"
"TOP recomendaciones:"
if ($resp.data.recomendaciones) {
  foreach ($r in $resp.data.recomendaciones) {
    "  - $($r.nombre) [$($r.organismo)]"
    "      ahorro_estimado: $($r.ahorro_estimado_eur) EUR ($($r.porcentaje_aplicable)%)"
    "      probabilidad: $($r.probabilidad_aprobacion) | confidence: $($r.normativa_confidence)"
    "      fecha_limite: $($r.fecha_limite_solicitud)"
    "      verificar_manualmente: $($r.verificar_manualmente)"
    if ($r.riesgos -and $r.riesgos.Count -gt 0) {
      "      riesgos: $($r.riesgos -join ' | ')"
    }
    ""
  }
} else {
  "  (sin recomendaciones; data.razon: $($resp.data.razon))"
}

"siguiente_accion: $($resp.data.siguiente_accion_recomendada)"

if ($resp.data.alertas_plazo_inminente -and $resp.data.alertas_plazo_inminente.Count -gt 0) {
  "ALERTAS PLAZO:"
  $resp.data.alertas_plazo_inminente | ForEach-Object { "  - $_" }
}
