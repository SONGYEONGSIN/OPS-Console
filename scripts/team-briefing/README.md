# 팀 브리핑 뉴스레터 — 로컬 발행기

매주 금 10:00, `claude -p`로 스토리를 생성해 뉴스레터를 발행하고 Teams에 티저를 보낸다.

> **⚠️ 실행 머신 = 회사 Windows PC (claude 인증된 머신).** `claude -p`의 구독 OAuth는
> **로그인 사용자 세션에서만** 유효하다. Mac mini launchd 같은 headless 컨텍스트엔 인증
> 세션이 없어 claude 스토리가 실패하고 수치 요약 폴백만 나온다(mailbox-ingest가 같은 이유로
> Windows 작업 스케줄러로 이전됨, #893). 아래 **Windows 작업 스케줄러 등록**을 사용한다.

## 흐름

```
작업 스케줄러 (금 10:00, 로그온 시) → team-briefing-publish.cmd
  → node scripts/team-briefing/publish-local.mjs
      1. GET  /api/team-briefing/draft   — 서버가 주간 데이터 집계 반환 (CRON_SECRET)
      2. claude -p                        — 캐치 제목 + 섹션별 스토리 (실패 시 수치 요약 폴백)
      3. POST /api/team-briefing/publish  — team_briefings 발행 + Teams 티저
```

## 선행 조건 (.env.local)

- `CRON_SECRET` — 기존 자동화 공유 시크릿
- `OPS_CONSOLE_BASE_URL` — 프로덕션 베이스 URL (예: https://ops-console.example.com)
- `CLAUDE_BIN` (선택) — claude CLI 경로 override

## Windows 작업 스케줄러 등록 (회사 PC, 1회)

```powershell
# 레포 최신화 후 레포 루트에서
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-team-briefing-task.ps1
# 발행 없이 스토리만 미리보기
node scripts\team-briefing\publish-local.mjs --dry
# 실제 1회 발행 테스트 (뉴스레터 + Teams 발송)
Start-ScheduledTask -TaskName "OPS-Console-Team-Briefing"
```

- 매주 금 10:00, 로그온 시. 로그: `scripts\logs\team-briefing-YYYYMMDD.log`
- 해제: `Unregister-ScheduledTask -TaskName "OPS-Console-Team-Briefing" -Confirm:$false`

> Mac launchd(`com.opsconsole.team-briefing.plist`)는 claude -p 인증 세션 부재로 스토리가
> 폴백만 나오므로 **사용하지 않는다**(문서 상단 경고 참조).

## 수동 실행

```bash
node scripts/team-briefing/publish-local.mjs --dry   # 스토리만 출력 (발행 안 함)
node scripts/team-briefing/publish-local.mjs         # 실제 발행 + Teams 발송
```

## ⚠️ 기존 Vercel cron 비활성 필수

cron-job.org(또는 GH Actions)의 `jobId=team-briefing` 금 10:00 스케줄을 제거해야
중복 발행이 없다. registry의 team-briefing 잡은 수동 실행/폴백용(스토리 없음)으로 유지.
