# 배정 판정 로컬 폴러 — Windows 작업 스케줄러 등록 (이 PC에서 1회 실행)
#
# 5분마다 propose-local.mjs를 실행해 판정 요청(pending)을 확인한다.
# pending이 없으면 즉시 종료(가벼움). 있으면 claim해 Agent SDK로 판정하고 회신한다.
#
# **상주가 아니다.** 어시스턴트 폴러는 채팅이라 5분을 못 기다려 상주지만, 배정은
# 연 1회 + 평일 1건 규모라 5분 단발로 충분하다 — 상주 프로세스를 하나 덜 둔다.
#
# 기본(로그온 시에만):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assignments/register-propose-task.ps1
# 무인(로그오프 상태에서도 — S4U, 비밀번호 불필요): 권장
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assignments/register-propose-task.ps1 -Unattended
# 무인(비밀번호 저장 폴백):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/assignments/register-propose-task.ps1 -StorePassword
#
# 해제: Unregister-ScheduledTask -TaskName "OPS-Console-Assignment-Propose" -Confirm:$false

param([switch]$Unattended, [switch]$StorePassword)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runner = Join-Path $repo "scripts\assignments\propose-local.mjs"
if (-not (Test-Path $runner)) { throw "poller 없음: $runner" }

$taskName = "OPS-Console-Assignment-Propose"
$log = Join-Path $repo "assignment-propose-poller.log"

# node가 통째로 죽을 때 나오는 스택은 console을 안 거치므로 리다이렉트만이 잡는다
# (어시스턴트 폴러가 같은 이유로 그렇게 한다) — 폴러가 조용히 죽는 걸 보려는 로그다.
$action = New-ScheduledTaskAction -Execute "cmd.exe" `
    -Argument "/c node `"$runner`" >> `"$log`" 2>&1" `
    -WorkingDirectory $repo

# 5분마다 반복. 정기 트리거가 아니라 on-demand 요청 폴링용이다.
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) `
    -RepetitionInterval (New-TimeSpan -Minutes 5) `
    -RepetitionDuration (New-TimeSpan -Days 3650)

# ExecutionTimeLimit은 판정 제한(JUDGE_TIMEOUT_MS=10분)보다 넉넉해야 한다 —
# 경계에 걸려 강제 종료되면 회신이 못 나가고 running이 STALE까지 큐를 잠근다
# (경쟁률 점검이 20분 제한 때 그 경계에 걸렸다, 2026-08-28).
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 15)

$desc = "배정 판정 요청 폴러. 5분마다 pending 확인 -> Agent SDK 판정 -> 서버 회신."

$user = "$env:USERDOMAIN\$env:USERNAME"

if ($StorePassword) {
    $cred = Get-Credential -UserName $user `
        -Message "Windows 로그인 비밀번호 (로그오프 상태에서도 폴러가 실행되도록 저장)"
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -RunLevel Limited `
        -User $cred.UserName -Password $cred.GetNetworkCredential().Password `
        -Description $desc -Force | Out-Null
    Write-Host "[OK] 무인(비밀번호 저장) 폴러 등록 완료: '$taskName' (5분 간격)"
}
elseif ($Unattended) {
    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -Principal $principal `
        -Description $desc -Force | Out-Null
    Write-Host "[OK] 무인(S4U) 폴러 등록 완료: '$taskName' (5분 간격, 로그온 여부 무관)"
}
else {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -Description $desc -Force | Out-Null
    Write-Host "[OK] 폴러 등록 완료: '$taskName' (로그온 시에만, 5분 간격)"
    Write-Host "     로그오프 상태에서도 돌리려면:  register-propose-task.ps1 -Unattended"
}

Write-Host "     지금 1회 테스트:  Start-ScheduledTask -TaskName '$taskName'"
Write-Host "     로그:  $log"
