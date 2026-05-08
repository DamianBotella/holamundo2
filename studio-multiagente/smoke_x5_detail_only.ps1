# Smoke aislado: solo prueba detail con UUID fijo
$BASE              = 'https://n8n-n8n.zzeluw.easypanel.host'
$SUPABASE_URL      = 'https://xfeatkzordgnztigplwd.supabase.co'
$SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmZWF0a3pvcmRnbnp0aWdwbHdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2ODE3NDQsImV4cCI6MjA5MDI1Nzc0NH0.TRgFxQ08iLyLAIpXp3WFpiro9S6EPGLbXbX7uATMRG4'
$PROJ_ID           = '57969cbf-cdd7-4dfb-8736-31e8bba7606f'  # TEST X3 PRE-RLS FULL

$email   = Read-Host 'Email Supabase'
$secPwd  = Read-Host 'Password' -AsSecureString
$BSTR    = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secPwd)
$password= [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
[System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR)

$loginResp = Invoke-RestMethod -Uri "$SUPABASE_URL/auth/v1/token?grant_type=password" `
  -Headers @{ apikey = $SUPABASE_ANON_KEY; 'Content-Type' = 'application/json' } `
  -Method POST -Body (@{ email=$email; password=$password } | ConvertTo-Json) -TimeoutSec 30
$JWT = $loginResp.access_token
Write-Host "[OK] JWT len=$($JWT.Length)" -ForegroundColor Green

$headers = @{ Authorization = "Bearer $JWT"; Accept = 'application/json' }

Write-Host "`n=== TEST: GET /webhook/api/v1/project-detail/$PROJ_ID ===" -ForegroundColor Cyan
try {
  $resp = Invoke-RestMethod -Uri "$BASE/webhook/api/v1/project-detail/$PROJ_ID" -Headers $headers -Method GET -TimeoutSec 30
  Write-Host "OK" -ForegroundColor Green
  $resp | ConvertTo-Json -Depth 6 -Compress | Out-String | Write-Host
} catch {
  Write-Host ("FAIL: " + $_.Exception.Message) -ForegroundColor Red
  if ($_.ErrorDetails -and $_.ErrorDetails.Message) { Write-Host $_.ErrorDetails.Message }
}
