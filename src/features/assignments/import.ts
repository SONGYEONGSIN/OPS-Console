import type { AssignmentRecord } from "./schemas";
import type { AssignmentRole, AssignmentWorkKind } from "./ledger-schemas";

/**
 * 총괄장 시트 → 배정 원장 행. **파서는 손대지 않는다** — 입력은 `parse.ts` 의
 * `AssignmentRecord[]` 그대로다(설계 PR3).
 *
 * 이 모듈은 순수 함수다. DB 도 Graph 도 부르지 않아, 이관이 무엇을 만들지
 * fixture 로 못 박을 수 있다. 적재는 server action 의 일이다.
 */

/** 원장에 넣기 전 한 행. `assignee_email` 은 이름 매칭 뒤에 채운다. */
export type LedgerRowDraft = {
  academic_year: number;
  university_name: string;
  work_kind: AssignmentWorkKind;
  subtype: string;
  role: AssignmentRole;
  /** 시트 칸의 이름 스냅샷. 이메일 매칭이 실패해도 이것만은 남는다(F2). */
  assignee_name: string;
  /** 02 시트 '대분류' 스냅샷. 원서접수 행에만 있다. */
  university_type?: string;
};

/** 사람이 고쳐야 하는 것. **추측해 채우지 않고 보고한다**(설계 F1). */
export type ImportIssue = {
  kind: "pims-ambiguous" | "duplicate-conflict";
  university: string;
  detail: string;
};

/** PIMS 환/충 값이 `detail` 에 실려 오는 라벨 — `parsePims` 가 붙인다. */
const PIMS_HWAN_LABEL = "운영자 환/충";

/**
 * 대학명 정규화는 **공백 정리까지만** 한다.
 *
 * `서울대` 와 `서울대학교` 를 잇지 않는다 — 별칭을 추측해 이으면 틀린 대학에
 * 배정이 붙고, 그게 틀렸다는 것을 아무도 모른다. 표기가 갈린 건은 미배정으로
 * 드러나고 사람이 고친다(설계 F1).
 *
 * 공백만 다듬는 이유는 자연키 때문이다 — `''` 와 `' '` 도, `서울 대학교` 와
 * `서울  대학교` 도 unique 에는 서로 다른 값이다.
 */
export function normalizeUniversityName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function draft(
  academicYear: number,
  record: AssignmentRecord,
  subtype: string,
  role: AssignmentRole,
  assigneeName: string,
): LedgerRowDraft {
  return {
    academic_year: academicYear,
    university_name: normalizeUniversityName(record.university),
    work_kind: record.service,
    subtype: subtype.trim(),
    role,
    assignee_name: assigneeName.trim(),
    university_type: record.universityType,
  };
}

/**
 * 원서접수는 **하위유형별 칸**이 배정의 단위다(설계 §3.1).
 *
 * `record.operator`/`developer` 는 그리드 대표값(2027 수시)이라 쓰지 않는다 —
 * 쓰면 수시 행이 두 벌 생긴다. `subtypes` 는 파서가 2027 블록만 담으므로
 * 2026 칸은 여기로 오지 않는다(이관 대상은 현재 학년도다).
 */
function reception(
  academicYear: number,
  record: AssignmentRecord,
): LedgerRowDraft[] {
  const out: LedgerRowDraft[] = [];
  for (const st of record.subtypes ?? []) {
    if (st.operator)
      out.push(draft(academicYear, record, st.label, "운영", st.operator));
    if (st.developer)
      out.push(draft(academicYear, record, st.label, "개발", st.developer));
  }
  return out;
}

/**
 * PIMS 는 `FULL` / `환충` 두 하위유형이고 **개발자가 없다**(설계 §3.1).
 *
 * `parsePims` 가 `operator = full || hwan` 으로 두 칸을 하나로 접어 주므로
 * 역산이 필요하다. 라이브 실측(2026-09-13)에서 **두 칸이 동시에 채워진 행은
 * 0건**이라(FULL만 72 · 환충만 10) 역산이 무손실이다. 다만 그건 오늘 데이터의
 * 성질이지 불변식이 아니어서, 구분이 안 되는 경우는 **발명하지 않고 보고한다**.
 */
