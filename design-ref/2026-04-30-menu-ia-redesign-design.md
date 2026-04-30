# 메뉴 IA 재구성 설계

**날짜**: 2026-04-30
**스코프**: Folio Dashboard 사이드바 IA를 IT 운영 가정에서 운영부 도메인(서비스 라이프사이클 + 프로젝트 + 요청·자료)으로 전환

## 목적

현재 22-slot 사이드바는 IT 인프라 운영(서비스/DB/캐시/배치 등)을 가정해 진학사 운영부 도메인(연 2,500건 서비스 라이프사이클 + 12 프로젝트 + 고객 요청·자료 통합)과 어긋난다. 운영자 17명(실무 15명)이 Teams/노션에 흩어진 자료를 한 곳에서 처리하도록, 메뉴를 도메인 흐름 중심으로 재구성한다.

**핵심 가치**: "필요한 것만 딱딱 보고 업무 처리"

## 아키텍처

기존 시스템(`dynamic [slug]` 라우트 + 4 패턴 — list/dash/log/settings + Inspector + sidebar group)을 그대로 활용한다. 새 패턴 `project` 하나만 추가. 사이드바 데이터(`_data.ts`) + slug 매핑(`_data/patterns.ts` 모킹) + e2e 라우트 배열만 갱신하면 끝나는 변경이다.

**불변**: layout.tsx 셸 / Sidebar 컴포넌트 / SbSection·SbGroup·SbItem 타입 / `findSidebarMeta` 헬퍼 / Inspector grid

## 도메인 컨텍스트

- **조직**: 운영부 17명 (부장 1, 팀장 1, 실무 15)
- **연간 규모**: 2,500여 건 서비스
- **라이프사이클 7단계**: 계약 → 개발/테스트 → 배포/운영 → 마감 → 전형료 정산 → 계산서 발행 → 미수 채권
- **프로젝트**: 12개 (PIMS, 접수관리자, 내부관리자, 경쟁률, 생성툴, 매출 분석, 정산·진학캐쉬, 초중고 사업, 대교협 연계, 추천인 검증, 보증보험, 실적증명)
- **자료 통합**: Teams/노션의 흩어진 자료를 시스템 내부로
- **부가**: 연차는 내부 앱 사용 → 본 시스템 제외

## 신규 IA 정의

**6 섹션 / 4 그룹 / 47 페이지**

### 1. 개요 (4)
| 라벨 | slug | 패턴 | count 의미 |
|---|---|---|---|
| 실시간 현황 ★ 인덱스 | `/dashboard` | dash | (없음) |
| 새 알림 | `alerts` | dash | 미확인 알림 수 |
| 오늘 할 일 | `my-todo` | list | 본인 오늘 ToDo 수 |
| 전체 일정 | `schedule` | list (캘린더 뷰) | 향후 7일 일정 수 |

### 2. 요청 · 자료 (5)
| 라벨 | slug | 패턴 | 비고 |
|---|---|---|---|
| 인수인계 | `handover` | list | 섹션 첫 항목 (빈도 높음) |
| ▾ 고객 응대 | (group) | — | sub 3 |
| · 자료 요청 | `data-requests` | list | |
| · 사고 보고 | `incidents` | list | |
| · 대학 연락처 | `contacts` | list | |
| 백업 요청 | `backup` | list | |
| 자료 보관 | `vault` | list | Teams 통합 자료 |

### 3. 서비스 그룹 (20)
**▾ 서비스사이클** (group, 8 sub)
| 라벨 | slug | 패턴 |
|---|---|---|
| 전체 서비스 | `services` | list |
| 계약 | `contracts` | list |
| 개발 · 테스트 | `dev-test` | list |
| 배포 · 운영 | `deploy` | list |
| 서비스 마감 | `closing` | list |
| 전형료 정산 | `settlement` | list |
| 계산서 발행 | `invoice` | list |
| 미수 채권 | `receivables` | list |

