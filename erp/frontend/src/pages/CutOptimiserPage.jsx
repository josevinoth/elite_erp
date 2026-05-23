import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Select from "react-select";
import { listProjects } from "../services/crudApi";
import {
  createCutOptimiserRecord,
  getCutOptimiserRecordById,
  getNextCutOptimiserRevision,
  listCutOptimiserRecords,
  updateCutOptimiserRecord,
} from "../services/cutOptimiserStore";
import { exportRowsToExcel } from "../utils/exportToExcel";
import { downloadCutOptimiserPdf } from "../utils/cutOptimiserReport";
import { buildPackedSheetsForScenario as buildPackedSheetsForScenarioV2, summarizeCutOrientations } from "../utils/cutPackingEngine";
import eliteLogo from "../assets/logos/elite_logo.png";

const CUT_OPTIMISER_DRAFT_KEY = "elite_erp_cut_optimiser_draft_v1";

const UNIT_TO_MM = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
  ft: 304.8,
};

const UNIT_LABELS = {
  mm: "mm",
  cm: "cm",
  m: "m",
  in: "in",
  ft: "ft",
};

function toPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toNonNegativeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function toMm(value, unit) {
  return value * (UNIT_TO_MM[unit] || 1);
}

function areaMm2ToM2(areaMm2) {
  return areaMm2 / 1_000_000;
}

function areaMm2ToFt2(areaMm2) {
  return areaMm2 / 92_903.04;
}

function countFitWithKerf(sheetLength, sheetWidth, cutLength, cutWidth, kerf) {
  const a = Math.floor((sheetLength + kerf) / (cutLength + kerf));
  const b = Math.floor((sheetWidth + kerf) / (cutWidth + kerf));
  return Math.max(0, a) * Math.max(0, b);
}

function buildRawSheet(id, name, length, width) {
  return { id, name, length, width };
}

function buildCutItem(id, name, length, width, quantity = "1") {
  return { id, name, length, width, quantity };
}

function rowCanAutoAppend(row) {
  return !!toPositiveNumber(row.length) && !!toPositiveNumber(row.width) && !!toPositiveInt(row.quantity);
}

const CUT_PALETTE = [
  "#16b2a5", "#f97316", "#8b5cf6", "#ec4899",
  "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444",
  "#14b8a6", "#fb923c", "#a78bfa", "#f472b6",
];

const PACK_EPS = 0.001;

