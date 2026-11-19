import { describe, it, expect } from "vitest";
import { replaceOpsQuery } from "../_components/use-ops-query";
import { setUrl } from "./search-params-mock";

describe("replaceOpsQuery", () => {
  it("값은 넣고 null 은 지운다", () => {
    setUrl("?week=2026-11-16&tab=settings&sub=dev");
    replaceOpsQuery({ section: "duty", sub: null });
    expect(window.location.search).toBe(
      "?week=2026-11-16&tab=settings&section=duty",
    );
  });
});
