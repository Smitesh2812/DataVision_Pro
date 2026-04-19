// utils/buildChartDefs.js

import { mean, safeMax, safeMin, pearson, formatN, stddev } from '../hooks/useDataset';

// -------------------------------
// 🎨 COLOR PALETTES
// -------------------------------
export function getColors(palette) {
  const PALETTES = {
    vivid:   ['#5b8ff9','#34d399','#fbbf24','#fb7185','#7c6bf5','#2dd4bf','#f97316','#a78bfa'],
    google:  ['#4285F4','#34A853','#FBBC05','#EA4335','#46BDC6','#FF6D00','#A142F4','#00C853'],
    amazon:  ['#FF9900','#00A8E1','#67B346','#DF3312','#232F3E','#8C4FFF','#00B5AD','#F0A30A'],
    tableau: ['#4E79A7','#F28E2B','#E15759','#76B7B2','#59A14F','#EDC948','#B07AA1','#FF9DA7'],
  };
  return PALETTES[palette] || PALETTES.vivid;
}

// -------------------------------
// 🚀 MAIN FUNCTION
// -------------------------------
export default function buildChartDefs(
  cleanData,
  numericCols,
  catCols,
  selectedCols = [],
  cfg = {}
) {
  if (!cleanData.length) return [];

  const nc = numericCols.filter(c => selectedCols.includes(c));
  const cc = catCols.filter(c => selectedCols.includes(c));

  const C = getColors(cfg.palette);
  const defs = [];

  // -------------------------------
  // 🔥 1. X vs Y FEATURE (FIXED)
  // -------------------------------
  if (cfg.xCol && cfg.yCol) {
    const grouped = {};

    cleanData.forEach(row => {
      const x = row[cfg.xCol];
      const y = Number(row[cfg.yCol]);

      if (!x || isNaN(y)) return;

      if (!grouped[x]) grouped[x] = [];
      grouped[x].push(y);
    });

    const labels = Object.keys(grouped);

    const values = labels.map(label => {
      const arr = grouped[label];

      if (cfg.agg === "avg") {
        return mean(arr);
      }

      return arr.reduce((a, b) => a + b, 0);
    });

    defs.push({
      type: "bar",
      title: `${cfg.yCol} vs ${cfg.xCol}`,
      subtitle: `${cfg.agg || "sum"} aggregation`,
      data: {
        labels,
        datasets: [
          {
            label: `${(cfg.agg || "sum").toUpperCase()} of ${cfg.yCol}`,
            data: values,
            backgroundColor: C.map(c => c + "cc"),
            borderColor: C,
            borderWidth: 1.5,
            borderRadius: 8
          }
        ]
      }
    });
  }

  // -------------------------------
  // 📊 2. CATEGORY ANALYSIS
  // -------------------------------
  if (cc.length && nc.length) {
    const cat = cc[0];
    const num = nc[0];

    const sumMap = {}, cntMap = {};

    cleanData.forEach(r => {
      const v = String(r[cat] ?? '—');

      sumMap[v] = (sumMap[v] || 0) + (r[num] || 0);
      cntMap[v] = (cntMap[v] || 0) + 1;
    });

    const entries = Object.entries(sumMap).sort((a, b) => b[1] - a[1]).slice(0, 12);

    const labels = entries.map(e => e[0]);
    const avgVals = entries.map(e => e[1] / cntMap[e[0]]);
    const cntVals = entries.map(e => cntMap[e[0]]);

    defs.push({
      type: "bar",
      title: `Avg ${num} by ${cat}`,
      data: {
        labels,
        datasets: [{
          label: num,
          data: avgVals,
          backgroundColor: C.map(c => c + "cc"),
          borderColor: C
        }]
      }
    });

    defs.push({
      type: "doughnut",
      title: `${cat} Distribution`,
      data: {
        labels,
        datasets: [{
          data: cntVals,
          backgroundColor: C
        }]
      }
    });
  }

  // -------------------------------
  // 📈 3. LINE TREND
  // -------------------------------
  if (nc.length) {
    const col = nc[0];

    const values = cleanData
      .map(r => r[col])
      .filter(v => v != null && !isNaN(v));

    defs.push({
      type: "line",
      title: `${col} Trend`,
      data: {
        labels: values.map((_, i) => i + 1),
        datasets: [{
          label: col,
          data: values,
          borderColor: C[0],
          backgroundColor: C[0] + "22"
        }]
      }
    });
  }

  // -------------------------------
  // 🔥 4. SCATTER (CORRELATION)
  // -------------------------------
  if (nc.length >= 2) {
    const x = nc[0];
    const y = nc[1];

    const points = cleanData
      .filter(r => r[x] != null && r[y] != null)
      .slice(0, 300);

    const rVal = pearson(
      points.map(p => p[x]),
      points.map(p => p[y])
    );

    defs.push({
      type: "scatter",
      title: `${x} vs ${y}`,
      subtitle: `Correlation r = ${rVal.toFixed(3)}`,
      data: {
        datasets: [{
          label: `${x} vs ${y}`,
          data: points.map(p => ({ x: p[x], y: p[y] })),
          backgroundColor: C[0] + "88"
        }]
      }
    });
  }

  // -------------------------------
  // 📊 5. HISTOGRAM
  // -------------------------------
  nc.slice(0, 3).forEach((col, i) => {
    const vals = cleanData
      .map(r => r[col])
      .filter(v => v != null && !isNaN(v));

    if (!vals.length) return;

    const min = safeMin(vals);
    const max = safeMax(vals);
    const bins = 10;

    const hist = Array(bins).fill(0);

    vals.forEach(v => {
      const idx = Math.min(
        Math.floor(((v - min) / (max - min || 1)) * bins),
        bins - 1
      );
      hist[idx]++;
    });

    defs.push({
      type: "bar",
      title: `${col} Distribution`,
      data: {
        labels: hist.map((_, i) => `${i}`),
        datasets: [{
          label: col,
          data: hist,
          backgroundColor: C[i] + "aa"
        }]
      }
    });
  });

  return defs;
}