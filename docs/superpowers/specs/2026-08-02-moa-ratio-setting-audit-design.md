# 경쟁률 세팅 오설정 점검 자동화 — 설계

- 작성일: 2026-08-02
- 상태: 설계 확정 (구현 전 Phase 0 디스커버리 선행)
- 관련: `scripts/moa-closing/scrape.py`(로그인 재사용), `scripts/dev-control-analyze.mjs`(claude -p 호출 규약), `src/features/automations/jobs/team-briefing.ts`(Teams 개인 알림 패턴)

## 1. 문제

운영자가 Moa 경쟁률 설정 페이지(`/Ratio/RatioSetting`)에 입력하는 안내문구('오픈전 내용', '상단 내용')가 실제 '스케줄 세팅'과 어긋나는 경우가 있다. 대표적으로 지난 해 문구가 남아 연도가 틀리거나, 문구에 적힌 공개 일시가 스케줄과 다르다. 수시 서비스만 241건이라 사람이 전수 확인하기 어렵다.

리얼 서버의 경쟁률 페이지 링크가 404를 내는 경우도 함께 확인 대상이다.

## 2. 목표와 비목표

**목표**
- 수시 서비스 전수를 순회해 안내문구 ↔ 스케줄 세팅 불일치를 찾아낸다.
- 리얼 서버 '주소' 컬럼의 html 링크가 살아 있는지 확인한다.
- 결과를 DB에 적재하고 요약을 Teams로 받는다.

**비목표 (이번 범위 아님)**
- 자동 수정. 발견만 하고 고치지 않는다.
- 수시 외 모집구분(대학원·정시 등) 점검.
- 자동 스케줄 실행. 파일럿 단계에서는 수동 실행만 한다.
- 전용 조회 화면. 적재만 하고 화면은 판정 정확도가 안정된 뒤 검토한다.

## 3. 확정된 결정

| 항목 | 결정 | 근거 |
|---|---|---|
| 알림 대상 | 본인 Teams 개인 채팅 1건 (`TEAMS_RATIO_AUDIT_CHAT_ID`) | 파일럿 — 판정 정확도 검증 전 팀 전체 노출 회피 |
| 판정 주체 | 로컬 `claude -p` | 안내문구가 자유 서식이라 정규식으로는 표현 다양성을 못 따라감. 로컬 구독이라 과금 없음 |
| 실행 범위 | 수시 전수(241건), 수동 실행 | 파일럿 튜닝 중에는 자동 실행의 오탐 노이즈가 더 비쌈 |
| 링크 404 점검 | URL 추출 후 HTTP 요청 | 탭 전환 없이 건당 ~0.3초, 재시도·병렬화 용이 |
| 결과 보관 | `ratio_audit_runs` 1테이블 + jsonb payload | `receivables_match_runs` 선례. 판정 규칙이 흔들리는 동안 스키마 고정 회피 |
| 연도 판정 기준 | **해당 서비스 스케줄 세팅의 날짜 연도** | 달력연도와 학년도가 별개 축. 스케줄 기준이면 서비스별 차이를 그대로 반영하고 '2027학년도' 표기를 오탐하지 않음 |
| 실행 구조 | 로컬 CLI 직접 실행 + 서버 인제스트 | 맥에서 즉시 실행 가능. 큐·폴러는 회사 PC 전환 시 `closing_scrape_requests` 패턴 복제로 추가 |

## 4. 실행 흐름

```
[맥 터미널] python3 scripts/moa-ratio/audit.py
  0  대상 로딩   GET /api/ratio-audit/targets (Bearer CRON_SECRET)
                 → closing_services category='수시' 의 service_id·대학명·서비스명·담당자
  1  로그인      scrape.py 의 setup_driver + login_and_2fa 재사용
                 (Moa 로그인 → SMS 2FA 자동 → 캡차 감지 시 abort)
  2  테스트 검색  /Ratio/RatioSetting → 서버='테스트', 운영자='선택', 모집구분='수시' → 검색
  3  교집합      결과 테이블 ServiceID ∩ 0번 대상 목록
  4  순회        각 행 '설정/배포' 진입 → 스케줄 세팅 / 오픈전 내용 / 상단 내용 텍스트 추출
  5  판정        judge.py — 테스트용 라인 제외 → claude -p 배치(10건) → findings JSON
  6  리얼 점검    서버='리얼' + 모집구분='수시' 재검색 → 3번과 같은 교집합 기준으로
                 '주소' 컬럼 html URL 추출 → HTTP 상태 확인
  7  인제스트     POST /api/ratio-audit/ingest → 적재 + Teams 요약 발송
```

