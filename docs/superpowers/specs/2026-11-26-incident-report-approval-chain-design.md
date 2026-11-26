# 경위서 결재라인 4칸(담당자·팀장·부장·본부장) — 설계

> 2026-11-26 · 브랜치 `fix/incident-report-approval-chain` · 등급: **간략 설계**(약 15파일, DB 스키마 변경 없음)

## 1. 증상과 원인

- 사고보고 인스펙터 경위서 탭 결재라인이 `담당자 허승철 / 팀장 — / 본부장 허승철` 로 찍힌다. 실제로 허승철은 부장이고 본부장은 이이화다.
- `pickApprovalChain`(`features/incident-reports/queries.ts`)은 본부장 칸을 `role 본부장 → 없으면 부장` 으로 고른다. 운영 쪽에 role 본부장이 없고(유일한 본부장 이건목은 영업팀이라 빠진다) 부장 허승철이 들어간다. 사장 칸은 `role 사장 → 없으면 이사` 로 이이화가 들어가는데, #1319 가 인스펙터에서 그 칸을 숨겼다.
- 팀장 칸 `—`: 운영1팀에 role 팀장이 없고, 운영 쪽 `leader` 는 모두 비어 있다(이이화만 `leader="이사"` 라는 이상값).
- **승인이 멈춘다.** 승인자(`approver_email`)가 null 이면 `approveIncidentReport` 의 `approver_email !== me.email` 을 아무도 통과하지 못해 영구 대기다. 실례 1건.
- 고르는 순서가 DB 가 돌려준 순서에 기댄다 — `resolveApprovalChain` select 에 ORDER BY 가 없다.
- 기준 인물이 갈린다. 생성 때는 **작성자** 기준으로 굳히고(`actions.ts createIncidentReport`), 화면·PDF·발송은 **사고 담당자** 기준으로 다시 계산한다(`[id]/page.tsx`, `pdf/route.ts`, `mail-actions.ts`).
- 라벨이 갈린다. 인스펙터는 고정 "본부장", 공문(PDF)은 저장된 role 을 라벨로 쓴다(`form-content.ts deriveFormModel`). 규칙을 고쳐도 라벨이 role 이면 운영1팀이 `부장 허승철 / 부장 허승철` 로 찍힌다.

## 2. 사용자 결정 (2026-11-26, 다시 열지 않음)

1. 결재라인은 **담당자 → 팀장 → 부장 → 본부장** 4칸. 인스펙터·편집 화면·공문(PDF)이 같은 4칸·같은 고정 라벨. 사장 칸은 없어진다.
2. **운영1팀은 부장 허승철이 팀장을 겸임**한다 — 운영1팀: 팀장=허승철(=승인자), 부장=허승철. 운영2팀: 팀장 송영신, 부장 허승철.
3. **본부장 = 영업팀이 아닌 role `이사`**(지금 이이화). DB role 은 바꾸지 않는다 — 사고보고 메일의 이사님 참조(`incidents/cc.ts`)가 같은 조건이라 둘이 같은 사람을 가리켜야 한다. 'role 본부장 우선' 은 하지 않는다.
4. **기준 인물 = 사고 담당자**(결재라인 담당자 칸의 사람). 생성 때도 사고 담당자 기준으로 맞춘다.
5. 본인 작성 → 본인 승인 허용(코드 변경 없음).
6. **승인자를 못 찾으면 제출을 막고 안내한다** — `submitForApproval` 이 `{ ok:false, error:"결재선의 팀장을 찾지 못했습니다. …" }`.
7. 기존 경위서 3건은 이 PR 밖이다(§6).

## 3. 설계

