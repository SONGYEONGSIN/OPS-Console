// @vitest-environment node
//
// sharp 는 node 의 Buffer 를 받는다 — 기본 jsdom 환경에서 돌리지 않는다.
import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

const OLD = "2026-09-23/old.jpg";

const state = {
  request: null as Record<string, unknown> | null,
  requestError: null as { message: string } | null,
  requestReads: 0,
  photos: {} as Record<string, Buffer>,
  uploadError: null as { message: string } | null,
  swapRows: [] as { id: string }[],
  swapError: null as { message: string } | null,
  removeError: null as { message: string } | null,
  insertError: null as { message: string } | null,
  /** 회전 확정 자리 잡기(rotated_from 비우기)에 걸린 행 */
  claimRows: [{ id: "q2" }] as { id: string }[],
  claimFilters: [] as string[],
  /** 바깥에 남긴 일 — 순서까지 본다 */
  log: [] as string[],
  uploaded: {} as Record<string, { body: Buffer; contentType: unknown }>,
  swapFilters: [] as string[],
  inserted: [] as Record<string, unknown>[],
};

// 사진 받기는 출력과 같은 함수를 쓴다 — 여기서는 받은 셈 친다.
vi.mock("../receipt-print/sources", () => ({
  downloadReceipt: (path: string) =>
    Promise.resolve(state.photos[path] ?? null),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) =>
      table === "postal_extract_requests" ? requestsTable() : receiptsTable(),
    storage: {
      from: () => ({
        upload: (
          path: string,
          body: Buffer,
          opts: { contentType?: unknown },
        ) => {
          state.log.push(`upload ${path}`);
          state.uploaded[path] = { body, contentType: opts.contentType };
          return Promise.resolve({ error: state.uploadError });
        },
        remove: (paths: string[]) => {
          state.log.push(`remove ${paths.join(",")}`);
          return Promise.resolve({ error: state.removeError });
        },
      }),
    },
  }),
}));

/** 판독 요청 — 읽기(select→eq→maybeSingle)와 재판독 넣기(insert) */
function requestsTable() {
  return {
    select: () => ({
      eq: () => ({
        maybeSingle: () => {
          state.requestReads += 1;
          return Promise.resolve({
            data: state.request,
            error: state.requestError,
          });
        },
      }),
    }),
    update: (patch: Record<string, unknown>) => {
      state.log.push(`claim ${String(patch.rotated_from)}`);
      const chain = {
        eq: (column: string, value: unknown) => {
          state.claimFilters.push(`${column}=${String(value)}`);
          return chain;
        },
        select: () => Promise.resolve({ data: state.claimRows, error: null }),
      };
      return chain;
    },
    insert: (row: Record<string, unknown>) => {
      state.log.push(`insert ${String(row.requested_by)}`);
      state.inserted.push(row);
      return Promise.resolve({ error: state.insertError });
    },
  };
}

/** 영수증의 경로 교체 — update→eq→eq→select */
function receiptsTable() {
  const chain = {
    update: (patch: Record<string, unknown>) => {
      state.log.push(`update ${String(patch.storage_path)}`);
      return chain;
    },
    eq: (column: string, value: unknown) => {
      state.swapFilters.push(`${column}=${String(value)}`);
      return chain;
    },
    select: () =>
      Promise.resolve({ data: state.swapRows, error: state.swapError }),
  };
  return chain;
}

const {
  straightenSideways,
  settleRotation,
  turnUpright,
  AUTO_ROTATE_REQUESTER,
} = await import("../sideways-photo");

/** 200x100 사진에서 접수일자(오른쪽)→총요금(왼쪽) — 영수증 맨 위가 오른쪽이라는 두 번째 근거 */
const RIGHT = {
  receipt: null,
  accepted_at: [0.75, 0.4, 0.8, 0.6] as [number, number, number, number],
  total_fee: [0.3, 0.5, 0.35, 0.7] as [number, number, number, number],
};

const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

