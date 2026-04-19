// ═══════════════════════════════════════════════════════════════
// DataVision Pro — Premium Analytics Dashboard
// Competes with Power BI & Tableau
// Design: Luxury dark theme, obsidian surfaces, electric accents
// Typography: Space Mono (data) + system-ui display
// ═══════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import useDataset, {
  detectNumericCols, detectCatCols,
  mean, safeMax, safeMin, pearson, stddev, formatN,
} from '../hooks/useDataset';
import ChartCard from '../components/ChartCard';
import buildChartDefs, { getColors } from '../utils/buildChartDefs';
import {
  detectActionableInsights, eli5Insight,
  generateStory, buildDecisionFeed,
  generateNextSteps, analyzeDataQuality,
  recordInteraction, getPersonalizedOrder, getUserStyleProfile,
} from '../utils/aiEngine';

// ─── Constants ────────────────────────────────────────────────
const PALETTES   = ['vivid','ocean','sunset','tableau','amazon','mono','google'];
const CHART_TYPES= [
  {id:'auto',icon:'✦',label:'Auto'},
  {id:'bar',icon:'▊',label:'Bar'},
  {id:'line',icon:'∿',label:'Line'},
  {id:'pie',icon:'◕',label:'Pie'},
  {id:'doughnut',icon:'◎',label:'Donut'},
  {id:'scatter',icon:'⁚',label:'Scatter'},
  {id:'polarArea',icon:'◉',label:'Polar'},
  {id:'radar',icon:'⬡',label:'Radar'},
];
const CLEAN_OPS = [
  {id:'remove_nulls',    icon:'⌫', title:'Remove null rows',   desc:'Delete rows with any missing values', tag:'NULLS'},
  {id:'fill_nulls_0',    icon:'∅', title:'Fill nulls → 0',     desc:'Replace missing numbers with zero', tag:'FILL'},
  {id:'fill_nulls_mean', icon:'x̄', title:'Fill nulls → mean',  desc:'Replace nulls with column average', tag:'SMART'},
  {id:'trim_strings',    icon:'⌁', title:'Trim whitespace',    desc:'Remove leading/trailing spaces', tag:'TEXT'},
  {id:'remove_dupes',    icon:'⊘', title:'Remove duplicates',  desc:'Drop repeated rows', tag:'DEDUP'},
  {id:'standardize_case',icon:'Aa',title:'Standardize case',   desc:'Convert text to Title Case', tag:'TEXT'},
  {id:'remove_outliers', icon:'σ', title:'Remove outliers',    desc:'Remove rows beyond ±3σ', tag:'STAT'},
  {id:'normalize',       icon:'↔', title:'Normalize 0→1',      desc:'Scale numeric columns 0–1', tag:'SCALE'},
];
const DEFAULT_CFG = {
  palette:'vivid', chartType:'auto', borderRadius:10, tension:4,
  pointSize:4, barWidth:0.75, sampleSize:150, dataLabels:false,
  grid:true, legend:true, animation:true, fill:false, stacked:false, layout:'g2',
};
const NAV_ITEMS = [
  {id:'charts',   label:'Dashboard', icon:'▤'},
  {id:'table',    label:'Explorer',  icon:'⊞'},
  {id:'clean',    label:'Studio',    icon:'◈'},
  {id:'insights', label:'AI Lens',   icon:'◑'},
];

// ─── Pill component ───────────────────────────────────────────
function Pill({ children, color = '#5b8ff9', small }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: small ? '2px 7px' : '3px 10px',
      borderRadius: 20, background: color + '18', border: `1px solid ${color}33`,
      color, fontSize: small ? 9 : 10, fontWeight: 700, letterSpacing: '.08em',
      textTransform: 'uppercase', fontFamily: 'Space Mono, monospace', whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

// ─── Icon button ──────────────────────────────────────────────
function IconBtn({ icon, label, onClick, active, danger }) {
  return (
    <button onClick={onClick} title={label} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px',
      borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
      border: `1px solid ${active ? '#5b8ff9' : danger ? 'rgba(239,68,68,.3)' : 'rgba(255,255,255,.07)'}`,
      background: active ? 'rgba(91,143,249,.12)' : danger ? 'rgba(239,68,68,.08)' : 'rgba(255,255,255,.03)',
      color: active ? '#5b8ff9' : danger ? '#ef4444' : '#8892b0',
      fontFamily: 'inherit', transition: 'all .18s', whiteSpace: 'nowrap',
    }}>{icon}{label && <span>{label}</span>}</button>
  );
}

// ─── KPI Sparkline (SVG mini trend) ──────────────────────────
function MiniSparkline({ vals, color }) {
  if (!vals || vals.length < 2) return null;
  const w = 72, h = 28;
  const mn = Math.min(...vals), mx = Math.max(...vals), range = mx - mn || 1;
  const pts = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - mn) / range) * h;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
        strokeLinejoin="round" strokeLinecap="round" opacity=".8" />
      <circle cx={parseFloat(pts.split(' ').pop().split(',')[0])}
        cy={parseFloat(pts.split(' ').pop().split(',')[1])}
        r="2.5" fill={color} />
    </svg>
  );
}

// ─── Section header ───────────────────────────────────────────
function Sec({ label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase',
        color: '#3a3f5c', fontFamily: 'Space Mono, monospace', marginBottom: 10,
        paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,.04)',
      }}>{label}</div>
      {children}
    </div>
  );
}

// ─── Toggle switch ────────────────────────────────────────────
function Toggle({ on, onChange }) {
  return (
    <div onClick={() => onChange(!on)} style={{
      width: 36, height: 20, borderRadius: 10,
      background: on ? 'linear-gradient(90deg,#5b8ff9,#7c6bf5)' : 'rgba(255,255,255,.08)',
      cursor: 'pointer', position: 'relative', transition: 'all .2s', flexShrink: 0,
      border: `1px solid ${on ? '#5b8ff9' : 'rgba(255,255,255,.1)'}`,
    }}>
      <div style={{
        position: 'absolute', width: 14, height: 14, borderRadius: '50%',
        background: 'white', top: 2, left: on ? 19 : 2, transition: 'left .2s',
        boxShadow: '0 1px 3px rgba(0,0,0,.3)',
      }} />
    </div>
  );
}