- **저장 칼럼 재사용 — 마이그레이션 없음.** `approver_*` = 팀장, **`director_*` = 부장**, **`ceo_*` = 본부장**. 이름과 뜻이 어긋나는 것은 `ApprovalChain` 타입 JSDoc 과 CLAUDE.md 한 줄로 막는다.
- **`pickApprovalChain(duty, everyone)` 새 규칙**(영업팀 제외 유지). 후보를 **`emp_no` 오름차순, 같으면 email** 로 한 번 정렬한 뒤 고른다(`emp_no` 는 `not null` 이고 결재 후보 전원이 채워져 있다 — 2026-11-26 조회).
  - 팀장(approver): `leader` 이름 → 같은 팀 role 팀장 → **같은 팀 role 부장(겸임)** → null
  - 부장(director): 같은 팀 role 부장 → 영업팀 아닌 role 부장 → null (운영2팀은 같은 팀 부장이 없어 전사 폴백이 필요하다)
  - 본부장(ceo): 영업팀 아닌 role 이사 → null
- **고정 라벨 `APPROVAL_LABELS`**(담당자·팀장·부장·본부장)를 `form-content.ts` 에서 export 한다(서버·클라이언트 공용 파일). `deriveFormModel` 의 결재 줄과 인스펙터 View 가 같은 상수를 쓴다. 편집 미리보기(FormPage)·PDF 는 `deriveFormModel` 을 거치므로 따라온다. 공문의 '작성자=승인자면 담당자 칸 생략' 은 그대로 둔다.
- **인스펙터 본부장 칸 복원** — #1319 가 지운 `incidentReportCeoName` 을 `_row-mapper`·`ListRow`(삽입만)·`filters.ts` blank 에 되돌리고 View 를 4칸(담당자·팀장·부장=`director`·본부장=`ceo`)으로.
- **생성 때 기준 인물** — `createIncidentReport` 는 화면·PDF 와 같은 규칙(`사고.assignee_email ?? 작성자`)으로 기준 이메일을 정해 `resolveApprovalChain` 에 넘긴다. 사고는 이미 prefill 용으로 한 번 읽고 있어서, `getIncidentById` 를 한 번 더 부르지 않고 그 select 에 `assignee_email` 을 더한다. 담당자가 없을 때 작성자로 넘기는 것도 화면·PDF 와 같다 — 생성만 null 로 두면 화면은 작성자 기준 팀장을 보여 주는데 제출은 '팀장을 찾지 못했다' 로 막혀 둘이 어긋난다. 담당자 표기 칸(`author_*`)은 제출·발송 권한 판정에 쓰이므로 그대로 작성자다.
- **제출 가드 → 제출 때 재계산** — `submitForApproval` 이 행의 `approver_email` 을 함께 읽어, 비어 있으면 **생성과 같은 기준(사고 담당자 → 작성자)으로 다시 계산**한다. 찾으면 `approver_*`·`director_*`·`ceo_*` 를 상태 전이와 **같은 update** 로 저장하고 제출한다. 그래도 팀장이 없으면 지금 문구(결정 6)로 막는다. 화면(`[id]/page.tsx`·`pdf/route.ts`)은 저장값이 null 이면 라이브 계산으로 팀장을 그려서, 막기만 하면 '팀장 허승철' 이 보이는데 '팀장을 찾지 못했습니다' 로 막히는 모순이 났다. 인스펙터 View 는 이미 action 의 `error` 를 `text-vermilion` 문구로 그린다.
- **조회 실패 ≠ 못 찾음** — `resolveApprovalChain` 은 operators 조회 에러면 **던지고**(supabase-js 는 안 던지므로 `error` 를 보고 판정), 못 찾으면 null 이다. 제출 때 조회 실패(운영자·연결 사고 둘 다)는 `결재선을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.` 로 돌려주고 아무것도 저장하지 않는다. **생성 때 조회 실패는 승인자 없이 만든다** — 제출 때 재계산이 생겼으니 null 이 굳지 않고, 일시 장애로 경위서 작성 자체를 막을 이유가 없다. 화면·PDF·발송·번들은 원래대로 `.catch(() => null)` 로 저장값/빈 칸을 쓴다.
- **기준 인물 폴백** — `chainFromOperators(operators, 담당자, 작성자)` 가 정한다: 사고 담당자가 조회 범위(active·inactive) 안에 있으면 담당자, 없거나 조회되지 않으면(퇴사·정지) 작성자. 결정 4·'담당자 없으면 작성자' 를 넓힌 것이다 — 담당자를 못 찾아 null 이 되면 예전엔 작성자 기준으로 제출되던 사고가 새로 막혔다. 생성·제출이 `resolveApprovalChain(담당자 ?? 작성자, 작성자)` 한 함수를 쓴다(두 벌 금지). 화면·PDF·발송은 두 번째 인자를 안 넘겨 담당자를 못 찾으면 저장값을 쓴다.
- **인스펙터 담당자 칸 = 사고 담당자 ?? 작성자** — 팀장·부장이 사고 담당자 기준이고 편집 화면·PDF 의 담당자도 사고 assignee 라, 작성자를 찍으면(실데이터 3건 중 2건이 작성자≠담당자) '담당자 A / 팀장 = B 의 팀장' 으로 짝이 틀린다. 사고 인스펙터 `ReportTab` 이 `row.incidentAssigneeName` 을 넘기고 `bundleToReportRow` 가 `incidentReportDutyName` 에 채운다. 메일 본문 등 결재라인이 아닌 '작성자' 표시는 그대로 `author_name`.
- **조회 범위 메모** — 결재선은 operators `active·inactive` 를 본다(이사님 참조 `incidents/cc.ts` 는 active 만 — role 조건만 같다). 영업팀 밖에서 role 로 고르므로, **운영부 밖에 부장·이사가 생기면 부장/본부장 칸 후보가 된다**(2026-11-26 실측: 영업팀 밖 부장=허승철, 이사=이이화뿐).