/** 흰 사진의 한쪽 끝에 검은 띠(폭 40px). 띠가 영수증 맨 위다 — band 는 띠가 있는 쪽. */
async function photo(
  width: number,
  height: number,
  band: "right" | "bottom" | "left",
) {
  const across = band === "bottom";
  return sharp({
    create: { width, height, channels: 3, background: "#ffffff" },
  })
    .composite([
      {
        input: {
          create: {
            width: across ? width : 40,
            height: across ? 40 : height,
            channels: 3,
            background: "#000000",
          },
        },
        left: band === "right" ? width - 40 : 0,
        top: band === "bottom" ? height - 40 : 0,
      },
    ])
    .jpeg()
    .toBuffer();
}

/** 크기와 위·아래 끝 가운데의 밝기. 세운 사진은 위가 검정(띠), 아래가 흰색이다. */
async function look(jpeg: Buffer) {
  const { data, info } = await sharp(jpeg)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const luma = (y: number) =>
    data[(y * info.width + Math.floor(info.width / 2)) * info.channels];
  const tone = (v: number) => (v < 60 ? "검정" : v > 200 ? "흰색" : "회색");
  return {
    size: `${info.width}×${info.height}`,
    top: tone(luma(5)),
    bottom: tone(luma(info.height - 5)),
  };
}

const UPRIGHT = { size: "100×200", top: "검정", bottom: "흰색" };

describe("turnUpright", () => {
  it("맨 위가 오른쪽이면 반시계로 세운다 — 가로 사진이 세로가 된다", async () => {
    const out = await turnUpright(await photo(200, 100, "right"), "right");
    expect(out && (await look(out))).toEqual(UPRIGHT);
  });

  it("맨 위가 왼쪽이면 시계로 세운다", async () => {
    const out = await turnUpright(await photo(200, 100, "left"), "left");
    expect(out && (await look(out))).toEqual(UPRIGHT);
  });

  it("거꾸로 찍혔으면 뒤집는다 — 세로 사진도", async () => {
    const out = await turnUpright(await photo(100, 200, "bottom"), "bottom");
    expect(out && (await look(out))).toEqual(UPRIGHT);
  });

  it("세로 사진에 '옆'이면 돌리지 않는다 — 누운 긴 영수증은 가로 사진에 담긴다", async () => {
    expect(
      await turnUpright(await photo(100, 200, "right"), "right"),
    ).toBeNull();
    expect(await turnUpright(await photo(100, 200, "left"), "left")).toBeNull();
  });
});

