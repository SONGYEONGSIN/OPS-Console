# 원서제어 명세서 — 학교 담당자에게 보내는 문서

2026-09-04

## 왜

개발 탭의 분석은 **운영자가 확인할 것**을 뽑는다. 프롬프트에 `"코드 동작을 처음부터
끝까지 훑는 '제어 요약'은 쓰지 말 것"` 이라고 못박혀 있다.

학교 담당자가 묻는 건 정반대다 — **"우리 원서에 지금 무엇이 걸려 있나."**
같은 코드를 다른 독자에게 다른 목적으로 다시 쓰는 일이라, 수집은 다시 하지 않는다.

## 무엇을

서비스 하나에 대해 **원서제어 명세서**를 만들어 학교 담당자에게 메일로 보낸다.

```
[개발 탭 인스펙터]
  [명세서 만들기] → dev_control_analyze_requests(kind='spec') pending
                       ↓ 회사 PC 폴러 (5분 이내)
                   저장된 raw_code(A+AU) → claude -p (명세 프롬프트)
                       ↓
                   dev_control_specs 적재 — items[]
  ← 항목 **전부** 표시, 각 항목에 포함/제외 토글
  → 수신자 선택 → 초안 확인 → [발송] → Graph sendMail
                       ↓
                   dev_control_spec_sends 이력
```

## 설계 판단

### 큐는 기존 것을 `kind` 로 나눈다

새 테이블·새 폴러를 만들지 않는다. `ratio_audit_requests.kind` 전례가 있고,
`dev_control_analyze_requests` 를 claim 하는 폴러가 이미 회사 PC에 돌고 있다.

**등록해야 할 작업이 하나 더 늘면 그게 곧 죽는 지점이다** — 이 프로젝트에서
반복된 실패다(`automation-job-external-registration`). 폴러는 `kind` 를 보고
`analyze`(수집+분석) 와 `spec`(저장된 코드로 명세) 중 하나를 고른다.

### 명세는 서비스 단위로 하나

분석은 파일 단위(A/AU 각각)지만 학교에 나가는 문서는 **한 장**이다.
`dev_control_specs.service_id` unique. A·AU raw_code 를 한 프롬프트에 같이 넣는다.

학교는 '누가 관리하는 파일인가'가 아니라 '지원자에게 무엇이 걸리는가'를 묻는다.
그래서 **A/AU 구분을 문서에 드러내지 않는다** — 파일명도 코드도 안 나간다.

### 항목(`items[]`)이 단위다

```ts
type DevControlSpecItem = {
  key: string;      // 재생성해도 같아야 한다
  title: string;    // 비개발자 언어 한 줄
  body: string;     // 지원자가 겪는 일로 서술
  included: boolean; // 운영자가 끈 항목은 메일에만 안 들어간다
};
```

`key` 가 안정적이어야 **재생성해도 운영자의 제외 결정이 살아남는다.**
`mergeFlags` 와 같은 자리에 `mergeSpecItems` 를 둔다 — 같은 문제라 같은 해법이다.

### 제외는 '안 나가는 것'이지 '지우는 것'이 아니다

화면에는 항목이 **전부** 남고 메일 본문에서만 빠진다. 운영자가 무엇을 뺐는지
계속 보여야 다음에 다시 판단할 수 있다. 지워 버리면 재생성 때 되살아나
"분명히 뺐는데 또 나갔다"가 된다.

### 비개발자 언어는 프롬프트가 강제한다

파일명·변수명·코드 조각·`A.js`/`AU.js` 표기 금지. **지원자가 겪는 일**로 쓴다.

> ✗ `chkBirth()` 로 생년월일 형식을 검증한다
> ✓ 생년월일을 잘못 적으면 다음 단계로 넘어가지 않습니다

### 오래된 코드로 만든 문서는 위험하다

`analyzed_at`(코드를 걷어 온 시각)을 **화면과 메일 양쪽에** 적는다.
학교에 나가는 문서라 수집 시점이 곧 신뢰다. 최신이 필요하면 운영자가
[지금 분석]을 먼저 돌린다.

### 분석이 없으면 명세도 없다

`raw_code` 가 없는 서비스는 버튼을 비활성하고 이유를 적는다 —
"먼저 분석을 돌려주세요". 조용히 빈 문서를 만들지 않는다.

### 본문 HTML 은 전용 모듈이 만든다

`buildReplyHtml` 을 쓰지 않는다. 오픈안내에서 겪은 그대로 —
연속 공백이 접혀 정렬이 무너지고, 에디터에서는 멀쩡한데 받은 편지함에서만 깨진다.
`dev-control-specs/mail-html.ts` 를 따로 둔다.

## 파일

| 갈래 | 파일 |
|---|---|
| 마이그레이션 | `dev_control_specs` · `dev_control_spec_sends` · `dev_control_analyze_requests.kind` |
| 기능 | `features/dev-control-specs/` — schemas · queries · actions · item-merge · mail-html |
| 프롬프트 | `scripts/lib/dev-control-lib.mjs` 에 `buildSpecPrompt` |
| 폴러 | `scripts/dev-control/poll-local.ps1` kind 분기 · `scripts/dev-control-spec.mjs` |
| API | `/api/dev-controls/analyze-request` kind 통과 |
| 화면 | 인스펙터 `dev-control/View.tsx` 명세 섹션 |

## 검증

- `mergeSpecItems` — 재생성해도 `included` 가 살아남는다 (제외한 항목이 다시 나가면 사고)
- `buildSpecPrompt` — 파일명·코드가 프롬프트 지시에 금지어로 들어간다
- 메일 HTML — 제외 항목이 본문에 **없다**
- `raw_code` 없는 서비스 — 버튼 비활성
- 발송 이력 — `MAIL_DRY_RUN=true` 면 실제 발송 없이 `status='dry_run'`
