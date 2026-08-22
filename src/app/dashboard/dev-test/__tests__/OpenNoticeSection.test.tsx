import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("server-only", () => ({}));

const getRecipientsForUniversities: Mock = vi.fn(async () => []);
vi.mock("@/features/data-requests/queries", () => ({
  getRecipientsForUniversities: (...a: unknown[]) =>
    getRecipientsForUniversities(...a),
}));

const getOpenNoticeStatusByServiceIds: Mock = vi.fn(async () => ({}));
const listOpenNoticeServices: Mock = vi.fn(async () => []);
vi.mock("@/features/open-notices/queries", async () => {
  const actual = await vi.importActual<
    typeof import("@/features/open-notices/queries")
  >("@/features/open-notices/queries");
  return {
    sortForOpenNotice: actual.sortForOpenNotice,
    listOpenNoticeServices: (...a: unknown[]) => listOpenNoticeServices(...a),
    getOpenNoticeStatusByServiceIds: (...a: unknown[]) =>
      getOpenNoticeStatusByServiceIds(...a),
  };
});

/** 오픈안내는 테스트 탭과 목록 범위가 달라 그 쿼리를 쓰면 안 된다. */
const listTestableServices: Mock = vi.fn(async () => []);
vi.mock("@/features/entertest/queries", () => ({
  listTestableServices: (...a: unknown[]) => listTestableServices(...a),
}));

import { OpenNoticeSection } from "../OpenNoticeSection";
import { ListPattern } from "../../_components/patterns/ListPattern";
import type { ListRow } from "../../_components/patterns/ListPattern";

type Node = { type?: unknown; props?: { children?: unknown } };

function findByType(node: unknown, type: unknown): Node | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findByType(child, type);
      if (found) return found;
    }
    return null;
  }
  if (!node || typeof node !== "object") return null;
  const el = node as Node;
  if (el.type === type) return el;
  return findByType(el.props?.children, type);
}

function svc(over: Record<string, unknown> = {}) {
  return {
    service_id: 1130058,
    university_name: "조선대학교",
    service_name: "2027학년도 수시모집",
    category: "수시",
    region: "광주",
    university_type: "4년제",
    admission_type: "공통원서",
    operator_name: "홍길동",
    write_start_at: "2026-09-08T01:00:00Z",
    write_end_at: "2026-09-11T09:00:00Z",
    pay_start_at: null,
    pay_end_at: null,
    ...over,
  };
}

async function propsOf(over: Record<string, unknown> = {}) {
  const { services, ...rest } = { services: [svc()], ...over } as Record<string, unknown>;
  listOpenNoticeServices.mockResolvedValue(services);
  const tree = await OpenNoticeSection({
    myName: "홍길동",
    meEmail: "me@op.com",
    ...rest,
  } as never);
  const el = findByType(tree, ListPattern);
  if (!el) throw new Error("ListPattern 을 찾지 못했습니다.");
  return (el.props ?? {}) as Record<string, unknown>;
}

async function rowsOf(over: Record<string, unknown> = {}): Promise<ListRow[]> {
  const p = await propsOf(over);
  return (p.data as { rows: ListRow[] }).rows;
}

