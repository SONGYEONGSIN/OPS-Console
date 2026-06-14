# 회의록(Meeting Minutes) 설계 — 2026-06-14

## 1. 목적 / 범위

운영부 회의록을 작성·관리하는 신규 메뉴를 만든다. 경위서(incident report)와 **동일한 패턴**을 따르되 **승인절차·시행번호 채번·사고(incidents) 종속을 제외**한 슬림 버전이다. 작성은 **유형(템플릿) 선택 → 노션형 블록 에디터** 방식으로 한다. 작성한 회의록은 PDF 생성 → 메일 발송 → SharePoint '운영부 > 03. 외근보고서' 폴더 업로드가 가능하다.

### 성공 기준
- `/dashboard/meetings`에서 회의록 목록 조회 + "새 회의록"(유형 선택) 생성
- `/dashboard/meetings/[id]`에서 노션형 블록 에디터로 작성/편집 + 자동 저장
- 작성한 회의록을 브랜드 PDF로 생성, 운영자 메일박스로 발송, 외근보고서 폴더에 업로드
- 상태: `draft`(작성중) → `sent`(발송완료), `revokeSend`로 되돌리기

### 비범위 (경위서 대비 제외)
- 승인체인(submit/approve/reject/revokeApproval) 및 결재라인(approver/director/ceo) 전부
- 시행번호 채번 / 공문관리대장 연동
- incidents 종속(incident_id FK)
- 기존 외근보고서 폴더 파일 **열람**(이번 범위는 신규 작성 중심. 폴더 읽기는 후속 확장)

## 2. 데이터 모델

하이브리드: 목록·검색·필터·PDF 헤더에 쓰이는 메타는 컬럼으로, 자유 작성 본문은 블록 JSON으로 분리한다.

### `meetings` 테이블
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid pk | |
| type | text check | `regular`\|`field`\|`project`\|`memo`\|`urgent` |
| title | text not null | 회의 제목 |
| meeting_date | timestamptz | 일시 |
| location | text | 장소(외근유형 UI 라벨="방문처") |
| attendees | jsonb default '[]' | 참석자 문자열 배열 |
| author_email | text not null | 작성자(운영자) |
| status | text check default 'draft' | `draft`\|`sent` |
| content | jsonb default '[]' | BlockNote 블록 문서 |
| sharepoint_url | text | 업로드 후 링크 |
| created_at / updated_at | timestamptz default now() | |

### `meeting_mail_sends` (이력 테이블)
경위서 `incident_report_mail_sends`를 본뜬다: id, meeting_id(fk on delete cascade), sent_by_email, recipients(jsonb), subject, status(`sent`|`dry_run`|`failed`), error, created_at.

### RLS
- `meetings`: read all(운영부 공개) / insert·update·delete는 인증 사용자(작성자 본인 또는 admin). 경위서 RLS(`20260601b`) 정책을 본떠 단순화.
- `meeting_mail_sends`: read all / insert는 service_role(server only).

### 마이그레이션
`supabase/migrations/`에 신규 2~3개: `YYYYMMDD_meetings.sql`(테이블+체크), `_meetings_rls.sql`, `_meeting_mail_sends.sql`. `20260601_incident_reports.sql` 계열을 템플릿으로 사용하되 incident_id·approval_roles·doc_number 컬럼 제외.

## 3. 유형(템플릿) 5종 + 시드 블록

유형은 "시작 시 어떤 시드 블록으로 문서를 채우느냐"만 결정한다(작성 중엔 자유). 시드 = BlockNote 블록 JSON 빌더(순수 함수, 유닛 테스트 대상).

| type | 라벨 | 시드 섹션(heading + 빈 블록) |
|---|---|---|
| regular | 정기회의 | 안건 / 논의 내용 / 결정사항 / 액션아이템(체크) |
| field | 외근·출장 보고 | 목적 / 면담 내용 / 결과·후속조치(체크) |
| project | 프로젝트·킥오프 | 목표 / 범위 / 일정 / R&R / 리스크 |
| memo | 1:1·간단 메모 | 메모 / 액션아이템(체크) |
| urgent | 긴급·이슈 대응 | 상황 / 영향 / 조치 / 결정 |

`buildSeedBlocks(type): Block[]` — 유형별 heading 블록 + 빈 단락/체크 블록 배열 반환.

## 4. 에디터 — BlockNote (노션형)

- 의존성: `@blocknote/react`, `@blocknote/core`, `@blocknote/mantine`(또는 기본 테마). 클라이언트 전용.
- Next App Router: `dynamic(() => import(...), { ssr:false })`로 SSR 회피. `"use client"`.
- 컴포넌트: `MeetingEditor`(BlockNote 래퍼) — initialContent=`content` 또는 신규 시 `buildSeedBlocks(type)`.
- **자동 저장**: onChange 디바운스(~800ms) → `saveMeetingContent(id, blocks)` 서버액션이 `content` jsonb upsert + `updated_at` 갱신. "✓ 자동 저장됨" 표시.
- 메타(제목/일시/장소/참석자)는 별도 폼 필드(헤더 영역)로 편집 → `updateMeetingMeta` 서버액션.
- 디자인 토큰(에디토리얼 팔레트)로 에디터 컨테이너 스타일링. BlockNote 내부 테마는 라이트 톤으로 맞춤.

## 5. PDF · 메일 · SharePoint (유지 기능)