describe("straightenSideways", () => {
  beforeEach(async () => {
    state.request = {
      receipt_id: "r1",
      requested_by: "someone@example.test",
      postal_receipts: { storage_path: OLD },
    };
    state.requestError = null;
    state.requestReads = 0;
    state.photos = { [OLD]: await photo(200, 100, "right") };
    state.uploadError = null;
    state.swapRows = [{ id: "r1" }];
    state.swapError = null;
    state.removeError = null;
    state.insertError = null;
    state.log = [];
    state.uploaded = {};
    state.swapFilters = [];
    state.inserted = [];
    errorLog.mockClear();
  });

  it("바로 섰으면 아무것도 안 한다 — 요청도 안 읽는다", async () => {
    expect(await straightenSideways("q1", "top", RIGHT)).toBe("upright");
    expect(await straightenSideways("q1", null, RIGHT)).toBe("upright");
    expect(state.requestReads).toBe(0);
    expect(state.log).toEqual([]);
  });

  it("세워 새 경로에 올리고 → 경로를 바꾸고 → 옛 사진은 남긴 채 한 번 더 판독한다", async () => {
    expect(await straightenSideways("q1", "right", RIGHT)).toBe("rotated");
    const [up] = Object.keys(state.uploaded);
    // 같은 날짜 폴더에 새 이름 — 같은 경로에 덮으면 서명 URL·캐시가 옛 사진을 보여 준다.
    expect(up).toMatch(/^2026-09-23\/[0-9a-f-]{36}\.jpg$/);
    expect(state.log).toEqual([
      `upload ${up}`,
      `update ${up}`,
      `insert ${AUTO_ROTATE_REQUESTER}`,
    ]);
    expect(state.uploaded[up].contentType).toBe("image/jpeg");
    expect(await look(state.uploaded[up].body)).toEqual(UPRIGHT);
    // 그사이 다른 사진으로 바뀌었으면 안 바꾼다 — 옛 경로까지 맞을 때만.
    expect(state.swapFilters).toEqual(["id=r1", `storage_path=${OLD}`]);
    // 재판독이 바로 섰다고 확인할 때까지 옛 사진을 들고 있다 — 틀렸으면 되돌린다.
    expect(state.inserted).toEqual([
      {
        receipt_id: "r1",
        requested_by: AUTO_ROTATE_REQUESTER,
        rotated_from: OLD,
      },
    ]);
  });

  it("상자 방향이 판독의 방향과 다르면 돌리지 않는다 — 두 근거가 맞을 때만", async () => {
    const LEFT = {
      ...RIGHT,
      accepted_at: RIGHT.total_fee,
      total_fee: RIGHT.accepted_at,
    };
    expect(await straightenSideways("q1", "right", LEFT)).toBe("disagree");
    expect(await straightenSideways("q1", "right", null)).toBe("disagree");
    expect(state.log).toEqual([]);
  });

  it("자동 세우기가 건 재판독은 다시 세우지 않는다 — 한 번만", async () => {
    state.request = { ...state.request, requested_by: AUTO_ROTATE_REQUESTER };
    expect(await straightenSideways("q1", "right", RIGHT)).toBe(
      "already-rotated",
    );
    expect(state.log).toEqual([]);
  });

  it("세로 사진에 '옆'이면 두고 아무것도 안 바꾼다", async () => {
    state.photos = { [OLD]: await photo(100, 200, "right") };
    expect(await straightenSideways("q1", "right", RIGHT)).toBe(
      "not-landscape",
    );
    expect(state.log).toEqual([]);
  });

  it("요청이나 사진을 못 읽으면 failed — 아무것도 안 바꾼다", async () => {
    state.requestError = { message: "db down" };
    expect(await straightenSideways("q1", "right", RIGHT)).toBe("failed");
    state.requestError = null;
    state.photos = {};
    expect(await straightenSideways("q1", "right", RIGHT)).toBe("failed");
    expect(state.log).toEqual([]);
  });

  it("올리기에 실패하면 failed — 경로는 그대로", async () => {
    state.uploadError = { message: "quota" };
    expect(await straightenSideways("q1", "right", RIGHT)).toBe("failed");
    const [up] = Object.keys(state.uploaded);
    expect(state.log).toEqual([`upload ${up}`]);
  });

  it("경로를 못 바꾸면(그사이 지움·오류) 새 사진을 지우고 옛 것을 둔다 — 재판독도 없다", async () => {
    const breakSwap: Array<() => void> = [
      () => {
        state.swapRows = [];
      },
      () => {
        state.swapRows = [{ id: "r1" }];
        state.swapError = { message: "db down" };
      },
    ];
    for (const arrange of breakSwap) {
      state.log = [];
      state.uploaded = {};
      arrange();
      expect(await straightenSideways("q1", "right", RIGHT)).toBe("failed");
      const [up] = Object.keys(state.uploaded);
      expect(state.log).toEqual([
        `upload ${up}`,
        `update ${up}`,
        `remove ${up}`,
      ]);
    }
  });

  it("세운 사진도 못 지우면 그 경로를 로그에 남긴다 — 사본을 찾을 수 있게", async () => {
    state.swapRows = [];
    state.removeError = { message: "storage down" };
    expect(await straightenSideways("q1", "right", RIGHT)).toBe("failed");
    const [up] = Object.keys(state.uploaded);
    expect(errorLog).toHaveBeenCalledWith(
      "[postal] 세운 사진 지우기 실패:",
      up,
      state.removeError,
    );
  });

  it("재판독 요청에 실패하면 되돌린다 — 확인할 길이 없는 회전은 남기지 않는다", async () => {
    state.insertError = { message: "db down" };
    expect(await straightenSideways("q1", "right", RIGHT)).toBe("failed");
    const [up] = Object.keys(state.uploaded);
    expect(state.log).toEqual([
      `upload ${up}`,
      `update ${up}`,
      `insert ${AUTO_ROTATE_REQUESTER}`,
      `update ${OLD}`,
      `remove ${up}`,
    ]);
  });

  it("던지지 않는다 — 못 읽는 사진도 failed 로 끝나고 로그를 남긴다", async () => {
    state.photos = { [OLD]: Buffer.from("not an image") };
    expect(await straightenSideways("q1", "right", RIGHT)).toBe("failed");
    expect(errorLog).toHaveBeenCalled();
    expect(state.log).toEqual([]);
  });
});

