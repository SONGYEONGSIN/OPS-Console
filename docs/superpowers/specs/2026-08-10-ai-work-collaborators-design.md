# 내 작업(ai-work) 공동작업자 필드 — 설계

- 작성일: 2026-08-10
- 대상 메뉴: `/dashboard/my-ai-work` (사이드바 '분석 · AI > AI & 자동화 > 내 작업')
- 상태: 승인됨 (구현 계획 대기)

## 배경

AI 활용 기록은 지금 등록자 한 명만 남는다. 실제로는 둘 이상이 함께 한 작업이 있는데
그 사실이 기록에 남지 않아, 목록만 봐서는 누가 같이 했는지 알 수 없다.
등록 폼에 **공동작업자**를 추가해 함께한 사람을 남긴다.

## 스코프

**한다**
- 등록 폼에 공동작업자 다중 선택 필드 추가 (기본값 '없음')
- 읽기 화면(인스펙터 View)에 공동작업자 표시
- 목록 테이블 '등록자' 칸에 등록자와 공동작업자를 함께 표시

**안 한다 (의도적 제외)**
- 공동작업자에게 수정·삭제 권한을 주지 않는다 → RLS 정책 무변경
- 공동작업자 본인의 '내 작업' 목록(`?mine=true`)에 노출하지 않는다 → `listAiWorks` 필터 무변경
- 공동작업자 기준 검색·필터 칩을 추가하지 않는다 → 인덱스 불필요

표시 전용으로 시작하는 이유: 나중에 권한·노출을 넓히는 것은 쉽고, 이미 부여한 권한을
거두는 것은 어렵다. 필요해지면 그때 별도 변경으로 올린다.

## 데이터

### 마이그레이션

`supabase/migrations/20260810_ai_work_collaborators.sql`

```sql
begin;

alter table public.ai_work
  add column if not exists collaborator_emails text[] not null default '{}';

commit;

notify pgrst, 'reload schema';
```

- **이메일을 저장한다(이름 아님).** 이름은 바뀌고 이메일은 안 바뀐다. 기존 `author_email`과 같은 규칙.
- `not null default '{}'` — 기존 row는 빈 배열로 채워지고 '없음'과 같은 의미가 된다. 백필 불필요.
- 인덱스 없음 — 필터·검색 대상이 아니다.
- RLS 변경 없음 — 표시 전용이므로 기존 정책(전원 read / 본인·admin modify)이 그대로 맞다.

### zod 스키마 (`src/features/ai-work/schemas.ts`)

세 스키마에 같은 필드를 추가한다.

```ts
const collaboratorEmailsSchema = z.array(z.string().email());

// aiWorkRowSchema
collaborator_emails: collaboratorEmailsSchema,
// aiWorkCreateSchema
collaborator_emails: collaboratorEmailsSchema.default([]),
// aiWorkUpdateSchema
collaborator_emails: collaboratorEmailsSchema.optional(),
```

row 스키마를 `.default([])` 없이 두는 이유: DB가 `not null default '{}'`이라 항상 배열이 온다.
여기서 기본값을 허용하면 컬럼 누락을 조용히 덮어 파싱 실패를 놓친다.

## 정규화 (경계 검증)

```ts
// src/features/ai-work/collaborators.ts (순수 함수, 단위 테스트 대상)
export function normalizeCollaborators(
  emails: string[] | undefined,
  authorEmail: string,
): string[]
```

- 중복 제거
- `authorEmail`과 같은 값 제거 (자기 자신은 공동작업자가 아니다)
- 입력 순서 유지 (선택한 순서대로 보인다)

폼에서도 막지만 server action은 직접 호출될 수 있으므로 **경계에서 다시 검증한다.**
`createAiWork`는 `me.email` 기준, `updateAiWork`는 대상 row의 `author_email` 기준으로 적용한다
(수정자가 admin이면 등록자와 다를 수 있다 — admin 자신이 아니라 등록자를 제외해야 한다).

