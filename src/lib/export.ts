import Papa from "papaparse";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const RUPEE_SYMBOL = "Rs.";

export function exportToCSV(data: Record<string, unknown>[], filename: string) {
  const csv = Papa.unparse(data);
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function exportToPDF(
  title: string,
  subtitle: string,
  data: Record<string, unknown>[],
  columns: { header: string; dataKey: string }[],
) {
  const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" });

  doc.setFontSize(16);
  doc.text(title, 14, 20);

  doc.setFontSize(10);
  doc.setTextColor(120);
  doc.text(subtitle, 14, 28);
  doc.text(`Generated: ${new Date().toLocaleString("en-IN")}`, 14, 34);

  autoTable(doc, {
    startY: 40,
    head: [columns.map((c) => c.header)],
    body: data.map((row) =>
      columns.map((c) => {
        const val = row[c.dataKey];
        if (typeof val === "number") return `${RUPEE_SYMBOL}${val.toLocaleString("en-IN")}`;
        return String(val ?? "");
      }),
    ),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [15, 23, 42] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  doc.save(filename);
}

export function buildExportFilename(reportType: string, service: string | undefined, startDate: string, endDate: string): string {
  const svc = service || "all";
  const start = startDate.slice(0, 10);
  const end = endDate.slice(0, 10);
  return `${reportType}_${svc}_${start}_${end}`;
}
