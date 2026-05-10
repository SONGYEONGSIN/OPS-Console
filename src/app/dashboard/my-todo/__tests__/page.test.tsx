import { describe, it, expect } from "vitest";
import MyTodoPage from "../page";

describe("MyTodoPage — export 시그니처", () => {
  it("default export는 async function", () => {
    expect(typeof MyTodoPage).toBe("function");
    expect(MyTodoPage.constructor.name).toBe("AsyncFunction");
  });
});
