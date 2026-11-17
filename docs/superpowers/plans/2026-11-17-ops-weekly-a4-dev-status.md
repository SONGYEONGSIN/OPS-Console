# 운영부 주간업무보고 A4 (개발/테스트 구분 수집 + 굳는 시점 이동) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회사 PC 예약 작업이 수요일 09:30 에 Moa `작업진행현황` 을 한 번 조회해 `ops_weekly_dev_status` 를 채우고, 자동 항목이 굳는 시점을 [제출] 에서 당번의 [최종 보고] 로 옮긴다.

**Architecture:** 서버에 CRON_SECRET 창구 둘(`/api/ops-weekly/dev-status` 인제스트 + `/run-log`)과 SMS 소비자 이름 `ops-weekly-dev-status` 를 먼저 두고, 그다음 `scripts/moa-dev-status/` 의 python 수집기(로그인은 `scripts/moa-closing/scrape.py` import, 파서는 표준 라이브러리)와 ps1 래퍼를 얹는다. 구분 판정(`-`→dev, 일시→test)은 서버 한 곳에서 하고, 쓰기는 `service_id` upsert 라 아무것도 지우지 않는다. 범위 추가로 `submitReport` 는 스냅샷을 쓰지 않고, `finalizeWeek` 가 새 `freeze.ts` 로 전원 스냅샷을 먼저 굳힌 뒤 주를 `reported` 로 바꾸고 `week-reported` 를 낸다.

**Tech Stack:** Next.js 16 route handlers + server actions, TypeScript, zod 4, Supabase service_role, Vitest. Python 3.12 (selenium 4.41·requests·python-dotenv — 이미 `scripts/moa-closing/requirements.txt` 에 있음, 새 패키지 없음), `unittest`. Windows PowerShell 5.1 작업 스케줄러.

**Spec:** `docs/superpowers/specs/2026-11-17-ops-weekly-a4-dev-status-design.md` (구속력 있음. 실행자는 이 계획과 spec 을 둘 다 읽는다.)

## Global Constraints