function buildPackedSheetsForScenario(scenario, kerfMm) {
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

  const sheets = [];
  const makeSheet = () => ({ items: [], rowX: 0, rowY: 0, rowH: 0 });
  let cur = makeSheet();
  const unplaced = pieces.filter((p) => p.w <= sheetL + PACK_EPS && p.h <= sheetW + PACK_EPS);

  const takeBestFitting = (fitPredicate, leftoverScore) => {
    let bestIndex = -1;
    let bestLeftover = Number.POSITIVE_INFINITY;
    let bestArea = -1;

    for (let i = 0; i < unplaced.length; i += 1) {
      const p = unplaced[i];
      if (!fitPredicate(p)) continue;

      const leftover = leftoverScore(p);
      if (
        leftover < bestLeftover - PACK_EPS ||
        (Math.abs(leftover - bestLeftover) <= PACK_EPS && p.area > bestArea + PACK_EPS) ||
        (Math.abs(leftover - bestLeftover) <= PACK_EPS && Math.abs(p.area - bestArea) <= PACK_EPS && bestIndex >= 0 && p.id < unplaced[bestIndex].id)
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
    const pieceForCurrentRow = takeBestFitting(
      (p) => cur.rowY + p.h <= sheetW + PACK_EPS && p.w <= remainingRowW + PACK_EPS,
      (p) => Math.max(0, remainingRowW - p.w)
    );

    if (pieceForCurrentRow) {
      placeOnCurrentRow(pieceForCurrentRow);
      continue;
    }

    const nextRowY = cur.rowY + (cur.rowH > 0 ? cur.rowH + kerfMm : 0);
    const pieceForNewRow = takeBestFitting(
      (p) => nextRowY + p.h <= sheetW + PACK_EPS && p.w <= sheetL + PACK_EPS,
      (p) => Math.max(0, sheetL - p.w)
    );

    if (pieceForNewRow) {
      cur.rowY = nextRowY;
      cur.rowX = 0;
      cur.rowH = 0;
      placeOnCurrentRow(pieceForNewRow);
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

function SheetVisual({ scenario, kerfMm }) {
  const sheetL = scenario.sheetLengthMm;
  const sheetW = scenario.sheetWidthMm;
  const { sheets } = buildPackedSheetsForScenarioV2(scenario, kerfMm);

  // ── Legend ──────────────────────────────────────────────────────
  const legend = scenario.perCut
    .filter((c) => c.partsPerSheet > 0)
    .map((c, ci) => ({ name: c.name, size: c.sizeLabel, color: CUT_PALETTE[ci % CUT_PALETTE.length] }));

  // ── SVG viewport ─────────────────────────────────────────────────
  const DISPLAY_W = 600;
  const DISPLAY_H = Math.max(40, Math.round(DISPLAY_W * (sheetW / sheetL)));
  const scale = DISPLAY_W / sheetL;

  return (
    <div className="cut-optimiser-visual">
      <div className="cut-optimiser-visual__title">Visual View — {scenario.sheetName}</div>
      <div className="cut-optimiser-visual__raw">Raw Sheet: {scenario.sheetSize}</div>

      {/* Colour legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", margin: "0.5rem 0 0.75rem" }}>
        {legend.map((l) => (
          <span
            key={l.name}
            style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", fontSize: "0.76rem", color: "#f0fffe" }}
          >
            <span
              style={{
                width: 12, height: 12, borderRadius: 3, flexShrink: 0,
                background: l.color, border: "1px solid rgba(255,255,255,0.35)",
              }}
            />
            {l.name} ({l.size})
          </span>
        ))}
      </div>

      {/* One SVG per sheet */}
      <div style={{ display: "grid", gap: "0.75rem" }}>
        {sheets.map((sheet, si) => (
          <div key={si}>
            <div style={{ fontSize: "0.75rem", color: "#cce8e5", marginBottom: "0.25rem" }}>
              Raw Sheet {sheet.sheetNo} of {sheets.length} — {sheet.items.length} piece{sheet.items.length !== 1 ? "s" : ""}
            </div>
            <svg
              width="100%"
              viewBox={`0 0 ${DISPLAY_W} ${DISPLAY_H}`}
              style={{ display: "block", borderRadius: 6, border: "1.5px solid #25d2c3" }}
            >
              {/* Raw sheet background */}
              <rect x={0} y={0} width={DISPLAY_W} height={DISPLAY_H} fill="#0b3d44" />
              {/* Raw sheet size label */}
              <text x={6} y={14} fill="#25d2c3" fontSize={11} fontFamily="sans-serif" fontWeight="600">
                Raw: {scenario.sheetSize}
              </text>
              {/* Cut pieces */}
              {sheet.items.map((item, ii) => {
                const px = Math.round(item.x * scale);
                const py = Math.round(item.y * scale);
                const pw = Math.max(1, Math.round(item.w * scale));
                const ph = Math.max(1, Math.round(item.h * scale));
                // Font size: fit two lines inside the piece, capped at 11px
                const fs = Math.min(11, Math.max(6, Math.floor(Math.min(pw, ph) * 0.16)));
                const lineH = fs * 1.25;
                const showLabels = pw > 32 && ph > lineH * 2 + 4;
                const cx = px + pw / 2;
                const cy = py + ph / 2;
                return (
                  <g key={ii}>
                    <rect
                      x={px} y={py} width={pw} height={ph}
                      fill={item.color + "99"}
                      stroke={item.color}
                      strokeWidth={1.5}
                    />
                    {showLabels && (
                      <>
                        <text
                          x={cx} y={cy - lineH * 0.4}
                          fill="#fff"
                          fontSize={fs}
                          fontFamily="sans-serif"
                          fontWeight="700"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{ pointerEvents: "none", userSelect: "none" }}
                        >
                          {item.name}
                        </text>
                        <text
                          x={cx} y={cy + lineH * 0.9}
                          fill="rgba(255,255,255,0.82)"
                          fontSize={Math.max(5, fs - 1)}
                          fontFamily="sans-serif"
                          textAnchor="middle"
                          dominantBaseline="middle"
                          style={{ pointerEvents: "none", userSelect: "none" }}
                        >
                          {item.sizeLabel}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>
        ))}
      </div>
    </div>
  );
}

function CutOptimiserPage() {
  const { recordId } = useParams();
  const navigate = useNavigate();
  const isEditMode = Boolean(recordId);

  const [form, setForm] = useState({
    dimUnit: "ft",
    kerf: "3",
    kerfUnit: "mm",
  });
  const [rawSheets, setRawSheets] = useState([buildRawSheet(1, "Sheet A", "6", "3")]);
  const [cutItems, setCutItems] = useState([buildCutItem(1, "Cut 1", "2", "2", "1")]);
  const [nextRawId, setNextRawId] = useState(2);
  const [nextCutId, setNextCutId] = useState(2);
  const [pendingFocusCutId, setPendingFocusCutId] = useState(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProjectKey, setSelectedProjectKey] = useState("");
  const [projectsError, setProjectsError] = useState("");
  const [exportError, setExportError] = useState("");
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isExcelExporting, setIsExcelExporting] = useState(false);
  const [draftStatus, setDraftStatus] = useState("");
  const [revision, setRevision] = useState("1");
  const [isDirty, setIsDirty] = useState(false);

  const unitOptions = useMemo(
    () => Object.keys(UNIT_TO_MM).map((u) => ({ value: u, label: UNIT_LABELS[u] })),
    []
  );

  const selectedProject = useMemo(
    () => projects.find((p) => p.key === selectedProjectKey) || null,
    [projects, selectedProjectKey]
  );

  const projectOptions = useMemo(
    () => projects.map((project) => ({ value: project.key, label: project.label })),
    [projects]
  );

  const selectedProjectOption = useMemo(
    () => projectOptions.find((option) => option.value === selectedProjectKey) || null,
    [projectOptions, selectedProjectKey]
  );

  useEffect(() => {
    if (isEditMode) return;
    if (!selectedProjectKey) {
      setRevision("1");
      return;
    }
    const nextRevision = getNextCutOptimiserRevision(selectedProjectKey);
    setRevision(String(nextRevision));
  }, [isEditMode, selectedProjectKey]);

  useEffect(() => {
    let active = true;

    const loadProjects = async () => {
      try {
        const data = await listProjects();
        if (!active) return;

        const rows = Array.isArray(data?.projects) ? data.projects : [];
        const mapped = rows.map((row, index) => {
          const key = String(row.id ?? row.pk ?? row.project_id ?? index + 1);
          const projectId = String(row.project_id || `Project-${index + 1}`);
          const projectName = String(row.project_name || "Unnamed Project");
          return {
            key,
            projectId,
            projectName,
            label: `${projectId} - ${projectName}`,
          };
        });

        setProjects(mapped);
        setProjectsError("");
      } catch (err) {
        if (!active) return;
        setProjects([]);
        setProjectsError(err?.message || "Failed to load projects.");
      }
    };

    loadProjects();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!pendingFocusCutId) return;
    const node = document.getElementById(`cut-name-${pendingFocusCutId}`);
    if (node && typeof node.focus === "function") {
      node.focus();
    }
    setPendingFocusCutId(null);
  }, [pendingFocusCutId]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CUT_OPTIMISER_DRAFT_KEY);
      if (!raw) return;

      const draft = JSON.parse(raw);
      if (draft?.form && typeof draft.form === "object") {
        setForm((prev) => ({ ...prev, ...draft.form }));
      }

      if (Array.isArray(draft?.rawSheets) && draft.rawSheets.length) {
        setRawSheets(draft.rawSheets);
        const maxRawId = draft.rawSheets.reduce((max, row) => {
          const id = Number(row?.id);
          return Number.isFinite(id) && id > max ? id : max;
        }, 0);
        setNextRawId(maxRawId + 1);
      }

      if (Array.isArray(draft?.cutItems) && draft.cutItems.length) {
        setCutItems(draft.cutItems);
        const maxCutId = draft.cutItems.reduce((max, row) => {
          const id = Number(row?.id);
          return Number.isFinite(id) && id > max ? id : max;
        }, 0);
        setNextCutId(maxCutId + 1);
      }

      if (typeof draft?.selectedProjectKey === "string") {
        setSelectedProjectKey(draft.selectedProjectKey);
      }

      setDraftStatus("Loaded saved draft.");
    } catch {
      setDraftStatus("Could not load saved draft.");
    }
  }, []);

  const onSaveDraft = () => {
    try {
      const payload = {
        form,
        rawSheets,
        cutItems,
        selectedProjectKey,
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(CUT_OPTIMISER_DRAFT_KEY, JSON.stringify(payload));
      setDraftStatus("Values saved temporarily on this browser.");
      setIsDirty(false);
    } catch {
      setDraftStatus("Failed to save values.");
    }
  };

  const onSaveRecord = ({ redirectToList = false } = {}) => {
    if (!selectedProjectKey) {
      setDraftStatus("Select a project before saving the record.");
      return false;
    }

    // Duplicate project check — add mode only
    if (!isEditMode) {
      const existing = listCutOptimiserRecords().filter(
        (r) => String(r.selectedProjectKey) === String(selectedProjectKey)
      );
      if (existing.length > 0) {
        const latest = existing[0];
        const nextRev = Number(latest.revision) + 1;
        const confirmed = window.confirm(
          `A record for this project already exists!\n\n` +
          `Project          : ${latest.projectLabel || selectedProject?.label || selectedProjectKey}\n` +
          `Current Revision : R${latest.revision}\n\n` +
          `Do you want to create a new revision (R${nextRev})?`
        );
        if (!confirmed) return false;
      }
    }

    try {
      const payload = {
        selectedProjectKey,
        projectLabel: selectedProject?.label || "",
        form,
        rawSheets,
        cutItems,
        result,
      };

      const saved = isEditMode
        ? updateCutOptimiserRecord(recordId, payload)
        : createCutOptimiserRecord(payload);

      setRevision(String(saved.revision || 1));
      setDraftStatus(isEditMode ? "Record updated." : "Record saved.");
      setIsDirty(false);

      if (redirectToList) {
        navigate("/projects/cut-optimiser");
      } else if (!isEditMode) {
        navigate(`/projects/cut-optimiser/record/${saved.id}`, { replace: true });
      }
      return true;
    } catch (err) {
      setDraftStatus(err?.message || "Failed to save record.");
      return false;
    }
  };

  const onBackToList = () => {
    if (isDirty) {
      const confirmed = window.confirm(
        "You have unsaved changes.\n\nDo you want to save the record before leaving?"
      );
      if (confirmed) {
        const saved = onSaveRecord({ redirectToList: true });
        if (!saved) return;
        return;
      }
    }
    navigate("/projects/cut-optimiser");
  };

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(CUT_OPTIMISER_DRAFT_KEY);
    } catch {
      // Ignore storage cleanup failure and continue with UI reset.
    }
  };

  const onFieldChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const updateRawSheet = (id, key, value) => {
    setRawSheets((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    setIsDirty(true);
  };

  const updateCutItem = (id, key, value) => {
    setCutItems((prev) => prev.map((row) => (row.id === id ? { ...row, [key]: value } : row)));
    setIsDirty(true);
  };

  const addRawSheet = () => {
    setRawSheets((prev) => [
      ...prev,
      buildRawSheet(nextRawId, `Sheet ${String.fromCharCode(64 + nextRawId)}`, "", ""),
    ]);
    setNextRawId((prev) => prev + 1);
    setIsDirty(true);
  };

  const addCutItem = (focus = false) => {
    const newId = nextCutId;
    setCutItems((prev) => [...prev, buildCutItem(newId, `Cut ${newId}`, "", "", "1")]);
    setNextCutId((prev) => prev + 1);
    if (focus) setPendingFocusCutId(newId);
    setIsDirty(true);
  };

  const removeRawSheet = (id) => {
    setRawSheets((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : prev));
    setIsDirty(true);
  };

  const removeCutItem = (id) => {
    setCutItems((prev) => (prev.length > 1 ? prev.filter((row) => row.id !== id) : prev));
    setIsDirty(true);
  };

  const onCutQtyKeyDown = (row, index, e) => {
    if (e.key !== "Tab" || e.shiftKey || index !== cutItems.length - 1) return;
    if (!rowCanAutoAppend(row)) return;
    addCutItem(true);
  };

  const onCalculate = () => {
    setError("");

    const kerf = toNonNegativeNumber(form.kerf);
    if (kerf === null) {
      setResult(null);
      setError("Cutter thickness must be 0 or greater.");
      return;
    }

    const kerfMm = toMm(kerf, form.kerfUnit);

    if (!rawSheets.length || !cutItems.length) {
      setResult(null);
      setError("Add at least one raw sheet and one cut size.");
      return;
    }

    const parsedSheets = [];
    for (let i = 0; i < rawSheets.length; i += 1) {
      const row = rawSheets[i];
      const length = toPositiveNumber(row.length);
      const width = toPositiveNumber(row.width);
      if (!length || !width) {
        setResult(null);
        setError(`Raw sheet row ${i + 1}: length and width must be greater than 0.`);
        return;
      }
      parsedSheets.push({
        id: row.id,
        name: (row.name || `Sheet ${i + 1}`).trim() || `Sheet ${i + 1}`,
        lengthMm: toMm(length, form.dimUnit),
        widthMm: toMm(width, form.dimUnit),
        lengthDisplay: length,
        widthDisplay: width,
      });
    }

    const parsedCuts = [];
    for (let i = 0; i < cutItems.length; i += 1) {
      const row = cutItems[i];
      const length = toPositiveNumber(row.length);
      const width = toPositiveNumber(row.width);
      const quantity = toPositiveInt(row.quantity);
      if (!length || !width) {
        setResult(null);
        setError(`Cut size row ${i + 1}: length and width must be greater than 0.`);
        return;
      }
      if (!quantity) {
        setResult(null);
        setError(`Cut size row ${i + 1}: quantity must be a whole number greater than 0.`);
        return;
      }
      const cutName = (row.name || `Cut ${i + 1}`).trim() || `Cut ${i + 1}`;
      parsedCuts.push({
        id: row.id,
        name: cutName,
        length,
        width,
        quantity,
        lengthMm: toMm(length, form.dimUnit),
        widthMm: toMm(width, form.dimUnit),
      });
    }

    const scenarios = parsedSheets.map((sheet) => {
      const sheetAreaMm2 = sheet.lengthMm * sheet.widthMm;
      let totalPanelAreaMm2 = 0;
      let allCutsFit = true;

      const perCut = parsedCuts.map((cut, index) => {
        const normalFit = countFitWithKerf(sheet.lengthMm, sheet.widthMm, cut.lengthMm, cut.widthMm, kerfMm);
        const rotatedFit = countFitWithKerf(sheet.lengthMm, sheet.widthMm, cut.widthMm, cut.lengthMm, kerfMm);
        const partsPerSheet = Math.max(normalFit, rotatedFit);
        const cutKey = String(cut.id ?? index + 1);

        if (partsPerSheet <= 0) {
          allCutsFit = false;
          return {
            cutKey,
            lineNo: index + 1,
            name: cut.name,
            sizeLabel: `${cut.length} x ${cut.width} ${form.dimUnit}`,
            quantity: cut.quantity,
            partsPerSheet: 0,
            sheetsNeeded: 0,
            orientation: "Not possible",
            cutLengthMm: cut.lengthMm,
            cutWidthMm: cut.widthMm,
            rotated: false,
          };
        }

        const sheetsNeeded = Math.ceil(cut.quantity / partsPerSheet);
        totalPanelAreaMm2 += cut.lengthMm * cut.widthMm * cut.quantity;
        const rotated = rotatedFit > normalFit;

        return {
          cutKey,
          lineNo: index + 1,
          name: cut.name,
          sizeLabel: `${cut.length} x ${cut.width} ${form.dimUnit}`,
          quantity: cut.quantity,
          partsPerSheet,
          sheetsNeeded,
          orientation: rotated ? "Rotated" : "Normal",
          cutLengthMm: cut.lengthMm,
          cutWidthMm: cut.widthMm,
          rotated,
        };
      });

      const packedScenario = {
        sheetLengthMm: sheet.lengthMm,
        sheetWidthMm: sheet.widthMm,
        perCut,
      };
      const packed = allCutsFit ? buildPackedSheetsForScenarioV2(packedScenario, kerfMm) : { sheets: [], feasible: false };
      const packedSheets = packed.sheets;
      const totalSheets = packedSheets.length;
      allCutsFit = allCutsFit && packed.feasible;

      const orientationUsage = summarizeCutOrientations(packedSheets);
      const perCutWithPackedOrientation = perCut.map((line) => {
        if (line.partsPerSheet <= 0) return line;
        const usage = orientationUsage[line.cutKey];
        if (!usage) return line;
        const orientation = usage.normal > 0 && usage.rotated > 0
          ? "Mixed"
          : usage.rotated > 0
            ? "Rotated"
            : "Normal";
        return { ...line, orientation };
      });

      const totalSheetAreaMm2 = sheetAreaMm2 * totalSheets;

      const wasteAreaMm2 = Math.max(totalSheetAreaMm2 - totalPanelAreaMm2, 0);
      const yieldPercent = totalSheetAreaMm2 > 0 ? (totalPanelAreaMm2 / totalSheetAreaMm2) * 100 : 0;

      return {
        sheetName: sheet.name,
        sheetSize: `${sheet.lengthDisplay} x ${sheet.widthDisplay} ${form.dimUnit}`,
        sheetLengthMm: sheet.lengthMm,
        sheetWidthMm: sheet.widthMm,
        packedSheets,
        perCut: perCutWithPackedOrientation,
        allCutsFit,
        totalSheets,
        totalPanelAreaM2: areaMm2ToM2(totalPanelAreaMm2),
        totalPanelAreaFt2: areaMm2ToFt2(totalPanelAreaMm2),
        totalSheetAreaM2: areaMm2ToM2(totalSheetAreaMm2),
        totalSheetAreaFt2: areaMm2ToFt2(totalSheetAreaMm2),
        wasteAreaM2: areaMm2ToM2(wasteAreaMm2),
        wasteAreaFt2: areaMm2ToFt2(wasteAreaMm2),
        yieldPercent,
      };
    });

    const feasible = scenarios.filter((s) => s.allCutsFit);
    const bestOption = feasible.length
      ? feasible.reduce((best, item) => (item.totalSheets < best.totalSheets ? item : best), feasible[0])
      : null;

    if (!bestOption) {
      setResult(null);
      setError("None of the raw sheet sizes can fit all cut sizes with the selected cutter thickness.");
      return;
    }

    setResult({ scenarios, bestOption, kerfMm });
  };

  const buildExportRows = () => {
    if (!result?.bestOption) return [];

    const best = result.bestOption;
    const packedSheets = Array.isArray(best.packedSheets) ? best.packedSheets : [];

    return packedSheets.map((sheet) => {
      const countByCut = {};

      sheet.items.forEach((item) => {
        const key = `${item.name} (${item.sizeLabel})`;
        countByCut[key] = (countByCut[key] || 0) + 1;
      });

      const cutBreakdown = Object.entries(countByCut)
        .map(([key, count]) => `${key} x${count}`)
        .join(" | ");

      return {
        project: selectedProject?.label || "N/A",
        rawSheet: `${best.sheetName} (${best.sheetSize})`,
        sheetNo: sheet.sheetNo,
        totalPiecesOnSheet: sheet.items.length,
        cutsOnSheet: cutBreakdown,
      };
    });
  };

  const onDownloadTableExcel = async () => {
    if (!result) return;

    setExportError("");
    setIsExcelExporting(true);
    try {
      await exportRowsToExcel({
        fileName: `cut_optimiser_table_${selectedProject?.projectId || "no_project"}`,
        sheetName: "Cut Optimiser Table",
        columns: [
          { key: "project", label: "Project" },
          { key: "rawSheet", label: "Raw Sheet" },
          { key: "sheetNo", label: "Sheet #" },
          { key: "totalPiecesOnSheet", label: "Pieces On Sheet" },
          { key: "cutsOnSheet", label: "Cuts On Sheet" },
        ],
        rows: buildExportRows(),
      });
    } catch (err) {
      setExportError(err?.message || "Excel export failed.");
    } finally {
      setIsExcelExporting(false);
    }
  };

  const onGeneratePdfReport = async () => {
    if (!result) return;

    setExportError("");
    setIsPdfExporting(true);
    try {
      await downloadCutOptimiserPdf({
        logoUrl: eliteLogo,
        projectLabel: selectedProject?.label || "N/A",
        dimUnit: form.dimUnit,
        kerfDisplay: `${form.kerf || "0"} ${form.kerfUnit}`,
        generatedAt: new Date().toLocaleString(),
        result,
      });
    } catch (err) {
      setExportError(err?.message || "PDF export failed.");
    } finally {
      setIsPdfExporting(false);
    }
  };

  const onReset = () => {
    clearDraft();
    setError("");
    setResult(null);
    setExportError("");
    setDraftStatus("");
    setForm({ dimUnit: "ft", kerf: "3", kerfUnit: "mm" });
    setRawSheets([buildRawSheet(1, "Sheet A", "6", "3")]);
    setCutItems([buildCutItem(1, "Cut 1", "2", "2", "1")]);
    setNextRawId(2);
    setNextCutId(2);
    setSelectedProjectKey("");
    setRevision("1");
    setIsDirty(false);
  };

  return (
    <section className="module-page cut-optimiser-page">
      <div className="crud-page__header" style={{ marginBottom: "0.8rem" }}>
        <h1 className="module-page__title" style={{ margin: 0 }}>
          {isEditMode ? "Cut Optimiser Edit" : "Cut Optimiser Add"}
        </h1>
        <button type="button" className="crud-add-btn" onClick={onBackToList}>Back to List</button>
      </div>
      <p className="module-page__description">
        Add multiple panel cut sizes and multiple raw sheet sizes, then calculate sheet requirement scenarios.
      </p>

      <div className="cut-optimiser-grid">
        <div className="cut-optimiser-card">
          <h3>Input</h3>

          <div className="cut-optimiser-row">
            <label className="modal-form__label" htmlFor="dim-unit">Dimension Unit</label>
            <select
              id="dim-unit"
              className="auth-input"
              value={form.dimUnit}
              onChange={(e) => onFieldChange("dimUnit", e.target.value)}
            >
              {unitOptions.map((u) => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>

          <div className="cut-optimiser-row">
            <label className="modal-form__label" htmlFor="project-select">Project (ID - Name)</label>
            <Select
              inputId="project-select"
              classNamePrefix="react-select"
              value={selectedProjectOption}
              options={projectOptions}
              onChange={(option) => { setSelectedProjectKey(option?.value || ""); setIsDirty(true); }}
              isClearable
              isSearchable
              placeholder="Search project by ID or name..."
              noOptionsMessage={() => "No projects found"}
            />
            {projectsError ? <small className="users-status users-status--error">{projectsError}</small> : null}
          </div>

          <div className="cut-optimiser-row">
            <label className="modal-form__label" htmlFor="revision">Revision</label>
            <input
              id="revision"
              type="text"
              className="auth-input"
              value={`R${revision}`}
              disabled
              readOnly
            />
          </div>

          <div className="cut-optimiser-list-head">
            <h4>Raw Sheet Sizes</h4>
            <button type="button" className="crud-add-btn" onClick={addRawSheet}>+ Add Sheet Size</button>
          </div>

          {rawSheets.map((row, index) => (
            <div className="cut-optimiser-repeater" key={`raw-${row.id}`}>
              <div className="cut-optimiser-inline-grid cut-optimiser-inline-grid--wide">
                <div className="cut-optimiser-row">
                  <label className="modal-form__label">Name</label>
                  <input
                    type="text"
                    className="auth-input"
                    value={row.name}
                    onChange={(e) => updateRawSheet(row.id, "name", e.target.value)}
                    placeholder={`Sheet ${index + 1}`}
                  />
                </div>
                <div className="cut-optimiser-row">
                  <label className="modal-form__label">Length</label>
                  <input
                    type="number"
                    className="auth-input"
                    value={row.length}
                    onChange={(e) => updateRawSheet(row.id, "length", e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div className="cut-optimiser-row">
                  <label className="modal-form__label">Width</label>
                  <input
                    type="number"
                    className="auth-input"
                    value={row.width}
                    onChange={(e) => updateRawSheet(row.id, "width", e.target.value)}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <button
                type="button"
                className="cut-optimiser-remove"
                onClick={() => removeRawSheet(row.id)}
                disabled={rawSheets.length <= 1}
              >
                Remove
              </button>
            </div>
          ))}

          <div className="cut-optimiser-list-head">
            <h4>Cut Sizes</h4>
            <button type="button" className="crud-add-btn" onClick={() => addCutItem(true)}>+ Add Row</button>
          </div>

          <small className="users-status">Tab in last row Count Needed to add next row</small>

          <div className="cut-optimiser-cut-head cut-optimiser-inline-grid cut-optimiser-inline-grid--wide cut-optimiser-inline-grid--cuts">
            <span>S/N</span>
            <span>Cut Name</span>
            <span>Length</span>
            <span>Width</span>
            <span>Count Needed</span>
          </div>

          {cutItems.map((row, index) => (
            <div className="cut-optimiser-repeater" key={`cut-${row.id}`}>
              <div className="cut-optimiser-cut-row">
                <div className="cut-optimiser-inline-grid cut-optimiser-inline-grid--wide cut-optimiser-inline-grid--cuts">
                  <div className="cut-optimiser-row">
                    <div className="cut-optimiser-serial" aria-label={`Cut row ${index + 1}`}>{index + 1}</div>
                  </div>
                  <div className="cut-optimiser-row">
                    <input
                      id={`cut-name-${row.id}`}
                      type="text"
                      className="auth-input"
                      value={row.name}
                      onChange={(e) => updateCutItem(row.id, "name", e.target.value)}
                      aria-label={`Cut name row ${index + 1}`}
                      placeholder={`Cut ${index + 1}`}
                    />
                  </div>
                  <div className="cut-optimiser-row">
                    <input
                      type="number"
                      className="auth-input"
                      value={row.length}
                      onChange={(e) => updateCutItem(row.id, "length", e.target.value)}
                      aria-label={`Length row ${index + 1}`}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="cut-optimiser-row">
                    <input
                      type="number"
                      className="auth-input"
                      value={row.width}
                      onChange={(e) => updateCutItem(row.id, "width", e.target.value)}
                      aria-label={`Width row ${index + 1}`}
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="cut-optimiser-row">
                    <input
                      type="number"
                      className="auth-input"
                      value={row.quantity}
                      onChange={(e) => updateCutItem(row.id, "quantity", e.target.value)}
                      onKeyDown={(e) => onCutQtyKeyDown(row, index, e)}
                      aria-label={`Count needed row ${index + 1}`}
                      min="1"
                      step="1"
                    />
                  </div>
                </div>
                <button
                  type="button"
                  className="cut-optimiser-remove cut-optimiser-remove--inline"
                  onClick={() => removeCutItem(row.id)}
                  disabled={cutItems.length <= 1}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="cut-optimiser-inline-grid">
            <div className="cut-optimiser-row">
              <label className="modal-form__label" htmlFor="kerf">Cutter Thickness (Kerf)</label>
              <input
                id="kerf"
                type="number"
                className="auth-input"
                value={form.kerf}
                onChange={(e) => onFieldChange("kerf", e.target.value)}
                min="0"
                step="0.01"
              />
            </div>
            <div className="cut-optimiser-row">
              <label className="modal-form__label" htmlFor="kerf-unit">Kerf Unit</label>
              <select
                id="kerf-unit"
                className="auth-input"
                value={form.kerfUnit}
                onChange={(e) => onFieldChange("kerfUnit", e.target.value)}
              >
                {unitOptions.map((u) => (
                  <option key={u.value} value={u.value}>{u.label}</option>
                ))}
              </select>
            </div>
          </div>

          {error ? <p className="users-status users-status--error">{error}</p> : null}
          {draftStatus ? <p className="users-status">{draftStatus}</p> : null}

          <div className="cut-optimiser-actions">
            <button type="button" className="modal-btn" onClick={onSaveRecord}>Save Record</button>
            <button type="button" className="modal-btn" onClick={onSaveDraft}>Save Draft</button>
            <button type="button" className="modal-btn modal-btn--save" onClick={onCalculate}>Calculate</button>
            <button type="button" className="modal-btn modal-btn--cancel" onClick={onReset}>Reset</button>
          </div>
        </div>

        <div className="cut-optimiser-card">
          <h3>Result</h3>
          {!result ? (
            <p className="users-status">Enter details and click Calculate.</p>
          ) : (
            <div className="cut-optimiser-result-stack">
              <div className="cut-optimiser-actions cut-optimiser-actions--result">
                <button
                  type="button"
                  className="modal-btn modal-btn--save"
                  onClick={onGeneratePdfReport}
                  disabled={isPdfExporting || isExcelExporting}
                >
                  {isPdfExporting ? "Generating PDF..." : "Download PDF Report"}
                </button>
                <button
                  type="button"
                  className="modal-btn modal-btn--cancel"
                  onClick={onDownloadTableExcel}
                  disabled={isPdfExporting || isExcelExporting}
                >
                  {isExcelExporting ? "Exporting Excel..." : "Download Table (Excel)"}
                </button>
              </div>

              {exportError ? <p className="users-status users-status--error">{exportError}</p> : null}

              <p className="users-status">
                Best option: <strong>{result.bestOption.sheetName}</strong> ({result.bestOption.sheetSize}) - {result.bestOption.totalSheets} sheets
              </p>

              {result.scenarios.map((scenario) => (
                <div className="cut-optimiser-result-grid" key={scenario.sheetName}>
                  <div><span className="cut-result__label">Raw Sheet</span><span className="cut-result__value">: {scenario.sheetName} ({scenario.sheetSize})</span></div>
                  <div><span className="cut-result__label">Total Sheets Needed</span><span className="cut-result__value">: {scenario.allCutsFit ? scenario.totalSheets : "Not feasible"}</span></div>
                  <div><span className="cut-result__label">Total Panel Area</span><span className="cut-result__value">: {scenario.totalPanelAreaM2.toFixed(3)} m² ({scenario.totalPanelAreaFt2.toFixed(2)} ft²)</span></div>
                  <div><span className="cut-result__label">Total Sheet Area</span><span className="cut-result__value">: {scenario.totalSheetAreaM2.toFixed(3)} m² ({scenario.totalSheetAreaFt2.toFixed(2)} ft²)</span></div>
                  <div><span className="cut-result__label">Estimated Waste Area</span><span className="cut-result__value">: {scenario.wasteAreaM2.toFixed(3)} m² ({scenario.wasteAreaFt2.toFixed(2)} ft²)</span></div>
                  <div><span className="cut-result__label">Area Yield</span><span className="cut-result__value">: {scenario.yieldPercent.toFixed(1)}%</span></div>

                  <SheetVisual scenario={scenario} kerfMm={result.kerfMm} />

                  <table className="users-table cut-optimiser-table">
                    <thead>
                      <tr>
                        <th>Cut #</th>
                        <th>Cut Name</th>
                        <th>Size</th>
                        <th>Qty</th>
                        <th>Per Sheet</th>
                        <th>Sheets</th>
                        <th>Best Fit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenario.perCut.map((line) => (
                        <tr key={`${scenario.sheetName}-${line.lineNo}`}>
                          <td>{line.lineNo}</td>
                          <td>{line.name}</td>
                          <td>{line.sizeLabel}</td>
                          <td>{line.quantity}</td>
                          <td>{line.partsPerSheet}</td>
                          <td>{line.sheetsNeeded}</td>
                          <td>{line.orientation}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default CutOptimiserPage;

