# 서비스 마감 스크랩 — Windows 작업 스케줄러 등록 (이 PC에서 1회 실행)
#
# 매주 월요일 10:00에 run-local.ps1을 실행. 격주 off주는 스크래퍼가 스스로 [SKIP] 종료하므로
# 트리거는 매주로 둔다. 헤드리스라 화면(데스크톱 세션)이 필요 없다.
#
# 기본(로그온 시에만 실행):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/moa-closing/register-task.ps1
#
# 무인(로그오프 상태에서도 실행 — S4U, 비밀번호 불필요): 권장
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/moa-closing/register-task.ps1 -Unattended
#   -> Windows 비밀번호 없이 등록. 로컬 Chrome + 아웃바운드 HTTP엔 충분(제한 토큰). PC는 켜져 있어야 함.
#
# 무인(비밀번호 저장 방식 — S4U가 네트워크 제약 등으로 안 될 때 폴백):
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/moa-closing/register-task.ps1 -StorePassword
#   -> 실행 시 Windows 비밀번호 프롬프트(작업에 암호화 저장). 회사가 비번 바꾸면 재등록 필요.
#
# 해제: Unregister-ScheduledTask -TaskName "OPS-Console-Closing-Scrape" -Confirm:$false

param([switch]$Unattended, [switch]$StorePassword)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$runner = Join-Path $repo "scripts\moa-closing\run-local.ps1"
if (-not (Test-Path $runner)) { throw "runner 없음: $runner" }

$taskName = "OPS-Console-Closing-Scrape"

$action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`""

# 매주 월요일 10:00 (격주 판정은 스크래퍼 내부 게이트)
$trigger = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At 10:00am

# 꺼져 있었으면 다음 켜질 때 실행, 절전이면 깨워서 실행 시도, 배터리에서도 실행.
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -WakeToRun `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 20)

$desc = "Moa 서비스마감 스크랩 -> OPS 적재. 매주 월 10:00(격주는 스크래퍼가 판정). 회사/가정 IP라 Cloudflare 통과."

$user = "$env:USERDOMAIN\$env:USERNAME"

if ($StorePassword) {
    # 비밀번호 저장 방식 — 풀 토큰(네트워크 자격증명 포함). 비번 만료 시 재등록 필요.
    $cred = Get-Credential -UserName $user `
        -Message "Windows 로그인 비밀번호 (로그오프 상태에서도 작업이 실행되도록 저장)"
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -RunLevel Limited `
        -User $cred.UserName -Password $cred.GetNetworkCredential().Password `
        -Description $desc -Force | Out-Null
    Write-Host "[OK] 무인(비밀번호 저장) 등록 완료: '$taskName' (로그온 여부 무관)"
    Write-Host "     주의: 회사가 비밀번호를 바꾸면 -StorePassword로 재등록 필요."
}
elseif ($Unattended) {
    # S4U — 로그온 여부 무관 실행, 비밀번호 불필요(제한 토큰). 로컬+아웃바운드 HTTP에 충분.
    $principal = New-ScheduledTaskPrincipal -UserId $user -LogonType S4U -RunLevel Limited
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -Principal $principal `
        -Description $desc -Force | Out-Null
    Write-Host "[OK] 무인(S4U, 비밀번호 불필요) 등록 완료: '$taskName' (로그온 여부 무관)"
    Write-Host "     네트워크 제약 등으로 안 되면:  register-task.ps1 -StorePassword"
}
else {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
        -Settings $settings -Description $desc -Force | Out-Null
    Write-Host "[OK] 등록 완료: '$taskName' (로그온 시에만 실행, 매주 월 10:00)"
    Write-Host "     로그오프 상태에서도 돌리려면:  register-task.ps1 -Unattended"
}

Write-Host "     지금 1회 테스트:  Start-ScheduledTask -TaskName '$taskName'"
Write-Host "     로그 확인:        Get-Content scripts\moa-closing\run-local.log -Tail 40"
