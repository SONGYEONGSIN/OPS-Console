# 우편물 영수증 A4 출력 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 우편물 > 영수증 목록에서 영수증을 체크하면 A4 한 장에 3개씩(접수일시 순, 접수일자·총요금 값에 형광펜) 놓인 PDF 가 새 탭으로 열린다 — 내부 전표 증빙을 손으로 붙이던 일을 없앤다.

**Architecture:** 이미 도는 판독(회사 PC 폴러 + 서버가 만드는 프롬프트)이 값과 함께 사진 속 위치(`regions`)도 돌려주게 한다(PR-1). 서버 라우트가 그 위치로 사진을 잘라 형광펜을 입히고 react-pdf 로 조립한다(PR-2). 목록에는 체크박스와 출력 버튼만 더한다(PR-3). 순서·묶음 규칙은 화면과 라우트가 한 모듈(`receipt-print/layout.ts`)을 같이 쓴다. DB 스키마와 폴러는 바뀌지 않는다.

**Tech Stack:** Next.js 16 App Router(route handler), TypeScript, zod 4, sharp 0.35(libvips 8.18), @react-pdf/renderer 4, Supabase(admin client, 비공개 버킷 `postal-receipts`), Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-09-28-postal-receipt-print-design.md` (revision 2)

## PR 과 멈출 지점

| 순서 | 브랜치 | 내용 | 파일 |
|---|---|---|---|
| PR-1 | `feat/postal-receipt-print` (스펙 커밋 위, 이미 있음) | 판독에 위치 받기 + 설계·계획 문서 | 6 |
| 🛑 | — (PR-1 머지·배포 후) | 14장 재판독 → 좌표·판독 품질 확인 → **사용자와 진행 결정** | 커밋 없음 |
| PR-2 | `feat/postal-receipt-pdf` | PDF 라우트(서버만). 실데이터 PDF 를 머지 전에 보인다 | 18 |
| PR-3 | `feat/postal-receipt-print-ui` | 체크박스·출력 버튼 | 9 |

서버와 화면을 가른 이유는 스펙 §7 끝에 있다(합치면 24파일 → HARD-GATE 전체 설계 등급, sharp 가 Vercel 에서 도는지를 화면보다 먼저 본다).

## Global Constraints

- **배치**: A4 세로, 여백 10mm, 칸 59mm × 3, 간격 6mm, **한 페이지 한 줄**. 머리글 없음, 아래 가운데 쪽번호만. **PDF 에 안내 문구를 찍지 않는다**(전표에 붙는 종이).
- **형광펜**: `접수일자` 값과 `총요금` 값만(항목명 제외). 노랑 `#fff176` 곱하기 합성, 상자 높이 25% 여유, 둥근 모서리.
- **한 PDF 30장**(`RECEIPT_PDF_BATCH`) — 화면의 묶음과 서버 상한이 **같은 상수**를 쓴다. 넘으면 화면이 접수일시 순으로 30장씩 나눈 버튼을 놓는다.
- **순서**: 접수일시 오름차순, 판독 전이면 올린 시각(한국 시각). **대상**: 사진이 있는 영수증 전부(확정 여부 무관).
- **가드**: 로그인(proxy) + `canViewMenu("postal", me)` — 페이지의 `requireMenu("postal")` 과 같은 함수를 쓴다.
- 사진은 **한 장씩 순서대로** 처리한다(메모리). 못 읽은 사진은 그 칸에 사유 한 줄, 나머지는 정상 출력.
- DB 마이그레이션·폴러(`scripts/postal/extract-local.mjs`) 수정 없음.
- 표시용 날짜·시각은 `kstFormat`. 정렬 키만 고정 +9시간(한국은 서머타임이 없다).
- UI `.tsx` 는 Tailwind 토큰만(hex 금지). PDF 파일은 기존 `src/lib/pdf/*` 처럼 hex 를 쓴다.
- 헤더 액션은 `HeaderActionButton`. 문장 속 숫자는 **한 텍스트 노드**로(쪼개면 테스트·검색이 그 문장을 못 집는다).
- 새 코드에 `any` / `@ts-ignore` / 비null 단언(`!`) 을 쓰지 않는다.
- 테스트 먼저(RED 확인) → 최소 구현(GREEN) → 커밋. vitest 는 `--maxWorkers=2`(16GB PC). 로컬 `next build` 는 돌리지 않는다 — 빌드 증거는 CI 의 `lint + typecheck + test + build (Linux)` 잡(로컬 빌드는 메모리 압박으로 죽은 적 있다).
- 커밋: Conventional Commits, 한국어, 끝줄 `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. PR 본문 끝 `🤖 Generated with [Claude Code](https://claude.com/claude-code)`. squash merge. **머지는 사용자의 명시 승인 후에만.** `git add` 는 파일을 지정한다 — `scripts/moa-applyprice/`(추적 안 하는 사용자 작업)는 스테이징하지 않는다.
- 브랜치 작업을 마치면 `main` 으로 돌아와 `git pull` — 회사 PC 스케줄러가 워킹트리를 실행한다.
- 개인정보: 채팅·로그에 수취인 이름·등기번호를 찍지 않는다(건수만). `.env.local` 값은 스크립트 안에서만 쓰고 출력하지 않는다.
- `SP` = 이 세션의 스크래치패드 경로(시스템 프롬프트에 있다). 아래 스크립트·조각 파일은 전부 거기에 둔다.

### 포매터 훅과 `splice.py`

`.claude/settings.local.json` 의 PostToolUse 훅이 Edit/Write 마다 `prettier --write <파일>` 을 돈다. 아래 여섯 파일은 원래 prettier 비준수라 Edit 로 고치면 **무관한 줄까지 다시 쓴다**(실측: `extract-parse.ts` 1곳, `queries.ts` 2곳, `PostalTable.tsx` 2곳, `extract-parse.test.ts` 53줄, `PostalTable.test.tsx` 48줄, `ReceiptReview.test.tsx` 137줄. 줄끝 CRLF→LF 는 autocrlf 라 diff 에 안 뜬다).

| 파일 | 도구 |
|---|---|
| `src/features/postal/extract-parse.ts` · `src/features/postal/__tests__/extract-parse.test.ts` · `src/features/postal/queries.ts` · `src/app/dashboard/postal/_components/PostalTable.tsx` · `.../__tests__/PostalTable.test.tsx` · `.../__tests__/ReceiptReview.test.tsx` | `splice.py` |
| 새 파일, `extract-prompt.ts`, `extract-prompt.test.ts`, `queries.test.ts`(준수) | Write / Edit |

`$SP/splice.py` — Edit 와 같이 정확히 맞는 문자열을 바꾸되 훅을 부르지 않는다:

```python
"""정확히 맞는 문자열을 바꾼다 — Edit 도구와 같지만 포매터 훅을 부르지 않는다.

사용: python splice.py <대상> <old 파일> <new 파일> [횟수]
  횟수를 안 주면 old 는 정확히 1번 나와야 한다. 주면 정확히 그만큼 나와야 하고 전부 바꾼다.
대상이 CRLF 면 new 도 CRLF 로 맞춘다(autocrlf 체크아웃).
"""
import sys

target, old_path, new_path = sys.argv[1:4]
want = int(sys.argv[4]) if len(sys.argv) > 4 else 1
raw = open(target, "rb").read().decode("utf-8")
crlf = "\r\n" in raw
text = raw.replace("\r\n", "\n")
old = open(old_path, encoding="utf-8").read().replace("\r\n", "\n")
new = open(new_path, encoding="utf-8").read().replace("\r\n", "\n")
found = text.count(old)
if found != want:
    sys.exit(f"old 가 {found}번 나온다 — {want}번이어야 한다: {target}")
out = text.replace(old, new)
if crlf:
    out = out.replace("\n", "\r\n")
open(target, "wb").write(out.encode("utf-8"))
print(f"바꿈 {found}곳: {target}")
```

쓰는 법: 각 단계의 **old** 코드 블록과 **new** 코드 블록을 `$SP/<이름>-old.txt`, `$SP/<이름>-new.txt` 로 Write 한다(`.txt` 는 훅 대상이 아니다). 코드 블록 내용 **그대로**, 끝에 빈 줄을 덧붙이지 않는다. 그다음 `PYTHONIOENCODING=utf-8 python "$SP/splice.py" <대상> "$SP/<이름>-old.txt" "$SP/<이름>-new.txt"`. 커밋 전 `git diff --cached --stat` 의 줄 수가 이 계획의 변경분과 맞는지 본다(지운 줄이 예상보다 많으면 재정렬이 섞인 것).

## Review Focus

스펙이 말하지 않았지만 쓰는 사람이 가장 먼저 부딪힐 것 다섯. 각 줄의 테스트를 그 코드를 가진 태스크에 넣었다.

1. **고른 영수증을 그사이 지웠다** — 남은 것만 찍고, 하나도 없으면 "영수증을 찾을 수 없습니다"(404). 한 장 때문에 PDF 전체가 실패하면 안 된다. → Task 11
2. **판독 전·재판독 대기·실패한 영수증** — 형광펜 없이 사진째 들어가고, 올린 시각(한국 시각)으로 순서에 끼며, 화면 안내("N장 중 M장은 형광펜이 빠진 곳이 있습니다")에 센다. 자정 전후에 올린 사진이 UTC 날짜 때문에 하루 앞에 서면 안 된다. → Task 5, 9, 14
3. **형광펜 상자가 종이 상자 밖**(모델이 두 상자를 따로 짚는다) — 잘라낸 영역 안에 든 만큼만 칠하고, 통째로 밖이면 안 칠한다. 오류로 멈추지 않는다. → Task 7
4. **사진을 못 받거나 못 읽는다**(저장소 오류·HEIC·손상) — 그 칸에 사유 한 줄, 나머지는 정상. → Task 11
5. **등기 20건이 넘는 아주 긴 영수증** — 페이지 높이에 맞춰 줄어 한 페이지 안에 든다. 넘치면 react-pdf 는 새 페이지를 만들지 않고 경고 한 줄만 남긴 채 **아래를 잘라 버린다**(실측) — 증빙이 잘린 채 전표에 붙는다. → Task 10

---

## PR-1 — 판독에 위치 받기

### Task 1: 판독 결과에 위치(regions) 스키마

**Files:**
- Modify (splice): `src/features/postal/extract-parse.ts:20`(앞에 스키마), `:31-32`(`regions` 칸)
- Test (splice): `src/features/postal/__tests__/extract-parse.test.ts` — `describe("assignDaySeq"` 앞에 삽입

**Interfaces:**
- Consumes: 없음
- Produces: `export type Regions = { receipt: Box | null; accepted_at: Box | null; total_fee: Box | null }`, `export type Box = [number, number, number, number]`, `Extraction["regions"]: Regions | null`. 모듈 안 `regionsSchema`(`.nullable().catch(null)` 가 붙은 것 — Task 9 의 `readRegions` 가 쓴다)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`splice.py` 로 `src/features/postal/__tests__/extract-parse.test.ts` 를 고친다.

old (`t1-test-old.txt`):
```ts
describe("assignDaySeq", () => {
```

new (`t1-test-new.txt`):
```ts
/**
 * 사진 속 위치 — 영수증 출력이 종이를 잘라내고 접수일자·총요금에 형광펜을 입힌다.
 *
 * 좌표는 사진 왼쪽 위가 0, 오른쪽 아래가 1 인 비율 `[x0, y0, x1, y1]`.
 * **이상한 상자는 그 상자만 버린다** — 형광펜보다 금액·등기번호가 중요하다.
 */
describe("parseExtraction — 위치(regions)", () => {
  const REGIONS = {
    receipt: [0.18, 0, 0.78, 1],
    accepted_at: [0.37, 0.12, 0.56, 0.14],
    total_fee: [0.53, 0.59, 0.72, 0.61],
  };
  const parse = (regions: unknown) =>
    parseExtraction(JSON.stringify({ ...GOOD, regions }));

  it("세 상자를 그대로 싣는다", () => {
    const r = parse(REGIONS);
    expect(r.ok && r.data.regions).toEqual(REGIONS);
  });

  it("위치가 없으면 null — 위치를 묻기 전 판독과 같은 모양이다", () => {
    const r = parseExtraction(JSON.stringify(GOOD));
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.regions).toBeNull();
  });

  it("범위를 벗어난 상자는 그 상자만 버린다 — 판독은 산다", () => {
    const r = parse({ ...REGIONS, receipt: [0.18, 0, 1.2, 1] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.regions?.receipt).toBeNull();
      expect(r.data.regions?.accepted_at).toEqual(REGIONS.accepted_at);
      expect(r.data.items).toHaveLength(3);
    }
  });

  it("픽셀로 온 좌표도 범위 밖이라 버린다", () => {
    const r = parse({ ...REGIONS, total_fee: [1602, 2380, 2177, 2460] });
    expect(r.ok && r.data.regions?.total_fee).toBeNull();
  });

  it("뒤집힌 상자는 버린다", () => {
    const r = parse({ ...REGIONS, accepted_at: [0.56, 0.12, 0.37, 0.14] });
    expect(r.ok && r.data.regions?.accepted_at).toBeNull();
  });

  it("숫자가 아닌 좌표는 버린다", () => {
    const r = parse({ ...REGIONS, accepted_at: ["0.37", "0.12", "0.56", "0.14"] });
    expect(r.ok && r.data.regions?.accepted_at).toBeNull();
  });

  it("상자 하나만 오면 나머지는 null", () => {
    const r = parse({ receipt: REGIONS.receipt });
    expect(r.ok && r.data.regions).toEqual({
      receipt: REGIONS.receipt,
      accepted_at: null,
      total_fee: null,
    });
  });

  it("위치가 통째로 이상해도 판독은 산다 — 금액이 그대로다", () => {
    const r = parse("잘 모르겠음");
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.regions).toBeNull();
    expect(r.ok && r.data.total_fee).toBe(GOOD.total_fee);
  });
});

describe("assignDaySeq", () => {
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/postal/__tests__/extract-parse.test.ts --maxWorkers=2`
Expected: 새 describe 의 8개가 FAIL(`regions` 가 `undefined` — `toBeNull`·`toEqual` 불일치). 기존 테스트는 PASS.

- [ ] **Step 3: 구현한다**

`splice.py` 로 `src/features/postal/extract-parse.ts` 를 두 번 고친다.

old (`t1-schema-old.txt`):
```ts
const extractionSchema = z.object({
```

new (`t1-schema-new.txt`):
```ts
/**
 * 사진 속 위치 `[x0, y0, x1, y1]` — 사진 왼쪽 위가 0, 오른쪽 아래가 1 인 비율.
 * 영수증 출력이 종이를 잘라내고 접수일자·총요금 값에 형광펜을 입히는 데 쓴다.
 *
 * **이상한 상자는 그 상자만 버린다**(범위 밖·뒤집힘·숫자 아님 → null). 형광펜보다
 * 금액·등기번호가 중요해서 판독 전체를 실패시키지 않는다.
 */
const unit = z.number().min(0).max(1);
const boxSchema = z
  .tuple([unit, unit, unit, unit])
  .refine(([x0, y0, x1, y1]) => x0 < x1 && y0 < y1)
  .nullable()
  .catch(null);

const regionsSchema = z
  .object({
    /** 영수증 종이 전체 — 잘라내기 */
    receipt: boxSchema,
    /** 접수일자 **값** — 형광펜 */
    accepted_at: boxSchema,
    /** 총요금 **값** — 형광펜 */
    total_fee: boxSchema,
  })
  .nullable()
  .catch(null);

export type Regions = NonNullable<z.infer<typeof regionsSchema>>;
export type Box = NonNullable<Regions["receipt"]>;

const extractionSchema = z.object({
```

old (`t1-field-old.txt`):
```ts
  items: z.array(itemSchema).default([]),
});
```

new (`t1-field-new.txt`):
```ts
  items: z.array(itemSchema).default([]),
  /** 위치를 묻기 전 판독에는 없다 — null 로 싣는다. */
  regions: regionsSchema,
});
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/features/postal src/app/api/postal --maxWorkers=2`
Expected: 전부 PASS(새 8개 포함). `src/app/api/postal/extract` 테스트도 그대로 PASS — 저장은 `result: parsed.data` 라 `regions` 가 따라 들어간다.

- [ ] **Step 5: 커밋한다**

```bash
git add src/features/postal/extract-parse.ts src/features/postal/__tests__/extract-parse.test.ts
git diff --cached --stat   # 두 파일 모두 지운 줄 0 이어야 한다(재정렬 없음)
git commit -m "$(cat <<'EOF'
feat(postal): 판독 결과에 사진 속 위치(regions)를 받는다

영수증 출력이 종이를 잘라내고 접수일자·총요금 값에 형광펜을 입힐 자리다.
상자 하나가 이상하면(범위 밖·뒤집힘·숫자 아님) 그 상자만 null 로 두고
판독은 살린다 — 형광펜보다 금액·등기번호가 중요하다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 2: 판독 프롬프트가 위치를 묻는다

**Files:**
- Modify (Edit): `src/features/postal/extract-prompt.ts:22-34`
- Test (Edit): `src/features/postal/__tests__/extract-prompt.test.ts`

**Interfaces:**
- Consumes: Task 1 의 `regions` 모양(`receipt`·`accepted_at`·`total_fee`, 0~1 비율)
- Produces: 없음(폴러가 받아 가는 프롬프트 문자열)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

Edit — `src/features/postal/__tests__/extract-prompt.test.ts` 의 마지막 `it("JSON만 답하라고 한다", …)` 블록 뒤에 넣는다.

old:
```ts
  it("JSON만 답하라고 한다", () => {
    expect(p).toMatch(/JSON/);
  });
});
```

new:
```ts
  it("JSON만 답하라고 한다", () => {
    expect(p).toMatch(/JSON/);
  });

  it("영수증 종이·접수일자·총요금의 위치를 묻는다 — 출력이 자르고 형광펜을 입힌다", () => {
    expect(p).toContain('"regions"');
    expect(p).toContain('"receipt"');
    expect(p).toMatch(/"accepted_at": \[/);
    expect(p).toMatch(/"total_fee": \[/);
  });

  it("좌표는 0~1 비율이라고 못박는다 — 픽셀로 오면 스키마가 버린다", () => {
    expect(p).toMatch(/비율/);
    expect(p).toMatch(/픽셀/);
  });

  it("항목명이 아니라 값 자리를 짚게 한다 — 손 형광펜도 값에만 칠해져 있다", () => {
    expect(p).toMatch(/항목명/);
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/postal/__tests__/extract-prompt.test.ts --maxWorkers=2`
Expected: 새 3개 FAIL(`"regions"` 없음 등), 기존 6개 PASS.

- [ ] **Step 3: 구현한다**

Edit — `src/features/postal/extract-prompt.ts`, 두 곳.

old:
```text
  "items": [
    {"tracking_no":"등기번호","fee":요금숫자,"postal_code":"우편번호","recipient_org":"수취인 소속","recipient_name":"수취인 이름"}
  ]
}
```

new:
```text
  "items": [
    {"tracking_no":"등기번호","fee":요금숫자,"postal_code":"우편번호","recipient_org":"수취인 소속","recipient_name":"수취인 이름"}
  ],
  "regions": {
    "receipt": [x0, y0, x1, y1],
    "accepted_at": [x0, y0, x1, y1],
    "total_fee": [x0, y0, x1, y1]
  }
}
```

old:
```text
- 우체국 등기 영수증이 아니면 {"is_receipt": false} 만 답하라.`;
```

new:
```text
- "regions" 는 값이 아니라 **사진 속 위치**다. 사진 왼쪽 위가 0, 오른쪽 아래가 1 인 **비율**로 [왼쪽, 위, 오른쪽, 아래] 네 숫자를 적어라. 픽셀 수를 적지 마라.
  - receipt: 영수증 종이 전체. 종이 밖 배경(책상 등)은 빼라.
  - accepted_at: 접수일자의 **값**만(예: 2026-09-23 15:14). "접수일자 :" 같은 항목명은 넣지 마라.
  - total_fee: 총요금의 **값**만(예: (즉납) 17,400원). 항목명은 넣지 마라.
  - 찾지 못한 상자는 null.
- 우체국 등기 영수증이 아니면 {"is_receipt": false} 만 답하라.`;
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/features/postal/__tests__/extract-prompt.test.ts src/app/api/postal --maxWorkers=2`
Expected: 전부 PASS(폴러 창구 테스트의 `prompt toContain("등기 영수증")` 포함).

- [ ] **Step 5: 커밋한다**

```bash
git add src/features/postal/extract-prompt.ts src/features/postal/__tests__/extract-prompt.test.ts
git commit -m "$(cat <<'EOF'
feat(postal): 판독 프롬프트가 영수증 종이·접수일자·총요금 위치를 묻는다

0~1 비율 [왼쪽, 위, 오른쪽, 아래]. 항목명이 아니라 값 자리만 짚게 한다 —
손으로 칠한 형광펜도 값에만 있다. 프롬프트는 서버가 만들어 내려주므로
회사 PC 폴러는 그대로다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 3: PR-1 올리기

**Files:** 없음(검증·PR). 스펙 revision 2 와 이 계획서는 계획 단계에서 이미 커밋했다.

- [ ] **Step 1: 전체 검증**

```bash
npm run typecheck
npm run lint
npx vitest run src/features/postal src/app/api/postal src/app/dashboard/postal --maxWorkers=2
```
Expected: typecheck 0 errors, lint 0 errors, vitest 전부 PASS(개수를 PR 본문에 적는다).

- [ ] **Step 2: 변경 범위 확인**

Run: `git diff --stat main...HEAD`
Expected: 6파일 — `docs/superpowers/specs/2026-09-28-postal-receipt-print-design.md`, `docs/superpowers/plans/2026-09-28-postal-receipt-print.md`, `src/features/postal/extract-parse.ts`, `src/features/postal/extract-prompt.ts`, 테스트 2개. 다른 파일이 있으면 멈추고 원인을 본다.

- [ ] **Step 3: 푸시·PR**

```bash
git push -u origin feat/postal-receipt-print
gh pr create --title "feat(postal): 판독에 영수증 위치(regions)를 받는다 — 영수증 출력 1/3" --body-file "$SP/pr1-body.md"
```

`$SP/pr1-body.md`:
```markdown
## Summary
- 우편 영수증을 내부 전표용 A4 로 출력하는 기능의 1/3. 판독이 값과 함께 **사진 속 위치**(영수증 종이·접수일자 값·총요금 값)를 0~1 비율로 돌려준다
- 스키마는 이상한 상자(범위 밖·뒤집힘·숫자 아님)만 null — 판독 전체는 산다
- 저장은 기존 `postal_extract_requests.result`(jsonb) 그대로. 마이그레이션·회사 PC 폴러 수정 없음(프롬프트는 서버가 내려준다)
- 설계: `docs/superpowers/specs/2026-09-28-postal-receipt-print-design.md` · 계획: `docs/superpowers/plans/2026-09-28-postal-receipt-print.md`

## Test plan
- [x] regions 스키마 8건(정상·없음·범위 밖·픽셀·뒤집힘·숫자 아님·일부만·통째로 이상) — RED 확인 후 GREEN
- [x] 프롬프트 3건(위치 요청·비율·항목명 제외)
- [x] typecheck / lint / postal 테스트 전체
- [ ] 머지·배포 후 기존 14장 재판독 → 폴러 실제 모델의 좌표를 사진 위에 그려 확인, 재판독한 등기번호·요금을 확정 항목과 대조(계획 Task 4). 좌표가 부정확하면 PR-2 전에 멈춘다

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 4: CI 확인**

Run(약 9분 뒤 한 번): `gh pr checks <PR번호>`
Expected: `lint + typecheck + test + build (Linux)` pass, `Vercel` pass. 실패면 로그를 읽고 원인부터(찍어맞추기 금지).

- [ ] **Step 5: 🛑 머지 승인 요청**

사용자에게 PR 링크와 검증 결과를 보이고 **머지 승인을 받는다.** 승인 뒤:

```bash
gh pr merge <PR번호> --squash --delete-branch
git checkout main && git pull
```

- [ ] **Step 6: 배포 확인**

Run: `gh api "repos/{owner}/{repo}/commits/$(git rev-parse HEAD)/statuses" --jq '.[0] | "\(.context) \(.state)"'`
Expected: `Vercel success`. `pending` 이면 몇 분 뒤 다시 본다.

### Task 4: 🛑 14장 재판독과 좌표 확인 (커밋 없음)

폴러의 **실제 모델**이 낸 좌표가 스파이크처럼 맞는지, 위치를 얹어 판독이 나빠지지 않았는지 본다. 여기서 틀리면 PR-2 로 가지 않는다(스펙 §8).

**Files:** `$SP/backfill-regions.mjs`, `$SP/status-regions.mjs`, `$SP/verify-regions.mjs` (전부 일회성, 커밋 안 함)

- [ ] **Step 1: 폴러가 살아 있는지 본다**

Run: `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Where-Object { \$_.CommandLine -like '*extract-local*' } | Select-Object ProcessId,CreationDate | Format-List"`
Expected: 프로세스 1개. 없으면 멈추고 사용자에게 알린다(폴러는 작업 스케줄러가 상주시킨다).

- [ ] **Step 2: 재판독 요청 스크립트를 쓴다**

`$SP/backfill-regions.mjs`:
```js
// 위치(regions)를 받기 전 판독만 다시 요청한다. 기본은 dry-run, --apply 로 넣는다.
// 대기·진행 중 요청이 있는 영수증은 건너뛴다(그 요청이 새 요청을 막는다 — requestExtraction 과 같은 규칙).
import { createRequire } from "node:module";

const ROOT = "C:/Users/ys1114/ClaudeCode/Build/OPS-Console";
const require = createRequire(`${ROOT}/package.json`);
require("dotenv").config({ path: `${ROOT}/.env.local`, quiet: true });
const { createClient } = require("@supabase/supabase-js");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const APPLY = process.argv.includes("--apply");

const { data: receipts, error: e1 } = await db.from("postal_receipts").select("id");
if (e1) throw e1;
const { data: reqs, error: e2 } = await db
  .from("postal_extract_requests")
  .select("receipt_id, status, result, requested_at")
  .order("requested_at", { ascending: false });
if (e2) throw e2;

const latest = new Map();
for (const r of reqs) if (!latest.has(r.receipt_id)) latest.set(r.receipt_id, r);

const busy = [];
const hasRegions = [];
const targets = [];
for (const { id } of receipts) {
  const q = latest.get(id);
  if (q && (q.status === "pending" || q.status === "running")) busy.push(id);
  else if (q?.result?.regions) hasRegions.push(id);
  else targets.push(id);
}
console.log(
  `영수증 ${receipts.length}장 — 대기·진행 중 ${busy.length} · 이미 위치 있음 ${hasRegions.length} · 요청 ${targets.length}${APPLY ? "" : " (dry-run)"}`,
);
if (APPLY && targets.length > 0) {
  const { error } = await db
    .from("postal_extract_requests")
    .insert(targets.map((receipt_id) => ({ receipt_id, requested_by: "regions-backfill" })));
  if (error) throw error;
  console.log(`넣음 ${targets.length}건`);
}
```

- [ ] **Step 3: dry-run 뒤 넣는다**

```bash
node "$SP/backfill-regions.mjs"
node "$SP/backfill-regions.mjs" --apply
```
Expected: dry-run 이 `영수증 14장 — 대기·진행 중 0 · 이미 위치 있음 0 · 요청 14 (dry-run)` 근처(그사이 올라온 영수증이 있으면 그만큼 다르다). `--apply` 뒤 `넣음 N건`.

- [ ] **Step 4: 끝날 때까지 기다린다**

`$SP/status-regions.mjs`:
```js
// 재판독 진행 — requested_by='regions-backfill' 요청의 상태별 건수. 남은 것이 없으면 exit 0.
import { createRequire } from "node:module";

const ROOT = "C:/Users/ys1114/ClaudeCode/Build/OPS-Console";
const require = createRequire(`${ROOT}/package.json`);
require("dotenv").config({ path: `${ROOT}/.env.local`, quiet: true });
const { createClient } = require("@supabase/supabase-js");

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await db
  .from("postal_extract_requests")
  .select("status")
  .eq("requested_by", "regions-backfill");
if (error) throw error;
const count = {};
for (const r of data) count[r.status] = (count[r.status] ?? 0) + 1;
console.log(new Date().toISOString(), JSON.stringify(count));
process.exit((count.pending ?? 0) + (count.running ?? 0) === 0 ? 0 : 1);
```

Run(`run_in_background: true`): `until node "$SP/status-regions.mjs"; do sleep 30; done`
Expected: 한 장 30초 안팎이라 14장이면 7~10분. 끝나면 마지막 줄이 `{"done":14}`. `failed` 가 있으면 그 `message` 를 DB 에서 읽어 원인을 본다(위치를 얹어 JSON 이 깨졌는지 등).

- [ ] **Step 5: 좌표를 그리고 판독을 대조한다**

`$SP/verify-regions.mjs`:
```js
// 재판독 확인 — ① 영수증마다 최신 판독의 위치를 사진 위에 그려 regions/ov-NN.jpg 로 저장
//              ② 확정된 영수증은 이전 판독·새 판독의 등기번호·요금을 확정 항목과 대조
// 개인정보(수취인·등기번호)는 찍지 않는다 — 건수만.
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = "C:/Users/ys1114/ClaudeCode/Build/OPS-Console";
const require = createRequire(`${ROOT}/package.json`);
require("dotenv").config({ path: `${ROOT}/.env.local`, quiet: true });
const { createClient } = require("@supabase/supabase-js");
const sharp = require("sharp");

const OUT = join(dirname(fileURLToPath(import.meta.url)), "regions");
mkdirSync(OUT, { recursive: true });
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: receipts, error: e1 } = await db
  .from("postal_receipts")
  .select("id, storage_path, confirmed_at, created_at")
  .order("created_at");
if (e1) throw e1;
const { data: reqs, error: e2 } = await db
  .from("postal_extract_requests")
  .select("receipt_id, result, requested_at")
  .eq("status", "done")
  .order("requested_at", { ascending: false });
if (e2) throw e2;

const doneBy = new Map();
for (const r of reqs) doneBy.set(r.receipt_id, [...(doneBy.get(r.receipt_id) ?? []), r]);

const rect = (b, W, H, color) =>
  b
    ? `<rect x="${b[0] * W}" y="${b[1] * H}" width="${(b[2] - b[0]) * W}" height="${(b[3] - b[1]) * H}" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="8"/>`
    : "";

function score(items, want) {
  const got = items ?? [];
  const no = got.filter((i) => want.has(i.tracking_no)).length;
  const fee = got.filter((i) => want.has(i.tracking_no) && want.get(i.tracking_no) === i.fee).length;
  return `${got.length}건 중 등기번호 ${no}·요금 ${fee}`;
}

for (const [n, r] of receipts.entries()) {
  const tag = String(n + 1).padStart(2, "0");
  const [latest, previous] = doneBy.get(r.id) ?? [];
  const g = latest?.result?.regions;
  if (!g) {
    console.log(`#${tag} 위치 없음 — 새 판독이 아직 없다`);
    continue;
  }
  const { data: blob, error } = await db.storage.from("postal-receipts").download(r.storage_path);
  if (error) {
    console.log(`#${tag} 사진 못 받음`);
    continue;
  }
  const buf = Buffer.from(await blob.arrayBuffer());
  const { width: W, height: H } = (await sharp(buf).metadata()).autoOrient;
  const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${rect(g.receipt, W, H, "#00a000")}${rect(g.accepted_at, W, H, "#0050ff")}${rect(g.total_fee, W, H, "#ff0000")}</svg>`;
  // composite 는 resize 뒤 크기에 얹혀서, 원본 크기에서 칠한 뒤 따로 줄인다.
  const marked = await sharp(buf).rotate().composite([{ input: Buffer.from(svg) }]).toBuffer();
  await sharp(marked).resize({ width: 1000 }).jpeg({ quality: 80 }).toFile(join(OUT, `ov-${tag}.jpg`));

  const boxes = `종이 ${g.receipt ? "O" : "X"} · 접수일자 ${g.accepted_at ? "O" : "X"} · 총요금 ${g.total_fee ? "O" : "X"}`;
  let cmp = "";
  if (r.confirmed_at) {
    const { data: items, error: e3 } = await db.from("postal_items").select("tracking_no, fee").eq("receipt_id", r.id);
    if (e3) throw e3;
    const want = new Map(items.map((i) => [i.tracking_no, i.fee]));
    cmp = ` | 확정 ${want.size}건 ↔ 이전 ${previous ? score(previous.result.items, want) : "없음"} → 새 ${score(latest.result.items, want)}`;
  }
  console.log(`#${tag} ${boxes}${cmp}`);
}
```

Run: `PYTHONIOENCODING=utf-8 node "$SP/verify-regions.mjs"`
Expected: 영수증마다 한 줄. 확정 영수증은 `이전 … → 새 …` 대조.

- [ ] **Step 6: 오버레이를 눈으로 본다**

`$SP/regions/ov-01.jpg` … 를 Read 도구로 하나씩 연다. 영수증마다 세 가지를 적는다:
- 파랑(접수일자)이 `접수일자` **값** 글자를 덮는가
- 빨강(총요금)이 `총요금` **값** 글자를 덮는가
- 초록(종이)이 영수증 종이를 다 덮고 배경을 대부분 빼는가

- [ ] **Step 7: 🛑 사용자와 진행 결정**

사용자에게 알린다: 파랑·빨강·초록 각각 몇 장이 맞았는지, 판독 대조(새 판독이 이전보다 나빠진 영수증이 있는지), 오버레이 2~3장. 기준:
- 형광펜 두 상자가 14장 모두 맞고, 새 판독이 이전보다 나빠진 영수증이 없다 → PR-2 로 간다
- 하나라도 빗나가거나 판독이 나빠졌다 → **여기서 멈추고** 그 사진을 보이며 사용자와 방식을 다시 정한다(OCR 엔진·손 표시 — 스펙 §8)

---

## PR-2 — PDF 라우트

시작 전: `git checkout main && git pull && git checkout -b feat/postal-receipt-pdf`

### Task 5: 순서·묶음·배치 규칙

**Files:**
- Create: `src/features/postal/receipt-print/layout.ts`
- Test: `src/features/postal/receipt-print/__tests__/layout.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces (전부 순수, 클라이언트에서도 import 한다):
  - `RECEIPT_PDF_BATCH = 30`, `PER_PAGE = 3`, `PAGE_MM = { height: 297, margin: 10, slotWidth: 59, gap: 6, footer: 8 }`, `SLOT_MAX_HEIGHT_MM`(=269)
  - `type PrintOrderKey = { id: string; acceptedAt: string | null; createdAt: string }`
  - `type SortBasis = { key: string; basis: "accepted" | "uploaded" }`, `sortBasis(k: PrintOrderKey): SortBasis`
  - `sortForPrint<T extends PrintOrderKey>(items: readonly T[]): T[]`
  - `type PrintBatch = { ids: string[]; from: number; to: number }`, `planBatches(items: readonly PrintOrderKey[]): PrintBatch[]`
  - `toPages<T>(slots: readonly T[]): T[][]`
  - `fitToSlot(widthPx: number, heightPx: number): { widthMm: number; heightMm: number }`
  - `printFileName(items: readonly PrintOrderKey[]): string`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/postal/receipt-print/__tests__/layout.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import {
  sortBasis,
  sortForPrint,
  planBatches,
  toPages,
  fitToSlot,
  printFileName,
  RECEIPT_PDF_BATCH,
  PAGE_MM,
  SLOT_MAX_HEIGHT_MM,
} from "../layout";

