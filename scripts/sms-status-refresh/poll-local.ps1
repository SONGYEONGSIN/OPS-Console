# SMS 현황 최신화 — 로컬 폴러 (회사 PC, 작업 스케줄러가 5분마다 호출)
#
# 내부관리자 화면의 '현황 최신화' 버튼이 sms_status_refresh_requests 에 pending 을 넣으면
# 이 폴러가 claim 해 refresh.py 를 돌리고 결과를 보고한다. pending 이 없으면 즉시 종료.
# 골격은 scripts/moa-ratio/poll-local.ps1 과 같다.
#
# **결과 본문은 바이트 그대로 보낸다.** refresh.py 가 ASCII JSON(body.json)을 쓰고, 여기서는
# [IO.File]::ReadAllBytes 로 읽어 그대로 POST 한다. ConvertFrom-Json → ConvertTo-Json 을 거치면
# Windows PowerShell 5.1 의 기본 깊이 2 에서 단계 결과가 잘리고, 문자열 본문은 ISO-8859-1 로
# 바뀌어 한글이 물음표가 된다. 그래서 이 파일은 결과 파일을 해석하지 않는다.
#
# 자격: 레포 루트 .env.local 의 CRON_SECRET / OPS_CONSOLE_BASE_URL. Moa·Graph 자격은
# refresh.py 가 같은 .env.local 을 읽는다.
#
# 등록: register-poll-task.ps1 (5분 간격, 로그온 세션에서만 — 뒤에 붙을 Excel COM 때문).
# 작업 폴더를 남기려면(진단용) SMS_STATUS_REFRESH_KEEP_WORK=true.

$ErrorActionPreference = "Stop"
# scripts/sms-status-refresh → scripts → repo root
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repo

