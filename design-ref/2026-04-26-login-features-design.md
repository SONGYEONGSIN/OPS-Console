# Login Features 추가 — 설계 문서

- **대상**: `src/app/login/page.tsx` + `src/features/auth/*` + mockup HTML
- **레퍼런스**: `design-ref/folio-login.html` (mockup, 카피/시각 동기화)
- **작성일**: 2026-04-26
- **작업자**: 송영석 (ysong2526@gmail.com)
- **범위**: /login에 self-signup 경로 + 비밀번호 강도/일치 인디케이터 + 실시간 시계. 이메일 확인 custom UI / 프로필 보강 / Microsoft SSO 실연결 등은 out of scope

---

## 1. 배경

`design-ref/2026-04-26-login-refinement-design.md` plan으로 mockup 격차는 해소됐으나(login desktop sync 99.3%), 사용자가 4 가지 새 기능을 요청:

1. 로그인 ↔ 계정 생성 탭 분기
2. 계정 생성 시 비밀번호 강도 규칙 (영문 대문자 + 숫자 + 특수문자 + 8자 이상) 실시간 체크리스트 표시
3. 비밀번호 확인 입력 + 일치 여부 표시
4. 우상단/좌하단 시간을 실제 작동하는 시계로

mockup 카피 *"회사 계정(Microsoft)으로 로그인 하거나, 직접 계정 생성하여 로그인 하세요"*는 self-signup 경로 의도를 이미 표현하고 있다. 이 design은 그 경로를 코드로 풀어낸다.

## 2. 결정 사항

| 항목 | 결정 | 근거 |
|---|---|---|
| signup 폼 scope | **최소 — 이메일 + 비밀번호 + 비밀번호 확인** | 외부 협력사 + 사내 직원 모두 받는 가벼운 self-signup. 사번/팀은 dashboard plan에서 user_metadata 또는 profiles 테이블로 보강 |
| 탭 디자인 | **텍스트 링크 탭** — `로그인 \| 계정 생성`, active = vermilion + bold + underline | mockup 에디토리얼 톤(washi/낙관)에 가장 자연스러움. (B) 세그먼트나 (C) 박스형은 dashboard control 톤이라 결이 다름 |
| 비밀번호 강도 표시 | **실시간 체크리스트** — 4 항목(대문자/숫자/특수/8자+) ✓/✗ | 정적 안내는 입력 도중 부족 조건 모름. 강도 바는 어느 항목 부족인지 표시 안 됨 |
| 비밀번호 확인 표시 | **일치 여부만** ✓/✗ | 비밀번호 확인은 같은 비밀번호 재입력. 강도 규칙 표시는 redundant |
| 시계 동작 | **둘 다 동적, 분 단위, 1초 갱신** | mockup 형식(`14:12 KST`) 정확 보존 + 일관성. 초 표시는 mockup 변경 |
| 모드 전환 시 입력값 | **이메일 유지 / 비밀번호+확인 reset** | 보안 + 사용자 의도 모호 회피 |

## 3. UI/UX 변경 상세

### 3.1 TitleBar (우상단 시계)

**Before**: 정적 `2026.04.25 · 14:12 KST`
**After**: 실시간 동적 시계 (분 단위, 1초 갱신, 분 변동 시 즉각 반영)

SSR hydration 안전: 첫 렌더는 placeholder `------ · --:-- KST` (보이지 않게 처리도 가능), 클라이언트 mount 직후 실 시간으로 갱신.

### 3.2 BrandPanel 좌하단 시간

**Before**: `2026 · 04 · 25 · 월` / `14:30 KST` (정적)
**After**: 같은 시계 인스턴스 사용 (titlebar와 공유) — `<현재 날짜> · <요일>` / `<현재 시간> KST`

요일은 한글 단축 (월/화/수/목/금/토/일).

### 3.3 AuthPanel — 새 탭 + 모드별 폼

```
운영부 / 인증 / 로그인              ← breadcrumb
계정 인증 — 입실                    ← h2

회사 계정(Microsoft)으로 로그인       ← auth-sub
하거나, 직접 계정 생성하여 로그인 하세요.

[Microsoft SSO로 계속        ]      ← SSO 버튼 (disabled)

— 또는 이메일로 로그인 —             ← divider

  로그인  |  계정 생성              ← [NEW] 텍스트 링크 탭
  ─────                            ← active = vermilion + bold + underline

  [모드별 폼]

  ─────────────────────────────
  MS-2026-042 · 운영실 관리팀 ...    ← footer
```