// ─── Slider control ───────────────────────────────────────────
function Slider({ label, value, min, max, step = 1, fmt, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
      <span style={{ fontSize: 11, color: '#6b7290', minWidth: 96, fontFamily: 'Space Mono, monospace' }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#5b8ff9', cursor: 'pointer' }} />
      <span style={{
        fontSize: 10, fontFamily: 'Space Mono, monospace', color: '#5b8ff9',
        minWidth: 36, textAlign: 'right',
      }}>{fmt ? fmt(value) : value}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════
export default function Dashboard() {
  const { user, logout } = useAuth();
  const ds = useDataset();

  const [view,           setView]           = useState('charts');
  const [cfg,            setCfg]            = useState(DEFAULT_CFG);
  const [cleanSel,       setCleanSel]       = useState(new Set());
  const [sortCol,        setSortCol]        = useState(null);
  const [sortDir,        setSortDir]        = useState(1);
  const [tableFilter,    setTableFilter]    = useState('');
  const [expanded,       setExpanded]       = useState(new Set());
  const [colSearch,      setColSearch]      = useState('');
  const [showCustomize,  setShowCustomize]  = useState(false);
  const [eli5Mode,       setEli5Mode]       = useState(false);
  const [activeTab,      setActiveTab]      = useState('feed');
  const [actionPlan,     setActionPlan]     = useState(null);
  const [insights,       setInsights]       = useState([]);
  const [feedItems,      setFeedItems]      = useState([]);
  const [storyParagraphs,setStoryParagraphs]= useState([]);
  const [nextSteps,      setNextSteps]      = useState([]);
  const [qualityReport,  setQualityReport]  = useState(null);
  const [styleProfile,   setStyleProfile]   = useState(null);
  const [sidebarOpen,    setSidebarOpen]    = useState(true);
  const [xCol,           setXCol]           = useState('');
  const [yCol,           setYCol]           = useState('');
  const [agg,            setAgg]            = useState('sum');
  const [searchQuery,    setSearchQuery]    = useState('');
  const [pinnedCols,     setPinnedCols]     = useState(new Set());

  useEffect(() => { setStyleProfile(getUserStyleProfile()); }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: files => { if (files[0]) ds.parseFile(files[0]); },
  });

  const hasData = ds.cleanData.length > 0;

  const chartDefs = hasData
    ? buildChartDefs(ds.cleanData, ds.numericCols, ds.catCols, ds.selectedCols, cfg)
    : [];

  // ── KPI data ─────────────────────────────────────────────────
  const ACCENT = ['#5b8ff9', '#2dd4bf', '#f59e0b', '#a78bfa', '#f87171', '#34d399'];
  const kpiData = ds.numericCols.slice(0, 6).map((c, i) => {
    const vals = ds.cleanData.map(r => r[c]).filter(v => v != null && !isNaN(v));
    if (!vals.length) return null;
    const m = mean(vals), mx = safeMax(vals), mn = safeMin(vals), sd = stddev(vals);
    const h1 = mean(vals.slice(0, Math.floor(vals.length / 2)));
    const h2 = mean(vals.slice(Math.floor(vals.length / 2)));
    const pct = h1 ? ((h2 - h1) / Math.abs(h1) * 100) : 0;
    const sparkVals = vals.filter((_, idx) => idx % Math.max(1, Math.floor(vals.length / 12)) === 0).slice(0, 12);
    return { col: c, avg: m, max: mx, min: mn, sd, pct, sparkVals, color: ACCENT[i % ACCENT.length] };
  }).filter(Boolean);

  // ── Table data ────────────────────────────────────────────────
  let tableRows = tableFilter
    ? ds.cleanData.filter(r => Object.values(r).some(v =>
        String(v ?? '').toLowerCase().includes(tableFilter.toLowerCase())))
    : [...ds.cleanData];
  if (sortCol) tableRows.sort((a, b) => {
    const av = a[sortCol] ?? '', bv = b[sortCol] ?? '';
    return av < bv ? -sortDir : av > bv ? sortDir : 0;
  });

  // ── AI generate ───────────────────────────────────────────────
  const generateAll = useCallback(() => {
    if (!hasData) { toast.error('Upload data first'); return; }
    const nc = ds.numericCols, cc = ds.catCols;
    const ordered_nc = getPersonalizedOrder(nc);
    const cards = [];

    cards.push({
      icon: '⬛', bg: 'rgba(91,143,249,.1)', borderColor: 'rgba(91,143,249,.25)',
      title: 'Executive Overview', sub: 'Dataset Summary',
      body: `<b>${ds.cleanData.length.toLocaleString()}</b> records &nbsp;·&nbsp; <b>${ds.columns.length}</b> columns &nbsp;·&nbsp; Quality score <b>${ds.quality}%</b>`,
      metrics: [], priority: 'high',
    });

    ordered_nc.slice(0, 6).forEach((c, i) => {
      const vals = ds.cleanData.map(r => r[c]).filter(v => v != null && !isNaN(v));
      if (!vals.length) return;
      const m = mean(vals), sd = stddev(vals), mn = safeMin(vals), mx = safeMax(vals);
      const sorted = [...vals].sort((a, b) => a - b);
      const med = sorted[Math.floor(sorted.length / 2)];
      const cv = m ? sd / Math.abs(m) * 100 : 0;
      const growth = vals.length > 1 ? ((vals[vals.length - 1] - vals[0]) / Math.abs(vals[0]) * 100) : 0;
      const body = eli5Mode
        ? eli5Insight('', c, { mean: m, stddev: sd, cv, min: mn, max: mx, growth })
        : `Avg <b>${formatN(m)}</b> &nbsp;·&nbsp; Growth <b>${growth.toFixed(1)}%</b> &nbsp;·&nbsp; Variability <b>${cv.toFixed(1)}%</b>`;
      cards.push({
        icon: '∿', bg: ACCENT[i % ACCENT.length] + '12',
        borderColor: ACCENT[i % ACCENT.length] + '28',
        title: c, sub: 'Metric Analysis', body,
        metrics: [
          { v: formatN(m), l: 'Mean' }, { v: formatN(med), l: 'Median' },
          { v: formatN(sd), l: 'StdDev' }, { v: formatN(mn), l: 'Min' },
          { v: formatN(mx), l: 'Max' }, { v: cv.toFixed(1) + '%', l: 'CV' },
        ],
        priority: cv > 70 ? 'high' : growth > 15 ? 'medium' : 'low',
      });
      recordInteraction(c, 'view');
    });

    if (nc.length >= 2) {
      let bestR = 0, best = null;
      for (let i = 0; i < Math.min(nc.length, 8); i++)
        for (let j = i + 1; j < Math.min(nc.length, 8); j++) {
          const a = ds.cleanData.map(r => r[nc[i]]).filter(v => v != null && !isNaN(v));
          const b = ds.cleanData.map(r => r[nc[j]]).filter(v => v != null && !isNaN(v));
          const r = pearson(a.slice(0, Math.min(a.length, b.length)), b.slice(0, Math.min(a.length, b.length)));
          if (Math.abs(r) > Math.abs(bestR)) { bestR = r; best = [nc[i], nc[j]]; }
        }
      if (best) {
        const rl = Math.abs(bestR) > 0.75 ? 'Very Strong' : Math.abs(bestR) > 0.5 ? 'Strong' : 'Moderate';
        cards.push({
          icon: '⟷', bg: 'rgba(45,212,191,.1)', borderColor: 'rgba(45,212,191,.25)',
          title: 'Strongest Correlation', sub: `${best[0]} ↔ ${best[1]}`,
          body: eli5Mode
            ? eli5Insight('', best[0], { correlation: bestR, corrWith: best[1] })
            : `<b>${rl}</b> correlation (r = <b>${bestR.toFixed(3)}</b>) between <b>${best[0]}</b> and <b>${best[1]}</b>. Use for predictive modeling.`,
          metrics: [], priority: 'high',
        });
      }
    }

    const growthLeaders = nc.map(c => {
      const vals = ds.cleanData.map(r => r[c]).filter(v => v != null && !isNaN(v));
      if (vals.length < 2) return { col: c, growth: 0 };
      return { col: c, growth: ((vals[vals.length - 1] - vals[0]) / Math.abs(vals[0]) * 100) };
    }).sort((a, b) => b.growth - a.growth).slice(0, 3);
    if (growthLeaders.length)
      cards.push({
        icon: '↑', bg: 'rgba(245,158,11,.1)', borderColor: 'rgba(245,158,11,.25)',
        title: 'Growth Leaders', sub: 'Top Rising Metrics',
        body: 'These metrics show strongest momentum — prioritize for scaling strategy.',
        metrics: growthLeaders.map(g => ({ v: g.growth.toFixed(1) + '%', l: g.col })),
        priority: 'high',
      });

    const highVarCols = nc.filter(c => {
      const vals = ds.cleanData.map(r => r[c]).filter(v => v != null && !isNaN(v));
      return vals.length && (stddev(vals) / Math.abs(mean(vals))) > 0.65;
    });
    if (highVarCols.length)
      cards.push({
        icon: '!', bg: 'rgba(239,68,68,.1)', borderColor: 'rgba(239,68,68,.25)',
        title: 'Risk Flags', sub: 'High Volatility Detected',
        body: `<b>${highVarCols.length}</b> column${highVarCols.length > 1 ? 's' : ''} show extreme fluctuation: <b>${highVarCols.join(', ')}</b>`,
        metrics: [], priority: 'high',
      });

    setInsights(cards);
    setFeedItems(buildDecisionFeed(ds.cleanData, nc, cc));
    setStoryParagraphs(generateStory(ds.cleanData, nc, cc, ds.fileName) || []);
    setNextSteps(generateNextSteps(ds.cleanData, nc, cc, ds.fileName));
    setQualityReport(analyzeDataQuality(ds.cleanData, ds.columns, nc, cc));
    setStyleProfile(getUserStyleProfile());
    setView('insights');
    toast.success('AI analysis complete');
  }, [ds, eli5Mode]);

  const filteredCols = ds.columns.filter(c =>
    !colSearch || c.toLowerCase().includes(colSearch.toLowerCase()));

  // ── Gradient bar helper ───────────────────────────────────────
  const gradBar = (pct, color) => (
    <div style={{ height: 3, background: 'rgba(255,255,255,.05)', borderRadius: 99, overflow: 'hidden', marginTop: 8 }}>
      <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: color, borderRadius: 99, transition: 'width .6s cubic-bezier(.16,1,.3,1)' }} />
    </div>
  );

  // ═══════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════
  return (
    <div style={S.root}>
      {/* ── GLOBAL CSS INJECTION ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,.1); border-radius: 2px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(91,143,249,.4); }
        select option { background: #0d0f1a; color: #eef0fa; }
        input[type=range]::-webkit-slider-thumb { cursor: grab; }
        input[type=range]::-webkit-slider-runnable-track { height: 3px; border-radius: 2px; background: rgba(255,255,255,.08); }
        .nav-btn:hover { background: rgba(91,143,249,.08) !important; color: #c8d0e8 !important; }
        .col-row:hover { background: rgba(255,255,255,.04) !important; }
        .kpi-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.14) !important; }
        .tb-btn:hover { background: rgba(255,255,255,.06) !important; color: #c8d0e8 !important; }
        .tb-primary:hover { background: rgba(91,143,249,.22) !important; }
        .clean-card:hover { border-color: rgba(91,143,249,.3) !important; transform: translateY(-1px); }
        .feed-card:hover { transform: translateY(-1px); }
        .insight-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,.12) !important; }
        .table-row:hover td { background: rgba(91,143,249,.05) !important; }
      `}</style>

      {/* ── TOPBAR ── */}
      <header style={S.topbar}>
        <div style={S.topLeft}>
          {/* Logo */}
          <div style={S.brand}>
            <div style={S.brandIcon}>◑</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -.3, lineHeight: 1.1 }}>
                DataVision<span style={{ color: '#5b8ff9' }}>Pro</span>
              </div>
              <div style={{ fontSize: 8, letterSpacing: '.2em', color: '#3a3f5c', fontFamily: 'Space Mono, monospace', textTransform: 'uppercase' }}>
                Analytics · v3.0
              </div>
            </div>
          </div>

          <div style={S.sep} />

          {/* Nav */}
          <nav style={S.nav}>
            {NAV_ITEMS.map(({ id, label, icon }) => (
              <button key={id} className="nav-btn"
                style={{ ...S.navBtn, ...(view === id ? S.navActive : {}) }}
                onClick={() => hasData && setView(id)}>
                <span style={{ fontSize: 13 }}>{icon}</span>
                <span>{label}</span>
                {view === id && <div style={S.navDot} />}
              </button>
            ))}
          </nav>
        </div>

        <div style={S.topRight}>
          {hasData && (
            <>
              {/* File info */}
              <div style={S.fileChip}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#34d399', flexShrink: 0 }} />
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#6b7290' }}>
                  {ds.fileName.slice(0, 22)}
                </span>
                <span style={{ fontFamily: 'Space Mono, monospace', fontSize: 10, color: '#34d399', fontWeight: 700 }}>
                  {ds.cleanData.length.toLocaleString()} rows
                </span>
              </div>

              {ds.isDirty && <Pill color="#34d399">✦ Cleaned</Pill>}

              {/* ELI5 toggle */}
              <button className="tb-btn"
                style={{ ...S.tbBtn, ...(eli5Mode ? { color: '#a78bfa', borderColor: 'rgba(167,139,250,.3)' } : {}) }}
                onClick={() => setEli5Mode(p => !p)}>
                {eli5Mode ? '👶 Simple' : '🧠 Expert'}
              </button>
            </>
          )}

          {/* Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 20, background: 'rgba(52,211,153,.08)', border: '1px solid rgba(52,211,153,.15)' }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#34d399', boxShadow: '0 0 6px #34d399' }} />
            <span style={{ fontSize: 10, color: '#34d399', fontFamily: 'Space Mono, monospace' }}>Live</span>
          </div>

          {/* User */}
          {user && (
            <div style={{ ...S.userPill, background: (user.avatarColor || '#5b8ff9') + '15', borderColor: (user.avatarColor || '#5b8ff9') + '30' }}>
              <div style={{ ...S.avatar, background: (user.avatarColor || '#5b8ff9') + '25', color: user.avatarColor || '#5b8ff9' }}>
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: -.2 }}>{user.firstName} {user.lastName}</div>
                <div style={{ fontSize: 9, color: '#3a3f5c', fontFamily: 'Space Mono, monospace' }}>
                  {user.plan?.toUpperCase()} · {user.role}
                </div>
              </div>
            </div>
          )}

          <button style={S.logoutBtn} onClick={logout} className="tb-btn">Sign Out</button>
        </div>
      </header>

      {/* ── BODY ── */}
      <div style={{ ...S.body, gridTemplateColumns: sidebarOpen ? '260px 1fr' : '0 1fr' }}>

        {/* ── SIDEBAR ── */}
        <aside style={{ ...S.sidebar, ...(sidebarOpen ? {} : { overflow: 'hidden', borderRight: 'none' }) }}>
          <div style={S.sidebarInner}>

            {/* Upload */}
            <div style={{ marginBottom: 20 }}>
              <div style={S.sLabel}>Data Source</div>
              <div {...getRootProps()} style={{ ...S.uploadZone, ...(isDragActive ? S.uploadDrag : {}) }}>
                <input {...getInputProps()} />
                <div style={{ fontSize: 26, marginBottom: 6, opacity: isDragActive ? 1 : .6 }}>⬆</div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>
                  {isDragActive ? 'Release to upload' : 'Drop file here'}
                </div>
                <div style={{ fontSize: 9, color: '#3a3f5c', fontFamily: 'Space Mono, monospace', letterSpacing: '.08em' }}>
                  CSV · XLSX · JSON · TSV
                </div>
              </div>
            </div>

            {/* Dataset stats */}
            {hasData && (
              <div style={{ marginBottom: 20 }}>
                <div style={S.sLabel}>Dataset</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
                  {[
                    ['Rows', ds.cleanData.length.toLocaleString(), '#34d399'],
                    ['Cols', ds.columns.length, '#5b8ff9'],
                    ['Numeric', ds.numericCols.length, '#a78bfa'],
                    ['Missing', ds.nullCount, ds.nullCount > 0 ? '#f59e0b' : '#34d399'],
                  ].map(([l, v, c]) => (
                    <div key={l} style={S.miniStat}>
                      <div style={{ fontSize: 8, color: '#3a3f5c', fontFamily: 'Space Mono, monospace', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>{l}</div>
                      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Mono, monospace', color: c, lineHeight: 1 }}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Quality bar */}
                <div style={{ marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 9, color: '#3a3f5c', fontFamily: 'Space Mono, monospace', textTransform: 'uppercase', letterSpacing: '.08em' }}>Quality</span>
                    <span style={{ fontSize: 9, fontFamily: 'Space Mono, monospace', color: ds.quality > 80 ? '#34d399' : ds.quality > 60 ? '#f59e0b' : '#ef4444', fontWeight: 700 }}>{ds.quality}%{ds.isDirty ? ' ↑' : ''}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${ds.quality}%`, borderRadius: 2, transition: 'width .6s cubic-bezier(.16,1,.3,1)', background: ds.quality > 80 ? 'linear-gradient(90deg,#34d399,#2dd4bf)' : ds.quality > 60 ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : '#ef4444' }} />
                  </div>
                </div>

                {ds.cleanHistory.length > 0 && (
                  <button onClick={ds.undoClean} style={{ ...S.tbBtn, width: '100%', justifyContent: 'center', fontSize: 10, padding: '6px 0', color: '#f59e0b', borderColor: 'rgba(245,158,11,.2)' }} className="tb-btn">
                    ↺ Undo: {ds.cleanHistory[ds.cleanHistory.length - 1]?.label?.slice(0, 18)}
                  </button>
                )}
              </div>
            )}

            {/* Column selector */}
            {hasData && (
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div style={{ ...S.sLabel, marginBottom: 8 }}>
                  <span>Columns</span>
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <Pill small color="#5b8ff9">{ds.selectedCols.length}/{ds.columns.length}</Pill>
                    <button style={{ ...S.microBtn, color: '#5b8ff9' }} onClick={ds.selectAll}>all</button>
                    <button style={{ ...S.microBtn, color: '#3a3f5c' }} onClick={ds.selectNone}>none</button>
                  </div>
                </div>

                <input style={S.colSearch} placeholder="Search columns…"
                  value={colSearch} onChange={e => setColSearch(e.target.value)} />

                <div style={{ flex: 1, overflowY: 'auto' }}>
                  {filteredCols.map(c => {
                    const isN = ds.numericCols.includes(c);
                    const isD = /date|time|month/i.test(c);
                    const on = ds.selectedCols.includes(c);
                    const avg = isN ? (() => {
                      const v = ds.cleanData.map(r => r[c]).filter(v => v != null && !isNaN(v));
                      return v.length ? formatN(mean(v)) : '';
                    })() : '';
                    return (
                      <div key={c} className="col-row"
                        style={{ ...S.colRow, ...(on ? S.colRowOn : {}) }}
                        onClick={() => { ds.toggleCol(c); recordInteraction(c, 'click'); }}>
                        <div style={{ ...S.colChk, ...(on ? S.colChkOn : {}) }}>
                          {on && <span style={{ fontSize: 8, lineHeight: 1 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: on ? '#eef0fa' : '#8892b0' }}>{c}</div>
                          {avg && <div style={{ fontSize: 9, color: '#3a3f5c', fontFamily: 'Space Mono, monospace' }}>avg {avg}</div>}
                        </div>
                        <span style={{ ...S.typeBadge, ...(isN ? S.bNum : isD ? S.bDate : S.bStr) }}>
                          {isN ? 'NUM' : isD ? 'DATE' : 'TXT'}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── CONTENT AREA ── */}
        <div style={S.content}>

          {/* ── TOOLBAR ── */}
          <div style={S.toolbar}>
            {/* Sidebar toggle */}
            <button className="tb-btn" style={{ ...S.tbBtn, padding: '7px 10px', flexShrink: 0 }}
              onClick={() => setSidebarOpen(p => !p)} title="Toggle sidebar">
              {sidebarOpen ? '◀' : '▶'}
            </button>

            <div style={S.tbSep} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flex: 1 }}>
              <button className="tb-primary" style={S.tbPrimary}
                onClick={() => {
                  if (!hasData) { toast.error('Load a file first'); return; }
                  ds.setSelectedCols([...ds.numericCols.slice(0, 7), ...ds.catCols.slice(0, 3)]);
                  setView('charts');
                }}>
                ✦ Auto-Visualize
              </button>
              <button className="tb-btn" style={S.tbBtn} onClick={generateAll}>◑ AI Analysis</button>

              <div style={S.tbSep} />

              <select style={S.tsel} value={cfg.layout} onChange={e => setCfg(p => ({ ...p, layout: e.target.value }))}>
                <option value="g2">2-Column</option>
                <option value="g1">Full Width</option>
                <option value="g3">3-Column</option>
              </select>

              <div style={S.tbSep} />

              <button className="tb-btn" style={S.tbBtn} onClick={() => setShowCustomize(p => !p)}>◈ Customize</button>
              <button className="tb-btn" style={S.tbBtn} onClick={() => hasData && setView('clean')}>◇ Clean</button>
              <button className="tb-btn" style={{ ...S.tbBtn, color: '#34d399', borderColor: 'rgba(52,211,153,.2)' }} onClick={ds.exportCSV}>↓ Export</button>
              <button className="tb-btn" style={{ ...S.tbBtn, color: '#ef4444', borderColor: 'rgba(239,68,68,.15)' }} onClick={ds.resetData}>↺ Reset</button>
            </div>
          </div>

          {/* ── WORKSPACE ── */}
          <div style={S.workspace}>

            {/* ═══ EMPTY STATE ════════════════════════════════════ */}
            {!hasData && (
              <div style={S.emptyState}>
                <div style={S.emptyGlow} />
                <div style={S.emptyIcon}>◑</div>
                <h1 style={{ fontSize: 32, fontWeight: 700, letterSpacing: -1, marginBottom: 8, background: 'linear-gradient(135deg,#eef0fa,#5b8ff9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  DataVision Pro
                </h1>
                <p style={{ fontSize: 13, color: '#4d5577', fontFamily: 'Space Mono, monospace', maxWidth: 360, lineHeight: 1.9, textAlign: 'center', marginBottom: 28 }}>
                  Drop any CSV, Excel, or JSON file to get instant<br />
                  AI-powered charts, insights, and action plans.
                </p>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button className="tb-primary" style={{ ...S.tbPrimary, padding: '11px 24px', fontSize: 13 }}
                    onClick={() => document.querySelector('input[type=file]')?.click()}>
                    ⬆ Upload File
                  </button>
                  <button className="tb-btn" style={{ ...S.tbBtn, padding: '11px 24px', fontSize: 13 }}
                    onClick={() => ds.loadData(SAMPLE_DATA, 'enterprise_sample.csv')}>
                    ▷ Load Sample Data
                  </button>
                </div>

                {/* Feature highlights */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 680, marginTop: 48, width: '100%' }}>
                  {[
                    { icon: '∿', title: 'Smart Charts', desc: 'Auto-detect best chart type for your data' },
                    { icon: '◑', title: 'AI Insights', desc: 'Statistical analysis + actionable recommendations' },
                    { icon: '◈', title: 'Data Studio', desc: 'One-click cleaning, outlier removal, normalization' },
                  ].map(f => (
                    <div key={f.title} style={{ background: 'rgba(255,255,255,.025)', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 18, textAlign: 'left' }}>
                      <div style={{ fontSize: 22, marginBottom: 8, color: '#5b8ff9' }}>{f.icon}</div>
                      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{f.title}</div>
                      <div style={{ fontSize: 11, color: '#4d5577', lineHeight: 1.6 }}>{f.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ CHARTS VIEW ════════════════════════════════════ */}
            {hasData && view === 'charts' && (
              <>
                {/* KPI Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
                  {kpiData.map((k, i) => (
                    <div key={k.col} className="kpi-card"
                      style={{ ...S.kpiCard, borderTopColor: k.color }}
                      onClick={() => recordInteraction(k.col, 'click')}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#3a3f5c', fontFamily: 'Space Mono, monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {k.col.slice(0, 18)}
                        </div>
                        <span style={{ fontSize: 10, fontFamily: 'Space Mono, monospace', color: k.pct >= 0 ? '#34d399' : '#ef4444', fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>
                          {k.pct >= 0 ? '+' : ''}{k.pct.toFixed(1)}%
                        </span>
                      </div>
                      <div style={{ fontSize: 28, fontWeight: 700, fontFamily: 'Space Mono, monospace', color: k.color, lineHeight: 1, letterSpacing: -1, marginBottom: 4 }}>
                        {formatN(k.avg)}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                        <div style={{ fontSize: 9, color: '#3a3f5c', fontFamily: 'Space Mono, monospace', lineHeight: 1.7 }}>
                          min {formatN(k.min)}<br />
                          max {formatN(k.max)}
                        </div>
                        <MiniSparkline vals={k.sparkVals} color={k.color} />
                      </div>
                      {gradBar(((k.avg - k.min) / ((k.max - k.min) || 1)) * 100, k.color)}
                    </div>
                  ))}
                </div>

                {/* X vs Y Builder */}
                <div style={{ marginBottom: 20, background: '#0c0f1d', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, padding: 18 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                    <span style={{ fontSize: 13, fontWeight: 700 }}>X vs Y Builder</span>
                    <Pill color="#a78bfa" small>Interactive</Pill>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select style={{ ...S.tsel, minWidth: 200, background: '#080a14' }} value={xCol} onChange={e => setXCol(e.target.value)}>
                      <option value="">X Axis — any column</option>
                      {ds.columns.map((c, i) => <option key={i} value={c}>{c}</option>)}
                    </select>
                    <span style={{ color: '#3a3f5c', fontSize: 13, fontFamily: 'Space Mono, monospace' }}>vs</span>
                    <select style={{ ...S.tsel, minWidth: 200, background: '#080a14' }} value={yCol} onChange={e => setYCol(e.target.value)}>
                      <option value="">Y Axis — any column</option>
                      {ds.columns.map((c, i) => <option key={i} value={c}>{c}</option>)}
                    </select>
                    <select style={{ ...S.tsel, background: '#080a14' }} value={agg} onChange={e => setAgg(e.target.value)}>
                      <option value="sum">Sum</option>
                      <option value="avg">Average</option>
                      <option value="count">Count</option>
                      <option value="max">Max</option>
                      <option value="min">Min</option>
                    </select>
                    <button className="tb-primary" style={S.tbPrimary}
                      onClick={() => {
                        if (!xCol || !yCol) { toast.error('Select X and Y columns'); return; }
                        setCfg(prev => ({ ...prev, xCol, yCol, agg, chartType: 'bar' }));
                        toast.success(`${agg.charAt(0).toUpperCase() + agg.slice(1)} of ${yCol} by ${xCol}`);
                      }}>
                      Generate Chart →
                    </button>
                    {(xCol || yCol) && (
                      <button className="tb-btn" style={{ ...S.tbBtn, color: '#4d5577' }}
                        onClick={() => { setXCol(''); setYCol(''); }}>Clear</button>
                    )}
                  </div>
                </div>

                {/* Charts Grid */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: cfg.layout === 'g1' ? '1fr' : cfg.layout === 'g3' ? 'repeat(3,1fr)' : 'repeat(2,1fr)',
                  gap: 14,
                }}>
                  {chartDefs.map((def, i) => (
                    <ChartCard key={i} def={def} cfg={cfg}
                      fullWidth={def.fullWidth || expanded.has(i)}
                      onToggleExpand={() => setExpanded(p => {
                        const s = new Set(p);
                        s.has(i) ? s.delete(i) : s.add(i);
                        return s;
                      })} />
                  ))}
                  {!chartDefs.length && (
                    <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, opacity: .3 }}>
                      <div style={{ fontSize: 32, marginBottom: 12 }}>◑</div>
                      <div style={{ fontSize: 12, fontFamily: 'Space Mono, monospace' }}>
                        Select columns from sidebar or use X vs Y builder above
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ═══ TABLE / EXPLORER VIEW ══════════════════════════ */}
            {hasData && view === 'table' && (
              <div style={{ background: '#0c0f1d', border: '1px solid rgba(255,255,255,.07)', borderRadius: 16, overflow: 'hidden' }}>
                {/* Table toolbar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.06)', flexWrap: 'wrap' }}>
                  <input style={{ ...S.colSearch, flex: 1, maxWidth: 300, margin: 0 }}
                    placeholder="Search all columns…"
                    value={tableFilter} onChange={e => setTableFilter(e.target.value)} />
                  <div style={{ fontSize: 10, fontFamily: 'Space Mono, monospace', color: '#3a3f5c', marginLeft: 'auto' }}>
                    {tableRows.length.toLocaleString()} rows shown
                    {tableRows.length < ds.cleanData.length && ` of ${ds.cleanData.length.toLocaleString()}`}
                  </div>
                  <button className="tb-btn" style={S.tbBtn}
                    onClick={() => { setSortCol(null); setSortDir(1); }}>Clear Sort</button>
                </div>

                {/* Column type legend */}
                <div style={{ display: 'flex', gap: 12, padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                  {[['NUM', '#34d399', 'rgba(52,211,153,.1)'], ['TXT', '#5b8ff9', 'rgba(91,143,249,.1)'], ['DATE', '#a78bfa', 'rgba(167,139,250,.1)']].map(([l, c, bg]) => (
                    <span key={l} style={{ fontSize: 9, fontFamily: 'Space Mono, monospace', color: c, background: bg, padding: '2px 7px', borderRadius: 4, fontWeight: 700 }}>{l}</span>
                  ))}
                  <span style={{ fontSize: 9, color: '#3a3f5c', fontFamily: 'Space Mono, monospace' }}>Click headers to sort</span>
                </div>

                <div style={{ overflow: 'auto', maxHeight: 'calc(100vh - 260px)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, fontFamily: 'Space Mono, monospace' }}>
                    <thead>
                      <tr>
                        {ds.columns.map(c => {
                          const isN = ds.numericCols.includes(c);
                          const isD = /date|time|month/i.test(c);
                          return (
                            <th key={c}
                              onClick={() => { if (sortCol === c) setSortDir(p => p * -1); else { setSortCol(c); setSortDir(1); } }}
                              style={{ background: '#080a14', padding: '10px 14px', textAlign: isN ? 'right' : 'left', fontSize: 9, letterSpacing: '.08em', color: sortCol === c ? '#5b8ff9' : '#3a3f5c', borderBottom: '1px solid rgba(255,255,255,.06)', position: 'sticky', top: 0, cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 700, textTransform: 'uppercase', userSelect: 'none' }}>
                              <span style={{ color: isN ? '#34d399' : isD ? '#a78bfa' : '#5b8ff9', marginRight: 4 }}>{isN ? '∿' : isD ? '◷' : '≡'}</span>
                              {c}
                              <span style={{ marginLeft: 4, opacity: sortCol === c ? 1 : .2 }}>{sortCol !== c ? '⇅' : sortDir > 0 ? '↑' : '↓'}</span>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.slice(0, 1000).map((r, i) => (
                        <tr key={i} className="table-row">
                          {ds.columns.map(c => {
                            const v = r[c], isNull = v == null || v === '', isNum = ds.numericCols.includes(c);
                            return (
                              <td key={c} style={{ padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,.025)', color: isNull ? '#ef4444' : isNum ? '#34d399' : '#8892b0', textAlign: isNum ? 'right' : 'left', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'background .1s' }}>
                                {isNull ? <i style={{ opacity: .5, fontSize: 10 }}>null</i> : isNum && typeof v === 'number' ? v.toLocaleString() : String(v)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ═══ CLEAN / STUDIO VIEW ════════════════════════════ */}
            {hasData && view === 'clean' && (
              <div style={{ maxWidth: 900 }}>
                {/* Header */}
                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <h2 style={{ fontSize: 20, fontWeight: 700 }}>Data Studio</h2>
                    {ds.isDirty && <Pill color="#34d399">✦ Changes Applied</Pill>}
                  </div>
                  <p style={{ fontSize: 11, color: '#4d5577', fontFamily: 'Space Mono, monospace', lineHeight: 1.7 }}>
                    Operations apply instantly — charts and explorer update in real time.
                  </p>
                </div>

                {/* AI banner */}
                {qualityReport?.issues?.length > 0 && (
                  <div style={{ background: 'linear-gradient(135deg,rgba(91,143,249,.1),rgba(45,212,191,.07))', border: '1px solid rgba(91,143,249,.25)', borderRadius: 14, padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(91,143,249,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>◑</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
                        AI detected {qualityReport.issues.length} data quality issues
                        <span style={{ marginLeft: 8 }}><Pill color="#5b8ff9" small>Score: {qualityReport.score}/100</Pill></span>
                      </div>
                      <div style={{ fontSize: 10, color: '#6b7290', fontFamily: 'Space Mono, monospace' }}>
                        {qualityReport.issues.slice(0, 3).map(i => i.title).join(' · ')}
                      </div>
                    </div>
                    <button className="tb-primary" style={{ ...S.tbPrimary, background: 'linear-gradient(135deg,#5b8ff9,#7c6bf5)', color: 'white', border: 'none' }}
                      onClick={() => {
                        ds.applyCleanOps(new Set(qualityReport.autoFixable), 'Auto-fix all');
                        setCleanSel(new Set());
                        toast.success(`Applied ${qualityReport.autoFixable.length} fixes`);
                      }}>
                      ◈ Auto-Fix All
                    </button>
                  </div>
                )}

                {/* Operations */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 10 }}>
                  {CLEAN_OPS.map(op => {
                    const on = cleanSel.has(op.id);
                    const issue = qualityReport?.issues?.find(i => i.autoFix === op.id);
                    return (
                      <div key={op.id} className="clean-card"
                        onClick={() => setCleanSel(p => { const s = new Set(p); s.has(op.id) ? s.delete(op.id) : s.add(op.id); return s; })}
                        style={{ padding: 16, borderRadius: 14, border: `1.5px solid ${on ? '#5b8ff9' : issue ? 'rgba(245,158,11,.35)' : 'rgba(255,255,255,.06)'}`, background: on ? 'rgba(91,143,249,.08)' : issue ? 'rgba(245,158,11,.04)' : 'rgba(255,255,255,.02)', cursor: 'pointer', display: 'flex', gap: 12, transition: 'all .18s', position: 'relative' }}>
                        {issue && <div style={{ position: 'absolute', top: 10, right: 10, width: 7, height: 7, borderRadius: '50%', background: '#f59e0b', boxShadow: '0 0 6px #f59e0b' }} />}
                        <div style={{ width: 40, height: 40, borderRadius: 10, background: on ? 'rgba(91,143,249,.15)' : 'rgba(255,255,255,.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0, color: on ? '#5b8ff9' : '#8892b0', fontFamily: 'Space Mono, monospace', fontWeight: 700 }}>
                          {op.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: on ? '#eef0fa' : '#c8d0e8' }}>{op.title}</span>
                            <Pill small color={on ? '#5b8ff9' : '#6b7290'}>{op.tag}</Pill>
                          </div>
                          <div style={{ fontSize: 10, color: '#4d5577', fontFamily: 'Space Mono, monospace', lineHeight: 1.6 }}>{op.desc}</div>
                          {issue && <div style={{ fontSize: 10, color: '#f59e0b', fontFamily: 'Space Mono, monospace', marginTop: 4, fontWeight: 700 }}>⚠ {issue.detail}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {cleanSel.size > 0 && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 16, padding: '14px 16px', background: 'rgba(91,143,249,.06)', border: '1px solid rgba(91,143,249,.15)', borderRadius: 12 }}>
                    <button className="tb-primary" style={{ ...S.tbPrimary, padding: '10px 20px', fontSize: 13 }}
                      onClick={() => { ds.applyCleanOps(cleanSel); setCleanSel(new Set()); }}>
                      Apply {cleanSel.size} Operation{cleanSel.size > 1 ? 's' : ''}
                    </button>
                    <button className="tb-btn" style={S.tbBtn} onClick={() => setCleanSel(new Set())}>Clear Selection</button>
                  </div>
                )}

                {ds.cleanLog.length > 0 && (
                  <div style={{ marginTop: 20, background: '#080a14', border: '1px solid rgba(255,255,255,.05)', borderRadius: 12, padding: 16 }}>
                    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#3a3f5c', fontFamily: 'Space Mono, monospace', marginBottom: 10 }}>
                      Operation History
                    </div>
                    {ds.cleanLog.map((l, i) => (
                      <div key={i} style={{ fontSize: 11, fontFamily: 'Space Mono, monospace', color: '#34d399', marginBottom: 5, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ color: '#3a3f5c' }}>✓</span> {l}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ═══ AI LENS / INTELLIGENCE VIEW ═══════════════════ */}
            {hasData && view === 'insights' && (
              <div>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <h2 style={{ fontSize: 20, fontWeight: 700 }}>AI Lens</h2>
                      <Pill color={eli5Mode ? '#a78bfa' : '#5b8ff9'}>{eli5Mode ? '👶 Simple Mode' : '🧠 Expert Mode'}</Pill>
                      {styleProfile?.hasHistory && <Pill color="#2dd4bf" small>Personalized</Pill>}
                    </div>
                    <p style={{ fontSize: 10, color: '#4d5577', fontFamily: 'Space Mono, monospace' }}>
                      Statistical analysis · Correlation detection · Action planning
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="tb-btn" style={{ ...S.tbBtn, ...(eli5Mode ? { color: '#a78bfa', borderColor: 'rgba(167,139,250,.25)' } : {}) }}
                      onClick={() => { setEli5Mode(p => !p); setTimeout(generateAll, 0); }}>
                      {eli5Mode ? '👶 Simple' : '🧠 Expert'}
                    </button>
                    <button className="tb-primary" style={S.tbPrimary} onClick={generateAll}>↻ Regenerate</button>
                  </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,.07)', marginBottom: 24 }}>
                  {[
                    ['feed', '▤ Decision Feed'],
                    ['story', '≡ Narrative'],
                    ['steps', '→ Action Plan'],
                    ['quality', '◑ Quality'],
                    ['classic', '∿ Statistics'],
                  ].map(([t, l]) => (
                    <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '10px 16px', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: activeTab === t ? '#5b8ff9' : '#3a3f5c', borderBottom: `2px solid ${activeTab === t ? '#5b8ff9' : 'transparent'}`, background: 'transparent', border: 'none', borderBottomWidth: 2, borderBottomStyle: 'solid', borderBottomColor: activeTab === t ? '#5b8ff9' : 'transparent', fontFamily: 'Space Mono, monospace', letterSpacing: '.04em', transition: 'all .18s' }}>
                      {l}
                    </button>
                  ))}
                </div>

                {/* ── Decision Feed ── */}
                {activeTab === 'feed' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 720 }}>
                    {feedItems.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 60, opacity: .4 }}>
                        <div style={{ fontSize: 32, marginBottom: 12 }}>◑</div>
                        <button className="tb-primary" style={S.tbPrimary} onClick={generateAll}>Generate AI Feed →</button>
                      </div>
                    )}
                    {feedItems.map(item => (
                      <div key={item.id} className="feed-card"
                        style={{ background: '#0c0f1d', border: `1px solid rgba(255,255,255,.06)`, borderLeft: `3px solid ${item.accentColor}`, borderRadius: 14, padding: 18, transition: 'all .18s' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                          <div style={{ width: 38, height: 38, borderRadius: 10, background: item.accentColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{item.icon}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                              <span style={{ fontSize: 13, fontWeight: 700 }}>{item.title}</span>
                              {item.trend !== undefined && Math.abs(item.trend) > 2 && (
                                <span style={{ fontSize: 9, fontFamily: 'Space Mono, monospace', color: item.trendColor, padding: '2px 8px', borderRadius: 20, background: item.trendColor + '20', fontWeight: 700 }}>{item.trendLabel}</span>
                              )}
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: item.accentColor, marginBottom: 4 }}>{item.headline}</div>
                            <div style={{ fontSize: 12, color: '#6b7290', lineHeight: 1.7 }}>{item.body}</div>

                            {item.bars && (
                              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
                                {item.bars.map(b => (
                                  <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div style={{ fontSize: 10, color: '#6b7290', minWidth: 80, fontFamily: 'Space Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.label}</div>
                                    <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,.05)', borderRadius: 3, overflow: 'hidden' }}>
                                      <div style={{ height: '100%', width: `${b.pct}%`, background: `linear-gradient(90deg,${item.accentColor},${item.accentColor}aa)`, borderRadius: 3, transition: 'width .6s cubic-bezier(.16,1,.3,1)' }} />
                                    </div>
                                    <div style={{ fontSize: 9, fontFamily: 'Space Mono, monospace', color: '#3a3f5c', minWidth: 48, textAlign: 'right' }}>{b.value.toLocaleString()}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {item.action && (
                              <button className="tb-btn"
                                onClick={() => {
                                  recordInteraction(item.title, 'action');
                                  const ia = detectActionableInsights(ds.cleanData, ds.numericCols, ds.catCols);
                                  const m = ia.find(a => a.title.includes(item.action.col));
                                  setActionPlan(m || { title: item.action.col, plan: [{ step: 1, action: 'Investigate ' + item.action.col }, { step: 2, action: 'Compare by category' }, { step: 3, action: 'Set targets and track weekly' }] });
                                }}
                                style={{ ...S.tbBtn, marginTop: 10, color: item.accentColor, borderColor: item.accentColor + '33', fontSize: 11 }}>
                                {item.action.label} →
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── Narrative ── */}
                {activeTab === 'story' && (
                  <div style={{ maxWidth: 720 }}>
                    {storyParagraphs.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 60, opacity: .4 }}>
                        <button className="tb-primary" style={S.tbPrimary} onClick={generateAll}>Generate Narrative →</button>
                      </div>
                    )}
                    {storyParagraphs.map((p, i) => (
                      <div key={i} style={{ background: '#0c0f1d', border: '1px solid rgba(255,255,255,.06)', borderRadius: 14, padding: 20, marginBottom: 10, fontSize: 13, lineHeight: 1.9, color: '#8892b0', borderLeft: '3px solid rgba(91,143,249,.3)' }}
                        dangerouslySetInnerHTML={{ __html: p }} />
                    ))}
                  </div>
                )}

                {/* ── Action Plan ── */}
                {activeTab === 'steps' && (
                  <div style={{ maxWidth: 720 }}>
                    {nextSteps.length === 0 && (
                      <div style={{ textAlign: 'center', padding: 60, opacity: .4 }}>
                        <button className="tb-primary" style={S.tbPrimary} onClick={generateAll}>Generate Action Plan →</button>
                      </div>
                    )}
                    {nextSteps.map((step, i) => {
                      const pColor = step.priority === 'high' ? '#ef4444' : step.priority === 'medium' ? '#f59e0b' : '#34d399';
                      return (
                        <div key={i} style={{ background: '#0c0f1d', border: `1px solid ${pColor}22`, borderRadius: 14, padding: 16, marginBottom: 10, display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: pColor + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0 }}>{step.icon}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <span style={{ fontSize: 13, fontWeight: 700 }}>{step.title}</span>
                              <Pill small color={pColor}>{step.priority}</Pill>
                            </div>
                            <div style={{ fontSize: 12, color: '#6b7290', lineHeight: 1.7 }}>{step.desc}</div>
                            {step.view !== 'export'
                              ? <button className="tb-btn" onClick={() => setView(step.view)} style={{ ...S.tbBtn, marginTop: 8, fontSize: 10 }}>→ Go to {step.view.charAt(0).toUpperCase() + step.view.slice(1)}</button>
                              : <button className="tb-btn" onClick={ds.exportCSV} style={{ ...S.tbBtn, marginTop: 8, color: '#34d399', borderColor: 'rgba(52,211,153,.2)', fontSize: 10 }}>↓ Export CSV</button>
                            }
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── Quality ── */}
                {activeTab === 'quality' && (
                  <div style={{ maxWidth: 720 }}>
                    {!qualityReport && (
                      <div style={{ textAlign: 'center', padding: 60, opacity: .4 }}>
                        <button className="tb-primary" style={S.tbPrimary} onClick={generateAll}>Analyze Quality →</button>
                      </div>
                    )}
                    {qualityReport && (
                      <>
                        <div style={{ background: '#0c0f1d', border: '1px solid rgba(255,255,255,.07)', borderRadius: 18, padding: 22, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 22 }}>
                          <div style={{ width: 88, height: 88, borderRadius: '50%', border: `3px solid ${qualityReport.gradeColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: qualityReport.gradeColor + '10' }}>
                            <div style={{ fontSize: 30, fontWeight: 700, fontFamily: 'Space Mono, monospace', color: qualityReport.gradeColor, lineHeight: 1 }}>{qualityReport.grade}</div>
                            <div style={{ fontSize: 11, color: '#3a3f5c', fontFamily: 'Space Mono, monospace' }}>{qualityReport.score}/100</div>
                          </div>
                          <div>
                            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 4 }}>Quality Score: {qualityReport.score}/100</div>
                            <div style={{ fontSize: 11, color: '#6b7290', fontFamily: 'Space Mono, monospace', marginBottom: 12 }}>{qualityReport.issues.length} issues across {ds.columns.length} columns</div>
                            {qualityReport.autoFixable.length > 0 && (
                              <button className="tb-primary" style={{ ...S.tbPrimary, background: 'linear-gradient(135deg,#5b8ff9,#7c6bf5)', color: 'white', border: 'none' }}
                                onClick={() => ds.applyCleanOps(new Set(qualityReport.autoFixable), 'Auto-fix all')}>
                                ◈ Auto-Fix {qualityReport.autoFixable.length} Issues
                              </button>
                            )}
                          </div>
                        </div>

                        {qualityReport.issues.map((issue, i) => (
                          <div key={i} style={{ background: '#0c0f1d', border: `1px solid ${issue.severity === 'critical' ? 'rgba(239,68,68,.25)' : issue.severity === 'warning' ? 'rgba(245,158,11,.2)' : 'rgba(255,255,255,.06)'}`, borderRadius: 12, padding: 14, marginBottom: 8, display: 'flex', gap: 12, alignItems: 'center' }}>
                            <span style={{ fontSize: 18 }}>{issue.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 2 }}>{issue.title}</div>
                              <div style={{ fontSize: 10, color: '#6b7290', fontFamily: 'Space Mono, monospace' }}>{issue.detail}</div>
                            </div>
                            {issue.autoFix && (
                              <button className="tb-btn"
                                onClick={() => ds.applyCleanOps(new Set([issue.autoFix]), issue.fixLabel)}
                                style={{ ...S.tbBtn, color: '#5b8ff9', borderColor: 'rgba(91,143,249,.25)', fontSize: 11, whiteSpace: 'nowrap' }}>
                                {issue.fixLabel} →
                              </button>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {/* ── Statistics ── */}
                {activeTab === 'classic' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
                    {insights.length === 0 && (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: 60, opacity: .4 }}>
                        <button className="tb-primary" style={S.tbPrimary} onClick={generateAll}>Generate Statistics →</button>
                      </div>
                    )}
                    {insights.map((c, i) => (
                      <div key={i} className="insight-card"
                        style={{ background: '#0c0f1d', border: `1px solid ${c.borderColor || 'rgba(255,255,255,.07)'}`, borderRadius: 18, padding: 18, transition: 'all .18s' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                          <div style={{ width: 36, height: 36, borderRadius: 10, background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, color: '#eef0fa', fontFamily: 'Space Mono, monospace', fontWeight: 700 }}>{c.icon}</div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 1 }}>{c.title}</div>
                            <div style={{ fontSize: 9, color: '#3a3f5c', fontFamily: 'Space Mono, monospace', letterSpacing: '.05em' }}>{c.sub}</div>
                          </div>
                          {c.priority && <Pill small color={c.priority === 'high' ? '#ef4444' : c.priority === 'medium' ? '#f59e0b' : '#34d399'}>{c.priority}</Pill>}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7290', lineHeight: 1.75 }} dangerouslySetInnerHTML={{ __html: c.body }} />
                        {c.metrics?.length > 0 && (
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12 }}>
                            {c.metrics.map((m, j) => (
                              <div key={j} style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 8, padding: 8, textAlign: 'center' }}>
                                <div style={{ fontSize: 14, fontWeight: 700, fontFamily: 'Space Mono, monospace', marginBottom: 2 }}>{m.v}</div>
                                <div style={{ fontSize: 8, color: '#3a3f5c', fontFamily: 'Space Mono, monospace', textTransform: 'uppercase', letterSpacing: '.08em' }}>{m.l}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

          </div>{/* workspace */}
        </div>{/* content */}
      </div>{/* body */}

      {/* ── ACTION PLAN MODAL ── */}
      {actionPlan && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.85)', backdropFilter: 'blur(12px)', zIndex: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setActionPlan(null)}>
          <div style={{ background: '#0c0f1d', border: '1px solid rgba(91,143,249,.3)', borderRadius: 20, padding: 28, maxWidth: 500, width: '90%', boxShadow: '0 24px 80px rgba(0,0,0,.8)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{actionPlan.icon} {actionPlan.title}</div>
            <div style={{ fontSize: 11, color: '#4d5577', fontFamily: 'Space Mono, monospace', marginBottom: 20 }}>{actionPlan.subtitle || 'AI-generated action plan'}</div>
            {actionPlan.plan?.map((p, i) => (
              <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'flex-start' }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', background: 'rgba(91,143,249,.15)', color: '#5b8ff9', fontSize: 11, fontWeight: 700, fontFamily: 'Space Mono, monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{p.step}</div>
                <div style={{ fontSize: 13, color: '#8892b0', lineHeight: 1.7, paddingTop: 2 }}>{p.action}</div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
              <button className="tb-btn" onClick={ds.exportCSV} style={{ ...S.tbBtn, flex: 1, justifyContent: 'center', color: '#34d399', borderColor: 'rgba(52,211,153,.2)' }}>↓ Export Data</button>
              <button className="tb-primary" onClick={() => setActionPlan(null)} style={{ ...S.tbPrimary, flex: 1, justifyContent: 'center' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOMIZE DRAWER ── */}
      <div style={{ ...S.drawer, ...(showCustomize ? S.drawerOpen : {}) }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>◈ Chart Studio</div>
          <button className="tb-btn" style={{ ...S.tbBtn, padding: '5px 10px', fontSize: 11 }} onClick={() => setShowCustomize(false)}>✕</button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px' }}>
          <Sec label="Color Palette">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {PALETTES.map(p => (
                <div key={p} onClick={() => setCfg(x => ({ ...x, palette: p }))}
                  style={{ padding: 8, borderRadius: 10, border: `1.5px solid ${cfg.palette === p ? '#5b8ff9' : 'rgba(255,255,255,.07)'}`, background: cfg.palette === p ? 'rgba(91,143,249,.08)' : 'rgba(255,255,255,.02)', cursor: 'pointer', flex: 1, minWidth: 56 }}>
                  <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
                    {getColors(p).slice(0, 5).map((c, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />)}
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'Space Mono, monospace', color: cfg.palette === p ? '#5b8ff9' : '#3a3f5c', textAlign: 'center' }}>{p}</div>
                </div>
              ))}
            </div>
          </Sec>

          <Sec label="Chart Type">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {CHART_TYPES.map(t => (
                <div key={t.id} onClick={() => setCfg(x => ({ ...x, chartType: t.id }))}
                  style={{ padding: '8px 4px', borderRadius: 10, border: `1.5px solid ${cfg.chartType === t.id ? '#5b8ff9' : 'rgba(255,255,255,.07)'}`, background: cfg.chartType === t.id ? 'rgba(91,143,249,.1)' : 'rgba(255,255,255,.02)', cursor: 'pointer', textAlign: 'center', color: cfg.chartType === t.id ? '#5b8ff9' : '#6b7290' }}>
                  <div style={{ fontSize: 16, fontFamily: 'Space Mono, monospace', marginBottom: 3 }}>{t.icon}</div>
                  <div style={{ fontSize: 9, fontFamily: 'Space Mono, monospace' }}>{t.label}</div>
                </div>
              ))}
            </div>
          </Sec>

          <Sec label="Appearance">
            <Slider label="Border Radius" value={cfg.borderRadius} min={0} max={24} fmt={v => v + 'px'} onChange={v => setCfg(p => ({ ...p, borderRadius: v }))} />
            <Slider label="Line Tension" value={Math.round(cfg.tension * 10)} min={0} max={10} fmt={v => (v / 10).toFixed(1)} onChange={v => setCfg(p => ({ ...p, tension: v / 10 }))} />
            <Slider label="Point Size" value={cfg.pointSize} min={0} max={12} fmt={v => v + 'px'} onChange={v => setCfg(p => ({ ...p, pointSize: v }))} />
            <Slider label="Bar Width %" value={Math.round(cfg.barWidth * 100)} min={20} max={100} fmt={v => v + '%'} onChange={v => setCfg(p => ({ ...p, barWidth: v / 100 }))} />
            <Slider label="Sample Points" value={cfg.sampleSize} min={20} max={500} step={10} onChange={v => setCfg(p => ({ ...p, sampleSize: v }))} />
          </Sec>

          <Sec label="Options">
            {[
              { l: 'Data Labels', k: 'dataLabels' },
              { l: 'Grid Lines', k: 'grid' },
              { l: 'Legend', k: 'legend' },
              { l: 'Animation', k: 'animation' },
              { l: 'Fill Area', k: 'fill' },
              { l: 'Stacked', k: 'stacked' },
            ].map(t => (
              <div key={t.k} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,.04)' }}>
                <span style={{ fontSize: 12, color: '#8892b0' }}>{t.l}</span>
                <Toggle on={cfg[t.k]} onChange={v => setCfg(x => ({ ...x, [t.k]: v }))} />
              </div>
            ))}
          </Sec>

          <button className="tb-primary" style={{ ...S.tbPrimary, width: '100%', padding: 11, justifyContent: 'center', marginTop: 8 }}
            onClick={() => setShowCustomize(false)}>
            Apply & Close
          </button>
        </div>
      </div>
      {showCustomize && <div style={{ position: 'fixed', inset: 0, zIndex: 499 }} onClick={() => setShowCustomize(false)} />}
    </div>
  );
}

// ─── Sample data ──────────────────────────────────────────────
const SAMPLE_DATA = (() => {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const regions = ['North America', 'Europe', 'Asia Pacific', 'Latin America', 'Middle East'];
  const products = ['Analytics Pro', 'CloudSync', 'ML Studio', 'DataVision', 'AutoReport'];
  const d = [];
  months.forEach((m, mi) => regions.forEach(reg => products.forEach((prod, pi) => {
    const base = (mi + 1) * 9000 + pi * 6000 + reg.length * 180;
    const growth = 1 + (mi * 0.025) + (Math.random() * .12 - .06);
    const rev = Math.round(base * growth);
    const cost = Math.round(rev * (.33 + Math.random() * .14));
    d.push({
      Month: m, Quarter: 'Q' + (Math.floor(mi / 3) + 1),
      Region: reg, Product: prod,
      Revenue: rev, Cost: cost, Profit: rev - cost,
      Units: Math.round(rev / 160),
      Customers: Math.round(rev / 300 + Math.random() * 60),
      Satisfaction: +(3.4 + Math.random() * 1.5).toFixed(1),
      MarketShare: +(4 + pi * 2.5 + Math.random() * 3).toFixed(2),
      GrowthRate: +(mi * 2.1 + Math.random() * 4 - 1).toFixed(2),
      RetentionRate: +(72 + Math.random() * 22).toFixed(1),
    });
  })));
  return d;
})();

// ─── Styles ───────────────────────────────────────────────────
const S = {
  root: {
    display: 'flex', flexDirection: 'column', height: '100vh',
    background: '#05060e', overflow: 'hidden', color: '#eef0fa',
    fontFamily: "'system-ui', '-apple-system', 'Segoe UI', sans-serif",
  },
  topbar: {
    height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '0 18px', borderBottom: '1px solid rgba(255,255,255,.05)',
    background: 'rgba(7,8,18,.98)', backdropFilter: 'blur(24px)',
    flexShrink: 0, zIndex: 200, gap: 12,
  },
  topLeft: { display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 },
  brand: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  brandIcon: { width: 32, height: 32, borderRadius: 9, background: 'linear-gradient(135deg,#5b8ff9,#7c6bf5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, color: 'white', fontWeight: 700, flexShrink: 0 },
  sep: { width: 1, height: 20, background: 'rgba(255,255,255,.07)', flexShrink: 0 },
  nav: { display: 'flex', gap: 2, overflow: 'hidden' },
  navBtn: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer', color: '#4d5577', border: 'none', background: 'transparent', fontFamily: 'inherit', transition: 'all .18s', position: 'relative', whiteSpace: 'nowrap' },
  navActive: { color: '#5b8ff9', background: 'rgba(91,143,249,.1)' },
  navDot: { position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#5b8ff9' },
  topRight: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  fileChip: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', background: 'rgba(255,255,255,.04)', borderRadius: 20, border: '1px solid rgba(255,255,255,.07)', fontSize: 11 },
  userPill: { display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px 4px 4px', borderRadius: 24, border: '1.5px solid', cursor: 'pointer' },
  avatar: { width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 },
  logoutBtn: { padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,.07)', background: 'transparent', color: '#3a3f5c', fontFamily: 'inherit', transition: 'all .18s' },
  body: { display: 'grid', flex: 1, overflow: 'hidden', transition: 'grid-template-columns .25s ease' },
  sidebar: { borderRight: '1px solid rgba(255,255,255,.05)', background: '#07080f', display: 'flex', flexDirection: 'column', overflow: 'hidden', transition: 'all .25s' },
  sidebarInner: { flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column' },
  sLabel: { fontSize: 9, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#3a3f5c', fontFamily: 'Space Mono, monospace', marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  uploadZone: { border: '1.5px dashed rgba(91,143,249,.25)', borderRadius: 12, padding: '20px 12px', textAlign: 'center', cursor: 'pointer', transition: 'all .2s', background: 'rgba(91,143,249,.02)' },
  uploadDrag: { borderColor: '#5b8ff9', background: 'rgba(91,143,249,.08)', transform: 'scale(1.02)' },
  miniStat: { background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.05)', borderRadius: 9, padding: '9px 11px' },
  microBtn: { background: 'none', border: 'none', fontSize: 9, cursor: 'pointer', fontFamily: 'Space Mono, monospace', letterSpacing: '.05em' },
  colSearch: { width: '100%', padding: '7px 10px', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.07)', borderRadius: 8, color: '#eef0fa', fontSize: 11, fontFamily: 'Space Mono, monospace', outline: 'none', marginBottom: 8 },
  colRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, cursor: 'pointer', transition: 'background .12s', marginBottom: 2 },
  colRowOn: { background: 'rgba(91,143,249,.08)' },
  colChk: { width: 15, height: 15, borderRadius: 4, border: '1.5px solid rgba(255,255,255,.12)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all .15s', color: 'transparent' },
  colChkOn: { background: '#5b8ff9', borderColor: '#5b8ff9', color: 'white' },
  typeBadge: { fontSize: 8, padding: '1px 5px', borderRadius: 4, fontFamily: 'Space Mono, monospace', fontWeight: 700, flexShrink: 0, letterSpacing: '.06em' },
  bNum: { background: 'rgba(52,211,153,.12)', color: '#34d399' },
  bStr: { background: 'rgba(91,143,249,.12)', color: '#5b8ff9' },
  bDate: { background: 'rgba(167,139,250,.12)', color: '#a78bfa' },
  content: { display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#05060e' },
  toolbar: { padding: '8px 14px', borderBottom: '1px solid rgba(255,255,255,.05)', background: '#07080f', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', flexShrink: 0 },
  tbSep: { width: 1, height: 22, background: 'rgba(255,255,255,.07)', margin: '0 2px', flexShrink: 0 },
  tbBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 8, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.03)', color: '#6b7290', fontFamily: 'inherit', transition: 'all .18s', whiteSpace: 'nowrap', letterSpacing: '-.01em' },
  tbPrimary: { display: 'flex', alignItems: 'center', gap: 5, padding: '7px 14px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', border: '1px solid rgba(91,143,249,.4)', background: 'rgba(91,143,249,.12)', color: '#5b8ff9', fontFamily: 'inherit', transition: 'all .18s', whiteSpace: 'nowrap', letterSpacing: '-.01em' },
  tsel: { padding: '6px 10px', borderRadius: 8, fontSize: 11, border: '1px solid rgba(255,255,255,.07)', background: 'rgba(255,255,255,.03)', color: '#eef0fa', fontFamily: 'inherit', cursor: 'pointer', outline: 'none' },
  workspace: { flex: 1, overflowY: 'auto', padding: 18 },
  emptyState: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100%', padding: 40, position: 'relative' },
  emptyGlow: { position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(91,143,249,.06) 0%,transparent 70%)', top: '50%', left: '50%', transform: 'translate(-50%,-60%)', pointerEvents: 'none' },
  emptyIcon: { fontSize: 52, marginBottom: 20, color: '#5b8ff9', opacity: .6 },
  kpiCard: { background: '#0c0f1d', border: '1px solid rgba(255,255,255,.07)', borderTop: '2px solid', borderRadius: 16, padding: 16, transition: 'all .2s cubic-bezier(.16,1,.3,1)', cursor: 'pointer' },
  drawer: { position: 'fixed', right: 0, top: 0, bottom: 0, width: 310, background: '#07080f', borderLeft: '1px solid rgba(255,255,255,.07)', zIndex: 600, transform: 'translateX(100%)', transition: 'transform .28s cubic-bezier(.16,1,.3,1)', display: 'flex', flexDirection: 'column' },
  drawerOpen: { transform: 'translateX(0)' },
};