describe("settleRotation — 세운 뒤의 재판독으로 확정하거나 되돌린다", () => {
  const NEW = "2026-09-23/new.jpg";
  beforeEach(() => {
    state.request = {
      receipt_id: "r1",
      requested_by: AUTO_ROTATE_REQUESTER,
      rotated_from: OLD,
      postal_receipts: { storage_path: NEW },
    };
    state.requestError = null;
    state.swapRows = [{ id: "r1" }];
    state.swapError = null;
    state.removeError = null;
    state.log = [];
    state.swapFilters = [];
    state.claimRows = [{ id: "q2" }];
    state.claimFilters = [];
    errorLog.mockClear();
  });

  it("바로 섰다고 하면 옛 사진을 지운다", async () => {
    expect(await settleRotation("q2", "top")).toBe("confirmed");
    expect(state.log).toEqual(["claim null", `remove ${OLD}`]);
    // 이 경로를 가진 그 행일 때만 — 자리를 먼저 잡는다.
    expect(state.claimFilters).toEqual(["id=q2", `rotated_from=${OLD}`]);
  });

  it("한 번만 — 같은 보고가 두 번 와도(폴러 재보고) 이미 처리했으면 아무것도 안 한다", async () => {
    state.claimRows = [];
    expect(await settleRotation("q2", null)).toBe("not-rotation");
    expect(state.log).toEqual(["claim null"]);
  });

  it("확정 때 옛 사진 삭제가 실패해도 confirmed — 경로를 로그에 남긴다", async () => {
    state.removeError = { message: "storage down" };
    expect(await settleRotation("q2", "top")).toBe("confirmed");
    expect(errorLog).toHaveBeenCalledWith(
      "[postal] 옛 사진 삭제 실패:",
      OLD,
      state.removeError,
    );
  });

  it("또 누웠다고 하면 옛 사진으로 되돌리고 세운 사진을 지운다", async () => {
    expect(await settleRotation("q2", "left")).toBe("restored");
    expect(state.log).toEqual(["claim null", `update ${OLD}`, `remove ${NEW}`]);
    // 그사이 사진이 바뀌었으면 안 바꾼다 — 세운 경로일 때만.
    expect(state.swapFilters).toEqual(["id=r1", `storage_path=${NEW}`]);
  });

  it("재판독이 실패해도(null) 되돌린다 — 확인 못 한 회전은 남기지 않는다", async () => {
    expect(await settleRotation("q2", null)).toBe("restored");
    expect(state.log).toEqual(["claim null", `update ${OLD}`, `remove ${NEW}`]);
  });

  it("자동 세우기의 재판독이 아니면 아무것도 안 한다", async () => {
    state.request = { ...state.request, requested_by: "someone@example.test" };
    expect(await settleRotation("q2", "left")).toBe("not-rotation");
    state.request = {
      ...state.request,
      requested_by: AUTO_ROTATE_REQUESTER,
      rotated_from: null,
    };
    expect(await settleRotation("q2", "left")).toBe("not-rotation");
    expect(state.log).toEqual([]);
  });

  it("경로를 못 되돌리면 세운 사진을 지우지 않는다 — 영수증이 가리키는 사진이다", async () => {
    state.swapRows = [];
    expect(await settleRotation("q2", "left")).toBe("failed");
    expect(state.log).toEqual(["claim null", `update ${OLD}`]);
    // 자리를 잡아 rotated_from 이 비었다 — 옛 사진 경로는 로그로만 찾는다.
    expect(String(errorLog.mock.calls.at(-1)?.[0])).toContain(OLD);
  });

  it("던지지 않는다 — 요청을 못 읽어도 failed", async () => {
    state.requestError = { message: "db down" };
    expect(await settleRotation("q2", "top")).toBe("failed");
    expect(errorLog).toHaveBeenCalled();
  });
});