`RATIO_AUDIT_DRY_RUN=true`면 7단계를 생략하고 결과를 로컬 JSON으로만 저장한다.

## 5. 컴포넌트

```
scripts/moa-ratio/
  audit.py          # 오케스트레이션(로그인·순회·인제스트). 브라우저 필요, 순수 로직 없음
  judge.py          # 프롬프트 조립 + 응답 파싱 + 테스트용 스케줄 제외  ← 순수 로직
  test_judge.py     # unittest
  requirements.txt
src/app/api/ratio-audit/targets/route.ts   # 대상 목록 (CRON_SECRET)
src/app/api/ratio-audit/ingest/route.ts    # 결과 수신 → 적재 + Teams
src/features/ratio-audit/
  schemas.ts        # zod — 인제스트 payload 계약
  summary.ts        # 이상 건 집계 + Teams HTML 조립  ← 순수 로직
  queries.ts
supabase/migrations/20260802_ratio_audit_runs.sql
```

경계: 규칙이 흔들릴 부분(`judge.py`, `summary.ts`)은 브라우저·네트워크 없이 테스트되도록 분리한다. `audit.py`는 판정 규칙을 갖지 않고 수집과 전달만 한다.

**로그인 재사용**: `sys.path`에 `scripts/moa-closing`을 삽입해 `scrape.py`를 import하고 `setup_driver`/`login_and_2fa`를 그대로 호출한다. 공용 모듈 추출은 검증 완료된 마감 스크래퍼를 수정하게 되고 회귀 확인에 실제 Moa 로그인이 필요하므로, 세 번째 소비자가 생길 때 한다.

## 6. 데이터 모델

```sql
create table public.ratio_audit_runs (
  id uuid primary key default gen_random_uuid(),
  ran_at timestamptz not null default now(),
  scanned_count int not null,      -- 설정/배포 순회 성공 건수
  finding_count int not null,      -- 이상 서비스 수
  link_error_count int not null,   -- 리얼 html 404 등
  status text not null,            -- ok | partial | failed
  notified boolean not null default false,
  payload jsonb not null
);
```

RLS는 `worklog` 패턴 — read all(운영부 공개), insert는 service_role만.

payload 구조:

```json
{
  "findings": [
    {
      "serviceId": 1205048,
      "universityName": "서강대학교",
      "serviceName": "2027학년도 수시모집",
      "operatorName": "박시현",
      "items": [
        { "type": "year", "field": "top",
          "found": "2025학년도", "expect": "2026", "quote": "2025학년도 경쟁률은 …" }
      ]
    }
  ],
  "linkErrors": [{ "serviceId": 1205048, "url": "https://…", "status": 404 }],
  "skipped": [{ "serviceId": 1205049, "reason": "설정/배포 페이지 진입 실패" }]
}
```

## 7. 판정 계약

`judge.py` 입력 1건:

```
{service_id, university_name, service_name, schedule_lines[], pre_open_text, top_text}
```

전처리: `schedule_lines` 중 **'테스트용'이 포함된 라인은 제외**한다. 테스트 목적으로 넣은 단기 반복 스케줄이 정상 문구를 불일치로 오판하게 만든다.

출력: 서비스당 `items[]`

```json
{ "type": "year|schedule", "field": "pre_open|top",
  "found": "문구에서 발견한 값", "expect": "스케줄 기준 기대값", "quote": "원문 발췌" }
```

- `type: year` — 문구의 날짜 연도가 **스케줄 라인들의 연도 집합에 없음**. 스케줄이 연말·연초에 걸쳐 두 연도를 포함하면 둘 다 정상으로 본다
- `type: schedule` — 문구의 날짜·시각이 스케줄 세팅과 다름
- 이상이 없으면 빈 배열

claude 호출 규약은 `dev-control-analyze.mjs`를 답습한다: 프롬프트는 argv가 아닌 **stdin**으로 전달(ENAMETOOLONG 회피), 실행 cwd를 리포 밖(임시 디렉터리)에 두어 이 리포의 `.claude` 설정을 상속하지 않게 한다. 배치는 10건 단위(241건 ≈ 25회 호출).

## 8. Teams 요약

`summary.ts`가 조립한다.

```
[운영부 상황실] 경쟁률 세팅 점검 — 순회 231 / 이상 12 / 링크오류 2
(상위 10건 표: 대학 · 서비스 · 담당자 · 이상 요약)
외 2건
```

이상 0건이면 "이상 없음" 한 줄로 보낸다.

## 9. 에러 처리

