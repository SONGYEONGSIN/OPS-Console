import type { PdfNode } from "./pdf-model";

/**
 * numberedListItem의 표시 번호를 계산한다.
 * 연속된 numbered 구간마다 1부터 시작하며, 다른 kind를 만나면 카운터가 리셋된다.
 * numbered가 아닌 노드의 값은 0(미사용)이다.
 */
export function numberedSequence(model: PdfNode[]): number[] {
  const out: number[] = [];
  let counter = 0;
  for (const node of model) {
    if (node.kind === "numbered") {
      counter += 1;
      out.push(counter);
    } else {
      counter = 0;
      out.push(0);
    }
  }
  return out;
}
