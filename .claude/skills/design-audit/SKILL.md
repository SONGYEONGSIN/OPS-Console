---
name: design-audit
description: 코드베이스의 디자인 시스템 준수 상태를 점검 — 하드코딩 색상, 중복 UI 패턴, 토큰 커버리지를 분석한다
effort: medium
---

코드베이스 전체의 디자인 시스템 준수 상태를 분석하고 개선 제안을 출력한다.

## 절차

### 1. 하드코딩 색상 스캔

`src/` 하위의 `.tsx`/`.jsx`/`.css` 파일에서 하드코딩된 색상값을 검색한다.

```bash
# hex 색상 (토큰 정의 파일 제외)
grep -rnE '#[0-9a-fA-F]{3,8}\b' src/ --include='*.tsx' --include='*.jsx' --include='*.css' | grep -v 'design-tokens' | grep -v 'tailwind.config' | grep -v 'globals.css'

# 색상 함수 (rgb/hsl/oklch/oklab/lab/lch/hwb/color — Tailwind 4 oklch 포함)
grep -rnEi '(rgb|hsl|oklch|oklab|lab|lch|hwb|color)a?\(' src/ --include='*.tsx' --include='*.jsx' --include='*.css' | grep -v 'design-tokens' | grep -v 'tailwind.config' | grep -v 'globals.css'
```

파일별 하드코딩 색상 수를 집계하고, 가장 빈번한 색상값 TOP 10을 추출한다.

### 2. 디자인 토큰 커버리지

- `src/lib/design-tokens.ts` 존재 여부 확인
- 존재 시: 토큰에 정의된 색상 수 vs 코드베이스에서 사용된 고유 하드코딩 색상 수 비교
- 미존재 시: 토큰 파일 생성 가이드 포함 (`.claude/rules/design.md` 참조)

커버리지 = 100 - (하드코딩 색상이 있는 파일 수 / 전체 컴포넌트 파일 수) × 100

### 3. 중복 UI 패턴 감지

다음 패턴의 출현 횟수를 검색한다:

```bash
# 검색/필터 바: Input + Search 아이콘 조합
grep -rlE '(Search|Filter).*className|search.*input|filter.*select' src/ --include='*.tsx' | wc -l

# 테이블 헤더: 동일 스타일링 반복
grep -rlE 'TableHeader|<thead|<th.*className' src/ --include='*.tsx' | wc -l

# 상태 뱃지: rounded + 색상 + text-xs/sm 조합
grep -rlE 'rounded.*(text-xs|text-sm).*bg-|bg-.*rounded.*(text-xs|text-sm)' src/ --include='*.tsx' | wc -l
```

3회 이상 반복되는 패턴은 `src/components/common/`으로 추출을 제안한다.

### 4. 공통 컴포넌트 현황

- `src/components/common/` 디렉토리 존재 여부 확인
- 존재 시: 기존 공통 컴포넌트 목록 출력
- `src/components/ui/` 목록과 비교하여 원자/조합 수준 분포 확인
- 추출 후보 목록 제시

### 5. 시각 점검 (AI 템플릿 티)

> 전역 스킬 `design-taste-frontend`의 `references/app-screens.md`(대시보드·관리 화면 장)에서 걸러 온 항목이다. **우리 에디토리얼 시스템이 항상 이긴다** — CLAUDE.md "Design System", `.claude/rules/design.md`, globals.css·`design-tokens.ts`와 충돌하면 tasteskill 쪽을 버린다. tasteskill의 미학 방향(bold·랜딩 기본값)은 내부 화면에 쓰지 않는다. 신규·개편 화면에만 적용한다.

- **KPI**: 원형·틴트 아이콘 장식 금지, 카드마다 스파크라인·초록 `+12.5%` 알약 금지. 라벨 위 / 값 아래, 값은 큰 장식 없이 `KpiCard` 기준.
- **숫자**: 금액·건수·순번은 기본 폰트 + `tabular-nums`(`font-mono`는 식별자 전용), 숫자 열은 우측 정렬, 단위는 회색 접미.
- **표**: 줄무늬(zebra)는 기존 표준에 없으면 금지, 머리글 배경 띠·대문자 트래킹 머리글 금지, 행마다 아바타·칩·케밥 중복 금지.
- **상태**: 임의 채도 칩(흰 글씨) 대신 `STATUS_LABEL/COLOR/RING` 토큰(옅은 틴트 + 같은 계열 진한 글씨). 0은 0으로, 값 없음은 회색 대시로 표시.
- **차트**: 그라디언트 영역·스플라인·점마다 마커 금지, 계열 하나면 범례 없음, 격자선은 3~5개 옅게, 차트 하나에 색 하나(무지개 금지).
- **크롬·색**: 색 입힌 사이드바·강조색 면 금지(사이드바는 웜 화이트 유지), 포인트는 vermilion 하나, 선택은 `border-vermilion bg-vermilion/10 text-vermilion` 표준, 카드는 그림자 없이 1px 선 또는 `bg-situation-bg`.
- **헤더·문구**: "Welcome back"·이모지·히어로급 제목 금지(명사형 제목), 제목 옆엔 실제 동작만(`HeaderActionButton`), 빈 상태는 일러스트 없이 한 문장.
- **데이터**: 가짜 사람·회사, 둥근 허수 합계 금지 — 실데이터 크기 그대로, 합계는 행에서 계산.

