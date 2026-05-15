# Brainstorm: SharePoint 계약서 → /dashboard/contracts 메뉴

## 의도

- **산출물**: `/dashboard/contracts` 메뉴를 list-variants `contracts` slot으로 신설하여 SharePoint 계약서 Excel(`SHAREPOINT_CONTRACTS_ITEM_ID`)의 다중 시트(4년제 / 2년제 / 대학원 / … / 기타) 데이터를 통합 조회. 목록은 *최소 컬럼*만 노출, 인스펙터에서 전체 컬럼 상세
- **사용자**: 운영부 admin/member가 계약 진행·만료 검토 시 (현재는 SharePoint Excel 직접 열어 확인 — UX 분산). viewer는 read-only
- **트리거**: 사용자 명시 요청 (2026-05-15). env에 `SHAREPOINT_CONTRACTS_ITEM_ID` 설정 완료 + 사이드바 "계약" 메뉴(slug `contracts`) 이미 등록
- **성공 기준**:
  - `/dashboard/contracts` 진입 시 4년제~기타 시트 데이터 노출
  - 시트별 필터 또는 통합 view (대안에서 결정)
  - 인스펙터에서 row 상세 (전체 컬럼)
  - SSR 응답 ≤ 3초 (Graph fetch + render)
  - 빈 시트/네트워크 오류 시 사용자에게 명확한 상태 표시 (`/login` redirect X)

## 제약

- **기술**:
  - Microsoft Graph API rate limit (앱 토큰 client_credentials grant, `Files.Read.All`)
  - 다중 시트 fetch 비용 — 시트당 usedRange 1회. 시트 8개 가정 시 8 호출
  - JS Number 정밀도 (Excel 큰 정수 — 계약 ID 등)
  - 매 요청마다 Graph fetch → 서버 캐시 또는 ISR 필요할 수 있음
- **비즈니스**:
  - SharePoint Excel이 *source-of-truth* (운영부가 직접 편집). Folio는 view
  - Azure AD App `Files.Read.All` Application permission + admin consent 이미 운영 중 (receivables / backup 메일)
- **코드베이스**:
  - receivables 도메인이 *단일 시트* SharePoint fetch 패턴 (`src/features/receivables/queries.ts`) 보유 — 재사용 가능
  - list-variants 11 슬롯 (services 포함) + 12번째 `contracts` slot 추가 비용 1 폴더 + registry 1줄
  - 다중 시트 처리는 receivables 패턴 *확장*. workbook-session.ts 재사용
  - 시트별 컬럼 구조 미상 — 분석 필요 (plan 첫 단계 또는 사용자 명세)

## 대안 비교

### 대안 A: SharePoint 직접 read (receivables 패턴 확장)

- 핵심: page.tsx에서 Graph로 4년제~기타 시트 list + 각 시트 usedRange fetch → 통합/시트별 list-variants render. DB 없음
- 비용: ~6~10 파일 (queries 다중 시트 확장 + features/contracts + list-variants/contracts slot + page.tsx + 서버 캐시)
- 위험: 매 요청 Graph fetch 느림 → 서버 캐시 또는 segment revalidate 필요. rate limit
- 가역성: 높음 (DB 없음, 코드 제거만으로 원복)
- 학습: 다중 시트 Excel 통합 fetch 패턴 확립 — backup 도메인 등에 재사용 가능

### 대안 B: Excel → Folio DB ETL (services 패턴)

- 핵심: 일회성 import 스크립트 + contracts 테이블 + RLS + UI. SharePoint과 sync 안 함
- 비용: ~12~18 파일 (DB 마이그레이션 2 + features/contracts schemas/queries/actions + list-variants slot + page.tsx + import 스크립트)
- 위험: SharePoint과 sync 깨짐. 운영부가 SharePoint도 병행 편집 시 데이터 충돌. 시트별 컬럼 다양성 → 정규화 어려움
- 가역성: 중간 (DB drop + 코드 제거)
- 학습: services 패턴 재사용 — 본격 도메인 (FK 연동·통계·권한)

### 대안 C: 하이브리드 (row=SharePoint / 메타=DB)

- 핵심: 계약 row는 SharePoint 그대로 read + Folio DB에 운영 메타(담당자·상태·메모) 추가 저장. 자연키 join
- 비용: ~14~20 파일 (A + 메타 DB 일부)
- 위험: SharePoint row 변경 시 자연키 안정성 의존. 메타 매칭 깨질 위험
- 가역성: 낮음 (메타 데이터 손실 위험)
- 학습: 외부 source + 내부 메타 patterns

### 대안 Z: 아무것도 안 함

- 운영부가 SharePoint Excel 직접 열어 사용. Folio "계약" 메뉴는 placeholder 유지
- 우회: 현재 운영 유지 가능, 다만 Folio의 다른 도메인(services / backup)과 연동 단절

## 추천 + 근거

**추천: 대안 A — SharePoint 직접 read**

**선택 근거**:
1. **인프라 재사용**: receivables 도메인이 동일 패턴(`workbook-session.ts` + usedRange fetch)으로 안정 운영. 신규 인프라 0
2. **운영 현실 인정**: SharePoint이 source-of-truth (운영부가 직접 편집). Folio는 *조회 view* — sync 깨짐 위험 없음
3. **점진적 진화**: 사용 패턴 검증 후 PR-2에서 *필요한 부분만* DB 메타 도입(C) 또는 ETL(B) 전환 가능. 1차 PR 비용 최소화
4. **"최소" 명세 일치**: 사용자 "목록 리스트 중요한 부분만 최소" 요청 — DB 스키마 설계 우회

**기각된 대안 B**: services 패턴은 *Folio가 source*일 때 적합. 계약은 사용자가 SharePoint 직접 편집 — 일회성 import 후 sync 끊김 risk. ETL이 필요한 사용 케이스(권한 분리, FK 연동, 통계)가 명확해지면 PR-N로 follow-up.

**기각된 대안 C**: 초기 epic에 복잡도 과다. 자연키 안정성 보장 없이 메타 join 매칭 위험. A 운영 후 *진짜 필요한 메타*가 식별되면 follow-up.

## 다음 단계

- 저장됨: `.claude/memory/brainstorms/20260515-013850-sharepoint-contracts-menu.md`
- HARD-GATE: ~6~10 파일 → **간략 설계** ⇒ `/plan` 권장
- `/plan` **첫 단계**는 *시트 구조 자동 분석*:
  - Microsoft Graph `GET /workbook/worksheets` — 시트 이름 list
  - 각 시트 첫 N행 fetch — 헤더 추출
  - 결과를 plan spec에 spec column으로 반영 (최소 컬럼 식별 + 시트별 컬럼 차이 정합 결정)
- 그 후 PR-1 구현: queries 다중 시트 확장 + contracts list-variants slot + page.tsx + 서버 캐시
