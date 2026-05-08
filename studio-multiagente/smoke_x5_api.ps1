# Smoke E2E X5 - obtiene JWT desde Supabase (login email+password) y prueba 6 endpoints API.
#
# Uso:
#   1) Rellena $SUPABASE_URL y $SUPABASE_ANON_KEY de abajo (los pillas en Supabase Dashboard -> Settings -> API).
#      - SUPABASE_URL: el "Project URL"  (ej: https://xfeatkzordgnztigplwd.supabase.co)
#      - SUPABASE_ANON_KEY: la "anon public" key (la legacy / publishable, NO la service_role).
#   2) Ejecuta: powershell -ExecutionPolicy Bypass -File studio-multiagente\smoke_x5_api.ps1
#   3) El script te pide email y password, hace login y ejecuta los 6 endpoints.

$BASE              = 'https://n8n-n8n.zzeluw.easypanel.host'
$SUPABASE_URL      = 'https://xfeatkzordgnztigplwd.supabase.co'
$SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmZWF0a3pvcmRnbnp0aWdwbHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODE3NDQsImV4cCI6MjA5MDI1Nzc0NH0.TRgFxQ08iLyLAIpXp3WFpiro9S6EPGLbXbX7uATMRG4'

# -----------------------------------------------------------------
# 1) Login en Supabase para obtener JWT
# -----------------------------------------------------------------
$email = Read-Host 'Email Supabase'
$secPwd  = Read-Host 'Password' -AsSecureString
$BSTR    = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPwd)
$password= [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

Write-Host "`n[*] Login en Supabase..." -ForegroundColor Yellow
$loginUri = "$SUPABASE_URL/auth/v1/token?grant_type=password"
$loginBody = @{ email = $email; password = $password } | ConvertTo-Json
$loginHeaders = @{
  'apikey'       = $SUPABASE_ANON_KEY
  'Content-Type' = 'application/json'
}

try {
  $loginResp = Invoke-RestMethod -Uri $loginUri -Headers $loginHeaders -Method POST -Body $loginBody -TimeoutSec 30
} catch {
  Write-Host ("FAIL login: " + $_.Exception.Message) -ForegroundColor Red
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  exit 1
}

$JWT = $loginResp.access_token
if ([string]::IsNullOrWhiteSpace($JWT)) {
  Write-Host "FAIL: la respuesta de Supabase no trae access_token." -ForegroundColor Red
  $loginResp | ConvertTo-Json -Depth 4 | Write-Host
  exit 1
}
Write-Host "[OK] JWT obtenido (longitud $($JWT.Length))." -ForegroundColor Green

# Decodificar payload para mostrar custom claims
$parts = $JWT.Split('.')
if ($parts.Length -eq 3) {
  $pad = '=' * ((4 - ($parts[1].Length % 4)) % 4)
  $b64 = ($parts[1] + $pad).Replace('-','+').Replace('_','/')
  try {
    $payload = [System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64)) | ConvertFrom-Json
    Write-Host ("    sub=$($payload.sub)  tenant_id=$($payload.tenant_id)  role=$($payload.role)") -ForegroundColor Gray
  } catch {}
}

# -----------------------------------------------------------------
# 2) Ejecutar smoke contra los 6 endpoints
# -----------------------------------------------------------------
$headers = @{
  Authorization = "Bearer $JWT"
  Accept        = 'application/json'
}

function Test-Endpoint {
  param([string]$Name, [string]$Path)
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  Write-Host "GET $BASE$Path"
  try {
    $resp = Invoke-RestMethod -Uri "$BASE$Path" -Headers $headers -Method GET -TimeoutSec 30
    Write-Host "OK" -ForegroundColor Green
    $resp | ConvertTo-Json -Depth 6 -Compress | Out-String | Write-Host
    return $resp
  } catch {
    Write-Host ("FAIL: " + $_.Exception.Message) -ForegroundColor Red
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
    return $null
  }
}

$me       = Test-Endpoint -Name '1. GET /api/v1/me'                   -Path '/webhook/api/v1/me'
$projects = Test-Endpoint -Name '2. GET /api/v1/projects'             -Path '/webhook/api/v1/projects?limit=5'

if ($projects -and $projects.data -and $projects.data.Count -gt 0) {
  $pid_first = $projects.data[0].id
  Test-Endpoint -Name "3. GET /api/v1/project-detail?id=$pid_first"            -Path "/webhook/api/v1/project-detail?id=$pid_first"            | Out-Null
  Test-Endpoint -Name "4. GET /api/v1/project-timeline?id=$pid_first&limit=10" -Path "/webhook/api/v1/project-timeline?id=$pid_first&limit=10" | Out-Null
} else {
  Write-Host "`n[skip] no hay proyectos en la lista para probar /detail y /timeline" -ForegroundColor Yellow
}

Test-Endpoint -Name '5. GET /api/v1/alerts/global'      -Path '/webhook/api/v1/alerts/global?limit=10' | Out-Null
Test-Endpoint -Name '6. GET /api/v1/metrics/dashboard'  -Path '/webhook/api/v1/metrics/dashboard'      | Out-Null

Write-Host "`n=== FIN smoke X5 ===" -ForegroundColor Cyan
