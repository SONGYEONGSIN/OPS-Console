import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DOMAIN_SELECTS } from "../search";
import { FETCH_CONFIG } from "../fetch-ops";

/**
 * 검색이 조회하는 컬럼이 실제 스키마에 있는지 마이그레이션과 대조한다.
 *
 * 왜 이 테스트가 필요한가 — 2026-08-18에 7개 도메인 중 **둘이 죽어 있었다**:
 *   handover_records.title  없음 (실제로는 *_md 11개로 나뉘어 있다)
 *   ai_tips.summary         없음 (실제 이름은 summary_md)
 *
 * 죽은 방식이 고약하다. supabase-js는 에러를 던지지 않고 `{data: null, error}`를
 * 돌려주는데, 각 도메인이 `if (!data) return []`로 받는다. 그래서 쿼리가 실패해도
 * **검색은 "그런 자료 없음"으로 조용히 답한다.** 인수인계 3,155자가 있는데도
 * 어시스턴트가 "넣을 내용이 아직 없습니다"라고 답한 것이 이 때문이다.
 *
 * 단위 테스트로는 못 잡는다 — Supabase를 목으로 대신하면 컬럼 이름이 틀려도 통과한다.
 * 실제 DB에 붙는 검사는 CI에 자격이 없어 못 돌린다. 그래서 **마이그레이션 SQL을
 * 스키마의 근거로 삼는다.** DB 없이 돌고, 컬럼을 안 만들고 쓰는 것을 잡는다.
 */
const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

/** 마이그레이션 전체를 훑어 테이블별 컬럼 집합을 만든다. */
function schemaFromMigrations(): Map<string, Set<string>> {
  const tables = new Map<string, Set<string>>();
  const add = (table: string, col: string) => {
    const key = table.replace(/^public\./, "");
    if (!tables.has(key)) tables.set(key, new Set());
    tables.get(key)?.add(col);
  };

  for (const f of readdirSync(MIGRATIONS)
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = readFileSync(join(MIGRATIONS, f), "utf8");

    // create table [if not exists] public.foo ( ... );
    for (const m of sql.matchAll(
      /create\s+table\s+(?:if\s+not\s+exists\s+)?([\w.]+)\s*\(([\s\S]*?)\n\s*\);/gi,
    )) {
      const body = m[2]
        .split("\n")
        .map((l) => l.replace(/--.*$/, "").trim())
        .filter(Boolean);
      for (const line of body) {
        // 컬럼 정의는 `이름 타입…` — 제약 절(primary key, unique, check, …)은 건너뛴다
        const c = /^([a-z_][a-z0-9_]*)\s+[a-z]/i.exec(line);
        if (!c) continue;
        if (
          /^(primary|unique|check|constraint|foreign|references|create|begin|commit)$/i.test(
            c[1],
          )
        ) {
          continue;
        }
        add(m[1], c[1]);
      }
    }

    // alter table public.foo add column [if not exists] bar type
    for (const m of sql.matchAll(
      /alter\s+table\s+(?:if\s+exists\s+)?([\w.]+)([\s\S]*?);/gi,
    )) {
      for (const c of m[2].matchAll(
        /add\s+column\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/gi,
      )) {
        add(m[1], c[1]);
      }
    }
  }
  return tables;
}

/** "a, b, other(c, d)" → { columns: [a,b], embeds: [{table:"other", columns:[c,d]}] } */
function parseSelect(sel: string): {
  columns: string[];
  embeds: { table: string; columns: string[] }[];
} {
  const embeds: { table: string; columns: string[] }[] = [];
  const rest = sel.replace(
    /([a-z_][a-z0-9_]*)\s*\(([^)]*)\)/gi,
    (_all, table: string, inner: string) => {
      embeds.push({
        table,
        columns: inner
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      });
      return "";
    },
  );
  const columns = rest
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { columns, embeds };
}

const schema = schemaFromMigrations();

describe("검색 도메인 select — 실제 스키마와 대조", () => {
  it("마이그레이션에서 스키마를 뽑는다", () => {
    // 파서가 망가지면 아래 검사가 전부 공허하게 통과하므로 먼저 확인한다.
    expect(schema.get("handover_records")).toContain("work_basic_md");
    expect(schema.get("ai_tips")).toContain("summary_md");
    expect(schema.get("services")).toContain("university_name");
  });

  for (const [table, sel] of Object.entries(DOMAIN_SELECTS)) {
    it(`${table}의 조회 컬럼이 전부 실재한다`, () => {
      const known = schema.get(table);
      expect(known, `${table} 정의를 마이그레이션에서 못 찾음`).toBeDefined();

      const { columns, embeds } = parseSelect(sel);
      for (const col of columns) {
        expect(known, `${table}.${col} 없음`).toContain(col);
      }
      for (const e of embeds) {
        const target = schema.get(e.table);
        expect(target, `조인 대상 ${e.table} 정의 없음`).toBeDefined();
        for (const col of e.columns) {
          expect(target, `${e.table}.${col} 없음`).toContain(col);
        }
      }
    });
  }
});

describe("전문 조회(fetch) 컬럼 — 실제 스키마와 대조", () => {
  // search에서 겪은 그 버그(없는 컬럼 → 조용한 0건)가 fetch에서 되풀이되지 않게
  // 같은 방식으로 막는다. 여기 컬럼이 틀리면 `data: null` → "내용 없음"이 된다.
  for (const [domain, cfg] of Object.entries(FETCH_CONFIG)) {
    it(`${domain}의 전문 컬럼이 전부 실재한다`, () => {
      const known = schema.get(cfg.table);
      expect(
        known,
        `${cfg.table} 정의를 마이그레이션에서 못 찾음`,
      ).toBeDefined();

      for (const col of [
        cfg.idColumn,
        ...cfg.titleFields,
        ...cfg.bodyFields.map((f) => f.key),
      ]) {
        expect(known, `${cfg.table}.${col} 없음`).toContain(col);
      }

      if (cfg.embed) {
        const { embeds } = parseSelect(cfg.embed);
        for (const e of embeds) {
          const target = schema.get(e.table);
          expect(target, `조인 대상 ${e.table} 정의 없음`).toBeDefined();
          for (const col of e.columns) {
            expect(target, `${e.table}.${col} 없음`).toContain(col);
          }
        }
      }
    });
  }
});

/**
 * 위 검사는 "없는 컬럼을 조회하는 것"을 잡는다. 반대 방향 — **있는 데이터를
 * 안 실어 보내는 것**은 못 잡는데, 증상이 똑같이 조용하다.
 *
 * 실제 사고(2026-08-19): "조선대 연락처 알려줘"에 어시스턴트가 "연락 수단을
 * 알 수 없다"고 답하고 빈틈까지 남겼다. 그런데 DB에는 343건 중 전화 205·
 * 이메일 261건이 들어 있었다. 검색도 전문 조회도 그 두 컬럼을 안 실었을 뿐이다.
 *
 * 연락처를 묻는 질문에 연락 수단이 없으면 그 도메인은 있으나 마나다.
 */
describe("연락처는 연락 수단을 실어 보낸다", () => {
  it("검색이 전화·이메일을 조회한다", () => {
    expect(DOMAIN_SELECTS.contacts).toContain("contact_phone");
    expect(DOMAIN_SELECTS.contacts).toContain("contact_email");
  });

  it("전문 조회가 전화·이메일을 본문에 담는다", () => {
    const keys = FETCH_CONFIG.contact.bodyFields.map((f) => f.key);
    expect(keys).toContain("contact_phone");
    expect(keys).toContain("contact_email");
  });
});
