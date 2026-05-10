# Brainstorm: schedule DB 연동

작성: 2026-05-10 / 사용자: 송영석

## 의도

- **산출물**:
  - `schedule_events` 테이블 + RLS + GRANT + 시드 (2~3건)
  - zod schema (`scheduleEventRowSchema` / `scheduleEventCreateSchema` / `scheduleEventUpdateSchema`)
  - server-side queries (`listScheduleEvents()`) + actions (`createScheduleEvent` / `updateScheduleEvent` / `deleteScheduleEvent`)
  - `/dashboard/schedule/page.tsx` — DB 연동 (mock 제거 / hardcode count "14" 동적화는 후속)
  - ListPattern variant `schedule` 또는 default 재구성 (start_at / type / assignee 컬럼)
  - e2e — 작성→새로고침→유지 + 권한 분기
- **사용자**:
  - admin (부장·팀장): 모든 일정 작성/수정/삭제
  - member: 본인 작성 일정만 수정/삭제 (admin은 전체)
  - 모두 select 통과 (팀 공통 일정 공유)
- **트리거 (왜 지금)**: 게시판 epic(posts) 2026-05-10 종료. sidebar `schedule.count: "14"` hardcode 상태. 운영자 매일 입실 시 첫 화면이라 직접 가치 큼.
- **성공 기준** (검증 가능):
  1. admin이 일정 추가 → DB insert → 새로고침 유지
  2. member가 본인 일정 수정 가능
  3. member가 타인 일정 수정 시도 → RLS 차단
  4. 모두 select 통과
  5. 시드 일정 2~3건 마이그레이션 포함
  6. e2e 권한 분기 시나리오 통과

## 제약

- **기술**:
  - posts epic 학습된 RLS 함정: `CASE` → `OR` 풀어쓰기, `service_role` GRANT, `notify pgrst, 'reload schema'`, function `language plpgsql`
  - datetime KST 표기 일관성 (`Intl.DateTimeFormat` `Asia/Seoul`)
  - `start_at` / `end_at` 검증 (end_at >= start_at)
  - type enum: `shift / event / leave / training` (4종 시작, 확장 여지)
- **비즈니스**:
  - my-todo / handover는 본 epic 외 (모델 의존성 분리 — 별도 epic)
  - 댓글 / 반복 일정 / 캘린더 뷰 / 알림 out of scope (후속 가능)
  - 작성자 정보 = email (posts와 일관)
- **코드베이스**:
  - posts 패턴 재활용 (schemas/queries/actions/RLS 동일 구조)
  - ListPattern에 `schedule` variant 신설 또는 default + 컬럼 커스텀 — 결정은 plan 단계
  - `src/app/dashboard/_data.ts` sidebar count 동적화는 후속

## 대안 비교

| 항목 | A: 단일 events + type enum (posts 미러) | B: schedule만 별도 테이블 (작은 epic) | C: schedule + todos + handovers 3 테이블 정규화 | Z: do-nothing |
|---|---|---|---|---|
| 비용 | 1 테이블 + type별 sparse column / jsonb (~12파일) | 1 테이블 (~10파일) | 3 테이블 + 3 RLS + 3 queries (~24파일) | 0 |
| 위험 | type별 속성 차이(todo done / handover from→to) → jsonb 의존, 검색 어려움 | my-todo/handover에서 RLS 패턴 재반복 | 코드 중복, 머지 부담 큼 | sidebar count 위조 지속 |
| 가역성 | type 추가 enum 확장 쉬움. 도메인 분리는 고비용 | 모델 분리 유지 — 도메인별 자유도 큼 | 변경 범위 가장 큼 | n/a |
| 학습 효과 | jsonb + type discriminator 경험 | posts 패턴 두 번째 적용 — 패턴 정착 | 정규화 vs 단일 모델 비교 | 없음 |

## 추천 + 근거

**추천: 대안 B — schedule만 별도 테이블, 작은 epic**

근거:
1. 사용자가 주제를 "schedule DB 연동"으로 좁혔고 시드 메모도 "작은 epic" 권장
2. my-todo는 본인 only (RLS — `auth.uid() = assignee`만 select 허용), handover는 시프트 단위 (FK 의존) → schedule 모델 확정 후 분리가 합리적
3. posts epic 패턴 두 번째 적용 — RLS/queries/actions/schemas 일관 패턴 정착
4. 1~2 PR 안에 머지 가능 → 빠른 가치 확보 후 my-todo/handover 후속 epic

**기각된 대안 A**: type별 속성 차이가 큼(`done` vs `from_shift→to_shift` vs `assignee` vs `all_day`). jsonb로 묶으면 RLS·검색·UI 복잡. 도메인 4개 이상으로 늘어나면 재고 가치.

**기각된 대안 C**: 한 epic에 3 테이블은 머지 부담 큼 + 사용자 "작은 epic" 의도와 어긋남.

## 다음 단계

- HARD-GATE 등급: **간략 설계** (예상 8~12파일) → `/plan` 권장
- 후속 epic: my-todo, handover (schedule 모델 안정화 후)
- 시작 명령: `/plan from-brainstorm 20260510-152800-schedule-db-integration.md`
