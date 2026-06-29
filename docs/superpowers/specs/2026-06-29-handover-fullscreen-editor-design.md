# 인수인계 풀스크린 작성 화면 — 설계

- 작성일: 2026-06-29
- 대상: `/dashboard/handover` (작성 탭)
- 목표: 현재 우측 인스펙터(좁은 패널) 작성 방식의 시인성 한계를 해소. 목록 행 클릭 시 회의록처럼 **풀스크린 편집기**로 이동하고, **좌측 카테고리 레일 + 우측 폼** 레이아웃으로 6카테고리 × 14필드를 작성한다.

## 1. 배경 / 현재 구조

- 작성 탭은 `ListPattern variant="handover"`로 services 행 + `handover_records`(1:1, `service_id` unique 임베드) 목록을 보여준다.
- 행 클릭 → 우측 인스펙터 → `CategoryTabs`(6카테고리) × 14필드를 좁은 패널에서 작성. 시인성이 떨어진다(사용자 불만).
- 참고 패턴: 회의록 `/dashboard/meetings/[id]` — 별도 풀스크린 라우트, 서버 `page.tsx`가 데이터 로드, 클라이언트 워크스페이스가 상단 액션바 + 본문 + **디바운스 자동저장**.

데이터 모델(단일 소스 `features/handover/categories.ts`):

| 카테고리 key | 라벨 | 필드 수 |
|---|---|---|
| `contract` | 계약 | 2 (계약정보·계약자료) |
| `work` | 작업 | 7 |
| `payment` | 정산 | 2 |
| `contact` | 컨텍 | 1 (학교담당자) |
| `docs` | 서류 | 1 |
| `etc` | 기타 | 1 (특이사항) |

작성상태 enum: `draft`(작성중) / `ready`(작성완료) / `published`(인계완료), 미작성은 레코드 없음(`none`). 산정 규칙은 `completion.ts`(서버) / `progress.ts`(클라이언트 진행도)가 담당.

## 2. 결정 사항 (확정)

1. **레이아웃**: A안 — 좌측 카테고리 세로 레일 + 우측 선택 카테고리 폼.
2. **진입**: 목록 행 클릭 시 **바로** `/dashboard/handover/[serviceId]` 풀스크린으로 이동. 작성 탭에서 우측 인스펙터는 더 이상 클릭 경로에 사용하지 않는다.
3. **PDF/메일**: 편집기 상단바에 넣지 않는다. 인수인계 발송은 기존대로 '인수인계 진행' 탭에 둔다(편집기는 작성 전용).
4. **저장**: 회의록과 동일하게 **버튼 없는 디바운스 자동저장**.

## 3. 라우팅 / 진입 흐름

| | 현재 | 변경 후 |
|---|---|---|
| 목록 페이지 | `/dashboard/handover` (ListPattern: 검색·작성상태 필터·페이지네이션·전체/내 서비스 칩) | **그대로 유지** |
| 행 클릭 | 우측 인스펙터 패널 열림 | `/dashboard/handover/[serviceId]` 풀스크린 이동 |

- 신규 라우트 키 = `serviceId`. `handover_records`가 없을 수 있으므로(미작성) 편집기는 **레코드 없으면 빈 초안으로 열고, 첫 저장 시 `upsertHandoverRecord`(onConflict: service_id)로 생성**.
- 행 클릭 navigation은 handover `Table.tsx` 내부에서만 `router.push`로 처리. `ListPattern`/인스펙터 dispatcher/registry는 **무변경**(인스펙터가 트리거되지 않을 뿐). 목록의 검색·필터·페이지네이션·스코프 칩 자산을 그대로 유지.

## 4. 풀스크린 편집기 레이아웃 (A안)

```
┌──────────────────────────────────────────────────┐
│ ← 목록 이동   숙명여대 · Fall Admission  [작성중] ✓저장됨│  상단 액션바
├───────────────┬──────────────────────────────────┤
│ ● 계약   2/2  │  계약                              │
│ ○ 작업   3/7  │  ┌ 계약정보 ─────────────────┐    │
│ ○ 정산   0/2  │  │ 제목/형태/진행/상태/메모    │    │  우측: 선택 카테고리 필드
│ ● 컨텍   1/1  │  └─────────────────────────┘    │     (기존 위젯 재사용)
│ ○ 서류   0/1  │  ┌ 계약자료 ─────────────────┐    │
│ ○ 기타   0/1  │  │ 체크리스트 + 메모          │    │
│ ─────────────│  └─────────────────────────┘    │
│  진행 6/14    │                                  │
│  📋 다른 서비스 │                                  │
│     로 복제   │                                  │
└───────────────┴──────────────────────────────────┘
```

