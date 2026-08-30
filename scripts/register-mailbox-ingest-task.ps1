# 메일함 ingest — Windows 작업 스케줄러 등록 (이 PC에서 1회 실행)
#
# 08~20시 10분마다 mailbox-ingest.cmd 실행 → Outlook 수집 + auto_draft 운영자 대상 claude -p 회신 초안.
#
# 야간(20~08시)은 돌지 않는다. 실측(2026-08-23~29) 1,000회 중 실제 수집은 51회(5.1%)였고
# 00~08시·20~23시 504회는 7일 내내 전부 빈손이었다. 수집은 last_synced_at 델타라
# 밤에 꺼도 메일을 놓치지 않는다 — 아침 첫 실행이 밀린 것을 가져온다.
# claude -p OAuth 구독은 로그인 사용자 세션에서만 유효하므로 기본은 InteractiveToken(로그온 시에만).
# 이는 claude -p를 쓰는 OPS-DevControlAnalyze와 동일한 검증된 실행 모드다.
#
# 등록:
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-mailbox-ingest-task.ps1
# 해제:
#   Unregister-ScheduledTask -TaskName "OPS-Console-Mailbox-Ingest" -Confirm:$false
#
# 주의: 이 작업을 등록하면 다른 머신(집 Mac mini 등)의 mailbox-ingest 크론은 반드시 중지해야 한다.
#       두 곳이 동시에 돌면 last_synced_at 레이스로 서로 새 메일을 놓쳐 초안이 안 생길 수 있다.

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$cmd = Join-Path $repo "scripts\mailbox-ingest.cmd"
if (-not (Test-Path $cmd)) { throw "래퍼 없음: $cmd" }

$taskName = "OPS-Console-Mailbox-Ingest"

$action = New-ScheduledTaskAction -Execute $cmd

# 매일 08:00 시작 → 10분 간격으로 12시간(=20:00까지) 반복.
# PowerShell 은 -Daily 에 -RepetitionInterval 을 직접 못 받는다. -Once 트리거에서
# 반복 패턴만 떼어 매일 트리거에 붙이는 게 문서화된 방법이다.
$trigger = New-ScheduledTaskTrigger -Daily -At 08:00
$trigger.Repetition = (New-ScheduledTaskTrigger -Once -At 08:00 `
    -RepetitionInterval (New-TimeSpan -Minutes 10) `
    -RepetitionDuration (New-TimeSpan -Hours 12)).Repetition

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

$desc = "메일함 ingest — Outlook 수집 + claude -p AI 회신 초안 (08~20시 10분 간격, 로그온 시). 야간은 수집 실적이 0이라 정지."

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description $desc -Force | Out-Null

Write-Host "[OK] 등록 완료: '$taskName' (로그온 시에만, 08~20시 10분 간격 — 하루 144회에서 약 73회로)"
Write-Host "     지금 1회 테스트:  Start-ScheduledTask -TaskName '$taskName'"
Write-Host "     [중요] 집 Mac mini의 mailbox-ingest 크론(launchd)을 반드시 중지하세요 (중복 실행 방지)."
