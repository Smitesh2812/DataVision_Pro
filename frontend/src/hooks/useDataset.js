// hooks/useDataset.js  — v2
// BUG FIX: cleanData is now PERSISTENT across view switches.
// Cleaning no longer asks you to reload — the cleaned state stays
// even when navigating to charts/table/insights and back.

import { useState, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { api } from '../context/AuthContext';

// ─── MATH HELPERS ────────────────────────────────────────────
export function safeMax(arr) {
  if (!arr || !arr.length) return 0;
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] > m) m = arr[i];
  return m;
}
export function safeMin(arr) {
  if (!arr || !arr.length) return 0;
  let m = arr[0];
  for (let i = 1; i < arr.length; i++) if (arr[i] < m) m = arr[i];
  return m;
}
export function mean(arr) {
  if (!arr || !arr.length) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}
export function stddev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  return Math.sqrt(arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length);
}
export function pearson(a, b) {
  const n = Math.min(a.length, b.length);
  if (!n) return 0;
  const ma = mean(a.slice(0, n)), mb = mean(b.slice(0, n));
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    const ai = a[i] - ma, bi = b[i] - mb;
    num += ai * bi; da += ai * ai; db += bi * bi;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}
export function formatN(n) {
  if (n == null || isNaN(n)) return '—';
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return Number.isInteger(n) ? n.toLocaleString() : n.toFixed(2);
}

export function detectNumericCols(data, columns) {
  return columns.filter(c => data.some(r => typeof r[c] === 'number' && !isNaN(r[c])));
}
export function detectCatCols(data, columns) {
  const nc = detectNumericCols(data, columns);
  return columns.filter(c => !nc.includes(c));
}
export function detectDateCols(columns) {
  return columns.filter(c => /date|time|month|year|period|day/i.test(c));
}

// ─── CLEANING HISTORY (for undo) ─────────────────────────────
// Each entry: { label, snapshot }
// We keep the last 10 states so user can undo up to 10 steps.
const MAX_HISTORY = 10;

