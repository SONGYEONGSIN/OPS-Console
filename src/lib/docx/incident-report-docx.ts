import "server-only";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  Table,
  TableRow,
  TableCell,
  WidthType,
} from "docx";
import type { IncidentReportPdfInput } from "@/lib/pdf/incident-report-pdf";

const FONT = "맑은 고딕";

function p(
  text: string,
  opts?: {
    bold?: boolean;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
  },
) {
  return new Paragraph({
    alignment: opts?.align,
    children: [new TextRun({ text, bold: opts?.bold, font: FONT })],
  });
}

function section(no: number, label: string, body: string | null): Paragraph[] {
  return [p(`${no}. ${label}`, { bold: true }), p(body ?? "")];
}

function approvalCell(header: string, value: string): TableCell {
  return new TableCell({
    children: [
      p(header, { align: AlignmentType.CENTER }),
      p(value, { align: AlignmentType.CENTER }),
    ],
  });
}

export async function renderIncidentReportDocx(
  input: IncidentReportPdfInput,
): Promise<Buffer> {
  const approvalTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          approvalCell("담당자", input.authorName),
          approvalCell("팀장", input.approverName ?? ""),
          approvalCell("본부장", input.directorName ?? ""),
          approvalCell("사장", input.ceoName ?? ""),
        ],
      }),
    ],
  });

  const coverChildren: (Paragraph | Table)[] = [
    p(
      "대한민국 대표 원서접수 사이트 진학어플라이 · 대한민국 최대 입시전문 포탈사이트 진학닷컴",
      { align: AlignmentType.CENTER },
    ),
    p(`수신자  ${input.recipientUniversity}`),
    p(`제  목  ${input.title}`),
    p(input.apology),
    p(`붙임 : 1. ${input.title} 경위서 1부.  끝.`),
    approvalTable,
  ];
  if (input.docNumber) coverChildren.push(p(`시행  ${input.docNumber}`));

  const reportChildren: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: "경 위 서", bold: true, font: FONT })],
    }),
    p(`작성일자 : ${input.draftDate}      작성자 : ${input.authorName}`),
    p(`제목 : ${input.title}`, { bold: true }),
    ...section(1, "경위", input.gyeongwi),
    ...section(2, "원인", input.cause),
    ...section(3, "처리", input.handling),
    ...section(4, "향후 대책", input.prevention),
    p("이번 오류로 업무에 불편을 드린 점 거듭 사과드립니다."),
  ];

  const doc = new Document({
    sections: [{ children: coverChildren }, { children: reportChildren }],
  });
  return Packer.toBuffer(doc);
}