const k = (id: string, acceptedAt: string | null, createdAt = "2026-09-01T00:00:00Z") => ({
  id,
  acceptedAt,
  createdAt,
});

describe("sortBasis — 정렬 기준", () => {
  it("판독한 접수일시를 쓴다", () => {
    expect(sortBasis(k("a", "2026-09-23 15:14"))).toEqual({
      key: "2026-09-23 15:14",
      basis: "accepted",
    });
  });

  it("초가 붙어 와도 분까지만 본다", () => {
    expect(sortBasis(k("a", "2026-09-23 15:14:59")).key).toBe("2026-09-23 15:14");
  });

  it("날짜만 있으면 그날 0시로 센다", () => {
    expect(sortBasis(k("a", "2026-09-23")).key).toBe("2026-09-23 00:00");
  });

  it("판독 전이면 올린 시각을 한국 시각으로 쓴다 — UTC 로 두면 자정 전후가 하루 앞선다", () => {
    expect(sortBasis(k("a", null, "2026-09-22T15:30:00Z"))).toEqual({
      key: "2026-09-23 00:30",
      basis: "uploaded",
    });
  });

  it("모르는 모양의 접수일시는 올린 시각으로 센다", () => {
    expect(sortBasis(k("a", "9월 23일", "2026-09-22T15:30:00Z"))).toEqual({
      key: "2026-09-23 00:30",
      basis: "uploaded",
    });
  });
});

