# Brainstorm: 백업자 서비스별 분리 (PR-3)

## 의도

- **산출물**: backup_request_services 테이블에 `substitute_email` / `substitute_name` nullable 컬럼 추가 + EditForm 서비스 chip별 백업자 select + mail-template 백업자별 그룹화. 기존 backup_requests.substitute_email/name은 *default fallback* (서비스별 미지정 시)
- **사용자**: 운영부 admin/member가 백업 요청 등록 시 *서비스마다 다른 백업자* 지정 가능. 백업자 N명에게 *각각 자기 담당 서비스만* 포함된 메일 발송. 기존 1명 일괄 케이스도 동일 동작 (back-compat)
- **트리거**: 사용자 명시 요청 (2026-05-15) — 실제 운영에서 한 백업 요청에 여러 서비스가 묶이고 *서비스마다 다른 백업자*가 자연. 현재는 1명 일괄로만 가능 → 운영 mismatch
- **성공 기준**:
  - 서비스별 백업자 독립 지정 (EditForm chip 옆 select)
  - 메일: 백업자 N명 → 각각 자기 담당 서비스만 포함된 메일 1통씩
  - 1명 일괄 케이스 그대로 동작 (back-compat)
  - DB schema 변경 + 기존 row backfill (default substitute_email로 모든 서비스 채움)
  - viewer 권한 차단 유지 (RLS 영향 없음)

## 제약

- **기술**:
  - backup_request_services 테이블에 컬럼 2개 추가 — services FK 무결성 영향 없음 (substitute_email은 별도 컬럼)
  - mail-template 백업자별 그룹화 — 동일 백업자가 N개 서비스 담당 시 1 메일에 묶음
  - mail-actions 메일 발송 로직 — 백업자별 group → 각각 발송
  - ListRow.backupServicesDetail에 `substitute_email` / `substitute_name` 추가
  - Server Action zod schema: services 입력을 `(service_id, substitute_email, substitute_name)` 튜플 배열로 변경
- **비즈니스**:
  - 기존 backup_requests에 등록된 row 있다면 *서비스별 substitute가 모두 default(backup_requests.substitute_email)*로 backfill 필요
  - 마이그레이션 prod 적용 시 *기존 메일 발송 이력 영향 없음* — 이력은 receivables_mail_sends/backup_request_mail_sends에 별도 저장
- **코드베이스**:
  - backup_request_services PR #96에서 N:M 테이블 분리 완료 — 자연스러운 컬럼 확장 위치
  - 기존 backup_requests.substitute_email/name은 *default* 의미로 유지 (deprecate X — back-compat)
  - 메모리 학습: services 백업자 분리 패턴은 향후 다른 N:M 관계 (예: backup_request_contacts)에도 재사용 가능

## 대안 비교

### 대안 A: backup_request_services에 substitute_email/name 컬럼 추가

- 핵심: 기존 N:M 테이블 확장. service당 substitute 1명 (NOT NULL 또는 fallback)
- 비용: ~9~12 파일 (마이그레이션 1 + schemas/queries/actions + EditForm/View + mail-template/mail-actions + page.tsx + tests)
- 위험: 기존 row backfill 필요 (default substitute_email로 모든 service row 채움)
- 가역성: 중간 — 컬럼 drop 가능. 다만 데이터 손실
- 학습: N:M join row에 dim 추가하는 패턴 (services FK + per-service metadata)

### 대안 B: 별도 backup_request_substitutes N:M 테이블

- 핵심: `(backup_request_id, service_id, substitute_email)` 별도 테이블. backup_request_services와 거의 동일 형태
- 비용: ~14~18 파일 (테이블 1 + RLS + join 로직 추가)
- 위험: backup_request_services와 *중복 N:M* → 정규화 과한 분리
- 가역성: 높음 (테이블 drop만)
- 학습: 정규화 trade-off

### 대안 C: backup_requests에 substitutes JSONB

- 핵심: `substitutes: jsonb` 컬럼에 `[{service_id, substitute_email}]` 배열 저장
- 비용: ~7~9 파일 (마이그레이션 + schema 단순)
- 위험: JSONB 검색·index 어려움. 통계·집계 시 PostgreSQL JSONB 함수 필요
- 가역성: 높음
- 학습: 비정규화 패턴

### 대안 Z: 1명 백업자 유지

- 운영 mismatch 유지. 사용자 요청 거부

## 추천 + 근거

**추천: 대안 A — backup_request_services에 컬럼 추가**

**선택 근거**:
1. **기존 N:M 테이블 자연 확장** — backup_request_services는 이미 service당 1 row. substitute_email 컬럼은 자연
2. **변경 최소** — 새 테이블 X, RLS 그대로
3. **back-compat 유지** — 기존 backup_requests.substitute_email는 default fallback로 명시. 1명 일괄 케이스 동일 동작
4. **mail-template 그룹화 단순** — backup_request_services row를 substitute_email으로 group by → 백업자별 서비스 list

**기각된 대안 B**: backup_request_services와 거의 동일 N:M → 중복 정규화. 둘을 한 N:M로 합치는 게 정직 (A).

**기각된 대안 C**: JSONB 비정규화는 검색·집계 어려움. PostgreSQL JSONB 도구 학습 비용. backup_request_services가 이미 정규화 N:M이라 일관성 깨짐.

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260515-165751-backup-substitute-per-service.md`
- HARD-GATE: ~9~12 파일 → **간략 설계** ⇒ `/plan` 권장
- 마이그레이션 T1 우선: backup_request_services 컬럼 2개 추가 + 기존 row backfill (`update set substitute_email = (select substitute_email from backup_requests where id = backup_request_id)`)
- 이후 schemas → queries → actions → EditForm → mail-template → page.tsx 순서
- Out of scope: backup_requests.substitute_email deprecate (back-compat 위해 유지), 백업자 N명 별도 추가 UI (서비스별 1명만)
