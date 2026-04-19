// Dashboard.jsx v2 — FULL POWER BI PREMIUM EDITION
// ✅ Every single line included • No shortcuts • Visually superior to Power BI
// Premium glassmorphic design, refined shadows, perfect dark theme harmony with ChartCard

import React, { useState, useCallback, useEffect } from 'react';
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

const PALETTES   = ['vivid','google','amazon','tableau','ocean','sunset','mono'];
const CHART_TYPES= [
  {id:'auto',icon:'✨',label:'Auto'},
  {id:'bar',icon:'📊',label:'Bar'},
  {id:'line',icon:'📈',label:'Line'},
  {id:'pie',icon:'🥧',label:'Pie'},
  {id:'doughnut',icon:'🍩',label:'Donut'},
  {id:'scatter',icon:'⚡',label:'Scatter'},
  {id:'polarArea',icon:'🎯',label:'Polar'},
  {id:'radar',icon:'🕸',label:'Radar'}
];
const CLEAN_OPS  = [
  {id:'remove_nulls',    icon:'🗑', title:'Remove null rows',   desc:'Delete rows with any missing values'},
  {id:'fill_nulls_0',    icon:'0️⃣',title:'Fill nulls → 0',     desc:'Replace missing numbers with zero'},
  {id:'fill_nulls_mean', icon:'📐', title:'Fill nulls → mean',  desc:'Replace nulls with column average'},
  {id:'trim_strings',    icon:'✂️', title:'Trim whitespace',    desc:'Remove leading/trailing spaces'},
  {id:'remove_dupes',    icon:'🔁', title:'Remove duplicates',  desc:'Drop repeated rows'},
  {id:'standardize_case',icon:'🔡', title:'Standardize case',   desc:'Convert text to Title Case'},
  {id:'remove_outliers', icon:'📉', title:'Remove outliers',    desc:'Remove rows beyond ±3σ'},
  {id:'normalize',       icon:'📏', title:'Normalize 0→1',      desc:'Scale all numeric columns 0-1'},
];
const DEFAULT_CFG = {palette:'vivid',chartType:'auto',borderRadius:8,tension:0.4,pointSize:3,barWidth:0.8,sampleSize:120,dataLabels:false,grid:true,legend:true,animation:true,fill:false,stacked:false,layout:'g2'};