- **PC 제약**: Windows 16GB 저메모리 PC다. dev 서버·`next build`·전체 테스트 금지. vitest 는 **지정한 디렉터리·파일만** `--maxWorkers=1` 로 돌린다(돌리기 전에 `find <대상> -name "*.test.ts*" | wc -l` 이 50 미만인지 본다). python 은 항상 `python -I -X utf8` 로 실행한다. 그 밖에 `npm run typecheck`(next-env 관련 에러면 먼저 `npx next typegen`)와 `npx eslint <바꾼 파일들>` 을 쓴다.
- **작업 위치**: 워크트리 `C:\Users\ys1114\ClaudeCode\Build\OPS-Console-feat-ops-weekly-a4`(브랜치 `feat/ops-weekly-a4-dev-status`)에서만 일한다. node_modules 정션은 컨트롤러가 이미 걸어 두었다. **메인 트리 `C:\Users\ys1114\ClaudeCode\Build\OPS-Console` 에서 브랜치를 바꾸지 않는다**(작업 스케줄러가 그 워킹트리를 실행한다).
- **실명 금지**: python 파서 테스트는 **손으로 만든 합성 HTML** 만 쓴다(`운영자A`·`개발자B`·`테스트대학교`·`1000001` 같은 자리값). 실제 직원 이름을 커밋하지 않는다. `C:\Users\ys1114\AppData\Local\Temp\claude\4f679e530b539f73\4762a7cf-41ec-41ad-86a5-78f783b6b7f5\scratchpad\a4recon\50-*response*.html` 은 **열지 않는다**.
- **라이브 금지**: 어느 태스크에서도 Moa 에 로그인하지 않는다(dry-run 포함 — 로그인 = 인증 문자 1통). 라이브 1회는 머지 뒤 사용자 승인으로 한다(아래 '배포 체크리스트').
- **DB**: 마이그레이션 없음(spec §5). `ops_weekly_dev_status(service_id integer pk, stage text check in ('dev','test'), raw_label text, collected_at timestamptz)` 는 A1 에 이미 있다. 설정 행 켜기 SQL 은 사용자가 실행한다.
- **이름 단일 소스**: SMS 소비자·잡 id 는 `ops-weekly-dev-status`, 작업 이름은 `OPS-Console-Ops-Weekly-Dev-Status`, dry-run env 는 `OPS_WEEKLY_DEV_STATUS_DRY_RUN`. python `SMS_CONSUMER` 는 **한 줄 상수**이고 env 로 덮어쓸 수 없다.
- **이름을 남기지 않는다**(spec §4.11): 저장 칸은 `service_id`·`stage`·`raw_label`(테스트 오픈 원문)·`collected_at` 뿐. 응답 HTML 을 파일로 쓰거나 출력하지 않고, 로그인 뒤 `_dump_page` 를 부르지 않으며, 실패 문구에 셀 내용을 싣지 않는다(행 번호와 이유만). 로그인 뒤 단계의 예외는 **타입 이름만** 싣는다.
- **브라우저 밖 `requests.post` 로 Moa 를 부르지 않는다**(IIS 403). 조회는 로그인한 Selenium 페이지 안의 `$.ajax` 다.
- **`scripts/moa-closing/scrape.py` 는 고치지 않는다.** import 해서 쓴다.
- **UI**: CLAUDE.md 디자인 규칙을 따른다 — 토큰 클래스만(hex/rgb 금지), `tabular-nums`, `kstFormat`. Task 7 실행자는 **frontend-design-specialist** 이고 390/768/1280 폭에서 깨지지 않는지 확인한다(dev 서버 금지라 클래스 단언 테스트로 확인한다).
- **ps1 인코딩**: 한글이 든 새 ps1 은 **UTF-8 with BOM** 으로 저장한다(PowerShell 5.1 은 BOM 없는 UTF-8 한글을 깨뜨린다 — `sms-status-refresh/*.ps1` 선례).
- 커밋은 `feat:`/`test:`/`docs:` 접두사 + 한국어 메시지로 쓰고 아래 두 줄로 끝낸다. 한 태스크 = 한 커밋.
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01J8U2MchDb4aqcAD9DbHutG
  ```
- 파일 400줄 안쪽, 함수 50줄 이하. `any`·`@ts-ignore`·`eslint-disable`·`console.log` 금지.

## Review Focus

1. **폼 값 넣기가 조용히 실패할 때** — Manager·CategoryName 이 기본값(본인·수시)으로 남거나, 필드 이름이 바뀌어 `Manager` 키 자체가 직렬화에 없으면 15행짜리 결과가 '전체' 처럼 인제스트된다. `form_not_set` 으로 멈추고 ajax 를 부르지 않아야 한다(Task 4 `check_serialized` 테스트 — 키 누락 케이스 포함).
2. **성공처럼 보이는 가짜 응답** — PUBLIC_PATHS 가 빠져 307 → `/login`, 또는 200 이지만 HTML 본문이면 python 이 성공으로 run-log 를 남긴다. 리다이렉트를 따라가지 않고 `ok === true` JSON 만 성공이어야 한다(Task 4 `post_ingest` 테스트).
3. **직원 이름이 로그·run-log 로 새는 것** — 파서 실패나 로그인 뒤 예외 문구에 담당자 칸이 실리면 Teams 알림·일일 보고로 퍼진다. 픽스처의 이름이 반환값·예외·stdout·run-log 본문 어디에도 없어야 한다(Task 3·4 테스트).
4. **[최종 보고] 중 한 사람 스냅샷만 실패할 때** — 주가 `reported` 가 되거나 `week-reported` 가 나가면 A3 가 빈 스냅샷으로 파일을 만든다. 주는 open 그대로, 이벤트 없음, 다시 누르면 처음부터 다시 굳혀야 한다(Task 6 테스트).
5. **정정으로 다시 연 주에서 [다시 작성] 을 누를 때** — A1 `returnReport` 는 `snapshot: null` 을 써서 굳은 값을 지운다. 그러면 재보고가 새 값으로 다시 굳혀 spec §4.12('정정 뒤 재보고는 굳은 값 그대로')를 깬다. `returnReport` 는 스냅샷을 건드리지 않아야 한다(Task 6 테스트).

---

## 빌더 확인 해소 · 계획에서 정한 것

| spec 항목 | 결론 |
|---|---|
| §8 자동화 설정 행 표·칸 (`queries.ts:176`) | `getAutomationSettings()`(`src/features/automations/queries.ts:131`)가 `automation_settings(job_id text pk, enabled boolean)` 를 읽는다. SQL 은 배포 체크리스트에 적었다. |
| §8 submit 의 snapshot 위치·읽는 곳 | 쓰기: `workflow-actions.ts` `submitReport`(`loadAutoSnapshot` → `.update({…, snapshot})`), `returnReport`(`snapshot: null`). 읽기: `app/dashboard/ops-weekly/_load.ts` `loadViewedData`(`report.snapshot ?? loadAutoSnapshot(…)` — spec 의 읽는 규칙이 이미 이 모양), `schemas.ts` `snapshotSchema`(버전 다르면 null). 화면은 `view.snapshot` 만 받는다. |
| §8 소비자 목록을 단언하는 곳 | 전체 목록 단언은 `src/features/sms-codes/__tests__/schemas.test.ts` 하나. `poller-drift.test.ts` 는 `toContain` 이라 그대로 통과하고, `discover.py` 는 자기 이름만 하드코딩한다. |
| §8 최종 보고 소요 시간 | 오프라인으로 못 잰다. **결정**: 공통 조회를 나누지 않고 작성자별 `loadAutoSnapshot` 을 `Promise.all` 로 병렬 실행한다(17명 × 쿼리 4~5개, 체감 시간은 1명분). 첫 실제 [최종 보고] 때 걸린 시간을 확인한다(배포 체크리스트 7). |
| §8/§11 사라진 자동 항목의 메모·빼기 | `applyOverrides`(`merge.ts:93`)는 지금 목록만 돌므로 사라진 항목의 override 행은 DB 에 남고 화면에 안 보이며, 항목이 돌아오면 다시 붙는다. `computeKpis` 도 같다. A1 동작 그대로 두고 고치지 않는다. |
| (충돌) `returnReport` 의 `snapshot: null` | §4.12 정정 규칙과 충돌한다. **제거한다**(Task 6). 정정 아닌 주에서는 스냅샷이 원래 null 이라 영향이 없고, 배포 전 제출분의 옛 스냅샷은 첫 최종 보고가 덮어 쓴다. |
| 굳히는 대상 | 그 주 보고서 중 **현재 작성 대상 명단(`listWriters`)에 있는 사람 것**만 굳힌다. 명단 밖 보고서(제외·퇴사)는 화면이 고르지 않으므로(`pickViewed`) 그대로 둔다. A3 는 명단으로 거른다. |
| 공통 조회 분리 (§8 맡김) | 안 한다(위 결정). `auto-queries.ts` 는 바꾸지 않는다. |
| 머리글 읽는 곳 | 표 안의 `th` 를 문서 순서로 읽고 공백을 접는다(`thead` 유무에 기대지 않는다). |
| 서비스ID 칸 | 행의 **첫 `td.td_block` 안 첫 `<span>`** 의 텍스트(strip)가 `^\d{7}$` 여야 한다. 아니면 `row_shape`. 느슨하게 '숫자인 span 아무거나' 를 고르지 않는다 — 칸이 바뀌면 멈추는 쪽이 안전하다. |
| 직렬화 확인 | `parse_qs(keep_blank_values=True)` 로 `Manager`·`Developer`·`CategoryName` **키가 있고 값이 빈 문자열**인지, 값들 중에 시작일·종료일이 있는지 본다. 날짜 필드 이름은 정찰로 확정되지 않아 값으로 본다. |
| 로그인 뒤 대기·스크립트 타임아웃 (§8 맡김) | `WebDriverWait(driver, wait_sec).until(presence #form0)`, `driver.set_script_timeout(120)`. |
| 마감 대기 (§8 맡김) | 30초 간격, 최대 25분(마감 작업 실행 제한 20분 + 여유). 작업 실행 제한은 45분(대기 25 + 409 재시도 2×4 + 실행). |
| 종료일 +6개월 | 그대로 둔다. |
| 덤프·다운로드 폴더 | `%TEMP%\moa-dev-status`(고정, 매번 덮어씀)를 `CLOSING_DUMP_DIR`(`setdefault`)와 `setup_driver` 의 download_dir 로 쓴다. 로그인 전 덤프만 여기에 떨어진다. |
| 안내 한 줄 위치 | 원서접수·PIMS·휴가·외근 탭의 `TabHeading` 보조 줄(자동 묶음 위). 문구는 `자동 항목은 최종 보고 때 굳습니다`. |
| spec 영향 파일에 없는 것 | `src/features/agent-org/registry.ts`(잡마다 정확히 한 팀 배치를 `agent-org/__tests__/registry.test.ts` 가 강제), `scripts/moa-dev-status/test_ps_static.py`(ps1 원문 대조), `src/features/ops-weekly/freeze.ts`(workflow-actions.ts 가 400줄을 넘지 않게). |
| 드리프트 테스트 순서 | python 파일이 생기는 Task 4 에 둔다(Task 1 에 두면 읽을 원문이 없다). |

---

## File Structure

```
src/features/sms-codes/schemas.ts                      SMS_CONSUMERS 에 이름 추가                       (Task 1)
src/features/ops-weekly/constants.ts                   OPS_WEEKLY_DEV_STATUS_JOB_ID                    (Task 1)
src/features/ops-weekly/dev-status.ts                  stageFromTestOpen                               (Task 1)
src/features/ops-weekly/dev-status-schemas.ts          인제스트·run-log zod                             (Task 1·2)
src/app/api/ops-weekly/dev-status/route.ts             인제스트 (upsert)                                (Task 1)
src/app/api/ops-weekly/dev-status/run-log/route.ts     실행 기록 → recordAutomationRun                  (Task 2)
src/proxy.ts                                           PUBLIC_PATHS 1줄                                 (Task 1)
src/features/automations/registry.ts                   잡 1개 (localOnly, weekly)                       (Task 2)
src/features/agent-org/registry.ts                     수집팀 멤버 1개                                  (Task 2)
scripts/moa-dev-status/parse.py                        순수 파서 (html.parser)                          (Task 3)
scripts/moa-dev-status/collect.py                      진입점: env·로그인 재시도·조회·인제스트·run-log   (Task 4)
scripts/moa-dev-status/run-local.ps1                   래퍼 (마감 실행 중 대기)                         (Task 5)
scripts/moa-dev-status/register-task.ps1               수 09:30 작업 등록                               (Task 5)
.gitignore                                             scripts/moa-dev-status/run-local.log             (Task 5)
src/features/ops-weekly/freeze.ts                      전원 스냅샷 굳히기                               (Task 6)
src/features/ops-weekly/workflow-actions.ts            submit 무스냅샷 · return 무삭제 · finalize 순서   (Task 6)
src/app/dashboard/ops-weekly/_load.ts                  freezeNotice 플래그                              (Task 7)
src/app/dashboard/ops-weekly/_components/AutoFreezeNotice.tsx + 탭 3개 + page.tsx                       (Task 7)
CLAUDE.md                                              잡 표 1행(T2) · 우편함 다섯 + A4 줄(T4) · 굳는 시점 문단(T6)
```

---

### Task 1: SMS 소비자 이름 + 인제스트 창구

**Files:**
- Modify: `src/features/sms-codes/schemas.ts`, `src/features/sms-codes/__tests__/schemas.test.ts`
- Modify: `src/features/ops-weekly/constants.ts`, `src/features/ops-weekly/dev-status.ts`
- Create: `src/features/ops-weekly/dev-status-schemas.ts`
- Create: `src/app/api/ops-weekly/dev-status/route.ts`
- Modify: `src/proxy.ts` (PUBLIC_PATHS, `"/api/closing/run-log"` 근처), `src/__tests__/proxy-cron-paths.test.ts`
- Test: `src/features/ops-weekly/__tests__/dev-status.test.ts`(기존에 추가), `src/features/ops-weekly/__tests__/dev-status-schemas.test.ts`, `src/app/api/ops-weekly/dev-status/__tests__/route.test.ts`

**Interfaces:**
- Produces:
  - `SMS_CONSUMERS` = `["closing","ratio-audit","settlement-discover","sms-status-refresh","ops-weekly-dev-status"]`
  - `constants.ts`: `export const OPS_WEEKLY_DEV_STATUS_JOB_ID = "ops-weekly-dev-status";`
  - `dev-status.ts`: `export function stageFromTestOpen(raw: string): DevStage` — `-` 면 `"dev"`, 그 밖(검증된 일시)이면 `"test"`
  - `dev-status-schemas.ts`:
    - `export const DEV_STATUS_MAX_ROWS = 5000;`
    - `export const TEST_OPEN_RE = /^(-|\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$/;`
    - `export const devStatusIngestSchema` = `z.object({ rows: z.array(z.object({ service_id: z.number().int().positive(), test_open: z.string().regex(TEST_OPEN_RE) })).min(1).max(DEV_STATUS_MAX_ROWS) })` + `superRefine` 로 service_id 중복이면 이슈(메시지 `service_id 중복: {id}`)
    - `export type DevStatusIngest = z.infer<typeof devStatusIngestSchema>;`
  - `POST /api/ops-weekly/dev-status` 응답: 200 `{ ok: true, received: number, dev: number, test: number }` / 400·401·500 `{ ok: false, error: string }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// sms-codes/__tests__/schemas.test.ts — 기존 '소비자 넷' 케이스를 바꾼다
it("소비자 다섯 — 마감·경쟁률·정산 탐색·현황 최신화·주간보고 구분", () => {
  expect([...SMS_CONSUMERS]).toEqual(["closing","ratio-audit","settlement-discover","sms-status-refresh","ops-weekly-dev-status"]);
});

// ops-weekly/__tests__/dev-status.test.ts (추가)
it("테스트 오픈이 '-' 면 dev, 일시면 test", () => {
  expect(stageFromTestOpen("-")).toBe("dev");
  expect(stageFromTestOpen("2026-11-10 14:00:00")).toBe("test");
});

// ops-weekly/__tests__/dev-status-schemas.test.ts
const row = (id: number, t = "-") => ({ service_id: id, test_open: t });
it.each([
  ["빈 배열", { rows: [] }],
  ["날짜만", { rows: [row(1000001, "2026-11-10")] }],
  ["글자", { rows: [row(1000001, "개발중")] }],
  ["0", { rows: [row(0)] }],
  ["문자 id", { rows: [{ service_id: "1000001", test_open: "-" }] }],
  ["중복", { rows: [row(1000001), row(1000001)] }],
  ["5,001행", { rows: Array.from({ length: 5001 }, (_, i) => row(1000001 + i)) }],
])("거절: %s", (_, body) => expect(devStatusIngestSchema.safeParse(body).success).toBe(false));
it("5,000행은 받는다", () => {
  expect(devStatusIngestSchema.safeParse({ rows: Array.from({ length: 5000 }, (_, i) => row(1000001 + i)) }).success).toBe(true);
});

// app/api/ops-weekly/dev-status/__tests__/route.test.ts
// closing/run-log 테스트처럼 @/lib/supabase/admin 을 vi.hoisted 목으로 바꾼다: from → { upsert }
it("CRON_SECRET 미설정이면 500", …);            // delete process.env.CRON_SECRET
it("Bearer 가 틀리면 401", …);
it("JSON 이 아니면 400", …);                     // body: "not-json"
it("스키마 위반이면 400 이고 쓰지 않는다", …);  // rows: [] → status 400, upsert 미호출
it("upsert 한 번 — 서버 시각·원문·판정", async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-11-18T00:30:00Z"));
  const res = await POST(req({ secret: "s3cr3t", body: { rows: [row(1000001, "-"), row(1000002, "2026-11-10 14:00:00")] } }));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true, received: 2, dev: 1, test: 1 });
  expect(fromSpy.mock.calls.map(([t]) => t)).toEqual(["ops_weekly_dev_status"]);
  expect(upsertSpy).toHaveBeenCalledWith(
    [
      { service_id: 1000001, stage: "dev", raw_label: "-", collected_at: "2026-11-18T00:30:00.000Z" },
      { service_id: 1000002, stage: "test", raw_label: "2026-11-10 14:00:00", collected_at: "2026-11-18T00:30:00.000Z" },
    ],
    { onConflict: "service_id" },
  );
  vi.useRealTimers();
});
it("supabase error 면 500", …);                  // upsert → { error: { message: "boom" } } → 500, ok:false

// src/__tests__/proxy-cron-paths.test.ts — SESSIONLESS_ROUTES 에 추가
// 주간보고 개발 구분 — 회사 PC 수집기가 인제스트·실행 기록을 보낸다(CRON_SECRET). /run-log 는 접두사로 함께 열린다.
"/api/ops-weekly/dev-status",
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/features/sms-codes src/features/ops-weekly/__tests__/dev-status.test.ts src/features/ops-weekly/__tests__/dev-status-schemas.test.ts src/app/api/ops-weekly src/__tests__/proxy-cron-paths.test.ts --maxWorkers=1` → 새 케이스 FAIL.
- [ ] **Step 3: 구현한다.**
  - `SMS_CONSUMERS` 끝에 이름을 더한다(주석의 '넷' 표현이 있으면 같이 고친다).
  - 라우트는 `src/app/api/closing/run-log/route.ts` 의 인증·JSON·zod 순서를 그대로 따른다(500 → 401 → 400). 통과하면 `const collectedAt = new Date().toISOString()` 하나로 모든 행을 만들고 `createAdminClient().from("ops_weekly_dev_status").upsert(rows, { onConflict: "service_id" })` — `.select()` 를 붙이지 않는다. `error` 를 직접 보고 500. 건수는 입력에서 센다. 다른 표는 쓰지 않는다. 파일 머리 주석에 '지우지 않는 upsert · collected_at 은 서버 시각(PC 시계 불신)' 두 가지를 적는다.
  - `src/proxy.ts` PUBLIC_PATHS 에 `"/api/ops-weekly/dev-status"` 한 줄(`/api/ops-weekly` 로 넓히지 않는다).
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 + `npx vitest run src/proxy.test.ts src/app/api/sms-codes src/features/sms-sender/status-refresh/__tests__/poller-drift.test.ts --maxWorkers=1`(소비처). `npm run typecheck`, `npx eslint <바꾼 파일>`. Expected: 0 failed, exit 0.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간보고 개발 구분 인제스트 창구와 SMS 소비자 추가"`

---

### Task 2: 실행 기록 창구 + 자동화 잡 등록

**Files:**
- Modify: `src/features/ops-weekly/dev-status-schemas.ts`
- Create: `src/app/api/ops-weekly/dev-status/run-log/route.ts`
- Modify: `src/features/automations/registry.ts` (`ai-tips-collect` 뒤), `src/features/agent-org/registry.ts` (수집팀 members)
- Modify: `CLAUDE.md` ('자동화 잡' 표)
- Test: `src/features/ops-weekly/__tests__/dev-status-schemas.test.ts`(추가), `src/app/api/ops-weekly/dev-status/run-log/__tests__/route.test.ts`, `src/features/automations/__tests__/registry.test.ts`(추가)

**Interfaces:**
- Consumes: `OPS_WEEKLY_DEV_STATUS_JOB_ID`(Task 1), `recordAutomationRun(jobId: string, outcome: RunOutcome): Promise<void>`(`features/automations/run-recorder.ts`)
- Produces:
  - `export const devStatusRunLogSchema = z.object({ status: z.enum(["success","failed"]), message: z.string().max(1000) });`
  - `POST /api/ops-weekly/dev-status/run-log` 본문 `{ status, message }` → 200 `{ ok: true }`
  - 레지스트리 잡: id `OPS_WEEKLY_DEV_STATUS_JOB_ID`, label `주간보고 개발 구분 수집`, scheduleInfo `매주 수요일 09:30 (회사 PC 로컬 예약 작업)`, cadence `weekly`, `localOnly: true`, cooldownMinutes 60, `run` 은 `{ ok: false, message: "로컬 전용 — 회사 PC 작업 스케줄러가 실행합니다." }`(`ai-tips-collect` 와 같은 모양). description 문장은 실행자 판단.
  - 조직도: 수집팀에 `{ role: "주간보고 구분", agent: "dev-status-collector", source: { kind: "job", jobId: "ops-weekly-dev-status" } }`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// run-log/__tests__/route.test.ts — @/features/automations/run-recorder 의 recordAutomationRun 을 목으로
it("Bearer 가 틀리면 401", …);
it.each([["skipped 는 받지 않는다", { status: "skipped", message: "" }],
         ["1,001자", { status: "failed", message: "x".repeat(1001) }]])("400: %s", …);
it("success → ok:true 로 기록", async () => {
  await POST(req({ secret: "s3cr3t", body: { status: "success", message: "수집 2건" } }));
  expect(recordSpy).toHaveBeenCalledWith("ops-weekly-dev-status", { ok: true, message: "수집 2건" });
});
it("failed → ok:false 로 기록", …);   // { ok: false, message }

// automations/__tests__/registry.test.ts (추가)
it("ops-weekly-dev-status 는 수요일 로컬 전용 weekly 잡", async () => {
  const job = getJob("ops-weekly-dev-status");
  expect(job).toMatchObject({ label: "주간보고 개발 구분 수집", scheduleInfo: "매주 수요일 09:30 (회사 PC 로컬 예약 작업)", cadence: "weekly", localOnly: true });
  expect(await job!.run()).toEqual({ ok: false, message: "로컬 전용 — 회사 PC 작업 스케줄러가 실행합니다." });
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/app/api/ops-weekly src/features/ops-weekly/__tests__/dev-status-schemas.test.ts src/features/automations/__tests__/registry.test.ts --maxWorkers=1` → FAIL.
- [ ] **Step 3: 구현한다.** run-log 라우트는 Task 1 라우트와 같은 인증·파싱 순서 후 `await recordAutomationRun(OPS_WEEKLY_DEV_STATUS_JOB_ID, { ok: status === "success", message })` 하고 `{ ok: true }`. 표는 따로 쓰지 않는다(`automation_runs` 로 충분). CLAUDE.md '자동화 잡' 표에 한 행: `ops-weekly-dev-status` | 매주 수 09:30 — 회사 PC 작업 스케줄러(`scripts/moa-dev-status/run-local.ps1`) | Moa 작업진행현황의 테스트 오픈 칸 → 시작 전 서비스의 개발/테스트 구분(주간보고 원서접수 탭) | `ops_weekly_dev_status` + `automation_runs`. 표 아래에 한 줄: **localOnly 라 화면 토글이 없으니 `automation_settings` 행을 SQL 로 켜야 일일 보고가 미실행을 잡는다**(같은 구멍이 `ai-tips-collect` 에도 있다 — 언급만).
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 + 소비처 `npx vitest run src/features/automations/__tests__ src/features/agent-org/__tests__ src/app/api/automations/run --maxWorkers=1`. typecheck·eslint. Expected: 0 failed.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간보고 개발 구분 실행 기록 창구와 자동화 잡 등록"`

---

### Task 3: 작업진행현황 파서 (`parse.py`)

**Files:**
- Create: `scripts/moa-dev-status/parse.py`
- Test: `scripts/moa-dev-status/test_parse.py`

**Interfaces:**
- Produces (`parse.py`, 표준 라이브러리만 — `html.parser`·`re`. selenium 을 import 하지 않는다):
  - `EXPECTED_HEADER: tuple[str, ...] = ("대학정보","담당자","접수기간","엑셀 업로드","개발 요청","개발완료","테스트 오픈","리얼배포")`
  - `NO_RESULT_TEXT = "검색 결과가 존재하지 않습니다."`
  - `class DevStatusFailure(RuntimeError)`: `__init__(self, code: str, reason: str)`, 속성 `code`·`reason`, `str()` 은 `f"{code}: {reason}"`. Task 4 도 이 클래스를 쓴다.
  - `def parse_work_status(html: str) -> list[tuple[int, str]]` — `(service_id, test_open 원문)`. 실패 코드: `table_missing`·`header_changed`·`empty`·`row_shape`·`duplicate_id`(spec §4.9 표 그대로). 행 칸 판정: 8칸, 서비스ID 는 첫 `td.td_block` 의 첫 `<span>` 텍스트(strip)가 `^\d{7}$`, 테스트 오픈은 7번째 칸(공백 접기·strip)이 `^(-|\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})$`. **담당자 칸(2번째)은 읽지 않는다**(텍스트를 모으지 않는다). 실패 이유에는 `행 {n}`(1부터)과 무엇이 틀렸는지만 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다.** 파일 머리에서 `sys.path.insert(0, str(Path(__file__).resolve().parent))`(`-I` 는 스크립트 폴더를 넣지 않는다), 끝에 `if __name__ == "__main__": unittest.main()`. 합성 픽스처 빌더:

```python
NAME = "운영자A"   # 담당자 칸 자리값 — 어디에도 새면 안 된다
def row(sid="1000001", test_open="2026-11-10 14:00:00", cells=8, span=True):
    first = f'<td class="td_block"><b>테스트대학교</b><br><span> {sid} </span></td>' if span else '<td class="td_block">테스트대학교</td>'
    rest = [f"<td>{NAME}</td>", "<td>2026-12-01 ~ 2026-12-05</td>", "<td>-</td>", "<td>-</td>", "<td>-</td>",
            f"<td>\n  {test_open}\n</td>", "<td>-</td>"]
    return "<tr>" + first + "".join(rest[: cells - 1]) + "</tr>"
def page(rows, header=EXPECTED_HEADER, table=True): …   # <table summary="작업진행현황"><thead><tr><th>…</th></tr></thead><tbody>…</tbody></table>

def test_정상_일시와_대시가_섞여도_원문을_돌려준다(self):
    got = parse_work_status(page([row("1000001", "2026-11-10 14:00:00"), row("1000002", "-")]))
    self.assertEqual(got, [(1000001, "2026-11-10 14:00:00"), (1000002, "-")])
def test_표_없음(self):          self.assertCode(page([row()], table=False), "table_missing")
def test_머리글_변경(self):      self.assertCode(page([row()], header=EXPECTED_HEADER[:7] + ("배포",)), "header_changed")
def test_결과_없음_행(self):     self.assertCode(page(['<tr><td colspan="8">검색 결과가 존재하지 않습니다.</td></tr>']), "empty")
def test_행_0개(self):           self.assertCode(page([]), "empty")
def test_칸_수(self):            self.assertCode(page([row(cells=7)]), "row_shape")
def test_span_6자리(self):       self.assertCode(page([row("100001")]), "row_shape")
def test_span_없음(self):        self.assertCode(page([row(span=False)]), "row_shape")
def test_테스트오픈_이상값(self): self.assertCode(page([row(test_open="2026-11-10")]), "row_shape")
def test_중복(self):             self.assertCode(page([row("1000001"), row("1000001")]), "duplicate_id")
def test_이름이_반환값과_실패문구에_없다(self):
    self.assertNotIn(NAME, repr(parse_work_status(page([row()]))))
    for bad in (page([row(cells=7)]), page([row("1000001"), row("1000001")]), page([row(test_open="x")])):
        with self.assertRaises(DevStatusFailure) as cm: parse_work_status(bad)
        self.assertNotIn(NAME, str(cm.exception))
```

- [ ] **Step 2: 실패를 확인한다.** `python -I -X utf8 scripts/moa-dev-status/test_parse.py -v` → `ModuleNotFoundError: parse`.
- [ ] **Step 3: 구현한다.** `HTMLParser` 하위 클래스 하나가 `summary="작업진행현황"` 표 안에서만 `th` 텍스트·`tr`/`td` 를 모은다(중첩 표는 깊이로 무시). 칸마다 텍스트를 모으되 2번째 칸은 버린다. `td_block` 판정은 `class` 속성을 공백으로 나눈 토큰에 `td_block` 이 있는지로 한다.
- [ ] **Step 4: 통과를 확인한다.** 같은 명령 → `OK`.
- [ ] **Step 5: Commit** — `git commit -m "feat: 작업진행현황 파서 — 칸 모양이 바뀌면 아무것도 쓰지 않는다"`

---

### Task 4: 수집기 진입점 (`collect.py`) + 드리프트 테스트

**Files:**
- Create: `scripts/moa-dev-status/collect.py`
- Test: `scripts/moa-dev-status/test_collect.py`, `src/features/ops-weekly/__tests__/dev-status-drift.test.ts`
- Modify: `CLAUDE.md` ('Moa 로그인 SMS 인증번호 우편함' 절의 '넷뿐' → 다섯, `ops-weekly-dev-status` 추가. ops-weekly 절의 `ops_weekly_dev_status` 문장에 'A4 가 수요일 09:30 회사 PC 작업으로 채운다' 를 더한다)

**Interfaces:**
- Consumes: `parse_work_status`·`DevStatusFailure`(Task 3). `/api/ops-weekly/dev-status` 응답 `{ ok, received, dev, test }`(Task 1), `/run-log` 본문 `{ status, message }`(Task 2). `scrape.setup_driver(download_dir, headless)`·`scrape.login_and_2fa(driver, wait, env) -> SmsSource`·`scrape.sms_urls()`·`scrape.sms_source_label(source) -> str`·`scrape.academic_year_range(now)["start"]["date"]`, `sms_inbox.LeaseHeldError(holder, holder_since)` — 전부 **함수 안에서 늦게 import**.
- Produces (`collect.py`):
  - 모듈 머리: `_HERE`·`scripts/moa-closing` 를 `sys.path` 에 넣는다(`sms-status-refresh/refresh.py:28-33` 와 같은 모양)
  - `SMS_CONSUMER = "ops-weekly-dev-status"` — **줄 시작, 한 줄 상수**(드리프트 테스트가 `^SMS_CONSUMER = "([^"]+)"` 로 읽는다)
  - `TASK_NAME = "OPS-Console-Ops-Weekly-Dev-Status"`, `WORK_STATUS_URL = "https://moa.jinhakapply.com/Develop/WorkStatus"`, `LEASE_ATTEMPTS = 3`, `LEASE_WAIT_SEC = 240`, `DRY_RUN_ENV = "OPS_WEEKLY_DEV_STATUS_DRY_RUN"`
  - `def add_months_clamped(d: date, months: int) -> date` — 그 달에 없는 날은 말일
  - `def collect_range(now: datetime) -> tuple[str, str]` — `(올 학년도 시작 YYYY-MM-DD, KST 오늘 + 6개월 YYYY-MM-DD)`. 6개월 상수 옆 주석에 이유(시작 전 서비스를 계절 구멍 없이 본다, 2월에도 5,000행 안).
  - `def build_env(environ: Mapping[str, str]) -> dict` — 키 `username`·`password`·`sms_urls`·`sms_timeout`·`sms_interval`·`wait_sec`·`base_url`·`secret`·`sms_consumer`·`download_dir`. env 이름은 마감과 같다(`MOA_USERNAME`·`MOA_PASSWORD`·`MAKE_SMS_CODE_URL(_2)`·`MOA_SMS_POLL_TIMEOUT_SEC`(기본 90)·`MOA_SMS_POLL_INTERVAL_SEC`(3)·`MOA_WAIT_SEC`(40)·`OPS_CONSOLE_BASE_URL`·`CRON_SECRET`). `sms_consumer` 는 **언제나 `SMS_CONSUMER`**. `download_dir` 은 `%TEMP%\moa-dev-status`.
  - `def check_serialized(serialized: str, start: str, end: str) -> None` — 실패면 `DevStatusFailure("form_not_set", …)`(이유에 키 이름만, 값은 싣지 않는다)
  - `def fetch_work_status(driver, start: str, end: str, wait_sec: int) -> str` — 페이지 열기 → `#form0` 대기 → `FILL_JS` 로 `#ddlManager`·`#ddlDeveloper`·`#ddlCategoryName`·`#txtUnivServiceID`·`#txtServiceType`·`#txtServiceName` 비우고 `#txtApplyFromTime`=start·`#txtApplyToTime`=end, 각각 input·change 이벤트 → `SERIALIZE_JS`(`return $('#form0').serialize();`) → `check_serialized` → `set_script_timeout(120)` → `AJAX_JS` → status 200 이 아니면 `DevStatusFailure("fetch_failed", f"HTTP {status}")`. `AJAX_JS` 의 요청부는 spec §3.2 원문 그대로이고, `.done((b,_,x)=>done({status:x.status, body:b}))`·`.fail(x=>done({status:x.status, body:""}))` 로 콜백한다.
  - `def login_with_retry(env: dict, *, login=_login, sleep=time.sleep) -> tuple[object, str]` — `(driver, SMS 라벨)`. `LeaseHeldError` 면 `sleep(LEASE_WAIT_SEC)` 후 처음부터, 최대 `LEASE_ATTEMPTS` 회. 3회째도 409 면 `DevStatusFailure("lease_busy", f"점유자 {holder}")`. 다른 예외는 한 번으로 끝나고 `DevStatusFailure("login_failed", f"{type}: {첫 줄}"[:300])`(로그인 전 단계 문구라 셀 내용이 없다).
  - `def _login(env: dict) -> tuple[object, str]` — `moa_collect._login` 과 같은 모양(실패하면 드라이버를 닫고 올린다).
  - `def post_ingest(base_url: str, secret: str, rows: list[tuple[int, str]], *, http=requests) -> dict` — `allow_redirects=False`, timeout 30. 상태 200 이 아니거나, JSON 이 아니거나, `ok is not True` 면 `DevStatusFailure("ingest_failed", f"HTTP {status}")`.
  - `def post_run_log(base_url: str, secret: str, status: str, message: str, *, http=requests) -> None` — best-effort(예외 삼킴), message 1000자 자름.
  - `def success_message(resp: dict, start: str, end: str, sms_label: str) -> str` → `f"수집 {received:,}건 — 테스트 {test:,} · 개발 {dev:,} · 범위 {start}~{end} (SMS: {sms_label})"`
  - `def failure_message(code: str, reason: str) -> str` → `f"{code}: {reason} — 재실행: Start-ScheduledTask -TaskName '{TASK_NAME}'"`
  - `def run(env: dict, *, now: datetime, dry_run: bool, login=_login, fetch=fetch_work_status, http=requests, sleep=time.sleep) -> int` — env 누락(`username`·`password`·`sms_urls` 늘, `base_url`·`secret` 은 dry-run 아닐 때) → `env_missing` 실패 보고 후 1. 로그인 → 조회 → 드라이버 닫기(finally) → 파싱 → (dry-run 이면 건수만 출력하고 0, 인제스트·run-log 없음) → 인제스트 → 성공 run-log → 0. `DevStatusFailure` 는 `failure_message` 로 run-log 후 1. 로그인 뒤 예상 밖 예외는 `unexpected: {타입 이름}` 으로 보고 후 1. **응답 HTML 을 출력·저장하지 않는다.**
  - `def main() -> int` — 레포 루트 `.env.local` 을 `load_dotenv`(override=False, 실패 무시) → `os.environ.setdefault("CLOSING_DUMP_DIR", download_dir)` → `run(build_env(os.environ), now=datetime.now(timezone.utc), dry_run=os.getenv(DRY_RUN_ENV,"").lower()=="true")`

- [ ] **Step 1: 실패하는 테스트를 쓴다.** `test_collect.py` 머리에서 `_HERE` 와 `../moa-closing` 을 `sys.path` 에 넣는다(`sms_inbox.LeaseHeldError` 를 직접 쓴다). 드라이버·로그인·http·sleep 은 전부 가짜다.

```python
KST = timezone(timedelta(hours=9))
def test_범위_3월1일_경계_KST(self):
    self.assertEqual(collect_range(datetime(2026, 2, 28, 14, 59, tzinfo=timezone.utc)), ("2025-03-01", "2026-08-28"))
    self.assertEqual(collect_range(datetime(2026, 2, 28, 15, 30, tzinfo=timezone.utc)), ("2026-03-01", "2026-09-01"))  # UTC 로는 전날
def test_범위_없는_날은_말일(self):
    self.assertEqual(collect_range(datetime(2026, 8, 31, 1, 0, tzinfo=KST))[1], "2027-02-28")
    self.assertEqual(collect_range(datetime(2027, 8, 31, 1, 0, tzinfo=KST))[1], "2028-02-29")  # 윤년
def test_SMS_CONSUMER_는_env로_안_바뀐다(self):
    self.assertEqual(SMS_CONSUMER, "ops-weekly-dev-status")
    self.assertEqual(build_env({"SMS_CONSUMER": "closing", "sms_consumer": "closing"})["sms_consumer"], "ops-weekly-dev-status")
def test_직렬화_담당자_남음(self):        self.assertCode(lambda: check_serialized("Manager=kim&Developer=&CategoryName=&a=2026-03-01&b=2027-05-17", "2026-03-01", "2027-05-17"), "form_not_set")
def test_직렬화_수시_남음(self):          … "Manager=&Developer=&CategoryName=%EC%88%98%EC%8B%9C&…" → form_not_set
def test_직렬화_키_없음(self):            … "Developer=&CategoryName=&…" (Manager 키 없음) → form_not_set
def test_직렬화_날짜_틀림(self):          … 종료일 값이 없으면 form_not_set
def test_직렬화_정상(self):               check_serialized("Manager=&Developer=&CategoryName=&ApplyFromTime=2026-03-01&ApplyToTime=2027-05-17", "2026-03-01", "2027-05-17")
def test_조회_직렬화_실패면_ajax_를_안_부른다(self):  # FakeDriver.execute_script 가 "Manager=kim…" 반환
    with self.assertRaises(DevStatusFailure): fetch_work_status(drv, S, E, 1)
    self.assertEqual(drv.async_calls, [])
def test_조회_403(self):                  # execute_async_script → {"status": 403, "body": ""} → fetch_failed
def test_재시도_409_두번_뒤_성공(self):
    sleeps = []; login = FakeLogin([LeaseHeldError("closing", "t"), LeaseHeldError("closing", "t"), (drv, "우편함")])
    self.assertEqual(login_with_retry(ENV, login=login, sleep=sleeps.append), (drv, "우편함"))
    self.assertEqual(sleeps, [240, 240]); self.assertEqual(login.calls, 3)
def test_재시도_세번_모두_409(self):      # → lease_busy, 이유에 "closing"
def test_409_아닌_예외는_한번(self):      # RuntimeError("캡차 노출") → login_failed, login.calls == 1, sleeps == []
def test_인제스트_리다이렉트는_실패(self):  # FakeHttp 가 status 307 → ingest_failed, 호출 kwargs 에 allow_redirects=False
def test_인제스트_200_HTML은_실패(self):   # status 200, .json() 이 ValueError → ingest_failed
def test_인제스트_본문(self):              # json == {"rows": [{"service_id": 1000001, "test_open": "-"}]}, URL 끝 "/api/ops-weekly/dev-status", Bearer
def test_성공_문구(self):
    self.assertEqual(success_message({"ok": True, "received": 1463, "dev": 158, "test": 1305}, "2026-03-01", "2027-05-17", "우편함"),
                     "수집 1,463건 — 테스트 1,305 · 개발 158 · 범위 2026-03-01~2027-05-17 (SMS: 우편함)")
def test_실패면_인제스트_안_하고_재실행_명령을_붙인다(self):  # fetch 가 test_parse 의 row_shape 페이지 반환
    rc = run(ENV, now=NOW, dry_run=False, login=…, fetch=…, http=http, sleep=…)
    self.assertEqual(rc, 1)
    self.assertEqual([c.url for c in http.posts if c.url.endswith("/dev-status")], [])
    msg = http.run_log_bodies()[-1]["message"]
    self.assertTrue(msg.startswith("row_shape: ")); self.assertIn("Start-ScheduledTask -TaskName 'OPS-Console-Ops-Weekly-Dev-Status'", msg)
def test_이름이_stdout과_run_log에_없다(self):  # 위 실행을 contextlib.redirect_stdout 으로 잡아 "운영자A" 부재 단언
def test_dry_run은_아무것도_안_보낸다(self):    # 정상 페이지 → rc 0, http.posts == []
def test_env_누락은_로그인_전에_실패(self):     # username 없음 → rc 1, login.calls == 0, run-log 메시지 "env_missing: …"
```

```ts
// src/features/ops-weekly/__tests__/dev-status-drift.test.ts — poller-drift.test.ts 마지막 케이스와 같은 모양
it("python 소비자 상수가 서버 enum 에 있다", () => {
  // 없으면 우편함이 400 → python 은 InboxUnavailable 로 읽어 조용히 make 로 넘어간다.
  const py = readFileSync(join(process.cwd(), "scripts/moa-dev-status/collect.py"), "utf8");
  const m = /^SMS_CONSUMER = "([^"]+)"/m.exec(py);
  expect(m?.[1]).toBe("ops-weekly-dev-status");
  expect(SMS_CONSUMERS as readonly string[]).toContain(m![1]);
});
```

- [ ] **Step 2: 실패를 확인한다.** `python -I -X utf8 scripts/moa-dev-status/test_collect.py -v` → `ModuleNotFoundError: collect`. `npx vitest run src/features/ops-weekly/__tests__/dev-status-drift.test.ts --maxWorkers=1` → FAIL(ENOENT).
- [ ] **Step 3: 구현한다.** 위 Interfaces 그대로. 출력은 `[INFO] 범위 …`·`[INFO] 행 N건 (테스트 a · 개발 b)`·`[OK]`/`[FAIL] {code}` 정도로 짧게 — HTML·셀은 찍지 않는다.
- [ ] **Step 4: 통과를 확인한다.** `python -I -X utf8 scripts/moa-dev-status/test_collect.py -v` 와 `python -I -X utf8 scripts/moa-dev-status/test_parse.py -v` → `OK`. vitest 드리프트 테스트 PASS. `python -I -X utf8 -c "import ast,sys; ast.parse(open('scripts/moa-dev-status/collect.py',encoding='utf-8').read())"` exit 0. **`collect.py` 를 직접 실행하지 않는다**(로그인이 일어난다).
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간보고 개발 구분 수집기 — 409 재시도·직렬화 확인·이름 미저장"`

---

### Task 5: 작업 스케줄러 래퍼 · 등록 스크립트

**Files:**
- Create: `scripts/moa-dev-status/run-local.ps1`, `scripts/moa-dev-status/register-task.ps1` (UTF-8 with BOM)
- Modify: `.gitignore` (`scripts/moa-closing/run-local.log` 줄 아래에 `scripts/moa-dev-status/run-local.log`)
- Test: `scripts/moa-dev-status/test_ps_static.py`

**Interfaces:**
- Consumes: `scripts/moa-dev-status/collect.py`(Task 4), 작업 이름 `OPS-Console-Closing-Scrape`(마감, 이미 등록됨)
- Produces: 작업 `OPS-Console-Ops-Weekly-Dev-Status` — 트리거 `-Weekly -DaysOfWeek Wednesday -At 09:30am`, 설정 `-StartWhenAvailable -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 45)`, 스위치 `-Unattended`(S4U)·`-StorePassword` 는 `scripts/moa-closing/register-task.ps1` 그대로

- [ ] **Step 1: 실패하는 테스트를 쓴다.** `sms-status-refresh/test_ps_static.py` 의 `code_of()`(utf-8-sig 로 읽고 `#` 주석 줄을 지운다)를 그대로 쓴다.

```python
class TestRunLocal(unittest.TestCase):
    ps = code_of("run-local.ps1")
    def test_BOM(self):                   self.assertTrue((HERE / "run-local.ps1").read_bytes().startswith(b"\xef\xbb\xbf"))
    def test_마감_실행_중이면_기다린다(self):
        self.assertIn("Get-ScheduledTask -TaskName 'OPS-Console-Closing-Scrape'", self.ps)
        self.assertIn("'Running'", self.ps)
        self.assertRegex(self.ps, r"Start-Sleep -Seconds 30")
        self.assertRegex(self.ps, r"AddMinutes\(25\)")     # 상한
    def test_작업을_못_찾으면_진행하고_로그에_남긴다(self): self.assertIn("-ErrorAction SilentlyContinue", self.ps)
    def test_인터프리터_와_종료코드(self):
        self.assertIn('python -I -X utf8 -u "scripts\\moa-dev-status\\collect.py"', self.ps)
        self.assertIn('$ErrorActionPreference = "Continue"', self.ps)   # 경고 한 줄에 죽지 않게(마감 래퍼 주석 참고)
        self.assertIn("$LASTEXITCODE", self.ps); self.assertIn("run-local.log", self.ps)
class TestRegister(unittest.TestCase):
    ps = code_of("register-task.ps1")
    def test_BOM(self): …
    def test_트리거_설정(self):
        for s in ('"OPS-Console-Ops-Weekly-Dev-Status"', "-DaysOfWeek Wednesday -At 09:30am", "-MultipleInstances IgnoreNew",
                  "-StartWhenAvailable", "-WakeToRun", "New-TimeSpan -Minutes 45", "LogonType S4U", "[switch]$StorePassword"):
            self.assertIn(s, self.ps)
class TestGitignore(unittest.TestCase):
    def test_로그_무시(self): self.assertIn("scripts/moa-dev-status/run-local.log", (HERE.parent.parent / ".gitignore").read_text(encoding="utf-8").splitlines())
```

- [ ] **Step 2: 실패를 확인한다.** `python -I -X utf8 scripts/moa-dev-status/test_ps_static.py -v` → FAIL(파일 없음).
- [ ] **Step 3: 구현한다.** 두 ps1 은 마감 것(`scripts/moa-closing/run-local.ps1`·`register-task.ps1`)을 본떠 쓴다. `run-local.ps1` 은 python 호출 전에 마감 작업 State 를 30초 간격으로 보고, 25분이 지나도 Running 이면 로그에 남기고 진행한다. 작업이 없으면 기다리지 않고 로그에 남긴다. `$env:HEADLESS_MODE = "true"`. 시작/종료 줄은 마감 래퍼 형식(`=== {ts} 시작 (DRY_RUN=…) ===`). BOM 은 저장 후 `head -c 3 <file> | xxd -p` 가 `efbbbf` 인지로 확인한다. **두 ps1 을 실행하지 않는다**(작업 등록·로그인이 일어난다). PowerShell 구문은 `powershell -NoProfile -Command "[void][System.Management.Automation.Language.Parser]::ParseFile('<절대경로>',[ref]$null,[ref]$e); $e.Count"` 가 `0` 인지로만 확인한다.
- [ ] **Step 4: 통과를 확인한다.** Step 2 명령 → `OK`, 구문 검사 0.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간보고 개발 구분 수집 예약 작업 — 수 09:30, 마감 실행 중이면 대기"`

---

### Task 6: 자동 항목은 [최종 보고] 때 굳는다

**Files:**
- Create: `src/features/ops-weekly/freeze.ts`
- Modify: `src/features/ops-weekly/workflow-actions.ts` (`submitReport`, `returnReport`, `finalizeWeek`)
- Modify: `CLAUDE.md` (ops-weekly 절 '**제출하면 자동 항목을 스냅샷으로 굳힌다.** …' 문단 교체)
- Test: `src/features/ops-weekly/__tests__/workflow-actions.test.ts`(수정·추가 — `freeze.ts` 는 `finalizeWeek` 를 거쳐 시험한다), `src/app/dashboard/ops-weekly/__tests__/load-snapshot.test.ts`

**Interfaces:**
- Consumes: `loadAutoSnapshot(args: { weekStart; operatorEmail; operatorName; writerNames: ReadonlySet<string>; now: Date }): Promise<AutoSnapshot>`(`auto-queries.ts`, 바꾸지 않는다), `listWriters(): Promise<WriterCandidate[]>`, `listReports(weekId): Promise<ReportRow[]>`, `normEmail`, `WeekRow`·`ReportRow`(`schemas.ts`)
- Produces (`freeze.ts`, `import "server-only"`):
  - `export async function freezeWeekSnapshots(args: { week: WeekRow; writers: readonly WriterCandidate[]; reports: readonly ReportRow[]; now: Date }): Promise<number>` — 굳힌 보고서 수. 대상 = 작성자 명단에 있는 사람의 보고서, 정정(`week.reopened_at !== null`)이면 그중 `report.snapshot === null` 인 것만. **전원 스냅샷을 먼저 다 만든 뒤**(`Promise.all`, 하나라도 실패하면 아무것도 안 쓰고 던진다) 보고서마다 `.update({ snapshot }).eq("id", r.id).select("id")` — `error` 거나 0행이면 던진다. `updated_by` 는 바꾸지 않는다(사람이 쓴 게 아니다).
- 바뀌는 action 계약:
  - `submitReport`: `loadAutoSnapshot` 호출과 update 의 `snapshot` 을 뺀다. 나머지(조건부 전환·all-submitted)는 그대로.
  - `returnReport`: update 에서 `snapshot: null` 을 뺀다.
  - `finalizeWeek`: `checkFinalize` 통과 → `freezeWeekSnapshots({ week, writers, reports, now })` → (실패면 `자동 항목을 굳히지 못해 최종 보고를 멈췄습니다. 다시 눌러 주세요: {msg}` 로 실패 반환, 주·이벤트 없음) → 기존 조건부 주 전환 → `week-reported` → `openNextWeek`. `listReports` 결과는 한 번 읽어 `checkFinalize` 와 굳히기에 같이 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다.** `workflow-actions.test.ts` 의 기존 픽스처(`setup`·`seedReport`·`updates`·`snapshotSpy`·`emitSpy`)를 그대로 쓴다. 두 번째 보고서 id `R2` 는 테스트 파일에 uuid 상수로 둔다(`actions-fixture` 에는 `R`·`W` 뿐). **'굳은 값' 픽스처(`OLD`)는 스키마에 맞는 완전한 `AutoSnapshot` 이어야 한다** — `reportRowSchema` 의 `snapshotSchema` 가 모양이 틀린 값을 null 로 바꾸므로, `{ version: 1, marker }` 같은 값은 '빈 스냅샷' 으로 읽힌다. `@/app/dashboard/ops-weekly/__tests__/tab-fixtures` 의 `snap()` 을 쓴다.

```ts
// workflow-actions.test.ts — 기존 첫 케이스를 바꾼다
it("제출은 스냅샷을 쓰지 않는다 — 자동 항목은 최종 보고 때 굳는다", async () => {
  me("a@x"); setup({ writers: [op("a@x", "운영자A")] });
  expect(await submitReport({ reportId: R })).toEqual({ ok: true });
  expect(updates("ops_weekly_reports")[0][1]).not.toHaveProperty("snapshot");
  expect(snapshotSpy).not.toHaveBeenCalled();
});
it("다시 작성 요청은 굳은 스냅샷을 지우지 않는다(정정 주 포함)", async () => {
  me("d@x"); setup({ week: { duty_email: "d@x", reopened_at: "2026-11-20T01:00:00Z" }, report: { status: "submitted", snapshot: SNAP }, writers: [op("a@x","운영자A")] });
  expect((await returnReport({ reportId: R })).ok).toBe(true);
  expect(updates("ops_weekly_reports")[0][1]).not.toHaveProperty("snapshot");
});
it("최종 보고는 전원 스냅샷을 쓴 뒤에 week-reported 를 낸다", async () => {
  me("d@x");
  setup({ week: { duty_email: "d@x" }, report: { status: "submitted" }, writers: [op("a@x","운영자A"), op("b@x","운영자B")],
          extraReports: [seedReport({ id: R2, operator_email: "b@x", status: "submitted" })] });
  expect(await finalizeWeek({ weekId: W })).toEqual({ ok: true });
  const snapWrites = updates("ops_weekly_reports").filter(([, p]) => "snapshot" in p);
  expect(snapWrites).toHaveLength(2);
  const { calls, invocationCallOrder } = state.db.spies.update.mock;
  const lastSnapWrite = Math.max(...calls.flatMap(([t], i) => (t === "ops_weekly_reports" ? [invocationCallOrder[i]] : [])));
  expect(emitSpy.mock.invocationCallOrder[0]).toBeGreaterThan(lastSnapWrite);
  expect(emitSpy).toHaveBeenCalledWith(expect.objectContaining({ type: "week-reported", correction: false }));
});
it("한 사람이라도 굳히기에 실패하면 주는 open 이고 이벤트가 없다 — 다시 누르면 처음부터", async () => {
  snapshotSpy.mockResolvedValueOnce(SNAP).mockRejectedValueOnce(new Error("closing 조회 실패"));
  … (위와 같은 두 사람 setup)
  const r = await finalizeWeek({ weekId: W });
  expect(r.ok).toBe(false); expect(r.ok === false && r.error).toMatch(/^자동 항목을 굳히지 못해 최종 보고를 멈췄습니다/);
  expect(updates("ops_weekly_weeks")).toHaveLength(0); expect(emitSpy).not.toHaveBeenCalled();
  expect(updates("ops_weekly_reports")).toHaveLength(0);   // 다 만든 뒤에만 쓴다
  snapshotSpy.mockResolvedValue(SNAP);
  expect(await finalizeWeek({ weekId: W })).toEqual({ ok: true });
});
it("첫 최종 보고는 제출 때 굳은 옛 스냅샷도 덮어 쓴다", …);  // report.snapshot = OLD(version 1 유효 스냅샷) → 쓰인 값이 SNAP
it("정정 뒤 재보고는 굳은 값을 두고 빈 것만 채운다", …);      // reopened_at 있음, a 는 snapshot=OLD, b 는 null → b 만 update, correction: true

// app/dashboard/ops-weekly/__tests__/load-snapshot.test.ts — _load 의 읽는 규칙(바꾸지 않고 고정한다)
// server-only, auto-queries(loadAutoSnapshot), report-queries, week-queries, note-images, settings-queries 를 목으로
it("제출했지만 스냅샷이 비면 열 때마다 새로 계산한다 — 구분이 바뀌면 화면도 바뀐다", async () => {
  // report { status: "submitted", snapshot: null }, loadAutoSnapshot 이 1회차 unknown 1건, 2회차 test 1건
  const v1 = await loadOpsWeeklyPage(ME, {}, NOW); const v2 = await loadOpsWeeklyPage(ME, {}, NOW);
  expect(kindOf(v1).snapshot?.application.unknown).toHaveLength(1);
  expect(kindOf(v2).snapshot?.application.test).toHaveLength(1);
});
it("스냅샷이 있으면 원천이 바뀌어도 그 값이다", async () => {   // report.snapshot = SNAP → loadAutoSnapshot 미호출, view.snapshot === SNAP
});
```

- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/features/ops-weekly --maxWorkers=1` → 새·바뀐 케이스 FAIL. `npx vitest run src/app/dashboard/ops-weekly/__tests__/load-snapshot.test.ts --maxWorkers=1` → 읽는 규칙은 이미 있으므로 **PASS 가 정상**(특성 고정 테스트다 — 목 배선 실수가 아니라 실제로 `report.snapshot ??` 경로를 타는지 `loadAutoSnapshot` 호출 횟수로 확인한다).
- [ ] **Step 3: 구현한다.** `freeze.ts` 를 쓰고 세 action 을 고친다. `workflow-actions.ts` 의 `loadAutoSnapshot` import 가 남지 않으면 지운다(본인 변경이 만든 orphan). CLAUDE.md 문단을 spec §4.12 마지막 항목의 세 가지 + 이유로 바꾼다: **자동 항목은 당번의 [최종 보고] 때 전원 것을 한꺼번에 굳힌다** / 제출 때 고정되는 것은 손으로 쓴 내용뿐이다 / 정정 뒤 다시 보고해도 굳은 값은 그대로다 — 제출 때 굳히면 수요일 수집 전에 낸 보고서가 `구분 미확인` 으로 굳고, 같은 주 보고서끼리 기준 시각이 갈린다. 굳히기가 하나라도 실패하면 보고하지 않는다(반쯤 보고된 주를 만들지 않는다).
- [ ] **Step 4: 통과를 확인한다.** `npx vitest run src/features/ops-weekly --maxWorkers=1`, `npx vitest run src/app/dashboard/ops-weekly --maxWorkers=1`(각각 50 파일 미만인지 먼저 센다). typecheck·eslint. Expected: 0 failed.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간보고 자동 항목을 최종 보고 때 굳힌다"`

---

### Task 7: '자동 항목은 최종 보고 때 굳습니다' 안내 한 줄 (실행자: frontend-design-specialist)

**Files:**
- Modify: `src/app/dashboard/ops-weekly/_load.ts` (`OpsWeeklyView` week 종류에 `freezeNotice: boolean`, `loadOpsWeeklyPage` 반환)
- Create: `src/app/dashboard/ops-weekly/_components/AutoFreezeNotice.tsx`
- Modify: `src/app/dashboard/ops-weekly/_components/ApplicationTab.tsx`, `PimsTab.tsx`, `LeaveTab.tsx` (Props 에 `freezeNotice: boolean`, `TabHeading` children 으로 렌더), `src/app/dashboard/ops-weekly/page.tsx` (`WeekBody` 의 `props` 에 `freezeNotice: view.freezeNotice`)
- Test: `src/app/dashboard/ops-weekly/__tests__/load-snapshot.test.ts`(추가), `__tests__/ApplicationTab.test.tsx`·`PimsTab.test.tsx`·`LeaveTab.test.tsx`(추가), `__tests__/responsive.test.tsx`(추가)

**Interfaces:**
- Consumes: Task 6 의 읽는 규칙(스냅샷이 null 이면 살아 있는 값)
- Produces:
  - `_load.ts`: `export function freezeNoticeOf(week: Pick<WeekRow, "status">, report: Pick<ReportRow, "status" | "snapshot"> | null): boolean` = `week.status === "open" && report?.status === "submitted" && report.snapshot === null`
  - `AutoFreezeNotice()` — 문구 **정확히** `자동 항목은 최종 보고 때 굳습니다`, 한 줄 문장(줄바꿈 허용, `whitespace-nowrap`·`truncate` 금지), 토큰 클래스만. 모양(아이콘·색 강도)은 실행자 판단이지만 경고색(vermilion)은 쓰지 않는다 — 고장 알림이 아니라 설명이다.
  - 세 탭은 `freezeNotice` 가 true 일 때만 이 줄을 `TabHeading` 보조 줄 자리에 두어 **첫 자동 묶음 제목보다 앞**에 오게 한다. 프로젝트·TF 탭에는 없다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

```ts
// load-snapshot.test.ts (추가)
it.each([
  ["open·submitted·스냅샷 없음", { status: "open" }, { status: "submitted", snapshot: null }, true],
  ["작성 중", { status: "open" }, { status: "draft", snapshot: null }, false],
  ["굳음(정정 주)", { status: "open" }, { status: "submitted", snapshot: SNAP }, false],
  ["보고된 주", { status: "reported" }, { status: "submitted", snapshot: null }, false],
  ["보고서 없음", { status: "open" }, null, false],
])("freezeNoticeOf: %s", (_, w, r, want) => expect(freezeNoticeOf(w, r)).toBe(want));

// ApplicationTab.test.tsx / PimsTab.test.tsx / LeaveTab.test.tsx (각각, tab-fixtures 의 snap()·EMPTY 사용)
it("제출 후 최종 보고 전이면 자동 묶음 위에 굳는 시점을 알린다", () => {
  render(<ApplicationTab snapshot={snap()} detail={EMPTY} reportId="r1" editable={false} freezeNotice />);
  const note = screen.getByText("자동 항목은 최종 보고 때 굳습니다");
  const firstGroup = screen.getAllByRole("heading", { level: 3 })[0];      // 첫 자동 묶음 제목 (GroupShell·AutoGroupSection 의 h3)
  expect(note.compareDocumentPosition(firstGroup) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
it("freezeNotice 가 false 면 없다", () => { … expect(screen.queryByText("자동 항목은 최종 보고 때 굳습니다")).toBeNull(); });

// responsive.test.tsx (추가) — 390/768/1280 폭 확인을 클래스로 단언한다(dev 서버 금지)
it("굳는 시점 안내는 좁은 폭에서 줄바꿈된다", () => {
  render(<AutoFreezeNotice />);
  const el = screen.getByText("자동 항목은 최종 보고 때 굳습니다");
  for (const c of ["whitespace-nowrap", "truncate"]) expect(tokens(el)).not.toContain(c);
  expect(tokens(el).some((c) => /^(w|min-w)-\[/.test(c))).toBe(false);   // 고정 폭 없음
});
```


- [ ] **Step 2: 실패를 확인한다.** `npx vitest run src/app/dashboard/ops-weekly --maxWorkers=1` → 새 케이스 FAIL.
- [ ] **Step 3: 구현한다.** `loadOpsWeeklyPage` 반환에 `freezeNotice: freezeNoticeOf(week, report)` 를 더한다(`report` 가 null 이면 false). 세 탭 Props 에 필드를 더하고 `page.tsx` 의 공통 `props` 객체에 넣는다. 기존 page 테스트의 view 픽스처(`page-kpi-visibility`·`page-empty-roster`)는 필드가 없어도 falsy 로 동작해야 한다.
- [ ] **Step 4: 통과를 확인한다.** `npx vitest run src/app/dashboard/ops-weekly src/components/common --maxWorkers=1`(레포 전역 UI 가드가 `src/components/common` 에 있다), typecheck, `npx eslint <바꾼 파일>`, 그리고 `/design-audit` 로 바꾼 파일에 하드코딩 색·비표준 호버가 없는지 본다. Expected: 0 failed, 위반 0.
- [ ] **Step 5: Commit** — `git commit -m "feat: 주간보고 제출 후 최종 보고 전 자동 항목 안내"`

---

## 마무리 검증 (마지막 태스크 뒤, 컨트롤러)

```bash
python -I -X utf8 scripts/moa-dev-status/test_parse.py -v
python -I -X utf8 scripts/moa-dev-status/test_collect.py -v
python -I -X utf8 scripts/moa-dev-status/test_ps_static.py -v
npx vitest run src/features/ops-weekly --maxWorkers=1
npx vitest run src/app/dashboard/ops-weekly src/app/api/ops-weekly --maxWorkers=1
npx vitest run src/features/sms-codes src/app/api/sms-codes src/features/sms-sender/status-refresh/__tests__/poller-drift.test.ts src/__tests__/proxy-cron-paths.test.ts src/proxy.test.ts --maxWorkers=1
npx vitest run src/features/automations/__tests__ src/features/agent-org/__tests__ src/app/api/automations/run src/components/common --maxWorkers=1
npm run typecheck
npx eslint $(git diff --name-only main...HEAD -- '*.ts' '*.tsx')
git diff --name-only main...HEAD   # scripts/moa-closing/scrape.py 가 없어야 한다, 마이그레이션이 없어야 한다
grep -rn "운영자A\|개발자B" scripts/moa-dev-status   # 합성 자리값만 — 실명이 없는지 눈으로 본다
```

Expected: unittest `OK` 셋, vitest 0 failed, typecheck exit 0, eslint 0 problems.

---

## 배포 체크리스트 (머지 뒤 — spec §7 순서. 1~4 는 사용자 또는 컨트롤러, 5 는 사용자 승인 필수)

1. 머지 → **Vercel 배포 완료 확인**. prod 의 `/api/sms-codes/consume` 이 `ops-weekly-dev-status` 를 받아야 한다(없으면 400 → make 폴백·크레딧 소모). 이 확인 전에는 수집기를 한 번도 돌리지 않는다.
2. 메인 트리 `C:\Users\ys1114\ClaudeCode\Build\OPS-Console` 에서 `git checkout main && git pull`(스케줄러는 메인 워킹트리 파일을 실행한다).
3. `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/moa-dev-status/register-task.ps1 -Unattended` → `Get-ScheduledTaskInfo -TaskName 'OPS-Console-Ops-Weekly-Dev-Status'` 의 `NextRunTime` 이 다음 수요일 09:30 인지 본다.
4. 설정 행을 켠다(Supabase SQL Editor):
   ```sql
   insert into public.automation_settings (job_id, enabled, updated_at)
   values ('ops-weekly-dev-status', true, now())
   on conflict (job_id) do update set enabled = true, updated_at = now();
   ```
   안 켜면 일일 보고가 미실행을 `off` 로 넘긴다. 켜도 실행되는 것은 없다(localOnly 는 cron·수동 실행이 거부한다).
5. **사용자 승인 후** `Start-ScheduledTask -TaskName 'OPS-Console-Ops-Weekly-Dev-Status'` 1회(인증 문자 1통). 확인: `scripts/moa-dev-status/run-local.log` 끝 · `automation_runs` 의 성공 행(건수와 `(SMS: 우편함)`) · `ops_weekly_dev_status` 건수와 `collected_at` · 주간보고 화면에서 본인 시작 전 서비스가 `개발 중`·`테스트 중` 으로 나뉘는지. 소요 시간도 적는다. `row_shape`·`header_changed` 로 실패하면 실제 화면 구조가 합성 픽스처와 다른 것이다 — 파서를 고치되 실데이터는 커밋하지 않는다.
6. 다음 수요일 09:30 실행 기록을 확인한다(등록한 것 ≠ 도는 것).
7. 그 주 첫 [최종 보고] 뒤 보고서 전원의 `snapshot` 이 채워졌는지, 액션이 걸린 시간이 얼마였는지 확인한다.