**반응형 검증** (신규·개편 화면): 폰 390px · PC 1440px, 그리고 태블릿 768px(대시보드 셸이 서랍 메뉴 레이아웃으로 취급)에서 확인한다. 브라우저가 없으면 정적 점검:

- 표는 `overflow-x-auto` 로 감쌌는가, 탭 바는 가로 스크롤이 되는가
- 그리드에 브레이크포인트가 있는가, flex 행은 `flex-wrap` 인가
- 긴 텍스트는 `break-words` / `[overflow-wrap:anywhere]` + `min-w-0` 인가
- 공통 레이아웃 일관성: 페이지 헤더, 헤더 액션 버튼 위치(제목 오른쪽 `HeaderActionButton`), 탭(`PageTabs`), 패딩 `p-5 lg:p-7` 가 다른 dashboard 페이지와 같은가

브라우저가 있으면 선택적으로 tasteskill 검사기를 **수동으로만** 돌린다(훅 금지): `node ~/.claude/skills/design-taste-frontend/scripts/inspect.mjs --app <url>` — 색·서체는 우리 토큰이 정하므로 `--keep palette,type` 로 딜을 고정하고(`draw.mjs --app ... --keep palette,type`), FAIL/WARN은 참고만 한다.

## 출력 형식

```markdown
## 디자인 시스템 감사 결과

### 토큰 커버리지: X%

- 디자인 토큰 파일: [있음/없음]
- 토큰 정의 색상: N개
- 하드코딩 색상이 있는 파일: M개

### 하드코딩 색상 (N건)

| 순위 | 색상값 | 출현 횟수 | 주요 파일 | 제안 |
|------|--------|----------|----------|------|
| 1 | #334155 | 12회 | page.tsx 외 5개 | bg-slate-700 또는 토큰 |

### 파일별 위반 (상위 10개)

| 파일 | 하드코딩 색상 수 |
|------|-----------------|
| src/app/.../page.tsx | 15건 |

### 중복 UI 패턴

| 패턴 | 발견 횟수 | 파일 목록 | 추출 제안 |
|------|----------|----------|----------|
| 검색/필터 바 | 12회 | contacts, tasks... | SearchFilterBar 컴포넌트 |

### 시각 점검

- AI 템플릿 티 / 반응형(390·768·1440) 위반: [항목 나열 또는 없음]

### 공통 컴포넌트 현황

- 디렉토리: [있음/없음]
- ui/ 컴포넌트: N개 (atom)
- common/ 컴포넌트: M개 (molecule)

### 개선 우선순위

| 우선순위 | 항목 | 예상 효과 | 후속 액션 |
|---------|------|----------|----------|
| P0 | 토큰 파일 생성 | 색상 일괄 변경 가능 | `rules/design.md` 구조 가이드 참조하여 수동 생성 |
| P1 | 검색/필터 바 추출 | 12개 파일 중복 제거 | `/scaffold common SearchFilterBar` 호출하여 보일러플레이트 생성 |
| P2 | 테이블 헤더 통일 | 스타일 일관성 확보 | `/scaffold common TableHeader` |
```

## 후속 자동화

각 개선안의 "후속 액션" 컬럼에는 가능한 경우 **구체적 슬래시 명령**을 제시한다. 사용자가 복붙으로 즉시 실행할 수 있도록:

- 공통 컴포넌트 추출 → `/scaffold common <ComponentName>` 형식으로 안내
- 토큰 파일 생성 필요 → `rules/design.md` 구조 가이드 링크 + 최소 템플릿 제시
- 하드코딩 색상 일괄 교체 → 가장 빈번한 색상 TOP 3에 대해 `find/sed` 명령 또는 codemod 제안

audit는 **분석 + 액션 안내**까지가 책임. 실제 추출/수정은 사용자가 위 명령을 호출해 진행한다.

## events.jsonl 기록

감사 완료 후 기록 — retrospective의 디자인 추이 분석(섹션 3-1) 입력:
```bash
echo "{\"ts\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"type\":\"design_audit\",\"coverage\":$COVERAGE,\"violations\":$VIOLATIONS,\"duplicate_patterns\":$DUPS}" >> .claude/events.jsonl
```

## 규칙

- 각 하드코딩 색상에 대해 가장 가까운 Tailwind 클래스 또는 토큰명 제안
- 중복 패턴은 3회 이상만 보고
- 토큰 파일이 없으면 `.claude/rules/design.md`의 구조 가이드 포함
- 결과는 건설적으로 제시 — 비판이 아닌 개선 방향 중심