export default function Dashboard() {
  const { user, logout } = useAuth();
  const ds = useDataset();

  const [view,          setView]          = useState('charts');
  const [cfg,           setCfg]           = useState(DEFAULT_CFG);
  const [cleanSel,      setCleanSel]      = useState(new Set());
  const [sortCol,       setSortCol]       = useState(null);
  const [sortDir,       setSortDir]       = useState(1);
  const [tableFilter,   setTableFilter]   = useState('');
  const [expanded,      setExpanded]      = useState(new Set());
  const [colSearch,     setColSearch]     = useState('');
  const [showCustomize, setShowCustomize] = useState(false);
  const [eli5Mode,      setEli5Mode]      = useState(false);
  const [activeTab,     setActiveTab]     = useState('feed');
  const [actionPlan,    setActionPlan]    = useState(null);
  const [insights,      setInsights]      = useState([]);
  const [feedItems,     setFeedItems]     = useState([]);
  const [storyParagraphs,setStoryParagraphs]=useState([]);
  const [nextSteps,     setNextSteps]     = useState([]);
  const [qualityReport, setQualityReport] = useState(null);
  const [styleProfile,  setStyleProfile]  = useState(null);

  // ── X vs Y Comparison State (ALL COLUMNS AVAILABLE) ─────────────────────────────────────
  const [xCol, setXCol] = useState("");
  const [yCol, setYCol] = useState("");
  const [agg, setAgg] = useState("sum");

  // ── Load style profile on mount ──────────────────────────────
  useEffect(() => { setStyleProfile(getUserStyleProfile()); }, []);

  // ── Dropzone ──────────────────────────────────────────────────
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: files => { if (files[0]) ds.parseFile(files[0]); },
    noClick: false, noKeyboard: false,
  });

  const hasData = ds.cleanData.length > 0;

  // ── Chart defs — recompute whenever cleanData changes ─────────
  const chartDefs = hasData
    ? buildChartDefs(ds.cleanData, ds.numericCols, ds.catCols, ds.selectedCols, cfg)
    : [];

  // ── KPI data ─────────────────────────────────────────────────
  const kpiColors = ['#5b8ff9','#34d399','#fbbf24','#7c6bf5','#fb7185'];
  const kpiData = ds.numericCols.slice(0, 5).map((c, i) => {
    const vals = ds.cleanData.map(r => r[c]).filter(v => v != null && !isNaN(v));
    if (!vals.length) return null;
    const m = mean(vals), mx = safeMax(vals), mn = safeMin(vals), sd = stddev(vals);
    const h1 = mean(vals.slice(0,Math.floor(vals.length/2)));
    const h2 = mean(vals.slice(Math.floor(vals.length/2)));
    const pct = h1 ? ((h2-h1)/Math.abs(h1)*100) : 0;
    return {col:c, avg:m, max:mx, min:mn, sd, pct};
  }).filter(Boolean);

  // ── Table data ────────────────────────────────────────────────
  let tableRows = tableFilter
    ? ds.cleanData.filter(r => Object.values(r).some(v => String(v??'').toLowerCase().includes(tableFilter.toLowerCase())))
    : [...ds.cleanData];
  if (sortCol) tableRows.sort((a,b) => {
    const av=a[sortCol]??'',bv=b[sortCol]??'';
    return av<bv?-sortDir:av>bv?sortDir:0;
  });

  // ── BEST AI INSIGHTS ENGINE ───────────────────────────────────
  const generateAll = useCallback(() => {
    if (!hasData) { toast.error('Load a file first'); return; }
    const nc = ds.numericCols;
    const cc = ds.catCols;
    const ordered_nc = getPersonalizedOrder(nc);

    const cards = [];

    // 1. Executive Overview
    cards.push({
      icon:'📊',
      bg:'rgba(91,143,249,.15)',
      title:'Executive Overview',
      sub:'Business Summary',
      body:`<b>${ds.cleanData.length.toLocaleString()}</b> records • <b>${ds.columns.length}</b> columns • Data quality <b>${ds.quality}%</b>`,
      metrics:[],
      priority:'high'
    });

    // 2. Deep Numeric Insights
    ordered_nc.slice(0,6).forEach((c,i) => {
      const vals = ds.cleanData.map(r=>r[c]).filter(v=>v!=null&&!isNaN(v));
      if (!vals.length) return;
      const m=mean(vals), sd=stddev(vals), mn=safeMin(vals), mx=safeMax(vals);
      const sorted=[...vals].sort((a,b)=>a-b);
      const med=sorted[Math.floor(sorted.length/2)];
      const cv=m?sd/Math.abs(m)*100:0;
      const growth = vals.length>1 ? ((vals[vals.length-1]-vals[0])/Math.abs(vals[0])*100) : 0;
      const body = eli5Mode
        ? eli5Insight('',c,{mean:m,stddev:sd,cv,min:mn,max:mx,growth})
        : `Avg <b>${formatN(m)}</b> • Growth <b>${growth.toFixed(1)}%</b> • Variability <b>${cv.toFixed(1)}%</b>`;
      cards.push({
        icon:'📈',
        bg:getColors('vivid')[i]+'22',
        title:c,
        sub:'Key Metric Deep Dive',
        body,
        metrics:[
          {v:formatN(m),l:'Mean'},
          {v:formatN(med),l:'Median'},
          {v:formatN(sd),l:'StdDev'},
          {v:formatN(mn),l:'Min'},
          {v:formatN(mx),l:'Max'},
          {v:cv.toFixed(1)+'%',l:'CV'}
        ],
        priority: cv>70 ? 'high' : growth>15 ? 'medium' : 'low'
      });
      recordInteraction(c, 'view');
    });

    // 3. Strongest Correlation with Business Meaning
    if (nc.length >= 2) {
      let bestR=0,best=null;
      for (let i=0;i<Math.min(nc.length,8);i++) for (let j=i+1;j<Math.min(nc.length,8);j++) {
        const a=ds.cleanData.map(r=>r[nc[i]]).filter(v=>v!=null&&!isNaN(v));
        const b=ds.cleanData.map(r=>r[nc[j]]).filter(v=>v!=null&&!isNaN(v));
        const r=pearson(a.slice(0,Math.min(a.length,b.length)),b.slice(0,Math.min(a.length,b.length)));
        if (Math.abs(r)>Math.abs(bestR)){bestR=r;best=[nc[i],nc[j]];}
      }
      if (best) {
        const rl=Math.abs(bestR)>0.75?'Very Strong':Math.abs(bestR)>0.5?'Strong':Math.abs(bestR)>0.3?'Moderate':'Weak';
        const body = eli5Mode
          ? eli5Insight('',best[0],{correlation:bestR,corrWith:best[1]})
          : `<b>${rl}</b> correlation (r=<b>${bestR.toFixed(3)}</b>) between <b>${best[0]}</b> and <b>${best[1]}</b>. This relationship can be used for predictive modeling and decision making.`;
        cards.push({icon:'🔗',bg:'rgba(52,211,153,.15)',title:'Strongest Business Relationship',sub:`${best[0]} ↔ ${best[1]}`,body,metrics:[],priority:'high'});
      }
    }

    // 4. Growth Leaders
    const growthLeaders = nc.map(c => {
      const vals = ds.cleanData.map(r => r[c]).filter(v => v != null && !isNaN(v));
      if (vals.length < 2) return {col:c, growth:0};
      const growth = ((vals[vals.length-1] - vals[0]) / Math.abs(vals[0]) * 100);
      return {col:c, growth};
    }).sort((a,b)=>b.growth-a.growth).slice(0,3);

    if (growthLeaders.length) {
      cards.push({
        icon:'🚀',
        bg:'rgba(251,191,36,.15)',
        title:'Top Growth Drivers',
        sub:'Fastest Rising Metrics',
        body:'These metrics show the strongest upward momentum and should be prioritized for scaling.',
        metrics:growthLeaders.map(g=>({v:g.growth.toFixed(1)+'%',l:g.col})),
        priority:'high'
      });
    }

    // 5. High Risk Areas
    const highVarCols = nc.filter(c => {
      const vals = ds.cleanData.map(r => r[c]).filter(v => v != null && !isNaN(v));
      return vals.length && (stddev(vals) / Math.abs(mean(vals))) > 0.65;
    });
    if (highVarCols.length) {
      cards.push({
        icon:'⚠️',
        bg:'rgba(239,68,68,.15)',
        title:'High Risk Areas',
        sub:'High Variability Warning',
        body:`<b>${highVarCols.length}</b> columns show extreme fluctuation. Immediate investigation recommended: <b>${highVarCols.join(', ')}</b>`,
        metrics:[],
        priority:'high'
      });
    }

    // 6. Opportunity Areas
    const opportunityCols = nc.filter(c => {
      const vals = ds.cleanData.map(r => r[c]).filter(v => v != null && !isNaN(v));
      if (vals.length < 2) return false;
      const growth = ((vals[vals.length-1] - vals[0]) / Math.abs(vals[0]) * 100);
      const cv = stddev(vals) / Math.abs(mean(vals)) * 100;
      return growth > 12 && cv < 35;
    });
    if (opportunityCols.length) {
      cards.push({
        icon:'🌟',
        bg:'rgba(52,211,153,.15)',
        title:'Strategic Opportunities',
        sub:'High Growth + Low Risk',
        body:`These columns offer the best balance of growth and stability: <b>${opportunityCols.join(', ')}</b>`,
        metrics:[],
        priority:'medium'
      });
    }

    setInsights(cards);
    setFeedItems(buildDecisionFeed(ds.cleanData, nc, cc));
    setStoryParagraphs(generateStory(ds.cleanData, nc, cc, ds.fileName) || []);
    setNextSteps(generateNextSteps(ds.cleanData, nc, cc, ds.fileName));
    setQualityReport(analyzeDataQuality(ds.cleanData, ds.columns, nc, cc));
    setStyleProfile(getUserStyleProfile());
    setView('insights');
    toast.success('🚀 Best-in-Class AI Insights Generated');
  }, [ds, eli5Mode]);

  const filteredCols = ds.columns.filter(c=>!colSearch||c.toLowerCase().includes(colSearch.toLowerCase()));

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div style={S.root}>

      {/* ── TOP BAR ── */}
      <div style={S.topbar}>
        <div style={S.topLeft}>
          <div style={S.brand}>📊 Data<span style={{color:'#5b8ff9'}}>Vision</span> Pro</div>
          <div style={S.sep}/>
          <nav style={S.nav}>
            {[['charts','📈 Dashboard'],['table','🗂 Table'],['clean','🧹 Clean'],['insights','🔍 Intelligence']].map(([v,l])=>(
              <button key={v} style={{...S.navBtn,...(view===v?S.navActive:{})}} onClick={()=>hasData&&setView(v)}>{l}</button>
            ))}
          </nav>
        </div>
        <div style={S.topRight}>
          {hasData&&(
            <>
              {ds.isDirty && <div style={S.dirtyBadge}>✦ Cleaned</div>}
              <div style={S.fileChip}>
                📄 <span style={{color:'#8892b0',fontSize:11,fontFamily:'monospace'}}>{ds.fileName.slice(0,18)}</span>
                <span style={{color:'#34d399',fontSize:10,fontFamily:'monospace'}}>{ds.cleanData.length.toLocaleString()} rows</span>
              </div>
              <div style={S.eli5Toggle} onClick={()=>setEli5Mode(p=>!p)} title="Toggle Explain Like I'm 5 mode">
                <span>{eli5Mode?'👶':'🧠'}</span>
                <span style={{fontSize:11,fontWeight:700}}>{eli5Mode?'Simple':'Normal'}</span>
              </div>
            </>
          )}
          <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,fontFamily:'monospace',color:'#8892b0'}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#34d399',display:'inline-block'}}/>Ready
          </div>
          <div style={{...S.userPill,background:(user?.avatarColor||'#5b8ff9')+'22',borderColor:(user?.avatarColor||'#5b8ff9')+'44'}}>
            <div style={{...S.avatar,background:(user?.avatarColor||'#5b8ff9')+'33',color:user?.avatarColor||'#5b8ff9'}}>
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div>
              <div style={{fontSize:12,fontWeight:700}}>{user?.firstName} {user?.lastName}</div>
              <div style={{fontSize:9,color:'#4d5577',fontFamily:'monospace'}}>{user?.plan?.toUpperCase()} · {user?.role}</div>
            </div>
          </div>
          <button style={S.logoutBtn} onClick={logout}>Sign Out</button>
        </div>
      </div>

      <div style={S.body}>
        {/* ── SIDEBAR ── */}
        <aside style={S.sidebar}>
          <div style={S.sInner}>
            <div style={S.ss}>
              <div style={S.slabel}>Data Source</div>
              <div {...getRootProps()} style={{...S.uploadZone,...(isDragActive?S.uploadDrag:{})}}>
                <input {...getInputProps()}/>
                <div style={{fontSize:22,marginBottom:5}}>⬆️</div>
                <div style={{fontSize:12,fontWeight:700}}>{isDragActive?'Drop it!':'Drop file here'}</div>
                <div style={{fontSize:10,color:'#4d5577',fontFamily:'monospace'}}>CSV · XLSX · JSON · TSV</div>
              </div>
            </div>

            {hasData&&(
              <div style={S.ss}>
                <div style={S.slabel}>Dataset</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6,marginBottom:8}}>
                  {[['Rows',ds.cleanData.length.toLocaleString(),'#34d399'],['Cols',ds.columns.length,'#5b8ff9'],['Numeric',ds.numericCols.length,'#7c6bf5'],['Nulls',ds.nullCount,'#fbbf24']].map(([l,v,c])=>(
                    <div key={l} style={S.miniStat}><div style={{fontSize:9,color:'#4d5577',fontFamily:'monospace',textTransform:'uppercase',letterSpacing:'.05em'}}>{l}</div><div style={{fontSize:16,fontWeight:800,fontFamily:'monospace',color:c,marginTop:2}}>{v}</div></div>
                  ))}
                </div>
                <div style={{fontSize:9,color:'#4d5577',fontFamily:'monospace',marginBottom:3}}>Quality <span style={{color:'#34d399',marginLeft:4}}>{ds.quality}%{ds.isDirty?' (cleaned)':''}</span></div>
                <div style={{height:3,background:'rgba(255,255,255,.06)',borderRadius:2,overflow:'hidden'}}>
                  <div style={{height:'100%',width:ds.quality+'%',background:'linear-gradient(90deg,#5b8ff9,#2dd4bf)',borderRadius:2,transition:'width .5s'}}/>
                </div>
                {ds.cleanHistory.length>0&&(
                  <button onClick={ds.undoClean} style={{marginTop:6,width:'100%',padding:'5px',borderRadius:6,background:'rgba(251,191,36,.1)',border:'1px solid rgba(251,191,36,.25)',color:'#fbbf24',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
                    ↺ Undo: {ds.cleanHistory[ds.cleanHistory.length-1]?.label?.slice(0,20)}
                  </button>
                )}
              </div>
            )}

            {hasData&&(
              <div style={{...S.ss,flex:1,overflow:'hidden',display:'flex',flexDirection:'column'}}>
                <div style={{...S.slabel,marginBottom:6}}>
                  Columns
                  <div style={{display:'flex',gap:4,alignItems:'center'}}>
                    <span style={{...S.chip}}>{ds.selectedCols.length}/{ds.columns.length}</span>
                    <button style={S.microBtn} onClick={ds.selectAll}>all</button>
                    <button style={{...S.microBtn,color:'#4d5577'}} onClick={ds.selectNone}>none</button>
                  </div>
                </div>
                <input style={S.colSearch} placeholder="Filter columns…" value={colSearch} onChange={e=>setColSearch(e.target.value)}/>
                <div style={{flex:1,overflowY:'auto'}}>
                  {filteredCols.map(c=>{
                    const isN=ds.numericCols.includes(c),isD=/date|time|month/i.test(c),on=ds.selectedCols.includes(c);
                    const avg=isN?(()=>{const v=ds.cleanData.map(r=>r[c]).filter(v=>v!=null&&!isNaN(v));return v.length?formatN(mean(v)):''})():'';
                    return(
                      <div key={c} style={{...S.colRow,...(on?S.colRowOn:{})}} onClick={()=>{ds.toggleCol(c);recordInteraction(c,'click');}}>
                        <div style={{...S.colChk,...(on?S.colChkOn:{})}}>{on?'✓':''}</div>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{fontSize:11,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c}</div>
                          {avg&&<div style={{fontSize:9,color:'#4d5577',fontFamily:'monospace'}}>avg {avg}</div>}
                        </div>
                        <span style={{...S.typeBadge,...(isN?S.bNum:isD?S.bDate:S.bStr)}}>{isN?'NUM':isD?'DATE':'TXT'}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ── CONTENT ── */}
        <div style={S.content}>
          {/* Toolbar */}
          <div style={S.toolbar}>
            <div style={S.tbg}>
              <button style={S.tbPrimary} onClick={()=>{if(!hasData){toast.error('Load a file first');return;}ds.setSelectedCols([...ds.numericCols.slice(0,7),...ds.catCols.slice(0,3)]);setView('charts');}}>✦ Auto-Visualize</button>
              <button style={S.tb} onClick={generateAll}>🔍 AI Intelligence</button>
            </div>
            <div style={S.tbSep}/>
            <div style={S.tbg}>
              <select style={S.tsel} value={cfg.layout} onChange={e=>setCfg(p=>({...p,layout:e.target.value}))}>
                <option value="g2">2-Column</option><option value="g1">Full Width</option><option value="g3">3-Column</option>
              </select>
            </div>
            <div style={S.tbSep}/>
            <div style={S.tbg}>
              <button style={S.tb} onClick={()=>setShowCustomize(p=>!p)}>🎨 Customize</button>
              <button style={S.tb} onClick={()=>hasData&&setView('clean')}>🧹 Clean</button>
              <button style={{...S.tb,color:'#34d399',borderColor:'rgba(52,211,153,.25)'}} onClick={ds.exportCSV}>⬇ Export</button>
              <button style={S.tb} onClick={ds.resetData}>↺ Reset</button>
            </div>
          </div>

          {/* Workspace */}
          <div style={S.workspace}>

            {/* Empty */}
            {!hasData&&(
              <div style={S.empty}>
                <div style={{fontSize:64}}>📊</div>
                <h2 style={{fontSize:24,fontWeight:700,letterSpacing:-.5}}>DataVision Pro</h2>
                <p style={{fontSize:13,color:'#8892b0',fontFamily:'monospace',maxWidth:320,lineHeight:1.8,textAlign:'center'}}>
                  Drop any CSV, Excel, or JSON file. Get instant AI-powered charts, story, and action plans.
                </p>
                <button style={{...S.tbPrimary,padding:'11px 28px',fontSize:13,marginTop:8}} onClick={()=>document.querySelector('input[type=file]')?.click()}>⬆ Upload Data</button>
                <button style={{...S.tb,marginTop:6}} onClick={()=>ds.loadData(SAMPLE_DATA,'sample_enterprise.csv')}>▷ Load Sample Dataset</button>
              </div>
            )}

            {/* ── CHARTS VIEW with X vs Y Comparison (ALL COLUMNS FOR X AND Y) ── */}
            {hasData&&view==='charts'&&(
              <>
                {/* KPI Cards */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:18}}>
                  {kpiData.map((k,i)=>(
                    <div key={k.col} style={{...S.kpi,borderTopColor:kpiColors[i]}} onClick={()=>recordInteraction(k.col,'click')}>
                      <div style={{fontSize:9,fontWeight:800,letterSpacing:'.1em',textTransform:'uppercase',color:'#4d5577',fontFamily:'monospace',marginBottom:6}}>{k.col.slice(0,20).toUpperCase()}</div>
                      <div style={{fontSize:26,fontWeight:800,letterSpacing:-1,color:kpiColors[i],lineHeight:1,marginBottom:4}}>{formatN(k.avg)}</div>
                      <div style={{fontSize:11,fontFamily:'monospace',color:k.pct>=0?'#34d399':'#ef4444',marginBottom:4}}>
                        {k.pct>=0?'▲ +':'▼ '}{Math.abs(k.pct).toFixed(1)}% vs prior
                      </div>
                      <div style={{fontSize:10,color:'#4d5577',fontFamily:'monospace'}}>min {formatN(k.min)} · max {formatN(k.max)}</div>
                    </div>
                  ))}
                </div>

                {/* X vs Y Comparison Controls — ALL COLUMNS AVAILABLE */}
                <div style={{ marginBottom: "24px", background: '#1b1f30', padding: "16px", borderRadius: "14px", border: "1px solid rgba(255,255,255,.07)" }}>
                  <h3 style={{marginBottom: "12px", fontSize: "16px", fontWeight: 700}}>X vs Y Comparison (Any Column)</h3>
                  <div style={{display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center"}}>
                    <select 
                      value={xCol} 
                      onChange={(e) => setXCol(e.target.value)}
                      style={{padding: "8px 12px", borderRadius: "8px", background: "#0c0e18", border: "1px solid rgba(255,255,255,.08)", color: "#eef0fa", minWidth: 220}}
                    >
                      <option value="">Select X Column (Any)</option>
                      {ds.columns.map((col, index) => (
                        <option key={index} value={col}>{col}</option>
                      ))}
                    </select>

                    <select 
                      value={yCol} 
                      onChange={(e) => setYCol(e.target.value)}
                      style={{padding: "8px 12px", borderRadius: "8px", background: "#0c0e18", border: "1px solid rgba(255,255,255,.08)", color: "#eef0fa", minWidth: 220}}
                    >
                      <option value="">Select Y Column (Any)</option>
                      {ds.columns.map((col, index) => (
                        <option key={index} value={col}>{col}</option>
                      ))}
                    </select>

                    <select 
                      value={agg} 
                      onChange={(e) => setAgg(e.target.value)}
                      style={{padding: "8px 12px", borderRadius: "8px", background: "#0c0e18", border: "1px solid rgba(255,255,255,.08)", color: "#eef0fa"}}
                    >
                      <option value="sum">Sum</option>
                      <option value="avg">Average</option>
                    </select>

                    <button 
                      style={S.tbPrimary}
                      onClick={() => {
                        if (!xCol || !yCol) {
                          toast.error("Please select both X and Y columns");
                          return;
                        }
                        setCfg(prev => ({
                          ...prev,
                          xCol: xCol,
                          yCol: yCol,
                          agg: agg,
                          chartType: 'bar'
                        }));
                        toast.success(`Showing ${agg} of ${yCol} by ${xCol}`);
                      }}
                    >
                      Generate X vs Y Chart
                    </button>
                  </div>
                </div>

                {/* Main Charts Grid */}
                <div style={{display:'grid',gridTemplateColumns:cfg.layout==='g1'?'1fr':cfg.layout==='g3'?'repeat(3,1fr)':'repeat(2,1fr)',gap:14}}>
                  {chartDefs.map((def,i)=>(
                    <ChartCard key={i} def={def} cfg={cfg}
                      fullWidth={def.fullWidth||expanded.has(i)}
                      onToggleExpand={()=>setExpanded(p=>{const s=new Set(p);s.has(i)?s.delete(i):s.add(i);return s;})}
                    />
                  ))}
                  {!chartDefs.length&&<div style={{gridColumn:'1/-1',textAlign:'center',padding:40,opacity:.4,fontSize:12,fontFamily:'monospace'}}>Select columns from sidebar or use X vs Y above to visualize</div>}
                </div>
              </>
            )}

            {/* ── TABLE VIEW ── */}
            {hasData&&view==='table'&&(
              <div style={{background:'#1b1f30',border:'1px solid rgba(255,255,255,.07)',borderRadius:18,overflow:'hidden'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,.06)'}}>
                  <input style={S.tableSearch} placeholder="🔍 Search all columns…" value={tableFilter} onChange={e=>setTableFilter(e.target.value)}/>
                  <span style={{fontSize:11,fontFamily:'monospace',color:'#4d5577',marginLeft:'auto'}}>{tableRows.length.toLocaleString()} rows shown</span>
                  <button style={S.tb} onClick={()=>{setSortCol(null);setSortDir(1);}}>Clear Sort</button>
                </div>
                <div style={{overflow:'auto',maxHeight:'calc(100vh - 220px)'}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:12,fontFamily:'monospace'}}>
                    <thead><tr>{ds.columns.map(c=>(
                      <th key={c} onClick={()=>{if(sortCol===c)setSortDir(p=>p*-1);else{setSortCol(c);setSortDir(1);}}}
                        style={{background:'#0c0e18',padding:'9px 14px',textAlign:'left',fontSize:9,letterSpacing:'.07em',color:'#4d5577',borderBottom:'1px solid rgba(255,255,255,.06)',position:'sticky',top:0,cursor:'pointer',whiteSpace:'nowrap',fontWeight:800,textTransform:'uppercase'}}>
                        {c}<span style={{marginLeft:4,opacity:sortCol===c?1:.3,color:sortCol===c?'#5b8ff9':'inherit'}}>{sortCol!==c?'⇅':sortDir>0?'↑':'↓'}</span>
                      </th>
                    ))}</tr></thead>
                    <tbody>{tableRows.slice(0,1000).map((r,i)=>(
                      <tr key={i}>{ds.columns.map(c=>{
                        const v=r[c],isNull=v==null||v==='',isNum=ds.numericCols.includes(c);
                        return <td key={c} style={{padding:'8px 14px',borderBottom:'1px solid rgba(255,255,255,.03)',color:isNull?'#fb7185':isNum?'#34d399':'#8892b0',textAlign:isNum?'right':'left',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                          {isNull?<i>null</i>:isNum&&typeof v==='number'?v.toLocaleString():String(v)}
                        </td>;
                      })}</tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── CLEAN VIEW ── */}
            {hasData&&view==='clean'&&(
              <div style={{maxWidth:860}}>
                <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:4}}>
                  <h2 style={{fontSize:18,fontWeight:700}}>🧹 Data Cleaning Studio</h2>
                  {ds.isDirty&&<span style={{padding:'3px 10px',borderRadius:20,background:'rgba(52,211,153,.15)',color:'#34d399',fontSize:11,fontFamily:'monospace',fontWeight:700}}>✦ Changes applied</span>}
                </div>
                <p style={{fontSize:12,color:'#8892b0',fontFamily:'monospace',marginBottom:6}}>Changes apply immediately — charts and table update automatically.</p>

                {qualityReport?.issues?.length > 0 && (
                  <div style={{background:'linear-gradient(90deg,rgba(91,143,249,.12),rgba(45,212,191,.08))',border:'1px solid rgba(91,143,249,.3)',borderRadius:12,padding:'12px 16px',marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
                    <span style={{fontSize:20}}>🤖</span>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:700}}>AI Detected {qualityReport.issues.length} issues (Score: {qualityReport.score}/100)</div>
                      <div style={{fontSize:11,color:'#8892b0',fontFamily:'monospace',marginTop:2}}>
                        {qualityReport.issues.slice(0,3).map(i=>i.title).join(' · ')}
                      </div>
                    </div>
                    <button onClick={()=>{
                      const ops=new Set(qualityReport.autoFixable);
                      ds.applyCleanOps(ops,'Auto-fix all issues');
                      setCleanSel(new Set());
                      toast.success(`Applied ${qualityReport.autoFixable.length} auto-fixes successfully!`);
                    }} style={{padding:'8px 16px',borderRadius:8,background:'linear-gradient(135deg,#5b8ff9,#7c6bf5)',border:'none',color:'white',fontSize:12,fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
                      🔧 Auto-Fix All
                    </button>
                  </div>
                )}

                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))',gap:10}}>
                  {CLEAN_OPS.map(op=>{
                    const on=cleanSel.has(op.id);
                    const issue=qualityReport?.issues?.find(i=>i.autoFix===op.id);
                    return(
                      <div key={op.id} onClick={()=>setCleanSel(p=>{const s=new Set(p);s.has(op.id)?s.delete(op.id):s.add(op.id);return s;})}
                        style={{padding:14,borderRadius:14,border:`1.5px solid ${on?'#5b8ff9':issue?'rgba(251,191,36,.4)':'rgba(255,255,255,.07)'}`,background:on?'rgba(91,143,249,.08)':'#1b1f30',cursor:'pointer',display:'flex',gap:12,transition:'all .2s',position:'relative'}}>
                        {issue&&<div style={{position:'absolute',top:8,right:8,width:8,height:8,borderRadius:'50%',background:'#fbbf24'}}/>}
                        <div style={{width:38,height:38,borderRadius:10,background:'#10131f',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{op.icon}</div>
                        <div>
                          <div style={{fontSize:12,fontWeight:700,marginBottom:3}}>{op.title}</div>
                          <div style={{fontSize:10,color:'#4d5577',fontFamily:'monospace',lineHeight:1.5}}>{op.desc}</div>
                          {issue&&<div style={{fontSize:10,color:'#fbbf24',fontFamily:'monospace',marginTop:4,fontWeight:600}}>⚠ {issue.detail}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {cleanSel.size>0&&(
                  <div style={{display:'flex',gap:8,marginTop:16}}>
                    <button style={{...S.tbPrimary,padding:'10px 20px',fontSize:13}} onClick={()=>{ds.applyCleanOps(cleanSel);setCleanSel(new Set());}}>
                      Apply {cleanSel.size} Operation{cleanSel.size>1?'s':''}
                    </button>
                    <button style={S.tb} onClick={()=>setCleanSel(new Set())}>Clear</button>
                  </div>
                )}

                {ds.cleanLog.length>0&&(
                  <div style={{marginTop:20,background:'#0c0e18',border:'1px solid rgba(255,255,255,.06)',borderRadius:10,padding:14}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#4d5577',fontFamily:'monospace',marginBottom:8,textTransform:'uppercase',letterSpacing:'.06em'}}>Clean History</div>
                    {ds.cleanLog.map((l,i)=>(
                      <div key={i} style={{fontSize:11,fontFamily:'monospace',color:'#34d399',marginBottom:4}}>✓ {l}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── INTELLIGENCE VIEW ── */}
            {hasData&&view==='insights'&&(
              <div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16,flexWrap:'wrap',gap:10}}>
                  <div>
                    <h2 style={{fontSize:18,fontWeight:700,marginBottom:2}}>🔍 AI Intelligence Center</h2>
                    <p style={{fontSize:12,color:'#8892b0',fontFamily:'monospace'}}>
                      {eli5Mode?'👶 Simple Mode — explaining without jargon':'🧠 Normal Mode — full statistical analysis'}
                      {styleProfile?.hasHistory && <span style={{marginLeft:8,color:'#7c6bf5'}}>· Personalized for you</span>}
                    </p>
                  </div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <button style={{...S.tb,...(eli5Mode?{background:'rgba(124,107,245,.15)',borderColor:'rgba(124,107,245,.4)',color:'#7c6bf5'}:{})}} onClick={()=>{setEli5Mode(p=>!p);setTimeout(generateAll,0);}}>
                      {eli5Mode?'👶 Simple Mode':'🧠 Normal Mode'}
                    </button>
                    <button style={S.tbPrimary} onClick={generateAll}>↻ Regenerate</button>
                  </div>
                </div>

                {/* Tabs */}
                <div style={{display:'flex',gap:0,borderBottom:'1px solid rgba(255,255,255,.07)',marginBottom:20}}>
                  {[['feed','📱 Decision Feed'],['story','📖 Story'],['steps','⚡ Next Steps'],['quality','🔬 Data Quality'],['classic','📊 Stats']].map(([t,l])=>(
                    <button key={t} onClick={()=>setActiveTab(t)} style={{padding:'10px 16px',fontSize:12,fontWeight:600,cursor:'pointer',color:activeTab===t?'#5b8ff9':'#4d5577',borderBottom:activeTab===t?'2px solid #5b8ff9':'2px solid transparent',background:'transparent',border:'none',borderBottomWidth:2,borderBottomStyle:'solid',borderBottomColor:activeTab===t?'#5b8ff9':'transparent',fontFamily:'inherit',transition:'all .2s'}}>{l}</button>
                  ))}
                </div>

                {/* All AI Features (Feed, Story, Steps, Quality, Classic) remain unchanged */}
                {activeTab==='feed'&&(
                  <div style={{display:'flex',flexDirection:'column',gap:12,maxWidth:680}}>
                    {feedItems.length===0&&<div style={{textAlign:'center',padding:40,opacity:.4,fontSize:12,fontFamily:'monospace'}}><button style={S.tbPrimary} onClick={generateAll}>Generate AI Feed →</button></div>}
                    {feedItems.map(item=>(
                      <div key={item.id} style={{background:'#1b1f30',border:`1px solid rgba(255,255,255,.07)`,borderLeft:`3px solid ${item.accentColor}`,borderRadius:14,padding:18,transition:'all .2s'}}>
                        <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                          <div style={{fontSize:26,flexShrink:0}}>{item.icon}</div>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                              <span style={{fontSize:13,fontWeight:700}}>{item.title}</span>
                              {item.trend!==undefined&&Math.abs(item.trend)>2&&(
                                <span style={{fontSize:11,fontFamily:'monospace',color:item.trendColor,padding:'2px 8px',borderRadius:20,background:item.trendColor+'22'}}>{item.trendLabel}</span>
                              )}
                            </div>
                            <div style={{fontSize:13,fontWeight:600,color:item.accentColor,marginBottom:3}}>{item.headline}</div>
                            <div style={{fontSize:12,color:'#8892b0'}}>{item.body}</div>

                            {item.bars&&(
                              <div style={{marginTop:10,display:'flex',flexDirection:'column',gap:4}}>
                                {item.bars.map(b=>(
                                  <div key={b.label} style={{display:'flex',alignItems:'center',gap:8}}>
                                    <div style={{fontSize:11,color:'#8892b0',minWidth:80,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.label}</div>
                                    <div style={{flex:1,height:6,background:'rgba(255,255,255,.06)',borderRadius:3,overflow:'hidden'}}>
                                      <div style={{height:'100%',width:b.pct+'%',background:item.accentColor,borderRadius:3,transition:'width .5s'}}/>
                                    </div>
                                    <div style={{fontSize:10,fontFamily:'monospace',color:'#4d5577',minWidth:40,textAlign:'right'}}>{b.value.toLocaleString()}</div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {item.action&&(
                              <button onClick={()=>{
                                recordInteraction(item.title,'action');
                                if (item.action.type==='fix'||item.action.type==='amplify') {
                                  const insights_for_action=detectActionableInsights(ds.cleanData,ds.numericCols,ds.catCols);
                                  const match=insights_for_action.find(a=>a.title.includes(item.action.col));
                                  setActionPlan(match||{title:item.action.col,plan:[{step:1,action:'Investigate '+item.action.col},{step:2,action:'Compare by category'},{step:3,action:'Set targets and measure weekly'}]});
                                } else if (item.action.type==='explain_correlation') {
                                  toast(eli5Insight('',item.action.col1,{correlation:item.action.r,corrWith:item.action.col2}),{duration:6000,icon:'🔗'});
                                }
                              }} style={{marginTop:10,padding:'7px 14px',borderRadius:8,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.12)',color:item.accentColor,fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit',transition:'all .2s'}}>
                                {item.action.label}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab==='story'&&(
                  <div style={{maxWidth:720}}>
                    {storyParagraphs.length===0&&<div style={{textAlign:'center',padding:40,opacity:.4}}><button style={S.tbPrimary} onClick={generateAll}>Generate Story →</button></div>}
                    {storyParagraphs.map((p,i)=>(
                      <div key={i} style={{background:'#1b1f30',border:'1px solid rgba(255,255,255,.07)',borderRadius:14,padding:18,marginBottom:12,fontSize:14,lineHeight:1.8,color:'#c8d0e8'}} dangerouslySetInnerHTML={{__html:p}}/>
                    ))}
                  </div>
                )}

                {activeTab==='steps'&&(
                  <div style={{maxWidth:720}}>
                    {nextSteps.length===0&&<div style={{textAlign:'center',padding:40,opacity:.4}}><button style={S.tbPrimary} onClick={generateAll}>Generate Steps →</button></div>}
                    {nextSteps.map((step,i)=>(
                      <div key={i} style={{background:'#1b1f30',border:`1px solid ${step.priority==='high'?'rgba(239,68,68,.3)':step.priority==='medium'?'rgba(251,191,36,.25)':'rgba(255,255,255,.07)'}`,borderRadius:14,padding:16,marginBottom:10,display:'flex',gap:14,alignItems:'flex-start'}}>
                        <div style={{width:30,height:30,borderRadius:'50%',background:step.priority==='high'?'rgba(239,68,68,.15)':step.priority==='medium'?'rgba(251,191,36,.15)':'rgba(52,211,153,.15)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0}}>{step.icon}</div>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                            <span style={{fontSize:13,fontWeight:700}}>{step.title}</span>
                            <span style={{fontSize:9,padding:'2px 7px',borderRadius:20,background:step.priority==='high'?'rgba(239,68,68,.15)':step.priority==='medium'?'rgba(251,191,36,.15)':'rgba(52,211,153,.15)',color:step.priority==='high'?'#ef4444':step.priority==='medium'?'#fbbf24':'#34d399',fontFamily:'monospace',fontWeight:700,textTransform:'uppercase'}}>{step.priority}</span>
                          </div>
                          <div style={{fontSize:12,color:'#8892b0',lineHeight:1.65}}>{step.desc}</div>
                          {step.view!=='export'&&<button onClick={()=>setView(step.view)} style={{marginTop:8,padding:'5px 12px',borderRadius:6,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',color:'#8892b0',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>→ Go to {step.view.charAt(0).toUpperCase()+step.view.slice(1)}</button>}
                          {step.view==='export'&&<button onClick={ds.exportCSV} style={{marginTop:8,padding:'5px 12px',borderRadius:6,background:'rgba(52,211,153,.1)',border:'1px solid rgba(52,211,153,.25)',color:'#34d399',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>⬇ Export CSV</button>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab==='quality'&&(
                  <div style={{maxWidth:720}}>
                    {!qualityReport&&<div style={{textAlign:'center',padding:40,opacity:.4}}><button style={S.tbPrimary} onClick={generateAll}>Analyze Quality →</button></div>}
                    {qualityReport&&(
                      <>
                        <div style={{background:'#1b1f30',border:'1px solid rgba(255,255,255,.07)',borderRadius:18,padding:20,marginBottom:16,display:'flex',alignItems:'center',gap:20}}>
                          <div style={{width:80,height:80,borderRadius:'50%',border:`4px solid ${qualityReport.gradeColor}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                            <div style={{fontSize:28,fontWeight:800,fontFamily:'monospace',color:qualityReport.gradeColor,lineHeight:1}}>{qualityReport.grade}</div>
                            <div style={{fontSize:12,color:'#4d5577',fontFamily:'monospace'}}>{qualityReport.score}/100</div>
                          </div>
                          <div>
                            <div style={{fontSize:16,fontWeight:700,marginBottom:4}}>Data Quality Score: {qualityReport.score}/100</div>
                            <div style={{fontSize:12,color:'#8892b0',marginBottom:10}}>{qualityReport.issues.length} issues found across {ds.columns.length} columns</div>
                            {qualityReport.autoFixable.length>0&&(
                              <button onClick={()=>{ds.applyCleanOps(new Set(qualityReport.autoFixable),'Auto-fix all');}} style={{padding:'7px 16px',borderRadius:8,background:'linear-gradient(135deg,#5b8ff9,#7c6bf5)',border:'none',color:'white',fontSize:12,fontWeight:700,cursor:'pointer'}}>
                                🔧 Auto-Fix All {qualityReport.autoFixable.length} Issues
                              </button>
                            )}
                          </div>
                        </div>
                        {qualityReport.issues.map((issue,i)=>(
                          <div key={i} style={{background:'#1b1f30',border:`1px solid ${issue.severity==='critical'?'rgba(239,68,68,.3)':issue.severity==='warning'?'rgba(251,191,36,.25)':'rgba(255,255,255,.07)'}`,borderRadius:12,padding:14,marginBottom:8,display:'flex',gap:12,alignItems:'center'}}>
                            <span style={{fontSize:20}}>{issue.icon}</span>
                            <div style={{flex:1}}>
                              <div style={{fontSize:12,fontWeight:700}}>{issue.title}</div>
                              <div style={{fontSize:11,color:'#8892b0',fontFamily:'monospace',marginTop:2}}>{issue.detail}</div>
                            </div>
                            {issue.autoFix&&(
                              <button onClick={()=>ds.applyCleanOps(new Set([issue.autoFix]),issue.fixLabel)} style={{padding:'6px 12px',borderRadius:8,background:'rgba(91,143,249,.15)',border:'1px solid rgba(91,143,249,.3)',color:'#5b8ff9',fontSize:11,cursor:'pointer',fontWeight:600,fontFamily:'inherit',whiteSpace:'nowrap'}}>
                                {issue.fixLabel} →
                              </button>
                            )}
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                )}

                {activeTab==='classic'&&(
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:14}}>
                    {insights.length===0&&<div style={{gridColumn:'1/-1',textAlign:'center',padding:40,opacity:.4}}><button style={S.tbPrimary} onClick={generateAll}>Generate Insights →</button></div>}
                    {insights.map((c,i)=>(
                      <div key={i} style={{background:'#1b1f30',border:'1px solid rgba(255,255,255,.07)',borderRadius:18,padding:18}}>
                        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:12}}>
                          <div style={{width:36,height:36,borderRadius:10,background:c.bg,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0}}>{c.icon}</div>
                          <div><div style={{fontSize:13,fontWeight:700}}>{c.title}</div><div style={{fontSize:10,color:'#4d5577',fontFamily:'monospace',marginTop:2}}>{c.sub}</div></div>
                        </div>
                        <div style={{fontSize:12,color:'#8892b0',lineHeight:1.75}} dangerouslySetInnerHTML={{__html:c.body}}/>
                        {c.metrics?.length>0&&(
                          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginTop:10}}>
                            {c.metrics.map((m,j)=>(
                              <div key={j} style={{background:'#10131f',borderRadius:8,padding:8,textAlign:'center'}}>
                                <div style={{fontSize:15,fontWeight:800,fontFamily:'monospace'}}>{m.v}</div>
                                <div style={{fontSize:9,color:'#4d5577',fontFamily:'monospace',marginTop:2}}>{m.l}</div>
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
          </div>
        </div>
      </div>

      {/* ── ACTION PLAN MODAL ── */}
      {actionPlan&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.8)',backdropFilter:'blur(8px)',zIndex:800,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setActionPlan(null)}>
          <div style={{background:'#0c0e18',border:'1px solid rgba(91,143,249,.4)',borderRadius:20,padding:28,maxWidth:480,width:'90%',boxShadow:'0 8px 48px rgba(0,0,0,.7)'}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:18,fontWeight:700,marginBottom:4}}>{actionPlan.icon} {actionPlan.title}</div>
            <div style={{fontSize:12,color:'#8892b0',fontFamily:'monospace',marginBottom:18}}>{actionPlan.subtitle||'AI-generated action plan'}</div>
            {actionPlan.plan?.map((p,i)=>(
              <div key={i} style={{display:'flex',gap:12,marginBottom:12,alignItems:'flex-start'}}>
                <div style={{width:26,height:26,borderRadius:'50%',background:'rgba(91,143,249,.2)',color:'#5b8ff9',fontSize:12,fontWeight:800,fontFamily:'monospace',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{p.step}</div>
                <div style={{fontSize:13,color:'#c8d0e8',lineHeight:1.65,paddingTop:3}}>{p.action}</div>
              </div>
            ))}
            <div style={{display:'flex',gap:8,marginTop:20}}>
              <button onClick={ds.exportCSV} style={{flex:1,padding:'10px',borderRadius:10,background:'rgba(52,211,153,.12)',border:'1px solid rgba(52,211,153,.3)',color:'#34d399',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>⬇ Export Plan Data</button>
              <button onClick={()=>setActionPlan(null)} style={{flex:1,padding:'10px',borderRadius:10,background:'rgba(91,143,249,.15)',border:'1px solid rgba(91,143,249,.3)',color:'#5b8ff9',fontSize:13,fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CUSTOMIZE DRAWER ── */}
      <div style={{...S.drawer,...(showCustomize?S.drawerOpen:{})}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:18,borderBottom:'1px solid rgba(255,255,255,.07)',flexShrink:0}}>
          <div style={{fontSize:14,fontWeight:700}}>🎨 Customize Charts</div>
          <button style={{background:'none',border:'1px solid rgba(255,255,255,.1)',color:'#8892b0',borderRadius:8,width:28,height:28,cursor:'pointer',fontSize:13,display:'flex',alignItems:'center',justifyContent:'center'}} onClick={()=>setShowCustomize(false)}>✕</button>
        </div>
        <div style={{flex:1,overflowY:'auto',padding:14}}>
          <Sec label="Color Palette">
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {PALETTES.map(p=>(
                <div key={p} onClick={()=>setCfg(x=>({...x,palette:p}))} style={{padding:7,borderRadius:8,border:`1.5px solid ${cfg.palette===p?'#5b8ff9':'rgba(255,255,255,.08)'}`,background:'#10131f',cursor:'pointer',flex:1,minWidth:60}}>
                  <div style={{display:'flex',gap:2,marginBottom:3}}>{getColors(p).slice(0,5).map((c,i)=><div key={i} style={{width:7,height:7,borderRadius:'50%',background:c}}/>)}</div>
                  <div style={{fontSize:9,fontFamily:'monospace',color:'#4d5577',textAlign:'center'}}>{p}</div>
                </div>
              ))}
            </div>
          </Sec>
          <Sec label="Chart Type">
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:6}}>
              {CHART_TYPES.map(t=>(
                <div key={t.id} onClick={()=>setCfg(x=>({...x,chartType:t.id}))} style={{padding:'8px 4px',borderRadius:8,border:`1.5px solid ${cfg.chartType===t.id?'#5b8ff9':'rgba(255,255,255,.08)'}`,background:cfg.chartType===t.id?'rgba(91,143,249,.1)':'#10131f',cursor:'pointer',textAlign:'center',color:cfg.chartType===t.id?'#5b8ff9':'#8892b0'}}>
                  <div style={{fontSize:16}}>{t.icon}</div>
                  <div style={{fontSize:9,fontFamily:'monospace',marginTop:3}}>{t.label}</div>
                </div>
              ))}
            </div>
          </Sec>
          <Sec label="Appearance">
            {[{label:'Border Radius',key:'borderRadius',min:0,max:20,fmt:v=>v+'px'},{label:'Line Tension',key:'tension',min:0,max:10,fmt:v=>(v/10).toFixed(1),tr:v=>v/10,un:v=>v*10},{label:'Point Size',key:'pointSize',min:0,max:12,fmt:v=>v+'px'},{label:'Bar Width %',key:'barWidth',min:20,max:100,fmt:v=>v+'%',tr:v=>v/100,un:v=>Math.round(v*100)},{label:'Sample Pts',key:'sampleSize',min:20,max:500,fmt:v=>v,step:10}].map(sl=>(
              <div key={sl.key} style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                <span style={{fontSize:11,color:'#8892b0',minWidth:96}}>{sl.label}</span>
                <input type="range" min={sl.min} max={sl.max} step={sl.step||1} value={sl.un?sl.un(cfg[sl.key]):cfg[sl.key]} onChange={e=>{const v=parseInt(e.target.value);setCfg(x=>({...x,[sl.key]:sl.tr?sl.tr(v):v}));}} style={{flex:1,accentColor:'#5b8ff9'}}/>
                <span style={{fontSize:10,fontFamily:'monospace',color:'#5b8ff9',minWidth:32,textAlign:'right'}}>{sl.fmt(sl.un?sl.un(cfg[sl.key]):cfg[sl.key])}</span>
              </div>
            ))}
          </Sec>
          <Sec label="Options">
            {[{l:'Data Labels',k:'dataLabels'},{l:'Grid Lines',k:'grid'},{l:'Legend',k:'legend'},{l:'Animation',k:'animation'},{l:'Fill Area',k:'fill'},{l:'Stacked',k:'stacked'}].map(t=>(
              <div key={t.k} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                <span style={{fontSize:12,color:'#8892b0'}}>{t.l}</span>
                <div onClick={()=>setCfg(x=>({...x,[t.k]:!x[t.k]}))} style={{width:34,height:19,borderRadius:10,background:cfg[t.k]?'#5b8ff9':'rgba(255,255,255,.1)',cursor:'pointer',position:'relative',transition:'background .2s'}}>
                  <div style={{position:'absolute',width:13,height:13,borderRadius:'50%',background:'white',top:3,left:cfg[t.k]?18:3,transition:'left .2s'}}/>
                </div>
              </div>
            ))}
          </Sec>
          <button style={{...S.tbPrimary,width:'100%',padding:12,marginTop:8}} onClick={()=>setShowCustomize(false)}>Apply & Close</button>
        </div>
      </div>
      {showCustomize&&<div style={{position:'fixed',inset:0,zIndex:499}} onClick={()=>setShowCustomize(false)}/>}
    </div>
  );
}

function Sec({label,children}){return(<div style={{marginBottom:20}}><div style={{fontSize:9,fontWeight:800,letterSpacing:'.12em',textTransform:'uppercase',color:'#4d5577',fontFamily:'monospace',marginBottom:10}}>{label}</div>{children}</div>);}

// ─── STYLES ──────────────────────────────────────────────────
const S={
  root:{display:'flex',flexDirection:'column',height:'100vh',background:'#05060b',overflow:'hidden'},
  topbar:{height:56,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 16px',borderBottom:'1px solid rgba(255,255,255,.06)',background:'rgba(5,6,11,.95)',backdropFilter:'blur(20px)',flexShrink:0,zIndex:100},
  topLeft:{display:'flex',alignItems:'center',gap:12},
  brand:{fontSize:15,fontWeight:800,letterSpacing:-.3},
  sep:{width:1,height:18,background:'rgba(255,255,255,.1)'},
  nav:{display:'flex',gap:2},
  navBtn:{padding:'6px 14px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',color:'#8892b0',border:'none',background:'transparent',fontFamily:'inherit',transition:'all .2s'},
  navActive:{color:'#5b8ff9',background:'rgba(91,143,249,.1)'},
  topRight:{display:'flex',alignItems:'center',gap:10},
  dirtyBadge:{padding:'3px 10px',borderRadius:20,background:'rgba(52,211,153,.15)',color:'#34d399',fontSize:11,fontFamily:'monospace',fontWeight:700},
  fileChip:{display:'flex',alignItems:'center',gap:7,padding:'4px 12px',background:'#1b1f30',borderRadius:20,border:'1px solid rgba(255,255,255,.1)',fontSize:11},
  eli5Toggle:{display:'flex',alignItems:'center',gap:5,padding:'5px 11px',borderRadius:20,background:'rgba(124,107,245,.1)',border:'1px solid rgba(124,107,245,.25)',cursor:'pointer',transition:'all .2s'},
  userPill:{display:'flex',alignItems:'center',gap:8,padding:'4px 12px 4px 4px',borderRadius:24,border:'1.5px solid',cursor:'pointer'},
  avatar:{width:26,height:26,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700},
  logoutBtn:{padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',border:'1px solid rgba(255,255,255,.08)',background:'transparent',color:'#4d5577',fontFamily:'inherit'},
  body:{display:'grid',gridTemplateColumns:'256px 1fr',flex:1,overflow:'hidden'},
  sidebar:{borderRight:'1px solid rgba(255,255,255,.06)',background:'#080a12',display:'flex',flexDirection:'column',overflow:'hidden'},
  sInner:{flex:1,overflowY:'auto',padding:14,display:'flex',flexDirection:'column'},
  ss:{marginBottom:18},
  slabel:{fontSize:9,fontWeight:800,letterSpacing:'.14em',textTransform:'uppercase',color:'#4d5577',fontFamily:'monospace',marginBottom:8,display:'flex',alignItems:'center',justifyContent:'space-between'},
  uploadZone:{border:'1.5px dashed rgba(91,143,249,.3)',borderRadius:12,padding:'18px 12px',textAlign:'center',cursor:'pointer',transition:'all .25s',background:'rgba(91,143,249,.03)'},
  uploadDrag:{borderColor:'#5b8ff9',background:'rgba(91,143,249,.1)',transform:'scale(1.02)'},
  miniStat:{background:'#1b1f30',border:'1px solid rgba(255,255,255,.06)',borderRadius:8,padding:'8px 10px'},
  chip:{display:'inline-flex',alignItems:'center',padding:'2px 8px',borderRadius:20,fontSize:10,fontFamily:'monospace',fontWeight:700,background:'rgba(91,143,249,.15)',color:'#5b8ff9'},
  microBtn:{background:'none',border:'none',color:'#5b8ff9',fontSize:9,cursor:'pointer',fontFamily:'monospace'},
  colSearch:{width:'100%',padding:'7px 10px',background:'#1b1f30',border:'1px solid rgba(255,255,255,.06)',borderRadius:8,color:'#eef0fa',fontSize:11,fontFamily:'monospace',outline:'none',marginBottom:8},
  colRow:{display:'flex',alignItems:'center',gap:8,padding:'6px 8px',borderRadius:8,cursor:'pointer',transition:'background .15s',marginBottom:2},
  colRowOn:{background:'rgba(91,143,249,.1)'},
  colChk:{width:14,height:14,borderRadius:3,border:'1.5px solid rgba(255,255,255,.15)',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:8,transition:'all .15s'},
  colChkOn:{background:'#5b8ff9',borderColor:'#5b8ff9',color:'white'},
  typeBadge:{fontSize:8,padding:'1px 5px',borderRadius:3,fontFamily:'monospace',fontWeight:700,flexShrink:0},
  bNum:{background:'rgba(52,211,153,.15)',color:'#34d399'},
  bStr:{background:'rgba(91,143,249,.15)',color:'#5b8ff9'},
  bDate:{background:'rgba(124,107,245,.15)',color:'#7c6bf5'},
  content:{display:'flex',flexDirection:'column',overflow:'hidden',background:'#05060b'},
  toolbar:{padding:'8px 14px',borderBottom:'1px solid rgba(255,255,255,.06)',background:'#080a12',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',flexShrink:0},
  tbg:{display:'flex',alignItems:'center',gap:4},
  tbSep:{width:1,height:22,background:'rgba(255,255,255,.1)',margin:'0 4px'},
  tb:{display:'flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',border:'1px solid rgba(255,255,255,.08)',background:'#0c0e18',color:'#8892b0',fontFamily:'inherit',transition:'all .2s',whiteSpace:'nowrap'},
  tbPrimary:{display:'flex',alignItems:'center',gap:5,padding:'6px 12px',borderRadius:8,fontSize:12,fontWeight:600,cursor:'pointer',border:'1px solid rgba(91,143,249,.4)',background:'rgba(91,143,249,.15)',color:'#5b8ff9',fontFamily:'inherit',transition:'all .2s',whiteSpace:'nowrap'},
  tsel:{padding:'6px 10px',borderRadius:8,fontSize:12,border:'1px solid rgba(255,255,255,.08)',background:'#0c0e18',color:'#eef0fa',fontFamily:'inherit',cursor:'pointer',outline:'none'},
  workspace:{flex:1,overflowY:'auto',padding:18},
  empty:{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',height:'100%',gap:12,textAlign:'center',opacity:.75},
  kpi:{background:'#1b1f30',border:'1px solid rgba(255,255,255,.07)',borderTop:'2px solid',borderRadius:18,padding:16,transition:'all .2s',cursor:'pointer'},
  tableSearch:{flex:1,maxWidth:280,padding:'7px 12px',borderRadius:8,border:'1px solid rgba(255,255,255,.08)',background:'#0c0e18',color:'#eef0fa',fontSize:12,fontFamily:'monospace',outline:'none'},
  drawer:{position:'fixed',right:0,top:0,bottom:0,width:300,background:'#0c0e18',borderLeft:'1px solid rgba(255,255,255,.1)',zIndex:500,transform:'translateX(100%)',transition:'transform .3s ease',display:'flex',flexDirection:'column'},
  drawerOpen:{transform:'translateX(0)'},
};

const SAMPLE_DATA=(()=>{
  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const regions=['North America','Europe','Asia Pacific','Latin America','Middle East'];
  const products=['Analytics Pro','CloudSync','ML Studio','DataVision','AutoReport'];
  const d=[];
  months.forEach((m,mi)=>regions.forEach(reg=>products.forEach((prod,pi)=>{
    const base=(mi+1)*9000+pi*6000+reg.length*180;
    const growth=1+(mi*0.025)+(Math.random()*.12-.06);
    const rev=Math.round(base*growth);
    const cost=Math.round(rev*(.33+Math.random()*.14));
    d.push({Month:m,Quarter:'Q'+(Math.floor(mi/3)+1),Region:reg,Product:prod,Revenue:rev,Cost:cost,Profit:rev-cost,Units:Math.round(rev/160),Customers:Math.round(rev/300+Math.random()*60),Satisfaction:+(3.4+Math.random()*1.5).toFixed(1),MarketShare:+(4+pi*2.5+Math.random()*3).toFixed(2)});
  })));
  return d;
})();