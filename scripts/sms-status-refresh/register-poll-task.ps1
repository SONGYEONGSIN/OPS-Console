# SMS 현황 최신화 로컬 폴러 — Windows 작업 스케줄러 등록 (Excel 이 깔린 이 PC 에서, 로그온 상태로 1회 실행)
#
# 5분마다 poll-local.ps1 을 실행해 내부관리자 화면의 '현황 최신화' 요청(pending)을 확인한다.
# pending 이 있으면 refresh.py 를 실행하고, 없으면 즉시 종료(가벼움).
#
# **로그온 세션에서만 돈다.** 무인 모드(로그오프 상태 실행·비밀번호 저장)는 일부러 없다 —
# 현황 파일 갱신 단계가 Excel COM 을 쓰는데, Excel COM 은 비대화형 세션에서 안정적으로 돌지 않는다.
#
# 실행 제한 30분: 정상 소요(약 10분)의 두 배 이상이고, 서버가 '죽었다'고 보는 40분
# (status-refresh/enqueue.ts STALE_RUNNING_MS)보다 짧아야 한다 — 둘은 stale-vs-limit.test.ts 가 묶는다.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\sms-status-refresh\register-poll-task.ps1
#
# 해제: Unregister-ScheduledTask -TaskName "OPS-Console-Sms-Status-Refresh-Poll" -Confirm:$false

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runner = Join-Path $repo "scripts\sms-status-refresh\poll-local.ps1"
if (-not (Test-Path $runner)) { throw "poller 없음: $runner" }

$taskName = "OPS-Console-Sms-Status-Refresh-Poll"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`""

# 5분마다 반복 (지금부터, 사실상 무기한). 정기 실행이 아니라 버튼 요청 폴링용.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

$desc = "OPS SMS 현황 최신화 요청 폴러. 5분마다 pending 확인 → refresh.py 실행(Moa 수집 등). Excel 이 깔린 이 PC, 로그온 상태에서만."

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description $desc -Force | Out-Null

Write-Host "[OK] 폴러 등록 완료: '$taskName' (로그온 시에만, 5분 간격, 실행 제한 30분)"
Write-Host "     동작 확인:        Get-ScheduledTask -TaskName '$taskName' | Get-ScheduledTaskInfo  (NextRunTime 이 비어 있지 않은지)"
Write-Host "     로그 확인:        Get-Content scripts\sms-status-refresh\poll-local.log -Tail 40"
