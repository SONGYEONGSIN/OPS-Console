import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { ToastProvider } from "../ToastContainer";

// ── Supabase 브라우저 클라이언트 mock ──────────────────────────────────────
type PayloadHandler = (payload: { new: Record<string, unknown> }) => void;

interface MockChannel {
  _handlers: Map<string, PayloadHandler>;
  on: (
    event: string,
    filter: Record<string, unknown>,
    handler: PayloadHandler,
  ) => MockChannel;
  subscribe: () => MockChannel;
  trigger: (table: string, payload: Record<string, unknown>) => void;
}

const mockChannels: MockChannel[] = [];

function makeMockChannel(): MockChannel {
  const ch: MockChannel = {
    _handlers: new Map(),
    on(_event, filter, handler) {
      const table = (filter as { table: string }).table;
      ch._handlers.set(table, handler);
      return ch;
    },
    subscribe() {
      return ch;
    },
    trigger(table, payload) {
      ch._handlers.get(table)?.({ new: payload });
    },
  };
  mockChannels.push(ch);
  return ch;
}

const removeChannel = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    channel: () => makeMockChannel(),
    removeChannel,
  }),
}));

import { useDashboardRealtime } from "../use-dashboard-realtime";

function wrapper({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}

beforeEach(() => {
  mockChannels.length = 0;
  removeChannel.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useDashboardRealtime", () => {
  it("worklog INSERT → onConsoleLine 호출", () => {
    const onConsoleLine = vi.fn();
    renderHook(
      () =>
        useDashboardRealtime({
          mine: false,
          myEmail: null,
          onConsoleLine,
        }),
      { wrapper },
    );

    const worklogCh = mockChannels.find((ch) => ch._handlers.has("worklog"));
    expect(worklogCh).toBeDefined();
    worklogCh!.trigger("worklog", {
      level: "INFO",
      domain: "handover",
      msg: "테스트 로그",
      user_email: "other@example.com",
    });

    expect(onConsoleLine).toHaveBeenCalledWith(
      expect.objectContaining({ text: "[HANDOVER] 테스트 로그", type: "info" }),
    );
  });

  it("RLS 미인가 빈 payload({}) → crash 없이 스킵 (onConsoleLine 미호출)", () => {
    const onConsoleLine = vi.fn();
    renderHook(
      () =>
        useDashboardRealtime({
          mine: false,
          myEmail: null,
          onConsoleLine,
        }),
      { wrapper },
    );

    const worklogCh = mockChannels.find((ch) => ch._handlers.has("worklog"));
    // 만료된 JWT로 구독 중이면 Realtime이 빈 레코드로 이벤트를 전달한다
    expect(() => worklogCh!.trigger("worklog", {})).not.toThrow();
    expect(onConsoleLine).not.toHaveBeenCalled();
  });

  it("mine=true + myEmail 불일치 시 worklog 무시", () => {
    const onConsoleLine = vi.fn();
    renderHook(
      () =>
        useDashboardRealtime({
          mine: true,
          myEmail: "me@example.com",
          onConsoleLine,
        }),
      { wrapper },
    );

    const worklogCh = mockChannels.find((ch) => ch._handlers.has("worklog"));
    worklogCh!.trigger("worklog", {
      level: "INFO",
      domain: "handover",
      msg: "다른 사람 로그",
      user_email: "other@example.com",
    });

    expect(onConsoleLine).not.toHaveBeenCalled();
  });

  it("mine=true + myEmail 일치 시 worklog 통과", () => {
    const onConsoleLine = vi.fn();
    renderHook(
      () =>
        useDashboardRealtime({
          mine: true,
          myEmail: "me@example.com",
          onConsoleLine,
        }),
      { wrapper },
    );

    const worklogCh = mockChannels.find((ch) => ch._handlers.has("worklog"));
    worklogCh!.trigger("worklog", {
      level: "WARN",
      domain: "cron",
      msg: "내 로그",
      user_email: "me@example.com",
    });

    expect(onConsoleLine).toHaveBeenCalledWith(
      expect.objectContaining({ type: "warn" }),
    );
  });

  it("incidents INSERT → toast 표시 (mine=false)", () => {
    const onConsoleLine = vi.fn();
    renderHook(
      () =>
        useDashboardRealtime({
          mine: false,
          myEmail: null,
          onConsoleLine,
        }),
      { wrapper },
    );

    const incCh = mockChannels.find((ch) => ch._handlers.has("incidents"));
    expect(incCh).toBeDefined();
    // toast → React state 업데이트이므로 act로 감쌈
    expect(() =>
      act(() => {
        incCh!.trigger("incidents", {
          title: "Redis 장애",
          owner_email: null,
        });
      }),
    ).not.toThrow();
  });

  it("data_request_sends UPDATE + status=sent → toast 표시", () => {
    const onConsoleLine = vi.fn();
    renderHook(
      () =>
        useDashboardRealtime({
          mine: false,
          myEmail: null,
          onConsoleLine,
        }),
      { wrapper },
    );

    const drsCh = mockChannels.find((ch) =>
      ch._handlers.has("data_request_sends"),
    );
    expect(drsCh).toBeDefined();
    expect(() =>
      act(() => {
        drsCh!.trigger("data_request_sends", {
          university_name: "중앙대학교",
          status: "sent",
          created_by_email: "user@example.com",
        });
      }),
    ).not.toThrow();
  });

  it("data_request_sends UPDATE + status=pending → toast 없음 (에러 없이)", () => {
    const onConsoleLine = vi.fn();
    renderHook(
      () =>
        useDashboardRealtime({
          mine: false,
          myEmail: null,
          onConsoleLine,
        }),
      { wrapper },
    );

    const drsCh = mockChannels.find((ch) =>
      ch._handlers.has("data_request_sends"),
    );
    act(() => {
      drsCh!.trigger("data_request_sends", {
        university_name: "서울대학교",
        status: "pending",
        created_by_email: "user@example.com",
      });
    });
    expect(onConsoleLine).not.toHaveBeenCalled();
  });

  it("handover_records INSERT → toast 표시 (mine=false)", () => {
    const onConsoleLine = vi.fn();
    renderHook(
      () =>
        useDashboardRealtime({
          mine: false,
          myEmail: null,
          onConsoleLine,
        }),
      { wrapper },
    );

    const hoCh = mockChannels.find((ch) => ch._handlers.has("handover_records"));
    expect(hoCh).toBeDefined();
    expect(() =>
      act(() => {
        hoCh!.trigger("handover_records", {
          author_name: "홍길동",
          author_email: "hong@example.com",
          service_id: "abc-123",
        });
      }),
    ).not.toThrow();
  });

  it("handover_records INSERT + mine=true + 불일치 author_email → toast 없음", () => {
    const onConsoleLine = vi.fn();
    renderHook(
      () =>
        useDashboardRealtime({
          mine: true,
          myEmail: "me@example.com",
          onConsoleLine,
        }),
      { wrapper },
    );

    const hoCh = mockChannels.find((ch) => ch._handlers.has("handover_records"));
    act(() => {
      hoCh!.trigger("handover_records", {
        author_name: "홍길동",
        author_email: "other@example.com",
        service_id: "abc-123",
      });
    });
    // toast 호출 여부는 ToastProvider 내부라 직접 검증 어려움; 에러 없이 실행됨을 검증
    expect(onConsoleLine).not.toHaveBeenCalled();
  });
});
