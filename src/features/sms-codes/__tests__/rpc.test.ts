import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CLAIM_ROW_COLUMNS,
  CLAIM_RPC,
  POP_ROW_COLUMNS,
  POP_RPC,
  PUSH_RPC,
  claimArgs,
  popArgs,
  pushArgs,
} from "../rpc";

/**
 * 라우트 테스트는 rpc 이름·인자를 **mock 에 대고** 단언한다. 마이그레이션의 파라미터
 * 이름이 하나만 달라도 테스트는 초록인 채로 프로덕션에서 500 이 나고, 스크래퍼는
 * 조용히 make 로 폴백해 크레딧을 태운다. 그래서 SQL 원문을 읽어 대조한다
 * (`operators/__tests__/team-single-source.test.ts` 와 같은 방식).
 */
const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260911_sms_code_inbox.sql"),
  "utf8",
);

function signature(fn: string): { params: string[]; columns: string[] } {
  const m = new RegExp(
    `create or replace function public\\.${fn}\\(([^)]*)\\)\\s*returns (table \\(([^)]*)\\)|\\w+)`,
    "i",
  ).exec(sql);
  if (!m) throw new Error(`${fn} 정의를 마이그레이션에서 찾지 못했습니다`);
  const names = (list: string) =>
    list.split(",").map((p) => p.trim().split(/\s+/)[0]);
  return { params: names(m[1]), columns: m[3] ? names(m[3]) : [] };
}

describe("RPC 계약 — 라우트가 보내는 것과 마이그레이션 시그니처가 같다", () => {
  it("push_sms_code 파라미터 이름", () => {
    expect(signature(PUSH_RPC).params).toEqual(Object.keys(pushArgs("130753")));
  });

  it("claim_sms_inbox 파라미터 이름·순서", () => {
    expect(signature(CLAIM_RPC).params).toEqual(
      Object.keys(claimArgs("closing", 180)),
    );
  });

  it("claim_sms_inbox 반환 컬럼", () => {
    expect(signature(CLAIM_RPC).columns).toEqual([...CLAIM_ROW_COLUMNS]);
  });

  it("pop_sms_code 파라미터 이름", () => {
    expect(signature(POP_RPC).params).toEqual(Object.keys(popArgs("closing")));
  });

  it("pop_sms_code 반환 컬럼", () => {
    expect(signature(POP_RPC).columns).toEqual([...POP_ROW_COLUMNS]);
  });
});

/**
 * Supabase 의 PostgREST 경로(authenticator 롤)는 `safeupdate` 가 켜져 있어 WHERE 없는
 * DELETE/UPDATE 를 `21000 DELETE requires a WHERE clause` 로 거부한다 — **함수 안이라도**
 * 마찬가지다. SQL Editor(postgres 롤)와 Docker Postgres 에서는 통과해서 `.rpc()` 실호출에서만
 * 드러났다(2026-09-11, claim_sms_inbox 의 전체 비우기). 주석은 벗기고 문장 단위로 본다.
 */
describe("safeupdate — WHERE 없는 DELETE/UPDATE 가 없다", () => {
  const statements = sql
    .replace(/--[^\n]*/g, "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  it("delete/update 문마다 where 절이 있다", () => {
    const mutating = statements.filter(
      (s) =>
        /\bdelete\s+from\b/i.test(s) ||
        /\bupdate\s+\S+\s+set\b/i.test(s.replace(/\bdo\s+update\b/gi, "")),
    );
    expect(mutating.length).toBeGreaterThan(0);
    for (const s of mutating) expect(s, s).toMatch(/\bwhere\b/i);
  });
});
