# 서비스 마감 스크랩 — 로컬 폴러 (회사 PC, 작업 스케줄러가 5분마다 호출)
#
# 웹/GitHub Actions는 Cloudflare 차단으로 스크랩 직접 실행 불가 → 회사 PC(residential IP)에서만 동작.
# OPS의 '로컬 실행 요청'(closing_scrape_requests pending)을 claim해 run-local.ps1을 실행하고
# 완료를 보고한다. pending이 없으면 즉시 종료.
#
# 자격: 레포 루트 .env.local의 CRON_SECRET / OPS_CONSOLE_BASE_URL 사용 (scrape.py와 동일).
# 등록: register-poll-task.ps1 (5분 간격).

$ErrorActionPreference = "Stop"
# scripts/moa-closing → scripts → repo root
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repo

# --- .env.local에서 키 읽기 ---
function Get-DotEnv([string]$path, [string]$key) {
    if (-not (Test-Path $path)) { return "" }
    foreach ($line in Get-Content $path) {
        if ($line -match "^\s*$([regex]::Escape($key))\s*=\s*(.*)$") {
            return $matches[1].Trim().Trim('"')
        }
    }
    return ""
}

$envPath = Join-Path $repo ".env.local"
$secret = Get-DotEnv $envPath "CRON_SECRET"
$base = (Get-DotEnv $envPath "OPS_CONSOLE_BASE_URL").TrimEnd("/")
if (-not $secret -or -not $base) {
    Write-Host "[poll] CRON_SECRET / OPS_CONSOLE_BASE_URL 미설정 — 종료"
    exit 1
}

$headers = @{ Authorization = "Bearer $secret" }
$uri = "$base/api/closing/scrape-request"

# --- 1) pending claim ---
$claim = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
if (-not $claim.request) {
    # 대기 요청 없음 — 정상 종료
    exit 0
}
$id = $claim.request.id
Write-Host "[poll] 요청 claim: $id (by $($claim.request.requested_by))"

# --- 2) run-local 실행 ---
$ok = $false
$msg = ""
try {
    & (Join-Path $PSScriptRoot "run-local.ps1")
    $code = $LASTEXITCODE
    $ok = ($code -eq 0)
    $msg = "exit $code"
} catch {
    $msg = "poller 예외: $($_.Exception.Message)"
}

# --- 3) 완료 보고 ---
$body = @{ id = $id; ok = $ok; message = $msg } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri $uri -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $body | Out-Null
Write-Host "[poll] 완료 보고: ok=$ok ($msg)"
exit 0
