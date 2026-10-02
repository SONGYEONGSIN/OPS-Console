import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PostalTable } from "../PostalTable";
import type { ReceiptCard, ExtractState } from "@/features/postal/queries";

// 검토표는 이 파일의 관심사가 아니라 끊는다. 다만 **확정 버튼은 실물을 쓴다** —
// 삭제와 나란한지 보려면 진짜 버튼이 그려져야 한다(2026-08-21).
vi.mock("../ReceiptReview", async () => {
  const actual = await vi.importActual<typeof import("../ReceiptReview")>(
    "../ReceiptReview",
  );
  return {
    ...actual,
    ReceiptReview: ({
      rows,
      onRowsChange,
    }: {
      rows: { trackingNo: string }[];
      onRowsChange: (r: { trackingNo: string }[]) => void;
    }) => (
      <div>
        리뷰
        <span data-testid="review-rows">
          {rows.map((r) => r.trackingNo).join(",")}
        </span>
        <button
          onClick={() =>
            onRowsChange(rows.map((r) => ({ ...r, trackingNo: "EDITED" })))
          }
        >
          고침
        </button>
      </div>
    ),
  };
});

const receipts: ReceiptCard[] = [
  {
    id: "r1",
    uploadedBy: "song@x.com",
    createdAt: "2026-08-18T01:00:00Z",
    confirmedAt: null,
    imageUrl: "https://example.test/a.jpg",
  },
  {
    id: "r2",
    uploadedBy: "kim@x.com",
    createdAt: "2026-08-19T02:00:00Z",
    confirmedAt: "2026-08-19T03:00:00Z",
    imageUrl: "https://example.test/b.jpg",
  },
];

const states: Record<string, ExtractState> = {
  r1: { status: "none", warnings: [], message: null, acceptedAt: null, rows: [], hasRegions: false, requestedAt: null },
  r2: {
    status: "done", warnings: [], message: null, acceptedAt: "2026-08-19", hasRegions: true, requestedAt: "2026-08-19T00:00:00Z",
    rows: [
      {
        daySeq: 1, trackingNo: "11263-1102-7080", fee: 4590, postalCode: "55338",
        recipientOrg: "우석대", recipientName: "강정화",
        basis: "undergraduate", assignee: "김지현", candidates: [],
      },
    ],
  },
};

describe("PostalTable", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("표로 보여준다 — 카드 격자로는 여러 건을 훑기 어렵다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    ["올린 날", "올린 사람", "접수일시", "등기", "금액", "상태"].forEach((h) =>
      expect(screen.getByRole("columnheader", { name: h })).toBeInTheDocument(),
    );
  });

  it("판독된 건은 등기 수와 금액 합을 보여준다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    expect(screen.getByText("1건")).toBeInTheDocument();
    expect(screen.getByText("4,590원")).toBeInTheDocument();
  });

  it("확정된 건은 그렇다고 표시한다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    expect(screen.getByText("확정")).toBeInTheDocument();
  });

  it("행을 누르면 영수증 원본이 팝업으로 열린다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.click(screen.getByText("song"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByAltText(/영수증 원본/)).toBeInTheDocument();
  });

  it("팝업을 닫을 수 있다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.click(screen.getByText("song"));
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("검색으로 거른다 — 올린 사람·날짜·등기번호로 찾는다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.change(screen.getByLabelText("우편물 검색"), {
      target: { value: "kim" },
    });
    expect(screen.getByText("kim")).toBeInTheDocument();
    expect(screen.queryByText("song")).toBeNull();
  });

  it("등기번호로도 찾는다 — 그게 사람이 들고 오는 번호다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.change(screen.getByLabelText("우편물 검색"), {
      target: { value: "7080" },
    });
    expect(screen.getByText("kim")).toBeInTheDocument();
    expect(screen.queryByText("song")).toBeNull();
  });

  it("검색 결과가 없으면 그렇다고 말한다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.change(screen.getByLabelText("우편물 검색"), {
      target: { value: "없는것" },
    });
    expect(screen.getByText(/찾는 영수증이 없습니다/)).toBeInTheDocument();
  });

  it("영수증이 없으면 빈 상태를 보여준다", () => {
    render(<PostalTable receipts={[]} extractStates={{}} />);
    expect(screen.getByText(/올린 영수증이 없습니다/)).toBeInTheDocument();
  });

  // 한 건도 없을 때 문장 한 줄만 나와 화면이 다른 메뉴와 달라 보였다.
  // 목록 화면은 비어 있어도 목록의 모양을 하고 있어야 한다.
  describe("한 건도 없을 때도 목록의 모양을 지킨다", () => {
    it("제목과 건수가 보인다", () => {
      render(<PostalTable receipts={[]} extractStates={{}} />);
      expect(screen.getByRole("heading", { name: "영수증" })).toBeInTheDocument();
      expect(screen.getByText("0건")).toBeInTheDocument();
    });

    it("검색창이 보인다 — 없다고 사라지면 다시 올린 뒤에야 나타난다", () => {
      render(<PostalTable receipts={[]} extractStates={{}} />);
      expect(screen.getByLabelText("우편물 검색")).toBeInTheDocument();
    });

    it("표 머리가 보인다 — 무엇이 들어올 자리인지 알 수 있어야 한다", () => {
      render(<PostalTable receipts={[]} extractStates={{}} />);
      expect(screen.getByRole("columnheader", { name: "올린 날" })).toBeInTheDocument();
      expect(screen.getByRole("columnheader", { name: "금액" })).toBeInTheDocument();
    });

    it("빈 안내는 표 안에 있다", () => {
      render(<PostalTable receipts={[]} extractStates={{}} />);
      const cell = screen.getByText(/올린 영수증이 없습니다/).closest("td");
      expect(cell).not.toBeNull();
    });
  });
});

