# 팀 뉴스레터 — 대학가 소식 · 수시 준비 섹션 + 기능 소개 핀 (설계)

날짜: 2026-08-06 / 대상 호수: **3호부터**

## 배경

1호(7/24)·2호(7/31)는 발행 완료, **3호는 8/3자 draft 상태**다. 즉 "3회 발행부터"는 바로 다음 호를 뜻한다.

곧 수시 피크(4년제 접수 9/7~9/11, 전문대 9/7~9/30)가 시작된다. 뉴스레터가 그 준비 진척을 매주 상기시키고, 대학가 구조조정 흐름을 한 건씩 공유한다.

## 무엇을 만드나

세 가지를 더한다. 셋 다 **payload optional 필드**로 들어가므로 기존 발행분(1·2호)은 영향을 받지 않는다 — `milestones?`·`featureIntros?`가 이미 쓰는 패턴이다.

| # | 섹션 | 데이터 출처 | 소멸 조건 |
|---|---|---|---|
| A | 대학가 소식 1건 | `news` (통폐합·폐교) + claude -p 선별 | 고를 게 없으면 생략 |
| B | 수시 준비 | 코드 상수 주차표 + 발행일 | 9/4 경과 시 자동 소멸 |
| C | 기능 소개 핀 | `FEATURE_PINS` 맵 | 핀 없으면 기존 순환 |

---

## A. 대학가 소식 1건

### 왜 LLM 선별인가

키워드 필터만으로는 쓸 수 없다. 실제 데이터를 보면 `통폐합` 최신 1건이 *"李 대통령, 육사 향해 '쿠데타 중심'…"* 으로, 운영부 업무와 무관하다. 최신순 N건을 그대로 실으면 이런 기사가 실린다.

뉴스레터는 이미 `claude -p`로 스토리를 생성한다. 같은 호출에 선별을 태우면 새 인프라가 필요 없다.

### 데이터 흐름

```
buildBriefingData (서버)
  news에서 keyword ∈ {통폐합, 폐교}, published_at ≥ 발행일-7일, 최신순 20건
    → payload.newsCandidates

publish-local.mjs (로컬)
  buildStoryPrompt(payload, issueNo)  ← 후보 목록 포함
    → claude -p
    → story.newsPick = { title, url, source?, publishedAt?, comment }

POST /api/team-briefing/stage  { payload: {...draft.payload, story} }
```

**`newsPick`은 `story` 안에 둔다.** 발행 스크립트가 서버 payload에 덧붙이는 것은 `story` 하나뿐(`{ ...draft.payload, story }`)이므로, 여기 넣으면 API·DB 스키마 변경이 0이다.

### 환각 방지

`parseStoryJson`이 **`newsPick.url`이 후보 목록에 실제로 있는지 검사**한다. 없으면 `newsPick`을 버린다. LLM이 기사를 지어내 링크가 깨진 채 발행되는 것을 막는다.

`comment`는 1~2문장. 운영부(대학 입시·원서접수 업무) 관점에서 왜 알아둘 만한지를 쓴다.

### 실패 시

claude 실패, 파싱 실패, 후보 0건, 또는 claude가 "고를 만한 게 없다"고 판단 → `newsPick` 없음 → **섹션 생략**. 노이즈 기사를 억지로 싣지 않는다. `fallbackStory`(수치 요약 폴백)에도 `newsPick`은 넣지 않는다.

### 후보 목록 보존

`newsCandidates`는 발행 payload에 남긴다. jsonb 몇 KB이고, 나중에 "무엇 중에서 골랐나"를 되짚을 수 있다.

---

## B. 수시 준비 — 이번 주차 + D-day

### 주차표 (코드 상수)

| 주차 | 기간 | 개발요청 | 테스트오픈 |
|---|---|---|---|
| 7월 5주차 | 7/27~8/2 | 20% | — |
| 8월 1주차 | 8/3~8/9 | 50% | 20% |
| 8월 2주차 | 8/10~8/16 | 70% | 50% |
| 8월 3주차 | 8/17~8/23 | 100% | 70% |
| 8월 4주차 | 8/24~8/30 | — | 100% |
| 9월 1주차 | 8/31~9/4 | 최종 테스트 진행 | |

접수 시작: **4년제 9/7(월)~9/11(금)** / 전문대 9/7(월)~9/30(수)

### 동작