### 5.1 블록 → react-pdf 매퍼 (선택된 전략 = 가)
- `lib/pdf/meeting-pdf.tsx` — 상단 메타 헤더(제목·유형·일시·장소·참석자, 브랜드 `[운영부 상황실]`) + 본문.
- `blocksToPdf(blocks): ReactPdfNode[]` — BlockNote **기본 블록만** 매핑: `heading`(레벨별), `paragraph`, `bulletListItem`, `numberedListItem`, `checkListItem`, `quote`, `table`, `divider`. 인라인 스타일(bold/italic/underline)도 텍스트 런 단위로 처리.
- 지원 외 블록(임의 임베드 등)은 무시하거나 플레인 텍스트 폴백 — `log`로 누락 표시. (BlockNote 기본 세트만 쓰므로 실제 누락 거의 없음)
- 기존 경위서 PDF 스택(react-pdf, Pretendard Bold, headless 브라우저 없음) 그대로 유지.
- 라우트: `src/app/api/meetings/[id]/pdf/route.ts`.

### 5.2 메일 발송
- `features/meetings/mail-actions.ts: sendMeetingMinutes(id)` — 경위서 `sendIncidentReport` 본뜸. 로그인 운영자 메일박스(Graph sendMail), 제목/본문 `[운영부 상황실]` 브랜드, PDF 첨부. `MAIL_DRY_RUN=true` 시 실제 발송 없이 이력 `status='dry_run'`.
- 발송 성공 → `meetings.status='sent'` + `meeting_mail_sends` 이력 적재.
- `revokeSendMeeting(id)`: `sent → draft`.

### 5.3 SharePoint 업로드
- 발송 시 PDF를 '운영부 > 03. 외근보고서' 폴더에 업로드. `lib/microsoft/drive-upload.ts: uploadFileToFolder` 재사용.
- 신규 env `SHAREPOINT_MEETINGS_FOLDER_ID`(공용 `SHAREPOINT_DRIVE_ID` 재사용) → `settings/_env.ts`에 등록.
- 업로드 후 `webUrl`을 `meetings.sharepoint_url`에 저장.
- env 미설정 시 업로드 단계는 스킵(메일/PDF는 동작) + `log` 경고 — 운영 전환 시 env 주입.

## 6. 메뉴 / 라우트 / UI

- 기존 placeholder `meetings` slug(자료 보관 > 회의록, `_data.ts`)를 전용 기능으로 승격. `[slug]` 목업 폴백에서 벗어남.
- **list-variant 등록**: `list-variants/meetings/`에 `View.tsx`/`EditForm.tsx`/`Table.tsx`/`filters.ts`/`status.ts`, `registry.ts`에 `"meetings"` 1줄 + `types.ts` Variant union 1줄.
  - Table 컬럼: 유형 배지 · 제목 · 일시 · 작성자 · 상태 배지
  - filters: 유형(5종)·상태(draft/sent)
- **목록 페이지**: `src/app/dashboard/meetings/page.tsx` — 목록 + "새 회의록" 버튼.
- **새 회의록 플로우**: 목록 페이지 "새 회의록" 버튼 → **유형 선택 모달**(5종) → `createMeeting(type)` → `/dashboard/meetings/[id]`로 이동(시드 블록 주입).
- **편집 워크스페이스**: `src/app/dashboard/meetings/[id]/page.tsx`(서버, `requireMenu("meetings")` 가드) + `_components/MeetingEditorWorkspace.tsx`(메타 헤더 + `MeetingEditor` + PDF/발송 액션).
- `operators` allowed_menus에 `meetings` slug 반영(권한 가드).

## 7. feature 디렉토리 구조

```
src/features/meetings/
  schemas.ts        # type/status enum, zod row schema, 메타 입력 schema
  templates.ts      # buildSeedBlocks(type) — 시드 블록 빌더 (+__tests__)
  queries.ts        # listMeetings, getMeeting(id)
  actions.ts        # createMeeting, updateMeetingMeta, saveMeetingContent, deleteMeeting, revokeSendMeeting
  mail-actions.ts   # sendMeetingMinutes
  pdf-model.ts      # blocksToPdf 매퍼 (+__tests__)
  __tests__/
```

## 8. 상태 머신

```
draft ──sendMeetingMinutes──▶ sent
  ▲                              │
  └────── revokeSendMeeting ─────┘
```
승인 관련 전이(pending/approved/rejected) 없음.

## 9. 에러 처리

- 자동 저장 실패: 에디터에 "저장 실패" 표시 + 재시도(다음 onChange에 재시도). 데이터 유실 방지 — 마지막 성공 스냅샷 유지.
- PDF 매퍼 미지원 블록: 무시/폴백 + 서버 로그(silent 캡 금지 — `log`로 누락 명시).
- 메일 발송 실패: 이력 `status='failed'` + error 기록, 상태는 `draft` 유지.
- SharePoint env 미설정: 업로드 스킵 + 경고 로그, 발송 자체는 진행.

## 10. 테스트 (TDD)

- **순수 함수 우선**: `buildSeedBlocks`(유형별 시드 정확성), `blocksToPdf`(블록 타입별 매핑·인라인 스타일·미지원 폴백), 상태 전이 가드 — 유닛 테스트 RED→GREEN.
- **서버액션**: create/updateMeta/saveContent/revokeSend의 권한·상태 검증.
- **list-variant 컴포넌트**: Table 렌더(유형/상태 배지), filters 옵션.
- **PDF 라우트**: 메타+본문 렌더 스모크.
- BlockNote 에디터 자체(라이브러리)는 통합 지점만 얕게 검증(자동저장 호출 등).

## 11. 규모 / 진행

20+ 파일(마이그레이션 3 + feature 6 + variant 5 + 라우트/컴포넌트 4 + PDF/메일/env/사이드바). HARD-GATE 전체 설계 → 본 spec 승인 후 **writing-plans로 태스크 분해 → TDD 구현**.
