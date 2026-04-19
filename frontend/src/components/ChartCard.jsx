// components/ChartCard.jsx

import React, { useRef, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, RadialLinearScale,
  Title, Tooltip, Legend, Filler,
} from 'chart.js';
import { Bar, Line, Pie, Doughnut, Scatter, PolarArea, Radar, Bubble } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { formatN } from '../hooks/useDataset';

// ✅ Register ONCE
ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement,
  PointElement, ArcElement, RadialLinearScale,
  Title, Tooltip, Legend, Filler, ChartDataLabels
);

const CHART_COMPONENTS = {
  bar: Bar,
  line: Line,
  pie: Pie,
  doughnut: Doughnut,
  scatter: Scatter,
  polarArea: PolarArea,
  radar: Radar,
  bubble: Bubble
};

// -------------------------------
// 🎨 TOOLTIP STYLE
// -------------------------------
const TOOLTIP_BASE = {
  backgroundColor: '#1b1f30',
  borderColor: 'rgba(91,143,249,0.35)',
  borderWidth: 1,
  titleColor: '#eef0fa',
  bodyColor: '#8892b0',
  padding: 12,
  cornerRadius: 10,
  titleFont: { size: 12, weight: '700', family: "'Outfit'" },
  bodyFont: { size: 11, family: "'JetBrains Mono'" },
};

// -------------------------------
// ⚙️ OPTIONS BUILDER
// -------------------------------
export function buildOptions(type, cfg) {
  const isPie = ['pie', 'doughnut', 'polarArea'].includes(type);
  const isRadar = type === 'radar';
  const isScatter = type === 'scatter' || type === 'bubble';

  return {
    responsive: true,
    maintainAspectRatio: true,
    animation: cfg.animation ? { duration: 600 } : false,

    plugins: {
      legend: {
        display: cfg.legend && isPie,
        position: 'bottom',
        labels: {
          color: '#8892b0',
          font: { size: 11 },
        },
      },

      datalabels: {
        display: cfg.dataLabels,
        color: '#eef0fa',
        font: { size: 10, weight: '700' },
        formatter: v => typeof v === 'number' ? formatN(v) : v,
        anchor: isPie ? 'center' : 'end',
        align: isPie ? 'center' : 'top',
      },

      tooltip: {
        ...TOOLTIP_BASE,
        callbacks: {
          title: ctx => isScatter ? `X: ${ctx[0]?.parsed?.x}` : ctx[0]?.label,
          label: ctx => {
            const v = ctx.parsed?.y ?? ctx.parsed;
            return typeof v === 'number'
              ? `${ctx.dataset.label}: ${formatN(v)}`
              : `${ctx.dataset.label}: ${v}`;
          },
        },
      },
    },

    scales: isPie || isRadar ? {} : {
      x: {
        ticks: { color: '#4d5577' },
        grid: { display: cfg.grid },
      },
      y: {
        ticks: {
          color: '#4d5577',
          callback: v => formatN(v),
        },
        grid: { display: cfg.grid },
      },
    },
  };
}

// -------------------------------
// 📊 MAIN COMPONENT
// -------------------------------
export default function ChartCard({ def, cfg, fullWidth, onTypeChange, onToggleExpand }) {
  const chartRef = useRef(null);
  const [type, setType] = React.useState(def.type);

  const ChartComp = CHART_COMPONENTS[type] || Bar;
  const options = buildOptions(type, cfg);

  if (def.data.datasets?.length > 1) {
    options.plugins.legend.display = cfg.legend;
  }

  const handleTypeChange = (newType) => {
    setType(newType);
    onTypeChange?.(newType);
  };

  const downloadPNG = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const a = document.createElement('a');
    a.href = chart.toBase64Image();
    a.download = (def.title || 'chart') + '.png';
    a.click();
  }, [def.title]);

  return (
    <div style={{
      ...S.card,
      gridColumn: fullWidth ? '1 / -1' : undefined,
    }}>

      {/* Header */}
      <div style={S.head}>
        <div style={{ flex: 1 }}>
          <div style={S.title}>{def.title}</div>
          <div style={S.subtitle}>{def.subtitle}</div>
        </div>

        <div style={S.acts}>
          <select value={type} onChange={e => handleTypeChange(e.target.value)} style={S.typeSelect}>
            {Object.keys(CHART_COMPONENTS).map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          <button style={S.iconBtn} onClick={downloadPNG}>⬇</button>
          <button style={S.iconBtn} onClick={onToggleExpand}>⤢</button>
        </div>
      </div>

      {/* Stats */}
      {def.stats?.length > 0 && (
        <div style={S.statsStrip}>
          {def.stats.map((s, i) => (
            <div key={i} style={S.stat}>
              <span style={S.statLabel}>{s.label}: </span>
              <span style={S.statVal}>{s.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div style={S.body}>
        <ChartComp ref={chartRef} data={def.data} options={options} />
      </div>
    </div>
  );
}

// -------------------------------
// 🎨 STYLES
// -------------------------------
const S = {
  card: {
    background: '#1b1f30',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 18,
  },
  head: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px',
  },
  title: { fontSize: 13, color: '#eef0fa' },
  subtitle: { fontSize: 10, color: '#4d5577' },
  acts: { display: 'flex', gap: 5 },
  typeSelect: { fontSize: 10 },
  iconBtn: { cursor: 'pointer' },
  statsStrip: { display: 'flex', gap: 10, padding: '5px 10px' },
  stat: { fontSize: 10 },
  statLabel: { color: '#4d5577' },
  statVal: { fontWeight: 'bold' },
  body: { padding: 10 },
};