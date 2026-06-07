# Brainstorm: Moa 서비스조회 스크래핑 → 마감 서비스 → OPS 서비스마감(closing) 자동화

## 의도
- 산출물: Moa 관리자(로그인+SMS 2FA)로 ServiceSearch 페이지를 스크래핑(검색조건 설정→검색→페이지네이션 순회)해 **작성마감이 지난 서비스만** 추출, OPS-Console `/dashboard/closing`(서비스 마감, slug=closing — 현재 메뉴만 등록·페이지 미구현)에 표시. 신규: closing 페이지 + list-variant + DB 테이블 + 인제스트 API + Python 스크래퍼 + GH Actions 워크플로 + make GET(SMS코드) 연동.
- 사용자: 운영부 admin/운영자. 마감 서비스 현황을 OPS에서 모니터링(현재는 Moa 수동 로그인·조회).
- 트리거: 마감 서비스 수동 확인 부담 → 2주마다 자동 집계·표시.
- 성공 기준: (1) 격주 월요일 10시 무인 실행 (2) SMS 2FA 자동 통과 (3) 검색결과 전건(페이지네이션 포함)에서 작성마감<현재 건만 정확 적재 (4) closing 페이지 표시 (5) 재실행 시 멱등(대체 적재).

## 제약
- 기술: Next 서버리스/cron 런타임에서 브라우저 불가 → **GH Actions + 브라우저**(SmileEDI 동일). **SMS 2FA**가 최대 난점 — Moa 로그인 제출→SMS 발송→Tasker→make webhook(POST, enfpm…아님/394… 수신용)→Data Store→스크래퍼가 **GET `https://hook.eu2.make.com/enfpm5qhyynjrfpy4lslc7o5wa7rnr1q`**로 최신 코드 회수→입력. 신선도(로그인 이후 코드)·폴링 타임아웃 필요. 페이지네이션 순회 필수.
- 비즈니스: make.com/Tasker/휴대폰 외부 의존(끊기면 2FA 실패), Moa 내부 DOM 변경 리스크. Moa 자격증명은 GH Secrets.
- 코드베이스: SmileEDI 워크플로/시크릿/cron-job.org→workflow_dispatch 패턴 재사용. closing은 list-variant 신규(services 변형 참고). 데이터 적재는 신규 **인제스트 API**(기존 `/api/automations/run`은 잡 실행 전용; `/api/worklog/log` POST ingest 패턴 참고) + service_role 인서트. 2주 격주는 표준 cron 불가 → 주간 트리거 + **ISO주 패리티 게이트**.

## 대안 비교

| 항목 | 대안 A: GH Actions Python/Selenium + OPS 인제스트 API + closing DB/페이지 | 대안 B: TS/Playwright 스크래퍼(동일 흐름) | 대안 Z: do nothing |
| --- | --- | --- | --- |
| 핵심 | SmileEDI 인프라 그대로 재사용(setup-python+chrome). 신규 Python 스크래퍼가 로그인→SMS2FA(make GET 폴링)→검색→페이지네이션→마감필터→OPS `/api/closing/ingest` POST(Bearer CRON_SECRET)→`closing_services` upsert. closing 페이지=list 패턴 | 스크래퍼만 TS/Playwright로. 나머지 동일 | Moa 수동 조회 유지 |
| 비용 | 상 (20+파일: 스크래퍼+워크플로+ingest API+DB+RLS+변형+페이지+테스트) | 상+ (Playwright 신규 스택) | 0 |
| 위험 | 중 (SMS2FA 타이밍/외부의존, DOM 변경) | 중상 (새 스택 + 동일 외부의존) | 마감 누락·수동부담 지속 |
| 가역성 | 높음 (메뉴 placeholder라 페이지 추가, 워크플로/cron 분리 가능) | 높음 | - |
| 학습효과 | SmileEDI 패턴 2회 적용 → 사내 스크래핑 표준화 + 2FA 자동화 패턴 | 브라우저 자동화 TS 대안 | - |

## 추천 + 근거
- **추천: 대안 A** (GH Actions Python/Selenium + OPS 인제스트 API + closing DB/페이지)
- 근거: (1) 방금 구축한 SmileEDI GH Actions 인프라(workflow_dispatch, setup-python+chrome, cron-job.org 트리거, 시크릿 패턴)를 그대로 재사용 → 신규 비용 최소. (2) Moa 스크래퍼는 신규 작성이지만 Python/Selenium이 사내 표준이 됨. (3) 중간 파일(SharePoint) 없이 **스크래퍼→OPS 인제스트 API→DB→페이지**가 데이터 소유·검증(zod) 측면에서 깔끔. (4) closing 메뉴가 이미 등록돼 페이지만 추가하면 됨
- **기각 B**: Playwright 신규 스택 도입은 SmileEDI(Python)와 이원화 → 유지보수 부담. 동일 외부의존(make/Tasker)이라 언어 이득 없음. 향후 스크래핑 표준을 Playwright로 통일할 때 재검토
- **Z 기각**: 마감 서비스 수동 확인 부담이 자동화 동기 자체

## 다음 단계
- 규모: **20+파일, HARD-GATE 전체 설계** → **planner 에이전트 + /plan 필수**
- 선결 확정 필요(설계 입력):
  - 작성마감 "마감" 정확 기준: 작성마감 datetime < 스크래핑시각 (확정 가정)
  - 검색조건(오픈일 범위 등) 동적화 여부 — 캡처는 2026-03-01~2027-02-28(학년도). SmileEDI fiscal-year식 동적 vs 고정 env
  - SMS 코드 신선도 판별(타임스탬프) + 폴링 타임아웃 값
  - 2주 격주 기준주(어느 월요일부터) — ISO주 패리티
  - closing_services 스키마(서비스ID/대학명/지역/서비스명/대학구분/카테고리/운영자/개발자/작성시작/작성마감/단독여부 + scraped_at)

## 결정 업데이트 (검색 일자 조건)
- 오픈일 검색범위 = **학년도 동적 산출** (매년 +1):
  - start = `{startYear}-03-01 00:01`, end = `{startYear+1}-02-{2월말일} 23:59`
  - startYear: KST 월 ≥ 3 → 올해 / 1~2월 → 작년
  - 윤년 시 익년 2/29까지. (예: 2026-06 실행 → 2026-03-01 00:01 ~ 2027-02-28 23:59)
  - SmileEDI fiscal-year.ts와 유사하나 경계가 3/1(학년도), 시각 포함('00:01'/'23:59') 포맷 주의

## 결정 업데이트 2 (스케줄/컬럼/필터 확정)
- 스케줄: cron-job.org 주간(월 10:00) → workflow_dispatch → 워크플로/잡이 **이번 주 월요일 기준 ISO주 패리티 게이트**로 격주만 실행.
- closing 표 = 캡처 11컬럼: 서비스ID·대학명·지역·서비스명·대학구분·카테고리·운영자·개발자·작성시작·작성마감·단독여부 (+ scraped_at).
- 검색조건 = 오픈일(학년도 동적) 범위만. 다른 필터 미설정.
- 마감 필터 = 작성마감 datetime < 스크래핑 시각.
