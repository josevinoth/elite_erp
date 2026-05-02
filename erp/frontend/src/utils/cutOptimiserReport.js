import jsPDF from "jspdf";
import * as autoTableLib from "jspdf-autotable";

const CUT_PALETTE = [
  "#16b2a5", "#f97316", "#8b5cf6", "#ec4899",
  "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444",
  "#14b8a6", "#fb923c", "#a78bfa", "#f472b6",
];

const EPS = 0.001;

function hexToRgb(hex) {
  const h = String(hex || "#16b2a5").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => `${c}${c}`).join("") : h;
  const value = Number.parseInt(full, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function sanitizeFileName(value) {
  return String(value || "cut_optimiser_report")
    .trim()
    .replace(/[\\/:*?"<>|]+/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "") || "cut_optimiser_report";
}

function fitTextToWidth(doc, text, maxWidth) {
  const raw = String(text || "").trim();
  if (!raw) return "";
  if (doc.getTextWidth(raw) <= maxWidth) return raw;

  let trimmed = raw;
  while (trimmed.length > 1 && doc.getTextWidth(`${trimmed}...`) > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return `${trimmed}...`;
}

function toCompactCutName(name) {
  const raw = String(name || "").trim();
  const match = raw.match(/cut\s*(\d+)/i);
  if (match) return `C${match[1]}`;
  return raw.slice(0, 4).toUpperCase();
}

function runAutoTable(doc, options) {
  const moduleFn =
    (typeof autoTableLib === "function" && autoTableLib) ||
    (typeof autoTableLib.autoTable === "function" && autoTableLib.autoTable) ||
    (typeof autoTableLib.default === "function" && autoTableLib.default) ||
    null;

  if (moduleFn) {
    return moduleFn(doc, options);
  }

  if (typeof doc.autoTable === "function") {
    // Plugin-attached mode uses doc.autoTable(options)
    return doc.autoTable(options);
  }

  if (!moduleFn) {
    throw new Error("Failed to load table renderer (jspdf-autotable).");
  }
}

function buildPackedSheets(scenario, kerfMm) {
  const sheetL = scenario.sheetLengthMm;
  const sheetW = scenario.sheetWidthMm;
  const pieces = [];

  scenario.perCut.forEach((cut, ci) => {
    if (cut.partsPerSheet <= 0) return;
    const color = CUT_PALETTE[ci % CUT_PALETTE.length];
    const cL = cut.rotated ? cut.cutWidthMm : cut.cutLengthMm;
    const cW = cut.rotated ? cut.cutLengthMm : cut.cutWidthMm;
    for (let i = 0; i < cut.quantity; i += 1) {
      pieces.push({
        id: `${cut.id || cut.lineNo}-${i}`,
        w: cL,
        h: cW,
        area: cL * cW,
        color,
        name: cut.name,
        sizeLabel: cut.sizeLabel,
      });
    }
  });

  const unplaced = pieces.filter((p) => p.w <= sheetL + EPS && p.h <= sheetW + EPS);
  const sheets = [];
  const makeSheet = () => ({ items: [], rowX: 0, rowY: 0, rowH: 0 });
  let cur = makeSheet();

  const takeBestFitting = (fitPredicate, leftoverScore) => {
    let bestIndex = -1;
    let bestLeftover = Number.POSITIVE_INFINITY;
    let bestArea = -1;

    for (let i = 0; i < unplaced.length; i += 1) {
      const p = unplaced[i];
      if (!fitPredicate(p)) continue;
      const leftover = leftoverScore(p);
      if (
        leftover < bestLeftover - EPS ||
        (Math.abs(leftover - bestLeftover) <= EPS && p.area > bestArea + EPS) ||
        (Math.abs(leftover - bestLeftover) <= EPS && Math.abs(p.area - bestArea) <= EPS && bestIndex >= 0 && p.id < unplaced[bestIndex].id)
      ) {
        bestIndex = i;
        bestLeftover = leftover;
        bestArea = p.area;
      }
    }

    if (bestIndex < 0) return null;
    return unplaced.splice(bestIndex, 1)[0];
  };

  const placeOnCurrentRow = (p) => {
    cur.items.push({ x: cur.rowX, y: cur.rowY, w: p.w, h: p.h, color: p.color, name: p.name, sizeLabel: p.sizeLabel });
    cur.rowX += p.w + kerfMm;
    cur.rowH = Math.max(cur.rowH, p.h);
  };

  while (unplaced.length > 0) {
    const remainingRowW = sheetL - cur.rowX;
    const currentRowPiece = takeBestFitting(
      (p) => cur.rowY + p.h <= sheetW + EPS && p.w <= remainingRowW + EPS,
      (p) => Math.max(0, remainingRowW - p.w)
    );
    if (currentRowPiece) {
      placeOnCurrentRow(currentRowPiece);
      continue;
    }

    const nextRowY = cur.rowY + (cur.rowH > 0 ? cur.rowH + kerfMm : 0);
    const nextRowPiece = takeBestFitting(
      (p) => nextRowY + p.h <= sheetW + EPS && p.w <= sheetL + EPS,
      (p) => Math.max(0, sheetL - p.w)
    );
    if (nextRowPiece) {
      cur.rowY = nextRowY;
      cur.rowX = 0;
      cur.rowH = 0;
      placeOnCurrentRow(nextRowPiece);
      continue;
    }

    if (cur.items.length > 0) {
      sheets.push({ items: cur.items, sheetNo: sheets.length + 1 });
      cur = makeSheet();
      continue;
    }
    break;
  }

  if (cur.items.length > 0) sheets.push({ items: cur.items, sheetNo: sheets.length + 1 });
  return sheets;
}

async function imageUrlToDataUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read logo image."));
    reader.readAsDataURL(blob);
  });
}

function drawVisualSheets(doc, scenario, kerfMm, startY, margin) {
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const sheets = buildPackedSheets(scenario, kerfMm);
  const sheetW = scenario.sheetLengthMm;
  const sheetH = scenario.sheetWidthMm;
  const drawW = pageW - margin * 2;
  const drawH = Math.max(22, drawW * (sheetH / sheetW));
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(`Visual View (${scenario.sheetName})`, margin, y);
  y += 5;

  sheets.forEach((sheet) => {
    const blockHeight = 5 + drawH + 6;
    if (y + blockHeight > pageH - margin) {
      doc.addPage();
      y = margin;
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(`Raw Sheet ${sheet.sheetNo} of ${sheets.length} - ${sheet.items.length} pieces`, margin, y);
    y += 2;

    const boxX = margin;
    const boxY = y;
    doc.setFillColor(11, 61, 68);
    doc.setDrawColor(37, 210, 195);
    doc.rect(boxX, boxY, drawW, drawH, "FD");

    doc.setTextColor(37, 210, 195);
    doc.setFontSize(8);
    doc.text(`Raw: ${scenario.sheetSize}`, boxX + 2, boxY + 4);

    const scale = drawW / sheetW;
    sheet.items.forEach((item) => {
      const px = boxX + item.x * scale;
      const py = boxY + item.y * scale;
      const pw = Math.max(0.9, item.w * scale);
      const ph = Math.max(0.9, item.h * scale);
      const rgb = hexToRgb(item.color);
      doc.setFillColor(rgb.r, rgb.g, rgb.b);
      doc.setDrawColor(Math.max(0, rgb.r - 20), Math.max(0, rgb.g - 20), Math.max(0, rgb.b - 20));
      doc.rect(px, py, pw, ph, "FD");

      const canShowLarge = pw > 18 && ph > 9;
      const canShowMedium = pw > 11 && ph > 6;
      const canShowTiny = pw > 7 && ph > 4;

      if (canShowLarge) {
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.setFont("helvetica", "bold");
        doc.text(fitTextToWidth(doc, item.name, Math.max(6, pw - 2.5)), px + pw / 2, py + ph / 2 - 1.1, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6);
        doc.text(fitTextToWidth(doc, item.sizeLabel, Math.max(6, pw - 2.5)), px + pw / 2, py + ph / 2 + 2.1, { align: "center" });
      } else if (canShowMedium) {
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(5.2);
        doc.text(fitTextToWidth(doc, item.name, Math.max(4, pw - 1.8)), px + pw / 2, py + ph / 2 + 0.9, { align: "center" });
      } else if (canShowTiny) {
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(4.2);
        doc.text(toCompactCutName(item.name), px + pw / 2, py + ph / 2 + 0.7, { align: "center" });
      }
    });

    y += drawH + 8;
  });

  doc.setTextColor(0, 0, 0);
}

export async function downloadCutOptimiserPdf({
  logoUrl,
  projectLabel,
  dimUnit,
  kerfDisplay,
  generatedAt,
  result,
}) {
  if (!result?.bestOption) {
    throw new Error("No result to export.");
  }

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const margin = 12;
  const pageW = doc.internal.pageSize.getWidth();

  const logoDataUrl = logoUrl ? await imageUrlToDataUrl(logoUrl) : null;
  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", margin, 9, 14, 14);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Elite ERP - Cut Optimiser Report", margin + 18, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Project: ${projectLabel || "N/A"}`, margin + 18, 20.5);
  doc.text(`Generated: ${generatedAt}`, margin + 18, 25.5);

  const best = result.bestOption;
  doc.setFont("helvetica", "bold");
  doc.text("Results", margin, 33);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text(`Best Option: ${best.sheetName} (${best.sheetSize}) - ${best.totalSheets} sheets`, margin, 38);
  doc.text(`Dimension Unit: ${dimUnit} | Kerf: ${kerfDisplay}`, margin, 42.5);
  doc.text(`Panel Area: ${best.totalPanelAreaM2.toFixed(3)} m2 (${best.totalPanelAreaFt2.toFixed(2)} ft2)`, margin, 47);
  doc.text(`Sheet Area: ${best.totalSheetAreaM2.toFixed(3)} m2 (${best.totalSheetAreaFt2.toFixed(2)} ft2)`, margin, 51.5);
  doc.text(`Waste: ${best.wasteAreaM2.toFixed(3)} m2 (${best.wasteAreaFt2.toFixed(2)} ft2) | Yield: ${best.yieldPercent.toFixed(1)}%`, margin, 56);

  runAutoTable(doc, {
    startY: 62,
    head: [["Cut #", "Cut Name", "Size", "Qty", "Per Sheet", "Sheets", "Best Fit"]],
    body: best.perCut.map((line) => [
      line.lineNo,
      line.name,
      line.sizeLabel,
      line.quantity,
      line.partsPerSheet,
      line.sheetsNeeded,
      line.orientation,
    ]),
    styles: { fontSize: 8.5, cellPadding: 1.8 },
    headStyles: { fillColor: [13, 74, 81] },
    margin: { left: margin, right: margin },
  });

  const tableBottom = doc.lastAutoTable?.finalY || 62;
  drawVisualSheets(doc, best, result.kerfMm, tableBottom + 7, margin);

  const fileName = sanitizeFileName(`cut_optimiser_${projectLabel || "report"}_${new Date().toISOString().slice(0, 10)}`);
  doc.save(`${fileName}.pdf`);
}

