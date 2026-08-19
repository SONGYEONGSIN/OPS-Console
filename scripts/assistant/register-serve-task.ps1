# 어시스턴트 Claude 모드 폴러를 회사 PC에 등록 (관리자 PowerShell에서 1회 실행)
#
# 다른 폴러(dev-control·moa-ratio)와 달리 **상주**다 — 채팅이라 5분 간격으로는 못 쓴다.
# 그래서 "5분마다 실행"이 아니라 "로그온 시 시작 + 죽으면 재시작"으로 등록한다.
#
# 사전 조건:
#   1) 이 PC에서 `claude` 로그인이 되어 있을 것 (구독 OAuth). `claude -p "hi"` 로 확인.
#   2) 레포 .env.local 에 OPS_CONSOLE_BASE_URL / CRON_SECRET / KNOWLEDGE_VAULT_PATH
#      KNOWLEDGE_VAULT_PATH 예: C:\Users\<사용자>\진학사\어플라이사업본부 - 17. 업무 지식망
#   3) npm ci 로 @anthropic-ai/claude-agent-sdk 설치 (devDependency)

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$node = "C:\Program Files\nodejs\node.exe"
$script = Join-Path $repo "scripts\assistant\serve-local.mjs"
$taskName = "OPS-Console 어시스턴트 폴러"

if (-not (Test-Path $node)) { throw "node.exe 없음: $node" }
if (-not (Test-Path $script)) { throw "스크립트 없음: $script" }

# 작업 스케줄러는 stdout을 버린다. cmd로 감싸 로그 파일에 붙인다.
#
# 폴러가 스스로 파일에 쓰게 했다가 되돌렸다 — cmd 가 그 파일을 쥐고 있어 쓰기가
# 매번 EBUSY 로 튕겼다(#1020). 그때 serve-local.mjs 의 파일 쓰기는 걷어냈는데
# 이 스크립트는 node 직접 실행으로 남아 **로그가 어디에도 안 남고 있었다.**
# node 가 통째로 죽을 때 나오는 스택은 console 을 거치지 않아 리다이렉트만이 잡는다.
$log = Join-Path $repo "assistant-poller.log"
$cmd = "$env:ComSpec"
$cmdArgs = "/c `"`"$node`" `"$script`" >> `"$log`" 2>&1`""

$action = New-ScheduledTaskAction -Execute $cmd -Argument $cmdArgs -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -AtLogOn
# 상주 프로세스이므로 실행 시간 제한을 두지 않는다(기본 3일 제한에 걸리면 채팅이 죽는다).
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit ([TimeSpan]::Zero) `
    -RestartCount 999 `
    -RestartInterval (New-TimeSpan -Minutes 1)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger `
    -Settings $settings -Description "어시스턴트 Claude 모드 — 질문 큐를 2초마다 claim해 볼트를 읽고 답한다" -Force

Start-ScheduledTask -TaskName $taskName
Write-Host "[OK] 등록 완료: $taskName (로그온 시 자동 시작, 죽으면 1분 후 재시작)"
Write-Host "로그: $log"
Write-Host "확인: 웹 어시스턴트에서 [Claude로 깊게] 켜고 질문 → 40초 내 답이 오면 정상"
