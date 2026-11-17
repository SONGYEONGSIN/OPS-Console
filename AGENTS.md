<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# OPS-Console — 에이전트 작업 규칙

## 0. 먼저 읽을 것

작업 전에 **`CLAUDE.md`**(프로젝트 메타·도메인별 주의사항)와 관련된 **`.claude/rules/*.md`** 를 읽는다.
이 파일은 핵심 요약이다. 세부 내용이 이 파일과 다르면 **`CLAUDE.md`·`.claude/rules/*.md` 쪽을 따른다.**

| 파일 | 내용 |
|---|---|
| `conventions.md` | 설계 선행, 코드 스타일, Server Action 패턴 |
| `donts.md` | 금지 사항, 완료 기준, Surgical Change |
| `git.md` | Conventional Commits, 브랜치, PR, HARD-GATE 설계 등급 |
| `tdd.md` | RED-GREEN-REFACTOR |
| `debugging.md` | 4단계 디버깅(관찰→가설→검증→수정) |
| `design.md` | 디자인 토큰, 색상, 숫자·날짜 표기, 버튼 |
| `karpathy-principles.md` | 가정 명시, 단순함, 수술적 변경, 목표 기반 실행 |

## 1. 기본

- 사용자에게 보이는 글은 **한국어로** 쓴다.
- Stack: Next.js(App Router) + TypeScript, Tailwind CSS 4, Supabase(@supabase/ssr), zod, Vitest + Playwright.
- 모호하면 가정을 밝히고 묻는다. 여러 해석이 가능하면 고르지 말고 제시한다.

## 2. 설계·TDD·검증

- **설계 먼저**: 무엇을 / 왜 / 영향 / 검증 4문항에 답한 뒤 구현한다. 규모별 등급(1~5 / 6~19 / 20+ 파일)은 `git.md` HARD-GATE를 따른다.
- **TDD**: 실패하는 테스트를 먼저 쓰고 RED를 확인한 뒤 구현한다. 예외(설정·스타일 전용·문서·타입만)라도 검증은 해야 한다.
- **완료는 증거로**: "아마 될 거다" 금지. lint·typecheck·test를 실행한 결과로 말한다. TypeScript 에러·ESLint 경고가 있는 상태로 커밋하지 않는다.
- `test.skip`/`it.skip`, `@ts-ignore`/`@ts-expect-error`, `eslint-disable`, `any`, `console.log` 남기기 금지.
- 에러는 찍어맞추지 않는다. 한 번에 하나만 고치고, 고친 뒤 재현해서 확인한다.

## 3. 코드 스타일

- 불변성(spread로 새 객체), 함수 50줄 이하, 파일 400줄 권장·800줄 상한, 중첩 4단계 이하.
- 외부 입력은 zod로 검증. zod 에러는 `parsed.error.issues[0].message`(`.errors` 아님).
- Server Action: `useActionState` + zod + `revalidatePath`. 스키마 `features/{domain}/schemas.ts`, 액션 `features/{domain}/actions.ts`(`"use server"`).
- 폴백 로직(graceful degradation, 호환 shim) 금지 — 근본 원인을 고친다.
- 시크릿 하드코딩 금지, `NEXT_PUBLIC_`에 민감값 금지.
- 인라인 스타일, 직접 DOM 조작, `useEffect` 안 데이터 fetch 금지.

## 4. Surgical Change

- 요청과 직접 이어지는 줄만 바꾼다. 인접 코드 "개선"·포맷 정리 금지.
- 무관한 dead code는 언급만 하고 지우지 않는다. 내 변경이 만든 orphan만 정리한다.
- 파일의 기존 스타일이 취향과 달라도 그대로 따른다.

## 5. 디자인 시스템 (CLAUDE.md "Design System" 요약)

- 컴포넌트에 hex/rgb/hsl 등 **하드코딩 색상 금지** — Tailwind 클래스나 `src/lib/design-tokens.ts` 토큰을 쓴다. arbitrary value(`bg-[#xxx]`)는 옆 줄에 일회성 사유 주석 필수.
- 3회 이상 반복되는 UI 패턴은 `src/components/common/`으로 추출.
- **목록·메뉴 항목형**(테이블 행·nav·드롭다운·자동완성): 호버 `hover:bg-line-soft`, 선택 `border-vermilion bg-vermilion/10 text-vermilion`. 버튼·토글·페이지네이션에는 적용하지 않는다.
- **버튼 호버**: `hover:bg-ink hover:text-cream`(보더가 있으면 `hover:border-ink`도). `hover:bg-washi` 같은 약한 톤은 버튼에 금지.
- **표면·입력창**: 배경 `bg-paper`, 카드·빈 상태 `bg-situation-bg`, 입력창 `border-line-soft bg-field-bg` + `focus:border-ink focus:bg-white`, 검색창 `bg-search-field-bg`.
- **헤더 액션 버튼**: 목록 제목 오른쪽 액션은 `components/common/HeaderActionButton` 하나뿐(변형 없음). 클래스만 필요하면 `HEADER_ACTION_CLASS`.
- **날짜·시각**: `@/lib/kst-format`의 `kstFormat(options)`. `Intl.DateTimeFormat("ko-KR", …)` 직접 호출 금지(12시간제로 샌다).
- **숫자**: 금액·건수·순번 등 숫자만인 값은 기본 폰트 + `tabular-nums`. `font-mono`는 문자가 섞인 식별자·기계값(경로·명령어·해시·UUID)에만.

## 6. Git

- Conventional Commits: 접두사는 영어(`feat:` `fix:` `refactor:` `test:` `chore:` `docs:`), 메시지는 한국어, 제목 50자 이내.
- PR 제목은 반드시 Conventional 형식(squash 후 main에 남는 커밋). 본문은 `## Summary` + `## Test plan`. **squash merge** 기본.
- 브랜치: `feat/`·`fix/`·`refactor/`·`chore/` + 케밥 케이스.
- force push 금지 — 필요하면 `--force-with-lease`만.

## 7. 명령어

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm test            # Vitest (TZ=Asia/Seoul)
npm run test:e2e    # Playwright
npm run dev         # 개발 서버 (3000)
npm run build       # 프로덕션 빌드
```

fresh clone(또는 새 worktree)에서는 typecheck 전에 `npx next typegen`이 필요하다.

## 8. 이 PC·안전 제약 (사용자 지시)

- **메모리가 적은 16GB PC다.** 요청받지 않으면 dev 서버나 `next build`를 띄우지 않는다. vitest는 전체 스위트를 돌리지 말고 특정 파일·디렉터리만 `--maxWorkers=1`로 실행한다.
  예: `npm test -- src/features/foo --maxWorkers=1`
- **메인 작업 트리에서 브랜치를 바꾸지 않는다.** Windows 작업 스케줄러가 메인 트리의 파일을 실행한다. 작업은 `git worktree add ../OPS-Console-<type>-<name> -b <branch> origin/main`에서 한다.
- **`scripts/moa-applyprice/`는 절대 stage하지 않는다.**
- 실데이터의 **개인정보(이름·이메일·전화번호·계좌번호·SMS 인증번호)를 출력하지 않는다.**
- **DB 마이그레이션은 사용자가 적용한다.** 에이전트는 마이그레이션 파일만 만든다.
- **사용자의 명시적 승인 없이 머지하지 않는다.**
