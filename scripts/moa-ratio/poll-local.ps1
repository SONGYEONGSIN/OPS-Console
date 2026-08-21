# 경쟁률 세팅 점검 — 로컬 폴러 (회사 PC, 작업 스케줄러가 5분마다 호출)
#
# audit.py는 Selenium(브라우저) + Moa 로그인 + 로컬 claude -p 판정이 필요해 Vercel
# 서버에서 실행 불가 → 회사 PC(residential IP)에서만 동작. closing_scrape_requests와
# 동일 패턴을 그대로 복제했다 — scripts/moa-closing/poll-local.ps1 참조.
#
# OPS의 '로컬 실행 요청'(ratio_audit_requests pending)을 claim해 audit.py를 실행하고
# 완료를 보고한다. pending이 없으면 즉시 종료.
#
# 자격: 레포 루트 .env.local의 CRON_SECRET / OPS_CONSOLE_BASE_URL 사용. audit.py 자체는
# scrape 모듈을 import할 때 .env.local을 자동 로드하므로(MOA_USERNAME/MOA_PASSWORD/
# MAKE_SMS_CODE_URL 등) 이 폴러가 별도로 환경변수를 주입할 필요는 없다.
#
# MANUAL_CODE_FILE(수동 2FA 코드 입력 경로)은 여기서 설정하지 않는다 — Make 웹훅 기반
# 자동 2FA가 복구되어 정상 동작하므로, 설정하지 않으면 audit.py가 기본(웹훅 폴링)
# 경로를 그대로 탄다.
#
# 등록: register-poll-task.ps1 (5분 간격).

$ErrorActionPreference = "Stop"
# scripts/moa-ratio → scripts → repo root
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

# 살아있음을 남긴다 — 이 스크립트는 5분마다 한 번 돌고 끝나므로 그 실행이 곧 심박이다.
# 큐가 조용하면 이게 생사의 유일한 증거다(2026-08-20 어시스턴트 폴러가 12시간 죽어 있었다).
. (Join-Path $PSScriptRoot "../lib/Heartbeat.ps1")
Send-PollerHeartbeat -BaseUrl $base -Secret $secret -PollerId "ratio-audit"

$headers = @{ Authorization = "Bearer $secret" }
$uri = "$base/api/ratio-audit/audit-request"

# --- 1) pending claim ---
$claim = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers
if (-not $claim.request) {
    # 대기 요청 없음 — 정상 종료
    exit 0
}
$id = $claim.request.id
# 종류를 안 주는 구버전 요청은 스케줄 점검으로 본다.
$kind = if ($claim.request.kind) { $claim.request.kind } else { "schedule" }
Write-Host "[poll] 요청 claim: $id / $kind (by $($claim.request.requested_by))"

# --- 2) audit.py 실행 ---
$log = Join-Path $repo "scripts\moa-ratio\poll-local.log"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"=== $ts 시작 (요청 $id / $kind) ===" | Out-File -Append -Encoding utf8 $log

$ok = $false
$msg = ""
# python이 stderr에 한 줄이라도 쓰면 $ErrorActionPreference='Stop'이 그 줄에서 터져
# 트레이스백 나머지가 로그에도, 완료 보고에도 남지 않았다(2026-08-03 — 실제 원인인
# UnicodeEncodeError가 통째로 유실되고 'Traceback (most recent call last):'만 보고됨).
# 실행 구간만 Continue로 낮춰 전문을 남기고, 성패는 exit code로 판단한다.
$prev = $ErrorActionPreference
$ErrorActionPreference = "Continue"
try {
    # 무엇을 점검할지는 요청이 정한다 — 스케줄(세팅·문구) / 페이지(HTML 링크 상태)
    $env:RATIO_AUDIT_KIND = $kind
    $output = & python "scripts\moa-ratio\audit.py" 2>&1
    $code = $LASTEXITCODE
    $output | Out-File -Append -Encoding utf8 $log
    $ok = ($code -eq 0)
    if ($ok) {
        $msg = "exit 0"
    } else {
        # 마지막 몇 줄에 원인이 들어 있다 — OPS 실행 로그에서 바로 보이게 함께 보고한다.
        $tail = (($output | Select-Object -Last 3) -join " / ")
        if ($tail.Length -gt 300) { $tail = $tail.Substring($tail.Length - 300) }
        $msg = "exit $code — $tail"
    }
} catch {
    $msg = "poller 예외: $($_.Exception.Message)"
} finally {
    $ErrorActionPreference = $prev
}

"=== $ts 종료 ($msg) ===" | Out-File -Append -Encoding utf8 $log

# --- 3) 완료 보고 ---
$body = @{ id = $id; ok = $ok; message = $msg } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri $uri -Headers ($headers + @{ "Content-Type" = "application/json" }) -Body $body | Out-Null
Write-Host "[poll] 완료 보고: ok=$ok ($msg)"
exit 0
