# 팀 브리핑 뉴스레터 — 로컬 발행기 (상시 맥)

매주 금 10:00, 이 맥에서 `claude -p`로 스토리를 생성해 뉴스레터를 발행하고
Teams에 티저를 보낸다. (mailbox-ingest와 동일한 launchd 패턴)

## 흐름

```
launchd (금 10:00)
  → node scripts/team-briefing/publish-local.mjs
      1. GET  /api/team-briefing/draft   — 서버가 주간 데이터 집계 반환 (CRON_SECRET)
      2. claude -p                        — 캐치 제목 + 섹션별 스토리 (실패 시 수치 요약 폴백)
      3. POST /api/team-briefing/publish  — team_briefings 발행 + Teams 티저
```

## 선행 조건 (.env.local)

- `CRON_SECRET` — 기존 자동화 공유 시크릿
- `OPS_CONSOLE_BASE_URL` — 프로덕션 베이스 URL (예: https://ops-console.example.com)
- `CLAUDE_BIN` (선택) — claude CLI 경로 override

## launchd 등록 (1회)

```bash
cp scripts/team-briefing/com.opsconsole.team-briefing.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.opsconsole.team-briefing.plist
# 즉시 1회 테스트
launchctl start com.opsconsole.team-briefing
tail -f ~/Library/Logs/team-briefing.log
```

해제: `launchctl unload ~/Library/LaunchAgents/com.opsconsole.team-briefing.plist`

## 수동 실행

```bash
node scripts/team-briefing/publish-local.mjs --dry   # 스토리만 출력 (발행 안 함)
node scripts/team-briefing/publish-local.mjs         # 실제 발행 + Teams 발송
```

## ⚠️ 기존 Vercel cron 비활성 필수

cron-job.org(또는 GH Actions)의 `jobId=team-briefing` 금 10:00 스케줄을 제거해야
중복 발행이 없다. registry의 team-briefing 잡은 수동 실행/폴백용(스토리 없음)으로 유지.