function pims(
  academicYear: number,
  record: AssignmentRecord,
): { rows: LedgerRowDraft[]; issues: ImportIssue[] } {
  const hwan =
    record.detail.find((d) => d.label === PIMS_HWAN_LABEL)?.value.trim() ?? "";
  const operator = record.operator.trim();

  if (!hwan) {
    return {
      rows: operator
        ? [draft(academicYear, record, "FULL", "운영", operator)]
        : [],
      issues: [],
    };
  }

  const rows = [draft(academicYear, record, "환충", "운영", hwan)];
  if (!operator || operator === hwan) {
    // operator 가 환충과 같다 — FULL 이 비어서 대체된 것인지, 둘이 같은 사람인지
    // 파서 출력만으로는 갈리지 않는다. FULL 행을 만들면 없는 배정을 발명한다.
    return {
      rows,
      issues: operator
        ? [
            {
              kind: "pims-ambiguous",
              university: record.university,
              detail: `운영자 FULL 과 환/충 이 같은 값('${hwan}')으로 읽혀 FULL 배정 여부를 가릴 수 없다. FULL 행을 만들지 않았다.`,
            },
          ]
        : [],
    };
  }
  rows.push(draft(academicYear, record, "FULL", "운영", operator));
  return { rows, issues: [] };
}

/** 하위유형이 없는 업무(대학원·성적산출·상담앱) — `subtype` 은 빈 문자열이다. */
function plain(
  academicYear: number,
  record: AssignmentRecord,
): LedgerRowDraft[] {
  const out: LedgerRowDraft[] = [];
  if (record.operator.trim())
    out.push(draft(academicYear, record, "", "운영", record.operator));
  if (record.developer.trim())
    out.push(draft(academicYear, record, "", "개발", record.developer));
  return out;
}

const keyOf = (r: LedgerRowDraft) =>
  [r.academic_year, r.university_name, r.work_kind, r.subtype, r.role].join(
    "|",
  );

/**
 * 시트 레코드 → 원장 행 + 사람이 볼 이슈.
 *
 * **빈 칸은 행을 만들지 않는다.** 미배정은 설계가 정상으로 인정한 상태이고(F2),
 * 빈 칸으로 행을 만들면 이력 적재에서 `prev=next=null` 이 되어 check 제약이
 * 트랜잭션을 통째로 죽인다(`23514`).
 *
 * 자연키로 접어 **멱등**이다. 같은 값이 두 번 오면 한 행이고, **다른 이름이 두 번
 * 오면 이슈를 남긴다** — 조용히 접으면 배정 하나가 말없이 사라진다.
 */
export function toLedgerRows(
  records: AssignmentRecord[],
  academicYear: number,
): { rows: LedgerRowDraft[]; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const drafts: LedgerRowDraft[] = [];

  for (const record of records) {
    if (record.service === "원서접수") {
      drafts.push(...reception(academicYear, record));
    } else if (record.service === "PIMS") {
      const r = pims(academicYear, record);
      drafts.push(...r.rows);
      issues.push(...r.issues);
    } else {
      drafts.push(...plain(academicYear, record));
    }
  }

  const byKey = new Map<string, LedgerRowDraft>();
  for (const row of drafts) {
    const key = keyOf(row);
    const seen = byKey.get(key);
    if (seen && seen.assignee_name !== row.assignee_name) {
      issues.push({
        kind: "duplicate-conflict",
        university: row.university_name,
        detail: `${row.work_kind}${row.subtype ? ` · ${row.subtype}` : ""} · ${row.role} 칸에 이름이 둘이다 — 뒤에 온 값을 쓴다.`,
      });
    }
    byKey.set(key, row);
  }

  return { rows: [...byKey.values()], issues };
}