# --- .env.local 에서 키 읽기 ---
function Get-DotEnv([string]$path, [string]$key) {
    if (-not (Test-Path $path)) { return "" }
    foreach ($line in Get-Content -Encoding UTF8 $path) {
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

# 살아있음을 남긴다 — 5분마다 한 번 돌고 끝나므로 그 실행이 곧 심박이다.
. (Join-Path $PSScriptRoot "../lib/Heartbeat.ps1")
Send-PollerHeartbeat -BaseUrl $base -Secret $secret -PollerId "sms-status-refresh"

$headers = @{ Authorization = "Bearer $secret" }
$uri = "$base/api/sms-status-refresh/request"
$jsonType = "application/json; charset=utf-8"

# 실패 보고용 최소 본문 — message 에 한글이 섞이므로 UTF-8 바이트로 만든다.
function Get-MinimalBody([string]$id, [string]$message) {
    $json = @{ id = $id; ok = $false; message = $message } | ConvertTo-Json -Compress
    return [Text.Encoding]::UTF8.GetBytes($json)
}

function Send-Result([byte[]]$bytes) {
    Invoke-RestMethod -Method Post -Uri $uri -Headers $headers -ContentType $jsonType `
        -Body $bytes -TimeoutSec 60 | Out-Null
}

# --- 1) pending claim ---
$claim = Invoke-RestMethod -Method Get -Uri $uri -Headers $headers -TimeoutSec 30
if (-not $claim.request) {
    # 대기 요청 없음 — 정상 종료
    exit 0
}
$id = [string]$claim.request.id
Write-Host "[poll] 요청 claim: $id"

# --- 2) 작업 폴더 + 기준 시각 ---
$work = Join-Path $env:TEMP "sms-status-refresh\$id"
New-Item -ItemType Directory -Force -Path $work | Out-Null
$wmPath = Join-Path $work "watermarks.json"
$bodyPath = Join-Path $work "body.json"
# 기준 시각은 '키 → 시각 문자열' 평평한 객체라 ConvertTo-Json 깊이 문제가 없다.
$wmJson = "{}"
if ($null -ne $claim.request.watermarks) {
    $wmJson = $claim.request.watermarks | ConvertTo-Json -Compress
}
[IO.File]::WriteAllText($wmPath, $wmJson, [Text.Encoding]::UTF8)

# --- 3) refresh.py 실행 ---
$log = Join-Path $repo "scripts\sms-status-refresh\poll-local.log"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"=== $ts 시작 (요청 $id) ===" | Out-File -Append -Encoding utf8 $log

$code = -1
$tail = ""
# python 이 stderr 에 한 줄이라도 쓰면 Stop 이 그 줄에서 터져 트레이스백이 사라진다
# (moa-ratio 2026-08-03). 실행 구간만 Continue 로 낮추고 성패는 exit code 로 본다.
# python 은 UTF-8 로 쓰므로(-X utf8) 콘솔 해석도 UTF-8 로 맞춘다 — 아니면 로그 한글이 CP949 로 깨진다.
$prevPref = $ErrorActionPreference
$prevOut = [Console]::OutputEncoding
$ErrorActionPreference = "Continue"
try {
    [Console]::OutputEncoding = [Text.Encoding]::UTF8
} catch {
    # 콘솔이 없는 세션이면 못 바꾼다 — 로그 한글만 깨질 뿐 실행은 계속한다.
    "[poll] 콘솔 인코딩 변경 실패 — 로그 한글이 깨질 수 있음" | Out-File -Append -Encoding utf8 $log
}
try {
    # 한 줄씩 바로 파일에 쓴다 — 실행 제한에 잘려도 어디까지 갔는지 남는다. -u 가 있어야 실시간이다.
    $output = & python -I -X utf8 -u "scripts\sms-status-refresh\refresh.py" `
        --request-id $id --work-dir $work --watermarks $wmPath --out $bodyPath 2>&1 | ForEach-Object {
        $line = "$_"
        $line | Out-File -Append -Encoding utf8 $log
        $line
    }
    $code = $LASTEXITCODE
    $tail = (($output | Select-Object -Last 3) -join " / ")
    if ($tail.Length -gt 300) { $tail = $tail.Substring($tail.Length - 300) }
} catch {
    $tail = "poller 예외: $($_.Exception.GetType().Name)"
} finally {
    [Console]::OutputEncoding = $prevOut
    $ErrorActionPreference = $prevPref
}

# --- 4) 완료 보고 ---
$minimal = Get-MinimalBody $id "exit $code — $tail"
$reported = $false
if ($code -eq 0 -and (Test-Path $bodyPath)) {
    try {
        Send-Result ([IO.File]::ReadAllBytes($bodyPath))
        $reported = $true
        $msg = "결과 보고"
    } catch {
        # 서버가 본문을 거절(400 등)하면 최소 본문으로 한 번 더 — running 이 40분 큐를 막지 않게.
        $msg = "결과 보고 실패($($_.Exception.GetType().Name)) — 최소 본문으로 다시"
        $minimal = Get-MinimalBody $id "결과 본문 보고 실패 — exit $code"
    }
} else {
    $msg = "결과 파일 없음(exit $code) — 최소 본문으로 보고"
}
if (-not $reported) {
    try {
        Send-Result $minimal
        $reported = $true
    } catch {
        $msg = "$msg / 최소 본문 보고도 실패: $($_.Exception.GetType().Name)"
    }
}

$te = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"=== $te 종료 ($msg, reported=$reported) ===" | Out-File -Append -Encoding utf8 $log
Write-Host "[poll] $msg (reported=$reported)"

# --- 5) 작업 폴더 정리 ---
$keep = $env:SMS_STATUS_REFRESH_KEEP_WORK
if (-not $keep) { $keep = Get-DotEnv $envPath "SMS_STATUS_REFRESH_KEEP_WORK" }
if ($keep -ne "true") {
    Remove-Item -Recurse -Force -Path $work -ErrorAction SilentlyContinue
}

if (-not $reported) { exit 1 }
exit 0