## 후보 목록

`backupOperators` 선례를 그대로 따른다.

```ts
const allOperators = await listOperators();
const aiWorkOperators = allOperators
  .filter((op) => op.status === "active" && op.email !== me?.email)
  .map((op) => ({ email: op.email, name: op.name }));
```

`EditFormProps`에 `aiWorkOperators?: { email: string; name: string }[]`를 추가하고
`my-ai-work/page.tsx`에서 주입한다.

### 이름 표시의 소스가 둘인 점 (알려진 이음매)

등록자 이름은 기존 `buildOwnerMap`이 정적 목록(`@/features/auth/operators`)으로 푼다.
공동작업자 이름은 위 `listOperators()`(DB) 결과로 푼다. 둘 다 같은 운영부 인원을 가리키고
미매칭 시 폴백(이메일 로컬파트)도 같아 실질 차이는 없다.
`buildOwnerMap`을 DB 소스로 통일하는 것은 이 작업 범위 밖이므로 건드리지 않는다(별도 변경).

## UI

### 등록 폼 (`list-variants/ai-work/EditForm.tsx`)

위치: **등록자 바로 아래** — 사람 정보끼리 묶는다.

```
공동작업자
┌───────────────────────────┐
│ 없음                  ▼ │   ← 선택 시 '없음'으로 되돌아옴
└───────────────────────────┘
 [김영희 ×] [박철수 ×]        ← 선택된 사람은 칩으로 누적
```

- 셀렉트 첫 옵션은 `없음`(value `""`). 아무도 안 고르면 그대로 '없음' = 빈 배열
- 한 명 고르면 칩으로 추가하고 셀렉트는 즉시 `없음`으로 리셋
- **이미 고른 사람과 본인은 옵션 목록에서 제외**한다 — 중복 선택 자체가 불가능해진다
- 칩의 `×`로 제거
- 후보가 모두 선택되면 셀렉트는 `disabled`
- 입력창은 프로젝트 표준 클래스 사용: `border-line-soft bg-field-bg` + `focus:border-ink focus:bg-white`
- 칩은 하드코딩 색 금지 — 기존 토큰(`border-line-soft`, `text-ink`, `bg-washi-raised`) 조합

접근성: 셀렉트에 `aria-label="공동작업자"`, 각 제거 버튼에 `aria-label="{이름} 제외"`.

### 읽기 화면 (`View.tsx`)

'작업 정보' 섹션 `DefList`에 항목 추가:

```
공동작업자   김영희, 박철수
```

없으면 `없음`. 기존 항목들이 값 없을 때 `—`를 쓰지만, 이 필드는 '없음'이 정상 상태이므로
`없음`으로 명시한다.

### 목록 테이블 (`Table.tsx`)

열은 6개 그대로 두고 '등록자' 칸의 내용만 바꾼다.

```
등록자
송영신, 홍길동
```

- 등록자를 먼저, 공동작업자를 선택 순서대로 이어 붙여 쉼표로 나열
- 이름이 많아 칸을 밀지 않도록 **한 줄 말줄임**(`truncate`) 적용 — 전체는 항목을 열면 보인다
- 이름 해석 실패 시 이메일 로컬파트로 폴백 (기존 `owner` 폴백과 동일)

## 데이터 흐름

```
my-ai-work/page.tsx (RSC)
  ├ listOperators() ──→ aiWorkOperators (후보, active·본인 제외)
  │                     └→ collaboratorNameByEmail (표시용 맵)
  ├ listAiWorks() ────→ aiWorkToListRow(w, ownerByEmail, collaboratorNameByEmail)
  │                     └→ ListRow.collaboratorEmails / collaboratorNames
  └ onPersist ────────→ createAiWork / updateAiWork
                          └ normalizeCollaborators(...) → supabase
```

`ListRow`에 두 필드를 추가한다:
- `collaboratorEmails?: string[]` — 폼이 편집하는 원본(저장 값)
- `collaboratorNames?: string[]` — Table/View 표시용으로 서버에서 해석해 내려주는 값

