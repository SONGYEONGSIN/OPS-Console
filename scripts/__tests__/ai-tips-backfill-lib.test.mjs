import { describe, it, expect } from "vitest";
import { toRepoMetaUpdate } from "../ai-tips/backfill-lib.mjs";

const NOW = new Date("2026-09-12T03:00:00.000Z");

describe("toRepoMetaUpdate", () => {
  it("응답을 update payload 로 옮긴다 — 별도 같이 갱신해야 시점이 하나가 된다", () => {
    expect(
      toRepoMetaUpdate(
        {
          full_name: "anthropics/claude-code",
          language: "TypeScript",
          pushed_at: "2026-09-10T11:22:33Z",
          stargazers_count: 1234,
        },
        NOW,
      ),
    ).toEqual({
      repo_language: "TypeScript",
      repo_pushed_at: "2026-09-10T11:22:33Z",
      stars: 1234,
      repo_synced_at: "2026-09-12T03:00:00.000Z",
    });
  });

  it("주 언어 없는 리포는 null + synced 로 '물어봤다'를 남긴다", () => {
    const out = toRepoMetaUpdate(
      {
        full_name: "acme/docs-only",
        language: null,
        pushed_at: "2026-08-01T00:00:00Z",
        stargazers_count: 210,
      },
      NOW,
    );
    expect(out.repo_language).toBeNull();
    expect(out.repo_synced_at).toBe("2026-09-12T03:00:00.000Z");
  });

  it("404 는 payload 를 안 만든다 — synced 를 적으면 물어본 척이 된다", () => {
    expect(toRepoMetaUpdate(null, NOW)).toBeNull();
    expect(toRepoMetaUpdate({ message: "Not Found" }, NOW)).toBeNull();
  });
});
