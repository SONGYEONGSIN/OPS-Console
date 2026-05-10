import { describe, it, expect } from "vitest";
import * as actions from "../actions";

/**
 * Server actions ('use server') — 시그니처만 보호.
 * 실제 동작은 RLS + e2e가 검증.
 */
describe("schedule actions — export 시그니처", () => {
  it("createScheduleEvent / updateScheduleEvent / deleteScheduleEvent 모두 async 함수", () => {
    expect(actions.createScheduleEvent.constructor.name).toBe("AsyncFunction");
    expect(actions.updateScheduleEvent.constructor.name).toBe("AsyncFunction");
    expect(actions.deleteScheduleEvent.constructor.name).toBe("AsyncFunction");
  });
});
