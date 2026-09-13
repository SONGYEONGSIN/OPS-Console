import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  ASSIGNMENT_COLUMNS,
  ASSIGNMENT_NATURAL_KEY,
  ASSIGNMENT_ROLES,
} from "../ledger-schemas";
import { TENURE_GROUPS } from "../tenure";

/**
 * 코드 상수와 마이그레이션 원문을 대조한다.
 *
 * 왜 테스트로 막나: 쿼리 테스트는 **mock 에 대고** 단언하므로 컬럼명이 하나
 * 어긋나도 초록인 채로 프로덕션에서 죽는다. SMS 우편함의 RPC 계약이 같은 이유로
 * 원문 대조를 뒀고(`features/sms-codes/__tests__/rpc.test.ts`), 팀 값은 DB 제약을
 * 코드에서 파생할 수 없어 같은 방식으로 대조한다
 * (`features/operators/__tests__/team-single-source.test.ts`).
 *
 * 자연키는 **순서까지** 본다. unique 인덱스의 컬럼 순서가 코드가 만드는 키와
 * 어긋나면 중복 방지가 엉뚱한 조합에 걸린다.
 */
const MIGRATIONS = join(process.cwd(), "supabase", "migrations");
const LEDGER_SQL = "20260913_assignments_tables.sql";
const OPERATORS_SQL = "20260913b_operators_assignment_columns.sql";

/**
 * 줄 주석과 블록 주석을 지운다. **모든 원문 대조가 이 함수를 거친다.**
 *
 * 주석을 계약으로 읽으면 정의를 주석 처리하고도 초록이 된다 — 자연키 인덱스를
 * 주석으로 감싸도, `notify` 를 주석 처리해도, 옛 정의를 주석에 남긴 채 컬럼을
 * 바꿔도 통과했다. 이 마이그레이션은 하단에 검증용 주석 블록을 갖고 있어 주석
 * SQL 이 흔한 파일이다.
 *
 * 문자열 리터럴 안의 `--` 는 가려내지 않는다. 이 레포의 마이그레이션에는 그런
 * 리터럴이 없고, 생기면 이 함수를 먼저 고쳐야 한다.
 */
export function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");
}

function read(file: string): string {
  return stripSqlComments(readFileSync(join(MIGRATIONS, file), "utf8"));
}

/**
 * `create table [if not exists] public.<name> ( ... )` 의 본문을 잘라낸다.
 *
 * 괄호 깊이를 세므로 `check(...)` 안의 괄호에 속지 않는다. 주석은 **먼저** 지운다 —
 * 주석 속 짝 없는 괄호가 스캔을 망가뜨려, 여는 괄호 하나에는 던지고 닫는 괄호
 * 하나에는 컬럼이 조용히 잘렸다.
 */
export function tableBody(rawSql: string, table: string): string {
  const sql = stripSqlComments(rawSql);
  const m = new RegExp(
    `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${table}\\s*\\(`,
    "i",
  ).exec(sql);
  if (!m) throw new Error(`${table} 정의를 마이그레이션에서 찾지 못했다`);

  let depth = 0;
  let start = -1;
  for (let i = m.index + m[0].length - 1; i < sql.length; i++) {
    if (sql[i] === "(") {
      depth++;
      if (depth === 1) start = i + 1;
    } else if (sql[i] === ")") {
      depth--;
      if (depth === 0) {
        if (start < 0) break;
        return sql.slice(start, i);
      }
    }
  }
  throw new Error(`${table} 본문을 닫는 괄호가 없다`);
}

