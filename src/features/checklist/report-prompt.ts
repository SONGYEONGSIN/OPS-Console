// 체크리스트 AI 보고리포트 — claude -p 프롬프트 빌더 + 출력 파서 (순수 함수, vitest 대상).
// 작성된 전체 내용(부서→분야→항목 제목·상태·메모)을 정리 재료로 넘기고,
// 화이트리스트 HTML 서술형 리포트를 강제한다. 실제 실행/저장은 report-actions.ts.
import type { ChecklistRound, ChecklistItem, ItemStatus } from "./schemas";
import { DEPARTMENTS, deptLabel } from "./schemas";
import { stripNoteHtml } from "./note-html";

const STATUS_LABEL: Record<ItemStatus, string> = {
  done: "완료",
  in_progress: "진행중",
  todo: "작업전",
  na: "해당없음",
};

/** 작성된 전체 내용 → claude -p 프롬프트. 서술형 HTML 리포트를 강제한다. */
export function buildReportPrompt(
  round: ChecklistRound,
  items: ChecklistItem[],
): string {
  const material: string[] = [];
  for (const dept of DEPARTMENTS) {
    const deptItems = items.filter((i) => i.department === dept);
    if (deptItems.length === 0) continue;
    material.push(`\n## ${deptLabel(dept)}`);
    const cats = Array.from(new Set(deptItems.map((i) => i.category)));
    for (const cat of cats) {
      if (cat) material.push(`### ${cat}`);
      for (const it of deptItems.filter((i) => i.category === cat)) {
        const status = it.status ? STATUS_LABEL[it.status] : "미지정";
        material.push(`- [${status}] ${it.title}`);
        const note = stripNoteHtml(it.note);
        if (note)
          material.push(
            note
              .split("\n")
              .map((l) => `    ${l}`)
              .join("\n"),
          );
      }
    }
  }
  const period = `${round.periodStart ?? "-"} ~ ${round.periodEnd ?? "-"}`;

  return [
    "당신은 어플라이본부의 '원서접수 점검' 결과를 임원에게 보고하는 리포트를 작성합니다.",
    "아래는 각 부서가 체크리스트에 작성한 전체 내용입니다. 이를 정리하여 임원용 서술형 보고 리포트로 재구성하세요.",
    "",
    `# ${round.title}`,
    `점검 기간: ${period}`,
    material.join("\n"),
    "",
    "── 작성 지침 ──",
    "1. 순수 HTML로만 출력한다. 마크다운·코드펜스(```)·설명 문장 없이 리포트 본문 HTML만 반환한다.",
    "2. 허용 태그만 사용: <h2> <h3> <p> <ul> <ol> <li> <b> <table> <thead> <tbody> <tr> <th> <td>.",
    "3. 맨 위에 <h2>요약</h2> + <p>로 전체 완료 현황과 부서별 핵심을 3~5문장으로 요약한다.",
    "4. 이후 부서별로 <h2>부서명</h2> 섹션을 만들고, 작성 내용을 서술형 문단(<p>)으로 정리한다. 수치·표 데이터는 <table>로 재구성한다.",
    "5. 상태(완료/진행중/작업전)는 문맥에 자연스럽게 녹여 서술하고, 단순 항목 나열은 피한다.",
    "6. 한국어 보고서 문체(서술형)로 작성한다.",
  ].join("\n");
}

/** claude 출력에서 리포트 HTML만 추출 — 코드펜스/전후 공백 제거. */
export function extractReportHtml(raw: string): string {
  let s = raw.trim();
  const fence = /^```(?:html)?\s*([\s\S]*?)\s*```$/i.exec(s);
  if (fence) s = fence[1].trim();
  return s;
}
