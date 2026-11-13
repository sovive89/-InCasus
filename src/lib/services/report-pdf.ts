import type { ReportFilters, ReportRow } from "./reports";
import { AI_DISCLAIMER } from "@/lib/domain/labels";

export async function createReportPdf(rows: ReportRow[], filters: ReportFilters, clientLabel: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  const fontResponse = await fetch("/downloads/fonts/report-sans.ttf");
  if (!fontResponse.ok) throw new Error("Não foi possível carregar a fonte do relatório.");
  const bytes = new Uint8Array(await fontResponse.arrayBuffer());
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  doc.addFileToVFS("ReportSans.ttf", btoa(binary));
  doc.addFont("ReportSans.ttf", "ReportSans", "normal");
  doc.setFont("ReportSans", "normal");
  doc.setProperties({ title: "Relatório de processos e atividades — InCasus", author: "InCasus", subject: "Relatório demonstrativo filtrado" });
  let y = 20;
  const width = 174;
  function paragraph(text: string, size = 10, gap = 3) {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(text, width) as string[];
    const lineHeight = size * 0.45;
    for (const line of lines) {
      if (y + lineHeight > 275) { doc.addPage(); y = 20; }
      doc.text(line, 18, y); y += lineHeight;
    }
    y += gap;
  }
  function ensureSpace(height: number) { if (y + height > 275) { doc.addPage(); y = 20; } }
  paragraph("InCasus", 20, 4);
  paragraph("Relatório de processos e atividades", 14, 3);
  paragraph("Demonstração — dados fictícios e agenda local; não é um relatório oficial.", 9);
  paragraph(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, 9);
  paragraph(`Cliente: ${clientLabel}\nPeríodo: ${filters.from || "Sem início"} a ${filters.to || "Sem fim"}\nResponsável: ${filters.responsible || "Todos"}\nConteúdo: ${filters.type === "all" ? "Processos e atividades" : filters.type === "process" ? "Processos" : "Atividades"}`, 9);
  paragraph("Período aplicado à última movimentação dos processos e à data da atividade. Processos e tarefas sem responsável cadastrado: Não atribuído.", 9, 6);
  for (const section of ["process", "activity"] as const) {
    if (filters.type !== "all" && filters.type !== section) continue;
    const items = rows.filter((row) => row.section === section);
    ensureSpace(30);
    paragraph(`${section === "process" ? "Processos" : "Atividades"} (${items.length})`, 13, 5);
    if (!items.length) paragraph("Nenhum registro no filtro selecionado.");
    for (const row of items) {
      const metadata = `${row.client} | ${row.kind}\nData: ${new Date(row.date).toLocaleString("pt-BR")} | Responsável: ${row.responsible}`;
      doc.setFontSize(11);
      const titleHeight = (doc.splitTextToSize(row.title, width) as string[]).length * 4.95 + 1;
      doc.setFontSize(9);
      const metadataHeight = (doc.splitTextToSize(metadata, width) as string[]).length * 4.05 + 2;
      const detailsHeight = row.details ? (doc.splitTextToSize(row.details, width) as string[]).length * 4.05 + 5 : 4;
      ensureSpace(Math.min(255, titleHeight + metadataHeight + detailsHeight));
      paragraph(row.title, 11, 1);
      paragraph(metadata, 9, 2);
      if (row.details) paragraph(row.details, 9, 5);
      else y += 4;
    }
  }
  ensureSpace(25);
  paragraph(AI_DISCLAIMER, 8);
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFontSize(8);
    doc.text(`InCasus • Confidencial • Demonstração`, 18, 286);
    doc.text(`${page} / ${pages}`, 192, 286, { align: "right" });
  }
  return doc.output("blob");
}