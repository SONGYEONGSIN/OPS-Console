---
share: true
status: 확정
updated: 2026-09-11
revision: 6
---

> rev 6 (2026-09-11 구현 완료): PR A(#1179) 배포·라이브 검증 10단계 통과, PR B 스크래퍼 전환. 실호출에서만 드러난 것 둘 — ① Supabase PostgREST 경로는 `safeupdate` 가 켜져 있어 함수 안의 WHERE 없는 DELETE 를 거부한다(`claim_sms_inbox` 전체 비우기 → `where true`; SQL Editor·Docker 검증은 통과했었다), ② `vercel env add` 를 stdin 으로 넣으면 끝의 줄바꿈이 값에 저장돼 전부 401(줄바꿈 없이 재등록 + redeploy). 우편함 클라이언트는 폴링 중 일시 오류를 타임아웃까지 견딘다(설계 §6.1 에 없던 결정 — 로그인 창 90초 안의 흔들림 하나로 문자를 버리지 않기 위해). PR B 리뷰 반영: 폴링 상한을 **TTL−30초(150초)** 로 잘라낸다(이 PC env 가 180 이라 "폴링 상한 90초" 전제가 깨져 있었다 — 코드 리뷰 HIGH), `audit.py` 수동 코드 경로도 `reset` 으로 점유를 잡는다, 예외 문구에서 키를 지운다(보안 H1), pop 의 401·500 을 타임아웃 문구에 싣는다(M2).

> rev 2 (2026-09-11 설계 리뷰): `pop_sms_code`가 빈 우편함에서도 리스를 반납하던 결함 수정 — 반납은 코드를 꺼냈을 때만. 함수 실행 권한을 service_role 로 좁힘. T1 검증 절차 갱신.
> rev 3 (2026-09-11 코드 리뷰): 코드 추출은 `인증번호` **뒤에서** — 앞의 `[2026]`을 코드로 오인하던 결함. `pop`은 리스 보유자만. 2000자 초과는 400이 아니라 조용히 무시(Tasker 재시도 방지). rpc 계약 테스트 추가.
> rev 4 (2026-09-11 보안·DB 리뷰): **발신번호 대조**(`X-Sms-Sender` ↔ `SMS_INGEST_SENDERS`) — 폰 번호만 알면 비밀키 없이 가짜 코드를 넣을 수 있었다. 추출은 `인증번호` **바로 뒤**만(스팸 `[9999]` 차단). 비점유자 `pop`은 0행이 아니라 예외 → 409. 검증 SQL `polname` → `policyname`(Postgres 15·17 실행 검증).
> rev 5 (2026-09-11 리뷰 잔여분): 넣기를 `push_sms_code` 로 — 만료 삭제 + **20행 캡**(inbound 가 만료를 안 지워 행이 무한히 자랄 수 있었다). `p_ttl_sec` null 방어, `set search_path`, 테이블 revoke 에 `public`, 폰 키 32자 하한. `consume` 키 분리(M2)는 보류하고 F14 에 기록.

# Moa 로그인 SMS 인증번호 — 자체 우편함

**질문**: 남의 무료 크레딧에 매달려 있는 2FA 인증번호 중계를, 이미 값을 내고 쓰는 인프라로 어떻게 옮기는가.
**날짜**: 2026-09-11

---

## 1. 왜

Moa 관리자 로그인은 2FA SMS를 요구한다. 자동화(서비스마감 스크랩·경쟁률 점검·정산 탐색)는 그 문자를 사람 없이 읽어야 한다. 지금 경로는 이렇다.

```
폰(Tasker) ──POST──▶ make.com 시나리오 ──▶ make Data Store
                                              ▲
스크래퍼 ─────────────GET (3초마다, 최대 90초)──┘
```

**GET 한 번이 시나리오 실행 한 번이고, 그게 곧 크레딧 한 장이다.** 로그인 한 번에 수십 번 물어보므로 무료 한도(월 1,000 ops)가 월중에 마른다. 실제로 그렇게 됐다.

| 날짜 | 사건 |
|---|---|
| 2026-09-03 | 주 계정 크레딧 소진 → `400 Queue is full.` → 폴링 간격 백오프 도입(`poll_intervals`)으로 실행당 63회→16회로 줄임 |
| 2026-09-07~08 | 백업 시나리오가 본문 없이 `Accepted`만 돌려주는 고장 → 폴링이 90초를 다 쓰고 `baseline 미변경`으로 죽었다. 실패 문구가 원인을 가렸다 |
| 2026-09-07~09 | 마감 스크랩 실패 |

크레딧을 아끼려고 폴링을 늦췄더니 로그인이 느려졌다(코드가 5초에 와도 다음 GET이 20초 뒤). **비용을 아끼는 설계가 품질을 깎고 있다.** Supabase Pro + Vercel은 이미 값을 내고 쓰고 있고, 이 일에 드는 추가 비용은 0이다.

부차적이지만 큰 이득이 하나 더 있다. 지금 신선도 판정은 **baseline-diff**다 — 제출 전에 한 번 읽어 두고(`pick_baseline`), 제출 후 값이 달라지면 새 코드로 본다. 데이터스토어가 "마지막 한 통"만 들고 있고 지울 수가 없어서 생긴 우회로다. 이 방식은 두 번 사고를 냈다(2026-08-06 baseline 조회 실패 → 어제 코드를 새 코드로 오인, 2026-09-07 응답만 오는 백업에 눌러앉음). **내 우편함이면 로그인 시작 전에 비우면 된다.** 비어 있는 곳에 들어온 것은 정의상 새것이다.

---

## 2. 무엇을 만드나

우편함 하나. 폰이 넣고, 스크래퍼가 꺼내면서 지운다.

```
                    ┌──────────────────── Supabase ─────────────────────┐
폰(Tasker)          │                                                   │
  │  문자 수신      │   sms_codes         sms_code_lease                │
  └── POST ────────▶│   (코드만, 10분)    (한 줄, 누가 로그인 중인가)     │
      /api/sms-codes/inbound                                            │
      Bearer SMS_INGEST_SECRET  ── 6자리만 추출해 저장, 본문은 버린다     │
                    │                                                   │
스크래퍼(회사 PC)    │                                                   │
  ① 비우기 ────────▶│  claim_sms_inbox(consumer) → 리스 획득 + 전체 삭제 │
  ② '인증문자 보내기' 클릭                                               │
  ③ 2초마다 꺼내기 ─▶│  pop_sms_code(consumer)   → 최신 1건 삭제+반환     │
      /api/sms-codes/consume                                            │
      Bearer CRON_SECRET                                                │
                    └───────────────────────────────────────────────────┘
```

**폴백**: ① 비우기가 실패하면(서버/DB 장애, 설정 누락) 기존 make 경로로 간다 — `MAKE_SMS_CODE_URL` → `MAKE_SMS_CODE_URL_2`. **1순위가 정상이면 make GET은 0회다.**

> **`donts.md`의 "폴백 로직 금지"와 어긋나지 않는가**: 그 조항은 *graceful degradation* — 실패를 삼켜 반쯤 동작하게 만드는 코드를 금지한다. 여기는 다르다. (a) 사용자가 명시 요청한 이중화다. (b) make 경로는 오늘 프로덕션에서 도는 **검증된 유일 경로**이고, 이번 변경이 그것을 즉시 걷어내면 우편함의 첫 실패가 곧 마감 스크랩 중단이다. (c) 폴백은 **제출 전 한 번만 결정**되고, 결정 후에는 소스를 섞지 않는다(§6). 다시 말해 "무엇으로 읽을지 고르는 분기"이고 "실패를 감추는 재시도"가 아니다. make 제거는 우편함이 한 달 돌아간 뒤 별도 건으로 한다(§11).

---

## 3. 조사로 드러난 것

### 3.1 SMS 소비자는 셋이고, 한 벌을 공유한다

| 스크립트 | SMS 경로 | 추적 |
|---|---|---|
| `scripts/moa-closing/scrape.py` | 원본 — `sms_urls`/`pick_baseline`/`poll_fresh_sms_code` 정의 | ✅ |
| `scripts/moa-ratio/audit.py:141,148` | `scrape.pick_baseline` + `scrape.poll_fresh_sms_code` 직접 호출 | ✅ |
| `scripts/moa-settlement/discover.py:108,113` | `scrape.login_and_2fa` + `sms_urls()` | ✅ |
| `scripts/moa-applyprice/*.py` (3개) | `os.getenv("MAKE_SMS_CODE_URL")` 단독, env 키가 `sms_url`(**단수**) | ❌ 미추적 |

**applyprice 3개는 이미 어긋나 있다.** `login_and_2fa`는 `env["sms_urls"]`(복수)를 읽으므로 그 스크립트들은 지금 실행하면 `KeyError`다. 이중화 도입(9월 초) 때 따라가지 못한 일회용 스크립트다. **이번에 손대지 않는다** — 추적 대상이 아니고, 고치면 "SMS 경로 교체" PR이 "미추적 스크립트 복구"까지 끌어안는다(`donts.md` Surgical Change). 되살릴 때 env 키를 맞춰야 한다는 사실만 남긴다.

→ **공유 모듈로 뽑는다.** 단, `scrape.py`에 넣지 않는다. 그 파일은 **이미 836줄로 상한(800줄)을 넘겼고**, 우편함 클라이언트는 selenium과 결합이 없는 순수 HTTP 코드다. `scripts/moa-closing/sms_inbox.py`를 새로 만든다 — `audit.py`가 이미 `scripts/moa-closing`을 `sys.path`에 넣으므로(`audit.py:44`) 세 호출자 모두 import 비용이 0줄이다.

### 3.2 동시 소비는 코드로 막을 수 없다 — 로그인을 막아야 한다

서비스마감(09:00 스케줄)과 경쟁률 점검(수동 트리거, 폴러가 5분 내 claim)이 겹칠 수 있다. 우편함 모델에서 겹치면:

1. A가 비우고 제출 → Moa가 SMS① 발송
2. B가 비운다 — **A의 SMS①이 아직 안 왔거나, 왔다가 B의 비우기에 지워진다**
3. B가 제출 → SMS②. Moa는 코드를 재발급할 때 이전 코드를 무효화한다
4. 둘 다 폴링 → 우편함에 ②만 있다 → **A가 ②를 꺼내 가면 B는 굶고, A는 무효 코드로 시도한다**

**문자에는 누구 것인지가 적혀 있지 않다.** 수신 시각도 소용없다 — 두 요청이 10초 안에 들어오면 시각으로 가를 수 없다. 그래서 "요청자 표식"은 원리적으로 불가능하다(표식을 붙일 주체는 폰이고, 폰은 누가 눌렀는지 모른다).

결과가 가볍지 않다. 틀린 코드 제출 → Moa 로그인 실패 → **캡차 노출** → `scrape.py:25` 주석대로 *"헤드리스가 1회라도 실패하면 캡차로 잠김"* → **Moa 자동화 전체가 사람 손을 기다린다.**

| 안 | 내용 | 판정 |
|---|---|---|
| A. 요청자 표식 | 코드에 소비자 꼬리표 | **불가**. 폰이 알 수 없다 |
| B. 수신 시각 조건 | 내 비우기 시각 이후 도착분만 꺼낸다 | **부족**. 상대의 비우기가 내 코드를 지운다. 두 로그인이 그대로 진행돼 캡차 위험이 남는다 |
| C. 로그인 리스(직렬화) | 비우기 = 점유 획득. 이미 점유 중이면 **409로 중단** | **채택** |
| D. 큐 단일화 | 두 잡을 한 큐로 합쳐 폴러가 직렬 실행 | 과함. `closing`은 큐를 안 쓰고 작업 스케줄러가 직접 돈다 — 큐 편입은 별개의 큰 변경 |

**C를 고른 이유**: 선례가 이미 있다. `features/ratio-audit/audit-requests/enqueue.ts:56`이 *"종류가 달라도 동시에 실행하지 않는다 — 둘 다 Moa 로그인을 타므로 겹치면 세션이 충돌한다"*고 같은 판단을 해뒀다. 그 정책은 `ratio_audit_requests` 큐 **안에서만** 유효해서 마감 스크랩과의 충돌은 못 막는다. 리스를 우편함에 두면 **소비자가 몇이든 한 곳에서 막힌다.** 비용은 테이블 한 줄 + 함수 하나이고, 비우기 호출에 얹으므로 왕복이 늘지 않는다.

**409는 make로 우회하지 않고 중단한다.** 우회하면 B의 로그인이 진행돼 SMS②가 발송되고, 폰은 **두 창구 모두에** 넣으므로 A의 우편함에 ②가 섞인다. 리스가 막으려던 바로 그 상황을 폴백이 되살린다.

### 3.3 새 CRON_SECRET 창구는 두 군데에 등록해야 한다

`proxy.ts`의 `PUBLIC_PATHS`에 없으면 **307로 `/login`에 돌려보낸다.** 라우트는 멀쩡한데 호출자는 리다이렉트만 받는다 — 타입 검사도 테스트도 못 잡고 배포 후에야 드러난다. 심박(`/api/pollers/heartbeat`)이 그렇게 걸렸다(2026-08-21). 그 사고 뒤 회귀 테스트 두 개가 생겼고(`src/__tests__/proxy-cron-paths.test.ts`, `src/proxy.test.ts`), **둘 다 갱신해야 한다**(T4).

### 3.4 새 RPC는 스키마 리로드가 필요하다

`claim_sms_inbox`/`pop_sms_code`를 만든 뒤 PostgREST 스키마 캐시를 갱신하지 않으면 `supabase-js`의 `.rpc()`가 **404**를 돌려준다. `20260602c_operator_ms_tokens.sql:29`가 이미 `notify pgrst, 'reload schema';`를 넣어두는 관례를 만들어 놨다. 마이그레이션 끝에 넣는다.

---

## 4. 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 저장 내용 | **6자리 코드만.** 본문은 저장도 로깅도 안 한다 | 폰이 보내는 것은 문자 원문이다. 개인 문자가 섞여 들어올 수 있고, 인증번호는 흘려도 10분이면 죽지만 문자 본문은 안 죽는다 |
| 인증문자 판정 | 본문에 `인증\s*번호`가 **있고** 대괄호 숫자 4~8자리가 있을 때만 | 게이트 둘. Tasker 내용 필터가 앞에서, 서버 규칙이 뒤에서 막는다. 광고문자의 `[2026]` 같은 것이 우편함에 앉으면 다음 로그인이 그걸 꺼낸다 |
| 대괄호 없는 폴백 | **안 넣는다** | Moa 포맷은 라이브로 확정됐다(`[Web발신][내부관리자] 본인확인 인증번호는 [123456] 입니다.`). 느슨한 정규식은 전화번호·금액을 코드로 저장한다. 포맷이 바뀌면 **우편함이 비는 것으로 시끄럽게 실패**하는 편이 낫다 |
| 폰 → 서버 본문 형식 | **`text/plain` 원문** | Tasker에서 JSON을 조립하면 `%SMSRB`를 문자열로 끼워 넣는 것이고, 문자에 `"`나 줄바꿈이 있으면 JSON이 깨진다. 그 실패는 새벽에 400으로 조용히 난다. 서버는 `request.text()`로 받아 zod로 길이만 본다 |
| 수신 시각 | **서버가 찍는다**(`default now()`) | 폰 시각을 받으면 폰의 시계·로케일·Tasker 변수 포맷(`%SMSRD`/`%SMSRT`)에 우편함 정확성이 묶인다. 우리가 쓰는 유일한 용도는 "최신 1건"이고 그건 서버 시각으로 충분하다 |
| 꺼내는 순서 | **최신(received_at desc) 1건**, 꺼내면서 삭제 | Moa는 재발급 시 이전 코드를 무효화한다. 두 통이 들어와 있으면 오래된 쪽이 죽은 코드다 |
| 만료 | **10분. cron 없음** | `pop`·`inbound` 양쪽이 호출될 때마다 만료분을 먼저 지운다. 비우기가 매 로그인 전에 전체 삭제하므로 테이블은 상시 0~2행이다. cron을 하나 더 등록하면 그게 곧 죽는 지점이 된다(`20260904_dev_control_specs.sql:5`가 같은 판단) |
| 인덱스 | **없음** | 행이 2개인 테이블은 seq scan이 인덱스보다 빠르다. PK만 둔다 |
| RLS | enable + **정책 0개** + `revoke all from anon, authenticated` | `operator_ms_tokens` 선례. 인증번호는 화면에 그릴 일이 없다 — 읽는 주체는 서버뿐 |
| 폰 비밀키 | `SMS_INGEST_SECRET` — `CRON_SECRET`과 **분리** | 폰은 분실·초기화되고 Tasker 설정은 평문이다. 분리해 두면 그때 이 창구만 교체하면 되고, 마감 인제스트·폴러·자동화 전부를 갈아치울 필요가 없다 |
| 동시 소비 | 로그인 리스(§3.2 C안). TTL 180초 | 폴링 상한 90초 + 여유. 같은 consumer의 재획득은 통과시켜 재시도가 자기 리스에 막히지 않게 한다 |
| pop 은 점유자만 | 리스 보유자가 아닌 소비자의 `pop`은 **예외**(`lock_not_available`) → 라우트 **409** | 409로 막힌 소비자가 그대로 `pop`을 부르면 남의 코드를 가져가고 리스는 남는다. 리스는 '들어가지 마라'가 아니라 '꺼내지 마라'여야 한다(코드 리뷰). 0행이 아니라 예외인 이유: 0행은 '아직 안 왔다'와 구분이 안 돼 90초를 태운다(DB 리뷰). 반납 뒤 재호출도 409 — 클라이언트는 코드를 받으면 멈춘다 |
| 발신번호 대조 | 서버가 `X-Sms-Sender`를 `SMS_INGEST_SENDERS` 허용 목록과 **비교만** 한다(숫자만). 저장·에코 없음. 목록이 비면 **500으로 닫힌다** | 폰은 아무나 문자를 보낼 수 있는 수신함이다. 본문만 보면 운영자 폰 번호를 아는 사람이 Moa 문구를 흉내 내 **비밀키 없이** 가짜 코드를 넣고, 그 끝은 캡차 잠금이다(보안 리뷰 H1). '설정 없으면 전부 통과'는 설정 누락이 창구를 여는 자리라 두지 않는다 |
| 리스 반납 | **코드를 실제로 꺼낸 `pop`에서만** 반납 + TTL 만료. **명시 release 없음** | 빈 우편함에 온 pop(폴링 첫 회)에서 반납하면 코드가 오기 전에 리스가 풀린다. 실패 경로만을 위한 호출을 더하지 않는다 — 로그인이 실패했으면 이미 사람이 볼 일이고, 최악의 대기는 3분이다 |
| 폴백 결정 시점 | **제출 전 한 번.** 폴링 중 소스 전환 없음 | 90초 쓰고 다시 90초를 쓰면 그 사이 Moa 코드가 만료된다. 섞으면 안 된다는 교훈이 이미 두 번 났다(2026-08-06, 09-07) |
| 폴링 간격 | 우편함은 **2초 고정** | 백오프는 make 크레딧을 아끼려고 만든 것이다(`test_poll_backoff.py`). 우편함에는 비용이 없으므로 촘촘히 본다 — 로그인이 지금보다 **빨라진다** |
| 새 도메인 위치 | `src/features/sms-codes/` | 소비자가 셋이라 `features/closing/`에 두면 경쟁률 점검이 마감 도메인에 의존하는 모양이 된다. `features/mail-sends/` 추출과 같은 근거 |
| python 위치 | `scripts/moa-closing/sms_inbox.py` **신규 모듈** | §3.1 |
| 제거되는 코드 | **이번엔 없다** | 아래 |

### baseline은 이번에 지워지지 않는다

"`pick_baseline`이 필요 없어진다"는 **우편함 경로에 한해** 맞다. make를 폴백으로 남기는 동안 `pick_baseline`/`fetch_baseline_code`/`poll_fresh_sms_code`/`poll_intervals`과 그 테스트 3종은 **살아 있는 코드**다. 지금 지우면 폴백이 폴백이 아니다.

make 제거(별도 건) 때 함께 사라질 목록을 미리 적어 둔다:

- `scrape.py` — `sms_urls` · `pick_baseline` · `fetch_baseline_code` · `fetch_sms_code` · `_fetch_sms_body` · `poll_fresh_sms_code` · `poll_intervals` · `SMS_CODE_PATTERN`
- `test_sms_failover.py` · `test_sms_baseline.py` · `test_poll_backoff.py` (전부)
- env `MAKE_SMS_CODE_URL` · `MAKE_SMS_CODE_URL_2` · `MOA_SMS_CODE_REGEX` · `MOA_SMS_POLL_INTERVAL_SEC`
- `scripts/moa-settlement/run-discover.ps1:31-33`의 `MAKE_SMS_CODE_URL_2` 주입
- Tasker의 make 프로필

---

## 5. 스키마와 API

### 5.1 마이그레이션 — `supabase/migrations/20260911_sms_code_inbox.sql`

```sql
-- Moa 로그인 SMS 인증번호 자체 우편함.
-- 설계: docs/superpowers/specs/2026-09-11-sms-code-inbox-design.md
--
-- 폰(Tasker)이 넣고, 스크래퍼가 꺼내면서 지운다. 서버 전용 — 화면에 그릴 일이 없다.
-- ⚠️ 본문은 저장하지 않는다. 서버가 6자리만 추출해 넣는다.

begin;

create table if not exists public.sms_codes (
  id           uuid primary key default gen_random_uuid(),
  code         text not null check (code ~ '^[0-9]{4,8}$'),
  -- 폰 시각을 받지 않는다 — 폰 시계·로케일에 우편함 정확성을 묶지 않기 위함.
  received_at  timestamptz not null default now()
);

-- 인덱스를 두지 않는다: 비우기가 매 로그인 전에 전체 삭제하므로 상시 0~2행이다.

-- 로그인 점유 — 한 줄만 존재한다(id=1 고정). 소비자가 둘 이상 동시에 Moa 로그인에
-- 들어가면 SMS 두 통이 한 우편함에 섞여 서로의 코드를 꺼내 간다. 틀린 코드 제출은
-- 캡차 잠금으로 이어져 Moa 자동화 전체를 세운다(scrape.py 헤더 주석).
create table if not exists public.sms_code_lease (
  id           smallint primary key default 1 check (id = 1),
  consumer     text not null,
  acquired_at  timestamptz not null default now()
);

alter table public.sms_codes       enable row level security;
alter table public.sms_code_lease  enable row level security;
-- 정책 0개 = 전면 거부. 읽는 주체는 서버(service_role)뿐이다.
revoke all on public.sms_codes      from public, anon, authenticated;
revoke all on public.sms_code_lease from public, anon, authenticated;
grant all on public.sms_codes       to service_role;
grant all on public.sms_code_lease  to service_role;

-- 폰이 넣는다. 넣으면서 만료분을 지우고 최신 20행만 남긴다 — 스크래퍼가 안 도는
-- 주말이나 키 유출 시 행이 무한히 자라 프로젝트 전체가 읽기전용이 되는 것을 막는다
-- (보안 리뷰 M1). 정상 문자는 항상 들어가고, 밀려나는 것은 이미 죽은 코드다.
create or replace function public.push_sms_code(p_code text)
returns void
language plpgsql
set search_path = public, pg_temp
as $$
begin
  delete from public.sms_codes where sms_codes.received_at < now() - interval '10 minutes';
  insert into public.sms_codes (code) values (p_code);
  delete from public.sms_codes
   where sms_codes.id not in (
     select s.id from public.sms_codes s order by s.received_at desc limit 20
   );
end;
$$;

-- 비우기 + 점유 획득. 한 호출로 묶는 이유: 점유를 못 잡았는데 남의 코드를 지우면
-- 상대가 굶는다. 순서가 아니라 원자성이 필요하다.
create or replace function public.claim_sms_inbox(p_consumer text, p_ttl_sec int)
returns table (acquired boolean, holder text, holder_since timestamptz, cleared int)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_ok boolean := false;
  v_cleared int := 0;
begin
  insert into public.sms_code_lease as l (id, consumer, acquired_at)
  values (1, p_consumer, now())
  on conflict (id) do update
    set consumer = excluded.consumer, acquired_at = excluded.acquired_at
    -- 같은 소비자의 재획득은 통과시킨다 — 재시도가 자기 리스에 막히면 안 된다.
    where l.consumer = excluded.consumer
       -- null 이 오면 만료 경로가 영영 안 열린다 — 사람이 지울 때까지 전면 정지(DB 리뷰).
       or l.acquired_at < now() - make_interval(secs => coalesce(p_ttl_sec, 180))
  returning true into v_ok;

  if v_ok is not true then
    return query
      select false, l.consumer, l.acquired_at, 0
      from public.sms_code_lease l where l.id = 1;
    return;
  end if;

  delete from public.sms_codes;
  get diagnostics v_cleared = row_count;
  return query select true, p_consumer, now(), v_cleared;
end;
$$;

-- 꺼내며 삭제. 만료분을 먼저 지우는 이유: 그것이 '최신'으로 뽑히면 죽은 코드를
-- 제출하게 된다. 만료 규칙을 이 함수 하나에 둔다(cron 불필요).
create or replace function public.pop_sms_code(p_consumer text)
returns table (code text, received_at timestamptz)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_code     text;
  v_received timestamptz;
  v_holder   text;
begin
  -- 점유자만 꺼낸다. 리스는 '들어가지 마라'가 아니라 '꺼내지 마라'여야 한다 —
  -- 409 로 막힌 소비자가 그대로 pop 을 부르면 남의 코드를 가져가고 리스는 남는다.
  -- 0행이 아니라 예외인 이유: 0행은 '아직 안 왔다'와 구분이 안 돼 폴러가 90초를
  -- 태우고 원인을 가리는 문구로 죽는다(2026-09-07 'baseline 미변경' 사고와 같은 꼴).
  select l.consumer into v_holder from public.sms_code_lease l where l.id = 1;
  if v_holder is distinct from p_consumer then
    raise exception 'sms inbox lease not held by % (holder=%)',
      p_consumer, coalesce(v_holder, '(none)')
      using errcode = 'lock_not_available';
  end if;

  delete from public.sms_codes where sms_codes.received_at < now() - interval '10 minutes';

  delete from public.sms_codes
   where sms_codes.id = (
     select s.id from public.sms_codes s order by s.received_at desc limit 1
   )
  returning sms_codes.code, sms_codes.received_at into v_code, v_received;

  -- 점유 반납은 **꺼냈을 때만**. 빈 우편함에 온 pop 에서 반납하면 폴링 첫 회(코드
  -- 도착 전)에 리스가 풀려, 남은 90초 동안 다른 소비자가 들어와 우편함을 비운다 —
  -- 리스가 막으려던 바로 그 창이다(설계 리뷰에서 잡음, 2026-09-11).
  if v_code is not null then
    delete from public.sms_code_lease where sms_code_lease.consumer = p_consumer;
    return query select v_code, v_received;
  end if;
end;
$$;

-- 함수는 기본이 PUBLIC 실행 가능이다. invoker 권한이라 anon 이 불러도 테이블에서
-- 막히지만, 그 우연에 기대지 않는다 — 실행 권한도 service_role 로 좁힌다.
-- ⚠️ revoke 는 **시그니처 단위**다. 나중에 인자를 추가하면 create or replace 가 아니라
-- 새 오버로드가 되고, 그것은 다시 PUBLIC 실행 가능으로 태어난다 — 이 블록을 같이 고칠 것.
revoke execute on function public.push_sms_code(text)         from public, anon, authenticated;
revoke execute on function public.claim_sms_inbox(text, int) from public, anon, authenticated;
revoke execute on function public.pop_sms_code(text)          from public, anon, authenticated;
grant  execute on function public.push_sms_code(text)         to service_role;
grant  execute on function public.claim_sms_inbox(text, int) to service_role;
grant  execute on function public.pop_sms_code(text)          to service_role;

-- 새 함수는 스키마 캐시를 갱신하지 않으면 .rpc() 가 404 를 돌려준다.
notify pgrst, 'reload schema';

commit;

-- 검증은 T1 참조 (빈 pop 이 리스를 반납하지 않는 것까지 본다).
```

### 5.2 API 계약 ① 폰 → 서버

```
POST /api/sms-codes/inbound
Authorization: Bearer ${SMS_INGEST_SECRET}
X-Sms-Sender: 0212345678            ← Tasker %SMSRF. 서버가 허용 목록과 비교만 한다
Content-Type: text/plain; charset=utf-8

[Web발신][내부관리자] 본인확인 인증번호는 [123456] 입니다.
```

| 상태 | 본문 | 언제 |
|---|---|---|
| 200 | `{"ok":true,"stored":true}` | 코드 추출 성공 → 저장 |
| 200 | `{"ok":true,"stored":false}` | 인증문자가 아니다 **또는 2000자 초과** → **조용히 무시**(Tasker가 재시도하지 않게 2xx). 초과를 400으로 주면 재시도할 때마다 그 개인 문자가 다시 온다 |
| 200 | `{"ok":true,"stored":false}` | 발신번호가 허용 목록에 없거나 헤더가 없다 → 조용히 무시. 번호는 저장·에코하지 않는다 |
| 400 | `{"ok":false,"error":"empty body"}` | 본문 없음 — Tasker 설정 오류라 고쳐야 할 것 |
| 401 | `{"ok":false,"error":"unauthorized"}` | 키 불일치 |
| 500 | `{"ok":false,"error":"SMS_INGEST_SECRET 미설정 또는 32자 미만"}` / `"SMS_INGEST_SENDERS 미설정"` / DB 오류 메시지 | 둘 중 하나라도 비면 창구는 닫힌다. 키가 32자 미만이어도 닫힌다 — `test` 같은 값으로 열리면 안 된다 |

**본문은 응답에도 로그에도 싣지 않는다.** 오류 메시지에 원문을 에코하면 개인 문자가 Vercel 로그에 남는다.

### 5.3 API 계약 ② 스크래퍼 → 서버

경로 하나에 action 둘. `/api/closing/scrape-request`가 한 경로에서 claim/보고를 모두 처리하는 선례와 같은 모양이고, `PUBLIC_PATHS` 항목도 하나로 끝난다.

```
POST /api/sms-codes/consume
Authorization: Bearer ${CRON_SECRET}
Content-Type: application/json

{"action":"reset","consumer":"closing"}      // 비우기 + 점유
{"action":"pop","consumer":"closing"}        // 꺼내며 삭제 + 점유 반납
```

| action | 상태 | 본문 |
|---|---|---|
| reset | 200 | `{"ok":true,"cleared":1}` |
| reset | 409 | `{"ok":false,"error":"lease-held","holder":"ratio-audit","holderSince":"2026-09-11T09:00:12+09:00"}` |
| pop | 200 | `{"ok":true,"code":"123456","receivedAt":"…"}` |
| pop | 200 | `{"ok":true,"code":null}` — 아직 안 왔다. 호출자가 계속 기다린다 |
| pop | 409 | `{"ok":false,"error":"lease-not-held"}` — 점유자가 아니다(반납 뒤 재호출 포함). 호출자는 멈춘다 |
| 둘 다 | 400 | `{"ok":false,"error":"알 수 없는 consumer: closng"}` / zod 메시지 |
| 둘 다 | 401 | `{"ok":false,"error":"unauthorized"}` |

`consumer` 오타를 400으로 막는다 — 심박 창구가 등록되지 않은 폴러 id를 거절하는 것과 같은 이유다(`pollers/heartbeat/route.ts:36`: *"오타가 조용히 새 행을 만들면 화면에 유령이 생긴다"*). 리스는 이름으로 구분되므로 오타 하나가 **점유를 무력화**한다.

### 5.4 zod — `src/features/sms-codes/schemas.ts`

```ts
/** 우편함을 쓰는 스크래퍼. 리스가 이름으로 구분되므로 오타를 400으로 막는다. */
export const SMS_CONSUMERS = ["closing", "ratio-audit", "settlement-discover"] as const;

export const smsConsumeSchema = z.object({
  action: z.enum(["reset", "pop"]),
  consumer: z.enum(SMS_CONSUMERS),
});
```

폰 본문은 zod 를 거치지 않는다 — 문자열 하나에 길이 검사 둘(빈 본문 400 · 2000자 초과 무시)이라 라우트 상수로 충분하다. 코드 모양(`^[0-9]{4,8}$`)은 추출 정규식과 DB check 제약이 지킨다.

`src/features/sms-codes/rpc.ts` — rpc 이름·인자 빌더(`pushArgs`/`claimArgs`/`popArgs`)·반환 컬럼 목록. **`rpc.test.ts` 가 마이그레이션 SQL 원문을 읽어 파라미터 이름·반환 컬럼과 대조한다** — 라우트 테스트는 mock 에 대고 단언하므로 이름이 어긋나도 초록인 채로 프로덕션에서 500 이 나기 때문이다.

`src/features/sms-codes/extract-code.ts`

```ts
/** 인증문자인가, 코드는 무엇인가. 둘을 한 함수가 답한다 — null 이면 인증문자가 아니다. */
export function extractSmsCode(body: string): string | null;
```

규칙: `/인증\s*번호[는은]?\s*\[([0-9]{4,8})\]/` — `인증번호` **바로 뒤**에 붙은 대괄호만. 그 밖은 `null`. 본문 아무 데나 있는 대괄호를 잡으면 두 방향으로 틀린다: `[2026] 신년 이벤트 인증번호는 [130753]`에서 `2026`을 저장하고(→ 캡차 잠금), `[광고] 인증번호 이벤트 [9999]` 같은 스팸이 코드로 앉는다(코드·보안 리뷰 지적).

### 5.5 `proxy.ts`

```ts
/** /api/sms-codes/inbound — 폰(Tasker)이 문자 본문을 넣는다. SMS_INGEST_SECRET.
 *  /api/sms-codes/consume — 스크래퍼가 비우고 꺼낸다. CRON_SECRET. */
"/api/sms-codes/inbound",
"/api/sms-codes/consume",
```

접두사 매칭이므로 `/api/sms-codes`를 통째로 넣지 않는다 — 그러면 이 아래 새 라우트가 자동으로 공개된다(`/api/assistant/tools`에 달린 경고와 같은 이유).

---

## 6. 스크래퍼 변경 (python)

### 6.1 신규 — `scripts/moa-closing/sms_inbox.py`

```python
INBOX_TTL_SEC = 180          # 리스 TTL. 폴링 상한 90초 + 여유
INBOX_POLL_INTERVAL_SEC = 2  # 비용이 없으므로 촘촘히 본다

class SmsSource(NamedTuple):
    kind: str              # "inbox" | "make"
    url: str = ""          # make 일 때만
    baseline: str | None = None  # make 일 때만

def mask_code(code: str) -> str
    """로그에 전체 코드를 남기지 않는다. '****34'."""

def reset_inbox(base_url: str, secret: str, consumer: str) -> int
    """비우기 + 점유. 지운 건수 반환.
    409 → LeaseHeldError (호출부가 중단한다).
    그 밖의 실패 → InboxUnavailable (호출부가 make 로 넘어간다).
    """

def poll_inbox_code(base_url, secret, consumer, timeout_sec) -> str
    """2초마다 pop. 타임아웃이면 RuntimeError — 문구에 '우편함'을 넣는다."""
```

두 예외를 가르는 것이 핵심이다. **`LeaseHeldError`는 폴백 대상이 아니다**(§3.2). `InboxUnavailable`만 make로 간다.

### 6.2 `scrape.py` — 호출부 2줄 교체

기존:

```python
sms_url, baseline = pick_baseline(env["sms_urls"])
driver.find_element(...).click()
_wait_login_accepted(driver)
code = poll_fresh_sms_code(sms_url, baseline, env["sms_timeout"], env["sms_interval"])
```

이후:

```python
source = prepare_sms_source(env)          # 제출 전: 우편함 비우기 or make baseline
driver.find_element(...).click()
_wait_login_accepted(driver)
code = await_sms_code(source, env)        # 제출 후: 고른 소스에서만 기다린다
```

`prepare_sms_source(env)` (scrape.py, ~20줄):

```
env 에 base_url/secret/sms_consumer 가 있으면
    reset_inbox() 시도
        성공        → SmsSource("inbox")            [INFO] SMS 소스: 우편함 (비움 N건)
        LeaseHeld   → raise RuntimeError            [FAIL] 다른 스크래퍼가 Moa 로그인 중 …
        Unavailable → 아래로                        [WARN] 우편함 준비 실패 — make 로 넘어갑니다: {이유}
pick_baseline(env["sms_urls"]) → SmsSource("make", url, baseline)
```

`await_sms_code(source, env)` (scrape.py, ~8줄): `inbox` → `poll_inbox_code(...)`, `make` → 기존 `poll_fresh_sms_code(...)`.

그 외 `scrape.py` 변경:

- `main()`의 env dict에 `"sms_consumer": "closing"` 추가. `base_url`/`secret`은 이미 있다
- **`missing` 검사에 `sms_urls`를 계속 남긴다** — 우편함이 죽었을 때 폴백이 있는지 시작 전에 알아야 한다
- `post_run_log` 성공 메시지에 소스를 붙인다: `적재 430건 (SMS: 우편함)` / `(SMS: make)`. **폴백이 조용히 일어나면 크레딧이 계속 타는데 아무도 모른다.** 이 문자열이 `closing_scrape_runs`와 `automation_runs`에 남아 일일 보고에 실린다
- `poll_fresh_sms_code`의 인라인 마스킹을 `mask_code()` 호출로 바꾼다 (같은 표현이 3곳이 되는 것을 막는 1줄 변경. 그 외 make 경로는 건드리지 않는다)

### 6.3 `scripts/moa-ratio/audit.py`

`login_and_2fa` 안 2줄을 같은 형태로 바꾸고(`manual_code_file` 분기는 그대로 — 명시적 수동 입력 경로다), `main()`의 env에 `"sms_consumer": "ratio-audit"` + `base_url`/`secret`(이미 `fetch_targets`용으로 있다)을 넘긴다.

### 6.4 `scripts/moa-settlement/discover.py`

env에 3키(`base_url`/`secret`/`sms_consumer": "settlement-discover"`)를 추가한다. `.env.local`을 scrape.py가 이미 로드하므로 `os.getenv`로 읽힌다. 3줄.

### 6.5 로그 문구

```
[INFO] SMS 소스: 우편함 (Supabase) — 비움 0건
[WARN] 우편함 준비 실패 — make 웹훅으로 넘어갑니다: HTTPError 500
[FAIL] 다른 스크래퍼가 Moa 로그인 중입니다 (ratio-audit, 09:00:12 점유) — 중단
[OK]   우편함에서 인증번호 수신 (…****34, 7초 대기)
[FAIL] 우편함 대기 타임아웃 (90s) — 문자가 도착하지 않았습니다. 폰 Tasker 확인 필요
```

마지막 문구가 특히 중요하다. 2026-09-07 실패가 `baseline 미변경`으로 찍혀 **원인(코드를 못 받았다)이 가려졌다.** 실패 문구는 다음에 볼 사람이 어디를 볼지 알려줘야 한다.

---

## 7. 폰·env·비밀키

### 7.1 비밀키 생성

```powershell
[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 7.2 env 추가

| 어디 | 키 | 값 |
|---|---|---|
| Vercel (Production) | `SMS_INGEST_SECRET` | 위 64자 hex. **32자 미만이면 창구가 닫힌다** |
| Vercel (Production) | `SMS_INGEST_SENDERS` | Moa 인증문자 **발신번호**(쉼표 구분 복수 가능, 숫자만 비교). 폰의 Moa 문자 대화에서 본다. **비어 있으면 창구가 500으로 닫힌다** |
| 회사/집 PC `.env.local` | — | **추가 없음.** `CRON_SECRET`·`OPS_CONSOLE_BASE_URL`이 이미 있다 |
| 폰 Tasker | — | URL + `SMS_INGEST_SECRET`을 직접 입력 |

킬 스위치 env는 두지 않는다. 전환이 마지막 커밋 하나(T8)이므로 되돌리기 = 그 커밋 revert다. 설정 하나를 더 두면 "껐다고 믿은 채로 도는" 자리가 하나 더 생긴다.

### 7.3 Tasker

**기존 make 프로필은 지우지 않는다.** 전환 기간에는 문자 한 통이 두 곳으로 간다 — 그게 폴백이 실제로 동작하는 조건이다.

- **Profile**: Event → Phone → Received Text
  - Type: `Any`
  - Sender: **Moa 발신번호** — 1차 게이트. 개인 문자가 서버에 닿는 경로가 아예 없어진다
  - Content: `*인증번호*` — 2차 게이트
- **Task → Net → HTTP Request**
  - Method: `POST`
  - URL: `https://<OPS 도메인>/api/sms-codes/inbound`
  - Headers (줄바꿈 구분):
    ```
    Authorization:Bearer <SMS_INGEST_SECRET>
    X-Sms-Sender:%SMSRF
    Content-Type:text/plain; charset=utf-8
    ```
    `%SMSRF` 는 발신번호. 서버가 `SMS_INGEST_SENDERS` 와 숫자만 비교한다 — 3차 게이트
  - Body: `%SMSRB`  ← **원문 그대로. JSON 조립 금지**(§4)
  - Timeout: 30
- 확인: 자기 폰으로 `인증번호는 [123456] 입니다` 문자를 보내고 → `pop`으로 `123456`이 나오는지 본다

---

## 8. 실패 모드

| # | 상황 | 어떻게 드러나는가 | 어디로 가는가 |
|---|---|---|---|
| F1 | **폰 오프라인·Tasker 죽음** | `[FAIL] 우편함 대기 타임아웃 (90s)` → 실행 실패 → `automation_runs` 실패 즉시 Teams 알림 + 일일 보고 | **폴백 없음.** make도 같은 폰이 원천이라 비어 있다. 이 경로만은 사람이 폰을 봐야 한다 |
| F2 | **인증문자 미도착**(Moa 미발송) | 위와 동일 문구 | 없음. 단 `_wait_login_accepted`가 자격증명 오류를 **폴링 전에** 잡아내므로 90초를 헛되게 쓰지 않는다 |
| F3 | **코드 2개 연속 수신**(버튼 두 번, Moa 재발송) | 드러나지 않는다 — `pop`이 최신 1건만 꺼내고 나머지는 만료로 지워진다(consume 계약이 잔여 건수를 주지 않아 로그 없음, rev 6) | 최신을 꺼낸다. Moa가 재발급 시 이전 코드를 무효화하므로 최신이 정답 |
| F4 | **시계 어긋남**(폰 시각 오차) | 드러나지 않는다 — **영향이 없다** | 폰 시각을 받지 않는다. `received_at`은 서버 `now()` |
| F5 | **Supabase 장애 / DB 오류** | `[WARN] 우편함 준비 실패 — make 웹훅으로 넘어갑니다: …` | **make 1순위 → 2순위.** 이번 설계의 폴백이 값을 하는 유일한 칸. 단 make 경로에는 리스가 없어 마감·경쟁률이 **동시에** 폴백하면 §3.2 의 겹침 창이 다시 열린다(보안 리뷰 M3) — PR B 이전과 같은 상태이고, 경쟁률은 수동 트리거라 실제 겹침은 사람이 09:00 에 누를 때뿐. 로컬 락파일은 필요해지면 |
| F6 | **make까지 죽음**(크레딧 소진 + 우편함 장애) | `SMS 웹훅 N곳 모두 응답 없음 — 중단` (기존 문구) | 없음. 실행 실패 |
| F7 | **리스 점유 중**(마감 ↔ 경쟁률 동시) | `[FAIL] 다른 스크래퍼가 Moa 로그인 중입니다 (…)` | **중단.** 폴백하면 SMS 두 통이 섞여 캡차 위험이 되살아난다(§3.2). 경쟁률은 수동 트리거라 다시 누르면 된다 |
| F8 | **폴러가 pop 전에 죽음**(PC 종료) | 리스가 남는다 | TTL 180초 후 자동 해제. 다음 실행이 막히는 최악 대기 3분 |
| F9 | **`SMS_INGEST_SECRET` 유출**(폰 분실) | 우편함에 임의 코드가 들어온다 → 다음 로그인이 틀린 코드 제출 → **캡차 잠금**. 발신번호 헤더는 HTTP 요청자가 쓰는 값이라 키를 가진 자는 위조한다 — F13의 방어는 여기 안 통한다 | Vercel에서 그 키만 교체 + Tasker 재입력. `CRON_SECRET`은 건드리지 않는다 — 분리의 값이 여기서 나온다 |
| F13 | **운영자 폰으로 Moa 문구를 흉내 낸 문자**(비밀키 불필요, 폰 번호만 알면 됨) | 드러나지 않는다 — Tasker Sender 필터에서 떨어지고, 통과해도 서버가 발신번호 불일치로 `stored:false` | 없음(정상). 발신번호 위조(spoofing)는 발신번호 사전등록제 때문에 국내에선 어렵다 |
| F14 | **`CRON_SECRET` 유출** | 로그인 90초 창 안에서 `pop`을 부르면 코드를 읽고, `reset`을 반복하면 리스를 점거해 모든 스크래퍼가 409 | 키 교체. Moa 자격증명은 별도 env 라 코드만으로는 로그인 못 한다. `consume` 전용 키 분리는 **보류**(보안 리뷰 M2) — PC 2대 env 가 늘어 누락 시 조용히 make 로 새는 자리(R2)가 생기고, `CRON_SECRET` 은 이미 적재·폴러·자동화 전체를 쥔 키라 여기서 얻는 격리가 작다 |
| F10 | **광고문자가 게이트를 통과** | 우편함에 숫자 1건 | 게이트 둘(Tasker 내용 필터 + `인증번호`+대괄호)을 모두 통과해야 하고, 비우기가 매 로그인 전에 지우므로 90초 창에 정확히 걸려야 한다 |
| F11 | **`PUBLIC_PATHS` 누락** | 스크래퍼가 307을 받고 `reset`이 JSON 파싱에서 죽는다 | T4의 회귀 테스트 2개가 배포 전에 잡는다(§3.3) |
| F12 | **RPC 스키마 캐시 미갱신** | `.rpc()` 404 → 우편함 준비 실패 → make로 폴백(조용히 크레딧을 태운다) | `notify pgrst`(§3.4) + run-log의 `(SMS: make)` 표기가 드러낸다 |

---

## 9. 영향 파일

### 신규 (14)

| 파일 | 역할 |
|---|---|
| `supabase/migrations/20260911_sms_code_inbox.sql` | 테이블 2 + 함수 2 + RLS/GRANT |
| `src/features/sms-codes/schemas.ts` | zod + `SMS_CONSUMERS` |
| `src/features/sms-codes/extract-code.ts` | 인증문자 판정 + 코드 추출 |
| `src/features/sms-codes/rpc.ts` | rpc 이름·인자 빌더·반환 컬럼 |
| `src/features/sms-codes/__tests__/rpc.test.ts` | 마이그레이션 SQL 시그니처 ↔ 라우트 인자 대조 |
| `src/features/sms-codes/__tests__/extract-code.test.ts` | Moa 실문자 / 광고 / 전화번호 / 포맷 변형 |
| `src/features/sms-codes/__tests__/schemas.test.ts` | consumer 오타 · action · 길이 |
| `src/app/api/sms-codes/inbound/route.ts` | 폰 창구 |
| `src/app/api/sms-codes/inbound/__tests__/route.test.ts` | 401 / 저장 / 무시 / **본문 미저장** |
| `src/app/api/sms-codes/consume/route.ts` | 스크래퍼 창구 (reset/pop) |
| `src/app/api/sms-codes/consume/__tests__/route.test.ts` | 401 / 400 / reset / 409 / pop / 빈 우편함 |
| `scripts/moa-closing/sms_inbox.py` | HTTP 우편함 클라이언트 |
| `scripts/moa-closing/test_sms_inbox.py` | pytest |
| `docs/superpowers/specs/2026-09-11-sms-code-inbox-design.md` | 이 문서 |

### 수정 (8)

| 파일 | 변경 |
|---|---|
| `src/proxy.ts` | `PUBLIC_PATHS` 2줄 + 주석 2줄 |
| `src/__tests__/proxy-cron-paths.test.ts` | `CRON_ROUTES`에 `/api/sms-codes/consume` |
| `src/proxy.test.ts` | 케이스 2개(consume public / inbound public) |
| `scripts/moa-closing/scrape.py` | `prepare_sms_source`·`await_sms_code` 추가, 호출부 2줄, env 1키, run-log 메시지, 마스킹 1줄 |
| `scripts/moa-ratio/audit.py` | `login_and_2fa` 2줄 + env 3키 |
| `scripts/moa-settlement/discover.py` | env 3키 |
| `CLAUDE.md` | 'Moa 로그인 SMS 인증번호' 절 신설 |
| `.claude/agent-memory/planner/…` | (문서 외) — 없음 |

**합계 22파일**(신규 14 · 수정 8) → HARD-GATE **전체 설계 등급**. DB 스키마 변경 + 인증 경계 신설로 복잡도 보정도 걸린다. `git worktree` 격리 권장:

```
git worktree add ../OPS-Console-feat-sms-code-inbox feat/sms-code-inbox
```

---

## 10. 태스크

순서가 곧 안전장치다. **서버 먼저 → 폰 → 스크래퍼.** 중간 어느 지점에서 멈춰도 make가 계속 돈다(T8까지는 스크래퍼가 우편함을 모른다).

```
T1(DB) ─┬─ T2(inbound) ─┬─ T4(proxy) ─ T5(배포·실검증) ─ T6(폰) ─ T7(python) ─ T8(전환) ─ T9(문서)
        └─ T3(consume) ─┘
```

병렬 가능: **T2 / T3**. `T1`은 T2·T3 **구현 전에 실적용**돼 있어야 한다(테스트는 mock이라 없어도 RED는 돈다).

---

### T1 — 마이그레이션 (5분)

- **파일**: `supabase/migrations/20260911_sms_code_inbox.sql`
- **RED**: 해당 없음(`tdd.md` 예외 — 설정/스키마). 대신 검증이 필수다
- **구현**: §5.1 그대로
- **검증** (사용자가 Supabase SQL Editor에서):
  ```sql
  select * from claim_sms_inbox('closing', 180);      -- t, closing, …, 0
  select * from claim_sms_inbox('ratio-audit', 180);  -- f, closing, …, 0   ← 점유가 실제로 막는다
  select * from claim_sms_inbox('closing', 180);      -- t                  ← 같은 소비자는 통과
  select * from pop_sms_code('closing');              -- 0행 (빈 우편함)
  select * from claim_sms_inbox('ratio-audit', 180);  -- f                  ← 빈 pop 은 반납하지 않는다
  select public.push_sms_code('123456');            -- 넣기 (만료 삭제 + 20행 캡 포함)
  select * from pop_sms_code('ratio-audit');          -- ERROR lease not held ← 비점유자는 꺼내지 못한다
  select * from pop_sms_code('closing');              -- 1행, 123456        ← 꺼내며 지우고 반납
  select * from pop_sms_code('closing');              -- ERROR (holder=(none)) ← 반납 뒤 재호출
  select * from claim_sms_inbox('ratio-audit', 180);  -- t                  ← 반납됐다
  delete from sms_code_lease;                         -- 정리
  select policyname from pg_policies where tablename like 'sms_code%';  -- 0건
  ```
  **한 줄씩** 실행한다 — ERROR 가 나는 줄이 있어 한꺼번에 돌리면 거기서 멈춘다. `pg_policies` 뷰의 컬럼은 `polname`이 아니라 `policyname`이다(선례 `20260602c_operator_ms_tokens.sql:35`가 같은 오타 — 이 PR 범위 밖).
- **의존**: 없음

### T2 — 코드 추출 + 폰 창구 (5분 × 2)

- **파일**: `features/sms-codes/{schemas,extract-code}.ts` + `__tests__/` 2개, `app/api/sms-codes/inbound/route.ts` + `__tests__/route.test.ts`
- **RED** (먼저 쓰고 실패 확인):
  - `extractSmsCode("[Web발신][내부관리자] 본인확인 인증번호는 [123456] 입니다.")` → `"123456"`
  - `extractSmsCode("[Web발신] 2026 신년 할인 [2026]원")` → `null` (인증번호 없음)
  - `extractSmsCode("인증 번호 [123456]")` → `"123456"` (공백 허용)
  - `extractSmsCode("인증번호 문의 010-1234-5678")` → `null` (대괄호 없음)
  - `extractSmsCode("")` → `null`
  - route: 잘못된 키 → **401** + insert 0회
  - route: 광고문자 → **200 `stored:false`** + insert 0회
  - route: 정상 → 200 `stored:true` + insert payload에 **`body`/`raw` 키가 없다**
  - route: 빈 본문 → 400
- **구현**: 키 길이·발신번호 대조 → `request.text()` → 길이 → `extractSmsCode` → `rpc("push_sms_code", { p_code })`(만료 삭제 + 20행 캡 포함)
- **검증**: `npm test -- src/features/sms-codes src/app/api/sms-codes/inbound`
- **의존**: 없음 (mock)

### T3 — 스크래퍼 창구 (5분)

- **파일**: `app/api/sms-codes/consume/route.ts` + `__tests__/route.test.ts`
- **RED**: 401 / `consumer:"closng"` → 400 / `action:"reset"` → `rpc("claim_sms_inbox")` 호출 + 200 `cleared` / `acquired:false` → **409 + holder** / `action:"pop"` → 200 `code` / 빈 우편함 → 200 `code:null`
- **구현**: zod `smsConsumeSchema` → `.rpc()` 분기. `INBOX_TTL_SEC = 180`은 라우트 상수
- **검증**: `npm test -- src/app/api/sms-codes/consume`
- **의존**: 없음

### T4 — 인증 가드 (3분)

- **파일**: `src/proxy.ts`, `src/__tests__/proxy-cron-paths.test.ts`, `src/proxy.test.ts`
- **RED**: 테스트 목록에 두 경로를 **먼저** 넣어 실패를 본다 (이 순서를 지켜야 가드가 실제로 작동하는지 증명된다)
- **구현**: `PUBLIC_PATHS` 2줄 + 주석
- **검증**: `npm test -- src/proxy` / `npm run typecheck` / `npm run lint`
- **의존**: T2·T3 (경로가 존재해야 의미가 있다)

### T5 — 배포 + 실검증 (사람, 5분)

- **파일**: 없음. Vercel env `SMS_INGEST_SECRET` 등록 후 배포
- **검증** (PowerShell, `-SkipHttpErrorCheck`로 상태코드를 본다):
  ```powershell
  $b = "https://<도메인>"
  # 401 이어야 한다. 307 이면 PUBLIC_PATHS 누락(F11)
  irm "$b/api/sms-codes/inbound" -Method Post -Headers @{Authorization="Bearer wrong"} `
      -Body "인증번호는 [123456] 입니다" -ContentType "text/plain; charset=utf-8" -SkipHttpErrorCheck
  # 200 stored:true
  irm "$b/api/sms-codes/inbound" -Method Post -Headers @{Authorization="Bearer $real"} `
      -Body "인증번호는 [123456] 입니다" -ContentType "text/plain; charset=utf-8"
  # 200 code:123456  → 두 번째 호출은 code:null (꺼내며 삭제)
  irm "$b/api/sms-codes/consume" -Method Post -Headers @{Authorization="Bearer $cron"} `
      -Body '{"action":"pop","consumer":"closing"}' -ContentType "application/json"
  ```
- **의존**: T1~T4

### T6 — 폰 설정 (사람, 5분)

- **파일**: 없음(Tasker)
- **구현**: §7.3. **make 프로필은 그대로 둔다**
- **검증**: 자기 폰에 `인증번호는 [654321] 입니다` 문자를 보내고 → `pop`으로 `654321` 확인. 이어서 아무 광고문자가 와도 `pop`이 `code:null`인지 확인(게이트 동작)
- **의존**: T5

### T7 — 우편함 클라이언트 (python) (5분)

- **파일**: `scripts/moa-closing/sms_inbox.py`, `scripts/moa-closing/test_sms_inbox.py`
- **RED**:
  - `reset_inbox`가 200이면 `cleared` 수를 돌려준다
  - 409면 `LeaseHeldError` — **`InboxUnavailable`이 아니다**(폴백 대상 구분)
  - 네트워크 오류·500이면 `InboxUnavailable`
  - `poll_inbox_code`: 첫 호출 `code:null`, 둘째에 코드 → 그 코드를 쓴다
  - 타임아웃 → `RuntimeError`, 문구에 `우편함` 포함
  - `mask_code("123456")` == `"****56"`, 2자 이하도 죽지 않는다
- **구현**: `requests` + 2초 루프. 모듈에 selenium import 없음
- **검증**: `python -m pytest scripts/moa-closing/test_sms_inbox.py -v`
- **의존**: 없음 (스텁)

### T8 — 전환 (8분, 파일 3개 — 분할하면 중간 상태가 깨진다)

- **파일**: `scrape.py`, `audit.py`, `discover.py`
- **RED** (`test_sms_inbox.py`에 추가):
  - `prepare_sms_source`: 우편함이 살아 있으면 **`requests.get`이 한 번도 호출되지 않는다**(make 크레딧 0 — 이 테스트가 이번 변경의 존재 이유다)
  - 409면 `RuntimeError`로 중단하고 **make를 호출하지 않는다**
  - `InboxUnavailable`이면 `pick_baseline`으로 간다
  - `base_url`/`secret`이 없으면 make로 간다(discover.py 호환)
  - `await_sms_code`가 `kind`에 따라 다른 경로를 탄다
- **구현**: §6.2~6.4
- **검증**:
  ```
  python -m pytest scripts/moa-closing -v      # 신규 + 기존 make 테스트 전부
  python -m pytest scripts/moa-ratio -v
  CLOSING_DRY_RUN=true python scripts/moa-closing/scrape.py   # 라이브 1회 — 로그에 'SMS 소스: 우편함'
  ```
  라이브 실행에서 확인할 것: ① `SMS 소스: 우편함`, ② 대기 시간이 기존보다 짧다, ③ make 대시보드 operations가 **안 늘어난다**
- **의존**: T6 (폰이 넣고 있어야 라이브 검증이 된다)

### T9 — 문서 (3분)

- **파일**: `CLAUDE.md`(절 신설), 이 문서의 `status: 확정`
- **검증**: `npm run build`
- **의존**: T8

---

## 11. 리스크

| # | 리스크 | 처리 |
|---|---|---|
| R1 | 전환 중 폰이 한 창구만 보게 되어 다른 쪽이 굶는다 | **make 프로필을 지우지 않는다.** 문자 한 통이 두 곳으로 간다(T6) |
| R2 | 폴백이 조용히 상시 발동해 크레딧을 계속 태운다 | run-log 메시지에 `(SMS: 우편함/make)`를 박는다. make 대시보드 operations를 T8 후 한 주 본다 |
| R3 | 리스가 정상 실행을 막는다 | TTL 180초 + 같은 consumer 재획득 통과. 최악 대기 3분. `enqueue.ts`의 `STALE_RUNNING_MS`(70분)와 같은 계열의 장치이고 값이 훨씬 짧다 |
| R4 | Moa SMS 문구 변경으로 추출 실패 | 우편함이 비어 타임아웃 → `폰 Tasker 확인 필요` 문구. 느슨한 정규식으로 넘기지 않는다(§4) |
| R5 | `SMS_INGEST_SECRET`로 우편함 오염 | F9. 키 분리가 완화책이고, 그것이 분리의 목적이다 |
| R6 | applyprice 3개가 여전히 깨져 있다 | **이미 깨져 있다**(§3.1). 이번 변경이 악화시키지 않는다. 되살릴 때 env 키를 맞춘다 |
| R7 | `sms_code_lease`가 단일 행이라 소비자가 늘면 병목 | 그게 목적이다. Moa 계정이 하나이므로 로그인은 원래 직렬이어야 한다 |
| R8 | 우편함 실패가 `automation_runs`에 안 남는 경로 | `scrape.py`는 `post_run_log`를 타므로 남는다. `audit.py`도 `/api/ratio-audit` 보고를 탄다. `discover.py`는 수동 실행이라 사람이 로그를 본다 |

---

## 12. 비범위 (Non-goals)

| 안 하는 것 | 왜 |
|---|---|
| **make 제거** | 폴백으로 남긴다. 우편함이 한 달 무사고로 돌면 별도 건으로 §4의 목록을 지운다 |
| **관리 화면** | 인증번호를 화면에 그리면 RLS 전면 차단의 근거가 무너진다. 진단은 SQL Editor로 한다 |
| **알림** | 실패는 기존 두 경로(`automation_runs` 실패 즉시 + 일일 보고)에 이미 실린다. 새 알림 채널을 만들지 않는다 |
| **폰 문자 원문 보관** | 저장하지 않는 것이 설계의 일부다 |
| **다른 계정/다중 폰** | Moa 계정이 하나다. 우편함도 하나여야 리스가 성립한다 |
| **applyprice 3개 복구** | 미추적 일회용 스크립트. 언급만 한다 |
| **rate limiting** | 상한을 두면 정상 문자를 떨어뜨릴 위험이 생긴다. 대신 **출처 검증**(발신번호 대조)과 **행 캡**(`push_sms_code` 20행)으로 막는다 — "키 유출의 결과는 로그인 실패뿐"이라는 처음 근거는 틀렸다(디스크 소진 → 프로젝트 읽기전용, 보안 리뷰). 완화는 키 교체 |

---

## 13. 열린 질문

1. ~~Tasker 내용 필터를 `*인증번호*`로 두면 충분한가?~~ → **아니다. 발신번호가 필수가 됐다**(rev 4, 보안 리뷰 H1 — 폰 번호만 알면 비밀키 없이 가짜 코드를 넣는다). `SMS_INGEST_SENDERS`에 Moa 발신번호가 있어야 창구가 열린다. 번호는 폰의 Moa 인증문자 대화에서 본다. Tasker Sender 필터도 같은 번호로.
2. **`SMS_INGEST_SECRET`을 Preview 환경에도 넣는가?** 폰은 Production 도메인만 부른다. Preview에 안 넣으면 Preview 배포에서 이 라우트가 500을 돌려주는데, 그게 문제인지(Preview에서 우편함을 시험할 일이 있는지) 확인이 필요하다.
3. **`ratio-audit`의 `MANUAL_CODE_FILE` 경로를 남기는가?** make 큐 과적 때 만든 수동 입력 경로다. 우편함이 안정되면 존재 이유가 사라지지만, 그 판단은 한 달 뒤 make 제거와 함께 하는 편이 맞아 보인다.
4. **집 PC에서도 스크랩을 돌리는가?** 돌린다면 `.env.local`의 `CRON_SECRET`/`OPS_CONSOLE_BASE_URL`이 그 PC에도 있어야 우편함을 쓴다(없으면 조용히 make로 간다 — R2의 표기로만 드러난다).
5. **`closing` 스케줄이 09:00 고정인가?** 리스 충돌 창을 좁히려면 경쟁률 점검을 09:00~09:10에 누르지 않는 운영 습관이면 충분하다. 스케줄이 여러 개면 창이 넓어진다.
