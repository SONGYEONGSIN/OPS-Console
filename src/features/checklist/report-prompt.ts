// 체크리스트 AI 보고리포트 — claude -p 프롬프트 빌더 + 출력 파서 (순수 함수, vitest 대상).
// 작성된 전체 내용(부서→분야→항목 제목·상태·메모)을 정리 재료로 넘기고,
// 화이트리스트 HTML 서술형 리포트를 강제한다. 실제 실행/저장은 report-actions.ts.
import type { ChecklistRound, ChecklistItem, ItemStatus } from "./schemas";
import { DEPARTMENTS, deptLabel } from "./schemas";
import { stripNoteHtml, extractNoteImages } from "./note-html";

const STATUS_LABEL: Record<ItemStatus, string> = {
  done: "완료",
  in_progress: "진행중",
  todo: "작업전",
  na: "해당없음",
};

/**
 * 작성된 전체 내용 → claude -p 프롬프트. 서술형 HTML 리포트를 강제한다.
 * imagePaths: 메모 이미지 URL → 로컬 파일 경로. 있으면 해당 항목에 경로를 참조해
 * claude가 Read로 이미지 내용(표·수치)까지 반영하게 한다.
 */
export function buildReportPrompt(
  round: ChecklistRound,
  items: ChecklistItem[],
  imagePaths: Record<string, string> = {},
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
        for (const url of extractNoteImages(it.note)) {
          const fp = imagePaths[url];
          if (fp) material.push(`    [첨부 이미지 → 파일 경로: ${fp}]`);
        }
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
    "3. 서술형과 개조식을 결합한다: 각 섹션은 흐름을 짚는 짧은 서술 문단(<p>) 뒤에 세부를 개조식(<ul>)으로 정리한다.",
    "4. 맨 위에 <h2>요약</h2> + <p>로 전체 진행 상황과 핵심 이슈를 2~3줄로 서술한다.",
    "5. 부서별 <h2>부서명</h2> 섹션은 도입 <p>(해당 부서의 전반 진행 상황을 1~2문장 서술) + 주요 항목을 <ul>의 최상위 <li>(제목 <b> 강조)로 나열한다.",
    "6. 각 항목 아래에 <ul><li><b>분류</b> : 내용</li> …</ul> 형태의 하위 불릿으로 세부를 정리한다. 분류 라벨(대상·규모·일정·영향·조치·연계·작업·이슈 등)은 내용에 맞게 붙이고 <b>로 강조한다. 예시:",
    "<ul><li><b>의사선발전형(지역의사제)</b><ul><li><b>대상</b> : 서울 제외 비수도권 32개 의대</li><li><b>규모</b> : 2027학년도 증원분 490명 전량 지역의사전형 선발(3,058→3,548명)</li><li><b>영향</b> : 전형 신설에 따른 원서접수 작업 변경 반영 필요</li></ul></li></ul>",
    "7. 수치 비교·표 데이터(당직 편성, 계약 체결률 등)는 <table>로 정리한다.",
    "8. 완료/진행중/작업전 같은 상태는 '현황' 항목으로 따로 표기하지 말고, 필요하면 도입 서술 문단에만 자연스럽게 녹인다.",
    "9. 항목에 '[첨부 이미지 → 파일 경로: …]'가 있으면 Read 도구로 그 이미지 파일을 반드시 열어, 담긴 표·수치를 해당 항목의 서술·표에 반영한다. 이미지 자체를 출력에 넣지는 말고 내용만 반영한다.",
    "10. 이 점검은 수시모집 대상이다. 정시(정시모집) 관련 서술·표 행·수치는 모두 제외한다.",
    "11. 접수건수 예측 비교 표는 다음을 따른다: (a) 학년도는 2027·2026만 포함(2025 이전 열 제외), (b) 진학사와 유웨이 수치를 함께 표기해 두 기관을 비교, (c) 전형은 '4년제 수시 / 전문대 수시1차 / 전문대 수시2차'로 구분하고 '수시 합계' 행을 둔다(2년제로 뭉뚱그리지 않는다), (d) 정시 행 제외. 첨부 이미지에서 위 값을 읽어 채운다.",
    "12. 부서(<h2>)·카테고리(<h3>) 제목은 위 자료의 명칭을 그대로 사용한다(임의 변경·추가 금지). 항목 구성과 소제목 틀은 회차마다 일관되게 유지하고, 매 생성마다 재구성하지 않는다.",
  ].join("\n");
}

/** claude 출력에서 리포트 HTML만 추출 — 코드펜스 + 첫 태그 앞/뒤 잡텍스트 제거. */
export function extractReportHtml(raw: string): string {
  let s = raw.trim();
  const fence = /^```(?:html)?\s*([\s\S]*?)\s*```$/i.exec(s);
  if (fence) s = fence[1].trim();
  // claude가 "Here is the report:" 같은 설명을 앞뒤에 붙이는 경우 제거.
  s = s
    .replace(/^[^<]*/, "")
    .replace(/[^>]*$/, "")
    .trim();
  return s;
}