**▾ 프로젝트** (group, 12 sub, 모두 `project` 패턴)
- PIMS / 접수관리자 / 내부관리자 / 경쟁률 / 생성툴 / 매출 분석 / 정산·진학캐쉬 / 초중고 사업 / 대교협 연계 / 추천인 검증 / 보증보험 / 실적증명
- slug 키: `pims` · `reception-admin` · `internal-admin` · `competition` · `generator` · `revenue` · `jh-cash` · `k12` · `kcue` · `referral` · `guarantee` · `performance`
- **slug 충돌 회피**: 라이프사이클 `settlement` ↔ 프로젝트 `jh-cash`로 분리

### 4. 분석 · AI (7)
**▾ 분석 & 보고** (group, 3 sub)
| 라벨 | slug | 패턴 |
|---|---|---|
| 업무 활동 로그 | `worklog` | log |
| 성과 리포트 | `outcomes` | dash (자동 생성) |
| 분석 보고서 | `reports` | list (사람이 작성) |

**▾ AI & 자동화** (group, 4 sub)
| 라벨 | slug | 패턴 |
|---|---|---|
| AI 인사이트 | `ai-insight` | dash |
| AI 어시스턴트 | `ai-assistant` | settings |
| 내 AI 작업 | `my-ai-work` | list |
| AI 팁 공유 | `ai-tips` | list |

### 5. 매뉴얼 · 가이드 (5)
| 라벨 | slug | 패턴 |
|---|---|---|
| 운영 매뉴얼 | `manual` | list |
| 표준 절차 SOP | `sop` | list |
| 바이브코딩 가이드 | `vibe-coding` | list |
| 회의록 | `meetings` | list |
| FAQ · 사례집 | `faq` | list |

### 6. 관리 (5)
| 라벨 | slug | 패턴 |
|---|---|---|
| 팀 · 권한 | `team` | list |
| 시스템 설정 | `settings` | settings |
| 신규 온보딩 | `onboarding` | settings |
| 개선 요청 | `feedback` | list |
| 공지사항 | `notices` | list |

### 패턴 합계
| 패턴 | 페이지 수 |
|---|---|
| list | 27 |
| dash | 4 |
| log | 1 |
| settings | 3 |
| **project (신규)** | 12 |
| **합계** | **47** |

검산: 27 + 4 + 1 + 3 + 12 = 47 ✓

### Count 의미 통일 규칙
- **단독 항목 / sub-item**: 해당 페이지 내 "신규/오늘/긴급/진행 중" 건수 (페이지별 정의)
- **그룹 헤더**: sub의 합산이 아닌, sub 중 "오늘/긴급" 항목 수 (운영자가 즉시 봐야 하는 양)
- 라이프사이클 단계 카운트는 "그 단계에 머무르는 서비스 수"
- 프로젝트 카운트는 "진행 중 개선과제 수"
- 카운트 0이면 표시 생략

## 사이드바 데이터 구조 변경

`src/app/dashboard/_data.ts`의 `sidebarSections`를 위 6 섹션으로 전면 교체. 타입(`SbSection` / `SbGroup` / `SbItem`) 변경 없음 — 기존 타입으로 표현 가능. `findSidebarMeta` 헬퍼 그대로 사용.

`SbPattern` 타입에 `"project"` 리터럴 1개 추가:
```ts
export type SbPattern = "list" | "dash" | "log" | "settings" | "project";
```

## 새 패턴: ProjectPattern

12 프로젝트 페이지가 사용. **상단 탭 + 탭별 콘텐츠** 구조.

```
[프로젝트명]                                [메타 badge]
==============================================
[탭: 상세 | 개선사항 (N) | 활동 로그]
==============================================
선택된 탭의 콘텐츠
```

**탭 3개 (1차 결정)**:
1. **상세** — 프로젝트 속성 (담당자, 서비스 수, 분기 목표, 관련 자료) — `field-grid` 형태
2. **개선사항** — 그 프로젝트 진행 중 개선과제 list — `list` 형태
3. **활동 로그** — 최근 활동 timeline — `log` mini

**구현**:
- 컴포넌트: `src/app/dashboard/_components/patterns/ProjectPattern.tsx`
- 탭 state: 페이지 내 `useState`. URL `?tab=` 쿼리는 1차에서 미적용 (필요 시 후속 단계).
- Inspector: ProjectPattern은 자체 grid (Inspector OFF)
- 데이터 shape: `ProjectMockData = { meta, attributes[], improvements[], activities[] }`

