import type { ContactCreate } from "./schemas";

type Field = keyof ContactCreate;

const ALIAS_GROUPS: [Field, string[]][] = [
  ["university_name", ["대학명", "학교명", "대학", "학교", "university"]],
  ["customer_name", ["고객명", "담당자명", "담당자", "이름", "성명", "name"]],
  ["contact_email", ["이메일", "메일", "email", "e-mail"]],
  [
    "contact_phone",
    ["전화", "전화번호", "연락처", "휴대폰", "핸드폰", "phone", "tel"],
  ],
  ["contact_ext", ["내선", "내선번호", "ext"]],
  ["job_title", ["직위", "직급", "title"]],
  ["department_name", ["부서", "부서명", "department", "dept"]],
  ["job_role", ["직무", "역할", "role"]],
  ["management_grade", ["관리등급"]],
  ["relationship_grade", ["관계등급"]],
  ["customer_active", ["재직", "재직여부", "상태", "active"]],
];

const HEADER_ALIASES: Record<string, Field> = {};
for (const [field, aliases] of ALIAS_GROUPS) {
  for (const a of aliases) HEADER_ALIASES[a.toLowerCase()] = field;
}

export type ParsedValues = Partial<Record<Field, string>>;

export type ParsedContactRow = {
  rowIndex: number;
  values: ParsedValues;
  errors: string[];
};

export type ParseResult = {
  rows: ParsedContactRow[];
  unmappedHeaders: string[];
  headerError?: string;
};

/** 엑셀 복사(TSV) 텍스트 → 헤더 유연 매핑 + 행 검증. 중복(DB) 판정은 액션에서. */
export function parsePastedContacts(text: string): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length === 0) {
    return {
      rows: [],
      unmappedHeaders: [],
      headerError: "붙여넣은 내용이 없습니다.",
    };
  }
  const headerCells = lines[0].split("\t").map((c) => c.trim());
  const fieldByCol = headerCells.map(
    (h): Field | null => HEADER_ALIASES[h.toLowerCase()] ?? null,
  );
  const unmappedHeaders = headerCells.filter((_, i) => fieldByCol[i] === null);
  const mapped = new Set(fieldByCol.filter((f): f is Field => f !== null));
  if (!mapped.has("university_name") || !mapped.has("customer_name")) {
    return {
      rows: [],
      unmappedHeaders,
      headerError:
        "필수 헤더(대학명·고객명)를 찾지 못했습니다. 첫 행에 열 이름을 포함해 주세요.",
    };
  }

  const rows: ParsedContactRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split("\t");
    const values: ParsedValues = {};
    fieldByCol.forEach((field, col) => {
      if (!field) return;
      const v = (cells[col] ?? "").trim();
      if (v !== "") values[field] = v;
    });
    if (values.customer_active === undefined) values.customer_active = "재직";
    const errors: string[] = [];
    if (!values.university_name) errors.push("대학명 누락");
    if (!values.customer_name) errors.push("고객명 누락");
    rows.push({ rowIndex: i, values, errors });
  }
  return { rows, unmappedHeaders };
}

/** ParsedValues → ContactCreate (누락 nullable=null, customer_active 기본 재직). */
export function toContactCreate(values: ParsedValues): ContactCreate {
  return {
    customer_active: values.customer_active ?? "재직",
    customer_name: values.customer_name ?? "",
    university_name: values.university_name ?? "",
    job_title: values.job_title ?? null,
    department_name: values.department_name ?? null,
    job_role: values.job_role ?? null,
    management_grade: values.management_grade ?? null,
    relationship_grade: values.relationship_grade ?? null,
    contact_phone: values.contact_phone ?? null,
    contact_ext: values.contact_ext ?? null,
    contact_email: values.contact_email ?? null,
  };
}