**계정 생성 모드 폼:**
```
이메일
└─ [yss@opsroom.local 또는 EMP-0425          ]

비밀번호                                     [표시]
└─ [••••••••••                              ]
   ✓ 영문 대문자 포함
   ✓ 숫자 포함
   ✗ 특수문자 포함  (← muted, 미충족 시)
   ✓ 8자 이상

비밀번호 확인                                [표시]
└─ [••••••••••                              ]
   ✓ 비밀번호와 일치  (또는 ✗ 비밀번호와 다름)

[ 계정 생성                                   ]
```

색상 규칙:
- 충족 (✓): `text-sage` (녹색)
- 미충족 (✗): `text-muted` (회색)
- 일치 (✓): `text-sage`, 불일치 (✗): `text-vermilion`

비밀번호 확인이 비어있으면 인디케이터 숨김.

로그인 모드는 기존 폼 그대로 (이 기기 기억 체크박스 + 비밀번호 찾기 링크 유지). 계정 생성 모드는 그 두 줄 숨김.

## 4. Architecture & 컴포넌트 분해

### 4.1 수정/생성 파일

- **Modify**: `src/features/auth/schemas.ts` — `signUpSchema` 추가
- **Modify**: `src/features/auth/actions.ts` — `signUp` Server Action 추가, `AuthState` 타입 확장 (`info?: string`)
- **Modify**: `src/features/auth/actions.test.ts` — signUp 테스트 6개 추가
- **Modify**: `src/app/login/page.tsx` — 모드 state + 새 컴포넌트들 inline
- **Modify**: `design-ref/folio-login.html` — 시각만 mockup 동기화 (탭 + 인디케이터 자리, 동작은 React)
- **Modify**: `e2e/login.spec.ts` — 시나리오 5개 추가
- **Reference (no edit)**: middleware, lib/supabase/*, design-tokens.ts

### 4.2 컴포넌트 분해 (모두 `src/app/login/page.tsx` 내부 inline)

```
<LoginPage>
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [now, setNow] = useState<Date | null>(null)  // 시계 source
  
  <TitleBar>
    <Clock now={now} variant="titlebar" />
  </TitleBar>
  <BrandPanel>
    ...
    <Clock now={now} variant="brand-foot" />
  </BrandPanel>
  <AuthPanel mode={mode} setMode={setMode} formAction={modeFormAction} error={state?.error} info={state?.info}>
    <TabNav mode setMode />
    {mode === 'signin' ? <SignInForm ... /> : <SignUpForm ... />}
  </AuthPanel>

<SignUpForm>:
  <Field id="email" label="이메일" />
  <Field id="password" label="비밀번호" type={show?'text':'password'} trailing={토글} value={password} onChange={...} />
  <PasswordStrengthIndicator value={password} />   ← 4 항목 체크리스트
  <Field id="passwordConfirm" label="비밀번호 확인" type={...} trailing={토글} value={confirm} onChange={...} />
  <PasswordMatchIndicator pw={password} confirm={confirm} />
  <SubmitButton label="계정 생성" />
```

### 4.3 Server Action + Schema

```ts
// src/features/auth/schemas.ts
export const signUpSchema = z.object({
  email: z.string().min(1, "이메일을 입력해주세요.").email("이메일 형식이 올바르지 않습니다."),
  password: z.string()
    .min(8, "비밀번호는 8자 이상이어야 합니다.")
    .regex(/[A-Z]/, "영문 대문자를 포함해야 합니다.")
    .regex(/[0-9]/, "숫자를 포함해야 합니다.")
    .regex(/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/`~]/, "특수문자를 포함해야 합니다."),
  passwordConfirm: z.string(),
}).refine((data) => data.password === data.passwordConfirm, {
  message: "비밀번호 확인이 일치하지 않습니다.",
  path: ["passwordConfirm"],
});

// src/features/auth/actions.ts
export type AuthState = { error?: string; info?: string } | undefined;

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = signUpSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: error.message };
  return { info: "확인 메일을 발송했습니다. 메일함을 확인해주세요." };
}
```

### 4.4 Clock 컴포넌트 (SSR 안전)

```tsx
'use client';
function Clock({ now, variant }: { now: Date | null; variant: 'titlebar' | 'brand-foot' }) {
  if (!now) {
    if (variant === 'titlebar') return <span>------ · --:-- KST</span>;
    return <><span>---- · -- · -- · -</span><span>--:-- KST</span></>;
  }
  // 한국 시간으로 format. KST 고정.
  const kst = new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', weekday: 'short',
    hour12: false, timeZone: 'Asia/Seoul',
  }).formatToParts(now);
  // ... format string per variant
}
```

`now` source는 `<LoginPage>`에서 useState/useEffect로 관리, 자식들에 prop drilling.

## 5. Testing 정책

| 검증 | 도구 | 신규/회귀 | 임계 |
|---|---|---|---|
| Unit (TDD) | Vitest `features/auth/actions.test.ts` | +6 (signUp) | RED → GREEN |
| E2E | Playwright `e2e/login.spec.ts` | +5 시나리오 | 모두 pass |
| 회귀 (기존) | Vitest 6 + Playwright 40 | — | 그대로 통과 |
| 정량 좌표 | `diagnose-layout.mjs` | — | 기존 11/14 Δ=0 유지 |
| 정량 픽셀 | `design-sync` | — | login desktop ≥ 97% (현재 99.3%) 유지 |
| 시계 동작 | E2E 1 테스트 | +1 | 1초 후 시간 텍스트 변경 확인 |

### 신규 Vitest (signUp 6개)
1. 빈 이메일 → "이메일을 입력해주세요."
2. 잘못된 이메일 형식
3. 비밀번호 8자 미만
4. 대문자 누락
5. 비밀번호 확인 불일치
6. 성공 → Supabase signUp 호출 + `{info: ...}` 반환

### 신규 Playwright (5개)
1. 탭 전환: signin → signup 클릭 → 비밀번호 확인 input 등장
2. 비밀번호 강도 인디케이터: 입력 시 ✓/✗ 즉각 변동
3. 비밀번호 일치 인디케이터: 같으면 ✓, 다르면 ✗
4. 계정 생성 valid 제출 → info alert (TEST_USER 미설정 시 skip)
5. 시계 동작: 첫 렌더 placeholder → 1초 후 실 시간 표시

## 6. 산출물

1. 이 design.md → `design-ref/2026-04-26-login-features-design.md`
2. plan.md → `design-ref/2026-04-26-login-features-plan.md` (writing-plans 산출)
3. 코드 변경:
   - `src/features/auth/{schemas,actions,actions.test}.ts`
   - `src/app/login/page.tsx`
   - `design-ref/folio-login.html` (mockup 시각 동기화)
4. e2e + Vitest 시나리오 추가
5. 메모리: `feedback_signup_password_pattern.md` (zod 강도 regex + 실시간 인디케이터 패턴, dashboard 등 재사용)

## 7. Risk + Mitigation

| Risk | Mitigation |
|---|---|
| Supabase signUp이 confirmation 메일 발송 — SMTP 미설정 시 메일 안 옴 | `info` alert로 사용자 안내. Supabase dashboard Auth → SMTP 설정 또는 Auto Confirm 옵션 |
| 이미 가입된 이메일로 signUp | Supabase가 `User already registered` 에러 반환 → error alert 표시 |
| Clock setInterval 메모리 누수 | useEffect cleanup으로 `clearInterval` |
| SSR/CSR 인디케이터 mismatch | useState로 클라이언트 컨트롤. 빈 input 초기값 → 모든 인디케이터 ✗ 또는 hidden |
| 비밀번호 정규식 특수문자가 한국 키보드 일부 미포함 | regex에 `_-+=[]\\/\`~` 등 포괄. 사용자가 일반적으로 칠 수 있는 ASCII 특수문자 모두 커버 |
| signUp 후 자동 로그인 X로 사용자 혼란 | info alert 명확히 *"메일함을 확인해주세요"*. 메일 확인 후 사용자가 로그인 모드로 다시 시도 |

## 8. Out of Scope

- 이메일 확인 후 자동 로그인 / `/auth/confirm` 라우트 — Supabase 기본 confirmation flow에 의존, custom UI 없음
- 프로필 보강 (이름/사번/팀) — dashboard reconstruction plan
- 별도 `/signup` 라우트 — 탭 모드로 충분
- 비밀번호 찾기 실연결 — mockup의 "비밀번호 찾기" 링크는 placeholder 그대로
- Microsoft SSO 실연결 — 별도 plan (Azure AD provider 설정)
- 다크 모드, 다국어
- "이 기기 기억" remember-me 동작 — Supabase 기본 세션 정책에 의존

## 9. 다음 단계

이 plan 완료 후 → **Dashboard reconstruction brainstorm + plan** (사용자 표현 *"사실상 다른 앱"* 격차).
- 구조 재구성 + 컴포넌트 추출 + DB 스키마 + RLS 정책
- Login features에서 잡힌 패턴(zod regex, 실시간 인디케이터, Clock 컴포넌트) 재사용 가능