발행일(KST ymd)이 속한 주차 1건을 고른다 → `payload.sasiGoal = { label, rangeLabel, devTarget?, testTarget?, note?, dDay }`.

`dDay`는 4년제 접수 시작(9/7)까지 남은 일수.

**어느 주차에도 안 걸리면 필드를 만들지 않는다** → 섹션이 사라진다. 9/4를 넘기면 자동 소멸이라 나중에 코드를 지우러 올 필요가 없다. 7/27 이전도 마찬가지.

렌더 예시:

```
◆ 수시 준비 — 8월 1주차 (8/3~8/9)

  개발요청   50%
  테스트오픈 20%

  4년제 수시 접수까지  D-32  (9/7 월)
```

### 왜 순수 함수인가

주차 경계(8/9 vs 8/10)와 소멸(9/4 vs 9/5)이 이 기능의 전부다. 날짜 하나로 결정되므로 순수 함수로 두고 경계값을 테스트로 고정한다.

---

## C. 기능 소개 핀

### 카탈로그 추가 2건

1. **AI & 자동화 > 자동화실행** — 경쟁률 세팅 점검 자동화
2. **서비스 > 백업 요청** — 백업 요청 검색에 합격자통합관리시스템 발표 서비스 추가 (#938·#939)

### 핀 맵

**인덱스가 아니라 `title` 문자열로 지정한다.**

```ts
const FEATURE_PINS: Record<number, string[]> = {
  3: ["경쟁률 세팅 점검 자동화", "백업 요청 검색에 합격자통합관리 발표 서비스"],
};
```

인덱스로 잡으면 카탈로그에 항목을 추가할 때 뒤 인덱스가 밀려 **과거 핀이 조용히 다른 기능을 가리킨다.** title은 카탈로그 내 고유(현재 10건 전부 다름)하고, 맵만 읽어도 어느 호에 무엇을 실었는지 사람이 안다.

`pickFeatureIntros(issueNo)`가 핀을 먼저 보고, 없으면 기존 `FEATURE_ROTATION` 순환을 그대로 쓴다. 핀에 적힌 title이 카탈로그에 없으면 그 항목은 건너뛴다(오타로 발행이 깨지지 않게).

핀 없는 호에 빈 섹션이 나오지 않게 **순환을 폴백으로 유지**한다. 사용자가 매 호 직접 지정하되, 지정을 잊어도 뉴스레터는 정상 발행된다.

---

## 파일 영향

| 파일 | 변경 |
|---|---|
| `jobs/team-briefing-build.ts` | `NewsCandidate`/`NewsPick`/`SasiGoal` 타입, `pickSasiGoal()`, `FEATURE_PINS` + `pickFeatureIntros` 분기, `FEATURE_INTROS` 2건 추가, `BriefingStory.newsPick?`, `BriefingPayload.newsCandidates?`·`sasiGoal?` |
| `jobs/team-briefing.ts` | `buildBriefingData`에서 news 후보 조회 + `pickSasiGoal` 호출 |
| `scripts/team-briefing/story-lib.mjs` | `buildStoryPrompt`에 후보·JSON 계약 추가, `parseStoryJson`에 `newsPick` 검증(url 후보 대조) |
| `_components/BriefingNewsletter.tsx` | 두 섹션 렌더 (둘 다 조건부) |

기존 API 라우트(`/api/team-briefing/draft`·`stage`·`publish`), DB 스키마, 발행 흐름은 **무변경**.

## 테스트

RED → GREEN 순서로 간다.

- `pickSasiGoal` — 주차 경계(8/9·8/10), 마지막 주차 이후 소멸(9/5), 시작 이전(7/26), D-day 계산
- `pickFeatureIntros` — 핀 있는 호는 핀, 없는 호는 기존 순환(기존 테스트 회귀 없음), 핀 title 오타 시 해당 항목만 건너뜀
- `parseStoryJson` — `newsPick` 정상 파싱 / url이 후보에 없으면 폐기 / 필드 누락 시 폐기
- `BriefingNewsletter` — 두 섹션 조건부 렌더(필드 없으면 미출력)

## 운영 절차

3호가 이미 draft로 존재한다. 배포 후 **초안을 다시 생성**해야 새 섹션이 들어간다(기존 draft 덮어씀). 그 뒤 자동화 페이지에서 내용 확인 → [발행].

## 정하지 않은 것

4호 이후 기능 소개는 매 호 사용자가 지정한다. 지정이 오면 `FEATURE_PINS`에 1줄 추가한다.
