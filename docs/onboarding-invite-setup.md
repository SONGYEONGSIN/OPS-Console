# Onboarding Invite — Supabase Studio 설정 가이드

`inviteCohortTrainee()` 액션이 동작하려면 Supabase Studio에서 사전 설정이 필요합니다. 본 PR(코드)와 별개로 운영자가 한 번만 설정하면 됩니다.

## 1. Redirect URL 화이트리스트 (필수)

**Supabase Studio → Authentication → URL Configuration**

`Redirect URLs`에 다음 추가:

```
http://localhost:3000/auth/onboarding-callback
https://<프로덕션-도메인>/auth/onboarding-callback
```

화이트리스트에 없으면 invite 메일 클릭 후 Supabase가 redirect를 차단합니다.

## 2. Site URL (env 변수)

`.env.local`에 추가:

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

프로덕션 배포 시 (Vercel 등) `NEXT_PUBLIC_SITE_URL`을 실제 도메인으로 설정. 미설정 시 코드는 `NEXT_PUBLIC_VERCEL_URL` 또는 `http://localhost:3000` fallback.

## 3. Email Template — Invite user (한국어)

**Supabase Studio → Authentication → Email Templates → "Invite user"**

기본 템플릿이 영문이므로 한국어로 변경 권장.

### Subject

```
[Folio] 운영부 온보딩 초대
```

### Body (HTML)

```html
<h2>안녕하세요. Folio OPS Console에 초대되었습니다.</h2>
<p>아래 버튼을 클릭하시면 비밀번호 설정 후 자동으로 본인 회차의 온보딩 가이드로 이동합니다.</p>
<p>
  <a
    href="{{ .ConfirmationURL }}"
    style="display:inline-block;padding:10px 20px;background:#b8331e;color:#fff7ed;text-decoration:none;font-weight:500"
  >
    온보딩 시작
  </a>
</p>
<p style="color:#7a6b5e;font-size:14px;margin-top:32px">
  본 메일은 운영부 admin이 회차 생성 시 자동 발송한 초대장입니다.<br>
  문의: 운영부 팀장 송영신
</p>
```

## 4. SMTP Settings (필수, 권장: Resend)

**Supabase Studio → Project Settings → Authentication → SMTP Settings**

기본 SMTP는 **시간당 4건 발송 제한**이라 운영 부적합. Resend 권장 (월 3,000건 무료):

1. https://resend.com 가입 → API Key 발급
2. Supabase Studio에서 `Enable Custom SMTP` 체크
3. 입력값:
   - Host: `smtp.resend.com`
   - Port: `465`
   - Username: `resend`
   - Password: `<RESEND_API_KEY>`
   - Sender email: `noreply@yourdomain.com` (Resend에서 verified 도메인)
   - Sender name: `Folio`

## 5. Auth Settings — Invite 활성화

**Supabase Studio → Authentication → Providers → Email**

`Confirm email` 활성화 (기본 ON). `Allow signups` 정책은 운영 정책에 따라 — invite-only 운영이라면 `Allow new users to sign up` OFF 권장.

## 검증 (수동)

```sql
-- 1. 환경 변수 확인 후 dev 서버 재시작
-- 2. /dashboard/onboarding 회차 관리 탭에서 admin이 새 회차 생성 (PR-2 후 자동 invite)
-- 3. 또는 SQL Editor에서 수동 호출:
--    select id, trainee_email, invited_at from onboarding_cohorts;
-- 4. inviteCohortTrainee 호출 (PR-2 UI 또는 임시 스크립트) → 메일 도착 확인
-- 5. 메일 클릭 → /auth/onboarding-callback → /dashboard/onboarding?welcome=1 redirect
-- 6. accepted_at 기록 확인:
--    select trainee_email, invited_at, accepted_at, status from onboarding_cohorts;
```

## 학습된 함정

- **redirect URL 미등록**: invite 클릭 후 Supabase가 `unauthorized_redirect` 에러 → 위 1번 단계 누락 의심
- **PKCE vs implicit flow**: `inviteUserByEmail`은 기본 PKCE flow → URL에 `?code=...` 형태. callback 라우트는 `exchangeCodeForSession`로 처리 (이미 구현)
- **service_role key 노출**: `SUPABASE_SERVICE_ROLE_KEY`는 절대 client component에 노출 금지. `src/lib/supabase/admin.ts`만 사용 (`server-only` 가드)
- **이미 가입된 이메일**: invite API가 `User already registered` 에러 반환 → 코드에서 catch + `invited_at`만 갱신 (재초대 의미 유지)
- **시간당 발송 한도**: 기본 SMTP 4건 — Resend 등 커스텀 SMTP 강력 권장
