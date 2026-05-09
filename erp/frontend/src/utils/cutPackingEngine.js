export const CUT_PALETTE = [
  "#16b2a5", "#f97316", "#8b5cf6", "#ec4899",
  "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444",
  "#14b8a6", "#fb923c", "#a78bfa", "#f472b6",
];

const EPS = 0.001;

function cloneFreeRect(rect) {
  return { x: rect.x, y: rect.y, w: rect.w, h: rect.h };
}

function intersects(a, b) {
  return !(
    b.x >= a.x + a.w ||
    b.x + b.w <= a.x ||
    b.y >= a.y + a.h ||
    b.y + b.h <= a.y
  );
}

function containsRect(a, b) {
  return (
    b.x >= a.x - EPS &&
    b.y >= a.y - EPS &&
    b.x + b.w <= a.x + a.w + EPS &&
    b.y + b.h <= a.y + a.h + EPS
  );
}

function pruneFreeRects(rects) {
  const kept = [];
  for (let i = 0; i < rects.length; i += 1) {
    const r = rects[i];
    if (r.w <= EPS || r.h <= EPS) continue;

    let covered = false;
    for (let j = 0; j < rects.length; j += 1) {
      if (i === j) continue;
      if (containsRect(rects[j], r)) {
        covered = true;
        break;
      }
    }

    if (!covered) kept.push(r);
  }
  return kept;
}

function splitFreeRects(freeRects, usedRect) {
  const next = [];

  for (let i = 0; i < freeRects.length; i += 1) {
    const fr = freeRects[i];
    if (!intersects(fr, usedRect)) {
      next.push(cloneFreeRect(fr));
      continue;
    }

    if (usedRect.x > fr.x + EPS) {
      next.push({ x: fr.x, y: fr.y, w: usedRect.x - fr.x, h: fr.h });
    }

    if (usedRect.x + usedRect.w < fr.x + fr.w - EPS) {
      next.push({
        x: usedRect.x + usedRect.w,
        y: fr.y,
        w: fr.x + fr.w - (usedRect.x + usedRect.w),
        h: fr.h,
      });
    }

    if (usedRect.y > fr.y + EPS) {
      next.push({ x: fr.x, y: fr.y, w: fr.w, h: usedRect.y - fr.y });
    }

    if (usedRect.y + usedRect.h < fr.y + fr.h - EPS) {
      next.push({
        x: fr.x,
        y: usedRect.y + usedRect.h,
        w: fr.w,
        h: fr.y + fr.h - (usedRect.y + usedRect.h),
      });
    }
  }

  return pruneFreeRects(next);
}

function pickBestPlacement(freeRects, pieces) {
  let best = null;

  for (let pi = 0; pi < pieces.length; pi += 1) {
    const piece = pieces[pi];
    const orientations = [
      { w: piece.w, h: piece.h, rotated: false },
      { w: piece.h, h: piece.w, rotated: true },
    ];

    for (let oi = 0; oi < orientations.length; oi += 1) {
      const orient = orientations[oi];
      if (orient.rotated && Math.abs(piece.w - piece.h) <= EPS) continue;

      for (let fi = 0; fi < freeRects.length; fi += 1) {
        const fr = freeRects[fi];
        if (orient.w > fr.w + EPS || orient.h > fr.h + EPS) continue;

        const shortFit = Math.min(fr.w - orient.w, fr.h - orient.h);
        const longFit = Math.max(fr.w - orient.w, fr.h - orient.h);
        const areaFit = fr.w * fr.h - orient.w * orient.h;

        if (
          !best ||
          shortFit < best.shortFit - EPS ||
          (Math.abs(shortFit - best.shortFit) <= EPS && longFit < best.longFit - EPS) ||
          (Math.abs(shortFit - best.shortFit) <= EPS && Math.abs(longFit - best.longFit) <= EPS && areaFit < best.areaFit - EPS) ||
          (Math.abs(shortFit - best.shortFit) <= EPS && Math.abs(longFit - best.longFit) <= EPS && Math.abs(areaFit - best.areaFit) <= EPS && piece.area > best.piece.area + EPS)
        ) {
          best = {
            pieceIndex: pi,
            piece,
            freeRect: fr,
            x: fr.x,
            y: fr.y,
            w: orient.w,
            h: orient.h,
            rotated: orient.rotated,
            shortFit,
            longFit,
            areaFit,
          };
        }
      }
    }
  }

  return best;
}

