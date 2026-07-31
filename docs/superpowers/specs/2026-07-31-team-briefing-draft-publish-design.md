# 팀 브리핑 — 초안 → 확인 → 발행

작성일: 2026-07-31

## 배경

팀 보고 브리핑은 매주 금 10:00 회사 PC Windows 작업 스케줄러가 `publish-local.mjs`를
실행해 집계 → claude 스토리 생성 → 뉴스레터 발행 + Teams 그룹채팅 티저까지 한 번에
끝냈다. 사람이 내용을 볼 기회가 없다.

선행 수정(#917)으로 자동화 토글 OFF가 로컬 경로에서도 존중되도록 게이트를 넣었다.
본 설계는 그 위에 **사람이 내용을 확인한 뒤 발행**하는 단계를 추가한다.

함께 처리할 요구사항: 자동화 실행 로그에서 **과거 발행분의 주소(뉴스레터 링크)를
볼 수 있어야** 한다.

## 목표

1. 금요일 10:00에는 **초안까지만** 만든다. Teams 그룹채팅에는 아무것도 나가지 않는다.
2. 초안이 준비되면 **본인 Teams 채팅으로 미리보기 링크**를 받는다.
3. 자동화 페이지에서 내용 확인 후 **[발행]** 을 눌러야 그룹채팅 티저가 나간다.
4. 자동화 실행 로그 타임라인에 발행분이 **호수 · 날짜 · 링크**로 남는다 (지난 #1호 포함).

## 비목표

- 초안 내용 편집(스토리 문구 수정) — 마음에 안 들면 초안을 다시 생성한다.
- 예약 발행, 발행 취소(발행 후 회수).
- 초안 이력 보관 — 초안은 최신 1건만 유지한다.

## 흐름

```
금 10:00  Windows 작업 → publish-local.mjs
   │
   ├─ GET  /api/team-briefing/draft     토글 OFF면 여기서 종료 (#917 게이트)
   ├─ claude -p 스토리 생성
   └─ POST /api/team-briefing/stage     초안 저장 (그룹 발송 없음)
            └─ 본인 Teams 채팅: "브리핑 초안 준비됨 — 미리보기"

   (사람이 링크로 내용 확인)

자동화 페이지 [발행] → publishBriefingDraftAction (admin)
   ├─ 호수 확정 · status=published · published_at
   ├─ Teams 그룹채팅 티저 발송
   └─ automation_runs 기록
```

## 데이터 모델

`team_briefings`에 두 컬럼을 추가한다.

```sql
alter table public.team_briefings
  add column if not exists status text not null default 'published'
    check (status in ('draft', 'published')),
  add column if not exists published_at timestamptz;

-- 초안은 동시에 1건만 존재한다.
create unique index if not exists team_briefings_single_draft_idx
  on public.team_briefings (status) where status = 'draft';
```

기존 #1호(2026-07-24) 행은 default로 `published`가 되어 그대로 유지된다.
`published_at`은 기존 행에서 null이며, 표시에는 `created_at`을 쓴다.

### 호수(issue_no) 처리

`issue_no`는 NOT NULL을 유지한다. 초안 저장 시 `status='published'` 행 수 + 1을
예상 호수로 넣고, 발행 확정 시 같은 식으로 다시 계산해 확정한다. 초안이 1건만
존재하므로 두 값은 정상 상황에서 항상 같다. 발행 사이에 다른 발행이 끼어 값이
어긋나면 확정 시점의 값이 이긴다.

**중요**: 현재 `publishBriefing`의 호수 계산은 전체 row count를 쓴다. 초안이 count에
포함되면 호수가 밀리므로 **`status='published'` 필터를 반드시 추가**해야 한다.

### 초안 교체

새 초안을 저장하기 전에 기존 `status='draft'` 행을 **삭제**한다. 지난 주 초안은
집계 데이터가 낡아 발행 가치가 없고, 남겨두면 어느 것을 발행할지 모호해진다.
부분 unique 인덱스가 이 불변식을 DB 레벨에서 강제한다.

## 컴포넌트

### 서버 — `features/automations/jobs/team-briefing.ts`

기존 `publishBriefing`(insert + 티저를 한 번에)을 두 함수로 나눈다.

- `stageBriefingDraft(payload)` → `{ ok, url, nextIssueNo }`
  기존 draft 삭제 → `status='draft'` insert → 본인 Teams 채팅 알림.
  그룹채팅 티저는 보내지 않는다.
- `publishStagedDraft(draftId)` → `{ ok, issueNo, url, sent }`
  호수 확정 → `status='published'`, `published_at=now()` → 그룹채팅 티저 발송.
  티저 실패 시 status는 published로 두고 실패 사유를 반환한다(발행 자체는 성공,
  재발송은 별도 판단).

`share_token`은 초안 생성 시 부여하고 발행 시 바꾸지 않는다. 확인한 링크와 팀에
나가는 링크가 같아야 한다.

`runTeamBriefing`(registry 수동 실행/폴백)도 발행이 아니라 **초안 생성**으로 바꾼다.
진입 경로가 달라도 "사람 확인 없이 그룹채팅에 나가는 길"이 남으면 안 된다.

### API — `app/api/team-briefing/stage/route.ts`

기존 `publish/route.ts`를 `stage/route.ts`로 옮긴다. 인증(CRON_SECRET)·payload 검증·
enabled 게이트는 그대로 두고 호출 대상만 `stageBriefingDraft`로 바꾼다.
발행 확정은 admin server action이 담당하므로 HTTP publish 엔드포인트는 없앤다.

`automation_runs` 기록은 초안 생성 시 `"초안 #N 생성 — 발행 대기"`로 남긴다.
발행 확정 기록은 server action이 남긴다.

### Server Action — `features/automations/actions.ts`

`publishBriefingDraftAction(formData)`:
admin 권한 재검증 → `publishStagedDraft` → `recordAutomationRun` →
`revalidatePath("/dashboard/automations")`.
입력 스키마는 `schemas.ts`에 zod로 정의한다(draftId uuid).

### UI — 자동화 페이지

team-briefing 카드에 초안 대기 상태를 노출한다.

```
팀 보고 브리핑
초안 #2 대기 · 2026-07-31 10:00 생성        [미리보기]  [발행]
```

초안이 없으면 이 줄은 나오지 않는다. `[발행]`은 확인 후 되돌릴 수 없으므로
`window.confirm` 없이 pending 상태만 표시하고, 성공 시 카드가 갱신된다.

### UI — 미리보기 페이지 `/r/briefing/[token]`

`status='draft'`면 뉴스레터 위에 배너를 띄운다.

```
초안입니다 — 아직 발행되지 않았습니다.
```

이 페이지는 토큰만 알면 열리는 공개 페이지이므로 **발행 버튼을 두지 않는다.**

### 실행 로그 — 발행 주소

`run-logs.ts`에 `team-briefing` 리졸버를 추가한다. `team_briefings`에서
`status='published'` 행을 `published_at`(없으면 `created_at`) 내림차순으로 읽어
`BriefingEntry { publishedAt, issueNo, url }`로 정규화하고, `AutomationLogPanel`에
`BriefingList`로 렌더한다.

```
#1호 · 2026-07-24 13:35 · 뉴스레터 열기 →
```

다른 잡(`receivables_mail_sends` → `MailOperatorList` 등)과 동일한 패턴이며,
`buildTimeline`이 날짜 기준으로 run 블록에 묶어준다. **지난 #1호는 이미 DB에 있으므로
백필 없이 바로 표시된다.**

## 설정 의존성

본인 Teams 채팅 알림에는 채팅 ID가 필요하다. 새 환경변수:

```
TEAMS_BRIEFING_DRAFT_CHAT_ID=<본인 1:1 채팅 ID>
```

`scripts/team-briefing/list-my-chats.mjs`를 추가해 Graph `/me/chats`를 조회하고
후보를 출력한다(1회용 설정 도구). 미설정이면 초안은 정상 저장되고 알림만 생략하며,
`automation_runs` 메시지에 미설정 사실을 남긴다 — 기존 `TEAMS_NOTICE_CHAT_ID`
미설정 시 동작과 같은 방식이다.

`settings/_env.ts` 스냅샷에도 노출해 운영 화면에서 설정 여부를 확인할 수 있게 한다.

## 에러 처리

| 상황 | 동작 |
|---|---|
| 토글 OFF | draft 라우트에서 종료 (#917 게이트). 초안도 만들지 않는다 |
| claude 실패 | 기존과 동일 — 수치 요약 폴백 스토리로 초안 생성 |
| 초안 저장 실패 | 500 + `automation_runs`에 실패 기록. 로컬 스크립트 exit 1 |
| 본인 Teams 알림 실패 | 초안은 유지. 실패 사유를 실행 로그에 남긴다 (초안을 버리지 않는다) |
| 발행 시 초안 없음 | 액션이 `ok:false, "발행할 초안이 없습니다"` 반환 |
| 그룹 티저 발송 실패 | status는 published 유지, 실패 사유 반환. 링크는 이미 유효 |

## 테스트

TDD(RED→GREEN)로 진행한다.

- `jobs/team-briefing` — 초안 저장 시 기존 draft 삭제, 호수는 published만 세어 계산,
  발행 확정이 status/published_at을 갱신하고 토큰을 유지하는지
- `api/team-briefing/stage` — enabled 게이트(#917 테스트 이관), 초안 저장 경로
- `actions` — admin 아니면 거부, 초안 없으면 거부
- `run-logs-normalize` — `BriefingEntry` 매핑, `published_at` 없으면 `created_at` 사용
- `AutomationLogPanel` — 발행 링크 렌더
- `buildTimeline` — 발행 상세가 run 블록에 묶이는지 (기존 테스트 재사용)

## 마이그레이션 순서

DB 스키마 변경이므로 **머지 전에 Supabase에 마이그레이션을 먼저 적용**하고
service_role로 검증한다(프로젝트 관례).

## 영향 파일

마이그레이션 1 · 서버 4 · UI 3 · 스크립트 2 · 설정/문서 2 · 테스트 다수 — 약 15개.
프로젝트 HARD-GATE 기준 "간략 설계" 등급.

## 열린 위험

금요일 초안 알림을 놓치면 그 주 브리핑은 나가지 않는다. 자동 발행의 편의를 버리고
통제를 얻는 의도된 교환이다. 미발행 초안이 쌓이지 않도록(다음 주 초안이 이전 초안을
덮어씀) 설계했으므로, 놓친 주는 그냥 건너뛴 것이 된다.