## 4. 영향 파일

`features/incident-reports/queries.ts` · `actions.ts` · `form-content.ts` · `inspector/list-variants/incident-reports/View.tsx` · `filters.ts` · `patterns/ListPattern.tsx`(ListRow 한 줄 삽입) · `incident-reports/_row-mapper.ts` · 테스트(approval-chain · actions · form-content · View · filters · _row-mapper · FormPage · PDF) · `CLAUDE.md` 한 줄.

## 5. 태스크 (각 RED → GREEN)

1. 실제 조직 모양 픽스처 — 운영1팀 매니저 → 팀장·부장 허승철(겸임), 본부장 이이화
2. 운영2팀 → 팀장 송영신, 부장 허승철(전사 폴백), 본부장 이이화
3. 영업팀 본부장·부장 무시, 영업팀 밖에 본부장·사장 role 만 있으면 본부장 칸 null
4. 부장·이사가 여럿 → 같은 팀 우선, 그다음 `emp_no` 정렬
5. `deriveFormModel` 4칸 고정 라벨 — 저장 role 이 무엇이든 담당자/팀장/부장/본부장
6. 인스펙터 View 4칸, 본부장=이이화 · mapper·ListRow·filters
7. 생성 때 사고 담당자 기준
8. 제출 때 승인자 없으면 재계산 → 저장·제출 / 그래도 없으면 막힘 + 화면 문구 / 조회 실패는 다른 문구·저장 안 함
9. FormPage·PDF 테스트 픽스처 갱신
10. CLAUDE.md 한 줄
11. 담당자가 운영자 목록에 없으면 작성자 기준 체인(`chainFromOperators`)
12. 인스펙터 결재라인 담당자 칸 = 사고 담당자 ?? 작성자

## 6. 배포 뒤 — 기존 3건 갱신(이 PR 밖)

일회성 스크립트로 3건의 결재 칼럼을 새 규칙(사고 담당자 기준)으로 다시 계산해 **미리보기 → 사용자 확인 → 적용**. 대상: 승인자 null 로 멈춘 `pending_approval` 1건(기자의/담당 김지나), `draft` 1건(허승철), 송영신 작성 `pending_approval` 1건(담당 윤지혜).

## 7. 검증

`npm run typecheck` · 고친 ts/tsx `npx eslint` · `npm test -- src/features/incident-reports src/features/incidents src/app/dashboard/incident-reports src/app/dashboard/incidents src/app/dashboard/_components/inspector <PDF 테스트> --maxWorkers=2` · `npm test -- src/components/common --maxWorkers=2`.