/**
 * 영수증 출력 — 내부 전표에 붙일 A4 PDF.
 *
 * 행을 누르면 원본 팝업이 열리므로 체크 칸의 클릭은 새지 않아야 한다.
 */
describe("PostalTable — 영수증 출력", () => {
  const boxes = () => screen.getAllByRole("checkbox");

  it("표 머리에 선택 칸이 있다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    expect(screen.getByRole("columnheader", { name: "선택" })).toBeInTheDocument();
  });

  it("고른 것이 없으면 출력 버튼이 꺼져 있다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    expect(screen.getByRole("button", { name: "영수증 출력 (0)" })).toBeDisabled();
  });

  it("체크하면 고른 영수증으로 PDF 주소를 만든다 — 접수일시 순", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    // 표 순서(r1, r2)와 반대로 누른다. r1 은 판독 전이라 올린 시각(한국 08-18 10:00)으로,
    // r2 는 접수일자(08-19)로 선다.
    fireEvent.click(boxes()[1]);
    fireEvent.click(boxes()[0]);
    expect(screen.getByRole("link", { name: "영수증 출력 (2)" })).toHaveAttribute(
      "href",
      "/api/postal/receipts/pdf?ids=r1,r2",
    );
  });

  it("체크해도 원본 팝업이 열리지 않는다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.click(boxes()[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("다시 누르면 빠진다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.click(boxes()[0]);
    fireEvent.click(boxes()[0]);
    expect(screen.getByRole("button", { name: "영수증 출력 (0)" })).toBeDisabled();
  });

  it("형광펜 자리를 다 못 찾은 장수를 알린다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    fireEvent.click(boxes()[0]);
    fireEvent.click(boxes()[1]);
    expect(screen.getByText("2장 중 1장은 형광펜이 빠진 곳이 있습니다")).toBeInTheDocument();
  });

  it("체크 칸은 표준 강조색이다", () => {
    render(<PostalTable receipts={receipts} extractStates={states} />);
    expect(boxes()[0]).toHaveClass("accent-vermilion");
  });
});

/**
 * 서명이 만료된 이미지는 깨진 아이콘 대신 이유를 보여준다.
 *
 * 서명 URL 은 5분이라 목록을 열어둔 채 나중에 누르면 죽는다. 그때 브라우저가
 * **깨진 이미지 아이콘**만 남겨, 사용자는 무엇이 잘못됐는지 모른다(2026-08-21).
 */
describe("PostalTable — 만료된 영수증", () => {
  it("이미지가 안 열리면 이유를 보여준다", () => {
    render(<PostalTable receipts={[receipts[0]]} extractStates={states} />);
    fireEvent.click(screen.getByText("song"));
    const img = screen.getByRole("img", { name: /영수증 원본/ });
    fireEvent.error(img);
    expect(screen.getByText(/다시 열/)).toBeInTheDocument();
  });
});

/**
 * 확정과 삭제는 같은 칸에 나란히.
 *
 * 표 위로 올렸지만 **여전히 다음 줄**이라 삭제와 나란히가 아니었다(2026-08-21).
 * 앞선 테스트가 "표보다 앞"만 봐서 그 상태로 통과했다 — 위치를 위아래로만 재면
 * 옆으로 나란한지는 알 수 없다.
 *
 * 확정은 편집 중인 표의 값을 쓰므로 로직은 `ReceiptReview` 에 남기고, 버튼만
 * 영수증 행에 그린다.
 */