이름을 클라이언트에서 다시 해석하지 않는 이유: 후보 목록은 폼에만 주입되는데
Table/View는 폼 없이도 렌더된다.

## 에러 처리

| 상황 | 처리 |
|---|---|
| 고를 후보가 없음(운영자 1명 / 전원 선택 완료) | 셀렉트를 `disabled`로 두고 '없음'을 그대로 보여준다. 저장은 정상 |
| 저장된 이메일이 후보에 없음(퇴사·비활성) | 칩은 이메일 로컬파트로 그대로 표시하고 유지한다. 과거 기록을 조용히 지우지 않는다 |
| 잘못된 이메일이 들어옴(직접 호출) | zod가 거부 → 기존 `parsed.error.issues[0].message` 경로로 사용자 메시지 |
| 자기 자신·중복 지정 | `normalizeCollaborators`가 조용히 제거 (에러 아님 — 사용자 의도가 명확하다) |

## 테스트 (TDD, RED 먼저)

| 대상 | 검증 |
|---|---|
| `collaborators.test.ts` | 중복 제거 / 등록자 제거 / 순서 유지 / 빈 입력·`undefined` → `[]` |
| `schemas.test.ts` | 배열 파싱, create 기본값 `[]`, 잘못된 이메일 거부, row에서 컬럼 누락 시 실패 |
| `actions.test.ts` | create는 `me.email` 기준, update는 **대상 row의 author_email** 기준으로 제외 |
| `EditForm.test.tsx` | 기본 '없음' / 선택 시 칩 추가 + 셀렉트 리셋 / 선택된 사람이 옵션에서 사라짐 / × 제거 / 후보 소진 시 disabled |
| `Table.test.tsx` | `송영신, 홍길동` 렌더, 공동작업자 없으면 등록자만 |
| `View.test.tsx` | 이름 나열, 없으면 '없음' |

## 영향 파일

신규 3

1. `supabase/migrations/20260810_ai_work_collaborators.sql`
2. `src/features/ai-work/collaborators.ts`
3. `src/features/ai-work/__tests__/collaborators.test.ts`

수정 9

4. `src/features/ai-work/schemas.ts`
5. `src/features/ai-work/actions.ts`
6. `src/app/dashboard/_components/patterns/ListPattern.tsx` — `ListRow` 2필드 + `aiWorkOperators` 통과
7. `src/app/dashboard/_components/inspector/InspectorListBody.tsx` — `aiWorkOperators` 통과
8. `src/app/dashboard/_components/inspector/list-variants/types.ts` — `EditFormProps.aiWorkOperators`
9. `list-variants/ai-work/EditForm.tsx`
10. `list-variants/ai-work/View.tsx`
11. `list-variants/ai-work/Table.tsx`
12. `src/app/dashboard/my-ai-work/page.tsx`

후보 목록은 `page → ListPattern → InspectorListBody → EditForm` 3단계로 전달된다
(`backupOperators`와 동일 경로). 각 단계마다 타입 선언·구조분해·전달 3곳씩이라 한 군데만 빠져도
후보가 `[]`로 도착한다.

기존 테스트 파일(`schemas.test.ts`, `actions.test.ts`, 변이 테스트)에 케이스를 추가한다.

`queries.ts`는 **손대지 않는다** — `listAiWorks`가 `select("*")`라 새 컬럼이 자동으로 딸려온다.

프로젝트 HARD-GATE 기준 6~19개 = **간략 설계 등급**.

## 검증

- 마이그레이션은 **머지 전 Supabase에 선적용**하고 service_role로 컬럼 존재를 확인한다
- `npm test` / `npm run typecheck` / `npm run lint` / `npm run build` 통과
- 실화면 확인: 등록 → 공동작업자 2명 선택 → 저장 → 목록 '등록자' 칸에 `이름, 이름` → 항목 열어 View 확인 → 수정에서 1명 제거 후 재저장
