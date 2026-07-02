import { HANDOVER_CATEGORIES, type HandoverFieldKey } from "./categories";
import { isHandoverFieldComplete } from "./completion";
import type { HandoverMailContent } from "./mail-template";

/**
 * 인수인계 메일 첨부용 **독립 HTML 문서** 생성.
 *
 * 메일 본문(mail-template)은 메일 클라이언트 제약(배경색 금지·flex 미지원)을 따르지만,
 * 이 문서는 첨부파일로 **브라우저에서 열리므로** 배경 밴드·2단 레이아웃(clean-v2)을
 * 그대로 사용한다. 좌측 목차 레일 + 우측 본문 흐름 + 진행률.
 */
export type HandoverHtmlInput = {
  universityName: string;
  serviceName: string;
  applicationType: string;
  fromName: string;
  fromEmail: string;
  toName: string;
  toEmail: string;
  notes: string | null;
  createdAt: string;
} & HandoverMailContent;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * escape + http(s) URL을 <a>로 변환. 줄바꿈/들여쓰기는 렌더 컨테이너의
 * `white-space:pre-wrap`으로 보존하므로 여기서 <br> 치환하지 않는다.
 */
function textHtml(s: string): string {
  return escapeHtml(s).replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#2352c9;">$1</a>',
  );
}

