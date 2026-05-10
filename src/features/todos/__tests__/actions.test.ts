import { describe, it, expect } from "vitest";
import * as actions from "../actions";

describe("todo actions — export 시그니처", () => {
  it("create / update / delete / toggleDone 모두 async 함수", () => {
    expect(actions.createTodo.constructor.name).toBe("AsyncFunction");
    expect(actions.updateTodo.constructor.name).toBe("AsyncFunction");
    expect(actions.deleteTodo.constructor.name).toBe("AsyncFunction");
    expect(actions.toggleTodoDone.constructor.name).toBe("AsyncFunction");
  });
});
