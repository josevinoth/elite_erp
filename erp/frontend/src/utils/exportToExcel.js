function sanitizeFileName(value) {
  return String(value || "export")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "export";
}

function toCellValue(value) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") return JSON.stringify(value);
  return value;
}

export async function exportRowsToExcel({
  fileName,
  sheetName,
  columns,
  rows,
}) {
  const { default: ExcelJS } = await import("exceljs");
  const safeColumns = Array.isArray(columns) ? columns : [];
  const safeRows = Array.isArray(rows) ? rows : [];

  if (!safeColumns.length) {
    throw new Error("No columns available to export.");
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(String(sheetName || fileName || "Export").slice(0, 31));

  worksheet.columns = safeColumns.map((column) => ({
    header: column.label,
    key: column.key,
    width: Math.max(14, String(column.label || "").length + 4),
  }));

  safeRows.forEach((row) => {
    const exportRow = safeColumns.reduce((acc, column) => {
      const rawValue = typeof column.exportValue === "function"
        ? column.exportValue(row)
        : row?.[column.key];
      acc[column.key] = toCellValue(rawValue);
      return acc;
    }, {});
    worksheet.addRow(exportRow);
  });

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };

  worksheet.columns.forEach((column) => {
    let maxLength = String(column.header || "").length;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      maxLength = Math.max(maxLength, String(cell.value ?? "").length);
    });
    column.width = Math.min(Math.max(maxLength + 2, column.width || 14), 40);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([
    buffer,
  ], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeFileName(fileName)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}


