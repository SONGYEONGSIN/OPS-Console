import { describe, it, expect } from "vitest";
import { pickableOperators } from "../pickable";

const op = (team: string, status = "active", email = `${team}@x.com`) => ({
  email,
  name: team,
  team,
  status,
});

describe("pickableOperators — 운영자를 고르는 칸의 후보", () => {
  it("재직 중인 운영 쪽 사람만 — 영업팀·퇴사자는 뺀다", () => {
    const out = pickableOperators([
      op("운영1팀"),
      op("운영2팀"),
      op("기획팀"),
      op("영업팀"),
      op("운영1팀", "deleted", "gone@x.com"),
    ]);
    expect(out.map((o) => o.team)).toEqual(["운영1팀", "운영2팀", "기획팀"]);
  });
});
