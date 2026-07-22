# 팀 브리핑 발행 — Windows 작업 스케줄러 등록 (이 PC에서 1회 실행)
#
# 매주 금 10:00 team-briefing-publish.cmd 실행 -> draft 집계 + claude -p 스토리 +
# 뉴스레터 발행(/r/briefing/[token]) + Teams 티저. claude 실패 시 수치 요약 폴백.
# claude -p OAuth 구독은 로그인 사용자 세션에서만 유효하므로 InteractiveToken(로그온 시에만) —
# mailbox-ingest / dev-control-analyze 와 동일한 검증된 실행 모드다.
#
# 전제: 레포 루트 .env.local 에 OPS_CONSOLE_BASE_URL(프로덕션 URL) + CRON_SECRET.
#
# 등록:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-team-briefing-task.ps1
# 해제:
#   Unregister-ScheduledTask -TaskName "OPS-Console-Team-Briefing" -Confirm:$false
#
# 주의:
#   - 집 Mac mini 의 team-briefing launchd 는 등록하지 않는다(중복 발행 + Mac 은 claude 인증 불가).
#   - Vercel / cron-job.org 의 금 10:00 team-briefing 스케줄이 있으면 제거해야 중복 발행이 안 난다.

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$cmd = Join-Path $repo "scripts\team-briefing\team-briefing-publish.cmd"
if (-not (Test-Path $cmd)) { throw "래퍼 없음: $cmd" }

$taskName = "OPS-Console-Team-Briefing"

$action = New-ScheduledTaskAction -Execute $cmd

# 매주 금요일 10:00
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At 10:00am

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

$desc = "팀 브리핑 발행 — draft + claude -p 스토리 + 뉴스레터 + Teams 티저 (매주 금 10:00, 로그온 시)."

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description $desc -Force | Out-Null

Write-Host "[OK] 등록 완료: '$taskName' (매주 금 10:00, 로그온 시에만)"
Write-Host "     발행 없이 스토리만 미리보기(드라이런):  node scripts\team-briefing\publish-local.mjs --dry"
Write-Host "     실제 1회 발행 테스트(뉴스레터+Teams 발송):  Start-ScheduledTask -TaskName '$taskName'"
Write-Host "     [중요] Vercel/cron-job.org 의 금 10:00 team-briefing 스케줄을 제거하세요 (중복 발행 방지)."
