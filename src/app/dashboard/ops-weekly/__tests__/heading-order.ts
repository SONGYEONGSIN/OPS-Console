import { expect } from "vitest";
import { screen } from "@testing-library/react";

// 제목을 이름으로 찾고 문서 순서만 비교한다.
// 레벨·전체 제목 목록으로 단언하지 않는다 - AreaNotes 의 영역 특이사항 같은 다른 제목이 끼어도 깨지지 않게.
export const inOrder = (names: string[]) => {
  const hs = names.map((name) => screen.getByRole("heading", { name }));
  hs.slice(1).forEach((h, i) =>
    expect(
      hs[i].compareDocumentPosition(h) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy(),
  );
};
