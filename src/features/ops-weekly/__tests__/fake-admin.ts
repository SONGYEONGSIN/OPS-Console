/**
 * 테스트 도우미(*.test.ts 아님) — admin Supabase 클라이언트의 인메모리 목.
 *
 * 테이블별 행 배열을 들고 필터를 **실제로 적용**한다. 테이블 단위로 같은 응답을 돌려주는 목은
 * '이번 주 보고서'와 '지난주 보고서'를 구분하지 못해 미리 채우기 같은 테스트가 성립하지 않는다.
 *
 * 사용: `vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => db.client }))`
 *       `db = fakeAdmin({ ops_weekly_weeks: [...] })`
 * 없는 테이블은 빈 배열처럼 읽힌다.
 *
 * 지원: select · eq · in · is(null 포함) · order · maybeSingle · single
 *       insert(id 가 없으면 "<table>-<n>") · upsert(row, { onConflict, ignoreDuplicates }) ·
 *       update(patch).eq()…select() · delete().eq()
 *       upsert 는 충돌 키가 같은 행이 있으면 ignoreDuplicates 일 때 건너뛰고, 아니면 덮어쓴다.
 *       insert/upsert 는 DEFAULTS 의 DB 기본값(status 등)을 채운다.
 * 미지원: or · gte · lte 같은 범위 필터(체인 목을 쓴다), unique 제약 검사.
 * spies: 쓰기 spy 는 첫 인자로 테이블 이름을 받는다 — `spies.insert("t", rows)`.
 *        spy 는 쓰기 적용 **전에** 불린다 — mockImplementationOnce 로 '그 사이 다른 요청이 행을 만든' 경쟁을 흉내낸다.
 * storage: `storage.from(bucket).copy(from, to)` 만 — `spies.copy(bucket, from, to)` 가 응답한다(기본 성공).
 *          실패는 `spies.copy.mockResolvedValueOnce({ data: null, error })`.
 * failTable(name, message, code?): 그 테이블의 모든 응답이 `{ data: null, error }` 가 된다.
 * failNextWrite(name, message, code?): 그 테이블의 다음 쓰기 한 번만 error 로 응답한다(읽기는 정상).
 * rows(name): 살아 있는 행 배열.
 */
import { vi, type Mock } from "vitest";

export type Row = Record<string, unknown>;
type DbError = { message: string; code?: string };
type Result = { data: unknown; error: DbError | null };
type Op = "select" | "insert" | "upsert" | "update" | "delete";
type UpsertOpts = { onConflict?: string; ignoreDuplicates?: boolean };

const DEFAULTS: Record<string, () => Row> = {
  ops_weekly_weeks: () => ({
    duty_email: null,
    summary_this: "",
    summary_next: "",
    status: "open",
    reported_at: null,
    reported_by: null,
    reopened_at: null,
    reopened_by: null,
  }),
  ops_weekly_reports: () => ({
    status: "draft",
    submitted_at: null,
    returned_at: null,
    returned_by: null,
    return_reason: null,
    snapshot: null,
    checked_tabs: [],
  }),
  ops_weekly_project_entries: () => ({
    stage: null,
    this_week: "",
    next_week: "",
  }),
};

