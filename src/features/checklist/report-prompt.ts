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
    "2. 허용 태그만 사용: <h2> <h3> <p> <ul> <li> <b> <table> <thead> <tbody> <tr> <th> <td>.",
    "3. 임원 보고용 개조식(명사형 종결)으로 작성한다. 긴 서술 문단 대신 핵심을 항목화한다.",
    "4. 맨 위에 <h2>요약</h2> + <p>로 전체 완료 현황과 핵심 이슈를 2~3줄로 압축한다.",
    "5. 부서별로 <h2>부서명</h2> 섹션을 만들고, 주요 항목·이슈를 <ul>의 최상위 <li>로 나열한다. 항목 제목은 <b>로 강조한다.",
    "6. 각 항목 아래에 <ul><li><b>분류</b> : 내용</li> …</ul> 형태의 하위 불릿으로 세부를 정리한다. 분류 라벨(대상·규모·현황·일정·영향·조치·연계·작업 등)은 내용에 맞게 붙이고 <b>로 강조한다. 예시:",
    "<ul><li><b>의사선발전형(지역의사제)</b><ul><li><b>대상</b> : 서울 제외 비수도권 32개 의대</li><li><b>규모</b> : 2027학년도 증원분 490명 전량 지역의사전형 선발(3,058→3,548명)</li><li><b>영향</b> : 전형 신설에 따른 원서접수 작업 변경 반영 필요</li></ul></li></ul>",
    "7. 수치 비교·표 데이터(당직 편성, 계약 체결률 등)는 <table>로 정리한다.",
    "8. 상태(완료/진행중/작업전)는 '현황' 분류로 간결히 표기한다.",
  ].join("\n");
}

/** claude 출력에서 리포트 HTML만 추출 — 코드펜스/전후 공백 제거. */
export function extractReportHtml(raw: string): string {
  let s = raw.trim();
  const fence = /^```(?:html)?\s*([\s\S]*?)\s*```$/i.exec(s);
  if (fence) s = fence[1].trim();
  return s;
}
