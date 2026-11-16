import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { describe, expect, it } from "vitest";

// "use client" 파일이 값 import 로 server-only 모듈에 닿으면 next build 가 깨진다.
// vitest 는 server-only 를 빈 모듈로 별칭하고 typecheck·eslint 도 이걸 안 본다 — 그래서 정적으로 훑는다.
// "use server" 모듈은 클라이언트에 참조만 넘어가므로 그 안으로는 들어가지 않는다. `import type` 은 지워진다.
const APP_DIR = "src/app/dashboard/ops-weekly";
const SERVER_ONLY = "server-only";
const ASSET_RE = /\.(css|json|svg|png)$/;
const norm = (f: string) => normalize(f).replaceAll("\\", "/");

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
}

const directiveOf = (src: string) =>
  /^\s*["'](use client|use server)["']/.exec(stripComments(src))?.[1] ?? null;

/** 값 import·re-export 의 지정자(`import type`·`export type` 은 뺀다). */
function valueSpecifiers(src: string): string[] {
  const code = stripComments(src);
  const specs: string[] = [];
  const fromRe =
    /(?:^|[;\n])\s*(import|export)\s+(type\s+)?[^;]*?\s+from\s+["']([^"']+)["']/g;
  for (const m of code.matchAll(fromRe)) if (!m[2]) specs.push(m[3]);
  for (const m of code.matchAll(/(?:^|[;\n])\s*import\s+["']([^"']+)["']/g))
    specs.push(m[1]);
  return specs;
}

function resolveSpec(from: string, spec: string): string | null {
  const base = spec.startsWith("@/")
    ? join("src", spec.slice(2))
    : spec.startsWith(".")
      ? join(dirname(from), spec)
      : null;
  if (base === null) return null;
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  const hit = candidates.find((c) => existsSync(c) && statSync(c).isFile());
  if (hit) return norm(hit);
  if (ASSET_RE.test(spec)) return null;
  throw new Error(`${from}: import "${spec}" 를 찾지 못했다`);
}

/** 시작 파일에서 server-only 까지 이어지는 값 import 사슬(없으면 null). */
function serverOnlyChain(
  start: string,
  seen = new Set<string>(),
): string[] | null {
  if (seen.has(start)) return null;
  seen.add(start);
  const src = readFileSync(start, "utf8");
  if (seen.size > 1 && directiveOf(src) === "use server") return null;
  for (const spec of valueSpecifiers(src)) {
    if (spec === SERVER_ONLY) return [start, SERVER_ONLY];
    const next = resolveSpec(start, spec);
    if (next === null) continue;
    const rest = serverOnlyChain(next, seen);
    if (rest) return [start, ...rest];
  }
  return null;
}

function clientFiles(): string[] {
  return readdirSync(APP_DIR, { recursive: true, encoding: "utf8" })
    .map((f) => norm(join(APP_DIR, f)))
    .filter((f) => /\.tsx?$/.test(f) && !f.includes("/__tests__/"))
    .filter((f) => directiveOf(readFileSync(f, "utf8")) === "use client");
}

describe("ops-weekly 클라이언트 경계 — server-only 에 닿지 않는다", () => {
  it("import 파싱: type import 는 빼고 여러 줄·re-export·부수효과 import 는 잡는다", () => {
    const src = [
      'import "server-only";',
      'import type { A } from "./a";',
      'import {\n  b,\n  type C,\n} from "./b";',
      'export { d } from "@/d";',
      'export type { E } from "./e";',
      '// import { f } from "./f";',
    ].join("\n");
    expect(valueSpecifiers(src)).toEqual(["./b", "@/d", "server-only"]);
  });

  it("use client 파일을 실제로 훑는다(훑기가 헛돌면 가짜 초록)", () => {
    const files = clientFiles();
    expect(files.length).toBeGreaterThan(10);
    expect(files).toContain(`${APP_DIR}/_components/RecipientsPanel.tsx`);
  });

  it("server-only 모듈을 찾아낸다(검출기 자체 확인)", () => {
    expect(serverOnlyChain("src/features/ops-weekly/guard.ts")).not.toBeNull();
  });

  it.each(clientFiles())(
    "%s 는 값 import 로 server-only 에 닿지 않는다",
    (file) => {
      expect(serverOnlyChain(file)?.join(" → ") ?? null).toBeNull();
    },
  );
});