function sortPiecesByMode(pieces, mode) {
  const ranked = [...pieces];

  ranked.sort((a, b) => {
    if (mode === "height") {
      if (Math.abs(b.h - a.h) > EPS) return b.h - a.h;
      if (Math.abs(b.w - a.w) > EPS) return b.w - a.w;
    } else if (mode === "width") {
      if (Math.abs(b.w - a.w) > EPS) return b.w - a.w;
      if (Math.abs(b.h - a.h) > EPS) return b.h - a.h;
    } else {
      if (Math.abs(b.area - a.area) > EPS) return b.area - a.area;
      const aMax = Math.max(a.w, a.h);
      const bMax = Math.max(b.w, b.h);
      if (Math.abs(bMax - aMax) > EPS) return bMax - aMax;
      const aMin = Math.min(a.w, a.h);
      const bMin = Math.min(b.w, b.h);
      if (Math.abs(bMin - aMin) > EPS) return bMin - aMin;
    }

    return String(a.id).localeCompare(String(b.id));
  });

  return ranked;
}

function packWithOrder(basePieces, sheetLengthMm, sheetWidthMm, kerfMm, sortMode) {
  const binW = sheetLengthMm + kerfMm;
  const binH = sheetWidthMm + kerfMm;
  const pieces = sortPiecesByMode(basePieces, sortMode);
  const sheets = [];

  while (pieces.length > 0) {
    let freeRects = [{ x: 0, y: 0, w: binW, h: binH }];
    const items = [];

    while (pieces.length > 0) {
      const choice = pickBestPlacement(freeRects, pieces);
      if (!choice) break;

      const used = { x: choice.x, y: choice.y, w: choice.w, h: choice.h };
      freeRects = splitFreeRects(freeRects, used);

      items.push({
        x: choice.x,
        y: choice.y,
        w: Math.max(0, choice.w - kerfMm),
        h: Math.max(0, choice.h - kerfMm),
        color: choice.piece.color,
        name: choice.piece.name,
        sizeLabel: choice.piece.sizeLabel,
        cutKey: choice.piece.cutKey,
        rotated: choice.rotated,
      });

      pieces.splice(choice.pieceIndex, 1);
    }

    if (!items.length) {
      return { sheets: [], feasible: false };
    }

    sheets.push({ items, sheetNo: sheets.length + 1 });
  }

  return { sheets, feasible: true };
}

export function buildPackedSheetsForScenario(scenario, kerfMm) {
  const sheetLengthMm = Number(scenario?.sheetLengthMm || 0);
  const sheetWidthMm = Number(scenario?.sheetWidthMm || 0);
  if (sheetLengthMm <= 0 || sheetWidthMm <= 0) {
    return { sheets: [], feasible: false };
  }

  const paddedSheetL = sheetLengthMm + kerfMm;
  const paddedSheetW = sheetWidthMm + kerfMm;
  const pieces = [];

  scenario.perCut.forEach((cut, ci) => {
    const quantity = Number(cut?.quantity || 0);
    if (!Number.isInteger(quantity) || quantity <= 0) return;

    const baseW = Number(cut?.cutLengthMm || 0) + kerfMm;
    const baseH = Number(cut?.cutWidthMm || 0) + kerfMm;
    const fitsNormal = baseW <= paddedSheetL + EPS && baseH <= paddedSheetW + EPS;
    const fitsRotated = baseH <= paddedSheetL + EPS && baseW <= paddedSheetW + EPS;
    if (!fitsNormal && !fitsRotated) return;

    const color = CUT_PALETTE[ci % CUT_PALETTE.length];
    const cutKey = String(cut.cutKey ?? cut.id ?? cut.lineNo ?? ci + 1);

    for (let i = 0; i < quantity; i += 1) {
      pieces.push({
        id: `${cutKey}-${i}`,
        w: baseW,
        h: baseH,
        area: baseW * baseH,
        color,
        name: cut.name,
        sizeLabel: cut.sizeLabel,
        cutKey,
      });
    }
  });

  if (!pieces.length) return { sheets: [], feasible: true };

  const runs = ["area", "height", "width"];
  let best = null;

  for (let i = 0; i < runs.length; i += 1) {
    const packed = packWithOrder(pieces, sheetLengthMm, sheetWidthMm, kerfMm, runs[i]);
    if (!packed.feasible) continue;

    if (
      !best ||
      packed.sheets.length < best.sheets.length ||
      (packed.sheets.length === best.sheets.length && packed.sheets[0]?.items.length > (best.sheets[0]?.items.length || 0))
    ) {
      best = packed;
    }
  }

  if (!best) return { sheets: [], feasible: false };
  return { sheets: best.sheets, feasible: true };
}

export function summarizeCutOrientations(sheets) {
  const usage = {};

  sheets.forEach((sheet) => {
    sheet.items.forEach((item) => {
      const key = String(item.cutKey || "");
      if (!key) return;
      if (!usage[key]) usage[key] = { normal: 0, rotated: 0 };
      if (item.rotated) usage[key].rotated += 1;
      else usage[key].normal += 1;
    });
  });

  return usage;
}

