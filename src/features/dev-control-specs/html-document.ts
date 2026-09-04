import type { DevControlSpecItem } from "./schemas";

export type SpecDocumentArgs = {
  universityName: string;
  serviceName?: string | null;
  items: DevControlSpecItem[];
  /** 코드를 걷어 온 시각 — 학교에는 이게 곧 신뢰다. */
  sourceAnalyzedAt?: string | null;
};

const BRAND = "운영부 상황실";

/**
 * HTML 이스케이프 — 항목 문구는 모델이 코드에서 뽑아 쓴 문장이라 형태를 못 믿는다.
 */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 나갈 항목만. 여기 한 곳에서 거른다 — 거르는 자리가 흩어지면 언젠가 새어 나간다. */
function includedItems(items: DevControlSpecItem[]): DevControlSpecItem[] {
  const included = items.filter((i) => i.included);
  if (included.length === 0) {
    throw new Error(
      "보낼 항목이 없습니다 — 최소 한 개는 포함해야 발송할 수 있습니다.",
    );
  }
  return included;
}

function kstDate(iso: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}

/**
 * 첨부 파일명 — **서비스명 + 원서제어 안내서**.
 *
 * 받는 쪽 메일함에서 이름만 보고 무엇인지 알아야 한다. 윈도우·맥이 파일명에
 * 못 쓰는 문자가 서비스명에 섞여 오면(`수시/정시 1차`) 저장이 실패하므로 뺀다.
 */
export function specAttachmentName(args: SpecDocumentArgs): string {
  const base = args.serviceName?.trim() || args.universityName;
  const safe = base.replace(/[\/:*?"<>|]/g, " ").replace(/\s+/g, " ").trim();
  return `${safe} 원서제어 안내서.html`;
}

/**
 * 학교 담당자에게 보내는 **원서제어 안내서** — 메일 첨부(.html).
 *
 * 본문에 다 싣지 않는 이유는 길이다 — 실측 68항목이 23,734자였다. 메일에서
 * 스크롤로 읽을 분량이 아니고, 학교가 내부 회람하려면 파일이 편하다.
 * 인수인계·백업요청과 같은 방식이다(PDF 가 아니라 HTML — 메일 클라이언트에서 바로 열린다).
 */
export function buildSpecHtmlDocument(args: SpecDocumentArgs): string {
  const items = includedItems(args.items);
  const collected = args.sourceAnalyzedAt ? kstDate(args.sourceAnalyzedAt) : null;
  const heading = args.serviceName
    ? `${esc(args.universityName)} ${esc(args.serviceName)}`
    : esc(args.universityName);

  const rows = items
    .map(
      (item, idx) => `
      <li class="item">
        <div class="num">${idx + 1}</div>
        <div class="body">
          <h2>${esc(item.title)}</h2>
          <p>${esc(item.body)}</p>
        </div>
      </li>`,
    )
    .join("");

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${heading} 원서제어 안내서</title>
<style>
  :root{ --vermilion:#b8331e; --ink:#1a1712; --muted:#8a8175; --line:#e2dac9; }
  *{box-sizing:border-box;}
  body{margin:0;background:#f2efe8;color:var(--ink);
    font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI','맑은 고딕',sans-serif;
    -webkit-font-smoothing:antialiased;line-height:1.7;}
  .sheet{max-width:860px;margin:24px auto;background:#fff;
    box-shadow:0 6px 28px rgba(0,0,0,.16);overflow:hidden;}
  .band{background:var(--vermilion);color:#fff;padding:26px 34px 22px;}
  .brand{font-size:11px;letter-spacing:.24em;opacity:.9;margin-bottom:10px;}
  .btitle{font-size:25px;font-weight:800;letter-spacing:-.01em;}
  .bsub{font-size:13px;opacity:.92;margin-top:7px;}
  .lead{padding:22px 34px 0;font-size:14px;color:#3a352c;}
  ol.items{list-style:none;margin:18px 0 0;padding:0 34px;}
  .item{display:flex;gap:16px;padding:16px 0;border-top:1px solid var(--line);}
  .item:first-child{border-top:none;}
  .num{flex:none;width:26px;height:26px;border-radius:50%;background:var(--vermilion);
    color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;
    justify-content:center;margin-top:2px;}
  .body h2{margin:0;font-size:15px;font-weight:700;}
  .body p{margin:6px 0 0;font-size:14px;color:#4a443a;}
  .foot{padding:20px 34px 28px;font-size:12px;color:var(--muted);
    border-top:1px solid var(--line);margin-top:18px;}
  @media print{
    body{background:#fff;}
    .sheet{box-shadow:none;margin:0;max-width:none;}
    .item{break-inside:avoid;}
  }
</style>
</head>
<body>
  <div class="sheet">
    <div class="band">
      <div class="brand">${BRAND}</div>
      <div class="btitle">원서접수 제어 안내서</div>
      <div class="bsub">${heading}</div>
    </div>
    <p class="lead">원서접수에 현재 적용되어 있는 제어를 정리한 문서입니다. 지원자가 실제로 겪는 내용을 기준으로 적었습니다.</p>
    <ol class="items">${rows}</ol>
    <div class="foot">
      ${collected ? `${collected} 기준으로 확인한 내용입니다.<br>` : ""}
      변경이 필요하시면 담당 운영자에게 회신해 주세요.
    </div>
  </div>
</body>
</html>`;
}