## 라우트 매핑

기존 `[slug]` 동적 라우트 그대로. 변경 없음.

- 인덱스: `/dashboard` → 실시간 현황 (변경 없음)
- 일반: `/dashboard/<slug>` → 패턴 lookup → 패턴 컴포넌트 렌더
- 잘못된 slug → `notFound()` (변경 없음)

## 구현 영향

**변경**:
- `_data.ts` — `sidebarSections` 전면 교체, `SbPattern` 타입 1개 추가
- `_data/patterns.ts` — 47 slug에 대응하는 mock 데이터 생성 (가벼운 placeholder 톤)
- `[slug]/page.tsx` — `project` 패턴 분기 추가 (cast 패턴 동일)
- `_components/patterns/ProjectPattern.tsx` — 신규 컴포넌트
- `e2e/dashboard-pages.spec.ts` — `ALL_SLUGS` 배열 47 slug로 갱신, ProjectPattern 탭 테스트 추가

**제거**:
- 기존 22 페이지 중 도메인에 맞지 않는 항목 (services-web, infra-cache, batch-jobs, grafana 등)에 대응되던 mock 데이터 정리

**불변**:
- `layout.tsx` 셸
- `Sidebar.tsx` 렌더링 로직 (group/item 구조 변경 없음)
- `findSidebarMeta` 헬퍼
- 기존 4 패턴 컴포넌트 (ListPattern / DashPattern / LogPattern / SettingsPattern) — 그대로 재사용

## 마이그레이션 전략

22 → 47 페이지 변환은 단일 PR로 처리. 데이터 레이어 일괄 교체이므로 파일 변경 영향이 좁고(주로 `_data.ts` + `_data/patterns.ts` + 신규 ProjectPattern), 부분 마이그레이션의 가치가 낮다.

진학사 사업 12 프로젝트 mock 데이터는 placeholder 톤 (담당자 가상 이름 + 가상 카운트)으로 통일. 실제 도메인 데이터는 Supabase 연결 단계에서 교체.

## 테스트 전략

**E2E** (`e2e/dashboard-pages.spec.ts`):
- 47 slug smoke 테스트 (200 + h2 노출 + console error 0)
- 잘못된 slug → 404
- 사이드바 active state — 새 라우트 (예: `/dashboard/contracts`)
- 패턴별 상호작용:
  - ListPattern: 행 선택 → Inspector 갱신
  - DashPattern: 위젯 선택 → Inspector 갱신
  - LogPattern: 풀 너비 + 검색 input
  - SettingsPattern: 좌 nav 클릭 → 우 form 전환
  - **ProjectPattern**: 탭 클릭 → 탭별 콘텐츠 전환 (신규)

**유닛** (vitest):
- `findSidebarMeta` — 47 slug 모두 lookup
- 신규 mock 데이터 shape 검증

## 미정 항목 (운영하며 결정)

- 결재함 / 권한 신청 / 장비 신청 — [요청 · 자료]에 추가 여부
- 글로벌 검색바 / 즐겨찾기 — 헤더 영역 별도 설계 필요 (본 spec 범위 외)
- ProjectPattern URL 쿼리(`?tab=`) — 1차 후 사용 패턴 보고 결정
- "운영 매뉴얼" vs "신규 온보딩" 통합 — 1차 분리 유지, 사용 패턴 보고 검토

## 변경 요약

- **22 페이지 → 47 페이지** (IT-ops → 운영부 도메인)
- **5 섹션 → 6 섹션** (개요 / 요청·자료 / 서비스 그룹 / 분석·AI / 매뉴얼·가이드 / 관리)
- **4 패턴 → 5 패턴** (project 추가)
- **타입 변경 1줄** (`SbPattern` 리터럴 추가)
- **컴포넌트 신규 1개** (ProjectPattern.tsx)
- **데이터 변경**: `_data.ts` 전면 + `_data/patterns.ts` 전면
