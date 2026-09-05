/**
 * 전형 이름표 붙여넣기 파서.
 *
 * 원서제어 코드에는 **`SelTypeCode` 와 전형 이름이 이어진 자리가 없다**(실측:
 * 같은 줄에 있는 건 1~18 나열 한 줄뿐). 그래서 학교 명세서가 `전형 코드 5` 로만
 * 적혔다. 대학이 주는 접수 현황 자료에 그 대응이 들어 있어 그걸 붙여넣는다.
 *
 * 자료는 **지원자 한 명이 한 줄**이라 같은 전형이 수십 줄로 온다 — 합친다.
 * 수험번호·아이디 같은 개인정보 칸은 **읽지 않는다** — 이름표에 필요 없다.
 */

export type AdmissionType = {
  /** 원서제어 JS 의 SelTypeCode. */
  selTypeCode: number;
  /** 대학이 전산매체로 주고받는 코드(레이아웃 문서의 지원전형유형코드). */
  univCode: string;
  name: string;
};

export type AdmissionTypeParseResult = {
  rows: AdmissionType[];
  /** 코드가 숫자가 아니어서 버린 행 수. 조용히 버리면 이름표가 비는 이유를 모른다. */
  skipped: number;
  headerError?: string;
};

/** 따옴표 안의 구분자는 칸을 가르지 않는다 — 모집단위에 `"라이프케어 ,[3004]"` 가 온다. */
function splitRow(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === sep && !quoted) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const norm = (s: string) => s.replace(/\s|_/g, "").toLowerCase();

export function parseAdmissionTypes(text: string): AdmissionTypeParseResult {
  const lines = (text ?? "").split(/\r?\n/).filter((l) => l.trim() !== "");
  if (lines.length < 2) return { rows: [], skipped: 0 };

  // 엑셀에서 바로 복사하면 탭, 파일로 받으면 쉼표다.
  const sep = lines[0].includes("\t") ? "\t" : ",";
  // BOM 과 인코딩 잔재를 떼고 헤더를 읽는다.
  const head = splitRow(lines[0].replace(/^[﻿ï»¿]+/, ""), sep).map(norm);

  const iSel = head.findIndex((h) => h.includes("seltypecode"));
  const iName = head.findIndex((h) => h.includes("전형명"));
  const iUniv = head.findIndex((h) => h.includes("u코드") || h.includes("전형유형코드"));
  if (iSel < 0 || iName < 0) {
    return {
      rows: [],
      skipped: 0,
      headerError: "머리글에 SelTypeCode 와 전형명이 있어야 합니다",
    };
  }

  const byCode = new Map<number, AdmissionType>();
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = splitRow(line, sep);
    const code = Number(cells[iSel]);
    const name = cells[iName] ?? "";
    // 코드가 숫자가 아니면 이름표가 엉뚱한 전형에 붙는다 — 버린다.
    if (!Number.isInteger(code) || !name) {
      skipped += 1;
      continue;
    }
    if (byCode.has(code)) continue;
    byCode.set(code, {
      selTypeCode: code,
      // 엑셀이 코드를 수식으로 내보내 `=01` 로 온다.
      univCode: (iUniv >= 0 ? (cells[iUniv] ?? "") : "").replace(/^=/, ""),
      name,
    });
  }
  return {
    rows: [...byCode.values()].sort((a, b) => a.selTypeCode - b.selTypeCode),
    skipped,
  };
}
