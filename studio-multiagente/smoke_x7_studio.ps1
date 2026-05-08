# Smoke E2E X7 - prueba los 4 endpoints nuevos del studio
# Uso: powershell -ExecutionPolicy Bypass -File studio-multiagente\smoke_x7_studio.ps1

$BASE              = 'https://n8n-n8n.zzeluw.easypanel.host'
$SUPABASE_URL      = 'https://xfeatkzordgnztigplwd.supabase.co'
$SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmZWF0a3pvcmRnbnp0aWdwbHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODE3NDQsImV4cCI6MjA5MDI1Nzc0NH0.TRgFxQ08iLyLAIpXp3WFpiro9S6EPGLbXbX7uATMRG4'

# 1) Login Supabase
$email   = Read-Host 'Email Supabase'
$secPwd  = Read-Host 'Password' -AsSecureString
$BSTR    = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPwd)
$password= [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

Write-Host "`n[*] Login en Supabase..." -ForegroundColor Yellow
try {
  $loginResp = Invoke-RestMethod -Uri "$SUPABASE_URL/auth/v1/token?grant_type=password" `
    -Headers @{ apikey = $SUPABASE_ANON_KEY; 'Content-Type' = 'application/json' } `
    -Method POST -Body (@{ email=$email; password=$password } | ConvertTo-Json) -TimeoutSec 30
} catch {
  Write-Host ("FAIL login: " + $_.Exception.Message) -ForegroundColor Red
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
  exit 1
}
$JWT = $loginResp.access_token
Write-Host "[OK] JWT obtenido (longitud $($JWT.Length))." -ForegroundColor Green

$headers = @{ Authorization = "Bearer $JWT"; Accept = 'application/json' }

function Test-Get {
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

function Test-Post {
  param([string]$Name, [string]$Path, [object]$Body)
  Write-Host "`n=== $Name ===" -ForegroundColor Cyan
  Write-Host "POST $BASE$Path"
  Write-Host ("body: " + ($Body | ConvertTo-Json -Compress))
  try {
    $resp = Invoke-RestMethod -Uri "$BASE$Path" -Headers ($headers + @{ 'Content-Type' = 'application/json' }) `
      -Method POST -Body ($Body | ConvertTo-Json) -TimeoutSec 30
    Write-Host "OK" -ForegroundColor Green
    $resp | ConvertTo-Json -Depth 6 -Compress | Out-String | Write-Host
    return $resp
  } catch {
    Write-Host ("RESP: " + $_.Exception.Message) -ForegroundColor Yellow
    if ($_.ErrorDetails -and $_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
    return $null
  }
}

# 2) GET /studio/rooms (debe devolver 10)
$rooms = Test-Get -Name '1. GET /studio/rooms' -Path '/webhook/api/v1/studio/rooms'
if ($rooms -and $rooms.data) {
  Write-Host ("    rooms count = " + $rooms.data.Count) -ForegroundColor Gray
}

# 3) GET /studio/agents (debe devolver 30 con state)
$agents = Test-Get -Name '2. GET /studio/agents' -Path '/webhook/api/v1/studio/agents'
if ($agents -and $agents.data) {
  Write-Host ("    agents count = " + $agents.data.Count) -ForegroundColor Gray
  $byState = $agents.data | Group-Object state | ForEach-Object { "$($_.Name)=$($_.Count)" }
  Write-Host ("    estados: " + ($byState -join ', ')) -ForegroundColor Gray
}

# 4) GET /studio/feed (ultimos 10 eventos)
$feed = Test-Get -Name '3. GET /studio/feed?limit=10' -Path '/webhook/api/v1/studio/feed?limit=10'
if ($feed -and $feed.data) {
  Write-Host ("    feed count = " + $feed.data.Count) -ForegroundColor Gray
}

# 5) POST /approval-decision con un UUID inventado (esperado: 404 NOT_FOUND, lo que valida la ruta)
Test-Post -Name '4. POST /approval-decision (UUID falso, espera 404)' `
  -Path '/webhook/api/v1/approval-decision' `
  -Body @{ approval_id = '00000000-0000-0000-0000-000000000000'; decision = 'approve'; notes = 'smoke test' }

Write-Host "`n=== FIN smoke X7 ===" -ForegroundColor Cyan
