import { jsPDF } from "jspdf";
import { Document, Packer, Paragraph, TextRun } from "docx";

export async function textToPdfBlob(text: string, title = "document") {
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 48;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const lines = pdf.splitTextToSize(text || " ", pageWidth - margin * 2);
  let y = margin;

  pdf.setProperties({ title });
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);

  for (const line of lines) {
    if (y > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(line, margin, y);
    y += 16;
  }

  return pdf.output("blob");
}

export async function htmlToPdfBlob(html: string, title = "document") {
  const cleanText = html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

  return textToPdfBlob(cleanText, title);
}

export async function textToDocxBlob(text: string) {
  const paragraphs = (text || " ")
    .split(/\n+/)
    .map((line) => new Paragraph({ children: [new TextRun(line || " ")] }));

  const document = new Document({ sections: [{ children: paragraphs }] });
  return Packer.toBlob(document);
}