describe("sortForPrint — 전표에 붙는 순서", () => {
  it("접수일시 오름차순", () => {
    const out = sortForPrint([k("b", "2026-09-23 15:14"), k("a", "2026-09-17 10:00")]);
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("판독 전 영수증은 올린 시각(한국)으로 사이에 낀다", () => {
    const out = sortForPrint([
      k("c", "2026-09-23 01:00"),
      k("b", null, "2026-09-22T15:30:00Z"), // 한국 09-23 00:30
      k("a", "2026-09-23 00:10"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("받은 배열을 바꾸지 않는다", () => {
    const input = [k("b", "2026-09-23 15:14"), k("a", "2026-09-17 10:00")];
    sortForPrint(input);
    expect(input.map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("planBatches — PDF 묶음", () => {
  const minute = (i: number) => {
    const t = 600 + i; // 10:00 부터 1분씩
    return `2026-09-23 ${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) => k(`r${String(i + 1).padStart(3, "0")}`, minute(i)));

  it(`${RECEIPT_PDF_BATCH}장 이하면 하나`, () => {
    expect(planBatches(many(RECEIPT_PDF_BATCH))).toHaveLength(1);
  });

  it(`넘으면 ${RECEIPT_PDF_BATCH}장씩 — 몇 번째 장인지 함께`, () => {
    const B = RECEIPT_PDF_BATCH;
    const out = planBatches(many(B + 15));
    expect(out.map((b) => [b.from, b.to, b.ids.length])).toEqual([
      [1, B, B],
      [B + 1, B + 15, 15],
    ]);
  });

  it("경계는 정렬한 뒤에 긋는다 — 받은 순서가 거꾸로여도 앞 묶음이 이른 것", () => {
    const B = RECEIPT_PDF_BATCH;
    const out = planBatches(many(B + 15).reverse());
    const last = out[1].ids;
    expect(out[0].ids[0]).toBe("r001");
    expect(last[last.length - 1]).toBe(`r${String(B + 15).padStart(3, "0")}`);
  });
});

describe("toPages — 한 페이지 한 줄 3칸", () => {
  it("7장이면 3·3·1", () => {
    expect(toPages([1, 2, 3, 4, 5, 6, 7]).map((p) => p.length)).toEqual([3, 3, 1]);
  });
});

describe("fitToSlot — 칸에 넣을 크기(mm)", () => {
  it("칸 폭에 맞추고 비율을 지킨다", () => {
    const f = fitToSlot(465, 1033);
    expect(f.widthMm).toBe(PAGE_MM.slotWidth);
    expect(f.heightMm).toBeCloseTo((1033 / 465) * PAGE_MM.slotWidth);
  });

  it("페이지보다 긴 영수증은 높이에 맞춰 줄인다", () => {
    const f = fitToSlot(465, 5000);
    expect(f.heightMm).toBe(SLOT_MAX_HEIGHT_MM);
    expect(f.widthMm / f.heightMm).toBeCloseTo(465 / 5000);
  });
});

describe("printFileName", () => {
  it("첫 날과 끝 날을 적는다", () => {
    expect(printFileName([k("a", "2026-09-23 15:14"), k("b", "2026-09-17 10:00")])).toBe(
      "우편영수증_2026-09-17_2026-09-23.pdf",
    );
  });

  it("하루뿐이면 날짜 하나", () => {
    expect(printFileName([k("a", "2026-09-23 15:14"), k("b", "2026-09-23 09:00")])).toBe(
      "우편영수증_2026-09-23.pdf",
    );
  });

  it("판독 전 영수증은 올린 날(한국)로 센다", () => {
    expect(printFileName([k("a", null, "2026-09-22T15:30:00Z")])).toBe("우편영수증_2026-09-23.pdf");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/postal/receipt-print/__tests__/layout.test.ts --maxWorkers=2`
Expected: FAIL — `Failed to resolve import "../layout"`.

- [ ] **Step 3: 구현한다**

`src/features/postal/receipt-print/layout.ts`:
```ts
/**
 * 영수증 출력 — 순서·묶음·배치 규칙.
 *
 * **화면과 PDF 라우트가 같이 쓴다.** 화면은 이 순서로 [1~30장] 버튼을 나누고,
 * 라우트는 받은 묶음을 이 순서로 찍는다. 따로 정렬하면 버튼의 경계와 PDF 가 어긋난다.
 * 순수 함수만 둔다 — 클라이언트 컴포넌트가 import 한다.
 */

/**
 * PDF 하나에 넣는 최대 장수 — 화면의 묶음과 서버의 상한이 같이 쓴다.
 * 30 은 시작값이다. 30장 처리 시간을 재서 여유가 있으면 키운다(스펙 §5.4).
 */
export const RECEIPT_PDF_BATCH = 30;

/** A4 세로 한 줄 3칸. 긴 영수증이 있어 두 줄로 쌓지 않는다. */
export const PER_PAGE = 3;

/** mm — 칸 59 × 3 + 간격 6 × 2 = 189 가 A4 폭 210 − 여백 10 × 2 = 190 안에 든다. */
export const PAGE_MM = {
  height: 297,
  margin: 10,
  slotWidth: 59,
  gap: 6,
  /** 쪽번호 자리 */
  footer: 8,
} as const;

/** 영수증 한 장이 쓸 수 있는 높이(mm). */
export const SLOT_MAX_HEIGHT_MM = PAGE_MM.height - PAGE_MM.margin * 2 - PAGE_MM.footer;

export type PrintOrderKey = {
  id: string;
  /** 판독한 접수일시 — 판독기가 읽은 그대로('YYYY-MM-DD HH:mm', 한국 시각). 판독 전이면 null. */
  acceptedAt: string | null;
  /** 올린 시각 — DB timestamptz(ISO) */
  createdAt: string;
};

export type SortBasis = { key: string; basis: "accepted" | "uploaded" };

const ACCEPTED_SHAPE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/;

/**
 * 한국은 서머타임이 없어 UTC + 9시간이 곧 한국 시각이다. 표시가 아니라 정렬 키라
 * `kstFormat` 대신 고정 오프셋을 쓴다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 정렬 기준 'YYYY-MM-DD HH:mm'(한국 시각).
 *
 * 판독한 접수일시가 있으면 그것 — **Date 로 파싱하지 않는다**(`formatAcceptedAt` 과
 * 같은 이유: 시간대 없는 문자열이 실행 환경 시간대로 읽힌다). 없거나 모르는 모양이면
 * 올린 시각을 한국 시각으로 바꿔 쓴다.
 */
export function sortBasis(k: PrintOrderKey): SortBasis {
  const m = k.acceptedAt ? ACCEPTED_SHAPE.exec(k.acceptedAt.trim()) : null;
  if (m) {
    const [, y, mo, d, h = "00", mi = "00"] = m;
    return { key: `${y}-${mo}-${d} ${h}:${mi}`, basis: "accepted" };
  }
  const kst = new Date(Date.parse(k.createdAt) + KST_OFFSET_MS).toISOString();
  return { key: `${kst.slice(0, 10)} ${kst.slice(11, 16)}`, basis: "uploaded" };
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** 전표에 붙는 순서 — 접수일시 오름차순. 같으면 올린 순, 그다음 id(늘 같은 순서). */
export function sortForPrint<T extends PrintOrderKey>(items: readonly T[]): T[] {
  return [...items].sort(
    (a, b) =>
      cmp(sortBasis(a).key, sortBasis(b).key) ||
      cmp(a.createdAt, b.createdAt) ||
      cmp(a.id, b.id),
  );
}

export type PrintBatch = {
  ids: string[];
  /** 1부터 센 장 번호 — 버튼 이름 '1~30장' */
  from: number;
  to: number;
};

/** 화면이 만드는 PDF 묶음 — 정렬한 뒤 RECEIPT_PDF_BATCH 장씩. */
export function planBatches(items: readonly PrintOrderKey[]): PrintBatch[] {
  const sorted = sortForPrint(items);
  const count = Math.ceil(sorted.length / RECEIPT_PDF_BATCH);
  return Array.from({ length: count }, (_, i) => {
    const start = i * RECEIPT_PDF_BATCH;
    const part = sorted.slice(start, start + RECEIPT_PDF_BATCH);
    return { ids: part.map((p) => p.id), from: start + 1, to: start + part.length };
  });
}

/** 한 페이지 = 한 줄 PER_PAGE 칸. */
export function toPages<T>(slots: readonly T[]): T[][] {
  const count = Math.ceil(slots.length / PER_PAGE);
  return Array.from({ length: count }, (_, i) => slots.slice(i * PER_PAGE, (i + 1) * PER_PAGE));
}

/** 칸에 넣을 크기(mm) — 칸 폭에 맞추고, 쓸 수 있는 높이를 넘는 긴 영수증은 높이에 맞춰 줄인다. */
export function fitToSlot(widthPx: number, heightPx: number): { widthMm: number; heightMm: number } {
  const heightAtSlotWidth = (heightPx / widthPx) * PAGE_MM.slotWidth;
  if (heightAtSlotWidth <= SLOT_MAX_HEIGHT_MM) {
    return { widthMm: PAGE_MM.slotWidth, heightMm: heightAtSlotWidth };
  }
  return {
    widthMm: PAGE_MM.slotWidth * (SLOT_MAX_HEIGHT_MM / heightAtSlotWidth),
    heightMm: SLOT_MAX_HEIGHT_MM,
  };
}

/** 우편영수증_{첫 날}_{끝 날}.pdf — 하루뿐이면 날짜 하나. 판독 전 영수증은 올린 날로 센다. */
export function printFileName(items: readonly PrintOrderKey[]): string {
  const days = items.map((k) => sortBasis(k).key.slice(0, 10)).sort();
  const first = days[0];
  const last = days[days.length - 1];
  return first === last ? `우편영수증_${first}.pdf` : `우편영수증_${first}_${last}.pdf`;
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/features/postal/receipt-print/__tests__/layout.test.ts --maxWorkers=2`
Expected: 17 PASS.

- [ ] **Step 5: 커밋한다**

```bash
git add src/features/postal/receipt-print/layout.ts src/features/postal/receipt-print/__tests__/layout.test.ts
git commit -m "$(cat <<'EOF'
feat(postal): 영수증 출력의 순서·묶음·배치 규칙

접수일시 오름차순(판독 전은 올린 시각을 한국 시각으로), 30장씩 묶음,
한 페이지 3칸, 긴 영수증은 높이에 맞춰 축소, 파일명. 화면과 PDF 라우트가
같이 쓴다 — 따로 정렬하면 버튼의 경계와 PDF 가 어긋난다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 6: 출력 주소 규약

**Files:**
- Create: `src/features/postal/receipt-print/print-ids.ts`
- Test: `src/features/postal/receipt-print/__tests__/print-ids.test.ts`

**Interfaces:**
- Consumes: `RECEIPT_PDF_BATCH` (Task 5)
- Produces: `RECEIPT_PDF_PATH = "/api/postal/receipts/pdf"`, `receiptPdfHref(ids: readonly string[]): string`, `type ParsedIds = { ok: true; ids: string[] } | { ok: false; error: string }`, `parsePrintIds(raw: string | null): ParsedIds`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/postal/receipt-print/__tests__/print-ids.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parsePrintIds, receiptPdfHref, RECEIPT_PDF_PATH } from "../print-ids";
import { RECEIPT_PDF_BATCH } from "../layout";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ids = (count: number) => Array.from({ length: count }, (_, i) => id(i + 1));

describe("parsePrintIds", () => {
  it("쉼표로 이은 id 를 받는다", () => {
    expect(parsePrintIds(`${id(1)},${id(2)}`)).toEqual({ ok: true, ids: [id(1), id(2)] });
  });

  it("고른 것이 없으면 거절한다", () => {
    for (const raw of [null, "", " , ,"]) {
      expect(parsePrintIds(raw)).toEqual({ ok: false, error: "출력할 영수증을 고르세요" });
    }
  });

  it(`${RECEIPT_PDF_BATCH}장을 넘으면 거절한다 — PDF 하나의 상한`, () => {
    expect(parsePrintIds(ids(RECEIPT_PDF_BATCH + 1).join(","))).toEqual({
      ok: false,
      error: `한 번에 ${RECEIPT_PDF_BATCH}장까지 출력합니다`,
    });
  });

  it(`딱 ${RECEIPT_PDF_BATCH}장은 받는다`, () => {
    expect(parsePrintIds(ids(RECEIPT_PDF_BATCH).join(",")).ok).toBe(true);
  });

  it("중복은 한 번만 센다 — 상한도 중복을 뺀 뒤에 본다", () => {
    const r = parsePrintIds([...ids(RECEIPT_PDF_BATCH), id(1), id(2)].join(","));
    expect(r.ok && r.ids).toHaveLength(RECEIPT_PDF_BATCH);
  });

  it("id 형식이 틀리면 거절한다", () => {
    expect(parsePrintIds(`${id(1)},abc`)).toEqual({
      ok: false,
      error: "영수증 id 형식이 올바르지 않습니다",
    });
  });
});

describe("receiptPdfHref", () => {
  it("라우트가 그대로 읽는 주소를 만든다 — 순서도 그대로", () => {
    const href = receiptPdfHref([id(2), id(1)]);
    expect(href.startsWith(`${RECEIPT_PDF_PATH}?ids=`)).toBe(true);
    const back = new URL(href, "http://x").searchParams.get("ids");
    expect(parsePrintIds(back)).toEqual({ ok: true, ids: [id(2), id(1)] });
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/postal/receipt-print/__tests__/print-ids.test.ts --maxWorkers=2`
Expected: FAIL — `Failed to resolve import "../print-ids"`.

- [ ] **Step 3: 구현한다**

`src/features/postal/receipt-print/print-ids.ts`:
```ts
import { z } from "zod";
import { RECEIPT_PDF_BATCH } from "./layout";

/**
 * 영수증 출력 주소 — 화면이 만들고 라우트가 읽는다.
 *
 * 둘을 한 파일에 둔다. 한쪽만 바뀌면 버튼은 멀쩡해 보이는데 눌러도 400 이 난다.
 */
export const RECEIPT_PDF_PATH = "/api/postal/receipts/pdf";

export function receiptPdfHref(ids: readonly string[]): string {
  return `${RECEIPT_PDF_PATH}?ids=${ids.join(",")}`;
}

export type ParsedIds = { ok: true; ids: string[] } | { ok: false; error: string };

const uuid = z.uuid();

/** `ids=<uuid>,<uuid>,…` — 중복을 뺀 뒤 1~RECEIPT_PDF_BATCH 개. */
export function parsePrintIds(raw: string | null): ParsedIds {
  const ids = [
    ...new Set(
      (raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (ids.length === 0) return { ok: false, error: "출력할 영수증을 고르세요" };
  if (ids.length > RECEIPT_PDF_BATCH) {
    return { ok: false, error: `한 번에 ${RECEIPT_PDF_BATCH}장까지 출력합니다` };
  }
  if (!ids.every((id) => uuid.safeParse(id).success)) {
    return { ok: false, error: "영수증 id 형식이 올바르지 않습니다" };
  }
  return { ok: true, ids };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/features/postal/receipt-print/__tests__/print-ids.test.ts --maxWorkers=2`
Expected: 7 PASS.

- [ ] **Step 5: 커밋한다**

```bash
git add src/features/postal/receipt-print/print-ids.ts src/features/postal/receipt-print/__tests__/print-ids.test.ts
git commit -m "$(cat <<'EOF'
feat(postal): 영수증 출력 주소 규약 — 화면이 만들고 라우트가 읽는다

ids 를 쉼표로 잇고, 서버는 중복을 뺀 뒤 1~30개 uuid 만 받는다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 7: 잘라내기·형광펜 좌표

**Files:**
- Create: `src/features/postal/receipt-print/geometry.ts`
- Test: `src/features/postal/receipt-print/__tests__/geometry.test.ts`

**Interfaces:**
- Consumes: `type Box` from `../extract-parse` (Task 1)
- Produces: `type Rect = { left: number; top: number; width: number; height: number }`, `type Mark = Rect & { radius: number }`, `CROP_MARGIN = 0.02`, `MARK_PAD = 0.25`, `cropRect(box: Box | null, imgW: number, imgH: number): Rect`, `markRect(box: Box, crop: Rect, imgW: number, imgH: number, scale: number): Mark | null`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/features/postal/receipt-print/__tests__/geometry.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { cropRect, markRect } from "../geometry";
import type { Box } from "../../extract-parse";

const W = 1000;
const H = 2000;
const FULL = { left: 0, top: 0, width: W, height: H };

describe("cropRect — 잘라낼 영역", () => {
  it("상자가 없으면 사진 전체 — 자르지 않고 칸에 맞춘다", () => {
    expect(cropRect(null, W, H)).toEqual(FULL);
  });

  it("종이 상자에 사방 2%(사진 폭·높이 기준) 여유를 둔다", () => {
    expect(cropRect([0.2, 0.1, 0.8, 0.9], W, H)).toEqual({
      left: 180,
      top: 160,
      width: 640,
      height: 1680,
    });
  });

  it("사진 밖으로 나가는 여유는 경계에서 자른다", () => {
    expect(cropRect([0, 0, 1, 1], W, H)).toEqual(FULL);
    expect(cropRect([0.1, 0, 0.9, 1], W, H)).toEqual({ left: 80, top: 0, width: 840, height: 2000 });
  });
});

describe("markRect — 형광펜 자리", () => {
  // 300~500 × 200~240px, 높이 40 → 여유 10
  const box: Box = [0.3, 0.1, 0.5, 0.12];

  it("상자 높이의 25% 여유를 두고 줄인 배율을 곱한다", () => {
    const m = markRect(box, FULL, W, H, 0.5);
    expect(m?.left).toBeCloseTo(145);
    expect(m?.top).toBeCloseTo(95);
    expect(m?.width).toBeCloseTo(110);
    expect(m?.height).toBeCloseTo(30);
    expect(m?.radius).toBeCloseTo(5);
  });

  it("잘라낸 영역 기준으로 옮긴다", () => {
    const m = markRect(box, { left: 100, top: 150, width: 800, height: 1800 }, W, H, 1);
    expect(m?.left).toBeCloseTo(190);
    expect(m?.top).toBeCloseTo(40);
    expect(m?.width).toBeCloseTo(220);
    expect(m?.height).toBeCloseTo(60);
  });

  it("잘라낸 영역 밖으로 나간 부분은 버린다", () => {
    const m = markRect(box, { left: 350, top: 0, width: 650, height: 2000 }, W, H, 1);
    expect(m?.left).toBeCloseTo(0);
    expect(m?.width).toBeCloseTo(160);
  });

  it("통째로 밖이면 칠하지 않는다 — 오류로 멈추지 않는다", () => {
    const outside = { left: 500, top: 0, width: 500, height: 2000 };
    expect(markRect([0.1, 0.1, 0.2, 0.12], outside, W, H, 1)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/features/postal/receipt-print/__tests__/geometry.test.ts --maxWorkers=2`
Expected: FAIL — `Failed to resolve import "../geometry"`.

- [ ] **Step 3: 구현한다**

`src/features/postal/receipt-print/geometry.ts`:
```ts
import type { Box } from "../extract-parse";

/**
 * 영수증 출력의 좌표 변환 — 판독이 준 비율 상자(0~1)를 픽셀로 옮긴다. 순수 함수.
 *
 * 상자는 **바로 세운 사진**(EXIF 방향 반영) 기준이다. 모델도 사람도 사진을 그렇게 본다.
 */

/** px 사각형 */
export type Rect = { left: number; top: number; width: number; height: number };
/** 형광펜 한 칸 — 모서리 둥글기 포함 */
export type Mark = Rect & { radius: number };

/** 잘라낼 때 사방 여유 — 사진 폭·높이의 2%. 종이 끝에 딱 맞춰 자르면 가장자리 글자가 잘린다. */
export const CROP_MARGIN = 0.02;
/** 형광펜 여유 — 상자 높이의 25%. 손 형광펜처럼 글자보다 조금 넓게(스파이크 2026-09-28). */
export const MARK_PAD = 0.25;

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi);

/**
 * 잘라낼 영역(px). 종이 상자 + 사방 여유, 사진 밖으로 나가는 부분은 경계에서 자른다.
 * 상자가 없으면 사진 전체.
 */
export function cropRect(box: Box | null, imgW: number, imgH: number): Rect {
  if (!box) return { left: 0, top: 0, width: imgW, height: imgH };
  const [x0, y0, x1, y1] = box;
  // round — floor/ceil 이면 0.8 + 0.02 같은 부동소수 오차(820.0000000000001)에 1px 씩 튄다.
  const left = clamp(Math.round((x0 - CROP_MARGIN) * imgW), 0, imgW);
  const top = clamp(Math.round((y0 - CROP_MARGIN) * imgH), 0, imgH);
  const right = clamp(Math.round((x1 + CROP_MARGIN) * imgW), 0, imgW);
  const bottom = clamp(Math.round((y1 + CROP_MARGIN) * imgH), 0, imgH);
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * 형광펜 자리(출력 px). 원본 비율 상자 → 잘라낸 영역 기준 → 줄인 배율(scale).
 *
 * 잘라낸 영역 밖으로 나간 부분은 버리고, 통째로 밖이면 null(칠하지 않는다) —
 * 모델이 종이 상자와 값 상자를 따로 짚어 서로 어긋날 수 있다.
 */
export function markRect(
  box: Box,
  crop: Rect,
  imgW: number,
  imgH: number,
  scale: number,
): Mark | null {
  const [x0, y0, x1, y1] = box;
  const pad = (y1 - y0) * imgH * MARK_PAD;
  const left = Math.max(x0 * imgW - pad, crop.left);
  const top = Math.max(y0 * imgH - pad, crop.top);
  const right = Math.min(x1 * imgW + pad, crop.left + crop.width);
  const bottom = Math.min(y1 * imgH + pad, crop.top + crop.height);
  if (right <= left || bottom <= top) return null;
  return {
    left: (left - crop.left) * scale,
    top: (top - crop.top) * scale,
    width: (right - left) * scale,
    height: (bottom - top) * scale,
    radius: pad * scale,
  };
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/features/postal/receipt-print/__tests__/geometry.test.ts --maxWorkers=2`
Expected: 7 PASS.

- [ ] **Step 5: 커밋한다**

```bash
git add src/features/postal/receipt-print/geometry.ts src/features/postal/receipt-print/__tests__/geometry.test.ts
git commit -m "$(cat <<'EOF'
feat(postal): 영수증 잘라내기·형광펜 좌표 변환

종이 상자 + 사방 2% 여유로 자르고(사진 경계에서 멈춤), 형광펜은 상자 높이
25% 여유로 잘라낸 영역 기준 좌표에 옮긴다. 종이 밖으로 나간 형광펜은
그만큼 버리고, 통째로 밖이면 칠하지 않는다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 8: 사진 처리 + sharp 를 운영 의존성으로

**Files:**
- Modify: `package.json`, `package-lock.json` — `sharp` 를 devDependencies → dependencies
- Create: `src/features/postal/receipt-print/render-image.ts`
- Test: `src/features/postal/receipt-print/__tests__/render-image.test.ts`

**Interfaces:**
- Consumes: `cropRect`, `markRect`, `type Mark` (Task 7), `type Regions` (Task 1)
- Produces: `SLOT_PX_WIDTH = 465`, `type RenderedImage = { jpeg: Buffer; widthPx: number; heightPx: number }`, `renderReceiptImage(input: Buffer, regions: Regions | null): Promise<RenderedImage>` — 읽을 수 없는 사진이면 **던진다**

- [ ] **Step 1: sharp 를 운영 의존성으로 옮긴다**

지금은 devDependency 다(스크립트 `scripts/team-briefing/upload-assets.mjs` 만 쓴다). 라우트가 운영 런타임에서 쓰므로 옮긴다. Next 는 `sharp` 를 기본 server-external 목록에 두어 번들하지 않고 `node_modules` 에서 부른다.

```bash
npm install --save-prod sharp@^0.35.3
git diff package.json
grep -c '"node_modules/@img/sharp-linux-x64"' package-lock.json
```
Expected: `package.json` 은 `"sharp": "^0.35.3"` 한 줄이 devDependencies 에서 dependencies 로 옮겨 간 것뿐. lock 은 sharp 와 그 하위 항목의 `"dev": true` 가 빠진 것뿐이고, 리눅스 바이너리 항목이 그대로 1(Vercel 이 리눅스라 이게 있어야 설치된다). 다른 패키지 버전이 바뀌었으면 멈추고 원인을 본다.

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`src/features/postal/receipt-print/__tests__/render-image.test.ts`:
```ts
// @vitest-environment node
//
// sharp 는 node 의 Buffer 를 받는다 — 기본 jsdom 환경에서 돌리지 않는다.
import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { renderReceiptImage, SLOT_PX_WIDTH } from "../render-image";
import type { Regions } from "../../extract-parse";

const blank = (w: number, h: number) =>
  sharp({ create: { width: w, height: h, channels: 3, background: "#ffffff" } })
    .jpeg()
    .toBuffer();

async function pixel(jpeg: Buffer, x: number, y: number) {
  const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
  const i = (Math.round(y) * info.width + Math.round(x)) * info.channels;
  return { r: data[i], g: data[i + 1], b: data[i + 2] };
}

const none: Regions = { receipt: null, accepted_at: null, total_fee: null };

describe("renderReceiptImage", () => {
  it("종이만 잘라 칸 폭(59mm·200dpi)으로 줄인다", async () => {
    const out = await renderReceiptImage(await blank(1000, 2000), {
      ...none,
      receipt: [0.1, 0, 0.9, 1],
    });
    // 잘라낸 영역 840×2000 → 465×1107
    expect([out.widthPx, out.heightPx]).toEqual([SLOT_PX_WIDTH, 1107]);
  });

  it("작은 사진은 키우지 않는다", async () => {
    const out = await renderReceiptImage(await blank(300, 600), null);
    expect([out.widthPx, out.heightPx]).toEqual([300, 600]);
  });

  it("형광펜 자리는 노랗고 그 밖은 희다 — 곱하기라 흰 바탕엔 노랑 그대로", async () => {
    const out = await renderReceiptImage(await blank(1000, 2000), {
      ...none,
      accepted_at: [0.3, 0.1, 0.6, 0.12],
    });
    // 배율 465/1000 — 상자 한가운데 (450, 220)px → (209, 102)
    const inside = await pixel(out.jpeg, 209, 102);
    expect(inside.r).toBeGreaterThan(230);
    expect(inside.b).toBeLessThan(160);
    expect((await pixel(out.jpeg, 20, 20)).b).toBeGreaterThan(240);
  });

  it("위치가 없으면 칠하지 않는다", async () => {
    const out = await renderReceiptImage(await blank(1000, 2000), null);
    expect((await pixel(out.jpeg, 209, 102)).b).toBeGreaterThan(240);
  });

  it("EXIF 방향을 바로 세운다 — 좌표는 바로 세운 사진 기준이다", async () => {
    const turned = await sharp({
      create: { width: 200, height: 100, channels: 3, background: "#ffffff" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();
    const out = await renderReceiptImage(turned, null);
    expect([out.widthPx, out.heightPx]).toEqual([100, 200]);
  });

  it("읽을 수 없는 사진은 던진다 — 사유는 부르는 쪽이 칸에 적는다", async () => {
    await expect(renderReceiptImage(Buffer.from("not an image"), null)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: 실패를 확인한다**

Run: `npx vitest run src/features/postal/receipt-print/__tests__/render-image.test.ts --maxWorkers=2`
Expected: FAIL — `Failed to resolve import "../render-image"`.

- [ ] **Step 4: 구현한다**

`src/features/postal/receipt-print/render-image.ts`:
```ts
import "server-only";
import sharp from "sharp";
import type { Regions } from "../extract-parse";
import { cropRect, markRect, type Mark } from "./geometry";

/**
 * 칸 59mm 를 200dpi 로 — 465px. 스파이크(2026-09-28)는 150dpi 에서도 영수증 잔글씨가
 * 읽혔다. 이보다 작은 사진은 키우지 않는다.
 */
export const SLOT_PX_WIDTH = Math.round((59 / 25.4) * 200);

/** 형광펜 노랑. 곱하기 합성이라 글자는 검게 그대로 비친다. */
const HIGHLIGHTER = "#fff176";

export type RenderedImage = { jpeg: Buffer; widthPx: number; heightPx: number };

/**
 * 영수증 사진 → 칸에 넣을 JPEG.
 * 방향 바로잡기 → 종이만 잘라내기 → 인쇄 해상도로 줄이기 → 형광펜.
 *
 * 없는 상자만큼만 빠진다(종이 상자가 없으면 사진 전체, 형광펜 상자가 없으면 그 자리만
 * 안 칠함). 읽을 수 없는 사진(HEIC·손상)은 던진다 — 사유는 부르는 쪽이 칸에 적는다.
 */
export async function renderReceiptImage(
  input: Buffer,
  regions: Regions | null,
): Promise<RenderedImage> {
  // autoOrient = EXIF 방향을 반영한 크기. 좌표가 바로 세운 사진 기준이라 이걸 쓴다.
  const { width: imgW, height: imgH } = (await sharp(input).metadata()).autoOrient;
  const crop = cropRect(regions?.receipt ?? null, imgW, imgH);

  // raw 로 받아 실제 출력 크기를 안다 — 형광펜 층이 그 크기와 정확히 같아야 얹힌다.
  const { data, info } = await sharp(input)
    .rotate()
    .extract(crop)
    .resize({ width: Math.min(crop.width, SLOT_PX_WIDTH) })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const scale = info.width / crop.width;

  const marks = [regions?.accepted_at, regions?.total_fee]
    .flatMap((box) => (box ? [markRect(box, crop, imgW, imgH, scale)] : []))
    .filter((m): m is Mark => m !== null);

  const base = sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  });
  const painted =
    marks.length === 0
      ? base
      : base.composite([
          { input: await markLayer(info.width, info.height, marks), blend: "multiply" },
        ]);
  const jpeg = await painted.jpeg({ quality: 85 }).toBuffer();
  return { jpeg, widthPx: info.width, heightPx: info.height };
}

/** 흰 바탕에 노랑 사각형 — 곱하기로 얹으면 흰 곳은 그대로, 노랑 곳만 칠해진다. */
async function markLayer(width: number, height: number, marks: Mark[]): Promise<Buffer> {
  const rects = marks
    .map(
      (m) =>
        `<rect x="${m.left}" y="${m.top}" width="${m.width}" height="${m.height}" rx="${m.radius}" fill="${HIGHLIGHTER}"/>`,
    )
    .join("");
  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg"><rect width="${width}" height="${height}" fill="#ffffff"/>${rects}</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/features/postal/receipt-print/__tests__/render-image.test.ts --maxWorkers=2`
Expected: 6 PASS.

- [ ] **Step 6: 역검증 — EXIF 테스트가 실제로 잡는지**

`render-image.ts` 의 `.autoOrient` 를 잠시 `(await sharp(input).metadata())` 의 `width`/`height`(방향 반영 전)로 바꿔 돌린다 → `EXIF 방향` 테스트가 FAIL(`bad extract area`)이어야 한다. 확인 뒤 원래대로 돌리고 다시 6 PASS. `git diff` 로 되돌린 것을 확인한다.

- [ ] **Step 7: 커밋한다**

```bash
git add package.json package-lock.json src/features/postal/receipt-print/render-image.ts src/features/postal/receipt-print/__tests__/render-image.test.ts
git commit -m "$(cat <<'EOF'
feat(postal): 영수증 사진을 잘라 형광펜을 입힌다 — sharp 를 운영 의존성으로

EXIF 방향을 바로잡고, 종이만 잘라 칸 폭(59mm·200dpi)으로 줄인 뒤 접수일자·
총요금 자리에 노랑을 곱하기로 얹는다. 읽을 수 없는 사진은 던져 부르는 쪽이
그 칸에 사유를 적게 한다. 운영 런타임이 처음 sharp 를 쓰므로 dependencies 로 옮긴다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 9: 출력 재료 읽기

**Files:**
- Modify (splice): `src/features/postal/extract-parse.ts` — `readRegions` 추가
- Test (splice): `src/features/postal/__tests__/extract-parse.test.ts`
- Create: `src/features/postal/receipt-print/sources.ts`
- Test: `src/features/postal/receipt-print/__tests__/sources.test.ts`

**Interfaces:**
- Consumes: `regionsSchema`, `type Regions` (Task 1), `RECEIPT_BUCKET` from `../upload-guard`, `createAdminClient` from `@/lib/supabase/admin`
- Produces:
  - `readRegions(result: unknown): Regions | null` (extract-parse)
  - `type PrintSource = { id: string; storagePath: string; createdAt: string; acceptedAt: string | null; regions: Regions | null }`
  - `loadPrintSources(ids: string[]): Promise<PrintSource[]>` — 없는 id 는 빠진다, 조회 오류는 던진다
  - `downloadReceipt(storagePath: string): Promise<Buffer | null>`

- [ ] **Step 1: `readRegions` 실패 테스트**

splice — `src/features/postal/__tests__/extract-parse.test.ts`.

old (`t9-import-old.txt`):
```ts
import { parseExtraction, assignDaySeq } from "../extract-parse";
```

new (`t9-import-new.txt`):
```ts
import { parseExtraction, assignDaySeq, readRegions } from "../extract-parse";
```

old (`t9-test-old.txt`):
```ts
describe("assignDaySeq", () => {
```

new (`t9-test-new.txt`):
```ts
/** 저장된 판독(jsonb)에서 위치를 꺼낸다 — 영수증 출력과 목록이 쓴다. */
describe("readRegions", () => {
  const REGIONS = {
    receipt: [0.18, 0, 0.78, 1],
    accepted_at: [0.37, 0.12, 0.56, 0.14],
    total_fee: [0.53, 0.59, 0.72, 0.61],
  };

  it("저장된 위치를 돌려준다", () => {
    expect(readRegions({ items: [], regions: REGIONS })).toEqual(REGIONS);
  });

  it("위치를 묻기 전 판독·판독 전은 null", () => {
    expect(readRegions({ items: [] })).toBeNull();
    expect(readRegions(null)).toBeNull();
  });

  it("저장된 값도 다시 거른다 — 이상한 상자는 그 상자만 null", () => {
    const r = readRegions({ regions: { ...REGIONS, receipt: [0.9, 0, 0.1, 1] } });
    expect(r?.receipt).toBeNull();
    expect(r?.total_fee).toEqual(REGIONS.total_fee);
  });
});

describe("assignDaySeq", () => {
```

Run: `npx vitest run src/features/postal/__tests__/extract-parse.test.ts --maxWorkers=2`
Expected: FAIL — `readRegions is not a function`(export 없음).

- [ ] **Step 2: `readRegions` 구현**

splice — `src/features/postal/extract-parse.ts`.

old (`t9-read-old.txt`):
```ts
export type Box = NonNullable<Regions["receipt"]>;
```

new (`t9-read-new.txt`):
```ts
export type Box = NonNullable<Regions["receipt"]>;

/**
 * 저장된 판독 결과(jsonb)에서 위치를 꺼낸다 — 저장할 때와 **같은 스키마로 다시 거른다**.
 * 위치를 묻기 전 판독·판독 전·실패는 null.
 */
export function readRegions(result: unknown): Regions | null {
  if (!result || typeof result !== "object" || !("regions" in result)) return null;
  return regionsSchema.parse(result.regions);
}
```

Run: `npx vitest run src/features/postal/__tests__/extract-parse.test.ts --maxWorkers=2`
Expected: 전부 PASS.

- [ ] **Step 3: `sources` 실패 테스트**

`src/features/postal/receipt-print/__tests__/sources.test.ts`:
```ts
// @vitest-environment node
//
// 저장소 다운로드가 Blob 을 돌려준다 — node 의 Blob 으로 돌린다.
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = {
  receipts: [] as Record<string, unknown>[],
  requests: [] as Record<string, unknown>[],
  receiptsError: null as { message: string } | null,
  files: {} as Record<string, Buffer>,
};

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const result =
        table === "postal_receipts"
          ? { data: state.receipts, error: state.receiptsError }
          : { data: state.requests, error: null };
      const chain: Record<string, unknown> = {};
      Object.assign(chain, {
        select: () => chain,
        in: () => chain,
        order: () => chain,
        then: (resolve: (v: unknown) => unknown) => resolve(result),
      });
      return chain;
    },
    storage: {
      from: () => ({
        download: (path: string) =>
          Promise.resolve(
            path in state.files
              ? { data: new Blob([state.files[path]]), error: null }
              : { data: null, error: { message: "Object not found" } },
          ),
      }),
    },
  }),
}));

const { loadPrintSources, downloadReceipt } = await import("../sources");

const REGIONS = {
  receipt: [0.18, 0, 0.78, 1],
  accepted_at: [0.37, 0.12, 0.56, 0.14],
  total_fee: [0.53, 0.59, 0.72, 0.61],
};

describe("loadPrintSources", () => {
  beforeEach(() => {
    state.receipts = [
      { id: "r1", storage_path: "2026-09-23/a.jpg", created_at: "2026-09-23T01:00:00+00:00" },
    ];
    state.requests = [];
    state.receiptsError = null;
  });

  it("최신 판독의 접수일시와 위치를 싣는다 — 목록과 같은 규칙", async () => {
    state.requests = [
      {
        receipt_id: "r1",
        result: { accepted_at: "2026-09-23 15:14", regions: REGIONS },
        requested_at: "2026-09-28T07:00:00Z",
      },
      {
        receipt_id: "r1",
        result: { accepted_at: "2026-09-22 09:00" },
        requested_at: "2026-09-23T02:00:00Z",
      },
    ];
    expect(await loadPrintSources(["r1"])).toEqual([
      {
        id: "r1",
        storagePath: "2026-09-23/a.jpg",
        createdAt: "2026-09-23T01:00:00+00:00",
        acceptedAt: "2026-09-23 15:14",
        regions: REGIONS,
      },
    ]);
  });

  it("판독이 없으면 접수일시·위치가 없다", async () => {
    const [s] = await loadPrintSources(["r1"]);
    expect([s.acceptedAt, s.regions]).toEqual([null, null]);
  });

  it("재판독 대기 중이면 위치가 없다 — 목록처럼 최신 요청만 본다", async () => {
    state.requests = [
      { receipt_id: "r1", result: null, requested_at: "2026-09-28T08:00:00Z" },
      {
        receipt_id: "r1",
        result: { accepted_at: "2026-09-23 15:14", regions: REGIONS },
        requested_at: "2026-09-28T07:00:00Z",
      },
    ];
    const [s] = await loadPrintSources(["r1"]);
    expect([s.acceptedAt, s.regions]).toEqual([null, null]);
  });

  it("영수증 조회가 실패하면 던진다 — 조용한 0건은 '없는 영수증'으로 둔갑한다", async () => {
    state.receiptsError = { message: "boom" };
    await expect(loadPrintSources(["r1"])).rejects.toThrow(/영수증을 읽지 못했습니다/);
  });
});

describe("downloadReceipt", () => {
  it("사진을 받는다", async () => {
    state.files = { "a.jpg": Buffer.from("jpeg-bytes") };
    expect((await downloadReceipt("a.jpg"))?.toString()).toBe("jpeg-bytes");
  });

  it("못 받으면 null — 그 칸에 사유를 적는다", async () => {
    state.files = {};
    expect(await downloadReceipt("없는.jpg")).toBeNull();
  });
});
```

Run: `npx vitest run src/features/postal/receipt-print/__tests__/sources.test.ts --maxWorkers=2`
Expected: FAIL — `Failed to resolve import "../sources"`.

- [ ] **Step 4: `sources` 구현**

`src/features/postal/receipt-print/sources.ts`:
```ts
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { RECEIPT_BUCKET } from "../upload-guard";
import { readRegions, type Regions } from "../extract-parse";

/** 영수증 출력의 재료 — 사진 경로, 올린 시각, 최신 판독의 접수일시·위치. */
export type PrintSource = {
  id: string;
  storagePath: string;
  createdAt: string;
  acceptedAt: string | null;
  regions: Regions | null;
};

/**
 * 고른 영수증들의 출력 재료. 없는 id(그사이 지운 것)는 빠진다.
 *
 * 판독은 **영수증당 최신 1건**만 본다 — 목록(`getExtractStates`)과 같은 규칙이다.
 * 화면이 목록의 접수일시로 묶음을 나눴으니 여기서도 같은 값을 봐야 순서가 같다.
 *
 * 조회 오류는 던진다. supabase-js 는 오류를 빈 결과로 돌려줘, 그대로 두면
 * '영수증을 찾을 수 없습니다' 나 형광펜 없는 PDF 로 조용히 둔갑한다.
 */
export async function loadPrintSources(ids: string[]): Promise<PrintSource[]> {
  const admin = createAdminClient();
  const [receipts, requests] = await Promise.all([
    admin.from("postal_receipts").select("id, storage_path, created_at").in("id", ids),
    admin
      .from("postal_extract_requests")
      .select("receipt_id, result, requested_at")
      .in("receipt_id", ids)
      .order("requested_at", { ascending: false }),
  ]);
  if (receipts.error) {
    throw new Error(`영수증을 읽지 못했습니다: ${receipts.error.message}`);
  }
  if (requests.error) {
    throw new Error(`판독 결과를 읽지 못했습니다: ${requests.error.message}`);
  }

  const latest = new Map<string, unknown>();
  for (const r of (requests.data ?? []) as { receipt_id: string; result: unknown }[]) {
    if (!latest.has(r.receipt_id)) latest.set(r.receipt_id, r.result);
  }

  const rows = (receipts.data ?? []) as { id: string; storage_path: string; created_at: string }[];
  return rows.map((r) => {
    const result = latest.get(r.id);
    return {
      id: r.id,
      storagePath: r.storage_path,
      createdAt: r.created_at,
      acceptedAt: acceptedAtOf(result),
      regions: readRegions(result),
    };
  });
}

function acceptedAtOf(result: unknown): string | null {
  if (!result || typeof result !== "object" || !("accepted_at" in result)) return null;
  return typeof result.accepted_at === "string" ? result.accepted_at : null;
}

/** 저장소에서 사진을 받는다. 실패하면 null — 그 칸에 사유를 적는다. */
export async function downloadReceipt(storagePath: string): Promise<Buffer | null> {
  const { data, error } = await createAdminClient()
    .storage.from(RECEIPT_BUCKET)
    .download(storagePath);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
```

- [ ] **Step 5: 통과를 확인한다**

Run: `npx vitest run src/features/postal --maxWorkers=2`
Expected: 전부 PASS(`sources` 6개, `readRegions` 3개 포함).

- [ ] **Step 6: 커밋한다**

```bash
git add src/features/postal/extract-parse.ts src/features/postal/__tests__/extract-parse.test.ts src/features/postal/receipt-print/sources.ts src/features/postal/receipt-print/__tests__/sources.test.ts
git diff --cached --stat   # extract-parse.ts·extract-parse.test.ts 는 지운 줄 0(import 한 줄 교체 제외)
git commit -m "$(cat <<'EOF'
feat(postal): 영수증 출력 재료 — 최신 판독의 접수일시·위치와 사진

판독은 목록과 같이 영수증당 최신 1건만 본다(화면이 나눈 묶음과 순서가 같도록).
저장된 위치도 같은 스키마로 다시 거르고, 조회 오류는 던진다 — 빈 결과로
두면 '없는 영수증'이나 형광펜 없는 PDF 로 조용히 둔갑한다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 10: PDF 문서

**Files:**
- Create: `src/lib/pdf/receipt-print-pdf.tsx`
- Test: `src/lib/pdf/__tests__/receipt-print-pdf.test.ts`

**Interfaces:**
- Consumes: `PAGE_MM`, `fitToSlot`, `toPages` (Task 5)
- Produces: `type PrintSlot = { kind: "image"; jpeg: Buffer; widthPx: number; heightPx: number } | { kind: "error"; label: string; reason: string }`, `renderReceiptPrintPdf(slots: PrintSlot[]): Promise<Buffer>` — `slots` 는 1개 이상(라우트가 0개면 404 로 먼저 끊는다)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/lib/pdf/__tests__/receipt-print-pdf.test.ts`:
```ts
// @vitest-environment node
//
// 칸에 넣을 JPEG 를 sharp 로 만든다 — node 의 Buffer 가 필요하다.
import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";
import { renderReceiptPrintPdf, type PrintSlot } from "../receipt-print-pdf";

/** 페이지 객체 수 — react-pdf 는 객체 사전을 압축하지 않아 그대로 센다. */
const pageCount = (pdf: Buffer) =>
  (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

async function image(widthPx: number, heightPx: number): Promise<PrintSlot> {
  const jpeg = await sharp({
    create: { width: widthPx, height: heightPx, channels: 3, background: "#ffffff" },
  })
    .jpeg()
    .toBuffer();
  return { kind: "image", jpeg, widthPx, heightPx };
}

const broken: PrintSlot = {
  kind: "error",
  label: "접수 2026-09-23 15:14",
  reason: "사진을 읽지 못했습니다",
};

describe("renderReceiptPrintPdf", () => {
  it("PDF 를 만든다", { timeout: 20000 }, async () => {
    const pdf = await renderReceiptPrintPdf([await image(465, 1000)]);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("한 페이지에 3장 — 7장이면 3쪽", { timeout: 20000 }, async () => {
    const one = await image(465, 1000);
    const seven = Array.from({ length: 7 }, () => one);
    expect(pageCount(await renderReceiptPrintPdf(seven))).toBe(3);
  });

  it("못 읽은 칸이 섞여도 만든다 — 한 장 때문에 전체가 실패하지 않는다", { timeout: 20000 }, async () => {
    const pdf = await renderReceiptPrintPdf([await image(465, 1000), broken, await image(465, 1000)]);
    expect(pageCount(pdf)).toBe(1);
  });

  /**
   * 넘쳐도 react-pdf 는 새 페이지를 만들지 않는다 — `console.warn` 한 줄만 남기고
   * 페이지 밖으로 나간 아래쪽을 버린다(2026-09-28 실측: 1015mm 칸 → 1쪽 + 경고,
   * 269mm → 경고 0). 그래서 쪽수가 아니라 그 경고로 판정한다.
   */
  it("아주 긴 영수증도 페이지 안에 든다 — 넘치면 아래가 잘린다", { timeout: 20000 }, async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      await renderReceiptPrintPdf([await image(465, 8000), await image(465, 1000)]);
      expect(warn.mock.calls.flat().join(" ")).not.toMatch(/bigger than available page height/);
    } finally {
      warn.mockRestore();
    }
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/lib/pdf/__tests__/receipt-print-pdf.test.ts --maxWorkers=2`
Expected: FAIL — `Failed to resolve import "../receipt-print-pdf"`.

- [ ] **Step 3: 구현한다**

`src/lib/pdf/receipt-print-pdf.tsx`:
```tsx
import "server-only";
import {
  Document,
  Page,
  View,
  Image,
  Text,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import path from "node:path";
import { PAGE_MM, fitToSlot, toPages } from "@/features/postal/receipt-print/layout";

/**
 * 우편 영수증 출력 — 내부 전표에 붙일 A4.
 *
 * 한 페이지 = 한 줄 3칸. **머리글이 없다** — 영수증 자리를 줄이지 않는다. 쪽번호만.
 * 안내 문구도 찍지 않는다 — 전표에 붙는 종이다(형광펜이 빠진 장수는 화면이 알린다).
 */

const PRETENDARD_REGULAR = path.join(process.cwd(), "public", "fonts", "Pretendard-Regular.ttf");
const PRETENDARD_BOLD = path.join(process.cwd(), "public", "fonts", "Pretendard-Bold.otf");

let fontRegistered = false;
function ensureFontRegistered() {
  if (fontRegistered) return;
  Font.register({
    family: "Pretendard",
    fonts: [
      { src: PRETENDARD_REGULAR, fontWeight: 400 },
      { src: PRETENDARD_BOLD, fontWeight: 700 },
    ],
  });
  fontRegistered = true;
}

/** mm → pt(react-pdf 기본 단위) */
const pt = (mm: number) => (mm * 72) / 25.4;

export type PrintSlot =
  | { kind: "image"; jpeg: Buffer; widthPx: number; heightPx: number }
  | { kind: "error"; label: string; reason: string };

const styles = StyleSheet.create({
  page: { padding: pt(PAGE_MM.margin), fontFamily: "Pretendard" },
  row: { flexDirection: "row", alignItems: "flex-start" },
  slot: { width: pt(PAGE_MM.slotWidth) },
  gap: { marginLeft: pt(PAGE_MM.gap) },
  missing: { borderWidth: 0.5, borderColor: "#6b6253", padding: pt(4) },
  missingLabel: { fontSize: 9, fontWeight: 700, color: "#15120c" },
  missingReason: { marginTop: 4, fontSize: 8, color: "#6b6253" },
  footer: {
    position: "absolute",
    bottom: pt(4),
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 8,
    color: "#6b6253",
  },
});

function Slot({ slot }: { slot: PrintSlot }) {
  if (slot.kind === "error") {
    return (
      <View style={styles.missing}>
        <Text style={styles.missingLabel}>{slot.label}</Text>
        <Text style={styles.missingReason}>{slot.reason}</Text>
      </View>
    );
  }
  const { widthMm, heightMm } = fitToSlot(slot.widthPx, slot.heightPx);
  // 파일 경로가 아니라 Buffer 로 넘긴다 — 경로 문자열로는 임베드되지 않는다(incident-report-pdf 와 같다).
  return (
    <Image
      src={{ data: slot.jpeg, format: "jpg" }}
      style={{ width: pt(widthMm), height: pt(heightMm) }}
    />
  );
}

export async function renderReceiptPrintPdf(slots: PrintSlot[]): Promise<Buffer> {
  ensureFontRegistered();
  const pages = toPages(slots);
  const doc = (
    <Document title="우편 영수증">
      {pages.map((page, p) => (
        <Page key={p} size="A4" style={styles.page}>
          <View style={styles.row} wrap={false}>
            {page.map((slot, i) => (
              <View key={i} style={i === 0 ? styles.slot : [styles.slot, styles.gap]}>
                <Slot slot={slot} />
              </View>
            ))}
          </View>
          <Text style={styles.footer}>{`${p + 1} / ${pages.length}`}</Text>
        </Page>
      ))}
    </Document>
  );
  return renderToBuffer(doc);
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/lib/pdf/__tests__/receipt-print-pdf.test.ts --maxWorkers=2`
Expected: 4 PASS.

- [ ] **Step 5: 역검증 — 긴 영수증 테스트가 실제로 잡는지**

`Slot` 의 `fitToSlot(...)` 을 잠시 `{ widthMm: PAGE_MM.slotWidth, heightMm: (slot.heightPx / slot.widthPx) * PAGE_MM.slotWidth }`(줄이지 않음)로 바꿔 돌린다 → `아주 긴 영수증` 테스트가 FAIL(`bigger than available page height` 경고가 잡힘)이어야 한다. **FAIL 이 안 나면** 테스트가 넘침을 못 잡는 것이니 멈추고 원인을 본다. 확인 뒤 되돌리고 4 PASS, `git diff` 로 되돌린 것을 확인한다.

- [ ] **Step 6: 커밋한다**

```bash
git add src/lib/pdf/receipt-print-pdf.tsx src/lib/pdf/__tests__/receipt-print-pdf.test.ts
git commit -m "$(cat <<'EOF'
feat(postal): 영수증 출력 PDF — A4 한 페이지에 3장, 쪽번호만

머리글·안내 문구 없이 칸 59mm 3개를 한 줄로 놓는다. 페이지보다 긴 영수증은
높이에 맞춰 줄이고, 못 읽은 칸에는 사유를 적어 나머지는 그대로 찍는다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 11: PDF 라우트

**Files:**
- Create: `src/app/api/postal/receipts/pdf/route.ts`
- Test: `src/app/api/postal/receipts/pdf/__tests__/route.test.ts`

**Interfaces:**
- Consumes: `getCurrentOperator` (`@/features/auth/queries`), `canViewMenu` (`@/features/auth/permission`), `parsePrintIds` (Task 6), `printFileName`·`sortBasis`·`sortForPrint` (Task 5), `loadPrintSources`·`downloadReceipt`·`type PrintSource` (Task 9), `renderReceiptImage` (Task 8), `renderReceiptPrintPdf`·`type PrintSlot` (Task 10)
- Produces: `GET(request: Request): Promise<Response>`, `maxDuration = 60`. 응답 401/403/400/404(JSON `{ ok: false, error }`) 또는 200 `application/pdf`

proxy 는 이 경로를 공개 목록(`PUBLIC_PATHS`)에 두지 않으므로 미로그인은 proxy 가 `/login` 으로 보낸다. 라우트는 그래도 스스로 다시 본다(권한은 proxy 가 모른다).

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/api/postal/receipts/pdf/__tests__/route.test.ts`:
```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import { join } from "node:path";

type Source = {
  id: string;
  storagePath: string;
  createdAt: string;
  acceptedAt: string | null;
  regions: null;
};

const state = {
  me: { email: "a@x.com", permission: "member" } as Record<string, unknown> | null,
  canView: true,
  viewedSlug: null as string | null,
  sources: [] as Source[],
  missingFiles: new Set<string>(),
  unreadable: new Set<string>(),
  slots: [] as { kind: string; label?: string; reason?: string; jpeg?: Buffer }[],
};

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => Promise.resolve(state.me),
}));
vi.mock("@/features/auth/permission", () => ({
  canViewMenu: (slug: string) => {
    state.viewedSlug = slug;
    return state.canView;
  },
}));
vi.mock("@/features/postal/receipt-print/sources", () => ({
  loadPrintSources: (ids: string[]) =>
    Promise.resolve(state.sources.filter((s) => ids.includes(s.id))),
  downloadReceipt: (path: string) =>
    Promise.resolve(state.missingFiles.has(path) ? null : Buffer.from(path)),
}));
vi.mock("@/features/postal/receipt-print/render-image", () => ({
  renderReceiptImage: (input: Buffer) =>
    state.unreadable.has(input.toString())
      ? Promise.reject(new Error("Input buffer contains unsupported image format"))
      : Promise.resolve({ jpeg: input, widthPx: 465, heightPx: 1000 }),
}));
vi.mock("@/lib/pdf/receipt-print-pdf", () => ({
  renderReceiptPrintPdf: (slots: typeof state.slots) => {
    state.slots = slots;
    return Promise.resolve(Buffer.from("%PDF-fake"));
  },
}));

const { GET } = await import("../route");
const { RECEIPT_PDF_PATH } = await import("@/features/postal/receipt-print/print-ids");
const { RECEIPT_PDF_BATCH } = await import("@/features/postal/receipt-print/layout");

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const src = (n: number, acceptedAt: string | null, storagePath = `2026-09-2${n}/r${n}.jpg`): Source => ({
  id: id(n),
  storagePath,
  createdAt: "2026-09-20T00:00:00Z",
  acceptedAt,
  regions: null,
});
const get = (ids: string[]) =>
  GET(new Request(`http://x${RECEIPT_PDF_PATH}?ids=${ids.join(",")}`));

describe("영수증 출력 PDF 라우트", () => {
  beforeEach(() => {
    state.me = { email: "a@x.com", permission: "member" };
    state.canView = true;
    state.viewedSlug = null;
    state.sources = [src(1, "2026-09-23 15:14"), src(2, "2026-09-17 10:00")];
    state.missingFiles = new Set();
    state.unreadable = new Set();
    state.slots = [];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("주소 상수가 실제 라우트 위치다 — 화면이 만든 링크가 404 가 되지 않는다", () => {
    expect(existsSync(join(process.cwd(), "src/app", RECEIPT_PDF_PATH, "route.ts"))).toBe(true);
  });

  it("로그인하지 않으면 401", async () => {
    state.me = null;
    expect((await get([id(1)])).status).toBe(401);
  });

  it("우편물 메뉴를 못 보면 403 — 페이지와 같은 판정을 쓴다", async () => {
    state.canView = false;
    expect((await get([id(1)])).status).toBe(403);
    expect(state.viewedSlug).toBe("postal");
  });

  it("id 가 틀리면 400", async () => {
    expect((await get(["abc"])).status).toBe(400);
  });

  it(`${RECEIPT_PDF_BATCH}장을 넘으면 400 — 화면이 나눠 보낸다`, async () => {
    const many = Array.from({ length: RECEIPT_PDF_BATCH + 1 }, (_, i) => id(i + 1));
    expect((await get(many)).status).toBe(400);
  });

  it("하나도 없으면(그사이 지웠다) 404", async () => {
    const res = await get([id(9)]);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: "영수증을 찾을 수 없습니다" });
  });

  it("PDF 를 새 탭에 연다 — 파일명은 첫 접수일~끝 접수일, 캐시하지 않는다", async () => {
    const res = await get([id(1), id(2)]);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toBe(
      `inline; filename*=UTF-8''${encodeURIComponent("우편영수증_2026-09-17_2026-09-23.pdf")}`,
    );
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("접수일시 순으로 찍는다 — 전표에 붙는 순서", async () => {
    await get([id(1), id(2)]);
    expect(state.slots.map((s) => s.jpeg?.toString())).toEqual([
      "2026-09-22/r2.jpg",
      "2026-09-21/r1.jpg",
    ]);
  });

  it("지운 영수증은 빼고 남은 것을 찍는다", async () => {
    const res = await get([id(1), id(9)]);
    expect(res.status).toBe(200);
    expect(state.slots).toHaveLength(1);
  });

  it("사진을 못 받거나 못 읽으면 그 칸에 사유를 적고 나머지는 찍는다", async () => {
    state.sources = [
      src(1, "2026-09-21 10:00"),
      src(2, "2026-09-22 10:00", "2026-09-22/r2.heic"),
      src(3, "2026-09-23 10:00"),
      src(4, "2026-09-24 10:00"),
    ];
    state.missingFiles = new Set(["2026-09-21/r1.jpg"]);
    state.unreadable = new Set(["2026-09-22/r2.heic", "2026-09-23/r3.jpg"]);
    const res = await get([id(1), id(2), id(3), id(4)]);
    expect(res.status).toBe(200);
    expect(state.slots.map((s) => (s.kind === "error" ? s.reason : "image"))).toEqual([
      "사진을 받지 못했습니다",
      "HEIC 사진은 넣을 수 없습니다 — JPG 로 다시 올려 주세요",
      "사진을 읽지 못했습니다",
      "image",
    ]);
    expect(state.slots[0].label).toBe("접수 2026-09-21 10:00");
  });

  it("판독 전 영수증의 사유 칸은 올린 시각으로 이름 붙인다", async () => {
    state.sources = [src(4, null)];
    state.missingFiles = new Set(["2026-09-24/r4.jpg"]);
    await get([id(4)]);
    // 2026-09-20T00:00:00Z → 한국 09-20 09:00
    expect(state.slots[0].label).toBe("올림 2026-09-20 09:00");
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/api/postal/receipts/pdf/__tests__/route.test.ts --maxWorkers=2`
Expected: FAIL — `Failed to resolve import "../route"`.

- [ ] **Step 3: 구현한다**

`src/app/api/postal/receipts/pdf/route.ts`:
```ts
import { NextResponse } from "next/server";
import { getCurrentOperator } from "@/features/auth/queries";
import { canViewMenu } from "@/features/auth/permission";
import { parsePrintIds } from "@/features/postal/receipt-print/print-ids";
import {
  printFileName,
  sortBasis,
  sortForPrint,
} from "@/features/postal/receipt-print/layout";
import {
  downloadReceipt,
  loadPrintSources,
  type PrintSource,
} from "@/features/postal/receipt-print/sources";
import { renderReceiptImage } from "@/features/postal/receipt-print/render-image";
import { renderReceiptPrintPdf, type PrintSlot } from "@/lib/pdf/receipt-print-pdf";

/**
 * 우편 영수증 A4 출력 — `GET /api/postal/receipts/pdf?ids=<uuid>,…`
 *
 * 고른 영수증(최대 30장)을 접수일시 순으로 잘라 형광펜을 입혀 한 페이지 3장씩 놓는다.
 * 내부 전표 증빙용이다. 설계: docs/superpowers/specs/2026-09-28-postal-receipt-print-design.md
 */

/** 사진 30장을 받아 처리하는 시간. 플랜마다 다른 기본 한도에 기대지 않는다. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const me = await getCurrentOperator();
  if (!me) {
    return NextResponse.json({ ok: false, error: "로그인이 필요합니다" }, { status: 401 });
  }
  // 페이지(`requireMenu("postal")`)와 같은 판정 — 두 벌이면 한쪽만 바뀐다.
  if (!canViewMenu("postal", me)) {
    return NextResponse.json({ ok: false, error: "우편물 메뉴 권한이 없습니다" }, { status: 403 });
  }

  const parsed = parsePrintIds(new URL(request.url).searchParams.get("ids"));
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const sources = sortForPrint(await loadPrintSources(parsed.ids));
  if (sources.length === 0) {
    return NextResponse.json({ ok: false, error: "영수증을 찾을 수 없습니다" }, { status: 404 });
  }

  // 한 장씩 — 3024×4032 사진을 한꺼번에 풀면 메모리가 장수만큼 커진다.
  const slots: PrintSlot[] = [];
  for (const source of sources) {
    slots.push(await toSlot(source));
  }
  const pdf = await renderReceiptPrintPdf(slots);

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(printFileName(sources))}`,
      // 수취인 실명·카드 결제 정보가 찍힌 영수증이다 — 버킷을 비공개로 둔 이유가 캐시로 새지 않게.
      "cache-control": "private, no-store",
    },
  });
}

/** 한 칸. 못 받거나 못 읽으면 사유를 적는다 — 한 장 때문에 전체가 실패하지 않는다. */
async function toSlot(source: PrintSource): Promise<PrintSlot> {
  const { key, basis } = sortBasis(source);
  const label = `${basis === "accepted" ? "접수" : "올림"} ${key}`;
  const input = await downloadReceipt(source.storagePath);
  if (!input) return { kind: "error", label, reason: "사진을 받지 못했습니다" };
  try {
    return { kind: "image", ...(await renderReceiptImage(input, source.regions)) };
  } catch (err) {
    console.error("[postal-pdf] 영수증 사진 처리 실패", source.id, err);
    return {
      kind: "error",
      label,
      reason: /\.hei[cf]$/i.test(source.storagePath)
        ? "HEIC 사진은 넣을 수 없습니다 — JPG 로 다시 올려 주세요"
        : "사진을 읽지 못했습니다",
    };
  }
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/api/postal src/features/postal src/lib/pdf --maxWorkers=2`
Expected: 전부 PASS(라우트 11개 포함).

- [ ] **Step 5: 커밋한다**

```bash
git add src/app/api/postal/receipts/pdf/route.ts src/app/api/postal/receipts/pdf/__tests__/route.test.ts
git commit -m "$(cat <<'EOF'
feat(postal): 영수증 A4 출력 PDF 라우트

GET /api/postal/receipts/pdf?ids=… — 로그인 + 우편물 메뉴 권한(페이지와 같은
canViewMenu), ids 1~30. 접수일시 순으로 한 장씩 잘라 형광펜을 입혀 조립한다.
못 받거나 못 읽은 사진은 그 칸에 사유를 적고, 지운 영수증은 빼고 찍는다.
영수증에 실명·결제 정보가 있어 캐시하지 않는다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 12: 실데이터 PDF 확인 · PR-2 올리기 · 운영 확인

**Files:** 루트 `_diag-receipt-pdf.test.ts`(일회용 — 만들고 돌리고 **바로 지운다**)

- [ ] **Step 1: 전체 검증**

```bash
npm run typecheck
npm run lint
npx vitest run src/features/postal src/app/api/postal src/app/dashboard/postal src/lib/pdf src/components/common --maxWorkers=2
```
Expected: 0 errors / 0 errors / 전부 PASS. `src/components/common` 은 레포 전체를 훑는 표준 가드(표 머리글·헤더 버튼)라 함께 돈다.

- [ ] **Step 2: 실데이터로 라우트를 돌린다**

`_diag-receipt-pdf.test.ts`(레포 루트):
```ts
// @vitest-environment node
// 일회용 — 실데이터로 PDF 라우트를 그대로 돌려 본다. 커밋하지 않고 바로 지운다.
import { it, vi } from "vitest";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const OUT = process.env.DIAG_OUT ?? "";
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^"(.*)"$/, "$1");
}

vi.mock("@/features/auth/queries", () => ({
  getCurrentOperator: () => Promise.resolve({ email: "diag", permission: "admin" }),
}));

it("실데이터 PDF", { timeout: 180_000 }, async () => {
  mkdirSync(OUT, { recursive: true });
  const log: string[] = [];
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const { RECEIPT_PDF_BATCH } = await import("@/features/postal/receipt-print/layout");
    const { data, error } = await createAdminClient()
      .from("postal_receipts")
      .select("id")
      .order("created_at")
      .limit(RECEIPT_PDF_BATCH);
    if (error) throw error;
    const ids = (data ?? []).map((r: { id: string }) => r.id);
    const { GET } = await import("@/app/api/postal/receipts/pdf/route");
    const t0 = Date.now();
    const res = await GET(new Request(`http://x/api/postal/receipts/pdf?ids=${ids.join(",")}`));
    const buf = Buffer.from(await res.arrayBuffer());
    const ms = Date.now() - t0;
    writeFileSync(`${OUT}/real.pdf`, buf);
    log.push(`status ${res.status} · ${ids.length}장 · ${ms}ms (장당 ${Math.round(ms / ids.length)}ms) · ${buf.length} bytes`);
    log.push(`content-disposition: ${res.headers.get("content-disposition")}`);
    log.push(`rss ${Math.round(process.memoryUsage().rss / 1e6)}MB`);
  } catch (e) {
    log.push(`ERROR ${String(e)}`);
  } finally {
    writeFileSync(`${OUT}/real.txt`, log.join("\n"));
  }
});
```

```bash
DIAG_OUT="$SP/receipt-print" npx vitest run _diag-receipt-pdf.test.ts
rm _diag-receipt-pdf.test.ts
git status --short    # ?? scripts/moa-applyprice/ 만 남아야 한다
cat "$SP/receipt-print/real.txt"
```
Expected: `status 200 · 14장 · …ms`. `ERROR` 면 그 원문부터 읽는다.

- [ ] **Step 3: 처리 시간을 판정한다**

`장당 ms × 30` 이 45초(= `maxDuration` 60초의 3/4) 이하면 그대로 간다. 넘으면 `RECEIPT_PDF_BATCH` 를 `floor(45000 / 장당ms)` 이하의 3의 배수로 줄이고(테스트는 상수에서 값을 가져와 그대로 통과한다) 이유를 `layout.ts` 주석에 적어 커밋한다. 반대로 30장 추정이 15초 이하로 여유가 크면, 키울지는 Step 6 에서 사용자에게 수치와 함께 묻는다(스펙 §5.4 — 키우는 것은 선택이다). 운영은 네트워크가 달라 PR 본문에 로컬 실측이라고 적는다.

- [ ] **Step 4: PDF 를 직접 본다**

Read 도구로 `$SP/receipt-print/real.pdf` 를 연다(`pages: "1-5"`). 확인할 것: 한 페이지 3장, 접수일시 순, 형광펜이 접수일자·총요금 값에 있음, 글씨가 읽힘, 쪽번호, 잘린 영수증 없음.

- [ ] **Step 5: 푸시·PR**

```bash
git push -u origin feat/postal-receipt-pdf
gh pr create --title "feat(postal): 영수증 A4 출력 PDF 라우트 — 영수증 출력 2/3" --body-file "$SP/pr2-body.md"
```

`$SP/pr2-body.md`(측정값은 Step 2 결과로 채운다):
```markdown
## Summary
- `GET /api/postal/receipts/pdf?ids=…` — 고른 영수증(최대 30장)을 접수일시 순으로 A4 한 페이지에 3장씩, 접수일자·총요금 값에 형광펜
- 가드: 로그인(proxy) + 페이지와 같은 `canViewMenu("postal")`. ids 는 uuid 1~30(중복 제거)
- 사진은 한 장씩: EXIF 방향 → 종이만 잘라내기(여유 2%) → 59mm·200dpi → 곱하기 형광펜. 못 받거나 못 읽은 사진은 그 칸에 사유, 나머지는 그대로
- `sharp` 를 devDependencies → dependencies(운영 런타임이 처음 쓴다)
- 화면(체크박스·버튼)은 PR-3. 이 PR 만으로는 메뉴에 변화가 없다

## 실측 (로컬, 실데이터 N장)
- 처리 시간: …ms(장당 …ms) → 30장 추정 …초 / 한도 60초
- 메모리(rss): …MB

## Test plan
- [x] layout 17 · print-ids 7 · geometry 7 · render-image 6 · sources 6 · readRegions 3 · PDF 4 · route 11 — RED 확인 후 GREEN
- [x] 역검증: EXIF 방향(meta 크기로 바꾸면 FAIL), 긴 영수증(축소를 빼면 react-pdf 넘침 경고로 FAIL)
- [x] typecheck / lint / postal·pdf·표준 가드 테스트
- [x] 실데이터 PDF 를 만들어 머지 전에 확인
- [ ] 배포 후 운영에서 2장 PDF 가 열리는지(= sharp 가 Vercel 에서 도는지). 안 열리면 되돌린다

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 6: 🛑 PDF 를 보이고 머지 승인을 받는다**

```bash
powershell -NoProfile -Command "Invoke-Item '<SP 경로>\receipt-print\real.pdf'"
```
사용자에게 PDF(열어 둔 창)와 PR 링크, 처리 시간을 보이고 **배치·형광펜이 괜찮은지 + 머지 승인**을 받는다. 고칠 점이 나오면 그걸 먼저 한다. CI(`gh pr checks <PR번호>`)가 pass 인지도 함께 본다.

승인 뒤:
```bash
gh pr merge <PR번호> --squash --delete-branch
git checkout main && git pull
```

- [ ] **Step 7: 운영 확인 — sharp 가 Vercel 에서 도는지**

배포 상태(`gh api "repos/{owner}/{repo}/commits/$(git rev-parse HEAD)/statuses" --jq '.[0].state'` → `success`)를 본 뒤, 가장 먼저 올린 영수증 2장의 id 로 주소를 만든다(uuid 는 개인정보가 아니다):

```bash
node -e "
require('dotenv').config({ path: '.env.local', quiet: true });
const { createClient } = require('@supabase/supabase-js');
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
db.from('postal_receipts').select('id').order('created_at').limit(2).then(({ data, error }) => {
  if (error) throw error;
  console.log(process.env.OPS_CONSOLE_BASE_URL.replace(/\/$/, '') + '/api/postal/receipts/pdf?ids=' + data.map((r) => r.id).join(','));
});
"
```

사용자에게 그 주소를 로그인한 브라우저에서 열어 달라고 한다(로그인 세션이 필요하다). 확인할 것: PDF 가 열리고 형광펜이 있다.
- 열리면 PR-3 로 간다
- 500 이면 Vercel 로그(`npx vercel logs <배포 URL>` 또는 대시보드)에서 원문을 읽는다. sharp 로드 실패면 되돌리는 PR(`git revert <머지 SHA>`)을 만들고 **머지 승인을 받아** 되돌린 뒤 원인을 따로 본다

---

## PR-3 — 화면

시작 전: `git checkout main && git pull && git checkout -b feat/postal-receipt-print-ui`

### Task 13: 목록이 형광펜 준비 여부를 안다

**Files:**
- Modify (splice): `src/features/postal/extract-parse.ts` — `hasHighlightRegions`
- Test (splice): `src/features/postal/__tests__/extract-parse.test.ts`
- Modify (splice): `src/features/postal/queries.ts` — `ExtractState.hasRegions`
- Test (Edit): `src/features/postal/__tests__/queries.test.ts`
- Modify (splice): `src/app/dashboard/postal/_components/PostalTable.tsx` — `EMPTY` 에 칸 추가(타입)
- Modify (splice): `src/app/dashboard/postal/_components/__tests__/PostalTable.test.tsx`, `.../__tests__/ReceiptReview.test.tsx` — 픽스처(타입)

**Interfaces:**
- Consumes: `readRegions`, `type Regions` (Task 1·9)
- Produces: `hasHighlightRegions(regions: Regions | null): boolean`, `ExtractState.hasRegions: boolean`(필수 — 새로 `ExtractState` 를 만드는 곳이 모두 정해야 한다)

- [ ] **Step 1: `hasHighlightRegions` 실패 테스트**

splice — `src/features/postal/__tests__/extract-parse.test.ts`.

old (`t13-import-old.txt`):
```ts
import { parseExtraction, assignDaySeq, readRegions } from "../extract-parse";
```

new (`t13-import-new.txt`):
```ts
import {
  parseExtraction,
  assignDaySeq,
  readRegions,
  hasHighlightRegions,
} from "../extract-parse";
```

old (`t13-test-old.txt`):
```ts
describe("assignDaySeq", () => {
```

new (`t13-test-new.txt`):
```ts
/** 형광펜 두 자리를 다 찾았나 — 목록의 출력 안내("N장 중 M장은…")가 센다. */
describe("hasHighlightRegions", () => {
  const box: [number, number, number, number] = [0.1, 0.1, 0.2, 0.2];

  it("접수일자·총요금이 다 있으면 참 — 종이 상자는 안 본다", () => {
    expect(hasHighlightRegions({ receipt: null, accepted_at: box, total_fee: box })).toBe(true);
  });

  it("하나라도 없으면 거짓", () => {
    expect(hasHighlightRegions({ receipt: box, accepted_at: box, total_fee: null })).toBe(false);
    expect(hasHighlightRegions(null)).toBe(false);
  });
});

describe("assignDaySeq", () => {
```

Run: `npx vitest run src/features/postal/__tests__/extract-parse.test.ts --maxWorkers=2`
Expected: FAIL — `hasHighlightRegions is not a function`.

- [ ] **Step 2: `hasHighlightRegions` 구현**

splice — `src/features/postal/extract-parse.ts`.

old (`t13-has-old.txt`):
```ts
  return regionsSchema.parse(result.regions);
}
```

new (`t13-has-new.txt`):
```ts
  return regionsSchema.parse(result.regions);
}

/** 형광펜 두 자리(접수일자·총요금)를 다 찾았나. 종이 상자는 보지 않는다 — 없으면 사진 전체를 쓸 뿐이다. */
export function hasHighlightRegions(regions: Regions | null): boolean {
  return Boolean(regions?.accepted_at && regions.total_fee);
}
```

Run: `npx vitest run src/features/postal/__tests__/extract-parse.test.ts --maxWorkers=2`
Expected: 전부 PASS.

- [ ] **Step 3: `getExtractStates` 실패 테스트**

Edit — `src/features/postal/__tests__/queries.test.ts`(prettier 준수 파일).

old:
```ts
const state = {
  rows: [] as Record<string, unknown>[],
```

new:
```ts
const state = {
  rows: [] as Record<string, unknown>[],
  requests: [] as Record<string, unknown>[],
```

old:
```ts
        select: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: state.rows, error: null }),
      });
```

new:
```ts
        select: () => chain,
        in: () => chain,
        order: () => chain,
        limit: () => Promise.resolve({ data: state.rows, error: null }),
        // getExtractStates 는 limit 없이 order 까지 부르고 기다린다.
        then: (resolve: (v: unknown) => unknown) =>
          resolve({ data: state.requests, error: null }),
      });
```

old:
```ts
const { listReceipts, SIGNED_URL_TTL_SECONDS } = await import("../queries");
```

new:
```ts
// 담당자 조회는 총괄장(Graph)을 읽는다 — 이 파일의 관심사가 아니라 끊는다.
vi.mock("../assignee-queries", () => ({
  loadAssigneeRows: () => Promise.resolve({ under: [], grad: [] }),
}));

const { listReceipts, SIGNED_URL_TTL_SECONDS, getExtractStates } = await import(
  "../queries"
);
```

그리고 파일 끝에 붙인다:
```ts

/**
 * 형광펜 준비 여부 — 영수증 출력 버튼 옆 안내가 센다.
 * 이게 틀리면 모든 영수증이 '빠짐' 으로 보이거나, 빠진 것을 못 본다.
 */
describe("getExtractStates — hasRegions", () => {
  const BOX = [0.1, 0.1, 0.2, 0.2];
  const done = (regions?: unknown) => ({
    receipt_id: "r1",
    status: "done",
    warnings: [],
    message: null,
    requested_at: "2026-09-28T07:00:00Z",
    result: {
      accepted_at: "2026-09-23 15:14",
      items: [
        {
          tracking_no: "11263-1102-7080",
          fee: 4590,
          postal_code: "55338",
          recipient_org: "우석대",
          recipient_name: "강정화",
        },
      ],
      ...(regions === undefined ? {} : { regions }),
    },
  });

  it("접수일자·총요금 자리를 다 찾았으면 참", async () => {
    state.requests = [done({ receipt: BOX, accepted_at: BOX, total_fee: BOX })];
    expect((await getExtractStates(["r1"])).get("r1")?.hasRegions).toBe(true);
  });

  it("하나라도 없으면 거짓", async () => {
    state.requests = [done({ receipt: BOX, accepted_at: BOX, total_fee: null })];
    expect((await getExtractStates(["r1"])).get("r1")?.hasRegions).toBe(false);
  });

  it("위치를 묻기 전 판독은 거짓", async () => {
    state.requests = [done()];
    expect((await getExtractStates(["r1"])).get("r1")?.hasRegions).toBe(false);
  });
});
```

Run: `npx vitest run src/features/postal/__tests__/queries.test.ts --maxWorkers=2`
Expected: 새 3개 중 `참` 이 FAIL(`undefined` ≠ `true`) — `거짓` 둘은 `undefined` 라 `toBe(false)` 에서 FAIL. 기존 `listReceipts` 4개는 PASS.

- [ ] **Step 4: `ExtractState.hasRegions` 구현**

splice — `src/features/postal/queries.ts`, 세 곳.

old (`t13-q-import-old.txt`):
```ts
import { RECEIPT_BUCKET } from "./upload-guard";
```

new (`t13-q-import-new.txt`):
```ts
import { RECEIPT_BUCKET } from "./upload-guard";
import { hasHighlightRegions, readRegions } from "./extract-parse";
```

old (`t13-q-type-old.txt`):
```ts
  /** done일 때만. 검토 표의 재료. */
  rows: ReviewRow[];
};
```

new (`t13-q-type-new.txt`):
```ts
  /** done일 때만. 검토 표의 재료. */
  rows: ReviewRow[];
  /** 형광펜 두 자리(접수일자·총요금)를 다 찾았나 — 영수증 출력 안내가 센다. */
  hasRegions: boolean;
};
```

old (`t13-q-set-old.txt`):
```ts
          ? buildReviewRows(result.items, { under, grad, alreadyOnThatDay: 0 })
          : [],
    });
```

new (`t13-q-set-new.txt`):
```ts
          ? buildReviewRows(result.items, { under, grad, alreadyOnThatDay: 0 })
          : [],
      hasRegions: hasHighlightRegions(readRegions(r.result)),
    });
```

- [ ] **Step 5: 타입이 는 곳의 픽스처를 맞춘다**

splice — `src/app/dashboard/postal/_components/PostalTable.tsx`.

old (`t13-empty-old.txt`):
```ts
  acceptedAt: null,
  rows: [],
};
```

new (`t13-empty-new.txt`):
```ts
  acceptedAt: null,
  rows: [],
  hasRegions: false,
};
```

splice — `src/app/dashboard/postal/_components/__tests__/PostalTable.test.tsx`, 두 곳.

old (`t13-pt1-old.txt`):
```ts
  r1: { status: "none", warnings: [], message: null, acceptedAt: null, rows: [] },
```

new (`t13-pt1-new.txt`):
```ts
  r1: { status: "none", warnings: [], message: null, acceptedAt: null, rows: [], hasRegions: false },
```

old (`t13-pt2-old.txt`):
```ts
    status: "done", warnings: [], message: null, acceptedAt: "2026-08-19",
```

new (`t13-pt2-new.txt`):
```ts
    status: "done", warnings: [], message: null, acceptedAt: "2026-08-19", hasRegions: true,
```

splice — `src/app/dashboard/postal/_components/__tests__/ReceiptReview.test.tsx`. 첫째는 **4곳 전부**(횟수 인자 `4`):

old (`t13-rr1-old.txt`):
```ts
acceptedAt: null, rows: [] }
```

new (`t13-rr1-new.txt`):
```ts
acceptedAt: null, rows: [], hasRegions: false }
```

Run: `PYTHONIOENCODING=utf-8 python "$SP/splice.py" src/app/dashboard/postal/_components/__tests__/ReceiptReview.test.tsx "$SP/t13-rr1-old.txt" "$SP/t13-rr1-new.txt" 4`

old (`t13-rr2-old.txt`):
```ts
  message: null,
  acceptedAt: "2026-08-18",
```

new (`t13-rr2-new.txt`):
```ts
  message: null,
  acceptedAt: "2026-08-18",
  hasRegions: false,
```

- [ ] **Step 6: 통과·타입을 확인한다**

```bash
npx vitest run src/features/postal src/app/dashboard/postal --maxWorkers=2
npm run typecheck
```
Expected: 전부 PASS, typecheck 0 errors(`ExtractState` 를 만드는 곳이 모두 `hasRegions` 를 정했다).

- [ ] **Step 7: 커밋한다**

```bash
git add src/features/postal/extract-parse.ts src/features/postal/__tests__/extract-parse.test.ts src/features/postal/queries.ts src/features/postal/__tests__/queries.test.ts src/app/dashboard/postal/_components/PostalTable.tsx src/app/dashboard/postal/_components/__tests__/PostalTable.test.tsx src/app/dashboard/postal/_components/__tests__/ReceiptReview.test.tsx
git diff --cached --stat   # PostalTable.tsx +1, ReceiptReview.test.tsx +5/-4, PostalTable.test.tsx +2/-2 근처여야 한다
git commit -m "$(cat <<'EOF'
feat(postal): 목록이 영수증별 형광펜 준비 여부를 안다

getExtractStates 가 최신 판독의 위치로 hasRegions(접수일자·총요금 둘 다)를
함께 돌려준다. 출력 버튼 옆 안내가 이걸로 빠진 장수를 센다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 14: 출력 버튼 줄

**Files:**
- Create: `src/app/dashboard/postal/_components/ReceiptPrintBar.tsx`
- Test: `src/app/dashboard/postal/_components/__tests__/ReceiptPrintBar.test.tsx`

**Interfaces:**
- Consumes: `planBatches`, `RECEIPT_PDF_BATCH`, `type PrintOrderKey` (Task 5), `receiptPdfHref` (Task 6), `HeaderActionButton` (`@/components/common/HeaderActionButton`)
- Produces: `type PrintPick = PrintOrderKey & { hasRegions: boolean }`, `ReceiptPrintBar({ picks }: { picks: PrintPick[] })`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/app/dashboard/postal/_components/__tests__/ReceiptPrintBar.test.tsx`:
```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReceiptPrintBar, type PrintPick } from "../ReceiptPrintBar";
import { RECEIPT_PDF_BATCH } from "@/features/postal/receipt-print/layout";

const pad = (n: number, w = 2) => String(n).padStart(w, "0");
/** n 번째 영수증 — 접수 10:00 부터 1분씩 */
const pick = (n: number, hasRegions = true): PrintPick => {
  const t = 600 + n;
  return {
    id: `p${pad(n, 3)}`,
    acceptedAt: `2026-09-23 ${pad(Math.floor(t / 60))}:${pad(t % 60)}`,
    createdAt: "2026-09-23T00:00:00Z",
    hasRegions,
  };
};
const idsOf = (link: HTMLElement) =>
  (new URL(link.getAttribute("href") ?? "", "http://x").searchParams.get("ids") ?? "").split(",");

describe("ReceiptPrintBar", () => {
  it("고른 것이 없으면 버튼이 꺼져 있다", () => {
    render(<ReceiptPrintBar picks={[]} />);
    expect(screen.getByRole("button", { name: "영수증 출력 (0)" })).toBeDisabled();
  });

  it("고르면 새 탭 PDF 링크 하나 — 접수일시 순", () => {
    render(<ReceiptPrintBar picks={[pick(2), pick(1)]} />);
    const link = screen.getByRole("link", { name: "영수증 출력 (2)" });
    expect(idsOf(link)).toEqual(["p001", "p002"]);
    expect(link).toHaveAttribute("target", "_blank");
    // 헤더 액션 표준(HeaderActionButton) 모양 그대로
    expect(link).toHaveClass("bg-vermilion");
  });

  it(`${RECEIPT_PDF_BATCH}장이 넘으면 ${RECEIPT_PDF_BATCH}장씩 나눈 버튼을 놓는다`, () => {
    const B = RECEIPT_PDF_BATCH;
    render(<ReceiptPrintBar picks={Array.from({ length: B + 1 }, (_, i) => pick(i + 1))} />);
    expect(screen.getByText(`${B + 1}장 — ${B}장씩 나눠 받습니다`)).toBeInTheDocument();
    expect(idsOf(screen.getByRole("link", { name: `1~${B}장 PDF` }))).toHaveLength(B);
    expect(idsOf(screen.getByRole("link", { name: `${B + 1}장 PDF` }))).toEqual([`p${pad(B + 1, 3)}`]);
    expect(screen.queryByRole("link", { name: /영수증 출력/ })).toBeNull();
  });

  it("형광펜 자리를 다 못 찾은 장수를 적는다 — PDF 에는 안 찍으니 여기서 알린다", () => {
    render(<ReceiptPrintBar picks={[pick(1, false), pick(2), pick(3, false)]} />);
    const note = screen.getByText("3장 중 2장은 형광펜이 빠진 곳이 있습니다");
    expect(note).toHaveClass("text-muted");
  });

  it("다 찾았으면 안내가 없다", () => {
    render(<ReceiptPrintBar picks={[pick(1), pick(2)]} />);
    expect(screen.queryByText(/형광펜이 빠진/)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/dashboard/postal/_components/__tests__/ReceiptPrintBar.test.tsx --maxWorkers=2`
Expected: FAIL — `Failed to resolve import "../ReceiptPrintBar"`.

- [ ] **Step 3: 구현한다**

`src/app/dashboard/postal/_components/ReceiptPrintBar.tsx`:
```tsx
"use client";

import { HeaderActionButton } from "@/components/common/HeaderActionButton";
import {
  planBatches,
  RECEIPT_PDF_BATCH,
  type PrintOrderKey,
} from "@/features/postal/receipt-print/layout";
import { receiptPdfHref } from "@/features/postal/receipt-print/print-ids";

/**
 * 영수증 출력 버튼 줄 — 목록 제목 오른쪽.
 *
 * 30장까지는 버튼 하나, 넘으면 접수일시 순으로 30장씩 나눈 버튼을 놓는다(PDF 하나에
 * 30장이 서버 상한이다). 형광펜 자리를 다 못 찾은 장수는 **여기에만** 적는다 —
 * PDF 는 전표에 붙는 종이라 안내를 찍지 않는다.
 */
export type PrintPick = PrintOrderKey & {
  /** 형광펜 두 자리(접수일자·총요금)를 다 찾았나 */
  hasRegions: boolean;
};

const batchLabel = (from: number, to: number) =>
  from === to ? `${from}장 PDF` : `${from}~${to}장 PDF`;

export function ReceiptPrintBar({ picks }: { picks: PrintPick[] }) {
  if (picks.length === 0) {
    return (
      <HeaderActionButton disabled title="표에서 출력할 영수증을 체크하세요">
        영수증 출력 (0)
      </HeaderActionButton>
    );
  }

  const batches = planBatches(picks);
  const missing = picks.filter((p) => !p.hasRegions).length;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {missing > 0 && (
        <span className="text-xs text-muted">
          {`${picks.length}장 중 ${missing}장은 형광펜이 빠진 곳이 있습니다`}
        </span>
      )}
      {batches.length === 1 ? (
        <HeaderActionButton href={receiptPdfHref(batches[0].ids)}>
          {`영수증 출력 (${picks.length})`}
        </HeaderActionButton>
      ) : (
        <>
          <span className="text-xs text-muted">
            {`${picks.length}장 — ${RECEIPT_PDF_BATCH}장씩 나눠 받습니다`}
          </span>
          {batches.map((b) => (
            <HeaderActionButton key={b.from} href={receiptPdfHref(b.ids)}>
              {batchLabel(b.from, b.to)}
            </HeaderActionButton>
          ))}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/dashboard/postal/_components/__tests__/ReceiptPrintBar.test.tsx --maxWorkers=2`
Expected: 5 PASS.

- [ ] **Step 5: 커밋한다**

```bash
git add src/app/dashboard/postal/_components/ReceiptPrintBar.tsx src/app/dashboard/postal/_components/__tests__/ReceiptPrintBar.test.tsx
git commit -m "$(cat <<'EOF'
feat(postal): 영수증 출력 버튼 줄 — 30장 넘으면 묶음 버튼

고른 영수증을 접수일시 순으로 30장씩 나눠 새 탭 PDF 링크를 놓는다.
형광펜 자리를 다 못 찾은 장수는 PDF 대신 여기서 알린다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 15: 목록 체크박스

**Files:**
- Modify (splice): `src/app/dashboard/postal/_components/PostalTable.tsx`
- Test (splice): `src/app/dashboard/postal/_components/__tests__/PostalTable.test.tsx`

**Interfaces:**
- Consumes: `ReceiptPrintBar`, `type PrintPick` (Task 14), `ExtractState.hasRegions` (Task 13)
- Produces: 없음(화면)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

splice — `src/app/dashboard/postal/_components/__tests__/PostalTable.test.tsx`.

old (`t15-test-old.txt`):
```ts
/**
 * 서명이 만료된 이미지는 깨진 아이콘 대신 이유를 보여준다.
```

new (`t15-test-new.txt`):
```ts
/**
 * 영수증 출력 — 내부 전표에 붙일 A4 PDF.
 *
 * 행을 누르면 원본 팝업이 열리므로 체크 칸의 클릭은 새지 않아야 한다.
 */
describe("PostalTable — 영수증 출력", () => {
  const boxes = () => screen.getAllByRole("checkbox");

  it("표 머리에 선택 칸이 있다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    expect(screen.getByRole("columnheader", { name: "선택" })).toBeInTheDocument();
  });

  it("고른 것이 없으면 출력 버튼이 꺼져 있다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    expect(screen.getByRole("button", { name: "영수증 출력 (0)" })).toBeDisabled();
  });

  it("체크하면 고른 영수증으로 PDF 주소를 만든다 — 접수일시 순", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    // 표 순서(r1, r2)와 반대로 누른다. r1 은 판독 전이라 올린 시각(한국 08-18 10:00)으로,
    // r2 는 접수일자(08-19)로 선다.
    fireEvent.click(boxes()[1]);
    fireEvent.click(boxes()[0]);
    expect(screen.getByRole("link", { name: "영수증 출력 (2)" })).toHaveAttribute(
      "href",
      "/api/postal/receipts/pdf?ids=r1,r2",
    );
  });

  it("체크해도 원본 팝업이 열리지 않는다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.click(boxes()[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("다시 누르면 빠진다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.click(boxes()[0]);
    fireEvent.click(boxes()[0]);
    expect(screen.getByRole("button", { name: "영수증 출력 (0)" })).toBeDisabled();
  });

  it("형광펜 자리를 다 못 찾은 장수를 알린다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.click(boxes()[0]);
    fireEvent.click(boxes()[1]);
    expect(screen.getByText("2장 중 1장은 형광펜이 빠진 곳이 있습니다")).toBeInTheDocument();
  });

  it("체크 칸은 표준 강조색이다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    expect(boxes()[0]).toHaveClass("accent-vermilion");
  });
});

/**
 * 서명이 만료된 이미지는 깨진 아이콘 대신 이유를 보여준다.
```

- [ ] **Step 2: 실패를 확인한다**

Run: `npx vitest run src/app/dashboard/postal/_components/__tests__/PostalTable.test.tsx --maxWorkers=2`
Expected: 새 7개 FAIL(체크박스·선택 칸·버튼 없음), 기존 테스트 PASS.

- [ ] **Step 3: 구현한다**

splice — `src/app/dashboard/postal/_components/PostalTable.tsx`, 여덟 번.

(a) old (`t15-a-old.txt`):
```ts
import { deleteReceipt } from "@/features/postal/actions";
```
new (`t15-a-new.txt`):
```ts
import { deleteReceipt } from "@/features/postal/actions";
import { ReceiptPrintBar, type PrintPick } from "./ReceiptPrintBar";
```

(b) old (`t15-b-old.txt`):
```ts
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
```
new (`t15-b-new.txt`):
```ts
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  // 출력에 넣을 영수증. 검색으로 가려져도 남는다 — 버튼의 장수(N)에 드러난다.
  const [picked, setPicked] = useState<ReadonlySet<string>>(() => new Set());
  const togglePick = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const picks: PrintPick[] = receipts
    .filter((r) => picked.has(r.id))
    .map((r) => {
      const s = extractStates[r.id] ?? EMPTY;
      return {
        id: r.id,
        createdAt: r.createdAt,
        acceptedAt: s.acceptedAt,
        hasRegions: s.hasRegions,
      };
    });
```

(c) old (`t15-c-old.txt`):
```tsx
          <span className="text-sm text-vermilion">{rows.length}건</span>
        </div>
      </header>
```
new (`t15-c-new.txt`):
```tsx
          <span className="text-sm text-vermilion">{rows.length}건</span>
        </div>
        <ReceiptPrintBar picks={picks} />
      </header>
```

(d) old (`t15-d-old.txt`):
```tsx
              <th className="px-3 py-2">올린 날</th>
```
new (`t15-d-new.txt`):
```tsx
              <th className="w-8 px-3 py-2">
                <span className="sr-only">선택</span>
              </th>
              <th className="px-3 py-2">올린 날</th>
```

(e) old (`t15-e-old.txt`):
```tsx
                  total={total}
                  onOpen={() => setOpenId(receipt.id)}
```
new (`t15-e-new.txt`):
```tsx
                  total={total}
                  picked={picked.has(receipt.id)}
                  onTogglePick={() => togglePick(receipt.id)}
                  onOpen={() => setOpenId(receipt.id)}
```

(f) 열이 하나 늘었다 — **2곳 전부**(횟수 인자 `2`). old (`t15-f-old.txt`):
```tsx
colSpan={7}
```
new (`t15-f-new.txt`):
```tsx
colSpan={8}
```

(g) old (`t15-g-old.txt`):
```tsx
function RowPair({
  receipt,
  extract,
  total,
  onOpen,
}: {
  receipt: ReceiptCard;
  extract: ExtractState;
  total: number;
  onOpen: () => void;
}) {
```
new (`t15-g-new.txt`):
```tsx
function RowPair({
  receipt,
  extract,
  total,
  picked,
  onTogglePick,
  onOpen,
}: {
  receipt: ReceiptCard;
  extract: ExtractState;
  total: number;
  picked: boolean;
  onTogglePick: () => void;
  onOpen: () => void;
}) {
```

(h) old (`t15-h-old.txt`):
```tsx
        className="cursor-pointer border-b border-line-soft hover:bg-line-soft"
      >
        <td className="px-3 py-2 text-sm text-ink-soft">
          {fmtDate(receipt.createdAt)}
```
new (`t15-h-new.txt`):
```tsx
        className="cursor-pointer border-b border-line-soft hover:bg-line-soft"
      >
        {/* 행을 누르면 원본 팝업이 열린다 — 체크 칸의 클릭은 새지 않게 막는다. */}
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={picked}
            onChange={onTogglePick}
            aria-label={`${fmtDate(receipt.createdAt)} 영수증 출력에 넣기`}
            className="accent-vermilion"
          />
        </td>
        <td className="px-3 py-2 text-sm text-ink-soft">
          {fmtDate(receipt.createdAt)}
```

- [ ] **Step 4: 통과를 확인한다**

Run: `npx vitest run src/app/dashboard/postal src/components/common --maxWorkers=2`
Expected: 전부 PASS — `src/components/common` 의 표 머리글 가드(`th` 좌우 여백·굵기 없음)도 새 `th` 로 통과해야 한다.

- [ ] **Step 5: 역검증 — 팝업 테스트가 실제로 잡는지**

(h) 의 `onClick={(e) => e.stopPropagation()}` 를 잠시 지우고 돌린다 → `체크해도 원본 팝업이 열리지 않는다` 가 FAIL 이어야 한다. 되돌리고 PASS, `git diff` 로 확인.

- [ ] **Step 6: 커밋한다**

```bash
git add src/app/dashboard/postal/_components/PostalTable.tsx src/app/dashboard/postal/_components/__tests__/PostalTable.test.tsx
git diff --cached --stat   # PostalTable.tsx 는 지운 줄이 colSpan 2줄 + 바꾼 줄 몇 개뿐이어야 한다
git commit -m "$(cat <<'EOF'
feat(postal): 영수증 목록에서 체크해 A4 로 출력한다

행 왼쪽 체크박스로 고르면 제목 옆 [영수증 출력 (N)] 이 켜진다. 체크 칸의
클릭은 행의 원본 팝업으로 새지 않는다. 고른 것은 검색으로 가려져도 남는다.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

### Task 16: PR-3 올리기 · 운영 확인

- [ ] **Step 1: 전체 검증**

```bash
npm run typecheck
npm run lint
npx vitest run src/features/postal src/app/api/postal src/app/dashboard/postal src/lib/pdf src/components/common --maxWorkers=2
git diff --stat main...HEAD   # 9파일
```
Expected: 0 / 0 / 전부 PASS, 9파일.

- [ ] **Step 2: 푸시·PR**

```bash
git push -u origin feat/postal-receipt-print-ui
gh pr create --title "feat(postal): 영수증 목록에서 체크해 A4 로 출력 — 영수증 출력 3/3" --body-file "$SP/pr3-body.md"
```

`$SP/pr3-body.md`:
```markdown
## Summary
- 우편물 > 영수증 목록 행 왼쪽에 체크박스, 제목 옆에 [영수증 출력 (N)] — 누르면 PR-2 의 PDF 가 새 탭으로 열린다
- 30장이 넘으면 접수일시 순으로 [1~30장 PDF] [31~N장 PDF] 로 나눠 놓는다(서버 상한과 같은 상수)
- 형광펜 자리를 다 못 찾은 장수를 버튼 옆에 적는다("N장 중 M장은 형광펜이 빠진 곳이 있습니다") — PDF 에는 찍지 않는다
- `getExtractStates` 가 영수증별 `hasRegions` 를 함께 돌려준다

## Test plan
- [x] hasHighlightRegions 2 · getExtractStates 3 · ReceiptPrintBar 5 · PostalTable 7 — RED 확인 후 GREEN
- [x] 역검증: 체크 칸 전파 막기를 빼면 팝업 테스트 FAIL
- [x] typecheck / lint / postal·표준 가드 테스트
- [ ] 배포 후 운영 목록에서 두 장 체크 → [영수증 출력 (2)] → 새 탭 PDF

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

- [ ] **Step 3: 🛑 머지 승인**

CI(`gh pr checks <PR번호>`) pass 를 확인하고 사용자에게 **머지 승인**을 받는다. 승인 뒤:
```bash
gh pr merge <PR번호> --squash --delete-branch
git checkout main && git pull
```

- [ ] **Step 4: 운영 확인**

배포 상태 `success` 를 본 뒤, 사용자에게 운영 `우편물 > 영수증` 에서 두 장 체크 → [영수증 출력 (2)] → 새 탭 PDF 가 열리는지 확인을 부탁한다(로그인 세션이 필요하다). 형광펜이 빠진 영수증을 골랐다면 안내 문구가 뜨는지도 본다.

- [ ] **Step 5: 마무리**

- `git status` 로 워킹트리가 `main` 이고 `?? scripts/moa-applyprice/` 만 남았는지 확인
- 이번에 새로 알게 된 것 중 코드·git 에 없는 것만 메모리에 남긴다(예: 운영 런타임에서 sharp 가 도는지, 30장 실측 시간)
