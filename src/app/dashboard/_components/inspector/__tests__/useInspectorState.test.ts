import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInspectorState } from "../useInspectorState";

type Row = { id: string; name: string };

describe("useInspectorState", () => {
  it("초기 selected null + editing false", () => {
    const { result } = renderHook(() => useInspectorState<Row>());
    expect(result.current.selected).toBeNull();
    expect(result.current.editing).toBe(false);
  });

  it("open(row) — selected = row, editing = false", () => {
    const { result } = renderHook(() => useInspectorState<Row>());
    act(() => result.current.open({ id: "r1", name: "Row 1" }));
    expect(result.current.selected).toEqual({ id: "r1", name: "Row 1" });
    expect(result.current.editing).toBe(false);
  });

  it("close() — selected null, editing false", () => {
    const { result } = renderHook(() => useInspectorState<Row>());
    act(() => result.current.open({ id: "r1", name: "Row 1" }));
    act(() => result.current.close());
    expect(result.current.selected).toBeNull();
    expect(result.current.editing).toBe(false);
  });

  it("toggleEdit() — editing 반전", () => {
    const { result } = renderHook(() => useInspectorState<Row>());
    act(() => result.current.open({ id: "r1", name: "Row 1" }));
    act(() => result.current.toggleEdit());
    expect(result.current.editing).toBe(true);
    act(() => result.current.toggleEdit());
    expect(result.current.editing).toBe(false);
  });
});