export default function useDataset() {
  // ── Core data state ──────────────────────────────────────────
  // cleanData is the LIVE working copy.
  // originalData is the untouched snapshot from the file upload.
  // history allows multi-step undo.
  const [cleanData,    setCleanData]    = useState([]);
  const [originalData, setOriginalData] = useState([]);
  const [columns,      setColumns]      = useState([]);
  const [fileName,     setFileName]     = useState('');
  const [fileSize,     setFileSize]     = useState(0);
  const [selectedCols, setSelectedCols] = useState([]);
  const [loading,      setLoading]      = useState(false);
  const [savedDatasetId, setSavedDatasetId] = useState(null);

  // ── Cleaning history for undo ─────────────────────────────
  const [cleanHistory,  setCleanHistory]  = useState([]); // [{label, data}]
  const [cleanLog,      setCleanLog]      = useState([]); // human-readable log of ops

  // ── LOAD DATA (called after file parse) ──────────────────────
  // FIX: We set BOTH cleanData and originalData here.
  // Cleaning later only mutates cleanData — originalData never changes.
  const loadData = useCallback((data, name, size = 0) => {
    if (!data || !data.length) { toast.error('No data found in file'); return; }

    const normalized = data.map(row => {
      const o = {};
      Object.keys(row).forEach(k => { o[k.trim()] = row[k]; });
      return o;
    });

    const cols  = Object.keys(normalized[0]);
    const nc    = detectNumericCols(normalized, cols);
    const cc    = detectCatCols(normalized, cols);
    const autoSel = [...nc.slice(0, 8), ...cc.slice(0, 3)].slice(0, 11);

    // Deep copy so original and clean are independent objects in memory
    const fresh = JSON.parse(JSON.stringify(normalized));

    setCleanData(fresh);
    setOriginalData(JSON.parse(JSON.stringify(normalized)));
    setColumns(cols);
    setSelectedCols(autoSel);
    setFileName(name);
    setFileSize(size);
    setSavedDatasetId(null);
    setCleanHistory([]);
    setCleanLog([]);

    toast.success(`Loaded ${normalized.length.toLocaleString()} rows · ${cols.length} columns`);

    // Save metadata to backend
    const colMeta = cols.map(c => ({
      name: c,
      type: nc.includes(c) ? 'numeric' : detectDateCols([c]).length ? 'date' : 'text',
    }));
    api.post('/datasets', {
      name, originalFilename: name,
      fileType: name.split('.').pop().toLowerCase(),
      rowCount: normalized.length, colCount: cols.length,
      fileSize: size, columnsJson: JSON.stringify(colMeta),
    }).then(res => setSavedDatasetId(res.data.dataset?.id)).catch(() => {});
  }, []);

  // ── FILE PARSERS ─────────────────────────────────────────────
  const parseFile = useCallback((file) => {
    setLoading(true);
    const ext = file.name.split('.').pop().toLowerCase();
    if (['csv','tsv','txt'].includes(ext)) {
      Papa.parse(file, {
        header: true, skipEmptyLines: true, dynamicTyping: true,
        complete: r => { loadData(r.data, file.name, file.size); setLoading(false); },
        error: e => { toast.error('CSV error: ' + e); setLoading(false); },
      });
    } else if (['xlsx','xls'].includes(ext)) {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const wb   = XLSX.read(e.target.result, { type: 'array' });
          const data = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: null });
          loadData(data, file.name, file.size);
        } catch (err) { toast.error('Excel error: ' + err.message); }
        finally { setLoading(false); }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'json') {
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const json = JSON.parse(e.target.result);
          loadData(Array.isArray(json) ? json : [json], file.name, file.size);
        } catch (err) { toast.error('JSON error: ' + err.message); }
        finally { setLoading(false); }
      };
      reader.readAsText(file);
    } else {
      toast.error('Unsupported file type: .' + ext);
      setLoading(false);
    }
  }, [loadData]);

  // ── COLUMN TOGGLE ────────────────────────────────────────────
  const toggleCol  = useCallback((col) => {
    setSelectedCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
  }, []);
  const selectAll  = useCallback(() => setSelectedCols([...columns]), [columns]);
  const selectNone = useCallback(() => setSelectedCols([]), []);

  // ── APPLY CLEANING OPERATIONS ────────────────────────────────
  // KEY FIX: after applying, we call setCleanData(d) which is a
  // React state setter. React re-renders the whole tree with the
  // new data — charts, table, and insights all auto-update because
  // they all read from cleanData. No file reload needed.
  const applyCleanOps = useCallback((ops, label = '') => {
    // Save current state to undo history before mutating
    setCleanHistory(prev => {
      const next = [...prev, { label: label || [...ops].join(', '), data: JSON.parse(JSON.stringify(cleanData)) }];
      return next.slice(-MAX_HISTORY); // keep last 10
    });

    let d = JSON.parse(JSON.stringify(cleanData)); // deep copy — never mutate state directly
    let removed = 0;
    const nc = detectNumericCols(d, columns);
    const opLog = [];

    if (ops.has('remove_nulls')) {
      const before = d.length;
      d = d.filter(r => columns.every(c => r[c] != null && r[c] !== ''));
      const gone = before - d.length;
      removed += gone;
      if (gone) opLog.push(`Removed ${gone} null rows`);
    }
    if (ops.has('fill_nulls_0')) {
      d = d.map(r => { const n = {}; columns.forEach(c => n[c] = r[c] ?? 0); return n; });
      opLog.push('Filled nulls with 0');
    }
    if (ops.has('fill_nulls_mean')) {
      nc.forEach(c => {
        const vals = d.map(r => r[c]).filter(v => v != null && !isNaN(v));
        const m = mean(vals);
        d = d.map(r => ({ ...r, [c]: r[c] ?? +m.toFixed(4) }));
      });
      opLog.push('Filled nulls with column mean');
    }
    if (ops.has('trim_strings')) {
      d = d.map(r => { const n = {}; columns.forEach(c => n[c] = typeof r[c] === 'string' ? r[c].trim() : r[c]); return n; });
      opLog.push('Trimmed whitespace');
    }
    if (ops.has('remove_dupes')) {
      const before = d.length;
      const seen = new Set();
      d = d.filter(r => { const k = JSON.stringify(r); if (seen.has(k)) return false; seen.add(k); return true; });
      const gone = before - d.length;
      removed += gone;
      if (gone) opLog.push(`Removed ${gone} duplicate rows`);
      else opLog.push('No duplicates found');
    }
    if (ops.has('standardize_case')) {
      d = d.map(r => { const n = {}; columns.forEach(c => n[c] = typeof r[c] === 'string' ? r[c].replace(/\b\w/g, l => l.toUpperCase()) : r[c]); return n; });
      opLog.push('Standardized text case');
    }
    if (ops.has('remove_outliers')) {
      const before = d.length;
      nc.forEach(c => {
        const vals = d.map(r => r[c]).filter(v => v != null && !isNaN(v));
        const m = mean(vals), sd = stddev(vals);
        d = d.filter(r => r[c] == null || Math.abs(r[c] - m) <= 3 * sd);
      });
      const gone = before - d.length;
      removed += gone;
      if (gone) opLog.push(`Removed ${gone} outlier rows`);
    }
    if (ops.has('normalize')) {
      nc.forEach(c => {
        const vals = d.map(r => r[c]).filter(v => v != null && !isNaN(v));
        const mn = safeMin(vals), mx = safeMax(vals), rng = mx - mn || 1;
        d = d.map(r => ({ ...r, [c]: r[c] == null ? null : +((r[c] - mn) / rng).toFixed(6) }));
      });
      opLog.push('Normalized numeric columns 0-1');
    }

    // ── THE FIX: update state with cleaned data ──
    // This triggers a re-render and ALL views (charts, table, insights)
    // automatically show the cleaned data because they all read cleanData.
    setCleanData(d);
    setCleanLog(prev => [...prev, ...opLog]);

    toast.success(
      `✓ ${opLog.join(' · ')}${removed ? ` · ${removed} rows removed` : ''} · ${d.length.toLocaleString()} rows remain`
    );
    return d;
  }, [cleanData, columns]);

  // ── UNDO LAST CLEAN ──────────────────────────────────────────
  const undoClean = useCallback(() => {
    if (!cleanHistory.length) { toast('Nothing to undo', { icon: '↺' }); return; }
    const prev = cleanHistory[cleanHistory.length - 1];
    setCleanData(prev.data);
    setCleanHistory(h => h.slice(0, -1));
    setCleanLog(l => l.slice(0, -1));
    toast(`Undone: ${prev.label}`, { icon: '↺' });
  }, [cleanHistory]);

  // ── RESET TO ORIGINAL ────────────────────────────────────────
  const resetData = useCallback(() => {
    setCleanData(JSON.parse(JSON.stringify(originalData)));
    setCleanHistory([]);
    setCleanLog([]);
    toast('Reset to original file data', { icon: '↺' });
  }, [originalData]);

  // ── EXPORT ───────────────────────────────────────────────────
  const exportCSV = useCallback(() => {
    if (!cleanData.length) { toast.error('No data to export'); return; }
    const csv  = Papa.unparse(cleanData);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = (fileName.replace(/\.[^.]+$/, '') || 'export') + '_cleaned.csv';
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${cleanData.length.toLocaleString()} rows`);
  }, [cleanData, fileName]);

  // ── COMPUTED (recalculate whenever cleanData changes) ─────────
  const numericCols = detectNumericCols(cleanData, columns);
  const catCols     = detectCatCols(cleanData, columns);
  const dateCols    = detectDateCols(columns);
  const nullCount   = cleanData.reduce((a, r) =>
    a + columns.filter(c => r[c] == null || r[c] === '').length, 0);
  const quality = columns.length && cleanData.length
    ? Math.round((1 - nullCount / (cleanData.length * columns.length)) * 100)
    : 100;
  const isDirty = cleanData.length !== originalData.length ||
    JSON.stringify(cleanData[0]) !== JSON.stringify(originalData[0]);

  return {
    cleanData, originalData, columns, fileName, fileSize,
    selectedCols, setSelectedCols, loading,
    numericCols, catCols, dateCols, nullCount, quality,
    isDirty, cleanHistory, cleanLog,
    savedDatasetId,
    parseFile, loadData, toggleCol, selectAll, selectNone,
    applyCleanOps, undoClean, resetData, exportCSV,
  };
}
