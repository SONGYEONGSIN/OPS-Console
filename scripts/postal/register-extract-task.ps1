# 우편물 영수증 판독 폴러를 회사 PC에 등록 (관리자 PowerShell에서 1회 실행)
#
# 어시스턴트 폴러와 **별개 프로세스**다 — 하나가 죽어도 다른 하나는 살아 있어야 한다.
# 판독은 사람이 [추출]을 눌렀을 때만 돌지만, 눌렀을 때 바로 받으려면 상주해야 한다.
#
# 사전 조건:
#   1) 이 PC에서 `claude` 로그인 (구독 OAuth). `claude -p "hi"` 로 확인.
#   2) 레포 .env.local 에 OPS_CONSOLE_BASE_URL / CRON_SECRET
#   3) npm ci 로 @anthropic-ai/claude-agent-sdk 설치 (devDependency)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$node = "C:\Program Files\nodejs\node.exe"
$script = Join-Path $repo "scripts\postal\extract-local.mjs"
$log = Join-Path $repo "postal-poller.log"
$taskName = "OPS-Console 우편물 판독 폴러"

if (-not (Test-Path $node)) { throw "node.exe 없음: $node" }
if (-not (Test-Path $script)) { throw "스크립트 없음: $script" }

# 작업 스케줄러는 stdout을 버린다. cmd로 감싸 로그 파일에 붙인다.
#
# 폴러가 스스로 파일에 쓰게 하는 방법은 어시스턴트에서 시도했다가 되돌렸다 —
# cmd 가 그 파일을 쥐고 있어 쓰기가 매번 EBUSY 로 튕겼다(#1020). 무엇보다
# **node 가 통째로 죽을 때 나오는 스택은 console 을 거치지 않아** 리다이렉트만이 잡는다.
# 폴러가 조용히 죽는 걸 보려고 두는 로그다.
$cmd = "$env:ComSpec"
$cmdArgs = "/c `"`"$node`" `"$script`" >> `"$log`" 2>&1`""

$action = New-ScheduledTaskAction -Execute $cmd -Argument $cmdArgs -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -AtLogOn
# 상주라 실행 시간 제한을 두지 않는다 — 기본 3일 제한에 걸리면 판독이 멈춘다.
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description "우편물 영수증 판독 — [추출] 요청을 claim해 이미지를 읽고 결과를 보고한다" -Force

Start-ScheduledTask -TaskName $taskName
Write-Host "[OK] 등록 완료: $taskName (로그온 시 자동 시작, 죽으면 1분 후 재시작)"
Write-Host "로그: $log"
Write-Host "확인: 우편물 화면에서 영수증 [추출] → 30초 내 표가 나오면 정상"