- **상단 액션바**: 좌측 `← 목록 이동`(Link → `/dashboard/handover`), 우측 작성상태 배지 + 자동저장 인디케이터(`✓ 자동 저장됨` / `저장 중…`).
- **좌측 레일**: 6카테고리 세로 메뉴. 항목별 진행도 `N/M`(`categoryProgress()` 재사용), 채움 점(●/◐/○). 하단에 전체 `진행 6/14` + `다른 서비스로 복제` 진입(기존 `CopySection` 재사용 — 1차→2·3차).
- **우측**: 선택 카테고리 필드 카드. 위젯은 기존 EditForm 로직 재사용 — `ContractInfoForm`/`SchoolContactPicker`/`ContractChecklist`/`StructuredInfoForm`/textarea. 넓은 폭으로 입력·체크리스트 시인성 확보.

## 5. 데이터 / 저장

- **자동저장**: 필드 변경 시 800ms 디바운스 → `upsertHandoverRecord`. 작성상태는 서버에서 자동 산정. revalidate는 편집 중 리렌더 방지를 위해 최소화(저장 후 상태 배지만 갱신).
- **DB 변경 없음**. `features/handover` 모듈(actions/queries/categories/progress/completion) 그대로 재사용.
- **로딩**: 서버 `page.tsx` — `requireMenu("handover")` → `getServiceForHandover(serviceId)`(없으면 `notFound()`) + `getHandoverByServiceId(serviceId)`(null 허용) + `getHandoverContactCandidates(...)`(SchoolContactPicker 후보).

## 6. 컴포넌트 분해 (격리 단위)

| 단위 | 역할 | 의존 |
|---|---|---|
| `handover/[serviceId]/page.tsx` (서버) | 권한 가드 + 데이터 로드, 워크스페이스 렌더 | `features/handover/queries` |
| `HandoverEditorWorkspace.tsx` (클라이언트) | 상단 액션바 + 레일/폼 오케스트레이션 + 자동저장 상태 | actions, categories, progress |
| `HandoverCategoryRail.tsx` | 좌측 6카테고리 + 진행도 + 복제 진입 | categories, progress |
| `HandoverCategoryFields.tsx` | 선택 카테고리의 필드 위젯 렌더(EditForm에서 추출) | 기존 필드 위젯들 |
| `list-variants/handover/Table.tsx` (수정) | 행 클릭 → `router.push('/dashboard/handover/{serviceId}')` | next/navigation |

- 필드 위젯(`ContractInfoForm` 등)은 현재 `EditForm.tsx`에 있으므로, 공용 가능하도록 `HandoverCategoryFields`로 추출해 편집기에서 사용한다(중복 방지).

## 7. 미사용 처리

- 작성 탭 클릭 경로에서 인스펙터 `View.tsx`/`EditForm.tsx`는 **미사용**이 된다(progress/history 탭과 무관). 1차 구현에서는 위젯 추출만 하고 파일은 남겨둔다. 완전 제거(registry/types 정리 포함)는 **후속 정리 PR로 분리**한다(surgical change 원칙).

## 8. 테스트 계획

- `HandoverCategoryRail`: 카테고리별 진행도 `N/M` 표시, 클릭 시 active 전환.
- `HandoverEditorWorkspace`: 초기 카테고리(계약) 렌더, 카테고리 전환 시 우측 필드 교체, 필드 변경 시 디바운스 후 `upsertHandoverRecord` 호출(모킹), 저장 인디케이터 상태.
- `Table` navigation: 행 클릭 시 `/dashboard/handover/{serviceId}`로 push.
- 기존 `progress.ts`/`completion.ts` 단위 테스트는 변경 없음.

## 9. 비범위 (YAGNI)

- 인스펙터 완전 제거 / registry·types 정리 → 후속 PR.
- 단일 스크롤(B안)·가로 탭(C안) 레이아웃.
- PDF/메일 편집기 통합.
- DB 스키마 변경.
