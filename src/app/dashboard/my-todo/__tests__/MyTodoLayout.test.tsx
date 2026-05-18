import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MyTodoLayout, type UpcomingService, type TodoItem } from "../MyTodoLayout";

const services: UpcomingService[] = [
  {
    id: "svc-1",
    service_id: 1001,
    university_name: "한예종",
    service_name: "8월 입시",
    application_type: "수시",
    write_start_at: "2026-05-20",
  },
  {
    id: "svc-2",
    service_id: 1002,
    university_name: "한양대",
    service_name: "정시",
    application_type: "정시",
    write_start_at: "2026-06-15",
  },
];

const baseTodos: TodoItem[] = [];

describe("MyTodoLayout", () => {
  it("services 없을 때 안내 표시", () => {
    render(
      <MyTodoLayout
        services={[]}
        todos={baseTodos}
        onAddFromService={vi.fn()}
        onToggleDone={vi.fn()}
        onDeleteTodo={vi.fn()}
      />,
    );
    expect(screen.getByText(/앞으로 60일 안에/)).toBeInTheDocument();
  });

  it("서비스 row + '담기' 버튼 노출", () => {
    render(
      <MyTodoLayout
        services={services}
        todos={baseTodos}
        onAddFromService={vi.fn()}
        onToggleDone={vi.fn()}
        onDeleteTodo={vi.fn()}
      />,
    );
    expect(screen.getByText(/한예종.*8월 입시/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "+ 담기" }).length).toBe(2);
  });

  it("'+ 담기' 클릭 → onAddFromService 호출", () => {
    const onAdd = vi.fn().mockResolvedValue({ ok: true });
    render(
      <MyTodoLayout
        services={services}
        todos={baseTodos}
        onAddFromService={onAdd}
        onToggleDone={vi.fn()}
        onDeleteTodo={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "+ 담기" })[0]);
    expect(onAdd).toHaveBeenCalledWith(services[0]);
  });

  it("이미 담은 서비스(linked) → '담음' 표시 + 담기 버튼 미노출", () => {
    const todos: TodoItem[] = [
      {
        id: "t-1",
        title: "한예종 · 8월 입시",
        body: null,
        done: false,
        done_at: null,
        priority: "high",
        source_service_id: "svc-1",
      },
    ];
    render(
      <MyTodoLayout
        services={services}
        todos={todos}
        onAddFromService={vi.fn()}
        onToggleDone={vi.fn()}
        onDeleteTodo={vi.fn()}
      />,
    );
    expect(screen.getByText("담음")).toBeInTheDocument();
    // 첫 row '+ 담기' 버튼은 사라지고 두 번째만 남음
    expect(screen.getAllByRole("button", { name: "+ 담기" }).length).toBe(1);
  });

  it("완료된 todo의 source_service_id → 왼쪽 row 음영(line-through) + '완료' 표시", () => {
    const todos: TodoItem[] = [
      {
        id: "t-1",
        title: "한예종",
        body: null,
        done: true,
        done_at: "2026-05-18T00:00:00Z",
        priority: "high",
        source_service_id: "svc-1",
      },
    ];
    render(
      <MyTodoLayout
        services={services}
        todos={todos}
        onAddFromService={vi.fn()}
        onToggleDone={vi.fn()}
        onDeleteTodo={vi.fn()}
      />,
    );
    // 왼쪽 row의 음영/취소선 + '완료' 텍스트 (통계 박스의 '완료' 라벨과 별개로 검증)
    const row = screen.getByText(/한예종.*8월 입시/).closest("tr");
    expect(row?.className).toContain("line-through");
    expect(row?.textContent).toContain("완료");
  });

  it("우측 인스펙터 — todo 체크박스 토글 → onToggleDone 호출", () => {
    const onToggle = vi.fn().mockResolvedValue({ ok: true });
    const todos: TodoItem[] = [
      {
        id: "t-1",
        title: "원서 준비",
        body: null,
        done: false,
        done_at: null,
        priority: "medium",
        source_service_id: null,
      },
    ];
    render(
      <MyTodoLayout
        services={[]}
        todos={todos}
        onAddFromService={vi.fn()}
        onToggleDone={onToggle}
        onDeleteTodo={vi.fn()}
      />,
    );
    const box = screen.getByRole("checkbox", { name: "원서 준비" });
    fireEvent.click(box);
    expect(onToggle).toHaveBeenCalledWith("t-1", true);
  });

  it("통계 박스 — 전체/시작 전/진행 중/완료 + 완료율", () => {
    const todos: TodoItem[] = [
      { id: "a", title: "a", body: null, done: false, done_at: null, priority: "low", source_service_id: null },
      { id: "b", title: "b", body: null, done: true, done_at: "2026-05-18", priority: "low", source_service_id: null },
      { id: "c", title: "c", body: null, done: true, done_at: "2026-05-18", priority: "low", source_service_id: null },
    ];
    render(
      <MyTodoLayout
        services={[]}
        todos={todos}
        onAddFromService={vi.fn()}
        onToggleDone={vi.fn()}
        onDeleteTodo={vi.fn()}
      />,
    );
    expect(screen.getByText("전체")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument(); // 2/3
  });
});
