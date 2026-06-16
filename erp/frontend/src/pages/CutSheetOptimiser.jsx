import React, { useState, useEffect } from 'react';
import { listProjects } from '../services/crudApi';
import { useNavigate, useParams } from 'react-router-dom';
import { BsPencilSquare, BsTrashFill, BsSave, BsX, BsPlusLg } from 'react-icons/bs';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import eliteLogo from '../assets/logos/elite_logo.png';
import { buildPackedSheetsForScenario } from '../utils/cutPackingEngine';
import {
  createCutOptimiserRecord,
  updateCutOptimiserRecord,
  getCutOptimiserRecordById,
  getLatestCutOptimiserId
} from '../services/crudApi';
import { getSessionUser } from '../services/sessionUser';

function incrementRevision(value) {
  const raw = String(value || '1').trim();
  const normalized = raw.toLowerCase().startsWith('r') ? raw.slice(1) : raw;
  const match = normalized.match(/^(\d+)$/);
  if (!match) return '1';
  const next = String(parseInt(match[1], 10) + 1);
  return next.padStart(match[1].length, '0');
}

function isDuplicateRevisionError(err) {
  const message = String(
      err?.payload?.message
      || err?.message
      || ''
  ).toLowerCase();

  return message.includes('project and revision') && message.includes('already exists');
}

// ─── Shared packing engine + palette ─────────────────────────────────────────

const CUT_COLORS = [
  '#4e79a7','#f28e2b','#e15759','#76b7b2','#59a14f',
  '#edc948','#b07aa1','#ff9da7','#9c755f','#bab0ac',
  '#d4a5a5','#a8d8ea','#aa96da','#fcbad3','#c7f2a4',
];

// ─── SVG visualisation for one sheet ──────────────────────────────────────────
const MAX_SVG_W = 560;
const MAX_SVG_H = 400;

function getVisualSheetTransform(rawW, rawH) {
  const width = parseFloat(rawW) || 0;
  const height = parseFloat(rawH) || 0;
  const rotate = height > width;

  return {
    width: rotate ? height : width,
    height: rotate ? width : height,
    rotate,
  };
}

function mapPlacementForVisual(p, rawW, rawH, rotate) {
  const dW = p.displayW ?? p.placedW;
  const dH = p.displayH ?? p.placedH;

  if (!rotate) {
    return { x: p.x, y: p.y, w: dW, h: dH };
  }

  return {
    x: rawH - (p.y + dH),
    y: p.x,
    w: dH,
    h: dW,
  };
}

function SheetSVG({ placements, rawW, rawH, sheetNum, unitLabel, kerfThickness = 0 }) {
  const visual = getVisualSheetTransform(rawW, rawH);
  const scale = Math.min(MAX_SVG_W / visual.width, MAX_SVG_H / visual.height);
  const dispW = visual.width * scale;
  const dispH = visual.height * scale;
  const safePlacements = Array.isArray(placements) ? placements : [];
  const usedArea = safePlacements.reduce((s, p) => s + (p.displayW ?? p.placedW) * (p.displayH ?? p.placedH), 0);
  const eff = ((usedArea / (rawW * rawH)) * 100).toFixed(1);
  const bladeGapStroke = Math.max(2, (parseFloat(kerfThickness) || 0) * scale * 7);

  return (
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 600, marginBottom: 6, fontSize: '1rem' }}>
          Sheet {sheetNum} &nbsp;
          <span style={{ fontWeight: 400, fontSize: '0.85rem', color: '#555' }}>
          {formatDimsLongFirst(rawW, rawH)}{unitLabel ? ` ${unitLabel}` : ''} &nbsp;|&nbsp; {safePlacements.length} piece{safePlacements.length !== 1 ? 's' : ''} &nbsp;|&nbsp; Efficiency: <b style={{ color: parseFloat(eff) >= 70 ? '#27ae60' : '#e67e22' }}>{eff}%</b>
        </span>
        </div>
        <svg
            width={dispW} height={dispH}
            style={{ border: '2px solid #555', background: '#e8e8e8', display: 'block', borderRadius: 4 }}
        >
          {safePlacements.map((p, i) => {
            const mapped = mapPlacementForVisual(p, rawW, rawH, visual.rotate);
            const px = mapped.x * scale;
            const py = mapped.y * scale;
            const pw = mapped.w * scale;
            const ph = mapped.h * scale;
            const fs = Math.max(7, Math.min(13, Math.min(pw, ph) / 4));
            const showText = pw > 22 && ph > 14;
            return (
                <g key={i}>
                  <rect x={px} y={py} width={pw} height={ph} fill={p.color} stroke="#e8e8e8" strokeWidth={bladeGapStroke} opacity={0.98} rx={1} />
                  <rect x={px} y={py} width={pw} height={ph} fill="none" stroke="#222" strokeWidth={0.8} opacity={0.88} rx={1} />
                  {showText && (
                      <text x={px + pw / 2} y={py + ph / 2 - (p.rotated ? fs / 2 + 1 : 0)}
                            textAnchor="middle" dominantBaseline="middle"
                            fontSize={fs} fill="#fff" fontWeight="bold"
                            style={{ pointerEvents: 'none', userSelect: 'none' }}>
                        {p.name}
                      </text>
                  )}
                  {p.rotated && showText && (
                      <text x={px + pw / 2} y={py + ph / 2 + fs + 1}
                            textAnchor="middle" dominantBaseline="middle"
                            fontSize={Math.max(6, fs - 2)} fill="#ffe"
                            style={{ pointerEvents: 'none', userSelect: 'none' }}>↻ rotated</text>
                  )}
                </g>
            );
          })}
        </svg>
      </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────

// Helper function to convert area based on unit system
function convertAreaToStandard(area, unitSymbol) {
  // area is in unit²
  // Returns [areaInM2, areaInFt2]
  if (!unitSymbol) return [area, area * 10.764];

  const symbol = (unitSymbol || '').toLowerCase().trim();

  if (symbol === 'mm') {
    // mm² to m² = divide by 1,000,000; to ft² = divide by 92,903.04
    return [area / 1000000, area / 92903.04];
  } else if (symbol === 'cm') {
    // cm² to m² = divide by 10,000; to ft² = divide by 929.03
    return [area / 10000, area / 929.03];
  } else if (symbol === 'm') {
    // m² to m² = 1; to ft² = multiply by 10.764
    return [area, area * 10.764];
  } else if (symbol === 'ft' || symbol === 'feet') {
    // ft² to m² = divide by 10.764; to ft² = 1
    return [area / 10.764, area];
  } else if (symbol === 'in' || symbol === 'inch') {
    // in² to m² = divide by 1550; to ft² = divide by 144
    return [area / 1550, area / 144];
  }

  // Default: assume area is in m²
  return [area, area * 10.764];
}

