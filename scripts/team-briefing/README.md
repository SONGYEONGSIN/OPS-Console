# 팀 브리핑 뉴스레터 — 로컬 초안 생성기

매주 금 10:00, `claude -p`로 스토리를 생성해 뉴스레터 **초안**을 만든다.
**그룹채팅 티저는 여기서 나가지 않는다** — 사람이 미리보기로 내용을 확인한 뒤
자동화 페이지에서 [발행]을 눌러야 발송된다.

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
      3. POST /api/team-briefing/stage    — team_briefings에 status='draft' 저장
                                          + 본인 Teams 채팅으로 미리보기 링크 알림

  (사람이 링크로 내용 확인)

자동화 페이지 [발행] → 호수 확정 + 그룹채팅 티저 발송 + 실행 이력 기록
```

## 선행 조건 (.env.local)

- `CRON_SECRET` — 기존 자동화 공유 시크릿
- `OPS_CONSOLE_BASE_URL` — 프로덕션 베이스 URL (예: https://ops-console.example.com)
- `CLAUDE_BIN` (선택) — claude CLI 경로 override
- `TEAMS_BRIEFING_DRAFT_CHAT_ID` (선택) — 초안 준비 알림을 받을 **본인 Teams 채팅 ID**.
  미설정이면 초안은 정상 저장되고 알림만 생략되며, 실행 로그에 "본인 Teams 알림 미설정"이 남는다.

### 초안 알림 채팅 ID 얻는 법 (1회)

Graph `/chats` 조회는 위임 토큰이 필요해 스크립트로는 안 된다. Teams 클라이언트에서 직접 얻는다.

1. Teams에서 알림받을 채팅(본인과의 채팅 권장)을 연다
2. 채팅 상단 `⋯` → **채팅 링크 복사**
3. 복사된 URL에서 `19:`로 시작해 `@thread.v2`로 끝나는 구간이 chat ID다
   `https://teams.microsoft.com/l/chat/19%3Aabc...%40thread.v2/0` → `19:abc...@thread.v2`
   (`%3A`→`:`, `%40`→`@` 로 디코딩)
4. `.env.local`과 Vercel 환경변수에 `TEAMS_BRIEFING_DRAFT_CHAT_ID`로 등록

## Windows 작업 스케줄러 등록 (회사 PC, 1회)

```powershell
# 레포 최신화 후 레포 루트에서
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/register-team-briefing-task.ps1
# 저장 없이 스토리만 미리보기
node scripts\team-briefing\publish-local.mjs --dry
# 실제 1회 초안 생성 테스트 (그룹채팅 발송 없음)
Start-ScheduledTask -TaskName "OPS-Console-Team-Briefing"
```

- 매주 금 10:00, 로그온 시. 로그: `scripts\logs\team-briefing-YYYYMMDD.log`
- 해제: `Unregister-ScheduledTask -TaskName "OPS-Console-Team-Briefing" -Confirm:$false`

> Mac launchd(`com.opsconsole.team-briefing.plist`)는 claude -p 인증 세션 부재로 스토리가
> 폴백만 나오므로 **사용하지 않는다**(문서 상단 경고 참조).

## 수동 실행

```bash
node scripts/team-briefing/publish-local.mjs --dry   # 스토리만 출력 (저장 안 함)
node scripts/team-briefing/publish-local.mjs         # 초안 저장 (그룹채팅 발송 없음)
```

초안은 **최신 1건만** 유지된다 — 새 초안을 만들면 이전 초안은 삭제된다.
발행하지 않고 한 주를 넘기면 그 주 브리핑은 건너뛴 것이 된다.

## ⚠️ 기존 Vercel cron 비활성 필수

cron-job.org(또는 GH Actions)의 `jobId=team-briefing` 금 10:00 스케줄을 제거해야
중복 초안이 없다. registry의 team-briefing 잡은 수동 실행/폴백용(스토리 없음)으로 유지되며,
이 경로도 발행이 아니라 **초안 생성**까지만 수행한다 — 확인 절차를 우회하는 경로는 없다.