describe("OpenNoticeSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRecipientsForUniversities.mockResolvedValue([]);
    getOpenNoticeStatusByServiceIds.mockResolvedValue({});
    listOpenNoticeServices.mockResolvedValue([]);
  });

  it("open-notice variant 로 렌더한다", async () => {
    expect((await propsOf()).variant).toBe("open-notice");
  });

  it("테스트 탭 쿼리를 쓰지 않는다 — 목록 범위가 다르다", async () => {
    await propsOf();
    expect(listTestableServices).not.toHaveBeenCalled();
    expect(listOpenNoticeServices).toHaveBeenCalled();
  });

  it("행 id 는 Moa 서비스ID, serviceIdNum 도 함께 넘긴다", async () => {
    const [row] = await rowsOf();
    expect(row.id).toBe("1130058");
    expect(row.serviceIdNum).toBe(1130058);
  });

  it("작성시작 오름차순으로 정렬한다", async () => {
    const rows = await rowsOf({
      services: [
        svc({ service_id: 3, write_start_at: "2027-03-01T00:00:00Z" }),
        svc({ service_id: 1, write_start_at: "2026-09-07T00:00:00Z" }),
        svc({ service_id: 2, write_start_at: "2026-12-01T00:00:00Z" }),
      ],
    });
    expect(rows.map((r) => r.serviceIdNum)).toEqual([1, 2, 3]);
  });

  it("수신자·상태는 현재 페이지 건에 대해서만 조회한다", async () => {
    const services = Array.from({ length: 45 }, (_, i) =>
      svc({
        service_id: 1000 + i,
        university_name: `대학${i}`,
        write_start_at: `2026-09-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`,
      }),
    );
    await propsOf({ services, mine: "false", myName: null });
    // 전건(45)이 아니라 한 페이지(30)만
    expect(getOpenNoticeStatusByServiceIds).toHaveBeenCalledTimes(1);
    const ids = getOpenNoticeStatusByServiceIds.mock.calls[0][0] as number[];
    expect(ids).toHaveLength(30);
    const univs = getRecipientsForUniversities.mock.calls[0][0] as string[];
    expect(univs).toHaveLength(30);
  });

  it("내 대학 기본 필터 — operator_name 이 본인인 건만", async () => {
    const rows = await rowsOf({
      services: [svc({ service_id: 1 }), svc({ service_id: 2, operator_name: "남" })],
    });
    expect(rows.map((r) => r.serviceIdNum)).toEqual([1]);
  });

  it("mine=false 면 전체를 보여준다", async () => {
    const rows = await rowsOf({
      services: [svc({ service_id: 1 }), svc({ service_id: 2, operator_name: "남" })],
      mine: "false",
    });
    expect(rows).toHaveLength(2);
  });

  it("검색어는 대학명·서비스명에 걸린다", async () => {
    const rows = await rowsOf({
      services: [
        svc({ service_id: 1, university_name: "조선대학교" }),
        svc({ service_id: 2, university_name: "부산대학교" }),
      ],
      mine: "false",
      myName: null,
      q: "부산",
    });
    expect(rows.map((r) => r.serviceIdNum)).toEqual([2]);
  });

  describe("발송 권한 표시", () => {
    it("본인 담당이면 canSend", async () => {
      const [row] = await rowsOf();
      expect(row.openNoticeCanSend).toBe(true);
    });

    it("남의 담당이면 canSend=false — 목록에는 보인다", async () => {
      const rows = await rowsOf({
        services: [svc({ operator_name: "남" })],
        mine: "false",
      });
      expect(rows).toHaveLength(1);
      expect(rows[0].openNoticeCanSend).toBe(false);
    });

    it("admin 은 남의 담당도 canSend", async () => {
      const [row] = await rowsOf({
        services: [svc({ operator_name: "남" })],
        mine: "false",
        isAdmin: true,
      });
      expect(row.openNoticeCanSend).toBe(true);
    });
  });

  it("발송 상태를 문자열 키로 찾아 행에 붙인다", async () => {
    getOpenNoticeStatusByServiceIds.mockResolvedValue({
      "1130058": {
        status: "sent",
        scheduledAt: null,
        lastSentAt: "2026-09-01T04:30:00Z",
        lastFailedAt: null,
      },
    });
    const [row] = await rowsOf();
    expect(row.openNoticeStatus).toBe("sent");
    expect(row.openNoticeLastSentAt).toBe("2026-09-01T04:30:00Z");
  });

  it("실패 시각도 행에 붙인다 (자동 발송이라 드러나야 한다)", async () => {
    getOpenNoticeStatusByServiceIds.mockResolvedValue({
      "1130058": {
        status: null,
        scheduledAt: null,
        lastSentAt: null,
        lastFailedAt: "2026-09-01T04:30:00Z",
      },
    });
    const [row] = await rowsOf();
    expect(row.openNoticeLastFailedAt).toBe("2026-09-01T04:30:00Z");
  });
});
