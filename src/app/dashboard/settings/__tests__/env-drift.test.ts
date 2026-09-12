import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getEnvSnapshot } from "../_env";
import { WORKBOOKS } from "@/features/workbook/registry";

/**
 * SharePoint env 는 **읽는 곳 · 보여주는 곳 · 채워넣는 곳** 세 벌로 손유지된다.
 * 셋이 어긋나면 화면에는 아무 증상이 없고, 워크북 열람만 조용히 죽는다.
 *
 * 실제로 둘 다 벌어졌다:
 * - `.env.example` 에 `SHAREPOINT_DRIVE_ID` 가 없어(주석 언급만), fresh 셋업이
 *   무엇을 채워야 워크북이 열리는지 알 길이 없었다.
 * - 등기·전도금·총괄장 아이템 ID 가 설정 화면 스냅샷에 없어, admin 이
 *   "이게 설정돼 있나"를 확인할 방법이 없었다.
 *
 * 그래서 목록을 하나 더 손으로 적지 않고 **소스에서 뽑아 대조**한다 —
 * 워크북을 새로 붙이면(registry 한 줄) 이 테스트가 나머지 두 곳을 요구한다.
 */
const SRC = join(process.cwd(), "src");
const SETTINGS_CLIENT = join(
  SRC,
  "app",
  "dashboard",
  "settings",
  "SettingsClient.tsx",
);
const ENV_EXAMPLE = join(process.cwd(), ".env.example");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    // 테스트는 존재하지 않는 env 를 자유롭게 지어내므로 대상에서 뺀다.
    if (name === "__tests__") continue;
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

/** 런타임 코드가 실제로 읽는 `process.env.SHAREPOINT_*` 이름 전부. */
function usedSharepointEnvNames(): string[] {
  const names = new Set<string>();
  for (const file of sourceFiles(SRC)) {
    const code = readFileSync(file, "utf8");
    for (const m of code.matchAll(/process\.env\.(SHAREPOINT_[A-Z0-9_]+)/g)) {
      names.add(m[1]);
    }
  }
  // 워크북은 정규식에 안 걸린다 — resolve.ts 가 `process.env[entry.driveEnv]` 로
  // 읽고 이름은 등록부에 문자열로만 있다. 그래서 등록부를 **읽어서** 더한다.
  // 소스를 또 정규식으로 긁지 않는 건, 등록부 리터럴 표기가 바뀌면 조용히
  // 0건이 되기 때문이다 — import 하면 그런 드리프트가 컴파일에서 드러난다.
  for (const entry of Object.values(WORKBOOKS)) {
    names.add(entry.driveEnv);
    names.add(entry.itemEnv);
  }
  return [...names].sort();
}

const ORIG = process.env;

describe("SharePoint env 드리프트 가드", () => {
  beforeEach(() => {
    process.env = { ...ORIG };
  });
  afterEach(() => {
    process.env = ORIG;
  });

  it("추출기가 동작한다 — 공용 드라이브 ID 를 찾는다", () => {
    // 추출이 0건이면 아래 두 테스트가 아무것도 검사하지 않고 통과한다.
    const names = usedSharepointEnvNames();
    expect(names).toContain("SHAREPOINT_DRIVE_ID");
    expect(names.length).toBeGreaterThanOrEqual(10);
  });

  it("워크북 등록부가 적어 둔 env 이름도 추출된다", () => {
    // 이 가드를 만든 이유가 워크북인데, 정작 워크북만 못 본다:
    // resolve.ts 가 `process.env[entry.driveEnv]` 로 **동적 접근**하고 이름은
    // 등록부에 문자열 리터럴로만 있어 `process\.env\.X` 정규식에 안 걸린다.
    // 지금은 다른 파일이 우연히 같은 이름을 직접 읽어 덮이지만, 그 파일이
    // 정리되는 순간 워크북 env 가 조용히 세 곳 대조에서 빠진다.
    const names = usedSharepointEnvNames();
    for (const entry of Object.values(WORKBOOKS)) {
      expect(names, `${entry.driveEnv} (${entry.label}) 가 안 잡힌다`).toContain(
        entry.driveEnv,
      );
      expect(names, `${entry.itemEnv} (${entry.label}) 가 안 잡힌다`).toContain(
        entry.itemEnv,
      );
    }
  });

  it("코드가 읽는 SHAREPOINT_* 는 전부 설정 스냅샷에 있다", () => {
    const names = usedSharepointEnvNames();
    // preview() 가 자르지 않는 짧은 토큰. 앞뒤 구분자로 부분문자열 충돌을 막는다.
    names.forEach((name, i) => {
      process.env[name] = `<sp${i}>`;
    });
    const snapshot = JSON.stringify(getEnvSnapshot().sharepoint);
    for (const [i, name] of names.entries()) {
      expect(snapshot, `${name} 이 스냅샷에 없다`).toContain(`<sp${i}>`);
    }
  });

  it("스냅샷의 sharepoint 키는 전부 설정 화면에 그려진다", () => {
    const client = readFileSync(SETTINGS_CLIENT, "utf8");
    for (const key of Object.keys(getEnvSnapshot().sharepoint)) {
      expect(client, `${key} 를 그리는 Row 가 없다`).toContain(
        `env.sharepoint.${key}.configured`,
      );
    }
  });

  it("코드가 읽는 SHAREPOINT_* 는 전부 .env.example 에 있다", () => {
    const example = readFileSync(ENV_EXAMPLE, "utf8");
    for (const name of usedSharepointEnvNames()) {
      // 주석 언급(`SHAREPOINT_DRIVE_ID는 …`)은 채울 칸이 아니므로 `=` 를 요구한다.
      expect(example, `${name} 항목이 .env.example 에 없다`).toMatch(
        new RegExp(`^${name}=`, "m"),
      );
    }
  });
});
