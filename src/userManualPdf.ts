import { jsPDF } from "jspdf";
import type { Role } from "./data";
import type { ManualSection } from "./userManualContent";

export function buildManualPdf(role: Role, sections: readonly ManualSection[]) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const width = pdf.internal.pageSize.getWidth();
  const height = pdf.internal.pageSize.getHeight();
  const margin = 18;
  let y = 26;

  const header = () => {
    pdf.setFillColor(18, 63, 54);
    pdf.rect(0, 0, width, 13, "F");
    pdf.setFont("helvetica", "bold").setFontSize(10).setTextColor(255, 255, 255);
    pdf.text("SEMARNAT NAYARIT | CONTROL ARCHIVÍSTICO", margin, 8);
  };
  const newPage = () => {
    pdf.addPage();
    header();
    y = 25;
  };
  const ensureRoom = (size: number) => {
    if (y + size > height - 21) newPage();
  };

  pdf.setProperties({ title: "Manual de usuario SEMARNAT Nayarit", subject: role });
  header();
  pdf.setFont("helvetica", "bold").setFontSize(23).setTextColor(18, 63, 54);
  pdf.text("Manual de usuario", margin, y);
  y += 10;
  pdf.setFont("helvetica", "normal").setFontSize(11).setTextColor(65, 78, 72);
  pdf.text(role, margin, y);
  y += 12;

  for (const section of sections) {
    pdf.setFont("helvetica", "bold").setFontSize(13);
    const title: string[] = pdf.splitTextToSize(section.title, width - margin * 2);
    ensureRoom(title.length * 6 + 12);
    pdf.setFont("helvetica", "bold").setFontSize(13).setTextColor(18, 63, 54);
    for (const line of title) { pdf.text(line, margin, y); y += 6; }
    y += 2;

    section.steps.forEach((step, i) => {
      pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(47, 61, 55);
      const lines: string[] = pdf.splitTextToSize(step, width - margin * 2 - 9);
      ensureRoom(lines.length * 5 + 4);
      pdf.setFont("helvetica", "normal").setFontSize(10).setTextColor(47, 61, 55);
      pdf.text(String(i + 1) + ".", margin, y);
      for (const line of lines) { pdf.text(line, margin + 9, y); y += 5; }
      y += 3;
    });
    y += 5;
  }

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setDrawColor(204, 214, 208).line(margin, height - 16, width - margin, height - 16);
    pdf.setFont("helvetica", "normal").setFontSize(9).setTextColor(65, 78, 72);
    pdf.text("Página " + page + " de " + pages, width - margin, height - 10, { align: "right" });
  }
  return pdf;
}
