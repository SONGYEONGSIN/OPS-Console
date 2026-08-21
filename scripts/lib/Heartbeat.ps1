# 폴러가 "살아있음"을 서버에 남긴다.
#
# node 폴러는 상주라 1분마다 보내지만, PowerShell 폴러는 **5분마다 한 번 돌고
# 끝난다** — 그 실행 자체가 심박이라 시작할 때 한 줄 보내면 된다.
#
# 큐 기록만으로는 요청이 없을 때 생사를 알 수 없다. 2026-08-20 밤 어시스턴트
# 폴러가 죽었는데 12시간 동안 아무도 몰랐다.
#
# **실패해도 폴러는 계속한다** — 심박 때문에 일이 멈추면 주객이 뒤바뀐다.
function Send-PollerHeartbeat {
    param(
        [Parameter(Mandatory = $true)][string] $BaseUrl,
        [Parameter(Mandatory = $true)][string] $Secret,
        [Parameter(Mandatory = $true)][string] $PollerId
    )
    if (-not $BaseUrl -or -not $Secret) { return }
    try {
        $body = @{ pollerId = $PollerId; machine = $env:COMPUTERNAME } | ConvertTo-Json -Compress
        Invoke-RestMethod -Method Post -Uri "$($BaseUrl.TrimEnd('/'))/api/pollers/heartbeat" `
            -Headers @{ Authorization = "Bearer $Secret"; "Content-Type" = "application/json" } `
            -Body $body -TimeoutSec 10 | Out-Null
    } catch {
        # 조용히 넘기지 않는다 — 심박이 죽으면 화면이 폴러를 죽은 것으로 오해한다.
        Write-Host "[heartbeat] $PollerId 실패: $($_.Exception.Message)"
    }
}
