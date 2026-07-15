# 개발·테스트 메뉴 2탭 분리 + 원서제어 분석(개발 탭) 설계

날짜: 2026-07-14 · 승인: 사용자 (브레인스토밍 Q&A 완료) · 상태: 설계 확정

## 목적

개발 테스트 메뉴(`/dashboard/dev-test`)를 **개발 / 테스트** 2탭으로 분리한다.
테스트 탭은 현재 구현(entertest 실행/이력) 그대로, 개발 탭은 서비스별
원서제어 JS(`Apply{ID}_A.js` = 운영자 제어, `Apply{ID}_AU.js` = 개발자 제어)를
수집해 **운영자용 요약 + 확인 필요 항목 피드백**으로 정리해 보여준다.

## 확정된 결정 (브레인스토밍 Q&A)

| 결정 | 선택 |
|---|---|
| 데이터 소스 | 원서GEN(generator.jinhakapply.com)에서 URL fetch |
| 인증 | 별도 계정 — `.env`의 `MOA_USERNAME`/`MOA_PASSWORD` |
| 분석 방식 | AI 요약 — **Claude API 아님**, 이 PC의 `claude -p`(OAuth 구독) |
| 실행 | PC cron 정기 실행 (운영하며 보완) |
| 피드백 흐름 | 확인 필요 항목별 **확인 체크 + 메모** (재분석 시 유지) |
| 기본 탭 | 테스트 (기존 동작 무변경) |

## 수집 파이프라인 — 실측 검증 완료 (2026-07-14)

Selenium 불필요. 순수 HTTP 2단계:

1. **로그인**: `POST https://generator.jinhakapply.com/Login.aspx`
   - form: `__VIEWSTATE`/`__VIEWSTATEGENERATOR`/`__EVENTVALIDATION`(GET에서 추출)
     + `AdminId`/`AdminPassWord`/`LoginBtn=`
   - 성공 시 302 → `/WonseoGen.aspx?UnivServiceId={id}` + `Generator` 쿠키
2. **파일 수집**: `POST /_AU/Default.aspx/GetDevInfoByUnivServiceId`
   - JSON body `{UnivServiceID: "<id>", GenFlag: "WA"}` (ASP.NET WebMethod,
     `Content-Type: application/json`)
   - 응답 `d`(JSON string) → `[{FileName, Extension, FileContents, FileType}]`
   - js 파일만 `FileContents` 포함 (실측: A.js 63,530자 / AU.js 11,514자)
   - GenFlag는 `W?` 형식만 유효(`A` 단독은 500). 서비스별 WA~WD 순회 시도,
     200 응답만 수집

## 아키텍처

```
[PC cron] scripts/dev-control-analyze.mjs
  ├─ Supabase에서 대상 서비스 조회 (service_id 보유 + write_start 임박 순)
  ├─ 원서GEN 로그인 → GetDevInfoByUnivServiceId (GenFlag WA~WD)
  ├─ code_hash(sha256) 비교 — 변경 없으면 skip (claude -p 토큰 절약)
  ├─ 변경분만 claude -p 분석 (JSON 스키마 출력 강제)
  │   ├─ summary_md: 운영자용 설명 (A=운영자 제어 / AU=개발자 제어 구분)
  │   └─ flags[]: 확인 필요 항목 (지난 연도 날짜, 마감일 안내문구,
  │       하드코딩 학년도, alert 문구, 전형코드 분기 등)
  └─ dev_control_analyses upsert (기존 flags의 checked/note는 key 매칭 유지)

[웹 /dashboard/dev-test?tab=dev]
  ├─ 목록: 대학명 · 서비스명 · 제어파일 배지(A/AU) · 확인 필요 N건 · 최근 분석일
  └─ 인스펙터(list-variants 신규 variant `dev-control`):
      ① AI 요약  ② 확인 필요 항목 (체크박스 + 메모 — server action)
      ③ 원본 코드 접기/펼치기 (A/AU)
```

## DB — 신규 테이블 1개

```sql
create table dev_control_analyses (
  id uuid primary key default gen_random_uuid(),
  service_id bigint not null,          -- services.service_id (원서 ID)
  gen_flag text not null default 'WA',
  kind text not null check (kind in ('A','AU')),
  code_hash text not null,
  raw_code text not null,
  summary_md text,
  flags jsonb not null default '[]',   -- [{key,label,snippet,severity,checked,note}]
  analyzed_at timestamptz not null default now(),
  unique (service_id, gen_flag, kind)
);
```

- flags의 `key` = 규칙 + 코드조각 해시 → 재분석 시 동일 항목의 checked/note 보존
- RLS: 인증 사용자 read / insert·update(raw)는 service_role(스크립트 전용).
  checked/note 갱신만 server action(zod 검증) 허용

## 탭 구조

- `/dashboard/dev-test?tab=dev|test` — handover `HandoverTabs`와 동일한 URL 탭 패턴
- 기본(파라미터 없음) = `test` (기존 동작·북마크 무변경)
- 테스트 탭: 기존 코드 이동 없이 그대로 렌더 분기

## 에러 처리

- 로그인 실패/세션 만료: 스크립트 즉시 중단 + exit 1 (잘못된 재시도로 계정 잠금 방지)
- GenFlag 500 응답: 해당 flag skip (정상 케이스 — 존재하지 않는 페이지)
- claude -p 실패/JSON 파싱 실패: 해당 파일 skip + stderr 기록, 수집(raw)은 저장
- 웹: 분석 없는 서비스는 "미수집" 표시 (빈 상태 표준)

## 테스트

- 단위: flags key 보존 병합 로직 / GenFlag 순회 / 응답 파싱 (fixture 기반)
- 웹: 탭 분기 렌더, dev-control variant View(체크/메모 action), 목록 배지
- 수집 스크립트 e2e: 실 계정으로 1개 서비스 수동 실행 검증 (이 PC)

## 비범위 (YAGNI)

- flags 이력 추적 테이블 (정규화 B안 기각)
- aspx/html 파일 수집 (내용 미제공, js만)
- 자동 수정 제안 — 피드백은 사람 확인용