function formatYmd(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** 필드 값 영역 — 구조화 필드는 데이터로, 빈 필드는 (미작성). */
function fieldValueHtml(
  input: HandoverHtmlInput,
  data: Record<string, unknown>,
  key: HandoverFieldKey,
): string {
  if (!isHandoverFieldComplete(data, key)) {
    return `<span class="empty">(미작성)</span>`;
  }

  if (key === "contract_info_md") {
    const c = input.contractInfo;
    const rows = [
      ["제목", c.title],
      ["형태", c.type],
      ["진행", c.progress],
      ["상태", c.status],
    ]
      .filter(([, v]) => v && v.trim())
      .map(
        ([k, v]) =>
          `<div class="kvline"><span class="kvk">${escapeHtml(k)}</span><span class="kvv">${escapeHtml(v)}</span></div>`,
      )
      .join("");
    const memo = c.memo.trim()
      ? `<div class="memoline">${textHtml(c.memo)}</div>`
      : "";
    return rows + memo;
  }

  if (key === "contract_data_md" || key === "docs_md") {
    const isDocs = key === "docs_md";
    const list = isDocs ? input.docsChecklist : input.contractChecklist;
    const memo = (input.fields[key] ?? "").trim();
    const items = list
      .filter((c) => c.text.trim())
      .map(
        (c) =>
          `<div class="chkline"><span class="${c.done ? "chkdone" : "chktodo"}">${c.done ? "✓" : "○"}</span> ${escapeHtml(c.text)}</div>`,
      )
      .join("");
    return (
      items + (memo ? `<div class="memoline">${textHtml(memo)}</div>` : "")
    );
  }

  if (key === "payment_fee_md") {
    const p = input.paymentFee;
    const head = [
      p.deadline.trim() && `정산기한 ${escapeHtml(p.deadline)}`,
      p.manager.trim() && `담당 ${escapeHtml(p.manager)}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const memo = p.memo.trim()
      ? `<div class="memoline">${textHtml(p.memo)}</div>`
      : "";
    return (head ? `<div class="valline">${head}</div>` : "") + memo;
  }

  if (key === "payment_invoice_md") {
    const p = input.paymentInvoice;
    const head = p.issueType.trim()
      ? `<div class="valline">${escapeHtml(p.issueType)}</div>`
      : "";
    const memo = p.memo.trim()
      ? `<div class="memoline">${textHtml(p.memo)}</div>`
      : "";
    return head + memo;
  }

  if (key === "school_contact_md") {
    return input.schoolContacts
      .map(
        (c) =>
          `<div class="pplline">${escapeHtml(c.name)}<span class="ppldim">${c.jobTitle ? ` (${escapeHtml(c.jobTitle)})` : ""}${c.ext ? ` · ${escapeHtml(c.ext)}` : ""}${c.email ? ` · ${escapeHtml(c.email)}` : ""}</span></div>`,
      )
      .join("");
  }

  return `<div class="valline">${textHtml((input.fields[key] ?? "").trim())}</div>`;
}

export function buildHandoverHtmlDocument(input: HandoverHtmlInput): string {
  const data: Record<string, unknown> = {
    ...input.fields,
    contract_info: input.contractInfo,
    contract_data_checklist: input.contractChecklist,
    docs_checklist: input.docsChecklist,
    payment_fee: input.paymentFee,
    payment_invoice: input.paymentInvoice,
    school_contacts: input.schoolContacts,
  };

  const cats = HANDOVER_CATEGORIES.map((cat) => {
    const total = cat.fields.length;
    const filled = cat.fields.filter((f) =>
      isHandoverFieldComplete(data, f.key),
    ).length;
    return { cat, total, filled, complete: total > 0 && filled === total };
  });
  const completeCount = cats.filter((c) => c.complete).length;
  const totalCats = cats.length;
  // 진행률 게이지 — 6칸 배터리 (완료 영역 수만큼 채움)
  const batteryCells = Array.from(
    { length: totalCats },
    (_, i) =>
      `<span class="cell ${i < completeCount ? "cellfull" : "cellempty"}"></span>`,
  ).join("");

  const tocRows = cats
    .map(
      ({ cat, filled, total, complete }, i) => `
        <a class="tocrow" href="#sec-${cat.key}">
          <span class="tocname"><span class="tocno">${String(i + 1).padStart(2, "0")}</span>${escapeHtml(cat.label)}</span>
          <span class="chip ${complete ? "chipok" : "chippartial"}">${filled}/${total}</span>
        </a>`,
    )
    .join("");

  const sections = cats
    .map(
      ({ cat, filled, total }) => `
        <section class="sec" id="sec-${cat.key}">
          <div class="sechead">
            <span class="sectitle">${escapeHtml(cat.label)}</span>
            <span class="seccount">${filled}/${total}</span>
          </div>
          ${cat.fields
            .map(
              (f) => `
            <div class="fld">
              <span class="fldk">${escapeHtml(f.label)}</span>
              <div class="fldv">${fieldValueHtml(input, data, f.key)}</div>
            </div>`,
            )
            .join("")}
        </section>`,
    )
    .join("");

  const memoBlock = input.notes?.trim()
    ? `
        <div class="railmemo">
          <div class="railcap2">인계 메모</div>
          <div class="railmemotext">${escapeHtml(input.notes)}</div>
        </div>`
    : "";

  const subtitle = escapeHtml(
    [input.applicationType, input.universityName, input.serviceName]
      .filter(Boolean)
      .join(" · "),
  );

  // 메타 '서비스' 값 — 접수구분·대학명·서비스명 모두 볼드, 구분점만 연하게
  const serviceValue = [
    input.applicationType.trim() &&
      `<span class="pri">${escapeHtml(input.applicationType)}</span>`,
    `<span class="pri">${escapeHtml(input.universityName)}</span>`,
    input.serviceName.trim() &&
      `<span class="pri">${escapeHtml(input.serviceName)}</span>`,
  ]
    .filter(Boolean)
    .join('<span class="dim"> · </span>');
  const person = (name: string, email: string) =>
    `<span class="pri">${escapeHtml(name)}</span><span class="dim"> · ${escapeHtml(email)}</span>`;

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>인수인계 확인서 — ${escapeHtml(input.universityName)} · ${escapeHtml(input.serviceName)}</title>
<style>
  :root{
    --vermilion:#b8331e; --vermilion-deep:#8e2412; --ink:#1a1712; --muted:#8a8175;
    --faint:#b8b0a2; --washi:#ede6d2; --washi-raised:#f4eddd; --paper:#fbf7f0;
    --line:#e2dac9; --sage:#5c7346;
  }
  *{box-sizing:border-box;}
  html{scroll-behavior:smooth;}
  body{margin:0;background:#f2efe8;color:var(--ink);
    font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    -webkit-font-smoothing:antialiased;line-height:1.6;}
  .sheet{max-width:900px;margin:24px auto;background:#fff;
    box-shadow:0 6px 28px rgba(0,0,0,.18);overflow:hidden;}
  .band{background:var(--vermilion);color:#fff;padding:26px 34px 22px;}
  .brand{font-size:11px;letter-spacing:.24em;opacity:.9;margin-bottom:10px;}
  .btitle{font-size:26px;font-weight:800;letter-spacing:-.01em;}
  .bsub{font-size:13px;opacity:.92;margin-top:7px;}
  .meta{background:#e0e0e5;padding:16px 34px;display:flex;
    justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap;}
  .metacol{display:grid;grid-template-columns:52px auto;gap:6px 14px;align-items:baseline;}
  .metacol b{color:#43434a;font-weight:600;font-size:12px;}
  .metacol span{font-size:12px;color:#1f1f24;}
  .metacol .pri{font-weight:700;color:#1f1f24;}
  .metacol .dim{font-weight:400;color:#6b6b72;}
  .prog{display:flex;flex-direction:column;align-items:flex-end;}
  .progn{font-size:22px;font-weight:800;color:#1f1f24;line-height:1;}
  .progl{font-size:11px;color:#43434a;margin-top:3px;}
  .battery{display:flex;align-items:center;gap:2px;margin-top:8px;transform:translateX(8px);}
  .battcells{display:flex;gap:2px;padding:2px;border:1.5px solid #43434a;border-radius:3px;}
  .cell{width:15px;height:11px;border-radius:1px;}
  .cellfull{background:#5c7346;}
  .cellempty{background:#cfcfd5;}
  .battcap{width:3px;height:7px;background:#43434a;border-radius:0 2px 2px 0;}
  .bodywrap{display:flex;align-items:stretch;}
  .rail{width:210px;flex:none;background:var(--paper);border-right:1px solid var(--line);padding:24px 20px;}
  .railcap{font-size:10px;letter-spacing:.2em;color:var(--faint);font-weight:700;margin-bottom:10px;}
  .tocrow{display:flex;justify-content:space-between;align-items:center;padding:9px 0;
    text-decoration:none;color:inherit;cursor:pointer;}
  .tocrow + .tocrow{border-top:1px solid var(--line);}
  .tocrow:hover .tocname{color:var(--vermilion);}
  .tocname{font-weight:600;font-size:13px;}
  .tocno{color:var(--faint);margin-right:9px;font-variant-numeric:tabular-nums;}
  .chip{font-size:11px;font-weight:700;padding:2px 9px;border-radius:99px;}
  .chipok{background:var(--sage);color:#fff;}
  .chippartial{background:var(--washi-raised);color:var(--muted);}
  .railmemo{margin-top:22px;padding-top:14px;border-top:1px solid var(--line);}
  .railcap2{font-size:10px;letter-spacing:.14em;color:var(--faint);font-weight:700;margin-bottom:5px;}
  .railmemotext{font-size:12px;white-space:pre-wrap;}
  .main{flex:1;padding:24px 34px;min-width:0;}
  .sec{margin-bottom:22px;scroll-margin-top:16px;}
  .sechead{display:flex;justify-content:space-between;align-items:flex-end;
    border-bottom:2.5px solid var(--vermilion);padding-bottom:5px;margin-bottom:10px;}
  .sectitle{font-size:15px;font-weight:800;color:var(--vermilion);}
  .seccount{font-size:11px;color:var(--muted);font-weight:600;}
  .fld{display:grid;grid-template-columns:80px 1fr;gap:14px;padding:8px 2px;}
  .fld + .fld{border-top:1px solid var(--washi-raised);}
  .fldk{color:var(--ink);font-size:12px;font-weight:700;}
  .fldv{font-size:13px;line-height:1.75;overflow-wrap:anywhere;word-break:break-word;}
  .kvline{display:grid;grid-template-columns:44px 1fr;gap:10px;}
  .kvk{color:var(--muted);font-weight:600;}
  .valline{white-space:pre-wrap;}
  .memoline{color:var(--muted);margin-top:3px;white-space:pre-wrap;}
  .chkline{}
  .chkdone{color:var(--sage);font-weight:700;}
  .chktodo{color:var(--faint);}
  .pplline{padding:1px 0;}
  .ppldim{color:var(--muted);}
  .empty{color:var(--faint);font-size:12px;}
  .foot{padding:14px 34px;border-top:2px solid var(--vermilion);color:var(--muted);font-size:11px;}
  @media print{body{background:#fff;}.sheet{box-shadow:none;margin:0;max-width:none;}}
</style>
</head>
<body>
  <div class="sheet">
    <div class="band">
      <div class="brand">운영부 상황실 · 인수인계</div>
      <div class="btitle">인수인계 확인서</div>
      <div class="bsub">${subtitle}</div>
    </div>

    <div class="meta">
      <div class="metacol">
        <b>인계자</b><span>${person(input.fromName, input.fromEmail)}</span>
        <b>인수자</b><span>${person(input.toName, input.toEmail)}</span>
      </div>
      <div class="metacol">
        <b>서비스</b><span>${serviceValue}</span>
        <b>인계일</b><span>${escapeHtml(formatYmd(input.createdAt))}</span>
      </div>
      <div class="prog">
        <div class="progn">${completeCount} / ${totalCats}</div>
        <div class="progl">영역 작성 완료</div>
        <div class="battery">
          <div class="battcells">${batteryCells}</div>
          <div class="battcap"></div>
        </div>
      </div>
    </div>

    <div class="bodywrap">
      <aside class="rail">
        <div class="railcap">목차</div>
        ${tocRows}
        ${memoBlock}
      </aside>
      <div class="main">
        ${sections}
      </div>
    </div>

    <div class="foot">운영부 상황실 자동발송 · 인수 확인은 인수인계 &rsaquo; 인수인계 확인 탭에서 진행해 주세요.</div>
  </div>
</body>
</html>`;
}
