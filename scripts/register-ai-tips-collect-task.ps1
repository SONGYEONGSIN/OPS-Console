# AI TIP 후보 수집 — Windows 작업 스케줄러 등록 (이 PC에서 1회 실행)
#
# 매주 월 09:00 ai-tips-collect.cmd 실행 -> 이미 본 리포 조회 + GitHub 검색 +
# README 발췌 + claude -p 초안 생성 + 후보 적재(/api/ai-tips/candidates). claude 실패 시
# 리포 정보만 적재(초안은 사람이 나중에 채운다).
# claude -p OAuth 구독은 로그인 사용자 세션에서만 유효하므로 InteractiveToken(로그온 시에만) —
# mailbox-ingest / dev-control-analyze 와 동일한 검증된 실행 모드다.
#
# 전제: 레포 루트 .env.local 에 OPS_CONSOLE_BASE_URL(프로덕션 URL) + CRON_SECRET.
#
# 등록:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-ai-tips-collect-task.ps1
# 해제:
#   Unregister-ScheduledTask -TaskName "OPS-Console-AiTips-Collect" -Confirm:$false

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$cmd = Join-Path $repo "scripts\ai-tips\ai-tips-collect.cmd"
if (-not (Test-Path $cmd)) { throw "래퍼 없음: $cmd" }

$taskName = "OPS-Console-AiTips-Collect"

$action = New-ScheduledTaskAction -Execute $cmd

# 매주 월요일 09:00
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 9:00am

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

$desc = "AI TIP 후보 수집 — GitHub 검색 + claude -p 초안 + 후보 적재 (매주 월 09:00, 로그온 시)."

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description $desc -Force | Out-Null

Write-Host "[OK] 등록 완료: '$taskName' (매주 월 09:00, 로그온 시에만)"
Write-Host "     발행 없이 후보만 미리보기(드라이런):  node scripts\ai-tips\collect-local.mjs --dry"
Write-Host "     실제 1회 수집 테스트(서버 적재):  Start-ScheduledTask -TaskName '$taskName'"