/** 본문을 최상위 콤마로 쪼갠다 — `check(...)` 안의 콤마는 건너뛴다. */
function topLevelEntries(body: string): string[] {
  const out: string[] = [];
  let level = 0;
  let cur = "";
  for (const ch of body) {
    if (ch === "(") level++;
    if (ch === ")") level--;
    if (ch === "," && level === 0) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.filter((s) => s.trim());
}

/** 한 컬럼의 정의 문장. `not null`·`default` 를 그 자리에서 본다. */
export function columnDefinition(
  rawSql: string,
  table: string,
  column: string,
): string {
  const hit = topLevelEntries(tableBody(rawSql, table)).find(
    (e) => e.trim().split(/\s+/)[0] === column,
  );
  if (!hit) throw new Error(`${table}.${column} 정의를 찾지 못했다`);
  return hit.trim();
}

/**
 * 주어진 파일들 중 이 테이블을 `alter` 하는 것. 계약이 표류하는 지점이다 —
 * 뒤에 오는 마이그레이션이 제약을 걷어내도 이 파일 텍스트는 그대로다.
 */
export function filesAltering(
  entries: { file: string; sql: string }[],
  table: string,
): string[] {
  const re = new RegExp(
    `alter\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${table}\\b`,
    "i",
  );
  return entries
    .filter((e) => re.test(stripSqlComments(e.sql)))
    .map((e) => e.file);
}

/** `create table` 의 컬럼명을 순서대로 뽑는다. */
export function tableColumns(rawSql: string, table: string): string[] {
  return (
    topLevelEntries(tableBody(rawSql, table))
      .map((e) => e.trim().split(/\s+/)[0])
      // 테이블 수준 제약(constraint/check/unique/primary key 등)은 컬럼이 아니다.
      .filter(
        (name) =>
          name &&
          !/^(constraint|check|unique|primary|foreign|exclude)$/i.test(name),
      )
  );
}

describe("assignments 테이블 계약", () => {
  const sql = read(LEDGER_SQL);

  it("컬럼명이 코드 상수와 같다 — 순서까지", () => {
    expect(tableColumns(sql, "assignments")).toEqual([...ASSIGNMENT_COLUMNS]);
  });

  it("자연키 unique 인덱스의 컬럼 순서가 코드와 같다", () => {
    const m =
      /create\s+unique\s+index\s+(?:if\s+not\s+exists\s+)?assignments_natural_key[\s\S]{0,120}?\(([^)]*)\)/i.exec(
        sql,
      );
    expect(m, "assignments_natural_key 인덱스를 찾지 못했다").not.toBeNull();
    const cols = m![1].split(",").map((c) => c.trim());
    expect(cols).toEqual([...ASSIGNMENT_NATURAL_KEY]);
  });

  /**
   * **테이블을 지정해 본다.** 원문 전체 대조로는 거짓 통과한다 — `subtype` 은
   * 원장·이력·제안 세 테이블에 모두 있어서, 원장의 `not null default ''` 가
   * 사라져도 다른 테이블의 같은 줄이 정규식을 만족시킨다. 이 계약이 지켜야 하는
   * 것은 **원장의** 자연키다.
   */
  it("assignments.subtype 이 not null default '' 다 — null 이면 자연키가 무력해진다", () => {
    const def = columnDefinition(sql, "assignments", "subtype");
    expect(def).toMatch(/not\s+null/i);
    expect(def).toMatch(/default\s+''/);
  });

  it("role check 값이 ASSIGNMENT_ROLES 와 같은 집합이다", () => {
    const m =
      /role\s+text\s+not\s+null\s+check\s*\(\s*role\s+in\s*\(([^)]*)\)/i.exec(
        sql,
      );
    expect(m, "role check 제약을 찾지 못했다").not.toBeNull();
    const values = [...m![1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect(values.sort()).toEqual([...ASSIGNMENT_ROLES].sort());
  });

  it("work_kind 에는 check 를 걸지 않는다 — 시트가 자란다", () => {
    expect(sql).not.toMatch(/check\s*\(\s*work_kind\s+in/i);
  });

  it("이력이 '안 바뀐 것'을 거부한다", () => {
    expect(sql).toMatch(
      /prev_assignee\s+is\s+distinct\s+from\s+next_assignee/i,
    );
  });

  it("네 테이블이 모두 있다 — 원장·이력·제안·배치", () => {
    for (const t of [
      "assignments",
      "assignment_changes",
      "assignment_proposal_batches",
      "assignment_proposals",
    ]) {
      expect(sql, t).toMatch(
        new RegExp(
          `create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?public\\.${t}\\b`,
          "i",
        ),
      );
    }
  });

  it("스키마 캐시를 갱신한다 — 안 하면 조회가 404 다", () => {
    expect(sql).toMatch(/notify\s+pgrst,\s*'reload schema'/i);
  });
});

/**
 * `notify pgrst` 는 **`commit` 앞**에 둔다.
 *
 * 트랜잭션 안의 NOTIFY 는 커밋 시점에 전달되고 밖에 두면 자기 트랜잭션으로 도니
 * 동작은 양쪽 다 된다. 자리를 못 박는 이유는 **두 파일이 서로 다른 자리에 두면
 * 다음 사람이 어느 쪽이 맞는지 알 수 없기** 때문이다. 문자 우편함 마이그레이션이
 * `commit` 앞에 둔다(`20260911_sms_code_inbox.sql:143-145`).
 */
describe("notify pgrst 는 commit 앞에 있다", () => {
  it.each([LEDGER_SQL, OPERATORS_SQL])("%s", (file) => {
    const sql = read(file);
    const notify = sql.search(/notify\s+pgrst/i);
    const commit = sql.search(/\bcommit\s*;/i);
    expect(notify, "notify pgrst 가 없다").toBeGreaterThan(-1);
    expect(commit, "commit 이 없다").toBeGreaterThan(-1);
    expect(notify).toBeLessThan(commit);
  });
});

describe("operators 배정 칸 계약", () => {
  const sql = read(OPERATORS_SQL);

  it("세 칸을 더한다 — assignable·tenure_group·career_start_at", () => {
    for (const col of ["assignable", "tenure_group", "career_start_at"]) {
      expect(sql, col).toMatch(
        new RegExp(`add\\s+column\\s+if\\s+not\\s+exists\\s+${col}\\b`, "i"),
      );
    }
  });

  it("assignable 기본값이 false 다 — 새로 온 사람에게 대학이 저절로 가지 않는다", () => {
    expect(sql).toMatch(/assignable\s+boolean\s+not\s+null\s+default\s+false/i);
  });

  it("tenure_group 에 check 를 걸지 않는다 — 그룹이 늘 때 저장이 500 으로 죽는다", () => {
    expect(sql).not.toMatch(/check\s*\(\s*tenure_group\s+in/i);
  });

  it("시드가 이름으로 한다 — 이메일이 원천마다 갈려 있다", () => {
    expect(sql).toMatch(/where\s+name\s+in\s*\(/i);
    expect(sql).not.toMatch(/where\s+email\s+in\s*\(/i);
  });

  /**
   * 시드가 넣는 그룹 값과 코드 상수는 같은 어휘여야 한다. 마이그레이션 주석이
   * "값은 `features/assignments/tenure.ts` 의 as const + zod" 라고 선언하는데,
   * 그걸 지키는 검사가 없으면 한쪽만 바뀐다.
   *
   * **위험은 비대칭이다.** DB 에만 있는 값이 생기면 zod 가 그 사람의 행을 거부해
   * 조직 화면 저장이 막힌다. 반대(코드에만 있는 그룹)는 아무도 그 그룹에 없다는
   * 뜻일 뿐이라 해롭지 않다 — 그래서 부분집합만 단언한다.
   */
  it("시드가 넣는 tenure_group 이 모두 TENURE_GROUPS 안에 있다", () => {
    const seeded = [
      ...new Set(
        [...sql.matchAll(/tenure_group\s*=\s*'([^']+)'/gi)].map((m) => m[1]),
      ),
    ];
    // 정규식이 하나도 못 잡아도 통과하는 일이 없게 — 조용한 0건이 이 레포의 함정이다.
    expect(
      seeded.length,
      "시드에서 tenure_group 대입을 찾지 못했다",
    ).toBeGreaterThan(0);
    for (const value of seeded) {
      expect([...TENURE_GROUPS], value).toContain(value);
    }
  });
});

/**
 * Supabase 의 PostgREST 경로(authenticator 롤)는 `safeupdate` 가 켜져 있어 WHERE 없는
 * UPDATE/DELETE 를 `21000` 으로 거부한다. SQL Editor 에서는 통과해 실호출에서만
 * 드러난다(2026-09-11). 시드가 UPDATE 라 여기서 본다.
 */
describe("safeupdate — WHERE 없는 UPDATE/DELETE 가 없다", () => {
  it.each([LEDGER_SQL, OPERATORS_SQL])("%s", (file) => {
    const statements = read(file)
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    const mutating = statements.filter(
      (s) =>
        /\bdelete\s+from\b/i.test(s) ||
        /\bupdate\s+\S+\s+set\b/i.test(s.replace(/\bdo\s+update\b/gi, "")),
    );
    for (const s of mutating) expect(s, s).toMatch(/\bwhere\b/i);
  });
});

describe("추출기가 동작한다", () => {
  it("테이블 수준 제약을 컬럼으로 세지 않는다", () => {
    const sample = `
      create table if not exists public.sample (
        id uuid primary key default gen_random_uuid(),
        role text not null check (role in ('운영','개발')),
        note text,
        constraint sample_chk check (note is distinct from role)
      );
    `;
    expect(tableColumns(sample, "sample")).toEqual(["id", "role", "note"]);
  });

  it("없는 테이블이면 던진다 — 조용히 0건이 되지 않는다", () => {
    expect(() => tableColumns("select 1;", "nope")).toThrow(/찾지 못했다/);
  });
});

/**
 * **주석은 계약이 아니다.**
 *
 * 원문을 그대로 단언하면 주석을 살아있는 DDL 로 읽는다 — 자연키 인덱스를 주석
 * 처리해도, `notify` 를 주석 처리해도, 옛 정의를 주석에 남긴 채 컬럼을 바꿔도
 * 테스트가 초록이었다. 이 파일의 머리말이 "mock 에 대고 단언하면 이름이 어긋나도
 * 초록인 채로 프로덕션에서 죽는다" 인데, 주석을 계약으로 읽으면 같은 눈먼 지점이다.
 * 이 마이그레이션은 하단에 검증용 주석 블록을 갖고 있어 주석 SQL 이 흔하다.
 */
describe("주석 제거", () => {
  it("줄 주석과 블록 주석을 함께 지운다", () => {
    const stripped = stripSqlComments(`
      create table public.x ( id uuid );  -- 줄주석표식
      /* 블록주석표식
         여러 줄 */
      notify pgrst, 'reload schema';
    `);
    expect(stripped).not.toMatch(/줄주석표식/);
    expect(stripped).not.toMatch(/블록주석표식/);
    expect(stripped).toMatch(/notify pgrst/);
  });

  it("주석 처리된 DDL 을 살아있는 정의로 세지 않는다", () => {
    const stripped = stripSqlComments(`
      -- create unique index assignments_natural_key on public.assignments (a, b);
      /* create table public.ghost ( id uuid ); */
    `);
    expect(stripped).not.toMatch(/assignments_natural_key/);
    expect(() => tableColumns(stripped, "ghost")).toThrow(/찾지 못했다/);
  });

  it("주석 속 짝 없는 괄호에 괄호 스캔이 속지 않는다", () => {
    const sample = `
      create table public.sample (
        id uuid,       -- 라벨 (
        name text,     -- 닫는 것만 )
        note text
      );
    `;
    expect(tableColumns(sample, "sample")).toEqual(["id", "name", "note"]);
  });
});

/**
 * 자연키 다섯 칸은 **전부** not null 이어야 한다. 근거는 `subtype` 에 적은 것과
 * 같다 — 한 칸이라도 null 이면 unique 가 중복 방지를 멈춘다. 지금까지 `subtype`
 * 과 `role` 두 칸만 검사돼 나머지 셋은 not null 이 사라져도 초록이었다.
 */
describe("자연키 다섯 칸이 모두 not null 이다", () => {
  const sql = read(LEDGER_SQL);

  it.each([...ASSIGNMENT_NATURAL_KEY])("%s", (col) => {
    expect(columnDefinition(sql, "assignments", col)).toMatch(/not\s+null/i);
  });

  it("검사기가 not null 빠진 칸을 잡는다", () => {
    const sample = `
      create table public.sample (
        academic_year   smallint,
        university_name text not null
      );
    `;
    expect(columnDefinition(sample, "sample", "academic_year")).not.toMatch(
      /not\s+null/i,
    );
    expect(columnDefinition(sample, "sample", "university_name")).toMatch(
      /not\s+null/i,
    );
  });
});

/**
 * 이 계약은 자기 파일의 `create table` 원문만 본다. 뒤에 오는 마이그레이션이
 * `role` check 나 not null 을 걷어내도 이 파일 텍스트는 그대로라 초록이다.
 * `operators/__tests__/team-single-source.test.ts` 는 전 마이그레이션을 훑어
 * **마지막 정의**를 채택해 이 문제를 이미 풀어 뒀다. 여기서는 더 단순하게,
 * 이 테이블을 나중에 고치는 파일이 없다는 것을 못 박는다 — 생기면 이 테스트가
 * 먼저 깨져서 계약을 어디로 옮길지 결정하게 만든다.
 */
describe("뒤에서 고치는 마이그레이션이 없다", () => {
  it("assignments 를 alter 하는 다른 파일이 없다", () => {
    const others = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith(".sql") && f !== LEDGER_SQL)
      .map((f) => ({ file: f, sql: read(f) }));
    expect(filesAltering(others, "assignments")).toEqual([]);
  });

  it("검사기가 뒤늦은 alter 를 잡는다", () => {
    expect(
      filesAltering(
        [
          { file: "a.sql", sql: "select 1;" },
          {
            file: "b.sql",
            sql: "alter table public.assignments drop constraint x;",
          },
          {
            file: "c.sql",
            sql: "alter table public.assignment_changes add x;",
          },
        ],
        "assignments",
      ),
    ).toEqual(["b.sql"]);
  });
});

/**
 * 권한 경계를 원문에 못 박는다. 이 레포에는 정책·GRANT 를 단언하는 테스트가
 * 없었다 — 쓰기 정책이 실수로 하나 생기거나 `grant all to authenticated` 가
 * 끼어들면 아무도 모른다. 설계 §5.5 가 정한 것은 넷이다: 네 테이블 행 보안,
 * 원장·이력은 읽기만, 제안·배치는 관리자만 읽기, authenticated 에게 쓰기 없음.
 */
describe("권한 경계", () => {
  const sql = read(LEDGER_SQL);
  const TABLES = [
    "assignments",
    "assignment_changes",
    "assignment_proposals",
    "assignment_proposal_batches",
  ];

  it.each(TABLES)("%s 에 행 보안이 켜져 있다", (t) => {
    expect(sql).toMatch(
      new RegExp(
        `alter\\s+table\\s+public\\.${t}\\s+enable\\s+row\\s+level\\s+security`,
        "i",
      ),
    );
  });

  it("원장과 이력에 쓰기 정책이 없다 — 서버만 쓴다", () => {
    expect(sql).not.toMatch(
      /on\s+public\.assignments(_changes)?\s+for\s+(insert|update|delete)/i,
    );
  });

  /**
   * 읽기는 관리자 판정을 타고, **그 판정은 한 번만 불린다.**
   *
   * 맨 `using (public.is_admin())` 은 qual 에 컬럼 참조가 없어도 Postgres 가
   * **행마다** 평가한다. 실측으로 5,720행에서 5,720회 · 250ms 였고,
   * `(select public.is_admin())` 으로 감싸면 InitPlan 으로 올라가 1회 · 1.7ms 다.
   * 차단 동작은 그대로다(비-admin 0행). 제안 테이블은 설계상 연간 배치 한 건이
   * 286대학 × 20칸 = 5,720행이라, 관리자가 탭을 열 때마다 이 비용을 낸다.
   *
   * 레포의 다른 정책은 맨 호출이지만 **행이 수천이 되는 첫 테이블이 이것이다.**
   */
  it.each(["assignment_proposals", "assignment_proposal_batches"])(
    "%s 읽기가 관리자 판정을 타고 그 판정이 한 번만 불린다",
    (t) => {
      expect(sql).toMatch(
        new RegExp(
          `on\\s+public\\.${t}\\s+for\\s+select[\\s\\S]{0,200}?using\\s*\\(\\s*\\(\\s*select\\s+public\\.is_admin\\(\\)`,
          "i",
        ),
      );
    },
  );

  it("맨 is_admin() 을 쓰지 않는다 — 감싸지 않으면 행마다 불린다", () => {
    expect(sql).not.toMatch(/using\s*\(\s*public\.is_admin\(\)/i);
  });

  it("authenticated 에게 쓰기 권한을 주지 않는다", () => {
    expect(sql).not.toMatch(
      /grant\s+(all|insert|update|delete)[^;]*\bto\s+authenticated/i,
    );
  });

  /**
   * **기본 권한을 명시적으로 회수한다.** Supabase 는 public 스키마의 새 테이블에
   * 기본 권한을 깔아 주므로, 우리가 아무 GRANT 를 안 써도 `anon` 이 테이블에 닿을
   * 수 있고 그때 막아 주는 것은 RLS 하나뿐이다. 정책 한 줄이 잘못 열리면 그대로
   * 공개된다. 문자 우편함 마이그레이션이 같은 이유로 회수를 먼저 쓴다
   * (`20260911_sms_code_inbox.sql:30-33`).
   */
  it.each(TABLES)("%s 의 기본 권한을 anon 에서 회수한다", (t) => {
    expect(sql).toMatch(
      new RegExp(
        `revoke\\s+all\\s+on\\s+public\\.${t}\\s+from[^;]*\\banon\\b`,
        "i",
      ),
    );
  });
});
