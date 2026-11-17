# 주간업무보고 개발/테스트 구분 수집 — 로컬 실행 래퍼 (Windows 작업 스케줄러가 호출)
#
# Moa 에 로그인해(SMS 인증번호 우편함 사용) 이번 주 개발·테스트 현황을 수집해 OPS 에 적재한다.
# Moa 로그인은 마감 스크랩과 같은 계정·같은 문자함을 쓴다. 두 로그인이 겹치면 인증번호가
# 서로 섞이므로, 마감 스크랩 작업이 도는 중이면 끝날 때까지 기다린다(최대 25분).
# 자격증명 등은 레포 루트 .env.local 에서 collect.py 가 자동 로드한다.

$ErrorActionPreference = "Stop"
# scripts/moa-dev-status → scripts → repo root
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
Set-Location $repo

$env:HEADLESS_MODE = "true"
# OPS_WEEKLY_DEV_STATUS_DRY_RUN 미설정 = 실제 적재. 테스트만 하려면 아래 줄 주석 해제:
# $env:OPS_WEEKLY_DEV_STATUS_DRY_RUN = "true"

$log = Join-Path $repo "scripts\moa-dev-status\run-local.log"
$ts = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"=== $ts 시작 (HEADLESS=$($env:HEADLESS_MODE) DRY_RUN=$($env:OPS_WEEKLY_DEV_STATUS_DRY_RUN)) ===" |
    Out-File -Append -Encoding utf8 $log

# 마감 스크랩이 Running 이면 30초 간격으로 기다린다. 작업이 없으면(미등록) 기다리지 않는다.
$closing = Get-ScheduledTask -TaskName 'OPS-Console-Closing-Scrape' -ErrorAction SilentlyContinue
if ($null -eq $closing) {
    "마감 스크랩 작업을 찾지 못해 기다리지 않고 진행" | Out-File -Append -Encoding utf8 $log
}
else {
    $deadline = (Get-Date).AddMinutes(25)
    while ($closing.State -eq 'Running' -and (Get-Date) -lt $deadline) {
        Start-Sleep -Seconds 30
        $closing = Get-ScheduledTask -TaskName 'OPS-Console-Closing-Scrape' -ErrorAction SilentlyContinue
        if ($null -eq $closing) { break }
    }
    if ($null -ne $closing -and $closing.State -eq 'Running') {
        "마감 스크랩이 25분이 지나도 실행 중 — 기다림을 멈추고 진행" | Out-File -Append -Encoding utf8 $log
    }
}

# python 호출 동안만 Stop을 푼다.
# Stop인 채로 `*>>` 리다이렉트를 쓰면 python이 stderr로 '경고 한 줄'만 뱉어도 PowerShell이
# 이를 종료 오류로 승격시켜 스크립트가 그 자리에서 죽는다(마감 래퍼 2026-08-12 사고와 같다).
# 실패 판정은 종료 코드로 한다.
$ErrorActionPreference = "Continue"
python -I -X utf8 -u "scripts\moa-dev-status\collect.py" *>> $log
# python 자체를 못 찾으면 $LASTEXITCODE가 안 잡히므로 실패로 본다.
$code = if ($null -eq $LASTEXITCODE) { 1 } else { $LASTEXITCODE }
$ErrorActionPreference = "Stop"

$end = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"=== $end 종료 (exit $code) ===" | Out-File -Append -Encoding utf8 $log
exit $code