function toNumber(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function formatDimsLongFirst(a, b) {
  const av = toNumber(a);
  const bv = toNumber(b);
  const longer = Math.max(av, bv);
  const shorter = Math.min(av, bv);
  return `${longer} x ${shorter}`;
}

function formatDimsLengthWidth(lengthValue, widthValue) {
  return `${toNumber(lengthValue)} x ${toNumber(widthValue)}`;
}

function convertMmToUnit(mmValue, unitSymbol) {
  const mm = parseFloat(mmValue);
  if (!Number.isFinite(mm) || mm <= 0) return 0;

  const symbol = String(unitSymbol || '').toLowerCase().trim();
  if (symbol === 'mm') return mm;
  if (symbol === 'cm') return mm / 10;
  if (symbol === 'm') return mm / 1000;
  if (symbol === 'ft' || symbol === 'feet') return mm / 304.8;
  if (symbol === 'in' || symbol === 'inch') return mm / 25.4;
  return mm;
}

function convertUnitToMm(value, unitSymbol) {
  const n = parseFloat(value);
  if (!Number.isFinite(n) || n <= 0) return 0;

  const symbol = String(unitSymbol || '').toLowerCase().trim();
  if (symbol === 'mm') return n;
  if (symbol === 'cm') return n * 10;
  if (symbol === 'm') return n * 1000;
  if (symbol === 'ft' || symbol === 'feet') return n * 304.8;
  if (symbol === 'in' || symbol === 'inch') return n * 25.4;
  return n;
}

function canFitInRawSheet(cutLength, cutWidth, rawLength, rawWidth) {
  const l = parseFloat(cutLength);
  const w = parseFloat(cutWidth);
  const rl = parseFloat(rawLength);
  const rw = parseFloat(rawWidth);

  if (!Number.isFinite(l) || !Number.isFinite(w) || !Number.isFinite(rl) || !Number.isFinite(rw) || l <= 0 || w <= 0 || rl <= 0 || rw <= 0) {
    return false;
  }

  const fitsNormal = l <= rl && w <= rw;
  const fitsRotated = l <= rw && w <= rl;
  return fitsNormal || fitsRotated;
}

async function imageUrlToDataUrl(url) {
  const response = await fetch(url);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read image data.'));
    reader.readAsDataURL(blob);
  });
}

function downloadBlob(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
}

