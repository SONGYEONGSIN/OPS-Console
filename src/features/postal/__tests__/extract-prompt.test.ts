import { describe, it, expect } from "vitest";
import { buildExtractPrompt } from "../extract-prompt";

describe("buildExtractPrompt", () => {
  const p = buildExtractPrompt("receipt.jpg");

  it("읽을 파일을 지정한다", () => {
    expect(p).toContain("receipt.jpg");
  });

  it("카드 관련 값을 담지 말라고 못박는다 — 영수증에 승인번호가 찍혀 있다", () => {
    expect(p).toMatch(/카드번호/);
    expect(p).toMatch(/승인번호/);
    expect(p).toMatch(/가맹점번호/);
  });

  it("수취인을 소속과 이름으로 가르는 규칙을 준다", () => {
    expect(p).toMatch(/수취인/);
    expect(p).toMatch(/소속/);
  });

  it("지어내지 말라고 한다 — 흐린 종이 사진이라 못 읽는 값이 나온다", () => {
    expect(p).toMatch(/지어내지|null/);
  });

  it("영수증이 아니면 그렇다고 답하라고 한다 — 화면 캡처를 올린 적이 있다", () => {
    expect(p).toContain("is_receipt");
  });

  it("JSON만 답하라고 한다", () => {
    expect(p).toMatch(/JSON/);
  });

  it("영수증 종이·접수일자·총요금의 위치를 묻는다 — 출력이 자르고 형광펜을 입힌다", () => {
    expect(p).toContain('"regions"');
    expect(p).toContain('"receipt"');
    expect(p).toMatch(/"accepted_at": \[/);
    expect(p).toMatch(/"total_fee": \[/);
  });

  it("좌표는 0~1 비율이라고 못박는다 — 픽셀로 오면 스키마가 버린다", () => {
    expect(p).toMatch(/비율/);
    expect(p).toMatch(/픽셀/);
  });

  it("항목명이 아니라 값 자리를 짚게 한다 — 손 형광펜도 값에만 칠해져 있다", () => {
    expect(p).toMatch(/항목명/);
  });
});
