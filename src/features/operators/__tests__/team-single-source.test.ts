import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { OPERATOR_TEAMS } from "@/features/auth/operators";
import { operatorTeamSchema } from "@/features/operators/schemas";

/**
 * 팀 값은 `OPERATOR_TEAMS` 한 곳에서만 정의한다.
 *
 * 왜 테스트로 막나:
 * 기획팀을 등재할 때 타입·DB 제약·드롭다운은 고쳤는데 zod 스키마 하나를 빠뜨렸다.
 * `listOperators()`가 zod 실패 행을 조용히 건너뛰는 탓에 그 사람만 조직권한 목록에서
 * 사라졌는데, 타입 검사도 테스트도 CI도 전부 통과했다 — 값이 네 곳에 흩어져 있으면
 * 컴파일러가 누락을 볼 방법이 없기 때문이다.
 *
 * 코드 세 곳은 이제 OPERATOR_TEAMS에서 파생되므로 구조적으로 어긋날 수 없다.
 * DB 제약만은 코드에서 파생이 불가능해서, 여기서 마이그레이션 원문과 대조한다.
 */
const MIGRATIONS = join(process.cwd(), "supabase", "migrations");

/** 마이그레이션들에서 operators_team_check의 **마지막** 정의를 찾아 값 목록을 뽑는다. */
function latestTeamCheckValues(): string[] {
  // Postgres는 파일명 순서대로 적용되므로, 마지막 정의가 현재 제약이다.
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  let found: string[] | null = null;
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), "utf8");
    // `add constraint operators_team_check check (team in ('...','...'))`
    const m =
      /operators_team_check[\s\S]{0,80}?check\s*\(\s*team\s+in\s*\(([^)]*)\)/i.exec(
        sql,
      );
    if (!m) continue;
    found = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }
  if (!found) throw new Error("operators_team_check 정의를 찾지 못했다");
  return found;
}

describe("팀 값 단일 소스", () => {
  it("zod 스키마가 OPERATOR_TEAMS에서 파생된다", () => {
    expect([...operatorTeamSchema.options].sort()).toEqual(
      [...OPERATOR_TEAMS].sort(),
    );
  });

  it("DB 체크 제약이 OPERATOR_TEAMS와 같은 집합이다", () => {
    expect(latestTeamCheckValues().sort()).toEqual([...OPERATOR_TEAMS].sort());
  });

  it("등재된 운영자의 팀이 모두 OPERATOR_TEAMS 안에 있다", async () => {
    const { OPERATORS } = await import("@/features/auth/operators");
    for (const op of OPERATORS) {
      expect(OPERATOR_TEAMS, `${op.name}의 팀`).toContain(op.team);
    }
  });

  it("추출기가 동작한다 — 마지막 정의를 읽는다", () => {
    const values = latestTeamCheckValues();
    expect(values.length).toBeGreaterThanOrEqual(3);
    expect(values).toContain("기획팀");
  });
});