function sanitizeFileName(value, fallback = 'cut_optimiser_report') {
  return String(value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || fallback;
}

function buildCutReportRows(cutSizes, bins, rawW, rawH) {
  const byCut = new Map();

  (Array.isArray(bins) ? bins : []).forEach((bin, sheetIdx) => {
    const seenOnSheet = new Set();
    (Array.isArray(bin?.placements) ? bin.placements : []).forEach((p) => {
      const cutKey = String(p.id ?? p.cutKey ?? '');
      if (!cutKey) return;
      if (!byCut.has(cutKey)) {
        byCut.set(cutKey, { placed: 0, sheetSet: new Set(), rotated: 0, normal: 0 });
      }
      const stat = byCut.get(cutKey);
      stat.placed += 1;
      if (p.rotated) stat.rotated += 1;
      else stat.normal += 1;
      if (!seenOnSheet.has(cutKey)) {
        stat.sheetSet.add(sheetIdx);
        seenOnSheet.add(cutKey);
      }
    });
  });

  const rawArea = (parseFloat(rawW) || 0) * (parseFloat(rawH) || 0);

  return cutSizes.map((cs, idx) => {
    const qty = parseInt(cs.quantity, 10) || 1;
    const stat = byCut.get(String(cs.id)) || { placed: 0, sheetSet: new Set(), rotated: 0, normal: 0 };
    const sheetsUsed = Math.max(1, stat.sheetSet.size || 1);
    const perSheet = Math.max(1, Math.ceil((stat.placed || qty) / sheetsUsed));
    const cutArea = (parseFloat(cs.width) || 0) * (parseFloat(cs.length) || 0);
    const theoreticalPerSheet = rawArea > 0 && cutArea > 0 ? Math.max(1, Math.floor(rawArea / cutArea)) : perSheet;
    let bestFit = 'Normal';
    if (stat.rotated > 0 && stat.normal > 0) bestFit = 'Mixed';
    else if (stat.rotated > 0) bestFit = 'Rotated';

    return {
      no: idx + 1,
      name: cs.name || `Cut ${idx + 1}`,
      size: formatDimsLengthWidth(cs.length, cs.width),
      qty,
      perSheet,
      sheets: sheetsUsed,
      bestFit,
      theoreticalPerSheet,
    };
  });
}

const CutSheetOptimiser = () => {
  // Project fields
  const [projectId, setProjectId] = useState('');
  const [projectOptions, setProjectOptions] = useState([]);
  const [revision, setRevision] = useState('1');
  // Cut Optimiser ID: empty on add, filled on edit
  const [cutOptimiserId, setCutOptimiserId] = useState('');
  const [updatedBy, setUpdatedBy] = useState('');
  // Get current user from session
  const currentUser = getSessionUser();
  // Add a loading state for edit mode
  const [loadingRecord, setLoadingRecord] = useState(false);
  // Add a success message
  const [success, setSuccess] = useState('');

  // Sheet fields (support multiple sheets)
  const [sheets, setSheets] = useState([
    { raw_sheet_name: 'Sheet 1', raw_sheet_length: 0, raw_sheet_width: 0, raw_sheet_blade_thk: 0, dimension_unit: '' }
  ]);

  // Units fetched from backend (simulate foreign key table)
  const [unitOptions, setUnitOptions] = useState([]);
  const [loadingUnits, setLoadingUnits] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const { recordId } = useParams(); // recordId param for edit mode
  const isEdit = Boolean(recordId);

  // CutSize management state
  const [cutSizes, setCutSizes] = useState([]);
  const [loadingCutSizes, setLoadingCutSizes] = useState(false);
  const [editingCutSizeId, setEditingCutSizeId] = useState(null);
  const [newCutSizeForm, setNewCutSizeForm] = useState({ name: '', width: '', length: '', quantity: '1' });
  const [editCutSizeForm, setEditCutSizeForm] = useState({ name: '', width: '', length: '', quantity: '1' });
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [savingCutSizeId, setSavingCutSizeId] = useState(null);
  const [calcResults, setCalcResults] = useState(null); // { bins, colorMap }

  const getLatestRevisionForProject = async (projectId) => {
    try {
      const res = await fetch(`/api/cut-optimiser/?project=${encodeURIComponent(projectId)}&ordering=-id&limit=1`, {
        credentials: 'include'
      });
      const data = await res.json();
      if (data && data.results && data.results.length > 0) {
        return String(data.results[0].revision || '0');
      }
      return '0';
    } catch {
      return '0';
    }
  };

  useEffect(() => {
    // Fetch project options from backend
    setLoadingProjects(true);
    listProjects()
        .then(data => {
          setProjectOptions((data.projects || []).map(p => ({
            value: p.id, // Use Project PK
            label: `${p.project_id}${p.project_name ? '_' + p.project_name : ''}` // ProjectID_ProjectName
          })));
        })
        .catch(() => setProjectOptions([]))
        .finally(() => setLoadingProjects(false));
  }, []);

  useEffect(() => {
    setLoadingUnits(true);
    fetch('/api/uoms/')
        .then(res => res.json())
        .then(data => {
          const options = (data || []).map(u => ({
            value: u.id, // Use the UOM PK
            label: `${u.name} (${u.symbol})`,
            symbol: u.symbol
          }));
          setUnitOptions(options);
          // Set default unit to 'ft' if available and not in edit mode
          if (!isEdit && options.length > 0) {
            const ftOption = options.find(opt => opt.symbol && opt.symbol.toLowerCase() === 'ft');
            if (ftOption) {
              setSheets(prevSheets => {
                const safeSheets = Array.isArray(prevSheets) ? prevSheets : [{ raw_sheet_name: 'Sheet 1', raw_sheet_length: 0, raw_sheet_width: 0, raw_sheet_blade_thk: 0, dimension_unit: '' }];
                return safeSheets.map((s, i) => i === 0 ? { ...s, dimension_unit: ftOption.value } : s);
              });
            } else {
              setSheets(prevSheets => {
                const safeSheets = Array.isArray(prevSheets) ? prevSheets : [{ raw_sheet_name: 'Sheet 1', raw_sheet_length: 0, raw_sheet_width: 0, raw_sheet_blade_thk: 0, dimension_unit: '' }];
                return safeSheets.map((s, i) => i === 0 ? { ...s, dimension_unit: options[0].value } : s);
              });
            }
          }
        })
        .catch(() => setUnitOptions([]))
        .finally(() => setLoadingUnits(false));
  }, [isEdit]);

  // Fetch record for edit
  useEffect(() => {
    if (isEdit) {
      setLoadingRecord(true);
      getCutOptimiserRecordById(recordId)
          .then(data => {
            setProjectId(data.project);
            setRevision(data.revision || '1');
            setCutOptimiserId(data.cut_optimiser_id || '');
            setUpdatedBy(data.updated_by || '');
             setSheets([{
               raw_sheet_name: data.raw_sheet_name || 'Sheet 1',
               raw_sheet_length: data.raw_sheet_length || '',
               raw_sheet_width: data.raw_sheet_width || '',
               raw_sheet_blade_thk: data.raw_sheet_blade_thk || '',
               dimension_unit: data.dimension_unit || ''
             }]);
          })
          .catch(() => setError('Failed to load record'))
          .finally(() => setLoadingRecord(false));
    }
  }, [isEdit, recordId]);

  // Set updatedBy to current user on mount (add mode only)
  useEffect(() => {
    if (!recordId && currentUser && currentUser.id) {
      setUpdatedBy(currentUser.id);
    }
  }, [recordId, currentUser]);

  // Handle sheet field changes
  const handleSheetChange = (idx, field, value) => {
    const safeSheets = Array.isArray(sheets) ? sheets : [];
    const updated = safeSheets.map((sheet, i) =>
        i === idx ? { ...sheet, [field]: value } : sheet
    );
    setSheets(updated);
  };

  // Remove sheet row
  const removeSheet = (idx) => {
    const safeSheets = Array.isArray(sheets) ? sheets : [];
    setSheets(safeSheets.filter((_, i) => i !== idx));
  };

  const saveRecord = async (revisionToSave = revision, existingId = cutOptimiserId) => {
    let newId = existingId;

    if (!isEdit && !newId) {
      const latestId = await getLatestCutOptimiserId();
      let baseNum = 0;
      if (latestId) {
        const match = latestId.match(/\d+$/);
        if (match) {
          baseNum = parseInt(match[0], 10);
        }
      }
      newId = `CP${String(baseNum + 1).padStart(5, '0')}`;
      setCutOptimiserId(newId);
    }

     const payload = {
       project: projectId,
       revision: revisionToSave,
       cut_optimiser_id: isEdit ? cutOptimiserId : newId,
       updated_by: updatedBy,
       raw_sheet_name: sheets[0]?.raw_sheet_name || '',
       raw_sheet_length: sheets[0]?.raw_sheet_length ?? 0,
       raw_sheet_width: sheets[0]?.raw_sheet_width ?? 0,
       raw_sheet_blade_thk: sheets[0]?.raw_sheet_blade_thk ?? 0,
       dimension_unit: sheets[0]?.dimension_unit || ''
     };

    if (isEdit) {
      await updateCutOptimiserRecord(recordId, payload);
      return { revision: revisionToSave, cutOptimiserId: cutOptimiserId, dbId: recordId };
    }

    const created = await createCutOptimiserRecord(payload);
    return { revision: revisionToSave, cutOptimiserId: newId, dbId: created?.id };
  };

  const loadCutSizes = async (optimiserRecordId) => {
    if (!optimiserRecordId) {
      setCutSizes([]);
      return;
    }

    setLoadingCutSizes(true);
    try {
      const res = await fetch(`/api/cut-optimiser/${optimiserRecordId}/cut-sizes/`, {
        credentials: 'include'
      });
      const data = await res.json();
      setCutSizes(data.results || []);
      // Keep one inline input row ready so users can add the next cut size immediately.
      setIsAddingNew(true);
    } catch (err) {
      console.error('Failed to load cut sizes:', err);
      setCutSizes([]);
    } finally {
      setLoadingCutSizes(false);
    }
  };

  useEffect(() => {
    if (recordId) {
      loadCutSizes(recordId);
    }
  }, [recordId]);

  const handleAddNewRow = () => {
    if (!recordId) {
      alert('Please save the Cut Optimiser record first.');
      return;
    }
    setIsAddingNew(true);
    setNewCutSizeForm({ name: '', width: '', length: '', quantity: '1' });
  };

   const handleCalculate = () => {
     const rawW = parseFloat(sheets[0]?.raw_sheet_width);
     const rawH = parseFloat(sheets[0]?.raw_sheet_length);
     const kerfMm = parseFloat(sheets[0]?.raw_sheet_blade_thk) || 0;
     const unitObj = unitOptions.find(u => u.value === sheets[0]?.dimension_unit);
     const unitSymbol = unitObj?.symbol || '';
     const kerf = convertMmToUnit(kerfMm, unitSymbol);
     const calculableCutSizes = cutSizes.filter(cs => parseFloat(cs.width) > 0 && parseFloat(cs.length) > 0);
     if (!rawW || !rawH) {
       alert('Please set valid raw sheet dimensions (Length and Width) first.');
       return;
     }
     if (calculableCutSizes.length === 0) {
       alert('Please add at least one cut size first.');
       return;
     }
     const oversizeCut = calculableCutSizes.find(cs => !canFitInRawSheet(cs.length, cs.width, rawH, rawW));
     if (oversizeCut) {
       alert(`Cut size "${oversizeCut.name || 'unnamed'}" (${oversizeCut.width} x ${oversizeCut.length}) is bigger than the raw sheet (${rawW} x ${rawH}). Please correct it.`);
       return;
     }

      const rawSheetLengthMm = convertUnitToMm(rawH, unitSymbol);
      const rawSheetWidthMm = convertUnitToMm(rawW, unitSymbol);
      const mmPerUnit = convertUnitToMm(1, unitSymbol) || 1;
      const perCut = calculableCutSizes.map((cs, index) => {
        const cutLengthMm = convertUnitToMm(cs.length, unitSymbol);
        const cutWidthMm = convertUnitToMm(cs.width, unitSymbol);
        const cutKey = String(cs.id ?? index + 1);
        return {
          cutKey,
          lineNo: index + 1,
          name: cs.name || `Cut ${index + 1}`,
          sizeLabel: `${cs.length} x ${cs.width} ${unitSymbol}`,
          quantity: parseInt(cs.quantity, 10) || 1,
          cutLengthMm,
          cutWidthMm,
          rotated: false,
        };
      });

      const packedScenario = {
        sheetLengthMm: rawSheetLengthMm,
        sheetWidthMm: rawSheetWidthMm,
        perCut,
      };

      const packed = buildPackedSheetsForScenario(packedScenario, kerfMm);
      const binsInDisplayUnit = (Array.isArray(packed?.sheets) ? packed.sheets : []).map((sheet) => ({
        ...sheet,
        placements: (Array.isArray(sheet?.items) ? sheet.items : []).map((item) => {
          const w = (item.w || 0) / mmPerUnit;
          const h = (item.h || 0) / mmPerUnit;
          return {
            ...item,
            id: item.cutKey,
            x: (item.x || 0) / mmPerUnit,
            y: (item.y || 0) / mmPerUnit,
            w,
            h,
            placedW: w,
            placedH: h,
            displayW: w,
            displayH: h,
          };
        })
      }));

      const totalSheets = binsInDisplayUnit.length;
      const totalPanelArea = calculableCutSizes.reduce(
        (sum, cs) => sum + (toNumber(cs.length) * toNumber(cs.width) * (parseInt(cs.quantity, 10) || 1)),
        0
      );
      const totalSheetArea = rawW * rawH * totalSheets;
      const result = {
        bins: binsInDisplayUnit,
        colorMap: Object.fromEntries(calculableCutSizes.map((cs, idx) => [cs.id, CUT_COLORS[idx % CUT_COLORS.length]])),
        totalSheets,
        totalPanelArea,
        totalSheetArea,
        totalWaste: 0,
        yieldPercent: 0,
        kerf: kerf,
        kerfMm,
        kerfInSheetUnit: kerf,
        unplacedCount: packed?.feasible ? 0 : 1,
      };

      result.totalWaste = Math.max(result.totalSheetArea - result.totalPanelArea, 0);
      result.yieldPercent = result.totalSheetArea > 0 ? ((result.totalPanelArea / result.totalSheetArea) * 100) : 0;

      setCalcResults(result);
      // Scroll to results
      setTimeout(() => {
        document.getElementById('cut-optimiser-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 80);
    };

    const generatePDFReport = async () => {
      if (!calcResults) {
        alert('Please run the calculation first.');
        return;
      }

      const doc = new jsPDF('l', 'mm', 'A4');
      const pageHeight = doc.internal.pageSize.getHeight();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 10;
      let currentY = 12;

      const unitObj = unitOptions.find(u => u.value === sheets[0]?.dimension_unit);
      const unitSymbol = unitObj?.symbol || '';
      const sheetName = sheets[0]?.raw_sheet_name || 'Sheet A';
      // Keep axes consistent with packed placements: x=sheet length, y=sheet width.
      const rawW = parseFloat(sheets[0]?.raw_sheet_length) || 0;
      const rawH = parseFloat(sheets[0]?.raw_sheet_width) || 0;
      const [panelAreaM2, panelAreaFt2] = convertAreaToStandard(calcResults.totalPanelArea, unitSymbol);
      const [sheetAreaM2, sheetAreaFt2] = convertAreaToStandard(calcResults.totalSheetArea, unitSymbol);
      const [wasteAreaM2, wasteAreaFt2] = convertAreaToStandard(calcResults.totalWaste, unitSymbol);
      const safeBins = Array.isArray(calcResults?.bins) ? calcResults.bins : [];
      const cutReportRows = buildCutReportRows(cutSizes, safeBins, rawW, rawH);
      const projectLabel = projectOptions.find(p => p.value === projectId)?.label || projectId;
      const rawSizeDisplay = `${formatDimsLongFirst(rawW, rawH)}${unitSymbol ? ` ${unitSymbol}` : ''}`;

      let logoDataUrl = null;
      try {
        logoDataUrl = await imageUrlToDataUrl(eliteLogo);
      } catch {
        logoDataUrl = null;
      }

      // Header
      if (logoDataUrl) {
        doc.addImage(logoDataUrl, 'PNG', margin, 8, 14, 14);
      }
      doc.setFontSize(15);
      doc.text('Elite ERP - Cut Optimiser Report', logoDataUrl ? 27 : margin, currentY);
      currentY += 6;
      doc.setFontSize(10);
      doc.text(`Project: ${projectLabel}`, logoDataUrl ? 27 : margin, currentY);
      currentY += 5;
      doc.text(`Generated: ${new Date().toLocaleString()}`, logoDataUrl ? 27 : margin, currentY);
      currentY += 8;

      // Results block
      doc.setFontSize(12);
      doc.text('Results', margin, currentY);
      currentY += 6;
      doc.setFontSize(9.5);
      doc.text(`Best Option: ${sheetName} (${rawSizeDisplay}) - ${calcResults.totalSheets} sheets`, margin, currentY);
      currentY += 5;
      doc.text(`Dimension Unit: ${unitSymbol} | Kerf: ${Number(calcResults.kerfMm || 0).toFixed(3)} mm (${Number(calcResults.kerfInSheetUnit || calcResults.kerf || 0).toFixed(4)} ${unitSymbol})`, margin, currentY);
      currentY += 5;
      doc.text(`Panel Area: ${panelAreaM2.toFixed(3)} m2 (${panelAreaFt2.toFixed(2)} ft2)`, margin, currentY);
      currentY += 5;
      doc.text(`Sheet Area: ${sheetAreaM2.toFixed(3)} m2 (${sheetAreaFt2.toFixed(2)} ft2)`, margin, currentY);
      currentY += 5;
      doc.text(`Waste: ${wasteAreaM2.toFixed(3)} m2 (${wasteAreaFt2.toFixed(2)} ft2) | Yield: ${calcResults.yieldPercent.toFixed(1)}%`, margin, currentY);
      currentY += 7;

      // Cut table similar to reference PDF
      doc.autoTable({
        head: [['Cut #', 'Cut Name', 'Size', 'Qty', 'Per Sheet', 'Sheets', 'Best Fit']],
        body: cutReportRows.map(row => [row.no, row.name, `${row.size} ${unitSymbol}`, row.qty, row.perSheet, row.sheets, row.bestFit]),
        startY: currentY,
        margin: { left: margin, right: margin },
        theme: 'grid',
        headStyles: { fillColor: [28, 207, 201], textColor: [20, 30, 30], fontSize: 8.5 },
        styles: { fontSize: 8.2, cellPadding: 1.7 }
      });
      currentY = doc.lastAutoTable.finalY + 7;

      // Visual section with drawn sheet layouts
      if (currentY > pageHeight - 40) {
        doc.addPage();
        currentY = 12;
      }
      doc.setFontSize(12);
      doc.text(`Visual View (${sheetName})`, margin, currentY);
      currentY += 6;

      safeBins.forEach((bin, idx) => {
        const maxLayoutW = pageWidth - (margin * 2);
        const maxLayoutH = 80;
        const visual = getVisualSheetTransform(rawW, rawH);
        const scale = Math.min(maxLayoutW / visual.width, maxLayoutH / visual.height);
        const layoutW = visual.width * scale;
        const layoutH = Math.max(24, visual.height * scale);
        const bladeGapStroke = Math.max(0.8, (calcResults.kerfMm || 0) * 0.75);

        if (currentY + layoutH + 18 > pageHeight - margin) {
          doc.addPage();
          currentY = 12;
        }

        doc.setFontSize(9);
        doc.text(`Raw Sheet ${idx + 1} of ${calcResults.bins.length} - ${bin.placements.length} pieces`, margin, currentY);
        currentY += 1.5;

        const sheetY = currentY + 2;
        doc.setFillColor(11, 61, 68);
        doc.setDrawColor(37, 210, 195);
        doc.rect(margin, sheetY, layoutW, layoutH, 'FD');

        doc.setTextColor(220, 249, 255);
        doc.setFontSize(8);
        doc.text(`Raw: ${rawSizeDisplay}`, margin + 2, sheetY + 4);

        (Array.isArray(bin?.placements) ? bin.placements : []).forEach((p) => {
          const mapped = mapPlacementForVisual(p, rawW, rawH, visual.rotate);
          const px = margin + (mapped.x * scale);
          const py = sheetY + (mapped.y * scale);
          const pw = Math.max(0.9, mapped.w * scale);
          const ph = Math.max(0.9, mapped.h * scale);

          const hex = (p.color || '#4e79a7').replace('#', '');
          const rgb = {
            r: parseInt(hex.substring(0, 2), 16) || 78,
            g: parseInt(hex.substring(2, 4), 16) || 121,
            b: parseInt(hex.substring(4, 6), 16) || 167,
          };
          doc.setFillColor(rgb.r, rgb.g, rgb.b);
          doc.setDrawColor(11, 61, 68);
          doc.setLineWidth(bladeGapStroke);
          doc.rect(px, py, pw, ph, 'FD');
          doc.setDrawColor(20, 30, 40);
          doc.setLineWidth(0.25);
          doc.rect(px, py, pw, ph);

          if (pw > 12 && ph > 7) {
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(6.8);
            doc.text(String(p.name || 'Cut'), px + pw / 2, py + ph / 2 + 1.2, { align: 'center' });
          }
        });

        doc.setTextColor(0, 0, 0);
        currentY = sheetY + layoutH + 8;
      });

      const fileName = sanitizeFileName(`cut_optimiser_${cutOptimiserId}_${new Date().toISOString().split('T')[0]}`);
      doc.save(`${fileName}.pdf`);
    };

    const downloadExcelReport = async () => {
      if (!calcResults) {
        alert('Please run the calculation first.');
        return;
      }

      const { default: ExcelJS } = await import('exceljs');
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Cut Optimiser Table');

      const unitObj = unitOptions.find(u => u.value === sheets[0]?.dimension_unit);
      const unitSymbol = unitObj?.symbol || '';
      const projectLabel = projectOptions.find(p => p.value === projectId)?.label || projectId;
      const safeBins = Array.isArray(calcResults?.bins) ? calcResults.bins : [];
      const rawSheetText = `${sheets[0]?.raw_sheet_name || 'Sheet A'} (${formatDimsLongFirst(sheets[0]?.raw_sheet_width, sheets[0]?.raw_sheet_length)} ${unitSymbol})`;
      const cutReportRows = buildCutReportRows(
        cutSizes,
        safeBins,
        parseFloat(sheets[0]?.raw_sheet_width),
        parseFloat(sheets[0]?.raw_sheet_length),
      );

      sheet.columns = [
        { header: 'Project', key: 'project', width: 42 },
        { header: 'Raw Sheet', key: 'rawSheet', width: 28 },
        { header: 'Cut #', key: 'cutNo', width: 8 },
        { header: 'Cut Name', key: 'cutName', width: 16 },
        { header: 'Size', key: 'size', width: 18 },
        { header: 'Qty', key: 'qty', width: 8 },
        { header: 'Per Sheet', key: 'perSheet', width: 11 },
        { header: 'Sheets', key: 'sheets', width: 9 },
        { header: 'Best Fit', key: 'bestFit', width: 11 },
      ];

      cutReportRows.forEach((row) => {
        sheet.addRow({
          project: projectLabel,
          rawSheet: rawSheetText,
          cutNo: row.no,
          cutName: row.name,
          size: `${row.size} ${unitSymbol}`,
          qty: row.qty,
          perSheet: row.perSheet,
          sheets: row.sheets,
          bestFit: row.bestFit,
        });
      });

      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D4A51' },
      };

      const visualSheet = workbook.addWorksheet('Visual Summary');
      visualSheet.columns = [
        { header: 'Sheet #', key: 'sheetNo', width: 10 },
        { header: 'Pieces', key: 'pieces', width: 10 },
        { header: 'Raw Size', key: 'raw', width: 20 },
        { header: 'Cuts On Sheet', key: 'cuts', width: 80 },
      ];

      safeBins.forEach((bin, idx) => {
        const grouped = {};
        const safePlacements = Array.isArray(bin?.placements) ? bin.placements : [];
        safePlacements.forEach((p) => {
          const key = `${p.name} (${formatDimsLongFirst(p.placedW, p.placedH)}${unitSymbol ? ` ${unitSymbol}` : ''})`;
          grouped[key] = (grouped[key] || 0) + 1;
        });
        const cutsLine = Object.entries(grouped)
          .map(([label, count]) => `${label} x${count}`)
          .join(' | ');

        visualSheet.addRow({
          sheetNo: idx + 1,
          pieces: safePlacements.length,
          raw: `${formatDimsLongFirst(sheets[0]?.raw_sheet_width, sheets[0]?.raw_sheet_length)} ${unitSymbol}`,
          cuts: cutsLine,
        });
      });

      visualSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      visualSheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF0D4A51' },
      };

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fileName = sanitizeFileName(`cut_optimiser_table_${cutOptimiserId}_${new Date().toISOString().split('T')[0]}`);
      downloadBlob(blob, `${fileName}.xlsx`);
    };

    const handleSaveNewCutSize = async () => {
     if (!recordId) {
       alert('Please save the Cut Optimiser record first.');
       return;
     }

     if (!newCutSizeForm.width || !newCutSizeForm.length) {
       alert('Width and Length are required.');
       return;
     }

     // Validate cut size dimensions against raw sheet dimensions
     const rawW = parseFloat(sheets[0]?.raw_sheet_width || 0);
     const rawH = parseFloat(sheets[0]?.raw_sheet_length || 0);
     const cutLength = parseFloat(newCutSizeForm.length);
     const cutWidth = parseFloat(newCutSizeForm.width);

     if (!canFitInRawSheet(cutLength, cutWidth, rawH, rawW)) {
       alert(`Cut size dimensions (${cutWidth} x ${cutLength}) are bigger than raw sheet size (${rawW} x ${rawH}), even after rotation. Please adjust the cut size or raw sheet dimensions.`);
       return;
     }

     // Duplicate name check (case-insensitive) within this optimiser record
     const newName = (newCutSizeForm.name || '').trim().toLowerCase();
     const isDuplicate = cutSizes.some(cs => (cs.name || '').trim().toLowerCase() === newName);
     if (isDuplicate) {
       alert(`A cut size named "${newCutSizeForm.name.trim() || '(blank)'}" already exists in this record. Please use a unique name.`);
       return;
     }

     setSavingCutSizeId('new');
     try {
       const res = await fetch(`/api/cut-optimiser/${recordId}/cut-sizes/`, {
         method: 'POST',
         credentials: 'include',
         headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
         body: JSON.stringify(newCutSizeForm)
       });
       if (!res.ok) {
         alert('Failed to create cut size');
         return;
       }

       await loadCutSizes(recordId);
       // Keep one fresh row available so users can add multiple cuts continuously.
       setIsAddingNew(true);
       setNewCutSizeForm({ name: '', width: '', length: '', quantity: '1' });
     } catch (err) {
       alert('Error saving cut size: ' + err.message);
     } finally {
       setSavingCutSizeId(null);
     }
   };

  const handleEditCutSize = (cutSize) => {
    setEditingCutSizeId(cutSize.id);
    setEditCutSizeForm({
      name: cutSize.name || '',
      width: cutSize.width || '',
      length: cutSize.length || '',
      quantity: String(cutSize.quantity || '1')
    });
  };

  const handleSaveEditCutSize = async (cutSizeId) => {
    if (!recordId) {
      alert('Please save the Cut Optimiser record first.');
      return;
    }

    if (!editCutSizeForm.width || !editCutSizeForm.length) {
      alert('Width and Length are required.');
      return;
    }

    const rawW = parseFloat(sheets[0]?.raw_sheet_width || 0);
    const rawH = parseFloat(sheets[0]?.raw_sheet_length || 0);
    if (!canFitInRawSheet(editCutSizeForm.length, editCutSizeForm.width, rawH, rawW)) {
      alert(`Cut size dimensions (${editCutSizeForm.width} x ${editCutSizeForm.length}) are bigger than raw sheet size (${rawW} x ${rawH}), even after rotation. Please adjust the cut size or raw sheet dimensions.`);
      return;
    }

    // Duplicate name check (case-insensitive), excluding the row being edited
    const editName = (editCutSizeForm.name || '').trim().toLowerCase();
    const isDuplicate = cutSizes.some(cs => cs.id !== cutSizeId && (cs.name || '').trim().toLowerCase() === editName);
    if (isDuplicate) {
      alert(`A cut size named "${editCutSizeForm.name.trim() || '(blank)'}" already exists in this record. Please use a unique name.`);
      return;
    }

    setSavingCutSizeId(cutSizeId);
    try {
      const res = await fetch(`/api/cut-optimiser/${recordId}/cut-sizes/${cutSizeId}/`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': getCookie('csrftoken') },
        body: JSON.stringify(editCutSizeForm)
      });
      if (!res.ok) {
        alert('Failed to update cut size');
        return;
      }

      await loadCutSizes(recordId);
      setEditingCutSizeId(null);
      setEditCutSizeForm({ name: '', width: '', length: '', quantity: '1' });
    } catch (err) {
      alert('Error updating cut size: ' + err.message);
    } finally {
      setSavingCutSizeId(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingCutSizeId(null);
    setEditCutSizeForm({ name: '', width: '', length: '', quantity: '1' });
  };

  const handleDeleteCutSize = async (cutSizeId) => {
    if (!window.confirm('Are you sure you want to delete this cut size?')) return;
    if (!recordId) return;

    try {
      const res = await fetch(`/api/cut-optimiser/${recordId}/cut-sizes/${cutSizeId}/`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'X-CSRFToken': getCookie('csrftoken') }
      });
      if (!res.ok) {
        alert('Failed to delete cut size');
        return;
      }
      await loadCutSizes(recordId);
    } catch (err) {
      alert('Error deleting cut size: ' + err.message);
    }
  };

  function getCookie(name) {
    const cookieString = `; ${document.cookie}`;
    const parts = cookieString.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return '';
  }

  // Submit handler (save to backend)
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    let revisionToTry = revision;

    try {
      const saveWithRetry = async () => {
        while (true) {
          try {
            const saved = await saveRecord(revisionToTry, cutOptimiserId);
            setRevision(saved.revision);
            if (!isEdit && saved.cutOptimiserId) {
              setCutOptimiserId(saved.cutOptimiserId);
            }
            setSuccess(isEdit ? 'Record updated successfully!' : 'Record created successfully!');
            if (!isEdit && saved.dbId) {
              setTimeout(() => {
                navigate(`/projects/cut-optimiser/record/${saved.dbId}`);
              }, 500);
            }
            return;
          } catch (err) {
            if (isDuplicateRevisionError(err)) {
              const latestRev = await getLatestRevisionForProject(projectId);
              const nextRevision = incrementRevision(latestRev);
              const confirmed = window.confirm(
                  `A record already exists for this project.\n\nDo you want to create a new record with Revision ${nextRevision}?`
              );

              if (!confirmed) {
                return;
              }

              revisionToTry = nextRevision;
              setRevision(nextRevision);
              continue;
            }

            let msg = 'Failed to save record';
            if (err && err.payload) {
              if (typeof err.payload === 'object') {
                msg += ': ' + JSON.stringify(err.payload);
              } else {
                msg += ': ' + String(err.payload);
              }
            } else if (err && err.message) {
              msg += ': ' + err.message;
            }
            setError(msg);
            // eslint-disable-next-line no-console
            console.error('Backend error:', err);
            return;
          }
        }
      };

      await saveWithRetry();
    } finally {
      setSaving(false);
    }
  };

  const renderResultsSection = () => {
    if (!calcResults) return null;

    return (
      <div id="cut-optimiser-results" style={{ marginTop: 0 }}>
        <h2 style={{ marginBottom: 8 }}>
          Results
          <button
            type="button"
            onClick={() => setCalcResults(null)}
            style={{ marginLeft: 16, fontSize: '0.8rem', padding: '2px 10px', cursor: 'pointer', borderRadius: 4, border: '1px solid #ccc', background: '#fff', color: '#555' }}
          >✕ Clear</button>
        </h2>
        <p style={{ marginBottom: 16, color: '#444' }}>
          <b>{calcResults.bins.length}</b> raw sheet{calcResults.bins.length !== 1 ? 's' : ''} required for{' '}
          <b>{cutSizes.reduce((s, cs) => s + (parseInt(cs.quantity, 10) || 1), 0)}</b> pieces across{' '}
          <b>{cutSizes.length}</b> cut size{cutSizes.length !== 1 ? 's' : ''}.
        </p>

        {/* Summary Section */}
        {(() => {
          const unitObj = unitOptions.find(u => u.value === sheets[0]?.dimension_unit);
          const unitSymbol = unitObj?.symbol || '';
          const [panelAreaM2, panelAreaFt2] = convertAreaToStandard(calcResults.totalPanelArea, unitSymbol);
          const [sheetAreaM2, sheetAreaFt2] = convertAreaToStandard(calcResults.totalSheetArea, unitSymbol);
          const [wasteAreaM2, wasteAreaFt2] = convertAreaToStandard(calcResults.totalWaste, unitSymbol);

          return (
            <div style={{ backgroundColor: '#124b56', color: '#f2fbff', border: '1px solid #1f6a78', padding: '12px', borderRadius: '6px', marginBottom: '20px', fontSize: '0.95rem', lineHeight: '1.6' }}>
              <div style={{ marginBottom: 8 }}>
                <strong>Best Option:</strong> {sheets[0]?.raw_sheet_name || 'Raw Sheet'} ({formatDimsLongFirst(sheets[0]?.raw_sheet_width, sheets[0]?.raw_sheet_length)} {unitSymbol}) - {calcResults.totalSheets} sheet{calcResults.totalSheets !== 1 ? 's' : ''}
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Dimension Unit:</strong> {unitSymbol} | <strong>Kerf:</strong> {Number(calcResults.kerfMm || 0).toFixed(3)} mm ({Number(calcResults.kerfInSheetUnit || calcResults.kerf || 0).toFixed(4)} {unitSymbol})
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Panel Area:</strong> {panelAreaM2.toFixed(3)} m² ({panelAreaFt2.toFixed(2)} ft²)
              </div>
              <div style={{ marginBottom: 8 }}>
                <strong>Sheet Area:</strong> {sheetAreaM2.toFixed(3)} m² ({sheetAreaFt2.toFixed(2)} ft²)
              </div>
              <div>
                <strong>Waste:</strong> {wasteAreaM2.toFixed(3)} m² ({wasteAreaFt2.toFixed(2)} ft²) | <strong>Yield:</strong> {calcResults.yieldPercent.toFixed(1)}%
              </div>
            </div>
          );
        })()}

        {/* PDF/Excel Download */}
        <div style={{ marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="modal-btn modal-btn--save"
            onClick={generatePDFReport}
            style={{ padding: '8px 16px', fontSize: '0.9rem' }}
          >
            Download PDF Report
          </button>
          <button
            type="button"
            className="modal-btn"
            onClick={downloadExcelReport}
            style={{ padding: '8px 16px', fontSize: '0.9rem' }}
          >
            Download Excel Report
          </button>
        </div>

        {/* Cut table similar to reference report */}
        {(() => {
          const rows = buildCutReportRows(
            cutSizes,
            calcResults.bins,
            parseFloat(sheets[0]?.raw_sheet_length),
            parseFloat(sheets[0]?.raw_sheet_width),
          );
          const unitObj = unitOptions.find(u => u.value === sheets[0]?.dimension_unit);
          const unitSymbol = unitObj?.symbol || '';
          return (
            <div className="users-table-wrap" style={{ marginBottom: 18 }}>
              <table className="users-table">
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
                  {rows.map(row => (
                    <tr key={`report-row-${row.no}-${row.name}`}>
                      <td>{row.no}</td>
                      <td>{row.name}</td>
                      <td>{row.size} {unitSymbol}</td>
                      <td>{row.qty}</td>
                      <td>{row.perSheet}</td>
                      <td>{row.sheets}</td>
                      <td>{row.bestFit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* Legend */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.2rem', marginBottom: 20 }}>
          {cutSizes.map(cs => (
            <div key={cs.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 3, background: calcResults.colorMap[cs.id], border: '1px solid #333' }} />
              <span style={{ fontSize: '0.88rem' }}>
                <b>{cs.name || '—'}</b> ({formatDimsLongFirst(cs.width, cs.length)}) × {cs.quantity || 1}
              </span>
            </div>
          ))}
        </div>

        <h3 style={{ margin: '8px 0 10px 0' }}>Visual View ({sheets[0]?.raw_sheet_name || 'Sheet A'})</h3>
        {/* Per-sheet SVG */}
        {calcResults.bins.map((bin, idx) => {
          const unitObj = unitOptions.find(u => u.value === sheets[0]?.dimension_unit);
          return (
            <SheetSVG
              key={idx}
              sheetNum={idx + 1}
              placements={bin.placements}
              rawW={parseFloat(sheets[0]?.raw_sheet_length)}
              rawH={parseFloat(sheets[0]?.raw_sheet_width)}
              unitLabel={unitObj?.symbol || ''}
              kerfThickness={calcResults.kerfInSheetUnit || calcResults.kerf || 0}
            />
          );
        })}
      </div>
    );
  };

  return (
      <section className="module-page cut-sheet-optimiser-page">
        <div className="crud-page__header" style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 className="module-page__title" style={{ margin: 0 }}>CutSheet Optimiser</h1>
          <button
              type="button"
              className="crud-add-btn"
              style={{ minWidth: 0, padding: '0.5rem 1.5rem', fontSize: '1rem', fontWeight: 500, background: '#1ccfc9', color: '#fff', border: 'none', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'none', cursor: 'pointer' }}
              onClick={() => navigate('/projects/cut-optimiser')}
          >
            Back to List
          </button>
        </div>
        <p className="module-page__description" style={{ marginBottom: '0.9rem' }}>
        </p>
        {loadingRecord ? (
            <div style={{ textAlign: 'center', padding: '2rem' }}>Loading...</div>
        ) : (
            <form onSubmit={handleSubmit}>
              <h2>Project Details</h2>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <label>Project Name:<br />
                    <select className="auth-input" value={projectId} onChange={e => setProjectId(e.target.value)} required disabled={loadingProjects}>
                      <option value="" disabled>Select Project</option>
                      {projectOptions.map(opt => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <div style={{ flex: 1, minWidth: 120 }}>
                  <label>Revision:<br />
                    <input className="auth-input" type="text" value={revision} disabled />
                  </label>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label>Cut Optimiser ID:<br />
                    <input className="auth-input" type="text" value={cutOptimiserId} disabled placeholder="(auto-generated on save)" />
                  </label>
                </div>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <label>Updated By:<br />
                    <input className="auth-input" type="text" value={currentUser?.username} disabled />
                  </label>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', alignItems: 'start' }}>
                <div>
                  <h2>Sheet Details</h2>
                  {loadingUnits ? <p className="users-status">Loading units...</p> : null}
                  <div className="users-table-wrap" style={{ maxWidth: 900, marginBottom: 16 }}>
                    <table className="users-table">
                     <thead>
                     <tr>
                       <th>Name</th>
                       <th>Length</th>
                       <th>Width</th>
                       <th>Unit</th>
                       <th>Kerf (Blade Thickness)</th>
                       <th></th>
                     </tr>
                     </thead>
                    <tbody>
                    {sheets.map((sheet, idx) => (
                        <tr key={idx}>
                          <td>
                            <input className="auth-input" type="text" value={sheet.raw_sheet_name} onChange={e => handleSheetChange(idx, 'raw_sheet_name', e.target.value)} required />
                          </td>
                          <td>
                            <input className="auth-input" type="number" value={sheet.raw_sheet_length} onChange={e => handleSheetChange(idx, 'raw_sheet_length', e.target.value)} required min={0} />
                          </td>
                          <td>
                            <input className="auth-input" type="number" value={sheet.raw_sheet_width} onChange={e => handleSheetChange(idx, 'raw_sheet_width', e.target.value)} required min={0} />
                          </td>
                           <td>
                             <select className="auth-input" value={sheet.dimension_unit} onChange={e => handleSheetChange(idx, 'dimension_unit', e.target.value)} required>
                               <option value="" disabled>Select</option>
                               {unitOptions.map(opt => (
                                   <option key={opt.value} value={opt.value}>{opt.label}</option>
                               ))}
                             </select>
                           </td>
                           <td>
                             <input className="auth-input" type="number" value={sheet.raw_sheet_blade_thk} onChange={e => handleSheetChange(idx, 'raw_sheet_blade_thk', e.target.value)} min={0} step="0.01" />
                           </td>
                           <td>
                            {sheets.length > 1 && (
                                <button type="button" className="users-action users-action--delete" aria-label="Remove Sheet" title="Remove Sheet" onClick={() => removeSheet(idx)} style={{ marginLeft: 4 }}>Remove</button>
                            )}
                          </td>
                        </tr>
                    ))}
                    </tbody>
                    </table>
                  </div>

                  {/* Removed '+ Add Another Sheet' button as per request */}

                  <div style={{ marginTop: 24, marginBottom: 18 }}>
                    <button type="submit" className="modal-btn modal-btn--save" disabled={saving || loadingUnits}>
                      {saving ? 'Saving...' : (isEdit ? 'Update' : 'Save')}
                    </button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: 0 }}>
                    <h2 style={{ margin: 0 }}>Cut Sizes</h2>
                    {cutOptimiserId && (
                      <>
                        <button
                            type="button"
                            className="modal-btn"
                            onClick={handleAddNewRow}
                            disabled={loadingCutSizes || isAddingNew}
                        >
                          + Add Cut Size
                        </button>
                        <button
                            type="button"
                            className="modal-btn modal-btn--save"
                            onClick={handleCalculate}
                            disabled={loadingCutSizes || cutSizes.length === 0}
                        >
                          Calculate
                        </button>
                      </>
                    )}
                  </div>
                  {loadingCutSizes && <p className="users-status">Loading cut sizes...</p>}

                  {(cutSizes.length > 0 || isAddingNew) ? (
                      <div className="users-table-wrap" style={{ maxWidth: 900, marginBottom: 16 }}>
                        <table className="users-table">
                          <thead>
                          <tr>
                            <th>Name</th>
                            <th>Length</th>
                            <th>Width</th>
                            <th>Quantity</th>
                            <th>Actions</th>
                          </tr>
                          </thead>
                          <tbody>
                          {isAddingNew && (
                              <tr style={{ backgroundColor: '#f0f0f0' }}>
                                <td>
                                  <input
                                      className="auth-input"
                                      type="text"
                                      value={newCutSizeForm.name}
                                      onChange={(e) => setNewCutSizeForm({ ...newCutSizeForm, name: e.target.value })}
                                      placeholder="Cut name"
                                  />
                                </td>
                                <td>
                                  <input
                                      className="auth-input"
                                      type="number"
                                      value={newCutSizeForm.length}
                                      onChange={(e) => setNewCutSizeForm({ ...newCutSizeForm, length: e.target.value })}
                                      placeholder="0"
                                      min={0}
                                      step="0.01"
                                  />
                                </td>
                                <td>
                                  <input
                                      className="auth-input"
                                      type="number"
                                      value={newCutSizeForm.width}
                                      onChange={(e) => setNewCutSizeForm({ ...newCutSizeForm, width: e.target.value })}
                                      placeholder="0"
                                      min={0}
                                      step="0.01"
                                  />
                                </td>
                                <td>
                                  <input
                                      className="auth-input"
                                      type="number"
                                      value={newCutSizeForm.quantity}
                                      onChange={(e) => setNewCutSizeForm({ ...newCutSizeForm, quantity: e.target.value })}
                                      placeholder="1"
                                      min={1}
                                      step="1"
                                  />
                                </td>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'nowrap' }}>
                                    <button
                                        type="button"
                                        className="users-action users-action--edit"
                                        onClick={handleSaveNewCutSize}
                                        disabled={savingCutSizeId === 'new'}
                                        title="Save"
                                        aria-label="Save"
                                    >
                                      {savingCutSizeId === 'new' ? 'Saving...' : <BsSave aria-hidden="true" />}
                                    </button>
                                    <button
                                        type="button"
                                        className="users-action users-action--delete"
                                        onClick={() => setIsAddingNew(false)}
                                        disabled={savingCutSizeId === 'new'}
                                        title="Cancel"
                                        aria-label="Cancel"
                                    >
                                      <BsX aria-hidden="true" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                          )}

                          {cutSizes.map((cutSize) => (
                              <tr key={cutSize.id} style={editingCutSizeId === cutSize.id ? { backgroundColor: '#f0f0f0' } : {}}>
                                <td>
                                  {editingCutSizeId === cutSize.id ? (
                                      <input
                                          className="auth-input"
                                          type="text"
                                          value={editCutSizeForm.name}
                                          onChange={(e) => setEditCutSizeForm({ ...editCutSizeForm, name: e.target.value })}
                                      />
                                  ) : (
                                      cutSize.name
                                  )}
                                </td>
                                <td>
                                  {editingCutSizeId === cutSize.id ? (
                                      <input
                                          className="auth-input"
                                          type="number"
                                          value={editCutSizeForm.length}
                                          onChange={(e) => setEditCutSizeForm({ ...editCutSizeForm, length: e.target.value })}
                                          min={0}
                                          step="0.01"
                                      />
                                  ) : (
                                      cutSize.length
                                  )}
                                </td>
                                <td>
                                  {editingCutSizeId === cutSize.id ? (
                                      <input
                                          className="auth-input"
                                          type="number"
                                          value={editCutSizeForm.width}
                                          onChange={(e) => setEditCutSizeForm({ ...editCutSizeForm, width: e.target.value })}
                                          min={0}
                                          step="0.01"
                                      />
                                  ) : (
                                      cutSize.width
                                  )}
                                </td>
                                <td>
                                  {editingCutSizeId === cutSize.id ? (
                                      <input
                                          className="auth-input"
                                          type="number"
                                          value={editCutSizeForm.quantity}
                                          onChange={(e) => setEditCutSizeForm({ ...editCutSizeForm, quantity: e.target.value })}
                                          min={1}
                                          step="1"
                                      />
                                  ) : (
                                      cutSize.quantity
                                  )}
                                </td>
                                <td style={{ whiteSpace: 'nowrap' }}>
                                  {editingCutSizeId === cutSize.id ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'nowrap' }}>
                                        <button
                                            type="button"
                                            className="modal-btn modal-btn--save"
                                            onClick={() => handleSaveEditCutSize(cutSize.id)}
                                            disabled={savingCutSizeId === cutSize.id}
                                        >
                                          {savingCutSizeId === cutSize.id ? 'Saving...' : <BsSave aria-hidden="true" />}
                                        </button>
                                        <button
                                            type="button"
                                            className="modal-btn modal-btn--cancel"
                                            onClick={handleCancelEdit}
                                            disabled={savingCutSizeId === cutSize.id}
                                        >
                                          <BsX aria-hidden="true" />
                                        </button>
                                      </div>
                                  ) : (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'nowrap' }}>
                                        <button
                                            type="button"
                                            className="users-action users-action--edit"
                                            title="Edit"
                                            aria-label="Edit"
                                            onClick={() => handleEditCutSize(cutSize)}
                                        >
                                          <BsPencilSquare aria-hidden="true" />
                                        </button>
                                        <button
                                            type="button"
                                            className="users-action users-action--delete"
                                            title="Delete"
                                            aria-label="Delete"
                                            onClick={() => handleDeleteCutSize(cutSize.id)}
                                        >
                                          <BsTrashFill aria-hidden="true" />
                                        </button>
                                      </div>
                                  )}
                                </td>
                              </tr>
                          ))}
                          </tbody>
                        </table>
                      </div>
                  ) : (
                      !loadingCutSizes && cutOptimiserId && (
                          <p className="users-status" style={{ marginBottom: 16 }}>No cut sizes added yet. Click "Add Cut Size" to add one.</p>
                      )
                  )}


                </div>

                <div>
                  {calcResults ? (
                    renderResultsSection()
                  ) : (
                    <div className="users-status" style={{ marginTop: 42 }}>
                      Enter sheet and cut size details, then click <b>Calculate</b> to view results.
                    </div>
                  )}
                </div>

              </div>

              {success && <p className="users-status users-status--success">{success}</p>}
              {error && <p className="users-status users-status--error">{error}</p>}
            </form>
          )}
      </section>
  );
};

export default CutSheetOptimiser;