| 상황 | 처리 |
|---|---|
| 캡차 노출 | 즉시 abort. 재시도 금지 — 첫 시도 실패가 계정 잠금으로 이어짐 (마감 스크래퍼 규칙 동일) |
| 서비스 1건 순회 실패 | 건너뛰고 계속. `payload.skipped[]`에 사유 기록, `status='partial'` |
| claude 응답 파싱 실패 | 해당 배치 1회 재시도, 재실패 시 skip. 추측 판정 금지 |
| 링크 점검 타임아웃 | 3회 재시도 후 `linkErrors`에 사유와 함께 기록 |
| Teams 발송 실패 | 적재는 유지하고 `notified=false`로 기록 (team-briefing 초안 알림과 동일) |
| DRY RUN | `RATIO_AUDIT_DRY_RUN=true` → 인제스트 생략, 로컬 JSON 저장만 |

## 10. Phase 0 — 셀렉터 디스커버리 (구현 전 선행)

`RatioSetting` DOM을 모르는 상태에서 코드를 쓰면 추측이 된다. 맥에서 로그인 후 `scrape.py`의 `_dump_page()`로 HTML·PNG를 덤프해 아래를 확정하고, 그 결과를 본 문서 부록에 적은 뒤 구현에 들어간다.

| 확정 대상 | 쓰이는 단계 |
|---|---|
| 서버 select id + '테스트'/'리얼' option value | 2·6 |
| 운영자 select id — 기본값이 로그인 운영자로 잡히는지 | 2 (마감 스크래퍼에서 겪은 함정) |
| 모집구분 select id + '수시' value, 검색 버튼 id | 2 |
| 결과 테이블 행 구조 — ServiceID 컬럼, '설정/배포' 링크, '주소' 컬럼 html 링크 | 3·4·6 |
| 설정/배포 페이지 — 스케줄 세팅 / 오픈전 내용 / 상단 내용 영역 | 4 |

이 단계에서 실제 서비스 1~2건의 문구 샘플도 확보해 claude 프롬프트를 그 샘플에 맞춘다.

**함께 확인할 것 — 세션 유지 시간.** 241건 순회는 로그인 세션을 30~60분 유지해야 한다. 중간에 만료되면 남은 건이 전부 실패하고, 재로그인은 SMS 2FA를 다시 타야 한다. Phase 0에서 만료가 확인되면 배치 분할(예: 50건씩 4회, 회차마다 재로그인)로 전환한다. 분할이 필요 없으면 단일 세션으로 진행한다.

## 11. 테스트

| 대상 | 방식 |
|---|---|
| `judge.py` — 테스트용 라인 제외, 프롬프트 조립, 응답 파싱, 파싱 실패 처리 | `unittest` (RED 먼저) |
| `summary.ts` — 집계, 상위 N 절단, 이상 0건 문구 | vitest (RED 먼저) |
| `schemas.ts` — 인제스트 payload zod 검증 | vitest |
| `/api/ratio-audit/ingest` — CRON_SECRET 인증, 적재, notified 플래그 | vitest (Supabase 목) |
| 전체 흐름 | 맥에서 `RATIO_AUDIT_DRY_RUN=true` 1회 실행 — 로그인·순회·판정 실제 확인 |

`audit.py`는 브라우저 의존이라 유닛 테스트 대상이 아니며 DRY RUN 실행으로 검증한다.

## 12. 환경 변수

| 이름 | 용도 | 비고 |
|---|---|---|
| `MOA_USERNAME` / `MOA_PASSWORD` | Moa 로그인 | 기존 값 재사용 |
| `MAKE_SMS_CODE_URL` | SMS 2FA 코드 웹훅 | 기존 값 재사용 |
| `CRON_SECRET` | targets·ingest API 인증 | 기존 값 재사용 |
| `TEAMS_RATIO_AUDIT_CHAT_ID` | 결과 알림 받을 개인 채팅 | **신규** — `listMyChats()`로 조회 |
| `RATIO_AUDIT_DRY_RUN` | 인제스트 생략 | **신규** — 기본 false |
| `OPS_CONSOLE_BASE_URL` | 스크래퍼 → 서버 호출 | 기존 값 재사용 |

## 13. 향후 (이번 범위 아님)

- 회사 윈도우 PC 전환 — `closing_scrape_requests` 큐 + `poll-local.ps1` 폴러 패턴 복제, 자동화 페이지 버튼으로 트리거
- 판정 정확도 안정 후: 담당 운영자별 개인 알림, 주 1회 자동 실행, 대시보드 조회 화면
- 수시 외 모집구분 확대