export function fakeAdmin(tables: Record<string, Row[]>) {
  const data = new Map<string, Row[]>(
    Object.entries(tables).map(([name, rows]) => [
      name,
      rows.map((r) => ({ ...r })),
    ]),
  );
  const counters = new Map<string, number>();
  const failed = new Map<string, DbError>();
  const failedNextWrite = new Map<string, DbError>();
  const spies = {
    upsert: vi.fn() as Mock,
    insert: vi.fn() as Mock,
    update: vi.fn() as Mock,
    delete: vi.fn() as Mock,
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }) as Mock,
    copy: vi.fn(async (_bucket: string, _from: string, to: string) => ({
      data: { path: to },
      error: null,
    })) as Mock,
  };

  const rows = (name: string): Row[] => {
    const existing = data.get(name);
    if (existing) return existing;
    const created: Row[] = [];
    data.set(name, created);
    return created;
  };

  const fresh = (name: string, row: Row): Row => {
    const n = (counters.get(name) ?? 0) + 1;
    counters.set(name, n);
    return { ...(DEFAULTS[name]?.() ?? {}), id: `${name}-${n}`, ...row };
  };

  function from(name: string) {
    let op: Op = "select";
    let payload: Row[] = [];
    let patch: Row = {};
    let opts: UpsertOpts = {};
    let returning = false;
    let shape: "maybe" | "single" | null = null;
    let sort: { col: string; asc: boolean } | null = null;
    const filters: ((r: Row) => boolean)[] = [];

    const applyWrite = (): Row[] => {
      const store = rows(name);
      if (op === "insert") {
        const added = payload.map((r) => fresh(name, r));
        store.push(...added);
        return added;
      }
      if (op === "upsert") {
        const cols = (opts.onConflict ?? "id").split(",").map((c) => c.trim());
        const out: Row[] = [];
        for (const r of payload) {
          const hit = store.find((e) => cols.every((c) => e[c] === r[c]));
          if (!hit) {
            const added = fresh(name, r);
            store.push(added);
            out.push(added);
          } else if (!opts.ignoreDuplicates) {
            Object.assign(hit, r);
            out.push(hit);
          }
        }
        return out;
      }
      const matched = store.filter((r) => filters.every((f) => f(r)));
      if (op === "update") {
        matched.forEach((r) => Object.assign(r, patch));
        return matched;
      }
      matched.forEach((r) => store.splice(store.indexOf(r), 1));
      return matched;
    };

    const shaped = (list: Row[]): Result => {
      if (shape === null) return { data: list, error: null };
      if (list.length > 1) {
        return { data: null, error: { message: "multiple rows" } };
      }
      if (list.length === 0 && shape === "single") {
        return { data: null, error: { message: "no rows" } };
      }
      return { data: list[0] ?? null, error: null };
    };

    const exec = (): Result => {
      const failure = failed.get(name);
      if (failure) return { data: null, error: failure };
      if (op === "select") {
        const list = rows(name).filter((r) => filters.every((f) => f(r)));
        if (sort) {
          const { col, asc } = sort;
          list.sort((a, b) => {
            const x = a[col] as string | number;
            const y = b[col] as string | number;
            return (x < y ? -1 : x > y ? 1 : 0) * (asc ? 1 : -1);
          });
        }
        return shaped(list);
      }
      const writeFailure = failedNextWrite.get(name);
      if (writeFailure) {
        failedNextWrite.delete(name);
        return { data: null, error: writeFailure };
      }
      const affected = applyWrite();
      return returning || shape !== null
        ? shaped(affected)
        : { data: null, error: null };
    };

    const self = {
      select() {
        if (op !== "select") returning = true;
        return self;
      },
      eq(col: string, v: unknown) {
        filters.push((r) => r[col] === v);
        return self;
      },
      in(col: string, vs: readonly unknown[]) {
        filters.push((r) => vs.includes(r[col]));
        return self;
      },
      is(col: string, v: null) {
        filters.push((r) => (v === null ? r[col] == null : r[col] === v));
        return self;
      },
      order(col: string, o?: { ascending?: boolean }) {
        sort = { col, asc: o?.ascending ?? true };
        return self;
      },
      maybeSingle() {
        shape = "maybe";
        return self;
      },
      single() {
        shape = "single";
        return self;
      },
      insert(input: Row | Row[]) {
        spies.insert(name, input);
        op = "insert";
        payload = Array.isArray(input) ? input : [input];
        return self;
      },
      upsert(input: Row | Row[], o?: UpsertOpts) {
        if (o === undefined) spies.upsert(name, input);
        else spies.upsert(name, input, o);
        op = "upsert";
        payload = Array.isArray(input) ? input : [input];
        opts = o ?? {};
        return self;
      },
      update(p: Row) {
        spies.update(name, p);
        op = "update";
        patch = p;
        return self;
      },
      delete() {
        spies.delete(name);
        op = "delete";
        return self;
      },
      then<A = Result, B = never>(
        onfulfilled?: ((v: Result) => A | PromiseLike<A>) | null,
        onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
      ): Promise<A | B> {
        return Promise.resolve().then(exec).then(onfulfilled, onrejected);
      },
    };
    return self;
  }

  return {
    client: {
      from,
      rpc: (...a: unknown[]) => spies.rpc(...a),
      storage: {
        from: (bucket: string) => ({
          copy: (src: string, dst: string) => spies.copy(bucket, src, dst),
        }),
      },
    },
    spies,
    rows,
    failTable(name: string, message: string, code?: string) {
      failed.set(name, code ? { message, code } : { message });
    },
    failNextWrite(name: string, message: string, code?: string) {
      failedNextWrite.set(name, code ? { message, code } : { message });
    },
  };
}