describe("PostalTable — 확정·삭제 나란히", () => {
  const pending: ReceiptCard = { ...receipts[0], id: "r3" };
  const ready: Record<string, ExtractState> = { r3: states.r2 };

  it("같은 칸(td) 안에 있다", () => {
    render(<PostalTable receipts={[pending]} extractStates={ready} />);
    const confirm = screen.getByRole("button", { name: "확정" });
    const del = screen.getByRole("button", { name: /삭제/ });
    expect(confirm.closest("td")).toBe(del.closest("td"));
  });

  it("확정이 삭제 왼쪽이다 — 주 동작이 먼저다", () => {
    render(<PostalTable receipts={[pending]} extractStates={ready} />);
    const cell = screen.getByRole("button", { name: "확정" }).closest("td")!;
    const labels = [...cell.querySelectorAll("button")].map((b) => b.textContent);
    expect(labels).toEqual(["확정", "삭제"]);
  });

  it("판독 전에는 확정이 없다 — 확정할 내용이 없다", () => {
    render(<PostalTable receipts={[receipts[0]]} extractStates={states} />);
    expect(screen.queryByRole("button", { name: "확정" })).toBeNull();
  });
});

/**
 * 확정하면 검토 표를 접는다.
 *
 * 검토 표는 '고칠 것이 있나' 보는 자리다. 확정하면 그 일은 끝났고, 확정된 내용은
 * 등기대장 탭에 남는다. 그대로 펼쳐 두면 아직 할 일이 있는 것처럼 보이고,
 * 고쳐도 아무 일이 일어나지 않아 사람을 헷갈리게 한다.
 */
describe("확정한 영수증", () => {
  // ReceiptReview 는 이 파일에서 <div>리뷰</div> 로 모킹돼 있다.
  const only = (id: string) => receipts.filter((r) => r.id === id);

  it("검토 표를 접는다 — 할 일이 끝났다", () => {
    render(<PostalTable receipts={only("r2")} extractStates={states} />);
    expect(screen.queryByText("리뷰")).toBeNull();
  });

  it("요약은 그대로 남는다 — 무엇을 확정했는지는 보여야 한다", () => {
    render(<PostalTable receipts={only("r2")} extractStates={states} />);
    expect(screen.getByText("확정")).toBeInTheDocument();
    // 금액은 이 행에만 있다 — '1건'은 헤더 개수와 겹친다.
    expect(screen.getByText("4,590원")).toBeInTheDocument();
  });

  it("확정 전에는 검토 표가 펼쳐져 있다", () => {
    render(<PostalTable receipts={only("r1")} extractStates={states} />);
    expect(screen.getByText("리뷰")).toBeInTheDocument();
  });
});

/**
 * 다시 판독하면 검토 값이 새 판독으로 갈린다.
 *
 * 검토 행은 처음 한 번만 판독에서 복사해 들고 있어, 갈아끼우지 않으면 [확정]이
 * 옛 판독의 값을 전도금 장부에 쓴다. 같은 판독이면 고친 값은 새로고침을 넘어 남는다.
 */
describe("판독이 바뀌면 검토 값도 바뀐다", () => {
  const reading = (requestedAt: string, trackingNo: string): ExtractState => ({
    ...states.r2,
    requestedAt,
    rows: [{ ...states.r2.rows[0], trackingNo }],
  });
  const r1 = receipts.filter((r) => r.id === "r1");
  const withState = (s: ExtractState) => ({ r1: s });

  it("새 판독의 값으로 바뀌고 옛 값은 사라진다", () => {
    const { rerender } = render(
      <PostalTable
        receipts={r1}
        extractStates={withState(reading("2026-09-30T01:00:00Z", "AAA-1"))}
      />,
    );
    expect(screen.getByTestId("review-rows").textContent).toBe("AAA-1");
    rerender(
      <PostalTable
        receipts={r1}
        extractStates={withState(reading("2026-09-30T02:00:00Z", "BBB-2"))}
      />,
    );
    expect(screen.getByTestId("review-rows").textContent).toBe("BBB-2");
    expect(screen.queryByText("AAA-1")).toBeNull();
  });

  it("같은 판독이면 고친 값이 새로고침을 넘어 남는다", () => {
    const same = reading("2026-09-30T01:00:00Z", "AAA-1");
    const { rerender } = render(
      <PostalTable receipts={r1} extractStates={withState(same)} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "고침" }));
    expect(screen.getByTestId("review-rows").textContent).toBe("EDITED");
    rerender(
      <PostalTable
        receipts={r1}
        extractStates={withState({ ...same, rows: [...same.rows] })}
      />,
    );
    expect(screen.getByTestId("review-rows").textContent).toBe("EDITED");
  });
});

describe("출력 체크박스", () => {
  it("라벨이 올린 사람까지 담아 같은 시각의 영수증끼리 갈린다", () => {
    const twins: ReceiptCard[] = [
      { ...receipts[0], id: "a", uploadedBy: "song@x.com" },
      { ...receipts[0], id: "b", uploadedBy: "kim@x.com" },
    ];
    render(<PostalTable receipts={twins} extractStates={{}} />);
    expect(
      screen.getByRole("checkbox", { name: /song 영수증 출력에 넣기$/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /kim 영수증 출력에 넣기$/ }),
    ).toBeInTheDocument();
  });
});
