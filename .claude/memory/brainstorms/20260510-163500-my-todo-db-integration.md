# Brainstorm: my-todo DB 연동

작성: 2026-05-10 / 사용자: 송영석

## 의도

- **산출물**:
  - `todos` 테이블 + 본인 only RLS + GRANT + 시드 2~3건
  - zod schema (`todoRowSchema` / `todoCreateSchema` / `todoUpdateSchema`)
  - server queries (`listMyTodos()`) + actions (`createTodo` / `updateTodo` / `deleteTodo` / `toggleTodoDone`)
  - `/dashboard/my-todo` 페이지 + ListPattern `my-todo` variant + InspectorListBody my-todo 폼
  - e2e — 본인 작성·완료 토글·타인 차단
- **사용자**: 운영자 본인 (매일 입실 후 schedule 옆 화면). done 토글, 우선순위, 마감일 관리.
- **트리거**: schedule epic 종료(2026-05-10). 시드 메모에 후속 조각 명시. sidebar `my-todo.count: "7"` hardcode 미연결.
- **성공 기준**:
  1. 본인 todo 추가 → DB persist → 새로고침 유지
  2. 다른 사용자는 본인 todo 안 보임 (RLS)
  3. done 체크박스 즉시 반영
  4. 시드 2~3건 마이그레이션
  5. e2e: 본인 todo 작성/완료/타인 차단

## 제약

- **기술**: schedule 학습된 함정 적용 (RLS OR 풀어쓰기, service_role GRANT, notify pgrst, language plpgsql). RLS = `assignee_email = jwt email OR is_admin()` (admin overview 허용)
- **비즈니스**: 위임 작성, 반복 todo, 알림, 카테고리/태그 out of scope. done 외 상태(in-progress)는 v2.
- **코드베이스**: schedule 패턴 70% 재활용. ListPattern variant 6번째 도달 — 본 epic 후 컴포지션 리팩토링 follow-up 강제. sidebar count 동적화 별도.

## 대안 비교

| 항목 | A: 별도 todos 테이블 (본인 only RLS) | B: schedule_events에 type='task' 추가 | C: mock + count 동적화 |
|---|---|---|---|
| 비용 | 1 테이블 (~12파일) | schema migration 0 (재활용) + RLS 분기 (~6파일) | 0 |
| 위험 | sidebar 6번째 variant 분기 폭증 | RLS가 type별 분기 — 같은 테이블에 두 모델 정책 충돌 | 새로고침 데이터 손실 |
| 가역성 | 모델 분리 — 자유도 큼 | type 추가 후 분리는 마이그레이션 부담 | n/a |
| 학습 효과 | 본인 only RLS 패턴 (1차 적용) | 단일 테이블 다중 정책 한계 체감 | 없음 |

## 추천 + 근거

**추천: 대안 A — 별도 `todos` 테이블, 본인 only RLS**

근거:
1. schedule은 팀 공유, todo는 본인 — RLS 정책이 본질적으로 다름. 같은 테이블에 두 모델 강제하면 RLS 분기 복잡도 폭증
2. todo 고유 컬럼 (`done / done_at / due_at / priority`)이 schedule과 의미 겹침 적음 — sparse column 위험
3. 본인 only RLS 패턴 1차 적용 — handover 시 패턴 비교군 확보
4. 작은 epic 원칙 + schedule 패턴 70% 재활용 → 1~2 PR

**기각된 대안 B**: 같은 테이블 공유/본인 두 정책은 가능하지만 type 추가 시마다 정책 재작성. 분리 비용이 더 낮음.

**스코프 명시**:
- 시드 데이터: 송영석 본인 todo 2~3건 (다른 user 시드는 만들지 않음 — RLS 검증 위해 다른 로그인 필요해서 e2e 어려움)
- 위임 작성(타인에게 todo): 스코프 외. 시작은 `assignee_email = me.email` 강제 (form에서 select 없음)
- admin overview: RLS는 admin도 모든 todo select 허용하되 UI는 본인 todo만 표시. 다른 사용자 todo 보기는 별도 페이지(후속)

## 다음 단계

- HARD-GATE 등급: **간략 설계** (예상 10~12파일) → `/plan from-brainstorm`
- 후속 epic: handover, ListPattern 컴포지션 리팩토링 (variant 6 도달)
